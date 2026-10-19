-- Admin Control Center (admin.setuvara.com).
--
-- Who is an admin lives in private.admin_members, never in user metadata or the client.
-- Every privileged write and every view of a single member's record is appended to
-- private.admin_audit_log, which nobody can update or delete.
-- All reads go through the server-only admin_* functions below: they are granted to
-- service_role only, return aggregates or bounded pages, and never expose tokens,
-- hashes, checkout URLs or raw analytics events.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'analyst')),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  revoked_at timestamptz
);

comment on table private.admin_members is
  'Admin Control Center access. owner/admin may act on support records; analyst sees aggregates only. Revoke by setting revoked_at.';

create table private.admin_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default pg_catalog.statement_timestamp(),
  actor_user_id uuid,
  actor_role text check (actor_role is null or actor_role in ('owner', 'admin', 'analyst', 'database')),
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$' and char_length(action) <= 64),
  target_type text check (target_type is null or target_type ~ '^[a-z_]{1,32}$'),
  target_id text check (target_id is null or char_length(target_id) <= 128),
  before jsonb check (before is null or pg_catalog.octet_length(before::text) <= 8192),
  after jsonb check (after is null or pg_catalog.octet_length(after::text) <= 8192),
  context jsonb not null default '{}'::jsonb check (pg_catalog.octet_length(context::text) <= 4096)
);

comment on table private.admin_audit_log is
  'Append-only record of admin actions: actor, target, before/after. Rows cannot be updated, deleted or truncated.';

create index admin_audit_log_occurred_idx on private.admin_audit_log (occurred_at desc);
create index admin_audit_log_target_idx on private.admin_audit_log (target_type, target_id, occurred_at desc);
create index admin_audit_log_actor_idx on private.admin_audit_log (actor_user_id, occurred_at desc);

alter table private.admin_members enable row level security;
alter table private.admin_audit_log enable row level security;
revoke all on private.admin_members from public, anon, authenticated, service_role;
revoke all on private.admin_audit_log from public, anon, authenticated, service_role;

create or replace function private.admin_audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception using errcode = '42501', message = 'admin_audit_log_is_append_only';
end;
$function$;

create trigger admin_audit_log_no_update
  before update or delete on private.admin_audit_log
  for each row execute function private.admin_audit_log_immutable();
create trigger admin_audit_log_no_truncate
  before truncate on private.admin_audit_log
  for each statement execute function private.admin_audit_log_immutable();

-- Admin membership changes are made in the SQL editor, so the database records them itself.
create or replace function private.admin_members_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_before jsonb;
  v_after jsonb;
  v_action text;
begin
  if tg_op = 'UPDATE' then
    new.updated_at := pg_catalog.statement_timestamp();
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    v_before := pg_catalog.jsonb_build_object('role', old.role, 'revoked_at', old.revoked_at, 'note', old.note);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_after := pg_catalog.jsonb_build_object('role', new.role, 'revoked_at', new.revoked_at, 'note', new.note);
  end if;
  v_action := case
    when tg_op = 'INSERT' then 'admin_member.granted'
    when tg_op = 'DELETE' then 'admin_member.removed'
    when old.revoked_at is null and new.revoked_at is not null then 'admin_member.revoked'
    when old.revoked_at is not null and new.revoked_at is null then 'admin_member.restored'
    else 'admin_member.changed'
  end;
  if tg_op = 'UPDATE' and v_before = v_after then
    return new;
  end if;

  insert into private.admin_audit_log (actor_user_id, actor_role, action, target_type, target_id, before, after, context)
  values (null, 'database', v_action, 'admin_member', coalesce(new.user_id, old.user_id)::text, v_before, v_after,
    pg_catalog.jsonb_build_object('db_role', current_user));

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

create trigger admin_members_audit_write
  before insert or update on private.admin_members
  for each row execute function private.admin_members_audit();
create trigger admin_members_audit_delete
  after delete on private.admin_members
  for each row execute function private.admin_members_audit();

