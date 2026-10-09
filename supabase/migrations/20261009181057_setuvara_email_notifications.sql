-- Setuvara notification outbox. Email content is resolved at delivery time;
-- recipient addresses and authentication tokens are never stored in this queue.
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  connection_emails boolean not null default true,
  connection_recaps boolean not null default true,
  passport_milestones boolean not null default true,
  passport_stamps boolean not null default true,
  product_updates boolean not null default false,
  lifecycle_emails boolean not null default true,
  updated_at timestamptz not null default pg_catalog.statement_timestamp()
);

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public, anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
create policy "users manage own notification preferences"
  on public.notification_preferences for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table private.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_key text not null unique,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('security','connection','reward','lifecycle','product')),
  template_key text not null check (template_key in ('welcome','new_connection','connection_recap','guest_claimed','passport_milestone','passport_stamp')),
  scheduled_at timestamptz not null default pg_catalog.statement_timestamp(),
  status text not null default 'pending' check (status in ('pending','sending','sent','suppressed','failed')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 5),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  failure_code text check (failure_code is null or failure_code in ('provider_error','recipient_unavailable','template_error')),
  created_at timestamptz not null default pg_catalog.statement_timestamp()
);
create index email_deliveries_pending_idx on private.email_deliveries(scheduled_at, created_at) where status in ('pending','sending');
create index email_deliveries_recipient_idx on private.email_deliveries(recipient_user_id, created_at desc);

create table private.notification_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references private.email_deliveries(id) on delete cascade,
  event_key text not null unique,
  source_id uuid,
  created_at timestamptz not null default pg_catalog.statement_timestamp()
);
create index notification_events_delivery_idx on private.notification_events(delivery_id, created_at);
revoke all on private.email_deliveries, private.notification_events from public, anon, authenticated;

create table private.email_unsubscribe_tokens (
  token_hash bytea primary key check (octet_length(token_hash) = 32),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('connection_emails','connection_recaps','passport_milestones','passport_stamps','lifecycle_emails','product_updates')),
  expires_at timestamptz not null default (pg_catalog.statement_timestamp() + interval '1 year'),
  used_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp()
);
revoke all on private.email_unsubscribe_tokens from public, anon, authenticated;

create or replace function public.record_email_unsubscribe_token(p_user_id uuid, p_category text, p_hash_hex text)
returns boolean language plpgsql security definer set search_path = ''
as $function$
begin
  if p_category not in ('connection_emails','connection_recaps','passport_milestones','passport_stamps','lifecycle_emails','product_updates')
     or p_hash_hex !~ '^[a-f0-9]{64}$' then return false; end if;
  insert into private.email_unsubscribe_tokens(token_hash,user_id,category)
  values(pg_catalog.decode(p_hash_hex,'hex'),p_user_id,p_category) on conflict(token_hash) do nothing;
  return true;
end;
$function$;
revoke all on function public.record_email_unsubscribe_token(uuid,text,text) from public, anon, authenticated;
grant execute on function public.record_email_unsubscribe_token(uuid,text,text) to service_role;

create or replace function public.apply_email_unsubscribe(p_token text)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare v_token private.email_unsubscribe_tokens%rowtype;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return false; end if;
  select * into v_token from private.email_unsubscribe_tokens
    where token_hash = extensions.digest(pg_catalog.convert_to(p_token,'UTF8'),'sha256')
      and used_at is null and expires_at > pg_catalog.statement_timestamp()
    for update;
  if not found then return false; end if;
  insert into public.notification_preferences(user_id)
  values(v_token.user_id) on conflict(user_id) do nothing;
  update public.notification_preferences set
    connection_emails = case when v_token.category='connection_emails' then false else connection_emails end,
    connection_recaps = case when v_token.category='connection_recaps' then false else connection_recaps end,
    passport_milestones = case when v_token.category='passport_milestones' then false else passport_milestones end,
    passport_stamps = case when v_token.category='passport_stamps' then false else passport_stamps end,
    lifecycle_emails = case when v_token.category='lifecycle_emails' then false else lifecycle_emails end,
    product_updates = case when v_token.category='product_updates' then false else product_updates end,
    updated_at = pg_catalog.statement_timestamp()
  where user_id = v_token.user_id;
  update private.email_unsubscribe_tokens set used_at = pg_catalog.statement_timestamp() where token_hash = v_token.token_hash;
  return true;
end;
$function$;
revoke all on function public.apply_email_unsubscribe(text) from public;
grant execute on function public.apply_email_unsubscribe(text) to anon, authenticated;

-- The Setuvara-only hosted scheduler is provisioned separately after deployment.
-- Local migrations must never schedule calls to a hosted project.
create table private.notification_dispatch_secret (
  name text primary key check (name = 'setuvara_notification_dispatch'),
  secret_hash bytea not null check (octet_length(secret_hash) = 32)
);
revoke all on private.notification_dispatch_secret from public, anon, authenticated;

