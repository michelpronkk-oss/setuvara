-- Audience: one place for a member's subscribers, and email campaigns to them.
--
--   1. Consent lives only on confirmed Newsletter signups. A newsletter Action is a list; its
--      Subscribed rows in action_submissions are the subscriptions. No other Action kind ever
--      puts someone on a list, and owners can't add or restore people who left by themselves.
--   2. Campaigns: the owner writes a draft for one or more of their lists. Queueing snapshots
--      the confirmed subscribers once (one email per address) and checks the plan's quota.
--   3. Delivery: trusted server jobs claim recipients in batches with a lease. A batch that was
--      handed to the provider but never reported keeps its key, so a retry reuses the same
--      idempotency key and nobody gets the email twice.
--   4. Unsubscribe: every email carries a signed link and one-click header. It removes that
--      address from the campaign's lists and the owner can't undo it.

-- 1. Who removed a subscriber. 'person' sticks: only a new confirmed signup brings them back.
alter table public.action_submissions add column if not exists unsubscribed_by text
  check (unsubscribed_by is null or unsubscribed_by in ('person','owner'));
alter table public.action_submissions add column if not exists unsubscribed_at timestamptz;
grant select (unsubscribed_by, unsubscribed_at) on public.action_submissions to authenticated;
create index if not exists action_submissions_list_idx on public.action_submissions (profile_id, action_id, email_norm)
  where kind='newsletter' and status='subscribed';