-- Role of an active admin, or null. The app calls this on every admin page and API request.
create or replace function public.admin_access(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select members.role
  from private.admin_members as members
  join auth.users as users on users.id = members.user_id
  where members.user_id = p_user_id
    and members.revoked_at is null
    and users.email_confirmed_at is not null
    and (users.banned_until is null or users.banned_until < pg_catalog.statement_timestamp())
    and users.deleted_at is null;
$function$;

-- Internal helper: the actor's role, or an exception. Used by every admin write.
create or replace function private.admin_require_actor(p_actor uuid, p_roles text[])
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_role text;
begin
  v_role := public.admin_access(p_actor);
  if v_role is null or not (v_role = any (p_roles)) then
    raise exception using errcode = '42501', message = 'admin_forbidden';
  end if;
  return v_role;
end;
$function$;

-- Records an access event (viewing a member, opening a screenshot, checking a provider).
create or replace function public.admin_record_access(
  p_actor uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_context jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
begin
  if p_action not in ('member.viewed', 'feedback.screenshot_viewed', 'billing.provider_checked', 'session.started') then
    raise exception using errcode = '22023', message = 'admin_action_not_allowed';
  end if;
  v_role := private.admin_require_actor(p_actor, array['owner', 'admin', 'analyst']);
  insert into private.admin_audit_log (actor_user_id, actor_role, action, target_type, target_id, context)
  values (p_actor, v_role, p_action, p_target_type, p_target_id, coalesce(p_context, '{}'::jsonb));
end;
$function$;

-- Overview: accounts, activation, engagement and Modes for a date range (UTC days, at most 366).
create or replace function public.admin_overview(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_prev_start timestamptz;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_result jsonb;
begin
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from + 1 > 366 then
    raise exception using errcode = '22023', message = 'invalid_admin_range';
  end if;
  v_start := p_from::timestamp at time zone 'UTC';
  v_end := (p_to + 1)::timestamp at time zone 'UTC';
  v_prev_start := v_start - (v_end - v_start);

  select pg_catalog.jsonb_build_object(
    'accounts', (
      select pg_catalog.jsonb_build_object(
        'total', count(*),
        'confirmed', count(*) filter (where users.email_confirmed_at is not null),
        'new_in_range', count(*) filter (where users.created_at >= v_start and users.created_at < v_end),
        'new_in_previous', count(*) filter (where users.created_at >= v_prev_start and users.created_at < v_start),
        'signed_in_7d', count(*) filter (where users.last_sign_in_at >= v_now - interval '7 days'),
        'signed_in_30d', count(*) filter (where users.last_sign_in_at >= v_now - interval '30 days')
      )
      from auth.users as users
      where users.deleted_at is null and coalesce(users.is_anonymous, false) = false
    ),
    'profiles', (
      select pg_catalog.jsonb_build_object(
        'total', count(*),
        'published', count(*) filter (where profiles.is_published),
        'with_bio', count(*) filter (where pg_catalog.length(pg_catalog.btrim(coalesce(profiles.bio, ''))) > 0)
      )
      from public.profiles
    ),
    -- Activation of accounts created in the range: each step is a real record, not an estimate.
    'activation', (
      select pg_catalog.jsonb_build_object(
        'cohort', count(*),
        'profile_created', count(profiles.id),
        'published', count(*) filter (where profiles.is_published),
        'identity_completed', count(*) filter (where exists (
          select 1 from private.product_analytics_events as events
          where events.owner_profile_id = users.id and events.event_name = 'identity_completed')),
        'first_share', count(*) filter (where exists (
          select 1 from private.product_analytics_events as events
          where events.owner_profile_id = users.id and events.event_name = 'first_share')),
        'first_connection', count(*) filter (where exists (
          select 1 from public.connections
          where connections.user_id = users.id or connections.connected_user_id = users.id))
      )
      from auth.users as users
      left join public.profiles on profiles.id = users.id
      where users.deleted_at is null and coalesce(users.is_anonymous, false) = false
        and users.created_at >= v_start and users.created_at < v_end
    ),
    'engagement', (
      select pg_catalog.jsonb_build_object(
        'profile_views', count(*) filter (where events.event_name = 'profile_viewed'),
        'profile_shares', count(*) filter (where events.event_name = 'profile_shared'),
        'qr_scans', count(*) filter (where events.event_name in ('quick_qr_scanned', 'tap_scanned')),
        'connections', count(*) filter (where events.event_name in ('connection_created', 'guest_connection_created')),
        'members_viewed', count(distinct events.owner_profile_id) filter (where events.event_name = 'profile_viewed'),
        'members_shared', count(distinct events.owner_profile_id) filter (where events.event_name = 'profile_shared')
      )
      from private.product_analytics_events as events
      where events.occurred_at >= v_start and events.occurred_at < v_end
    ),
    'engagement_previous', (
      select pg_catalog.jsonb_build_object(
        'profile_views', count(*) filter (where events.event_name = 'profile_viewed'),
        'profile_shares', count(*) filter (where events.event_name = 'profile_shared'),
        'connections', count(*) filter (where events.event_name in ('connection_created', 'guest_connection_created'))
      )
      from private.product_analytics_events as events
      where events.occurred_at >= v_prev_start and events.occurred_at < v_start
    ),
    'connections', (
      select pg_catalog.jsonb_build_object(
        'total', (select count(*) from public.connections),
        'with_members', (select count(*) from public.connections where connected_user_id is not null),
        'with_guests', (select count(*) from public.connections where guest_identity_id is not null),
        'encounters_in_range', (select count(*) from public.connection_encounters
          where created_at >= v_start and created_at < v_end)
      )
    ),
    'daily', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'date', days.day::date::text,
        'signups', coalesce(signups.count, 0),
        'views', coalesce(activity.views, 0),
        'shares', coalesce(activity.shares, 0),
        'connections', coalesce(activity.connections, 0)
      ) order by days.day), '[]'::jsonb)
      from pg_catalog.generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as days(day)
      left join (
        select (users.created_at at time zone 'UTC')::date as day, count(*) as count
        from auth.users as users
        where users.created_at >= v_start and users.created_at < v_end
          and users.deleted_at is null and coalesce(users.is_anonymous, false) = false
        group by 1
      ) as signups on signups.day = days.day::date
      left join (
        select (events.occurred_at at time zone 'UTC')::date as day,
          count(*) filter (where events.event_name = 'profile_viewed') as views,
          count(*) filter (where events.event_name = 'profile_shared') as shares,
          count(*) filter (where events.event_name in ('connection_created', 'guest_connection_created')) as connections
        from private.product_analytics_events as events
        where events.occurred_at >= v_start and events.occurred_at < v_end
        group by 1
      ) as activity on activity.day = days.day::date
    ),
    -- Every profile has all Modes by default, so usage is measured by what members do with each one.
    'modes', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'slug', modes.slug,
        'enabled', modes.enabled,
        'with_photo', modes.with_photo,
        'with_content', modes.with_content,
        'views', coalesce(activity.views, 0),
        'shares', coalesce(activity.shares, 0),
        'encounters', coalesce(encounters.count, 0)
      ) order by modes.slug), '[]'::jsonb)
      from (
        select profile_modes.slug,
          count(*) filter (where profile_modes.is_enabled) as enabled,
          count(*) filter (where profile_modes.image_path is not null) as with_photo,
          count(*) filter (where exists (
              select 1 from public.profile_blocks where profile_blocks.mode_id = profile_modes.id)
            or exists (
              select 1 from public.profile_links where profile_links.mode_id = profile_modes.id)) as with_content
        from public.profile_modes
        group by profile_modes.slug
      ) as modes
      left join (
        select events.mode_slug,
          count(*) filter (where events.event_name = 'profile_viewed') as views,
          count(*) filter (where events.event_name = 'profile_shared') as shares
        from private.product_analytics_events as events
        where events.occurred_at >= v_start and events.occurred_at < v_end and events.mode_slug is not null
        group by events.mode_slug
      ) as activity on activity.mode_slug = modes.slug
      left join (
        select connection_encounters.shared_mode_slug as slug, count(*) as count
        from public.connection_encounters
        where connection_encounters.created_at >= v_start and connection_encounters.created_at < v_end
        group by 1
      ) as encounters on encounters.slug = modes.slug
    ),
    'sources', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('source', grouped.source, 'count', grouped.count)
        order by grouped.count desc, grouped.source), '[]'::jsonb)
      from (
        select coalesce(events.source, 'unknown') as source, count(*) as count
        from private.product_analytics_events as events
        where events.occurred_at >= v_start and events.occurred_at < v_end and events.event_name = 'profile_viewed'
        group by 1
      ) as grouped
    ),
    'devices', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('device', grouped.device_class, 'count', grouped.count)
        order by grouped.count desc, grouped.device_class), '[]'::jsonb)
      from (
        select events.device_class, count(*) as count
        from private.product_analytics_events as events
        where events.occurred_at >= v_start and events.occurred_at < v_end and events.event_name = 'profile_viewed'
        group by 1
      ) as grouped
    )
  ) into v_result;

  return v_result;
