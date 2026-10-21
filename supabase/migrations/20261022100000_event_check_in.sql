-- Event Mode 2.0 slice 2: door check-in, and guests who chose it become Connections.
-- A confirmed guest shows a signed pass from their private link; the organizer opens it (or ticks
-- the guest list) and checks them in. A Setuvara member who asked to connect is then connected with
-- the organizer, and the event itself is the encounter's "where you met": its title, venue, city and
-- time are snapshotted like a Live Context, so Passport and the Connection page read it as such.

-- 1. Check-in state on the registration. Connecting is the guest's choice, off unless they ask.
alter table public.event_registrations
  add column checked_in_at timestamptz,
  add column connect_on_check_in boolean not null default false,
  add column connection_id uuid references public.connections(id) on delete set null;
create index event_registrations_connection_idx on public.event_registrations (connection_id) where connection_id is not null;
create index event_registrations_checked_in_idx on public.event_registrations (event_id) where checked_in_at is not null;
grant select (checked_in_at, connect_on_check_in, connection_id) on public.event_registrations to authenticated;

-- 2. Encounters can come from an event check-in. Source is context only; the authorization path is
-- the guest's own registration and choice, recorded as such.
alter table public.connection_encounters
  add column event_id uuid references public.events(id) on delete set null,
  add constraint connection_encounters_event_source_check check (event_id is null or source = 'event_check_in');
create index connection_encounters_event_idx on public.connection_encounters (event_id) where event_id is not null;
alter table public.connection_encounters
  drop constraint connection_encounters_source_check,
  add constraint connection_encounters_source_check
    check (source in (
      'qr', 'link', 'share', 'native_share', 'profile', 'direct',
      'direct_share', 'tap', 'quick_qr', 'event_check_in'
    )),
  drop constraint connection_encounters_authorization_method_check,
  add constraint connection_encounters_authorization_method_check
    check (authorization_method in ('open_mode', 'connection_pass', 'event_registration'));
comment on column public.connection_encounters.event_id is
  'The Setuvara event whose check-in created this encounter; context only.';

