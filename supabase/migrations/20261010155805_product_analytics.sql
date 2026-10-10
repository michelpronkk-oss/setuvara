-- Product analytics stores only first-party event facts needed for aggregate
-- reports. It deliberately excludes visitor IDs, IP addresses, raw user agents,
-- emails, URLs, and Tap tokens.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.product_analytics_events (
  id bigint generated always as identity primary key,
  idempotency_key uuid not null unique,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  event_name text not null check (event_name in (
    'profile_viewed',
    'quick_qr_scanned',
    'tap_scanned',
    'profile_shared',
    'first_share',
    'repeat_share',
    'connection_created',
    'guest_connection_created',
    'guest_claimed',
    'identity_created',
    'identity_completed'
  )),
  occurred_at timestamptz not null default pg_catalog.statement_timestamp(),
  source text check (source is null or source in (
    'direct', 'profile', 'share', 'qr', 'quick_qr', 'tap', 'link',
    'native_share', 'other'
  )),
  mode_slug text check (mode_slug is null or mode_slug in ('personal', 'event', 'business')),
  device_class text not null default 'unknown'
    check (device_class in ('mobile', 'tablet', 'desktop', 'unknown'))
);

create index product_analytics_owner_occurred_idx
  on private.product_analytics_events (owner_profile_id, occurred_at desc);
create index product_analytics_event_occurred_idx
  on private.product_analytics_events (event_name, occurred_at desc);
create index product_analytics_owner_dimensions_idx
  on private.product_analytics_events (owner_profile_id, source, mode_slug, occurred_at desc);

alter table private.product_analytics_events enable row level security;
revoke all on table private.product_analytics_events from public, anon, authenticated, service_role;

comment on table private.product_analytics_events is
  'Private first-party analytics facts. Contains no visitor identifiers, contact details, IP addresses, raw user agents, URLs, or device tokens.';
comment on column private.product_analytics_events.device_class is
  'Coarse server-classified device category only; raw User-Agent values are never stored.';

create or replace function private.product_analytics_uuid(p_material text)
returns uuid
language sql
immutable
set search_path = ''
as $function$
  select (
    pg_catalog.substr(pg_catalog.md5(coalesce(p_material, '')), 1, 8) || '-' ||
    pg_catalog.substr(pg_catalog.md5(coalesce(p_material, '')), 9, 4) || '-' ||
    pg_catalog.substr(pg_catalog.md5(coalesce(p_material, '')), 13, 4) || '-' ||
    pg_catalog.substr(pg_catalog.md5(coalesce(p_material, '')), 17, 4) || '-' ||
    pg_catalog.substr(pg_catalog.md5(coalesce(p_material, '')), 21, 12)
  )::uuid
$function$;

revoke all on function private.product_analytics_uuid(text) from public, anon, authenticated, service_role;

create or replace function private.record_product_analytics_fact(
  p_idempotency_key uuid,
  p_owner_profile_id uuid,
  p_event_name text,
  p_occurred_at timestamptz,
  p_source text default null,
  p_mode_slug text default null,
  p_device_class text default 'unknown'
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_inserted integer;
  v_share_kind text;
begin
  if p_idempotency_key is null or p_owner_profile_id is null
    or p_event_name not in (
      'profile_viewed', 'quick_qr_scanned', 'tap_scanned', 'profile_shared',
      'first_share', 'repeat_share', 'connection_created',
      'guest_connection_created', 'guest_claimed', 'identity_created',
      'identity_completed'
    )
    or (p_source is not null and p_source not in (
      'direct', 'profile', 'share', 'qr', 'quick_qr', 'tap', 'link',
      'native_share', 'other'
    ))
    or (p_mode_slug is not null and p_mode_slug not in ('personal', 'event', 'business'))
    or p_device_class not in ('mobile', 'tablet', 'desktop', 'unknown') then
    raise exception using errcode = '22023', message = 'invalid_analytics_event';
  end if;

  if p_event_name = 'profile_shared' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_owner_profile_id::text, 731041)
    );
  end if;

  insert into private.product_analytics_events (
    idempotency_key, owner_profile_id, event_name, occurred_at,
    source, mode_slug, device_class
  ) values (
    p_idempotency_key, p_owner_profile_id, p_event_name,
    coalesce(p_occurred_at, pg_catalog.statement_timestamp()),
    p_source, p_mode_slug, p_device_class
  ) on conflict (idempotency_key) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;

  if p_event_name = 'profile_shared' then
    select case when exists (
      select 1
      from private.product_analytics_events as prior_share
      where prior_share.owner_profile_id = p_owner_profile_id
        and prior_share.event_name = 'profile_shared'
        and prior_share.idempotency_key <> p_idempotency_key
    ) then 'repeat_share' else 'first_share' end
    into v_share_kind;

    insert into private.product_analytics_events (
      idempotency_key, owner_profile_id, event_name, occurred_at,
      source, mode_slug, device_class
    ) values (
      private.product_analytics_uuid('share-milestone:' || p_idempotency_key::text),
      p_owner_profile_id, v_share_kind,
      coalesce(p_occurred_at, pg_catalog.statement_timestamp()),
      p_source, p_mode_slug, p_device_class
    ) on conflict (idempotency_key) do nothing;
  end if;

  return true;