end;
$function$;

-- Member directory page. p_include / p_exclude narrow to precomputed sets: the app resolves who is
-- on a paid plan with its own billing rules and passes those ids, so plan logic lives in one place.
create or replace function public.admin_list_members(
  p_query text,
  p_include uuid[],
  p_exclude uuid[],
  p_unpublished_only boolean,
  p_limit integer,
  p_offset integer
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_pattern text;
  v_total bigint;
  v_rows jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 or p_offset > 100000 then
    raise exception using errcode = '22023', message = 'invalid_admin_page';
  end if;
  if p_query is not null and char_length(p_query) > 120 then
    raise exception using errcode = '22023', message = 'invalid_admin_query';
  end if;
  v_pattern := case
    when p_query is null or pg_catalog.btrim(p_query) = '' then null
    else '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.lower(pg_catalog.btrim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  end;

  with matched as (
    select users.id, users.email, users.created_at, users.last_sign_in_at, users.email_confirmed_at,
      users.banned_until, profiles.username, profiles.display_name, profiles.is_published
    from auth.users as users
    left join public.profiles on profiles.id = users.id
    where users.deleted_at is null and coalesce(users.is_anonymous, false) = false
      and (p_include is null or users.id = any (p_include))
      and (p_exclude is null or not (users.id = any (p_exclude)))
      and (not coalesce(p_unpublished_only, false) or coalesce(profiles.is_published, false) = false)
      and (v_pattern is null
        or pg_catalog.lower(coalesce(users.email, '')) like v_pattern
        or pg_catalog.lower(coalesce(profiles.username, '')) like v_pattern
        or pg_catalog.lower(coalesce(profiles.display_name, '')) like v_pattern
        or users.id::text = pg_catalog.btrim(p_query))
  ), page as (
    select * from matched order by matched.created_at desc, matched.id limit p_limit offset p_offset
  )
  select (select count(*) from matched),
    coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', page.id,
      'email', page.email,
      'username', page.username,
      'display_name', page.display_name,
      'is_published', page.is_published,
      'created_at', page.created_at,
      'last_sign_in_at', page.last_sign_in_at,
      'email_confirmed', page.email_confirmed_at is not null,
      'banned', page.banned_until is not null and page.banned_until > pg_catalog.statement_timestamp(),
      'connections', (select count(*) from public.connections
        where connections.user_id = page.id or connections.connected_user_id = page.id),
      'views_30d', (select count(*) from private.product_analytics_events as events
        where events.owner_profile_id = page.id and events.event_name = 'profile_viewed'
          and events.occurred_at >= pg_catalog.statement_timestamp() - interval '30 days'),
      'subscriptions', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'plan_code', subs.plan_code,
          'billing_interval', subs.billing_interval,
          'provider_status', subs.provider_status,
          'current_period_end', subs.current_period_end,
          'cancel_at_next_billing_date', subs.cancel_at_next_billing_date,
          'past_due_ends_at', subs.past_due_ends_at)), '[]'::jsonb)
        from public.billing_subscriptions as subs where subs.user_id = page.id)
    ) order by page.created_at desc, page.id), '[]'::jsonb)
  into v_total, v_rows
  from page;

  return pg_catalog.jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$function$;

