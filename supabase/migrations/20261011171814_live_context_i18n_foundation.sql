-- Live Context is owner-declared meeting context, separate from profile Modes.
-- Encounter columns below are immutable snapshots; deleting a Live Context never
-- changes a Connection's recorded history.

create table public.live_contexts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  context_type text not null check (context_type in ('event', 'meeting', 'place', 'custom')),
  label text not null check (
    char_length(btrim(label)) between 1 and 120
    and label = btrim(label)
    and label !~ '[[:cntrl:]]'
  ),
  venue text check (venue is null or (char_length(venue) <= 120 and venue = btrim(venue) and venue !~ '[[:cntrl:]]')),
  city text check (city is null or (char_length(city) <= 80 and city = btrim(city) and city !~ '[[:cntrl:]]')),
  country_code text check (
    country_code is null or (
      country_code = pg_catalog.upper(country_code)
      and country_code = any (pg_catalog.string_to_array(
        'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW',
        ' '
      ))
    )
  ),
  starts_at timestamptz,
  expires_at timestamptz not null,
  source text not null default 'manual' check (
    char_length(btrim(source)) between 1 and 40
    and source = btrim(source)
    and source !~ '[[:cntrl:]]'
  ),
  is_active boolean not null default true,
  is_saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_context_time_order check (starts_at is null or starts_at < expires_at),
  constraint live_context_expires_after_creation check (expires_at > created_at)
);

create unique index live_contexts_one_active_per_owner_uidx
  on public.live_contexts(owner_user_id)
  where is_active;
create index live_contexts_owner_recent_idx
  on public.live_contexts(owner_user_id, created_at desc);
create index live_contexts_owner_saved_idx
  on public.live_contexts(owner_user_id, updated_at desc)
  where is_saved;

create trigger live_contexts_set_updated_at
  before update on public.live_contexts
  for each row execute function private.set_updated_at();

alter table public.live_contexts enable row level security;
revoke all on table public.live_contexts from public, anon, authenticated;
grant select, delete on public.live_contexts to authenticated;
grant insert (owner_user_id, context_type, label, venue, city, country_code, starts_at, expires_at, source, is_active, is_saved)
  on public.live_contexts to authenticated;
grant update (context_type, label, venue, city, country_code, starts_at, expires_at, source, is_active, is_saved)
  on public.live_contexts to authenticated;

create policy "owners manage their Live Contexts"
  on public.live_contexts for all to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