end;
$function$;

revoke all on function private.record_product_analytics_fact(uuid, uuid, text, timestamptz, text, text, text)
  from public, anon, authenticated, service_role;

create or replace function public.record_product_analytics_event(
  p_event_name text,
  p_idempotency_key uuid,
  p_owner_profile_id uuid,
  p_mode_slug text,
  p_source text,
  p_device_class text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_event_name not in ('profile_viewed', 'quick_qr_scanned', 'profile_shared')
    or p_idempotency_key is null
    or p_owner_profile_id is null
    or p_device_class not in ('mobile', 'tablet', 'desktop', 'unknown') then
    raise exception using errcode = '22023', message = 'invalid_analytics_event';
  end if;

  if p_event_name = 'quick_qr_scanned' and p_source <> 'quick_qr' then
    raise exception using errcode = '22023', message = 'invalid_analytics_source';
  end if;

  return private.record_product_analytics_fact(
    p_idempotency_key, p_owner_profile_id, p_event_name,
    pg_catalog.statement_timestamp(), p_source, p_mode_slug, p_device_class
  );
end;
$function$;

revoke all on function public.record_product_analytics_event(text, uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_product_analytics_event(text, uuid, uuid, text, text, text)
  to service_role;

create or replace function private.capture_analytics_profile_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.record_product_analytics_fact(
    private.product_analytics_uuid(new.id::text || ':identity_created'),
    new.id, 'identity_created', new.created_at, null, null, 'unknown'
  );
  return new;
end;
$function$;

create or replace function private.capture_analytics_identity_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.is_published = false and new.is_published = true then
    perform private.record_product_analytics_fact(
      private.product_analytics_uuid(new.id::text || ':identity_completed'),
      new.id, 'identity_completed', pg_catalog.statement_timestamp(), null, null, 'unknown'
    );
  end if;
  return new;
end;
$function$;

create or replace function private.capture_analytics_guest_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.claimed_user_id is null and new.claimed_user_id is not null then
    perform private.record_product_analytics_fact(
      private.product_analytics_uuid(new.id::text || ':' || new.claimed_user_id::text || ':guest_claimed'),
      new.claimed_user_id, 'guest_claimed', pg_catalog.statement_timestamp(), null, null, 'unknown'
    );
  end if;
  return new;
end;
$function$;

create or replace function private.analytics_connection_source(p_source text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case when p_source = 'direct_share' then 'tap' else p_source end
$function$;

revoke all on function private.analytics_connection_source(text) from public, anon, authenticated, service_role;

create or replace function private.capture_analytics_connection_encounter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_source text := private.analytics_connection_source(new.source);
begin
  perform private.record_product_analytics_fact(
    private.product_analytics_uuid(new.shared_by_user_id::text || ':connection_created:' || new.connection_id::text),
    new.shared_by_user_id, 'connection_created', pg_catalog.statement_timestamp(),
    v_source, new.shared_mode_slug, 'unknown'
  );

  if new.created_by_user_id is not null then
    perform private.record_product_analytics_fact(
      private.product_analytics_uuid(new.created_by_user_id::text || ':connection_created:' || new.connection_id::text),
      new.created_by_user_id, 'connection_created', pg_catalog.statement_timestamp(),
      v_source, new.share_back_mode_slug, 'unknown'
    );
  elsif new.created_by_guest_id is not null then
    perform private.record_product_analytics_fact(
      private.product_analytics_uuid(new.shared_by_user_id::text || ':guest_connection_created:' || new.connection_id::text),
      new.shared_by_user_id, 'guest_connection_created', pg_catalog.statement_timestamp(),
      v_source, new.shared_mode_slug, 'unknown'
    );
  end if;

  return new;
end;
$function$;

create or replace function private.capture_analytics_tap_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.outcome in ('resolved', 'connect_ready') then
    perform private.record_product_analytics_fact(
      private.product_analytics_uuid(new.owner_profile_id::text || ':tap_scanned:' || new.id::text),
      new.owner_profile_id, 'tap_scanned', pg_catalog.statement_timestamp(),
      'tap', new.mode_slug, 'unknown'
    );
  end if;
  return new;
end;
$function$;

create trigger analytics_profile_created
after insert on public.profiles
for each row execute function private.capture_analytics_profile_created();

create trigger analytics_profile_completed
after update of is_published on public.profiles
for each row execute function private.capture_analytics_identity_completed();

create trigger analytics_guest_claimed
after update of claimed_user_id on public.guest_identities
for each row execute function private.capture_analytics_guest_claim();

create trigger analytics_connection_encounter
after insert on public.connection_encounters
for each row execute function private.capture_analytics_connection_encounter();

create trigger analytics_tap_event
after insert on public.tap_events
for each row execute function private.capture_analytics_tap_event();

revoke all on function private.capture_analytics_profile_created() from public, anon, authenticated, service_role;
revoke all on function private.capture_analytics_identity_completed() from public, anon, authenticated, service_role;
revoke all on function private.capture_analytics_guest_claim() from public, anon, authenticated, service_role;
revoke all on function private.capture_analytics_connection_encounter() from public, anon, authenticated, service_role;
revoke all on function private.capture_analytics_tap_event() from public, anon, authenticated, service_role;

-- Backfill only dates that exist in trusted application records. We do not
-- fabricate prior profile views, shares, completion transitions, or guest claims.
insert into private.product_analytics_events (
  idempotency_key, owner_profile_id, event_name, occurred_at, device_class
)
select
  private.product_analytics_uuid(profiles.id::text || ':identity_created'),
  profiles.id, 'identity_created', profiles.created_at, 'unknown'
from public.profiles
on conflict (idempotency_key) do nothing;

with first_encounters as (
  select distinct on (connection_encounters.connection_id)
    connection_encounters.connection_id,
    connection_encounters.created_by_user_id,
    connection_encounters.created_by_guest_id,
    connection_encounters.shared_by_user_id,
    connection_encounters.shared_mode_slug,
    connection_encounters.share_back_mode_slug,
    private.analytics_connection_source(connection_encounters.source) as source,
    connection_encounters.created_at
  from public.connection_encounters
  order by connection_encounters.connection_id, connection_encounters.created_at, connection_encounters.id
)
insert into private.product_analytics_events (
  idempotency_key, owner_profile_id, event_name, occurred_at,
  source, mode_slug, device_class
)
select
  private.product_analytics_uuid(first_encounters.shared_by_user_id::text || ':connection_created:' || first_encounters.connection_id::text),
  first_encounters.shared_by_user_id, 'connection_created', first_encounters.created_at,
  first_encounters.source, first_encounters.shared_mode_slug, 'unknown'
from first_encounters
union all
select
  private.product_analytics_uuid(first_encounters.created_by_user_id::text || ':connection_created:' || first_encounters.connection_id::text),
  first_encounters.created_by_user_id, 'connection_created', first_encounters.created_at,
  first_encounters.source, first_encounters.share_back_mode_slug, 'unknown'
from first_encounters
where first_encounters.created_by_user_id is not null
union all
select
  private.product_analytics_uuid(first_encounters.shared_by_user_id::text || ':guest_connection_created:' || first_encounters.connection_id::text),
  first_encounters.shared_by_user_id, 'guest_connection_created', first_encounters.created_at,
  first_encounters.source, first_encounters.shared_mode_slug, 'unknown'
from first_encounters
where first_encounters.created_by_guest_id is not null
on conflict (idempotency_key) do nothing;

insert into private.product_analytics_events (
  idempotency_key, owner_profile_id, event_name, occurred_at,
  source, mode_slug, device_class
)
select
  private.product_analytics_uuid(tap_events.owner_profile_id::text || ':tap_scanned:' || tap_events.id::text),
  tap_events.owner_profile_id, 'tap_scanned', tap_events.created_at,
  'tap', tap_events.mode_slug, 'unknown'
from public.tap_events
where tap_events.outcome in ('resolved', 'connect_ready')
on conflict (idempotency_key) do nothing;

create or replace function public.get_profile_analytics(
  p_profile_id uuid,
  p_plan_code text,
  p_range_kind text,
  p_from date,
  p_to date,
  p_mode text default null,
  p_source text default null,
  p_device_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_plan text;
  v_today date := (pg_catalog.statement_timestamp() at time zone 'UTC')::date;
  v_days integer;
  v_start timestamptz;
  v_end timestamptz;
  v_previous_start timestamptz;
  v_previous_end timestamptz;
  v_summary jsonb;
  v_comparison jsonb;
  v_payload jsonb;
  v_daily jsonb;
  v_sources jsonb;
  v_modes jsonb;
  v_devices jsonb;
  v_funnel jsonb;
  v_views bigint;
  v_qr_scans bigint;
  v_quick_qr_scans bigint;
  v_tap_scans bigint;
  v_connections bigint;
  v_previous_views bigint;
  v_previous_connections bigint;
begin
  if p_profile_id is null or p_from is null or p_to is null or p_plan_code not in ('free', 'plus', 'pro')
    or p_range_kind not in ('7d', '30d', '90d', 'custom')
    or p_device_id is not null
    or (p_mode is not null and p_mode not in ('personal', 'event', 'business'))
    or (p_source is not null and p_source not in (
      'direct', 'profile', 'share', 'qr', 'quick_qr', 'tap', 'link', 'native_share', 'other'
    )) then
    raise exception using errcode = '22023', message = 'invalid_analytics_query';
  end if;

  select case
    when coalesce(pg_catalog.bool_or(billing_subscriptions.plan_code = 'pro'), false) then 'pro'
    when coalesce(pg_catalog.bool_or(billing_subscriptions.plan_code = 'plus'), false) then 'plus'
    else 'free'
  end
  into v_plan
  from public.billing_subscriptions
  where billing_subscriptions.user_id = p_profile_id
    and public.billing_subscription_has_access(
      billing_subscriptions.provider_status,
      billing_subscriptions.current_period_end,
      billing_subscriptions.cancel_at_next_billing_date,
      billing_subscriptions.past_due_ends_at
    );

  if v_plan is distinct from p_plan_code then
    raise exception using errcode = '42501', message = 'analytics_plan_mismatch';
  end if;

  if p_from > p_to or p_to > v_today then
    raise exception using errcode = '22023', message = 'invalid_analytics_range';
  end if;

  v_days := p_to - p_from + 1;
  if (p_range_kind = '7d' and (v_days <> 7 or p_to <> v_today or p_from <> v_today - 6))
    or (p_range_kind = '30d' and (v_days <> 30 or p_to <> v_today or p_from <> v_today - 29))
    or (p_range_kind = '90d' and (v_days <> 90 or p_to <> v_today or p_from <> v_today - 89))
    or (p_range_kind = 'custom' and (v_plan <> 'pro' or v_days > 730))
    or (v_plan = 'free' and (p_range_kind <> '7d' or v_days > 7))
    or (v_plan = 'plus' and (p_range_kind = 'custom' or v_days > 90))
    or (v_plan = 'pro' and v_days > 730)
    or (v_plan = 'free' and (p_source is not null or p_mode is not null)) then
    raise exception using errcode = '42501', message = 'analytics_plan_limit';
  end if;

  if not exists (select 1 from public.profiles where profiles.id = p_profile_id) then
    raise exception using errcode = 'P0002', message = 'analytics_profile_missing';
  end if;

  v_start := p_from::timestamp at time zone 'UTC';
  v_end := (p_to + 1)::timestamp at time zone 'UTC';
  v_previous_start := (p_from - v_days)::timestamp at time zone 'UTC';
  v_previous_end := v_start;

  select
    pg_catalog.count(*) filter (where events.event_name = 'profile_viewed'),
    pg_catalog.count(*) filter (where events.event_name = 'profile_viewed' and events.source = 'qr'),
    pg_catalog.count(*) filter (where events.event_name = 'quick_qr_scanned'),
    pg_catalog.count(*) filter (where events.event_name = 'tap_scanned'),
    pg_catalog.count(*) filter (where events.event_name = 'connection_created')
  into v_views, v_qr_scans, v_quick_qr_scans, v_tap_scans, v_connections
  from private.product_analytics_events as events
  where events.owner_profile_id = p_profile_id
    and events.occurred_at >= v_start and events.occurred_at < v_end
    and (p_source is null or events.source = p_source)
    and (p_mode is null or events.mode_slug = p_mode);

  v_summary := pg_catalog.jsonb_build_object(
    'profile_views', v_views,
    'qr_scans', v_qr_scans,
    'quick_qr_scans', v_quick_qr_scans,
    'tap_scans', v_tap_scans,
    'connections', v_connections
  );

  select pg_catalog.count(*) into v_previous_views
  from private.product_analytics_events as events
  where events.owner_profile_id = p_profile_id and events.event_name = 'profile_viewed'
    and events.occurred_at >= v_previous_start and events.occurred_at < v_previous_end
    and (p_source is null or events.source = p_source)
    and (p_mode is null or events.mode_slug = p_mode);

  select pg_catalog.count(*) into v_previous_connections
  from private.product_analytics_events as events
  where events.owner_profile_id = p_profile_id and events.event_name = 'connection_created'
    and events.occurred_at >= v_previous_start and events.occurred_at < v_previous_end
    and (p_source is null or events.source = p_source)
    and (p_mode is null or events.mode_slug = p_mode);

  v_comparison := pg_catalog.jsonb_build_object(
    'profile_views_delta', case when v_previous_views = 0 then null
      else round(((v_views - v_previous_views)::numeric / v_previous_views) * 100, 1) end,
    'connections_delta', case when v_previous_connections = 0 then null
      else round(((v_connections - v_previous_connections)::numeric / v_previous_connections) * 100, 1) end
  );

  v_payload := pg_catalog.jsonb_build_object('summary', v_summary, 'comparison', v_comparison);

  if v_plan in ('plus', 'pro') then
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'date', days.day::text,
      'profile_views', coalesce(daily.profile_views, 0),
      'qr_scans', coalesce(daily.qr_scans, 0),
      'quick_qr_scans', coalesce(daily.quick_qr_scans, 0),
      'tap_scans', coalesce(daily.tap_scans, 0),
      'connections', coalesce(daily.connections, 0)
    ) order by days.day)
    into v_daily
    from pg_catalog.generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as days(day)
    left join (
      select (events.occurred_at at time zone 'UTC')::date as day,
        pg_catalog.count(*) filter (where events.event_name = 'profile_viewed') as profile_views,
        pg_catalog.count(*) filter (where events.event_name = 'profile_viewed' and events.source = 'qr') as qr_scans,
        pg_catalog.count(*) filter (where events.event_name = 'quick_qr_scanned') as quick_qr_scans,
        pg_catalog.count(*) filter (where events.event_name = 'tap_scanned') as tap_scans,
        pg_catalog.count(*) filter (where events.event_name = 'connection_created') as connections
      from private.product_analytics_events as events
      where events.owner_profile_id = p_profile_id
        and events.occurred_at >= v_start and events.occurred_at < v_end
        and (p_source is null or events.source = p_source)
        and (p_mode is null or events.mode_slug = p_mode)
      group by 1
    ) as daily on daily.day = days.day::date;

    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('source', grouped.source, 'count', grouped.count)
      order by grouped.count desc, grouped.source), '[]'::jsonb)
    into v_sources
    from (
      select events.source, pg_catalog.count(*) as count
      from private.product_analytics_events as events
      where events.owner_profile_id = p_profile_id and events.event_name = 'profile_viewed'
        and events.occurred_at >= v_start and events.occurred_at < v_end
        and events.source is not null and (p_mode is null or events.mode_slug = p_mode)
      group by events.source
    ) as grouped;

    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('mode', grouped.mode_slug, 'count', grouped.count)
      order by grouped.count desc, grouped.mode_slug), '[]'::jsonb)
    into v_modes
    from (
      select events.mode_slug, pg_catalog.count(*) as count
      from private.product_analytics_events as events
      where events.owner_profile_id = p_profile_id and events.event_name = 'profile_viewed'
        and events.occurred_at >= v_start and events.occurred_at < v_end
        and events.mode_slug is not null and (p_source is null or events.source = p_source)
      group by events.mode_slug
    ) as grouped;

    v_payload := v_payload || pg_catalog.jsonb_build_object(
      'daily', coalesce(v_daily, '[]'::jsonb),
      'sources', coalesce(v_sources, '[]'::jsonb),
      'modes', coalesce(v_modes, '[]'::jsonb)
    );
  end if;

  if v_plan = 'pro' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('device_class', grouped.device_class, 'count', grouped.count)
      order by grouped.count desc, grouped.device_class), '[]'::jsonb)
    into v_devices
    from (
      select events.device_class, pg_catalog.count(*) as count
      from private.product_analytics_events as events
      where events.owner_profile_id = p_profile_id and events.event_name = 'profile_viewed'
        and events.occurred_at >= v_start and events.occurred_at < v_end
        and events.device_class <> 'unknown'
        and (p_source is null or events.source = p_source)
        and (p_mode is null or events.mode_slug = p_mode)
      group by events.device_class
    ) as grouped;

    select pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('step', 'profile_views', 'count', coalesce(pg_catalog.sum(metrics.profile_views), 0)),
      pg_catalog.jsonb_build_object('step', 'shares', 'count', coalesce(pg_catalog.sum(metrics.shares), 0)),
      pg_catalog.jsonb_build_object('step', 'connections', 'count', coalesce(pg_catalog.sum(metrics.connections), 0))
    )
    into v_funnel
    from (
      select
        pg_catalog.count(*) filter (where events.event_name = 'profile_viewed') as profile_views,
        pg_catalog.count(*) filter (where events.event_name = 'profile_shared') as shares,
        pg_catalog.count(*) filter (where events.event_name = 'connection_created') as connections
      from private.product_analytics_events as events
      where events.owner_profile_id = p_profile_id
        and events.occurred_at >= v_start and events.occurred_at < v_end
        and (p_source is null or events.source = p_source)
        and (p_mode is null or events.mode_slug = p_mode)
    ) as metrics;

    v_payload := v_payload || pg_catalog.jsonb_build_object(
      'devices', coalesce(v_devices, '[]'::jsonb),
      'funnel', coalesce(v_funnel, '[]'::jsonb)
    );
  end if;

  return v_payload;