-- One member's full record for support. The app logs member.viewed before calling this.
create or replace function public.admin_member_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    return null;
  end if;

  select pg_catalog.jsonb_build_object(
    'account', (
      select pg_catalog.jsonb_build_object(
        'id', users.id,
        'email', users.email,
        'created_at', users.created_at,
        'last_sign_in_at', users.last_sign_in_at,
        'email_confirmed_at', users.email_confirmed_at,
        'banned_until', users.banned_until,
        'banned', users.banned_until is not null and users.banned_until > pg_catalog.statement_timestamp(),
        'deleted_at', users.deleted_at,
        'providers', coalesce(users.raw_app_meta_data -> 'providers', '[]'::jsonb),
        'mfa_factors', (select count(*) from auth.mfa_factors as factors
          where factors.user_id = users.id and factors.status = 'verified')
      )
      from auth.users as users where users.id = p_user_id
    ),
    'profile', (
      select pg_catalog.jsonb_build_object(
        'username', profiles.username,
        'display_name', profiles.display_name,
        'bio', profiles.bio,
        'is_published', profiles.is_published,
        'created_at', profiles.created_at,
        'updated_at', profiles.updated_at
      )
      from public.profiles where profiles.id = p_user_id
    ),
    'modes', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'slug', modes.slug,
        'label', modes.label,
        'is_enabled', modes.is_enabled,
        'connect_policy', modes.connect_policy,
        'has_photo', modes.image_path is not null,
        'theme', modes.appearance ->> 'theme',
        'blocks', (select count(*) from public.profile_blocks where profile_blocks.mode_id = modes.id),
        'links', (select count(*) from public.profile_links where profile_links.mode_id = modes.id),
        'updated_at', modes.updated_at
      ) order by modes.sort_order, modes.slug), '[]'::jsonb)
      from public.profile_modes as modes where modes.profile_id = p_user_id
    ),
    'counts', pg_catalog.jsonb_build_object(
      'links', (select count(*) from public.profile_links where profile_links.profile_id = p_user_id),
      'connections', (select count(*) from public.connections
        where connections.user_id = p_user_id or connections.connected_user_id = p_user_id),
      'guest_connections', (select count(*) from public.connections
        where connections.user_id = p_user_id and connections.guest_identity_id is not null),
      'encounters', (select count(*) from public.connection_encounters
        where connection_encounters.shared_by_user_id = p_user_id or connection_encounters.created_by_user_id = p_user_id),
      'passport_stamps', (select count(*) from public.passport_stamps where passport_stamps.user_id = p_user_id),
      'tap_devices', (select count(*) from public.tap_devices where tap_devices.owner_profile_id = p_user_id)
    ),
    'activity_30d', (
      select pg_catalog.jsonb_build_object(
        'profile_views', count(*) filter (where events.event_name = 'profile_viewed'),
        'profile_shares', count(*) filter (where events.event_name = 'profile_shared'),
        'qr_scans', count(*) filter (where events.event_name in ('quick_qr_scanned', 'tap_scanned')),
        'connections', count(*) filter (where events.event_name in ('connection_created', 'guest_connection_created')),
        'last_event_at', max(events.occurred_at)
      )
      from private.product_analytics_events as events
      where events.owner_profile_id = p_user_id
        and events.occurred_at >= pg_catalog.statement_timestamp() - interval '30 days'
    ),
    'subscriptions', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'dodo_subscription_id', subs.dodo_subscription_id,
        'dodo_customer_id', subs.dodo_customer_id,
        'plan_code', subs.plan_code,
        'billing_interval', subs.billing_interval,
        'provider_status', subs.provider_status,
        'current_period_start', subs.current_period_start,
        'current_period_end', subs.current_period_end,
        'cancel_at_next_billing_date', subs.cancel_at_next_billing_date,
        'cancelled_at', subs.cancelled_at,
        'past_due_ends_at', subs.past_due_ends_at,
        'last_provider_event_at', subs.last_provider_event_at,
        'synchronized_at', subs.synchronized_at,
        'created_at', subs.created_at
      ) order by subs.created_at desc), '[]'::jsonb)
      from public.billing_subscriptions as subs where subs.user_id = p_user_id
    ),
    'checkouts', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'plan_code', attempts.plan_code,
        'billing_interval', attempts.billing_interval,
        'status', attempts.status,
        'created_at', attempts.created_at
      ) order by attempts.created_at desc), '[]'::jsonb)
      from (select * from public.billing_checkout_attempts
        where billing_checkout_attempts.user_id = p_user_id order by created_at desc limit 5) as attempts
    ),
    'feedback', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', feedback.id,
        'kind', feedback.kind,
        'status', feedback.status,
        'message', pg_catalog.left(feedback.message, 240),
        'created_at', feedback.created_at
      ) order by feedback.created_at desc), '[]'::jsonb)
      from (select * from public.product_feedback
        where product_feedback.user_id = p_user_id order by created_at desc limit 5) as feedback
    ),
    'emails', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'template_key', deliveries.template_key,
        'category', deliveries.category,
        'status', deliveries.status,
        'failure_code', deliveries.failure_code,
        'sent_at', deliveries.sent_at,
        'created_at', deliveries.created_at
      ) order by deliveries.created_at desc), '[]'::jsonb)
      from (select * from private.email_deliveries
        where email_deliveries.recipient_user_id = p_user_id order by created_at desc limit 8) as deliveries
    ),
    'admin_role', (select members.role from private.admin_members as members
      where members.user_id = p_user_id and members.revoked_at is null)
  ) into v_result;

  return v_result;