-- Analytics keeps its closed source list; a check-in counts as other.
create or replace function private.analytics_connection_source(p_source text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case when p_source = 'direct_share' then 'tap' when p_source = 'event_check_in' then 'other' else p_source end
$function$;
revoke all on function private.analytics_connection_source(text) from public, anon, authenticated, service_role;

-- 3. The meeting snapshot. Unchanged for every other source; a check-in snapshots its event,
-- which the organizer declared, instead of whatever Live Context happens to be active.
create or replace function private.snapshot_live_context_on_encounter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_context public.live_contexts%rowtype;
  v_event public.events%rowtype;
  v_at timestamptz := coalesce(new.created_at, pg_catalog.statement_timestamp());
begin
  -- Legacy columns represented the sharer's Event Mode, which is presentation
  -- data rather than a meeting context. Keep historical values intact, but do
  -- not write new Mode-derived location guesses into encounter history.
  new.event_name := null;
  new.city := null;
  new.date_label := null;
  new.country_code := null;

  if new.source = 'event_check_in' and new.event_id is not null then
    select events.* into v_event from public.events where events.id = new.event_id;
    if found then
      new.live_context_id_snapshot := v_event.id;
      new.live_context_type_snapshot := 'event';
      new.live_context_label_snapshot := v_event.title;
      new.live_context_venue_snapshot := nullif(pg_catalog.btrim(v_event.venue_name), '');
      new.live_context_city_snapshot := nullif(pg_catalog.btrim(v_event.city), '');
      new.live_context_country_code_snapshot := case when v_event.country_code = any (pg_catalog.string_to_array(
        'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW',
        ' ')) then v_event.country_code end;
      new.live_context_starts_at_snapshot := v_event.starts_at;
      new.live_context_expires_at_snapshot := v_event.ends_at;
      new.live_context_source_snapshot := 'setuvara_event';
      return new;
    end if;
  end if;

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

-- 4. Connect one checked-in guest with the organizer, once. Only a member guest who chose it;
-- an existing Connection gets the event as a new encounter. Returns the Connection, or null.
create function private.connect_checked_in_guest(p_registration_id uuid)
returns uuid language plpgsql security definer set search_path='' as $function$
declare
  r public.event_registrations;
  e public.events;
  v_owner_name text;
  v_guest_name text;
  v_guest_mode text;
  v_role text;
  v_connection_id uuid;
begin
  select * into r from public.event_registrations where id = p_registration_id for update;
  if not found or r.status <> 'confirmed' or r.checked_in_at is null or not r.connect_on_check_in
     or r.attendee_user_id is null or r.connection_id is not null then
    return r.connection_id;
  end if;
  select * into e from public.events where id = r.event_id;
  if e.status <> 'published' or r.attendee_user_id = e.profile_id then return null; end if;

  select nullif(pg_catalog.btrim(p.display_name), '') into v_owner_name from public.profiles p where p.id = e.profile_id;
  select nullif(pg_catalog.btrim(p.display_name), '') into v_guest_name from public.profiles p where p.id = r.attendee_user_id;
  if not found then return null; end if;
  v_owner_name := pg_catalog.left(coalesce(v_owner_name, 'Organizer'), 80);
  v_guest_name := pg_catalog.left(coalesce(v_guest_name, r.name), 80);
  -- The guest is introduced with an enabled Mode of theirs, Personal first.
  select m.slug into v_guest_mode from public.profile_modes m
    where m.profile_id = r.attendee_user_id and m.is_enabled and m.slug in ('personal', 'event', 'business', 'creator')
    order by m.slug <> 'personal', m.slug limit 1;
  if v_guest_mode is null then return null; end if;
  select nullif(m.settings ->> 'role', '') into v_role from public.profile_modes m where m.id = e.mode_id;

  -- Same pair lock as connect_registered, so a check-in and a scan never make two edges.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(e.profile_id::text, r.attendee_user_id::text) || ':' ||
    greatest(e.profile_id::text, r.attendee_user_id::text), 0));
  select c.id into v_connection_id from public.connections c
    where (c.user_id = e.profile_id and c.connected_user_id = r.attendee_user_id)
       or (c.user_id = r.attendee_user_id and c.connected_user_id = e.profile_id)
    for update;
  if v_connection_id is null then
    insert into public.connections (user_id, connected_user_id, user_display_name_snapshot, connected_display_name_snapshot)
    values (e.profile_id, r.attendee_user_id, v_owner_name, v_guest_name)
    returning id into v_connection_id;
  end if;

  -- The registration id is the request id, so this encounter can only ever be written once.
  insert into public.connection_encounters (
    connection_id, request_id, created_by_user_id, shared_by_user_id,
    shared_mode_slug, share_back_mode_slug, share_back_display_name,
    source, authorization_method, shared_display_name, shared_role, event_id
  ) values (
    v_connection_id, r.id, r.attendee_user_id, e.profile_id,
    'event', v_guest_mode, v_guest_name,
    'event_check_in', 'event_registration', v_owner_name, pg_catalog.left(v_role, 80), e.id
  ) on conflict (request_id) do nothing;
  update public.event_registrations set connection_id = v_connection_id where id = r.id;
  return v_connection_id;
end;
$function$;

-- Check-in opens 12 hours before the start and stays open until 12 hours after the end.
create function private.event_check_in_window(e public.events, p_now timestamptz)
returns text language sql stable set search_path='' as $function$
  select case
    when e.status <> 'published' then 'closed'
    when p_now < e.starts_at - interval '12 hours' then 'soon'
    when p_now > e.ends_at + interval '12 hours' then 'closed'
    else 'open' end
$function$;

-- 5. The organizer checks a guest in, or takes it back. Taking it back keeps any Connection made:
-- that edge belongs to both people now.
create function public.owner_check_in_event_registration(p_registration_id uuid, p_checked_in boolean)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  r public.event_registrations;
  e public.events;
  v_now timestamptz := pg_catalog.statement_timestamp();
