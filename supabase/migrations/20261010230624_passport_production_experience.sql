-- Passport production experience: normalized permanent context stamps,
-- complete owner pagination, and narrowly scoped presentation preferences.

create or replace function private.passport_normalize_context(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $function$
  select nullif(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.normalize(p_value, 'NFC'),
        '[[:space:]   -   　]+',
        ' ',
        'g'
      )
    ),
    ''
  )
$function$;

create or replace function private.passport_is_iso_country(p_code text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select coalesce(pg_catalog.upper(pg_catalog.btrim(p_code)) = any (
    pg_catalog.string_to_array(
      'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW',
      ' '
    )
  ), false)
$function$;

create or replace function private.passport_context_stamp_key(
  p_type text,
  p_event text,
  p_city text,
  p_country text
)
returns text
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_event text := private.passport_normalize_context(p_event);
  v_city text := private.passport_normalize_context(p_city);
  v_country text := pg_catalog.upper(pg_catalog.btrim(p_country));
  v_key text;
begin
  if not private.passport_is_iso_country(v_country) then
    v_country := null;
  end if;

  if p_type = 'country' then
    return v_country;
  elsif p_type = 'city' then
    if v_city is null then return null; end if;
    return pg_catalog.concat_ws('|', v_country, pg_catalog.lower(v_city));
  elsif p_type = 'event' then
    if v_event is null then return null; end if;
    v_key := pg_catalog.concat_ws('|', v_country, pg_catalog.lower(v_city), pg_catalog.lower(v_event));
    if pg_catalog.char_length(v_key) > 120 then
      return pg_catalog.left(v_key, 87) || '|' || pg_catalog.md5(v_key);
    end if;
    return v_key;
  end if;

  return null;
end;
$function$;

revoke all on function private.passport_normalize_context(text) from public, anon, authenticated;
revoke all on function private.passport_is_iso_country(text) from public, anon, authenticated;
revoke all on function private.passport_context_stamp_key(text, text, text, text) from public, anon, authenticated;

-- Keep existing source records as entered. Invalid or inferred-looking country
-- values are ignored when awarding Passport stamps; only explicit ISO alpha-2
-- codes are materialized as a Country stamp or a location-key component.
create or replace function private.add_passport_context_stamps(
  p_user_id uuid,
  p_event text,
  p_city text,
  p_country text,
  p_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event text := private.passport_normalize_context(p_event);
  v_city text := private.passport_normalize_context(p_city);
  v_country text := pg_catalog.upper(pg_catalog.btrim(p_country));
  v_at timestamptz := coalesce(p_at, pg_catalog.statement_timestamp());
begin
  if p_user_id is null then return; end if;
  if not private.passport_is_iso_country(v_country) then v_country := null; end if;

  if v_event is not null then
    insert into public.passport_stamps(user_id, stamp_type, context_key, title, subtitle, country_code, earned_at)
    values (
      p_user_id,
      'event',
      private.passport_context_stamp_key('event', v_event, v_city, v_country),
      v_event,
      nullif(pg_catalog.concat_ws(' · ',
        nullif(pg_catalog.concat_ws(', ', v_city, v_country), ''),
        extract(year from v_at)::integer::text
      ), ''),
      v_country,
      v_at
    )
    on conflict (user_id, stamp_type, context_key) do update
      set earned_at = least(public.passport_stamps.earned_at, excluded.earned_at),
          title = case when excluded.earned_at < public.passport_stamps.earned_at then excluded.title else public.passport_stamps.title end,
          subtitle = case when excluded.earned_at < public.passport_stamps.earned_at then excluded.subtitle else public.passport_stamps.subtitle end,
          country_code = coalesce(public.passport_stamps.country_code, excluded.country_code);
  end if;

  if v_city is not null then
    insert into public.passport_stamps(user_id, stamp_type, context_key, title, subtitle, country_code, earned_at)
    values (
      p_user_id,
      'city',
      private.passport_context_stamp_key('city', null, v_city, v_country),
      v_city,
      nullif(pg_catalog.concat_ws(' · ', v_country, extract(year from v_at)::integer::text), ''),
      v_country,
      v_at
    )
    on conflict (user_id, stamp_type, context_key) do update
      set earned_at = least(public.passport_stamps.earned_at, excluded.earned_at),
          title = case when excluded.earned_at < public.passport_stamps.earned_at then excluded.title else public.passport_stamps.title end,
          subtitle = case when excluded.earned_at < public.passport_stamps.earned_at then excluded.subtitle else public.passport_stamps.subtitle end,
          country_code = coalesce(public.passport_stamps.country_code, excluded.country_code);
  end if;

  if v_country is not null then
    insert into public.passport_stamps(user_id, stamp_type, context_key, title, subtitle, country_code, earned_at)
    values (
      p_user_id,
      'country',
      private.passport_context_stamp_key('country', null, null, v_country),
      v_country,
      extract(year from v_at)::integer::text,
      v_country,
      v_at
    )
    on conflict (user_id, stamp_type, context_key) do update
      set earned_at = least(public.passport_stamps.earned_at, excluded.earned_at);
  end if;
end;
$function$;
revoke all on function private.add_passport_context_stamps(uuid, text, text, text, timestamptz) from public, anon, authenticated;

update public.passport_stamps
set country_code = null
where stamp_type <> 'country'
  and country_code is not null
  and not private.passport_is_iso_country(country_code);

create or replace function private.passport_user_has_member_plan(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(bool_or(
    billing_subscriptions.plan_code in ('plus', 'pro')
    and public.billing_subscription_has_access(
      billing_subscriptions.provider_status,
      billing_subscriptions.current_period_end,
      billing_subscriptions.cancel_at_next_billing_date,
      billing_subscriptions.past_due_ends_at
    )
  ), false)
  from public.billing_subscriptions
  where billing_subscriptions.user_id = p_user_id
$function$;
revoke all on function private.passport_user_has_member_plan(uuid) from public, anon, authenticated;

create table public.passport_presentation_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  cover_id text not null default 'standard' check (cover_id in ('standard', 'paper_passport_cover', 'century_cover', 'thousand_cover')),
  -- NULL follows the historic automatic Plus/Pro finish; TRUE/FALSE is an owner override.
  member_finish_enabled boolean default null,
  featured_stamp_id uuid references public.passport_stamps(id) on delete set null,
  updated_at timestamptz not null default pg_catalog.statement_timestamp()
);

alter table public.passport_presentation_preferences enable row level security;
revoke all on public.passport_presentation_preferences from public, anon, authenticated;
grant select on public.passport_presentation_preferences to authenticated;
create policy "users read own passport presentation preferences"
  on public.passport_presentation_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

-- Preserve covers equipped through the original rewards surface.
insert into public.passport_presentation_preferences(user_id, cover_id)
select preference.user_id, preference.reward_id
from public.passport_preferences preference
join public.passport_entitlements entitlement
  on entitlement.user_id = preference.user_id
 and entitlement.reward_id = preference.reward_id
where preference.category = 'passport_cover'
  and preference.reward_id in ('paper_passport_cover', 'century_cover', 'thousand_cover')
on conflict (user_id) do update
  set cover_id = excluded.cover_id,
      updated_at = pg_catalog.statement_timestamp();

-- Keep legacy reward controls and the new presentation surface in sync.
create or replace function public.set_passport_reward(p_category text, p_reward_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Sign in required'; end if;
  if not exists (
    select 1
    from public.passport_reward_catalog catalog
    join public.passport_entitlements entitlement on entitlement.reward_id = catalog.reward_id
    where entitlement.user_id = v_user_id
      and catalog.reward_id = p_reward_id
      and catalog.category = p_category
  ) then
    raise exception using errcode = '42501', message = 'Reward is not unlocked';
  end if;

  insert into public.passport_preferences(user_id, category, reward_id, updated_at)
  values (v_user_id, p_category, p_reward_id, pg_catalog.statement_timestamp())
  on conflict (user_id, category) do update
    set reward_id = excluded.reward_id,
        updated_at = excluded.updated_at;

  if p_category = 'passport_cover' then
    insert into public.passport_presentation_preferences(user_id, cover_id, updated_at)
    values (v_user_id, p_reward_id, pg_catalog.statement_timestamp())
    on conflict (user_id) do update
      set cover_id = excluded.cover_id,
          updated_at = excluded.updated_at;
  end if;

  return true;
end;
$function$;
revoke all on function public.set_passport_reward(text, text) from public, anon, authenticated;
grant execute on function public.set_passport_reward(text, text) to authenticated;

create or replace function public.set_passport_cover(p_cover_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Sign in required'; end if;
  if p_cover_id is null or p_cover_id not in ('standard', 'paper_passport_cover', 'century_cover', 'thousand_cover') then
    raise exception using errcode = '22023', message = 'Invalid Passport cover';
  end if;
  if p_cover_id <> 'standard' and not exists (
    select 1 from public.passport_entitlements
    where passport_entitlements.user_id = v_user_id
      and passport_entitlements.reward_id = p_cover_id
  ) then
    raise exception using errcode = '42501', message = 'Passport cover is not unlocked';
  end if;

  insert into public.passport_presentation_preferences(user_id, cover_id, updated_at)
  values (v_user_id, p_cover_id, pg_catalog.statement_timestamp())
  on conflict (user_id) do update
    set cover_id = excluded.cover_id,
        updated_at = excluded.updated_at;

  if p_cover_id = 'standard' then
    delete from public.passport_preferences
    where passport_preferences.user_id = v_user_id
      and passport_preferences.category = 'passport_cover';
  else
    insert into public.passport_preferences(user_id, category, reward_id, updated_at)
    values (v_user_id, 'passport_cover', p_cover_id, pg_catalog.statement_timestamp())
    on conflict (user_id, category) do update
      set reward_id = excluded.reward_id,
          updated_at = excluded.updated_at;
  end if;

  return true;
end;
$function$;
revoke all on function public.set_passport_cover(text) from public, anon, authenticated;
grant execute on function public.set_passport_cover(text) to authenticated;

create or replace function public.set_passport_member_finish(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Sign in required'; end if;
  if p_enabled is null then raise exception using errcode = '22023', message = 'Invalid Passport finish'; end if;
  if p_enabled and not private.passport_user_has_member_plan(v_user_id) then
    raise exception using errcode = '42501', message = 'Member Passport finish requires Plus or Pro';
  end if;

  insert into public.passport_presentation_preferences(user_id, member_finish_enabled, updated_at)
  values (v_user_id, p_enabled, pg_catalog.statement_timestamp())
  on conflict (user_id) do update
    set member_finish_enabled = excluded.member_finish_enabled,
        updated_at = excluded.updated_at;
  return true;
end;
$function$;
revoke all on function public.set_passport_member_finish(boolean) from public, anon, authenticated;
grant execute on function public.set_passport_member_finish(boolean) to authenticated;

create or replace function public.set_passport_featured_stamp(p_stamp_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Sign in required'; end if;
  if p_stamp_id is not null then
    if not private.passport_user_has_member_plan(v_user_id) then
      raise exception using errcode = '42501', message = 'Featured Passport stamp requires Plus or Pro';
    end if;
    if not exists (
      select 1 from public.passport_stamps
      where passport_stamps.id = p_stamp_id
        and passport_stamps.user_id = v_user_id
    ) then
      raise exception using errcode = '42501', message = 'Passport stamp is not yours';
    end if;
  end if;

  insert into public.passport_presentation_preferences(user_id, featured_stamp_id, updated_at)
  values (v_user_id, p_stamp_id, pg_catalog.statement_timestamp())
  on conflict (user_id) do update
    set featured_stamp_id = excluded.featured_stamp_id,
        updated_at = excluded.updated_at;
  return true;
end;
$function$;
revoke all on function public.set_passport_featured_stamp(uuid) from public, anon, authenticated;
grant execute on function public.set_passport_featured_stamp(uuid) to authenticated;

-- Reconcile legacy lower-only event/city keys from durable Connections and
-- owner-entered Encounter context. Earliest earned_at wins for duplicates.
create temporary table passport_expected_context_stamps (
  user_id uuid not null,
  stamp_type text not null,
  context_key text not null,
  title text not null,
  subtitle text,
  country_code text,
  earned_at timestamptz not null,
  primary key (user_id, stamp_type, context_key)
);

with source_context as (
  select connections.user_id as user_id, encounter.event_name as event_name,
         encounter.city as city, encounter.country_code as country_code, encounter.created_at as earned_at
  from public.connections
  join public.connection_encounters encounter on encounter.connection_id = connections.id
  union all
  select connections.connected_user_id, encounter.event_name,
         encounter.city, encounter.country_code, encounter.created_at
  from public.connections
  join public.connection_encounters encounter on encounter.connection_id = connections.id
  where connections.connected_user_id is not null
  union all
  select context.user_id, context.event_label, context.city, context.country_code,
         coalesce(encounter.created_at, context.created_at)
  from public.encounter_context context
  left join public.connection_encounters encounter on encounter.id = context.encounter_id
), normalized as (
  select source_context.user_id,
         private.passport_normalize_context(source_context.event_name) as event_name,
         private.passport_normalize_context(source_context.city) as city,
         case
           when private.passport_is_iso_country(pg_catalog.upper(pg_catalog.btrim(source_context.country_code)))
             then pg_catalog.upper(pg_catalog.btrim(source_context.country_code))
           else null
         end as country_code,
         source_context.earned_at
  from source_context
  where source_context.user_id is not null
), rows_to_keep as (
  select normalized.user_id, 'event'::text as stamp_type,
         private.passport_context_stamp_key('event', normalized.event_name, normalized.city, normalized.country_code) as context_key,
         normalized.event_name as title,
         nullif(pg_catalog.concat_ws(' · ',
           nullif(pg_catalog.concat_ws(', ', normalized.city, normalized.country_code), ''),
           extract(year from normalized.earned_at)::integer::text
         ), '') as subtitle,
         normalized.country_code, normalized.earned_at
  from normalized where normalized.event_name is not null
  union all
  select normalized.user_id, 'city',
         private.passport_context_stamp_key('city', null, normalized.city, normalized.country_code),
         normalized.city,
         nullif(pg_catalog.concat_ws(' · ', normalized.country_code, extract(year from normalized.earned_at)::integer::text), ''),
         normalized.country_code, normalized.earned_at
  from normalized where normalized.city is not null
  union all
  select normalized.user_id, 'country',
         private.passport_context_stamp_key('country', null, null, normalized.country_code),
         normalized.country_code,
         extract(year from normalized.earned_at)::integer::text,
         normalized.country_code, normalized.earned_at
  from normalized where normalized.country_code is not null
)
insert into passport_expected_context_stamps(user_id, stamp_type, context_key, title, subtitle, country_code, earned_at)
select distinct on (rows_to_keep.user_id, rows_to_keep.stamp_type, rows_to_keep.context_key)
       rows_to_keep.user_id, rows_to_keep.stamp_type, rows_to_keep.context_key,
       rows_to_keep.title, rows_to_keep.subtitle, rows_to_keep.country_code, rows_to_keep.earned_at
from rows_to_keep
where rows_to_keep.context_key is not null
order by rows_to_keep.user_id, rows_to_keep.stamp_type, rows_to_keep.context_key,
         rows_to_keep.earned_at asc, rows_to_keep.title asc;

insert into public.passport_stamps(user_id, stamp_type, context_key, title, subtitle, country_code, earned_at)
select user_id, stamp_type, context_key, title, subtitle, country_code, earned_at
from passport_expected_context_stamps
on conflict (user_id, stamp_type, context_key) do update
  set earned_at = least(public.passport_stamps.earned_at, excluded.earned_at),
      title = case when excluded.earned_at < public.passport_stamps.earned_at then excluded.title else public.passport_stamps.title end,
      subtitle = case when excluded.earned_at < public.passport_stamps.earned_at then excluded.subtitle else public.passport_stamps.subtitle end,
      country_code = coalesce(public.passport_stamps.country_code, excluded.country_code);

-- Never delete a same-title stamp during reconciliation. Legacy keys do not
-- retain enough context to prove that two places or events are duplicates.
drop table passport_expected_context_stamps;

do $backfill$
declare v_user record; v_now timestamptz := pg_catalog.statement_timestamp();
begin
  for v_user in select id from public.profiles loop
    perform private.award_passport_milestones(v_user.id, v_now);
  end loop;
end;
$backfill$;

drop index if exists public.passport_stamps_user_recent_idx;
create index passport_stamps_user_recent_idx
  on public.passport_stamps(user_id, earned_at desc, id desc);

create or replace function public.get_passport_stamp_page(
  p_before_earned_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_items jsonb;
  v_has_more boolean;
  v_cursor jsonb;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Sign in required'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
     or ((p_before_earned_at is null) <> (p_before_id is null)) then
    raise exception using errcode = '22023', message = 'Invalid Passport page';
  end if;

  with page as (
    select stamps.id, stamps.stamp_type, stamps.context_key, stamps.title,
           stamps.subtitle, stamps.country_code, stamps.earned_at,
           pg_catalog.row_number() over (order by stamps.earned_at desc, stamps.id desc) as row_number
    from public.passport_stamps stamps
    where stamps.user_id = v_user_id
      and (p_before_earned_at is null or (stamps.earned_at, stamps.id) < (p_before_earned_at, p_before_id))
    order by stamps.earned_at desc, stamps.id desc
    limit p_limit + 1
  )
  select
    coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', page.id,
      'type', page.stamp_type,
      'key', page.context_key,
      'title', page.title,
      'subtitle', page.subtitle,
      'countryCode', page.country_code,
      'earnedAt', page.earned_at
    ) order by page.earned_at desc, page.id desc) filter (where page.row_number <= p_limit), '[]'::jsonb),
    count(*) > p_limit,
    (select pg_catalog.jsonb_build_object('earnedAt', last_page.earned_at, 'id', last_page.id)
     from page last_page where last_page.row_number = p_limit)
  into v_items, v_has_more, v_cursor
  from page;

  return pg_catalog.jsonb_build_object('items', v_items, 'hasMore', v_has_more, 'nextCursor', v_cursor);
end;
$function$;
revoke all on function public.get_passport_stamp_page(timestamptz, uuid, integer) from public, anon, authenticated;
grant execute on function public.get_passport_stamp_page(timestamptz, uuid, integer) to authenticated;

create or replace function public.get_passport_overview()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with who as (select auth.uid() as id), totals as (
    select count(*)::integer as n from public.connections, who
    where connections.user_id = who.id or connections.connected_user_id = who.id
  ), counts as (
    select count(*) filter (where stamp_type = 'city')::integer as cities,
           count(*) filter (where stamp_type = 'event')::integer as events,
           count(*) filter (where stamp_type = 'country')::integer as countries
    from public.passport_stamps, who where passport_stamps.user_id = who.id
  ), milestones as (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'threshold', threshold, 'unlockedAt', unlocked_at, 'seenAt', seen_at
    ) order by threshold), '[]'::jsonb) as value
    from public.passport_milestones, who where user_id = who.id
  ), rewards as (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', entitlement.reward_id, 'name', catalog.name, 'category', catalog.category,
      'milestone', catalog.milestone, 'rarity', catalog.rarity, 'unlockedAt', entitlement.unlocked_at
    ) order by catalog.sort_order), '[]'::jsonb) as value
    from public.passport_entitlements entitlement
    join public.passport_reward_catalog catalog on catalog.reward_id = entitlement.reward_id
    cross join who where entitlement.user_id = who.id
  ), recent_stamps as (
    select stamps.id, stamps.stamp_type, stamps.context_key, stamps.title, stamps.subtitle,
           stamps.country_code, stamps.earned_at
    from public.passport_stamps stamps, who
    where stamps.user_id = who.id
    order by stamps.earned_at desc, stamps.id desc
    limit 100
  ), stamps as (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', id, 'type', stamp_type, 'key', context_key, 'title', title,
      'subtitle', subtitle, 'countryCode', country_code, 'earnedAt', earned_at
    ) order by earned_at desc, id desc), '[]'::jsonb) as value
    from recent_stamps
  ), stamp_totals as (
    select count(*)::integer as value
    from public.passport_stamps, who where passport_stamps.user_id = who.id
  ), preferences as (
    select coalesce(pg_catalog.jsonb_object_agg(category, reward_id), '{}'::jsonb) as value
    from public.passport_preferences, who where user_id = who.id
  ), presentation as (
    select coalesce((
      select pg_catalog.jsonb_build_object(
        'coverId', presentation_preferences.cover_id,
        'memberFinishEnabled', presentation_preferences.member_finish_enabled,
        'featuredStampId', presentation_preferences.featured_stamp_id,
        'featuredStamp', (
          select pg_catalog.jsonb_build_object(
            'id', featured.id,
            'type', featured.stamp_type,
            'title', featured.title,
            'subtitle', featured.subtitle,
            'countryCode', featured.country_code,
            'earnedAt', featured.earned_at
          )
          from public.passport_stamps featured
          where featured.id = presentation_preferences.featured_stamp_id
            and featured.user_id = presentation_preferences.user_id
        )
      )
      from public.passport_presentation_preferences presentation_preferences, who
      where presentation_preferences.user_id = who.id
    ), pg_catalog.jsonb_build_object(
      'coverId', 'standard',
      'memberFinishEnabled', null,
      'featuredStampId', null,
      'featuredStamp', null
    )) as value
  )
  select pg_catalog.jsonb_build_object(
    'connectionCount', totals.n,
    'cities', counts.cities,
    'events', counts.events,
    'countries', counts.countries,
    'stampTotal', stamp_totals.value,
    'hasMoreStamps', stamp_totals.value > pg_catalog.jsonb_array_length(stamps.value),
    'milestones', milestones.value,
    'rewards', rewards.value,
    'stamps', stamps.value,
    'preferences', preferences.value,
    'presentation', presentation.value
  )
  from totals, counts, milestones, rewards, stamps, stamp_totals, preferences, presentation