end;
$function$;

-- Billing: every subscription row (plans are resolved by the app's own rules), plus checkout and webhook health.
create or replace function public.admin_billing_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'subscriptions', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'user_id', subs.user_id,
        'username', profiles.username,
        'display_name', profiles.display_name,
        'dodo_subscription_id', subs.dodo_subscription_id,
        'plan_code', subs.plan_code,
        'billing_interval', subs.billing_interval,
        'provider_status', subs.provider_status,
        'current_period_end', subs.current_period_end,
        'cancel_at_next_billing_date', subs.cancel_at_next_billing_date,
        'past_due_ends_at', subs.past_due_ends_at,
        'last_provider_event_at', subs.last_provider_event_at,
        'created_at', subs.created_at
      ) order by subs.created_at desc), '[]'::jsonb)
      from public.billing_subscriptions as subs
      left join public.profiles on profiles.id = subs.user_id
    ),
    'checkouts_30d', (
      select coalesce(pg_catalog.jsonb_object_agg(grouped.status, grouped.count), '{}'::jsonb)
      from (
        select attempts.status, count(*) as count from public.billing_checkout_attempts as attempts
        where attempts.created_at >= pg_catalog.statement_timestamp() - interval '30 days'
        group by attempts.status
      ) as grouped
    ),
    'webhooks_30d', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'event_type', grouped.event_type, 'status', grouped.processing_status, 'count', grouped.count, 'last_at', grouped.last_at
      ) order by grouped.last_at desc), '[]'::jsonb)
      from (
        select events.event_type, events.processing_status, count(*) as count, max(events.received_at) as last_at
        from public.billing_webhook_events as events
        where events.received_at >= pg_catalog.statement_timestamp() - interval '30 days'
        group by 1, 2
      ) as grouped
    ),
    'customers', (select count(*) from public.billing_customers)
  );
