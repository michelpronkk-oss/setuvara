-- Business Mode 2.0, slice 1: the Lead Inbox and Conversion Analytics.
--
--   1. Leads. Every inquiry an Action takes on Business Mode (Collab, Booking, Submission, Form)
--      becomes a lead, or joins the open lead that already has that email. The owner moves it
--      New → Contacted → Qualified → Won or Lost. The submission stays the source of truth for
--      what was asked; the lead is the relationship around it.
--   2. Activity. An append-only history per lead: created, another inquiry, stage changes, notes.
--      Written only by the functions below, never directly.
--   3. Funnel. Counts already recorded elsewhere, side by side for one window: profile visits,
--      Action views and opens, responses, leads, booking requests, accepted bookings, won leads.
--      Each is a count of its own events in the window; nothing links one visitor across steps,
--      and there is no revenue. The page says so.
--
-- Access goes through private.business_can(), owner only for now, so Business Teams can widen it
-- in one place later.

-- Plan limits. Free: inbox, stages, history, 7-day funnel. Plus/Pro: notes, export, longer windows.
create table private.business_plan_limits (
  plan_code text primary key check (plan_code in ('free','plus','pro')),
  can_note boolean not null,
  can_export boolean not null,
  funnel_days integer not null check (funnel_days between 1 and 400)
);
insert into private.business_plan_limits values ('free', false, false, 7), ('plus', true, true, 90), ('pro', true, true, 365);
revoke all on private.business_plan_limits from public, anon, authenticated;

-- The one access rule for business data. Owner only; Business Teams extends this.
create function private.business_can(p_profile_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path='' as $function$
  select p_user is not null and p_profile_id = p_user
$function$;
revoke all on function private.business_can(uuid,uuid) from public, anon, authenticated;

-- The same rule for the signed-in member only, for row policies. It answers for the caller alone.
create function public.can_access_business(p_profile_id uuid)
returns boolean language sql stable security definer set search_path='' as $function$
  select private.business_can(p_profile_id, (select auth.uid()))
$function$;
revoke all on function public.can_access_business(uuid) from public, anon;
grant execute on function public.can_access_business(uuid) to authenticated;

create function public.my_business_limits()
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('plan', l.plan_code, 'can_note', l.can_note, 'can_export', l.can_export, 'funnel_days', l.funnel_days)
  from private.business_plan_limits l where l.plan_code = private.member_plan(auth.uid())
$function$;
revoke all on function public.my_business_limits() from public, anon;
grant execute on function public.my_business_limits() to authenticated;

-- 1. Leads.
create table public.business_leads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  mode_id uuid not null references public.profile_modes(id) on delete cascade,
  source_submission_id uuid references public.action_submissions(id) on delete set null,
  source_action_id uuid references public.profile_actions(id) on delete set null,
  name text not null default '' check (char_length(name) <= 80),
  email text check (email is null or char_length(email) <= 254),
  email_norm text check (email_norm is null or char_length(email_norm) <= 254),
  stage text not null default 'new' check (stage in ('new','contacted','qualified','won','lost')),
  lost_reason text check (lost_reason is null or char_length(lost_reason) <= 200),
  inquiries integer not null default 1 check (inquiries >= 1),
  stage_changed_at timestamptz not null default pg_catalog.statement_timestamp(),
  last_activity_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  check (stage = 'lost' or lost_reason is null)
);
create index business_leads_owner_idx on public.business_leads (profile_id, last_activity_at desc);
create index business_leads_stage_idx on public.business_leads (profile_id, stage, last_activity_at desc);
create index business_leads_created_idx on public.business_leads (profile_id, created_at);
create unique index business_leads_submission_uidx on public.business_leads (source_submission_id) where source_submission_id is not null;
create index business_leads_action_idx on public.business_leads (source_action_id) where source_action_id is not null;
create index business_leads_mode_idx on public.business_leads (mode_id);
-- One open lead per email per business: a second inquiry joins it instead of starting another.
create unique index business_leads_open_email_uidx on public.business_leads (profile_id, email_norm)
  where email_norm is not null and stage not in ('won','lost');