create or replace function public.verify_notification_dispatch_secret(p_secret text)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select coalesce(
    p_secret ~ '^[a-f0-9]{64}$'
    and exists (select 1 from private.notification_dispatch_secret s
      where s.name='setuvara_notification_dispatch'
        and s.secret_hash=extensions.digest(pg_catalog.convert_to(p_secret,'UTF8'),'sha256')),
    false
  );
$function$;
revoke all on function public.verify_notification_dispatch_secret(text) from public;
grant execute on function public.verify_notification_dispatch_secret(text) to service_role;

create or replace function private.enqueue_notification(
  p_user_id uuid, p_category text, p_template_key text, p_delivery_key text,
  p_source_id uuid default null, p_scheduled_at timestamptz default pg_catalog.statement_timestamp()
) returns uuid
language plpgsql security definer set search_path = ''
as $function$
declare v_delivery_id uuid;
begin
  if p_user_id is null then return null; end if;
  if p_category not in ('security','connection','reward','lifecycle','product') then return null; end if;
  if p_template_key not in ('welcome','new_connection','connection_recap','guest_claimed','passport_milestone','passport_stamp') then return null; end if;
  if p_category = 'connection' and exists (
    select 1 from public.notification_preferences p where p.user_id = p_user_id and not p.connection_emails
  ) then return null; end if;
  if p_template_key = 'connection_recap' and exists (
    select 1 from public.notification_preferences p where p.user_id = p_user_id and not p.connection_recaps
  ) then return null; end if;
  if p_template_key = 'passport_milestone' and exists (
    select 1 from public.notification_preferences p where p.user_id = p_user_id and not p.passport_milestones
  ) then return null; end if;
  if p_template_key = 'passport_stamp' and exists (
    select 1 from public.notification_preferences p where p.user_id = p_user_id and not p.passport_stamps
  ) then return null; end if;
  if p_category = 'lifecycle' and exists (
    select 1 from public.notification_preferences p where p.user_id = p_user_id and not p.lifecycle_emails
  ) then return null; end if;

  insert into private.email_deliveries(delivery_key, recipient_user_id, category, template_key, scheduled_at)
  values (p_delivery_key, p_user_id, p_category, p_template_key, p_scheduled_at)
  on conflict(delivery_key) do update
    set scheduled_at = least(private.email_deliveries.scheduled_at, excluded.scheduled_at)
    where private.email_deliveries.status = 'pending'
  returning id into v_delivery_id;
  if v_delivery_id is null then
    select id into v_delivery_id from private.email_deliveries where delivery_key = p_delivery_key;
  end if;
  insert into private.notification_events(delivery_id, event_key, source_id)
  values(v_delivery_id, p_delivery_key || ':' || coalesce(p_source_id::text, 'none'), p_source_id)
  on conflict(event_key) do nothing;
  return v_delivery_id;
end;
$function$;
revoke all on function private.enqueue_notification(uuid,text,text,text,uuid,timestamptz) from public, anon, authenticated;

create or replace function private.on_auth_email_confirmed_enqueue_welcome()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform private.enqueue_notification(new.id, 'lifecycle', 'welcome', 'welcome:' || new.id::text);
  end if;
  return new;
end;
$function$;
revoke all on function private.on_auth_email_confirmed_enqueue_welcome() from public, anon, authenticated;
create trigger auth_email_confirmed_enqueue_welcome
after update of email_confirmed_at on auth.users
for each row execute function private.on_auth_email_confirmed_enqueue_welcome();

create or replace function private.on_encounter_enqueue_connection_email()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare v_connection record; v_recipient uuid; v_count integer; v_first timestamptz; v_key text; v_template text; v_due timestamptz;
begin
  select user_id, connected_user_id, guest_identity_id into v_connection
  from public.connections where id = new.connection_id;
  if not found then return new; end if;

  for v_recipient in
    select distinct candidate from unnest(array[v_connection.user_id, v_connection.connected_user_id]) as x(candidate)
    where candidate is not null
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('connection-notification:' || v_recipient::text, 0));
    select count(*)::integer, min(d.created_at) into v_count, v_first
    from private.notification_events e join private.email_deliveries d on d.id = e.delivery_id
    where d.recipient_user_id = v_recipient and d.category = 'connection'
      and d.created_at > new.created_at - interval '1 hour';
    if v_count < 3 then
      v_template := 'new_connection'; v_key := 'connection:' || new.id::text || ':' || v_recipient::text; v_due := new.created_at;
    else
      v_template := 'connection_recap';
      v_first := coalesce(v_first, new.created_at);
      v_key := 'connection-recap:' || v_recipient::text || ':' || extract(epoch from v_first)::bigint::text;
      v_due := v_first + interval '1 hour';
    end if;
    perform private.enqueue_notification(v_recipient, 'connection', v_template, v_key, new.id, v_due);
  end loop;
  return new;