$function$;

-- Platform health from records the platform already keeps.
create or replace function public.admin_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'checked_at', pg_catalog.statement_timestamp(),
    'webhooks', (
      select pg_catalog.jsonb_build_object(
        'last_received_at', max(events.received_at),
        'received_7d', count(*) filter (where events.received_at >= pg_catalog.statement_timestamp() - interval '7 days'),
        'failed_7d', count(*) filter (where events.processing_status = 'failed'
          and events.received_at >= pg_catalog.statement_timestamp() - interval '7 days'),
        'stuck', count(*) filter (where events.processing_status = 'processing'
          and coalesce(events.processing_started_at, events.received_at) < pg_catalog.statement_timestamp() - interval '15 minutes')
      )
      from public.billing_webhook_events as events
    ),
    'webhook_failures', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'event_type', failures.event_type, 'error', failures.safe_error_code,
        'attempts', failures.processing_attempts, 'received_at', failures.received_at
      ) order by failures.received_at desc), '[]'::jsonb)
      from (select * from public.billing_webhook_events
        where processing_status = 'failed' order by received_at desc limit 10) as failures
    ),
    'emails', (
      select pg_catalog.jsonb_build_object(
        'last_sent_at', max(deliveries.sent_at),
        'sent_7d', count(*) filter (where deliveries.status = 'sent'
          and deliveries.sent_at >= pg_catalog.statement_timestamp() - interval '7 days'),
        'failed_7d', count(*) filter (where deliveries.status = 'failed'
          and deliveries.created_at >= pg_catalog.statement_timestamp() - interval '7 days'),
        'suppressed_7d', count(*) filter (where deliveries.status = 'suppressed'
          and deliveries.created_at >= pg_catalog.statement_timestamp() - interval '7 days'),
        'overdue', count(*) filter (where (deliveries.status = 'pending'
            and deliveries.scheduled_at < pg_catalog.statement_timestamp() - interval '15 minutes')
          or (deliveries.status = 'sending' and deliveries.locked_at < pg_catalog.statement_timestamp() - interval '15 minutes'))
      )
      from private.email_deliveries as deliveries
    ),
    'email_failures', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'template_key', failures.template_key, 'error', failures.failure_code,
        'attempts', failures.attempt_count, 'created_at', failures.created_at
      ) order by failures.created_at desc), '[]'::jsonb)
      from (select * from private.email_deliveries
        where status = 'failed' order by created_at desc limit 10) as failures
    ),
    'checkouts', (
      select pg_catalog.jsonb_build_object(
        'open', count(*) filter (where attempts.status in ('creating', 'open') and attempts.expires_at > pg_catalog.statement_timestamp()),
        'failed_7d', count(*) filter (where attempts.status = 'failed'
          and attempts.created_at >= pg_catalog.statement_timestamp() - interval '7 days'),
        'stale_open', count(*) filter (where attempts.status in ('creating', 'open') and attempts.expires_at <= pg_catalog.statement_timestamp())
      )
      from public.billing_checkout_attempts as attempts
    ),
    'analytics', (
      select pg_catalog.jsonb_build_object(
        'last_event_at', max(events.occurred_at),
        'events_24h', count(*) filter (where events.occurred_at >= pg_catalog.statement_timestamp() - interval '24 hours')
      )
      from private.product_analytics_events as events
      where events.occurred_at >= pg_catalog.statement_timestamp() - interval '30 days'
    ),
    'feedback', (
      select pg_catalog.jsonb_build_object(
        'open', count(*) filter (where feedback.status = 'open'),
        'reviewing', count(*) filter (where feedback.status = 'reviewing'),
        'oldest_open_at', min(feedback.created_at) filter (where feedback.status = 'open')
      )
      from public.product_feedback as feedback
    ),
    'accounts', (
      select pg_catalog.jsonb_build_object(
        'unconfirmed_over_24h', count(*) filter (where users.email_confirmed_at is null
          and users.created_at < pg_catalog.statement_timestamp() - interval '24 hours'),
        'without_profile', count(*) filter (where not exists (select 1 from public.profiles where profiles.id = users.id))
      )
      from auth.users as users
      where users.deleted_at is null and coalesce(users.is_anonymous, false) = false
    )
  );