begin
  if p_checked_in is null then raise exception using errcode='22023', message='invalid_request'; end if;
  select * into r from public.event_registrations where id = p_registration_id and profile_id = (select auth.uid());
  if not found then raise exception using errcode='P0002', message='registration_not_found'; end if;
  select * into e from public.events where id = r.event_id for update;
  select * into r from public.event_registrations where id = p_registration_id for update;
  if e.status = 'cancelled' then raise exception using errcode='P0002', message='event_cancelled'; end if;
  case private.event_check_in_window(e, v_now)
    when 'soon' then raise exception using errcode='P0001', message='check_in_not_open';
    when 'closed' then raise exception using errcode='P0001', message='check_in_closed';
    else null;
  end case;
  if r.status <> 'confirmed' then raise exception using errcode='P0001', message='guest_not_going'; end if;

  if p_checked_in then
    if r.checked_in_at is null then update public.event_registrations set checked_in_at = v_now where id = r.id; end if;
    perform private.connect_checked_in_guest(r.id);
  elsif r.checked_in_at is not null then
    update public.event_registrations set checked_in_at = null where id = r.id;
  end if;
  select * into r from public.event_registrations where id = p_registration_id;
  return jsonb_build_object('id', r.id, 'checked_in_at', r.checked_in_at, 'connected', r.connection_id is not null);
end;
$function$;

-- 6. A member guest says whether to connect at check-in, from their signed link (checked by the app;
-- the version is checked here). Saying yes after check-in connects straight away.
create function public.set_event_connect_preference(p_registration_id uuid, p_token_version smallint, p_connect boolean)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  r public.event_registrations;
begin
  if p_connect is null then raise exception using errcode='22023', message='invalid_request'; end if;
  select * into r from public.event_registrations where id = p_registration_id and token_version = p_token_version for update;
  if not found then raise exception using errcode='P0002', message='registration_not_found'; end if;
  if r.attendee_user_id is null then raise exception using errcode='22023', message='not_a_member'; end if;
  if r.status = 'cancelled' then raise exception using errcode='P0002', message='registration_cancelled'; end if;
  update public.event_registrations set connect_on_check_in = p_connect where id = r.id;
  if p_connect then perform private.connect_checked_in_guest(r.id); end if;
  select * into r from public.event_registrations where id = p_registration_id;
  return jsonb_build_object('connect', r.connect_on_check_in, 'connected', r.connection_id is not null);
end;
$function$;

-- 7. The guest's own registration, now with check-in and connect state.
create or replace function public.get_event_registration(p_registration_id uuid, p_token_version smallint)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('id', r.id, 'event_id', r.event_id, 'short_id', e.short_id, 'name', r.name, 'email', r.email, 'status', r.status,
    'created_at', r.created_at, 'cancelled_at', r.cancelled_at, 'cancelled_by', r.cancelled_by,
    'member', r.attendee_user_id is not null, 'connect_on_check_in', r.connect_on_check_in,
    'checked_in_at', r.checked_in_at, 'connected', r.connection_id is not null,
    'check_in', private.event_check_in_window(e, pg_catalog.statement_timestamp()))
  from public.event_registrations r join public.events e on e.id = r.event_id
  where r.id = p_registration_id and r.token_version = p_token_version
$function$;

revoke all on function private.connect_checked_in_guest(uuid), private.event_check_in_window(public.events, timestamptz)
  from public, anon, authenticated;
revoke all on function public.owner_check_in_event_registration(uuid, boolean), public.set_event_connect_preference(uuid, smallint, boolean)
  from public, anon, authenticated;
grant execute on function public.owner_check_in_event_registration(uuid, boolean) to authenticated;
grant execute on function public.set_event_connect_preference(uuid, smallint, boolean) to service_role;

comment on column public.event_registrations.connect_on_check_in is
  'The member guest chose to connect with the organizer when checked in. Off unless they ask.';