end;
$function$;

revoke all on function public.get_profile_analytics(uuid, text, text, date, date, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.get_profile_analytics(uuid, text, text, date, date, text, text, uuid)
  to service_role;

create or replace function public.get_internal_product_analytics(
  p_from date,
  p_to date
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_summary jsonb;
  v_daily jsonb;
  v_sources jsonb;
  v_modes jsonb;
begin
  if p_from is null or p_to is null or p_from > p_to or p_to > (pg_catalog.statement_timestamp() at time zone 'UTC')::date
    or p_to - p_from + 1 > 90 then
    raise exception using errcode = '22023', message = 'invalid_internal_analytics_range';
  end if;

  v_start := p_from::timestamp at time zone 'UTC';
  v_end := (p_to + 1)::timestamp at time zone 'UTC';

  select pg_catalog.jsonb_build_object(
    'guest_connections', count(*) filter (where events.event_name = 'guest_connection_created'),
    'guest_claims', count(*) filter (where events.event_name = 'guest_claimed'),
    'identities_created', count(*) filter (where events.event_name = 'identity_created'),
    'identity_completed', count(*) filter (where events.event_name = 'identity_completed'),
    'first_shares', count(*) filter (where events.event_name = 'first_share'),
    'repeat_shares', count(*) filter (where events.event_name = 'repeat_share'),
    'new_connections_after_first_share', count(*) filter (
      where events.event_name = 'connection_created' and exists (
        select 1 from private.product_analytics_events as shares
        where shares.owner_profile_id = events.owner_profile_id
          and shares.event_name = 'profile_shared'
          and shares.occurred_at <= events.occurred_at
      )
    )
  )
  into v_summary
  from private.product_analytics_events as events
  where events.occurred_at >= v_start and events.occurred_at < v_end;

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'date', days.day::text,
    'guest_connections', coalesce(daily.guest_connections, 0),
    'claims', coalesce(daily.claims, 0),
    'identity_completed', coalesce(daily.identity_completed, 0),
    'first_shares', coalesce(daily.first_shares, 0),
    'repeat_shares', coalesce(daily.repeat_shares, 0)
  ) order by days.day)
  into v_daily
  from pg_catalog.generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as days(day)
  left join (
    select (events.occurred_at at time zone 'UTC')::date as day,
      count(*) filter (where events.event_name = 'guest_connection_created') as guest_connections,
      count(*) filter (where events.event_name = 'guest_claimed') as claims,
      count(*) filter (where events.event_name = 'identity_completed') as identity_completed,
      count(*) filter (where events.event_name = 'first_share') as first_shares,
      count(*) filter (where events.event_name = 'repeat_share') as repeat_shares
    from private.product_analytics_events as events
    where events.occurred_at >= v_start and events.occurred_at < v_end
    group by 1
  ) as daily on daily.day = days.day::date;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('source', grouped.source, 'count', grouped.count)
    order by grouped.count desc, grouped.source), '[]'::jsonb)
  into v_sources
  from (
    select connection_encounters.source, count(*) as count
    from public.connection_encounters
    where connection_encounters.created_at >= v_start and connection_encounters.created_at < v_end
    group by connection_encounters.source
  ) as grouped;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('mode', grouped.shared_mode_slug, 'count', grouped.count)
    order by grouped.count desc, grouped.shared_mode_slug), '[]'::jsonb)
  into v_modes
  from (
    select connection_encounters.shared_mode_slug, count(*) as count
    from public.connection_encounters
    where connection_encounters.created_at >= v_start and connection_encounters.created_at < v_end
    group by connection_encounters.shared_mode_slug
  ) as grouped;

  return pg_catalog.jsonb_build_object(
    'summary', coalesce(v_summary, '{}'::jsonb),
    'daily', coalesce(v_daily, '[]'::jsonb),
    'sourceBreakdown', coalesce(v_sources, '[]'::jsonb),
    'modeBreakdown', coalesce(v_modes, '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_internal_product_analytics(date, date) from public, anon, authenticated;
grant execute on function public.get_internal_product_analytics(date, date) to service_role;

comment on function public.record_product_analytics_event(text, uuid, uuid, text, text, text) is
  'Server-only writer for allowlisted first-party analytics events; raw visitor and device identifiers are not accepted.';
comment on function public.get_profile_analytics(uuid, text, text, date, date, text, text, uuid) is
  'Server-only aggregate report. Enforces the effective billing plan in the database and returns no event-level records.';
comment on function public.get_internal_product_analytics(date, date) is
  'Server-only internal aggregate report. Returns counts and coarse source/Mode labels without profile identifiers.';