$function$;

-- Support inbox.
create or replace function public.admin_list_feedback(p_status text, p_limit integer, p_offset integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_total bigint;
  v_rows jsonb;
begin
  if p_status is not null and p_status not in ('open', 'reviewing', 'done') then
    raise exception using errcode = '22023', message = 'invalid_feedback_status';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 or p_offset > 100000 then
    raise exception using errcode = '22023', message = 'invalid_admin_page';
  end if;

  select count(*) into v_total from public.product_feedback
  where p_status is null or product_feedback.status = p_status;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', page.id,
    'user_id', page.user_id,
    'username', page.username,
    'display_name', page.display_name,
    'email', page.email,
    'kind', page.kind,
    'message', page.message,
    'has_screenshot', page.screenshot_path is not null,
    'route', page.route,
    'mode', page.mode,
    'plan', page.plan,
    'viewport', page.viewport,
    'locale', page.locale,
    'user_agent', page.user_agent,
    'status', page.status,
    'created_at', page.created_at,
    'updated_at', page.updated_at
  ) order by page.created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select feedback.*, profiles.username, profiles.display_name, users.email
    from public.product_feedback as feedback
    left join public.profiles on profiles.id = feedback.user_id
    left join auth.users as users on users.id = feedback.user_id
    where p_status is null or feedback.status = p_status
    order by feedback.created_at desc
    limit p_limit offset p_offset
  ) as page;

  return pg_catalog.jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$function$;