create or replace function public.set_action_submission_status(p_submission_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path='' as $function$
declare s public.action_submissions;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  select * into s from public.action_submissions where id=p_submission_id and profile_id=auth.uid() for update;
  if not found then return false; end if;
  if not private.action_status_ok(s.kind, p_status) or p_status='pending_verification'
     or (p_status in ('entered','subscribed') and s.verified_at is null)
     or (p_status='subscribed' and s.unsubscribed_by='person') then
    raise exception using errcode='22023', message='invalid_status';
  end if;
  update public.action_submissions set status=p_status,
      unsubscribed_by=case when s.kind='newsletter' and p_status='unsubscribed' then 'owner' when p_status='subscribed' then null else unsubscribed_by end,
      unsubscribed_at=case when s.kind='newsletter' and p_status='unsubscribed' then pg_catalog.statement_timestamp() when p_status='subscribed' then null else unsubscribed_at end
    where id=s.id;
  return true;
end;
$function$;
revoke all on function public.set_action_submission_status(uuid,text) from public, anon;
grant execute on function public.set_action_submission_status(uuid,text) to authenticated;

-- Plan limits for sending. One row per plan; change limits here without a release.
create table if not exists private.audience_plan_limits (
  plan_code text primary key check (plan_code in ('free','plus','pro')),
  can_send boolean not null,
  monthly_emails integer not null check (monthly_emails between 0 and 1000000),
  daily_campaigns integer not null check (daily_campaigns between 0 and 100),
  campaign_tests integer not null check (campaign_tests between 0 and 50)
);
insert into private.audience_plan_limits values
  ('free', false, 0, 0, 0),
  ('plus', true, 2500, 2, 5),
  ('pro', true, 20000, 10, 10)
on conflict (plan_code) do nothing;
revoke all on private.audience_plan_limits from public, anon, authenticated;

-- 2. Campaigns.
create table public.audience_campaigns (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- The Mode it was written from: its name and Appearance sign the email.
  mode_id uuid references public.profile_modes(id) on delete set null,
  list_ids uuid[] not null default '{}' check (cardinality(list_ids) <= 24),
  subject text not null default '' check (char_length(subject) <= 150),
  preheader text not null default '' check (char_length(preheader) <= 150),
  body text not null default '' check (char_length(body) <= 20000),
  reply_to text check (reply_to is null or (char_length(reply_to) <= 254 and reply_to ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  status text not null default 'draft' check (status in ('draft','queued','sending','sent','failed','canceled')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  test_count integer not null default 0 check (test_count >= 0),
  queued_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp()
);
create index audience_campaigns_owner_idx on public.audience_campaigns (profile_id, created_at desc);
create index audience_campaigns_quota_idx on public.audience_campaigns (profile_id, queued_at) where queued_at is not null;
create index audience_campaigns_work_idx on public.audience_campaigns (queued_at) where status in ('queued','sending');

create table public.audience_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.audience_campaigns(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email text not null check (char_length(email) <= 254),
  email_norm text not null check (char_length(email_norm) <= 254),
  name text not null default '' check (char_length(name) <= 80),
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped')),
  attempts integer not null default 0 check (attempts between 0 and 20),
  batch_key uuid,
  lease_until timestamptz,
  provider_id text check (provider_id is null or char_length(provider_id) <= 120),
  last_error text check (last_error is null or char_length(last_error) <= 200),
  sent_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (campaign_id, email_norm)
);
create index audience_recipients_work_idx on public.audience_campaign_recipients (campaign_id, status, lease_until);
create index audience_recipients_batch_idx on public.audience_campaign_recipients (batch_key) where batch_key is not null;

-- Owners write drafts; everything else about a campaign is the server's. The trigger runs as the
-- caller, so writes from the definer functions below (and the service role) count as trusted.
create function private.validate_audience_campaign() returns trigger language plpgsql set search_path='' as $function$
declare v_trusted boolean := current_user not in ('authenticated','anon');
begin
  if not v_trusted then
    if tg_op='UPDATE' and old.status <> 'draft' then raise exception using errcode='42501', message='campaign_locked'; end if;
    if tg_op='UPDATE' and new.profile_id <> old.profile_id then raise exception using errcode='42501', message='campaign_locked'; end if;
    if new.status <> 'draft' or new.recipient_count <> 0 or new.sent_count <> 0 or new.failed_count <> 0 or new.skipped_count <> 0
       or new.queued_at is not null or new.started_at is not null or new.finished_at is not null
       or (tg_op='INSERT' and new.test_count <> 0) or (tg_op='UPDATE' and new.test_count <> old.test_count) then
      raise exception using errcode='42501', message='campaign_locked';
    end if;
  end if;
  if new.mode_id is not null and not exists(select 1 from public.profile_modes m where m.id=new.mode_id and m.profile_id=new.profile_id) then
    raise exception using errcode='23514', message='campaign_mode_invalid';
  end if;
  if exists(select 1 from pg_catalog.unnest(new.list_ids) l(id) where not exists(
      select 1 from public.profile_actions a where a.id=l.id and a.profile_id=new.profile_id and a.kind='newsletter')) then
    raise exception using errcode='23514', message='campaign_list_invalid';
  end if;
  new.list_ids := array(select distinct l from pg_catalog.unnest(new.list_ids) l order by l);
  return new;
end;
$function$;
revoke all on function private.validate_audience_campaign() from public, anon, authenticated;
create trigger audience_campaigns_validate before insert or update on public.audience_campaigns
  for each row execute function private.validate_audience_campaign();
create trigger audience_campaigns_set_updated_at before update on public.audience_campaigns
  for each row execute function private.set_updated_at();

alter table public.audience_campaigns enable row level security;
alter table public.audience_campaign_recipients enable row level security;
revoke all on public.audience_campaigns, public.audience_campaign_recipients from public, anon, authenticated;
grant select, delete on public.audience_campaigns to authenticated;
grant insert (profile_id, mode_id, list_ids, subject, preheader, body, reply_to) on public.audience_campaigns to authenticated;
grant update (mode_id, list_ids, subject, preheader, body, reply_to) on public.audience_campaigns to authenticated;
grant select (id, campaign_id, email, name, status, sent_at, created_at) on public.audience_campaign_recipients to authenticated;
grant all on public.audience_campaigns, public.audience_campaign_recipients to service_role;
create policy audience_campaigns_owner_read on public.audience_campaigns for select to authenticated
  using (profile_id=(select auth.uid()));
create policy audience_campaigns_owner_insert on public.audience_campaigns for insert to authenticated
  with check (profile_id=(select auth.uid()) and status='draft');
create policy audience_campaigns_owner_update on public.audience_campaigns for update to authenticated
  using (profile_id=(select auth.uid()) and status='draft') with check (profile_id=(select auth.uid()));
-- Only drafts can be thrown away; sent campaigns are the history.
create policy audience_campaigns_owner_delete on public.audience_campaigns for delete to authenticated
  using (profile_id=(select auth.uid()) and status='draft');
create policy audience_recipients_owner_read on public.audience_campaign_recipients for select to authenticated
  using (profile_id=(select auth.uid()));

-- What the owner's plan allows and what this month has used, for the composer.
create function public.my_audience_limits()
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('plan',l.plan_code,'can_send',l.can_send,'monthly_emails',l.monthly_emails,
    'daily_campaigns',l.daily_campaigns,'campaign_tests',l.campaign_tests,
    'used_this_month',coalesce((select sum(c.recipient_count) from public.audience_campaigns c
      where c.profile_id=auth.uid() and c.queued_at >= pg_catalog.date_trunc('month', pg_catalog.statement_timestamp() at time zone 'UTC') at time zone 'UTC'),0),
    'campaigns_today',(select count(*) from public.audience_campaigns c
      where c.profile_id=auth.uid() and c.queued_at > pg_catalog.statement_timestamp() - interval '24 hours'))
  from private.audience_plan_limits l where l.plan_code=private.member_plan(auth.uid())
$function$;
revoke all on function public.my_audience_limits() from public, anon;
grant execute on function public.my_audience_limits() to authenticated;

-- The owner's audience in numbers: people, lists, Modes and the last 90 days.
create function public.my_audience_summary()
returns jsonb language sql stable security definer set search_path='' as $function$
  with subs as (
    select s.action_id, s.email_norm, s.status, s.verified_at, s.unsubscribed_at, s.created_at, a.mode_id
    from public.action_submissions s join public.profile_actions a on a.id=s.action_id
    where s.profile_id=auth.uid() and s.kind='newsletter' and s.email_norm is not null
  ), days as (
    select d::date as day from pg_catalog.generate_series((pg_catalog.statement_timestamp() at time zone 'UTC')::date - 89, (pg_catalog.statement_timestamp() at time zone 'UTC')::date, interval '1 day') d
  )
  select jsonb_build_object(
    'people', (select count(distinct email_norm) from subs where status='subscribed'),
    'pending', (select count(distinct email_norm) from subs where status='pending_verification'),
    'left', (select count(*) from subs where status='unsubscribed'),
    'joined_30d', (select count(*) from subs where verified_at > pg_catalog.statement_timestamp() - interval '30 days'),
    'left_30d', (select count(*) from subs where unsubscribed_at > pg_catalog.statement_timestamp() - interval '30 days'),
    'lists', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'status',a.status,'mode',m.slug,
        'subscribed',(select count(*) from subs where subs.action_id=a.id and subs.status='subscribed'),
        'pending',(select count(*) from subs where subs.action_id=a.id and subs.status='pending_verification'))
        order by a.created_at)
      from public.profile_actions a join public.profile_modes m on m.id=a.mode_id
      where a.profile_id=auth.uid() and a.kind='newsletter'), '[]'::jsonb),
    'daily', (select jsonb_agg(jsonb_build_object('day',days.day,
        'joined',(select count(*) from subs where (subs.verified_at at time zone 'UTC')::date=days.day),
        'left',(select count(*) from subs where (subs.unsubscribed_at at time zone 'UTC')::date=days.day)) order by days.day)
      from days)
  )