end;
$function$;
revoke all on function private.on_encounter_enqueue_connection_email() from public, anon, authenticated;
create trigger encounter_enqueue_connection_email after insert on public.connection_encounters
for each row execute function private.on_encounter_enqueue_connection_email();

create or replace function private.on_guest_claimed_enqueue_email()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.uid() is not null and old.guest_identity_id is not null and old.user_id <> auth.uid() then
    perform private.enqueue_notification(
      old.user_id, 'connection', 'guest_claimed',
      'guest-claimed:' || old.user_id::text || ':' || old.guest_identity_id::text,
      old.guest_identity_id, pg_catalog.statement_timestamp()
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
revoke all on function private.on_guest_claimed_enqueue_email() from public, anon, authenticated;
create trigger guest_claim_conversion_enqueue_email
before update of connected_user_id, guest_identity_id or delete on public.connections
for each row execute function private.on_guest_claimed_enqueue_email();

create or replace function private.on_passport_milestone_enqueue_email()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  perform private.enqueue_notification(new.user_id, 'reward', 'passport_milestone',
    'passport-milestone:' || new.user_id::text || ':' || new.threshold::text, null, new.unlocked_at);
  return new;
end;
$function$;
revoke all on function private.on_passport_milestone_enqueue_email() from public, anon, authenticated;
create trigger passport_milestone_enqueue_email after insert on public.passport_milestones
for each row execute function private.on_passport_milestone_enqueue_email();

create or replace function private.on_passport_stamp_enqueue_email()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if new.stamp_type <> 'milestone' then
    perform private.enqueue_notification(new.user_id, 'reward', 'passport_stamp',
      'passport-stamp:' || new.id::text, new.id, new.earned_at);
  end if;
  return new;
end;
$function$;
revoke all on function private.on_passport_stamp_enqueue_email() from public, anon, authenticated;
create trigger passport_stamp_enqueue_email after insert on public.passport_stamps
for each row execute function private.on_passport_stamp_enqueue_email();

create or replace function public.claim_email_deliveries(p_limit integer default 25)
returns table(id uuid, delivery_key text, recipient_user_id uuid, category text, template_key text, attempt_count smallint)
language plpgsql security definer set search_path = ''
as $function$
begin
  if p_limit < 1 or p_limit > 50 then raise exception using errcode = '22023', message = 'Invalid batch size'; end if;
  return query
    with candidates as (
      select d.id from private.email_deliveries d
      where ((d.status = 'pending' and d.scheduled_at <= pg_catalog.statement_timestamp())
        or (d.status = 'sending' and d.locked_at < pg_catalog.statement_timestamp() - interval '10 minutes'))
        and d.attempt_count < 5
      order by d.scheduled_at, d.created_at
      for update skip locked limit p_limit
    ), claimed as (
      update private.email_deliveries d set status = 'sending', locked_at = pg_catalog.statement_timestamp(), attempt_count = d.attempt_count + 1
      from candidates c where d.id = c.id
      returning d.id, d.delivery_key, d.recipient_user_id, d.category, d.template_key, d.attempt_count
    ) select * from claimed;
end;
$function$;
revoke all on function public.claim_email_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_email_deliveries(integer) to service_role;

create or replace function public.get_email_delivery_context(p_delivery_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'delivery', jsonb_build_object('id', d.id, 'key', d.delivery_key, 'recipientUserId', d.recipient_user_id, 'category', d.category, 'template', d.template_key),
    'recipient', jsonb_build_object('email', u.email, 'confirmed', u.email_confirmed_at is not null),
    'profile', (select jsonb_build_object('username', p.username, 'displayName', p.display_name) from public.profiles p where p.id = d.recipient_user_id),
    'preferences', (select jsonb_build_object(
      'connectionEmails', coalesce(p.connection_emails,true), 'connectionRecaps', coalesce(p.connection_recaps,true),
      'passportMilestones', coalesce(p.passport_milestones,true), 'passportStamps', coalesce(p.passport_stamps,true),
      'lifecycleEmails', coalesce(p.lifecycle_emails,true)
    ) from (select 1) seed left join public.notification_preferences p on p.user_id=d.recipient_user_id),
    'events', coalesce((select jsonb_agg(jsonb_build_object('sourceId', e.source_id, 'eventKey', e.event_key, 'createdAt', e.created_at) order by e.created_at)
      from private.notification_events e where e.delivery_id = d.id), '[]'::jsonb),
    'encounters', coalesce((select jsonb_agg(jsonb_build_object(
      'sharedByUserId', enc.shared_by_user_id, 'createdByUserId', enc.created_by_user_id,
      'sharedDisplayName', enc.shared_display_name, 'sharedRole', enc.shared_role,
      'sharedCompany', enc.shared_company, 'eventName', enc.event_name,
      'city', enc.city, 'dateLabel', enc.date_label, 'createdAt', enc.created_at,
      'otherName', case when enc.shared_by_user_id = d.recipient_user_id then
        coalesce(creator.display_name, conn.guest_display_name, 'Someone') else
        coalesce(shared.display_name, 'Someone') end,
      'otherRole', case when enc.shared_by_user_id = d.recipient_user_id then enc.share_back_role else enc.shared_role end,
      'otherCompany', case when enc.shared_by_user_id = d.recipient_user_id then enc.share_back_company else enc.shared_company end
    ) order by enc.created_at desc)
      from private.notification_events ev
      join public.connection_encounters enc on enc.id = ev.source_id
      left join public.connections conn on conn.id = enc.connection_id
      left join public.profiles creator on creator.id = enc.created_by_user_id
      left join public.profiles shared on shared.id = enc.shared_by_user_id
      where ev.delivery_id = d.id), '[]'::jsonb),
    'claimedProfile', (select jsonb_build_object('displayName', p.display_name, 'username', p.username)
      from private.notification_events ev join public.guest_identities gi on gi.id = ev.source_id
      join public.profiles p on p.id = gi.claimed_user_id where ev.delivery_id = d.id limit 1),
    'milestone', (select jsonb_build_object('threshold', m.threshold, 'unlockedAt', m.unlocked_at)
      from private.email_deliveries md join private.notification_events ev on ev.delivery_id = md.id
      join public.passport_milestones m on m.user_id = md.recipient_user_id and md.template_key = 'passport_milestone'
        and md.delivery_key = 'passport-milestone:' || m.user_id::text || ':' || m.threshold::text
      where md.id = d.id limit 1),
    'stamps', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'subtitle', s.subtitle, 'type', s.stamp_type, 'earnedAt', s.earned_at) order by s.earned_at desc)
      from private.notification_events ev join public.passport_stamps s on s.id = ev.source_id where ev.delivery_id = d.id), '[]'::jsonb)
  ) into v_result
  from private.email_deliveries d join auth.users u on u.id = d.recipient_user_id
  where d.id = p_delivery_id;
  return v_result;