create trigger business_leads_set_updated_at before update on public.business_leads
  for each row execute function private.set_updated_at();

-- 2. Activity.
create table public.business_lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.business_leads(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('created','inquiry','stage','note')),
  submission_id uuid references public.action_submissions(id) on delete set null,
  from_stage text check (from_stage is null or from_stage in ('new','contacted','qualified','won','lost')),
  to_stage text check (to_stage is null or to_stage in ('new','contacted','qualified','won','lost')),
  body text check (body is null or char_length(body) between 1 and 2000),
  actor_user_id uuid references public.profiles(id) on delete set null,
  idempotency_key text check (idempotency_key is null or idempotency_key ~ '^[A-Za-z0-9_-]{16,64}$'),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  check (kind <> 'stage' or (from_stage is not null and to_stage is not null)),
  check (kind <> 'note' or body is not null),
  unique (lead_id, idempotency_key)
);
create index business_lead_activities_lead_idx on public.business_lead_activities (lead_id, created_at desc);
create index business_lead_activities_owner_idx on public.business_lead_activities (profile_id);
create index business_lead_activities_submission_idx on public.business_lead_activities (submission_id) where submission_id is not null;
create index business_lead_activities_actor_idx on public.business_lead_activities (actor_user_id) where actor_user_id is not null;

alter table public.business_leads enable row level security;
alter table public.business_lead_activities enable row level security;
revoke all on public.business_leads, public.business_lead_activities from public, anon, authenticated;
grant select on public.business_leads, public.business_lead_activities to authenticated;
grant all on public.business_leads, public.business_lead_activities to service_role;
create policy business_leads_read on public.business_leads for select to authenticated
  using (public.can_access_business(profile_id));
create policy business_lead_activities_read on public.business_lead_activities for select to authenticated
  using (public.can_access_business(profile_id));

-- An inquiry on Business Mode becomes a lead, or joins the open lead with its email.
create function private.lead_from_submission(s public.action_submissions)
returns uuid language plpgsql security definer set search_path='' as $function$
declare
  v_mode uuid;
  v_lead uuid;
begin
  if s.kind not in ('collab','booking','submission','form') or s.status in ('spam','pending_verification') then return null; end if;
  select a.mode_id into v_mode from public.profile_actions a join public.profile_modes m on m.id = a.mode_id
    where a.id = s.action_id and m.slug = 'business';
  if v_mode is null then return null; end if;
  if exists(select 1 from public.business_lead_activities x where x.submission_id = s.id) then
    return (select x.lead_id from public.business_lead_activities x where x.submission_id = s.id limit 1);
  end if;

  if s.email_norm is not null then
    -- Two inquiries from one email at once wait for each other, so the second joins the first.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('business-lead:'||s.profile_id::text||':'||s.email_norm, 0));
    select l.id into v_lead from public.business_leads l
      where l.profile_id = s.profile_id and l.email_norm = s.email_norm and l.stage not in ('won','lost') for update;
  end if;
  if v_lead is not null then
    update public.business_leads set inquiries = inquiries + 1, last_activity_at = s.created_at,
      name = case when name = '' then s.name else name end where id = v_lead;
    insert into public.business_lead_activities (lead_id, profile_id, kind, submission_id, created_at)
      values (v_lead, s.profile_id, 'inquiry', s.id, s.created_at);
    return v_lead;
  end if;

  insert into public.business_leads (profile_id, mode_id, source_submission_id, source_action_id, name, email, email_norm,
      stage_changed_at, last_activity_at, created_at)
    values (s.profile_id, v_mode, s.id, s.action_id, s.name, s.email, s.email_norm, s.created_at, s.created_at, s.created_at)
    returning id into v_lead;
  insert into public.business_lead_activities (lead_id, profile_id, kind, submission_id, created_at)
    values (v_lead, s.profile_id, 'created', s.id, s.created_at);
  return v_lead;