-- Screenshot path of one feedback note, for a short-lived signed URL. Logged by the caller.
create or replace function public.admin_feedback_screenshot_path(p_feedback_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select feedback.screenshot_path from public.product_feedback as feedback where feedback.id = p_feedback_id;
$function$;

-- The one privileged write: move a feedback note through open → reviewing → done, audited in the same transaction.
create or replace function public.admin_set_feedback_status(
  p_actor uuid,
  p_feedback_id uuid,
  p_status text,
  p_context jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_before text;
begin
  if p_status not in ('open', 'reviewing', 'done') then
    raise exception using errcode = '22023', message = 'invalid_feedback_status';
  end if;
  v_role := private.admin_require_actor(p_actor, array['owner', 'admin']);

  select feedback.status into v_before
  from public.product_feedback as feedback
  where feedback.id = p_feedback_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'feedback_not_found';
  end if;
  if v_before = p_status then
    return pg_catalog.jsonb_build_object('id', p_feedback_id, 'status', p_status, 'changed', false);
  end if;

  update public.product_feedback
  set status = p_status, updated_at = pg_catalog.statement_timestamp()
  where id = p_feedback_id;

  insert into private.admin_audit_log (actor_user_id, actor_role, action, target_type, target_id, before, after, context)
  values (p_actor, v_role, 'feedback.status_changed', 'feedback', p_feedback_id::text,
    pg_catalog.jsonb_build_object('status', v_before), pg_catalog.jsonb_build_object('status', p_status),
    coalesce(p_context, '{}'::jsonb));

  return pg_catalog.jsonb_build_object('id', p_feedback_id, 'status', p_status, 'changed', true);
end;
$function$;

create or replace function public.admin_list_audit(p_target_type text, p_target_id text, p_limit integer, p_offset integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_total bigint;
  v_rows jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 or p_offset > 100000 then
    raise exception using errcode = '22023', message = 'invalid_admin_page';
  end if;

  select count(*) into v_total from private.admin_audit_log as log
  where (p_target_type is null or log.target_type = p_target_type)
    and (p_target_id is null or log.target_id = p_target_id);

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', page.id,
    'occurred_at', page.occurred_at,
    'actor_user_id', page.actor_user_id,
    'actor_email', page.email,
    'actor_role', page.actor_role,
    'action', page.action,
    'target_type', page.target_type,
    'target_id', page.target_id,
    'before', page.before,
    'after', page.after,
    'context', page.context
  ) order by page.id desc), '[]'::jsonb)
  into v_rows
  from (
    select log.*, users.email
    from private.admin_audit_log as log
    left join auth.users as users on users.id = log.actor_user_id
    where (p_target_type is null or log.target_type = p_target_type)
      and (p_target_id is null or log.target_id = p_target_id)
    order by log.id desc
    limit p_limit offset p_offset
  ) as page;

  return pg_catalog.jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$function$;

create or replace function public.admin_list_admins()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'user_id', members.user_id,
    'email', users.email,
    'username', profiles.username,
    'role', members.role,
    'note', members.note,
    'created_at', members.created_at,
    'revoked_at', members.revoked_at,
    'last_sign_in_at', users.last_sign_in_at,
    'mfa_factors', (select count(*) from auth.mfa_factors as factors
      where factors.user_id = members.user_id and factors.status = 'verified')
  ) order by members.revoked_at nulls first, members.created_at), '[]'::jsonb)
  from private.admin_members as members
  join auth.users as users on users.id = members.user_id
  left join public.profiles on profiles.id = members.user_id;
$function$;

do $grants$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.admin_access(uuid)',
    'public.admin_record_access(uuid, text, text, text, jsonb)',
    'public.admin_overview(date, date)',
    'public.admin_list_members(text, uuid[], uuid[], boolean, integer, integer)',
    'public.admin_member_detail(uuid)',
    'public.admin_billing_overview()',
    'public.admin_health()',
    'public.admin_list_feedback(text, integer, integer)',
    'public.admin_feedback_screenshot_path(uuid)',
    'public.admin_set_feedback_status(uuid, uuid, text, jsonb)',
    'public.admin_list_audit(text, text, integer, integer)',
    'public.admin_list_admins()'
  ] loop
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute pg_catalog.format('grant execute on function %s to service_role', v_signature);
  end loop;
end;
$grants$;

revoke all on function private.admin_require_actor(uuid, text[]) from public, anon, authenticated, service_role;
revoke all on function private.admin_audit_log_immutable() from public, anon, authenticated, service_role;
revoke all on function private.admin_members_audit() from public, anon, authenticated, service_role;