$function$;
revoke all on function public.get_passport_overview() from public, anon;
grant execute on function public.get_passport_overview() to authenticated;

create or replace function public.get_public_passport_featured_stamp(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'type', stamps.stamp_type,
    'title', stamps.title,
    'subtitle', stamps.subtitle,
    'countryCode', stamps.country_code
  )
  from public.profiles profile
  join public.passport_presentation_preferences preferences on preferences.user_id = profile.id
  join public.passport_stamps stamps on stamps.id = preferences.featured_stamp_id and stamps.user_id = profile.id
  where profile.username = pg_catalog.lower(pg_catalog.btrim(p_username))
    and profile.is_published = true
    and private.passport_user_has_member_plan(profile.id)
  limit 1
$function$;
revoke all on function public.get_public_passport_featured_stamp(text) from public;
grant execute on function public.get_public_passport_featured_stamp(text) to anon, authenticated;

comment on table public.passport_presentation_preferences is
  'Private owner presentation choices. Member-only display is derived from current billing and never deletes saved preferences.';
comment on function public.get_passport_stamp_page(timestamptz, uuid, integer) is
  'Authenticated owner-only keyset pagination for the complete private Passport stamp collection.';
comment on function public.get_public_passport_featured_stamp(text) is
  'Intentional SECURITY DEFINER: returns only a single owner-selected stamp for a published profile with an active Plus/Pro plan; never returns history or internal keys.';