end;
$function$;

create function private.on_submission_lead() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if tg_op = 'INSERT' then
    perform private.lead_from_submission(new);
  elsif new.status = 'spam' and old.status <> 'spam' then
    -- Marked as spam: an untouched lead that only came from it goes; anything worked on stays.
    delete from public.business_leads l where l.source_submission_id = new.id and l.stage = 'new' and l.inquiries = 1
      and not exists(select 1 from public.business_lead_activities x where x.lead_id = l.id and x.kind in ('stage','note'));
  elsif old.status = 'spam' and new.status <> 'spam' then
    perform private.lead_from_submission(new);
  end if;
  return null;
end;
$function$;
create trigger action_submissions_business_lead after insert or update of status on public.action_submissions
  for each row execute function private.on_submission_lead();

-- Owner actions.
create function public.set_business_lead_stage(p_lead_id uuid, p_stage text, p_lost_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  l public.business_leads;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_lost_reason, '')), '');
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if p_stage is null or p_stage not in ('new','contacted','qualified','won','lost') then raise exception using errcode='22023', message='invalid_stage'; end if;
  if v_reason is not null and (p_stage <> 'lost' or pg_catalog.char_length(v_reason) > 200) then raise exception using errcode='22023', message='invalid_reason'; end if;
  select * into l from public.business_leads where id = p_lead_id for update;
  if not found or not private.business_can(l.profile_id, auth.uid()) then raise exception using errcode='P0002', message='lead_not_found'; end if;
  if l.stage = p_stage and l.lost_reason is not distinct from v_reason then
    return jsonb_build_object('id', l.id, 'stage', l.stage, 'changed', false);
  end if;
  -- Reopening needs the email free: another open lead may have it by now.
  if l.stage in ('won','lost') and p_stage not in ('won','lost') and l.email_norm is not null and exists(
      select 1 from public.business_leads o where o.profile_id = l.profile_id and o.email_norm = l.email_norm and o.id <> l.id and o.stage not in ('won','lost')) then
    raise exception using errcode='23505', message='lead_open_elsewhere';
  end if;
  update public.business_leads set stage = p_stage, lost_reason = v_reason, stage_changed_at = pg_catalog.statement_timestamp(),
    last_activity_at = pg_catalog.statement_timestamp() where id = l.id;
  if l.stage <> p_stage then
    insert into public.business_lead_activities (lead_id, profile_id, kind, from_stage, to_stage, actor_user_id)
      values (l.id, l.profile_id, 'stage', l.stage, p_stage, auth.uid());
  end if;
  return jsonb_build_object('id', l.id, 'stage', p_stage, 'changed', true);
end;
$function$;