$function$;
revoke all on function public.my_audience_summary() from public, anon;
grant execute on function public.my_audience_summary() to authenticated;

-- Queue a draft: plan check, then one recipient per confirmed address on its lists.
create function public.queue_audience_campaign(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  c public.audience_campaigns;
  l private.audience_plan_limits;
  v_count integer;
  v_used bigint;
  v_now timestamptz := pg_catalog.statement_timestamp();
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('audience_send:'||auth.uid()::text, 0));
  select * into c from public.audience_campaigns where id=p_campaign_id and profile_id=auth.uid() for update;
  if not found then raise exception using errcode='P0002', message='campaign_not_found'; end if;
  if c.status <> 'draft' then raise exception using errcode='22023', message='campaign_locked'; end if;
  if pg_catalog.char_length(pg_catalog.btrim(c.subject)) = 0 then raise exception using errcode='22023', message='campaign_subject_required'; end if;
  if pg_catalog.char_length(pg_catalog.btrim(c.body)) = 0 then raise exception using errcode='22023', message='campaign_body_required'; end if;
  if cardinality(c.list_ids) = 0 then raise exception using errcode='22023', message='campaign_list_required'; end if;
  select * into l from private.audience_plan_limits where plan_code=private.member_plan(auth.uid());
  if not l.can_send then raise exception using errcode='P0001', message='plan_send_unavailable'; end if;
  if (select count(*) from public.audience_campaigns x where x.profile_id=auth.uid() and x.queued_at > v_now - interval '24 hours') >= l.daily_campaigns then
    raise exception using errcode='P0001', message='plan_daily_campaigns';
  end if;

  insert into public.audience_campaign_recipients(campaign_id, profile_id, email, email_norm, name)
  select distinct on (s.email_norm) c.id, c.profile_id, s.email, s.email_norm, s.name
  from public.action_submissions s
  where s.profile_id=c.profile_id and s.kind='newsletter' and s.status='subscribed' and s.action_id = any(c.list_ids)
    and s.email is not null and s.email_norm is not null
  order by s.email_norm, s.verified_at;
  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception using errcode='22023', message='campaign_no_recipients'; end if;

  select coalesce(sum(x.recipient_count),0) into v_used from public.audience_campaigns x
    where x.profile_id=auth.uid() and x.queued_at >= pg_catalog.date_trunc('month', v_now at time zone 'UTC') at time zone 'UTC';
  if v_used + v_count > l.monthly_emails then raise exception using errcode='P0001', message='plan_monthly_emails'; end if;

  update public.audience_campaigns set status='queued', recipient_count=v_count, queued_at=v_now where id=c.id;
  return jsonb_build_object('id',c.id,'recipients',v_count);