-- A single invoker-rights operation deactivates the previous row and inserts
-- the new explicit context. The partial unique index protects concurrent writes.
create or replace function public.set_active_live_context(
  p_context_type text,
  p_label text,
  p_expires_at timestamptz,
  p_venue text default null,
  p_city text default null,
  p_country_code text default null,
  p_starts_at timestamptz default null,
  p_source text default 'manual',
  p_is_saved boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_owner_id uuid := (select auth.uid());
  v_context_id uuid;
begin
  if v_owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_expires_at is null or p_expires_at <= pg_catalog.statement_timestamp() then
    raise exception using errcode = '22023', message = 'Live Context expiry must be in the future';
  end if;
  if p_starts_at is not null and p_starts_at >= p_expires_at then
    raise exception using errcode = '22023', message = 'Live Context end must follow its start';
  end if;

  update public.live_contexts
     set is_active = false
   where owner_user_id = v_owner_id and is_active;

  insert into public.live_contexts (
    owner_user_id, context_type, label, venue, city, country_code,
    starts_at, expires_at, source, is_active, is_saved
  ) values (
    v_owner_id, p_context_type, p_label, nullif(p_venue, ''), nullif(p_city, ''),
    nullif(p_country_code, ''), p_starts_at, p_expires_at,
    coalesce(nullif(p_source, ''), 'manual'), true, coalesce(p_is_saved, false)
  ) returning id into v_context_id;

  return v_context_id;
end;
$function$;

revoke all on function public.set_active_live_context(text, text, timestamptz, text, text, text, timestamptz, text, boolean) from public, anon;
grant execute on function public.set_active_live_context(text, text, timestamptz, text, text, text, timestamptz, text, boolean) to authenticated;

comment on table public.live_contexts is
  'Owner-declared, temporary context independent of profile Modes. Rows remain private and may be saved or reused.';
comment on column public.live_contexts.source is
  'Extensible provenance such as manual, saved, recent, event, calendar, device_confirmed, or organizer.';
comment on column public.live_contexts.expires_at is
  'Explicit end of the context. Expired rows never resolve as active, even if is_active remains true.';

-- This preference table is private because the repository has no general account
-- preferences table. Locale and region are separate values; neither is inferred
-- from the other or from a user's profile.
create table public.account_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_locale text not null default 'en' check (
    preferred_locale in ('en', 'nl') or preferred_locale ~ '^(en|nl)-[A-Z]{2}$'
  ),
  region_code text check (
    region_code is null or (
      region_code = pg_catalog.upper(region_code)
      and region_code = any (pg_catalog.string_to_array(
        'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW',
        ' '
      ))
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger account_preferences_set_updated_at
  before update on public.account_preferences
  for each row execute function private.set_updated_at();

alter table public.account_preferences enable row level security;
revoke all on table public.account_preferences from public, anon, authenticated;
grant select on public.account_preferences to authenticated;
grant insert (user_id, preferred_locale, region_code) on public.account_preferences to authenticated;
grant update (preferred_locale, region_code) on public.account_preferences to authenticated;

create policy "owners read their account preferences"
  on public.account_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "owners create their account preferences"
  on public.account_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owners update their account preferences"
  on public.account_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.set_account_locale(p_locale text)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_locale is null or p_locale !~ '^(en|nl)(-[A-Z]{2})?$' then
    raise exception using errcode = '22023', message = 'Unsupported locale';
  end if;

  insert into public.account_preferences(user_id, preferred_locale)
  values (v_user_id, p_locale)
  on conflict (user_id) do update
    set preferred_locale = excluded.preferred_locale;
end;
$function$;

revoke all on function public.set_account_locale(text) from public, anon;
grant execute on function public.set_account_locale(text) to authenticated;

comment on table public.account_preferences is
  'Private account presentation preferences. Locale and region are explicit independent values.';

-- The connection creator is the person whose profile was shared. Snapshot only
-- that person's currently effective, explicitly declared Live Context. No Mode
-- location, account region, browser locale, or inferred location is consulted.
alter table public.connection_encounters
  add column live_context_id_snapshot uuid,
  add column live_context_type_snapshot text,
  add column live_context_label_snapshot text,
  add column live_context_venue_snapshot text,
  add column live_context_city_snapshot text,
  add column live_context_country_code_snapshot text,
  add column live_context_starts_at_snapshot timestamptz,
  add column live_context_expires_at_snapshot timestamptz,
  add column live_context_source_snapshot text;

alter table public.connection_encounters
  add constraint connection_encounters_live_context_type_check
    check (live_context_type_snapshot is null or live_context_type_snapshot in ('event', 'meeting', 'place', 'custom')),
  add constraint connection_encounters_live_context_snapshot_shape_check
    check (
      (live_context_id_snapshot is null
        and live_context_type_snapshot is null
        and live_context_label_snapshot is null
        and live_context_source_snapshot is null)
      or (live_context_id_snapshot is not null
        and live_context_type_snapshot is not null
        and live_context_label_snapshot is not null
        and live_context_source_snapshot is not null)
    ),
  add constraint connection_encounters_live_context_country_check
    check (
      live_context_country_code_snapshot is null or (
        live_context_country_code_snapshot = pg_catalog.upper(live_context_country_code_snapshot)
        and live_context_country_code_snapshot = any (pg_catalog.string_to_array(
          'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW',
          ' '
        ))
      )
    );

grant select (
  live_context_id_snapshot, live_context_type_snapshot, live_context_label_snapshot,
  live_context_venue_snapshot, live_context_city_snapshot, live_context_country_code_snapshot,
  live_context_starts_at_snapshot, live_context_expires_at_snapshot, live_context_source_snapshot
) on public.connection_encounters to authenticated;

create or replace function private.snapshot_live_context_on_encounter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_context public.live_contexts%rowtype;
  v_at timestamptz := coalesce(new.created_at, pg_catalog.statement_timestamp());
begin
  -- Legacy columns represented the sharer's Event Mode, which is presentation
  -- data rather than a meeting context. Keep historical values intact, but do
  -- not write new Mode-derived location guesses into encounter history.
  new.event_name := null;
  new.city := null;
  new.date_label := null;
  new.country_code := null;

  select live_contexts.* into v_context
    from public.live_contexts
   where live_contexts.owner_user_id = new.shared_by_user_id
     and live_contexts.is_active
     and live_contexts.expires_at > v_at
     and (live_contexts.starts_at is null or live_contexts.starts_at <= v_at)
   order by live_contexts.created_at desc
   limit 1;

  if found then
    new.live_context_id_snapshot := v_context.id;
    new.live_context_type_snapshot := v_context.context_type;
    new.live_context_label_snapshot := v_context.label;
    new.live_context_venue_snapshot := v_context.venue;
    new.live_context_city_snapshot := v_context.city;
    new.live_context_country_code_snapshot := v_context.country_code;
    new.live_context_starts_at_snapshot := v_context.starts_at;
    new.live_context_expires_at_snapshot := v_context.expires_at;
    new.live_context_source_snapshot := v_context.source;
  else
    new.live_context_id_snapshot := null;
    new.live_context_type_snapshot := null;
    new.live_context_label_snapshot := null;
    new.live_context_venue_snapshot := null;
    new.live_context_city_snapshot := null;
    new.live_context_country_code_snapshot := null;
    new.live_context_starts_at_snapshot := null;
    new.live_context_expires_at_snapshot := null;
    new.live_context_source_snapshot := null;
  end if;

  return new;
end;
$function$;

revoke all on function private.snapshot_live_context_on_encounter() from public, anon, authenticated;
drop trigger if exists encounters_snapshot_event_country on public.connection_encounters;
create trigger connection_encounters_snapshot_live_context
  before insert on public.connection_encounters
  for each row execute function private.snapshot_live_context_on_encounter();

comment on column public.connection_encounters.live_context_id_snapshot is
  'Original Live Context id for traceability only; deliberately has no foreign key so the snapshot survives context deletion.';
comment on column public.connection_encounters.live_context_type_snapshot is
  'Immutable type copied from the effective Live Context at encounter creation.';
comment on column public.connection_encounters.live_context_label_snapshot is
  'Immutable owner-authored Live Context label copied at encounter creation.';

-- Passport earns event stamps only from explicitly active event contexts.
-- City/country stamps may also use explicit user-confirmed private encounter
-- memory. A meeting/custom label is never treated as a collectible event.
create or replace function private.on_encounter_passport_stamps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_event_label text;
begin
  if new.live_context_type_snapshot = 'event' then
    v_event_label := new.live_context_label_snapshot;
  else
    v_event_label := null;
  end if;

  for v_user_id in
    select connections.user_id
      from public.connections
     where connections.id = new.connection_id
    union
    select connections.connected_user_id
      from public.connections
     where connections.id = new.connection_id
       and connections.connected_user_id is not null
  loop
    perform private.add_passport_context_stamps(
      v_user_id,
      v_event_label,
      new.live_context_city_snapshot,
      new.live_context_country_code_snapshot,
      new.created_at
    );
  end loop;
  return new;
end;
$function$;

revoke all on function private.on_encounter_passport_stamps() from public, anon, authenticated;

create or replace function private.on_context_passport_stamps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_at timestamptz;
begin
  if new.provenance = 'suggested' then
    return new;
  end if;

  select connection_encounters.created_at into v_at
    from public.connection_encounters
   where connection_encounters.id = new.encounter_id;

  perform private.add_passport_context_stamps(
    new.user_id,
    null,
    new.city,
    new.country_code,
    coalesce(v_at, new.created_at)
  );
  return new;
end;
$function$;

revoke all on function private.on_context_passport_stamps() from public, anon, authenticated;