create function public.add_business_lead_note(p_lead_id uuid, p_body text, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $function$
declare
  l public.business_leads;
  v_body text := pg_catalog.btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if pg_catalog.char_length(v_body) not between 1 and 2000 then raise exception using errcode='22023', message='invalid_note'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception using errcode='22023', message='invalid_request'; end if;
  select * into l from public.business_leads where id = p_lead_id for update;
  if not found or not private.business_can(l.profile_id, auth.uid()) then raise exception using errcode='P0002', message='lead_not_found'; end if;
  if not (select b.can_note from private.business_plan_limits b where b.plan_code = private.member_plan(l.profile_id)) then
    raise exception using errcode='P0001', message='notes_require_plus';
  end if;
  select x.id into v_id from public.business_lead_activities x where x.lead_id = l.id and x.idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  insert into public.business_lead_activities (lead_id, profile_id, kind, body, actor_user_id, idempotency_key)
    values (l.id, l.profile_id, 'note', v_body, auth.uid(), p_idempotency_key) returning id into v_id;
  update public.business_leads set last_activity_at = pg_catalog.statement_timestamp() where id = l.id;
  return v_id;
end;
$function$;

-- 3. The funnel for the signed-in business, over the window its plan allows.
create function public.my_business_funnel(p_days integer default 30)
returns jsonb language sql stable security definer set search_path='' as $function$
  with lim as (
    select least(greatest(coalesce(p_days, 30), 1), l.funnel_days) as days, l.funnel_days as plan_days
    from private.business_plan_limits l where l.plan_code = private.member_plan(auth.uid())
  ), win as (
    select lim.days, lim.plan_days, (pg_catalog.statement_timestamp() at time zone 'UTC')::date - (lim.days - 1) as since from lim
  ), biz as (
    select a.id from public.profile_actions a join public.profile_modes m on m.id = a.mode_id
    where a.profile_id = auth.uid() and m.slug = 'business'
  ), subs as (
    select s.kind, s.status from public.action_submissions s, win
    where s.profile_id = auth.uid() and s.action_id in (select id from biz) and s.status not in ('spam','pending_verification')
      and (s.created_at at time zone 'UTC')::date >= win.since
  )
  select jsonb_build_object(
    'days', win.days, 'plan_days', win.plan_days, 'since', win.since,
    'visits', (select count(*) from private.product_analytics_events e
      where e.owner_profile_id = auth.uid() and e.event_name = 'profile_viewed' and e.mode_slug = 'business'
        and (e.occurred_at at time zone 'UTC')::date >= win.since),
    'action_views', (select coalesce(sum(d.views), 0) from public.action_daily_stats d where d.profile_id = auth.uid() and d.action_id in (select id from biz) and d.day >= win.since),
    'action_opens', (select coalesce(sum(d.opens), 0) from public.action_daily_stats d where d.profile_id = auth.uid() and d.action_id in (select id from biz) and d.day >= win.since),
    'responses', (select count(*) from subs),
    'leads', (select count(*) from public.business_leads l where l.profile_id = auth.uid() and (l.created_at at time zone 'UTC')::date >= win.since),
    'bookings', (select count(*) from subs where kind = 'booking'),
    'bookings_accepted', (select count(*) from subs where kind = 'booking' and status in ('accepted','completed')),
    'won', (select count(*) from public.business_leads l where l.profile_id = auth.uid() and l.stage = 'won' and (l.stage_changed_at at time zone 'UTC')::date >= win.since),
    'lost', (select count(*) from public.business_leads l where l.profile_id = auth.uid() and l.stage = 'lost' and (l.stage_changed_at at time zone 'UTC')::date >= win.since),
    'open_by_stage', (select jsonb_build_object(
        'new', count(*) filter (where l.stage = 'new'), 'contacted', count(*) filter (where l.stage = 'contacted'),
        'qualified', count(*) filter (where l.stage = 'qualified'))
      from public.business_leads l where l.profile_id = auth.uid()))
  from win
$function$;

revoke all on function private.lead_from_submission(public.action_submissions), private.on_submission_lead() from public, anon, authenticated;
revoke all on function public.set_business_lead_stage(uuid,text,text), public.add_business_lead_note(uuid,text,text), public.my_business_funnel(integer) from public, anon;
grant execute on function public.set_business_lead_stage(uuid,text,text), public.add_business_lead_note(uuid,text,text), public.my_business_funnel(integer) to authenticated;

-- Existing Business Mode inquiries become leads, oldest first, so nothing already received is lost.
do $backfill$
declare s public.action_submissions;
begin
  for s in select x.* from public.action_submissions x
    join public.profile_actions a on a.id = x.action_id join public.profile_modes m on m.id = a.mode_id
    where m.slug = 'business' and x.kind in ('collab','booking','submission','form') and x.status not in ('spam','pending_verification')
    order by x.created_at, x.id
  loop
    perform private.lead_from_submission(s);
  end loop;
end
$backfill$;

comment on table public.business_leads is 'Business Mode leads, one per inquiry or per open email. Owner-read under RLS (private.business_can); written only by triggers and owner functions.';
comment on table public.business_lead_activities is 'Append-only lead history: created, inquiry, stage, note. Written only by functions.';