end;
$function$;
revoke all on function public.queue_audience_campaign(uuid) from public, anon;
grant execute on function public.queue_audience_campaign(uuid) to authenticated;

-- Test sends to the owner's own inbox count against a small per-campaign allowance.
create function public.note_audience_campaign_test(p_campaign_id uuid)
returns boolean language plpgsql security definer set search_path='' as $function$
declare c public.audience_campaigns; l private.audience_plan_limits;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  select * into c from public.audience_campaigns where id=p_campaign_id and profile_id=auth.uid() for update;
  if not found or c.status <> 'draft' then return false; end if;
  select * into l from private.audience_plan_limits where plan_code=private.member_plan(auth.uid());
  if not l.can_send then raise exception using errcode='P0001', message='plan_send_unavailable'; end if;
  if c.test_count >= l.campaign_tests then raise exception using errcode='P0001', message='plan_campaign_tests'; end if;
  update public.audience_campaigns set test_count=test_count+1 where id=c.id;
  return true;
end;
$function$;
revoke all on function public.note_audience_campaign_test(uuid) from public, anon;
grant execute on function public.note_audience_campaign_test(uuid) to authenticated;

-- 3. Delivery, for trusted server jobs only.
-- Claims one batch of one campaign. A batch whose lease ran out comes back whole, with its key.
create function public.claim_audience_batch(p_campaign_id uuid, p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_campaign uuid := p_campaign_id;
  v_key uuid;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_limit integer := least(greatest(coalesce(p_limit,100),1),100);
  c public.audience_campaigns;
  v_rows jsonb;
begin
  if v_campaign is null then
    select x.id into v_campaign from public.audience_campaigns x where x.status in ('queued','sending') order by x.queued_at limit 1;
    if v_campaign is null then return null; end if;
  end if;
  select * into c from public.audience_campaigns where id=v_campaign and status in ('queued','sending') for update;
  if not found then return null; end if;

  -- People who left since queueing are skipped, never sent.
  update public.audience_campaign_recipients r set status='skipped', lease_until=null
    where r.campaign_id=c.id and r.status='queued' and not exists(
      select 1 from public.action_submissions s where s.profile_id=c.profile_id and s.kind='newsletter' and s.status='subscribed'
        and s.action_id = any(c.list_ids) and s.email_norm=r.email_norm);

  -- A batch that never reported after five tries is given up on rather than risked again.
  update public.audience_campaign_recipients r set status='failed', lease_until=null, last_error='no_report'
    where r.campaign_id=c.id and r.status='sending' and r.lease_until < v_now and r.attempts >= 5;

  select r.batch_key into v_key from public.audience_campaign_recipients r
    where r.campaign_id=c.id and r.status='sending' and r.lease_until < v_now limit 1;
  if v_key is not null then
    update public.audience_campaign_recipients set lease_until=v_now + interval '5 minutes', attempts=least(attempts+1,20)
      where campaign_id=c.id and batch_key=v_key and status='sending';
  else
    v_key := gen_random_uuid();
    update public.audience_campaign_recipients r set status='sending', batch_key=v_key, lease_until=v_now + interval '5 minutes', attempts=least(r.attempts+1,20)
      where r.id in (select x.id from public.audience_campaign_recipients x
        where x.campaign_id=c.id and x.status='queued' and (x.lease_until is null or x.lease_until < v_now)
        order by x.created_at, x.id limit v_limit for update skip locked);
    if not found then
      perform private.finish_audience_campaign(c.id);
      return null;
    end if;
  end if;
  if c.status='queued' then update public.audience_campaigns set status='sending', started_at=v_now where id=c.id; end if;

  select jsonb_agg(jsonb_build_object('id',r.id,'email',r.email,'name',r.name,'attempts',r.attempts) order by r.created_at, r.id) into v_rows
    from public.audience_campaign_recipients r where r.batch_key=v_key and r.status='sending';
  return jsonb_build_object('campaign_id',c.id,'profile_id',c.profile_id,'mode_id',c.mode_id,'batch_key',v_key,
    'subject',c.subject,'preheader',c.preheader,'body',c.body,'reply_to',c.reply_to,'list_ids',to_jsonb(c.list_ids),'recipients',v_rows);
end;
$function$;

-- Closes a campaign once nothing is waiting, and keeps its counts in step.
create function private.finish_audience_campaign(p_campaign_id uuid)
returns void language plpgsql security definer set search_path='' as $function$
declare v_sent integer; v_failed integer; v_skipped integer; v_open integer;
begin
  select count(*) filter (where status='sent'), count(*) filter (where status='failed'), count(*) filter (where status='skipped'),
         count(*) filter (where status in ('queued','sending'))
    into v_sent, v_failed, v_skipped, v_open
    from public.audience_campaign_recipients where campaign_id=p_campaign_id;
  update public.audience_campaigns set sent_count=v_sent, failed_count=v_failed, skipped_count=v_skipped,
      status=case when v_open > 0 then status when v_sent > 0 or v_skipped > 0 and v_failed = 0 then 'sent' else 'failed' end,
      finished_at=case when v_open > 0 then null else pg_catalog.statement_timestamp() end
    where id=p_campaign_id and status in ('queued','sending');
end;
$function$;

-- Records what the provider said for a batch. ok=false with retry=true puts people back in the queue.
create function public.complete_audience_batch(p_batch_key uuid, p_ok boolean, p_provider_ids jsonb, p_error text, p_retry boolean)
returns void language plpgsql security definer set search_path='' as $function$
declare v_campaign uuid; v_now timestamptz := pg_catalog.statement_timestamp();
begin
  select campaign_id into v_campaign from public.audience_campaign_recipients where batch_key=p_batch_key limit 1;
  if v_campaign is null then return; end if;
  if p_ok then
    update public.audience_campaign_recipients r set status='sent', sent_at=v_now, lease_until=null, last_error=null,
        provider_id=pg_catalog.left(p_provider_ids->>(r.id::text), 120)
      where r.batch_key=p_batch_key and r.status='sending';
  else
    update public.audience_campaign_recipients r set
        status=case when p_retry and r.attempts < 5 then 'queued' else 'failed' end,
        batch_key=case when p_retry and r.attempts < 5 then null else r.batch_key end,
        lease_until=case when p_retry and r.attempts < 5 then v_now + (interval '1 minute' * power(2, r.attempts)) else null end,
        last_error=pg_catalog.left(coalesce(p_error,'send_failed'), 200)
      where r.batch_key=p_batch_key and r.status='sending';
  end if;
  perform private.finish_audience_campaign(v_campaign);
end;
$function$;
revoke all on function public.claim_audience_batch(uuid,integer), private.finish_audience_campaign(uuid),
  public.complete_audience_batch(uuid,boolean,jsonb,text,boolean) from public, anon, authenticated;
grant execute on function public.claim_audience_batch(uuid,integer), public.complete_audience_batch(uuid,boolean,jsonb,text,boolean) to service_role;

-- 4. Unsubscribe from a campaign's lists. The server checks the signed link first.
create function public.audience_unsubscribe(p_recipient_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare r public.audience_campaign_recipients; c public.audience_campaigns; v_count integer;
begin
  select * into r from public.audience_campaign_recipients where id=p_recipient_id;
  if not found then return jsonb_build_object('ok',false); end if;
  select * into c from public.audience_campaigns where id=r.campaign_id;
  update public.action_submissions s set status='unsubscribed', unsubscribed_by='person', unsubscribed_at=pg_catalog.statement_timestamp()
    where s.profile_id=c.profile_id and s.kind='newsletter' and s.status in ('subscribed','pending_verification')
      and s.action_id = any(c.list_ids) and s.email_norm=r.email_norm;
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok',true,'removed',v_count,'profile_id',c.profile_id,'mode_id',c.mode_id,
    'lists',(select coalesce(jsonb_agg(a.title order by a.created_at),'[]'::jsonb) from public.profile_actions a where a.id = any(c.list_ids)));
end;
$function$;
revoke all on function public.audience_unsubscribe(uuid) from public, anon, authenticated;
grant execute on function public.audience_unsubscribe(uuid) to service_role;