end;
$function$;
revoke all on function public.get_email_delivery_context(uuid) from public, anon, authenticated;
grant execute on function public.get_email_delivery_context(uuid) to service_role;

create or replace function public.complete_email_delivery(p_delivery_id uuid, p_provider_message_id text)
returns boolean language plpgsql security definer set search_path = ''
as $function$
begin
  update private.email_deliveries set status = 'sent', sent_at = pg_catalog.statement_timestamp(),
    provider_message_id = left(p_provider_message_id, 200), locked_at = null, failure_code = null
  where id = p_delivery_id and status = 'sending';
  return found;
end;
$function$;
revoke all on function public.complete_email_delivery(uuid,text) from public, anon, authenticated;
grant execute on function public.complete_email_delivery(uuid,text) to service_role;

create or replace function public.suppress_email_delivery(p_delivery_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $function$
begin
  update private.email_deliveries set status = 'suppressed', locked_at = null
  where id = p_delivery_id and status = 'sending';
  return found;
end;
$function$;
revoke all on function public.suppress_email_delivery(uuid) from public, anon, authenticated;
grant execute on function public.suppress_email_delivery(uuid) to service_role;

create or replace function public.fail_email_delivery(p_delivery_id uuid, p_failure_code text)
returns text language plpgsql security definer set search_path = ''
as $function$
declare v_status text;
begin
  update private.email_deliveries set
    status = case when attempt_count >= 5 then 'failed' else 'pending' end,
    scheduled_at = pg_catalog.statement_timestamp() + least(60, (2 ^ greatest(attempt_count - 1, 0))::integer) * interval '1 minute',
    locked_at = null,
    failure_code = case when p_failure_code in ('recipient_unavailable','template_error') then p_failure_code else 'provider_error' end
  where id = p_delivery_id and status = 'sending'
  returning status into v_status;
  return coalesce(v_status, 'missing');
end;
$function$;
revoke all on function public.fail_email_delivery(uuid,text) from public, anon, authenticated;
grant execute on function public.fail_email_delivery(uuid,text) to service_role;

comment on table public.notification_preferences is 'Owner-controlled Setuvara product email preferences. Account security messages are always enabled.';
comment on table private.email_deliveries is 'Durable, idempotent notification delivery outbox. Recipient addresses are resolved from confirmed auth.users only at send time.';
comment on table private.notification_events is 'Source event references associated with a single durable outbox delivery.';
