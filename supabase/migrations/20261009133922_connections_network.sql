-- Setuvara relationship network. Connections are durable edges; encounters
-- snapshot one share moment. Guest credentials and email remain server-only.

create extension if not exists pgcrypto with schema extensions;

create table public.guest_identities (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  normalized_email text,
  claimed_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (normalized_email is null or normalized_email = lower(btrim(normalized_email)))
);

create index guest_identities_unclaimed_email_idx
  on public.guest_identities (normalized_email)
  where claimed_user_id is null and normalized_email is not null;

create table public.guest_sessions (
  token_hash bytea primary key check (octet_length(token_hash) = 32),
  guest_identity_id uuid not null references public.guest_identities(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index guest_sessions_identity_idx on public.guest_sessions (guest_identity_id);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  connected_user_id uuid references public.profiles(id) on delete cascade,
  guest_identity_id uuid references public.guest_identities(id) on delete restrict,
  user_display_name_snapshot text not null check (char_length(btrim(user_display_name_snapshot)) between 1 and 80),
  connected_display_name_snapshot text not null check (char_length(btrim(connected_display_name_snapshot)) between 1 and 80),
  guest_display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is distinct from connected_user_id),
  check (
    (connected_user_id is not null and guest_identity_id is null and guest_display_name is null)
    or (connected_user_id is null and guest_identity_id is not null
        and guest_display_name is not null
        and char_length(btrim(guest_display_name)) between 1 and 80)
  )
);

create unique index connections_registered_pair_uidx
  on public.connections (least(user_id, connected_user_id), greatest(user_id, connected_user_id))
  where connected_user_id is not null;
create unique index connections_guest_pair_uidx
  on public.connections (user_id, guest_identity_id)
  where guest_identity_id is not null;
create index connections_user_created_idx on public.connections (user_id, created_at desc);
create index connections_connected_user_created_idx on public.connections (connected_user_id, created_at desc)
  where connected_user_id is not null;

create table public.connection_encounters (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  request_id uuid not null unique,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_by_guest_id uuid references public.guest_identities(id) on delete set null,
  shared_by_user_id uuid not null references public.profiles(id) on delete cascade,
  shared_mode_slug text not null check (shared_mode_slug in ('personal', 'event', 'business')),
  share_back_mode_slug text check (share_back_mode_slug in ('personal', 'event', 'business')),
  share_back_display_name text check (share_back_display_name is null or char_length(btrim(share_back_display_name)) between 1 and 80),
  share_back_role text check (share_back_role is null or char_length(share_back_role) <= 80),
  share_back_company text check (share_back_company is null or char_length(share_back_company) <= 100),
  source text not null check (source in ('qr', 'link', 'share', 'native_share', 'profile', 'direct')),
  shared_display_name text not null check (char_length(btrim(shared_display_name)) between 1 and 80),
  shared_role text check (shared_role is null or char_length(shared_role) <= 80),
  shared_company text check (shared_company is null or char_length(shared_company) <= 100),
  event_name text check (event_name is null or char_length(event_name) <= 100),
  city text check (city is null or char_length(city) <= 80),
  date_label text check (date_label is null or char_length(date_label) <= 80),
  created_at timestamptz not null default now(),
  constraint connection_encounters_creator_check
    check (created_by_user_id is null or created_by_guest_id is null),
  check (share_back_mode_slug is not null or created_by_guest_id is not null)
);

create index connection_encounters_connection_created_idx
  on public.connection_encounters (connection_id, created_at desc);
create index connection_encounters_guest_created_idx
  on public.connection_encounters (created_by_guest_id, created_at desc)
  where created_by_guest_id is not null;
create index connection_encounters_user_created_idx
  on public.connection_encounters (created_by_user_id, created_at desc)
  where created_by_user_id is not null;
create index connection_encounters_event_search_idx
  on public.connection_encounters (lower(event_name), lower(city), created_at desc)
  where event_name is not null or city is not null;
create index connection_encounters_person_search_idx
  on public.connection_encounters (lower(shared_display_name), lower(shared_role), lower(shared_company), created_at desc);

create table public.connection_notes (
  connection_id uuid not null references public.connections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (connection_id, user_id)
);

create table public.encounter_context (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.connection_encounters(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  city text check (city is null or char_length(city) <= 80),
  venue text check (venue is null or char_length(venue) <= 120),
  event_label text check (event_label is null or char_length(event_label) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (encounter_id, user_id)
);

create index encounter_context_user_updated_idx on public.encounter_context (user_id, updated_at desc);

create trigger guest_identities_set_updated_at before update on public.guest_identities
for each row execute function private.set_updated_at();
create trigger connections_set_updated_at before update on public.connections
for each row execute function private.set_updated_at();
create trigger connection_notes_set_updated_at before update on public.connection_notes
for each row execute function private.set_updated_at();
create trigger encounter_context_set_updated_at before update on public.encounter_context
for each row execute function private.set_updated_at();

alter table public.guest_identities enable row level security;
alter table public.guest_sessions enable row level security;
alter table public.connections enable row level security;
alter table public.connection_encounters enable row level security;
alter table public.connection_notes enable row level security;
alter table public.encounter_context enable row level security;

revoke all on table public.guest_identities, public.guest_sessions, public.connections,
  public.connection_encounters, public.connection_notes, public.encounter_context
  from public, anon, authenticated;

grant select (id, user_id, connected_user_id, user_display_name_snapshot,
  connected_display_name_snapshot, guest_display_name, created_at, updated_at)
  on public.connections to authenticated;
grant select (id, connection_id, created_by_user_id, shared_by_user_id,
  shared_mode_slug, share_back_mode_slug, share_back_display_name,
  share_back_role, share_back_company, source, shared_display_name,
  shared_role, shared_company, event_name, city, date_label, created_at)
  on public.connection_encounters to authenticated;
grant select, insert, update, delete on public.connection_notes, public.encounter_context to authenticated;

create policy "participants can read connections"
on public.connections for select to authenticated
using ((select auth.uid()) = user_id or (select auth.uid()) = connected_user_id);

create policy "participants can read encounters"
on public.connection_encounters for select to authenticated
using (exists (
  select 1 from public.connections
  where connections.id = connection_encounters.connection_id
    and ((select auth.uid()) = connections.user_id or (select auth.uid()) = connections.connected_user_id)
));

create policy "participants can read their own notes"
on public.connection_notes for select to authenticated
using ((select auth.uid()) = user_id and exists (
  select 1 from public.connections
  where connections.id = connection_notes.connection_id
    and ((select auth.uid()) = connections.user_id or (select auth.uid()) = connections.connected_user_id)
));
create policy "participants can add their own notes"
on public.connection_notes for insert to authenticated
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.connections
  where connections.id = connection_notes.connection_id
    and ((select auth.uid()) = connections.user_id or (select auth.uid()) = connections.connected_user_id)
));
create policy "participants can update their own notes"
on public.connection_notes for update to authenticated
using ((select auth.uid()) = user_id and exists (
  select 1 from public.connections
  where connections.id = connection_notes.connection_id
    and ((select auth.uid()) = connections.user_id or (select auth.uid()) = connections.connected_user_id)
))
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.connections
  where connections.id = connection_notes.connection_id
    and ((select auth.uid()) = connections.user_id or (select auth.uid()) = connections.connected_user_id)
));
create policy "participants can delete their own notes"
on public.connection_notes for delete to authenticated
using ((select auth.uid()) = user_id and exists (
  select 1 from public.connections
  where connections.id = connection_notes.connection_id
    and ((select auth.uid()) = connections.user_id or (select auth.uid()) = connections.connected_user_id)
));

create policy "participants can read their own encounter context"
on public.encounter_context for select to authenticated
using ((select auth.uid()) = user_id and exists (
  select 1 from public.connection_encounters
  join public.connections on connections.id = connection_encounters.connection_id
  where connection_encounters.id = encounter_context.encounter_id
    and ((select auth.uid()) = connections.user_id or (select auth.uid()) = connections.connected_user_id)
));
create policy "participants can add their own encounter context"
on public.encounter_context for insert to authenticated
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.connection_encounters
  join public.connections on connections.id = connection_encounters.connection_id
  where connection_encounters.id = encounter_context.encounter_id
    and ((select auth.uid()) = connections.user_id or (select auth.uid()) = connections.connected_user_id)
));
create policy "participants can update their own encounter context"
on public.encounter_context for update to authenticated
using ((select auth.uid()) = user_id and exists (
  select 1 from public.connection_encounters
  join public.connections on connections.id = connection_encounters.connection_id
  where connection_encounters.id = encounter_context.encounter_id
    and ((select auth.uid()) = connections.user_id or (select auth.uid()) = connections.connected_user_id)
))
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.connection_encounters
  join public.connections on connections.id = connection_encounters.connection_id
  where connection_encounters.id = encounter_context.encounter_id
    and ((select auth.uid()) = connections.user_id or (select auth.uid()) = connections.connected_user_id)
));
create policy "participants can delete their own encounter context"
on public.encounter_context for delete to authenticated
using ((select auth.uid()) = user_id and exists (
  select 1 from public.connection_encounters
  join public.connections on connections.id = connection_encounters.connection_id
  where connection_encounters.id = encounter_context.encounter_id
    and ((select auth.uid()) = connections.user_id or (select auth.uid()) = connections.connected_user_id)
));

-- This SECURITY DEFINER function is a narrow anonymous write endpoint. It
-- validates published profile/mode, locks the guest identity, applies a
-- per-guest daily limit, and returns only opaque relationship IDs.
create or replace function public.get_guest_session_status(p_session_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_name text;
begin
  if p_session_token is null or p_session_token !~ '^[A-Za-z0-9_-]{43}$' then return null; end if;
  select guest_identities.display_name into v_name
  from public.guest_sessions
  join public.guest_identities on guest_identities.id = guest_sessions.guest_identity_id
  where guest_sessions.token_hash = extensions.digest(pg_catalog.convert_to(p_session_token, 'UTF8'), 'sha256')
    and guest_sessions.expires_at > pg_catalog.statement_timestamp()
    and guest_sessions.revoked_at is null
    and guest_identities.claimed_user_id is null;
  if v_name is null then return null; end if;
  return jsonb_build_object('display_name', v_name);
end;
$function$;

create or replace function public.create_guest_connection(
  p_target_username text,
  p_target_mode text,
  p_display_name text,
  p_email text,
  p_session_token text,
  p_request_id uuid,
  p_source text default 'direct'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_target_id uuid;
  v_target_name text;
  v_mode_settings jsonb;
  v_guest_id uuid;
  v_guest_name text;
  v_email text;
  v_hash bytea;
  v_connection_id uuid;
  v_encounter_id uuid;
  v_created boolean := false;
  v_count integer;
begin
  if p_target_mode not in ('personal', 'event', 'business')
     or p_source not in ('qr', 'link', 'share', 'native_share', 'profile', 'direct')
     or p_request_id is null
     or p_session_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception using errcode = '22023', message = 'Invalid connection request';
  end if;
  if p_target_username is null or lower(btrim(p_target_username)) !~ '^[a-z0-9_]{3,24}$' then
    raise exception using errcode = '22023', message = 'Profile unavailable';
  end if;

  select profiles.id, profiles.display_name, profile_modes.settings
    into v_target_id, v_target_name, v_mode_settings
  from public.profiles
  join public.profile_modes on profile_modes.profile_id = profiles.id
  where profiles.username = lower(btrim(p_target_username))
    and profiles.is_published
    and profile_modes.slug = p_target_mode
    and profile_modes.is_enabled;
  if v_target_id is null then
    raise exception using errcode = '22023', message = 'Profile unavailable';
  end if;

  v_hash := extensions.digest(pg_catalog.convert_to(p_session_token, 'UTF8'), 'sha256');
  select guest_sessions.guest_identity_id into v_guest_id
  from public.guest_sessions
  join public.guest_identities on guest_identities.id = guest_sessions.guest_identity_id
  where guest_sessions.token_hash = v_hash
    and guest_sessions.expires_at > pg_catalog.statement_timestamp()
    and guest_sessions.revoked_at is null
    and guest_identities.claimed_user_id is null
  for update of guest_sessions;

  if v_guest_id is null then
    v_guest_name := pg_catalog.btrim(coalesce(p_display_name, ''));
    v_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
    if char_length(v_guest_name) not between 1 and 80
       or v_guest_name ~ '[[:cntrl:]]'
       or char_length(v_email) > 254
       or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
      raise exception using errcode = '22023', message = 'Enter a name and valid email';
    end if;
    insert into public.guest_identities (display_name, normalized_email)
    values (v_guest_name, v_email)
    returning id into v_guest_id;
    insert into public.guest_sessions (token_hash, guest_identity_id)
    values (v_hash, v_guest_id);
  else
    select guest_identities.display_name into v_guest_name
    from public.guest_identities where id = v_guest_id for update;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_target_id::text || ':' || v_guest_id::text, 0));
  select id into v_connection_id from public.connections
  where user_id = v_target_id and guest_identity_id = v_guest_id for update;
  if v_connection_id is null then
    insert into public.connections (user_id, guest_identity_id, user_display_name_snapshot,
      connected_display_name_snapshot, guest_display_name)
    values (v_target_id, v_guest_id, v_target_name, v_guest_name, v_guest_name)
    on conflict (user_id, guest_identity_id) where guest_identity_id is not null do nothing
    returning id into v_connection_id;
    v_created := v_connection_id is not null;
    if v_connection_id is null then
      select id into v_connection_id from public.connections
      where user_id = v_target_id and guest_identity_id = v_guest_id for update;
    end if;
  end if;

  select id into v_encounter_id from public.connection_encounters
  where request_id = p_request_id and connection_id = v_connection_id and created_by_guest_id = v_guest_id;
  if v_encounter_id is not null then
    return jsonb_build_object('connection_id', v_connection_id, 'encounter_id', v_encounter_id, 'created', v_created);
  end if;
  if exists (select 1 from public.connection_encounters where request_id = p_request_id) then
    raise exception using errcode = '22023', message = 'Invalid connection request';
  end if;

  select count(*) into v_count from public.connection_encounters
  where created_by_guest_id = v_guest_id
    and created_at > pg_catalog.statement_timestamp() - interval '24 hours';
  if v_count >= 25 then
    raise exception using errcode = '22023', message = 'Connection limit reached';
  end if;

  insert into public.connection_encounters (
    connection_id, request_id, created_by_guest_id, shared_by_user_id,
    shared_mode_slug, source, shared_display_name, shared_role, shared_company,
    event_name, city, date_label
  ) values (
    v_connection_id, p_request_id, v_guest_id, v_target_id,
    p_target_mode, p_source, v_target_name,
    case when p_target_mode in ('business', 'event') then nullif(v_mode_settings ->> 'role', '') else null end,
    case when p_target_mode = 'business' then nullif(v_mode_settings ->> 'company', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'eventName', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'city', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'dateLabel', '') else null end
  ) returning id into v_encounter_id;

  return jsonb_build_object('connection_id', v_connection_id, 'encounter_id', v_encounter_id, 'created', v_created);
end;
$function$;

create or replace function public.connect_registered(
  p_target_username text,
  p_target_mode text,
  p_share_back_mode text,
  p_request_id uuid,
  p_source text default 'direct'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_target_id uuid;
  v_target_name text;
  v_actor_name text;
  v_actor_settings jsonb;
  v_mode_settings jsonb;
  v_connection_id uuid;
  v_encounter_id uuid;
  v_created boolean := false;
  v_count integer;
begin
  if v_actor_id is null then raise exception using errcode = '42501', message = 'Sign in required'; end if;
  if p_target_mode not in ('personal', 'event', 'business')
     or p_share_back_mode not in ('personal', 'event', 'business')
     or p_source not in ('qr', 'link', 'share', 'native_share', 'profile', 'direct')
     or p_request_id is null
     or p_target_username is null or lower(btrim(p_target_username)) !~ '^[a-z0-9_]{3,24}$' then
    raise exception using errcode = '22023', message = 'Invalid connection request';
  end if;

  select id, display_name into v_target_id, v_target_name from public.profiles
  where username = lower(btrim(p_target_username)) and is_published;
  if v_target_id is null or v_target_id = v_actor_id then
    raise exception using errcode = '22023', message = 'Profile unavailable';
  end if;

  select settings into v_mode_settings from public.profile_modes
  where profile_id = v_target_id and slug = p_target_mode and is_enabled;
  if not found then raise exception using errcode = '22023', message = 'Mode unavailable'; end if;
  select settings into v_actor_settings from public.profile_modes
    where profile_id = v_actor_id and slug = p_share_back_mode and is_enabled;
  if not found then
    raise exception using errcode = '22023', message = 'Choose an available Mode';
  end if;
  select display_name into v_actor_name from public.profiles where id = v_actor_id;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(v_target_id::text, v_actor_id::text) || ':' || greatest(v_target_id::text, v_actor_id::text), 0));
  select id into v_connection_id from public.connections
  where (user_id = v_target_id and connected_user_id = v_actor_id)
     or (user_id = v_actor_id and connected_user_id = v_target_id)
  for update;
  if v_connection_id is null then
    insert into public.connections (user_id, connected_user_id, user_display_name_snapshot,
      connected_display_name_snapshot)
    values (v_target_id, v_actor_id, v_target_name, v_actor_name)
    on conflict do nothing returning id into v_connection_id;
    v_created := v_connection_id is not null;
    if v_connection_id is null then
      select id into v_connection_id from public.connections
      where (user_id = v_target_id and connected_user_id = v_actor_id)
         or (user_id = v_actor_id and connected_user_id = v_target_id)
      for update;
    end if;
  end if;

  select id into v_encounter_id from public.connection_encounters
  where request_id = p_request_id and connection_id = v_connection_id and created_by_user_id = v_actor_id;
  if v_encounter_id is not null then
    return jsonb_build_object('connection_id', v_connection_id, 'encounter_id', v_encounter_id, 'created', v_created);
  end if;
  if exists (select 1 from public.connection_encounters where request_id = p_request_id) then
    raise exception using errcode = '22023', message = 'Invalid connection request';
  end if;
  select count(*) into v_count from public.connection_encounters
  where created_by_user_id = v_actor_id and created_at > pg_catalog.statement_timestamp() - interval '24 hours';
  if v_count >= 100 then raise exception using errcode = '22023', message = 'Connection limit reached'; end if;

  insert into public.connection_encounters (
    connection_id, request_id, created_by_user_id, shared_by_user_id,
    shared_mode_slug, share_back_mode_slug, share_back_display_name,
    share_back_role, share_back_company, source, shared_display_name,
    shared_role, shared_company, event_name, city, date_label
  ) values (
    v_connection_id, p_request_id, v_actor_id, v_target_id,
    p_target_mode, p_share_back_mode, v_actor_name,
    case when p_share_back_mode in ('business', 'event') then nullif(v_actor_settings ->> 'role', '') else null end,
    case when p_share_back_mode = 'business' then nullif(v_actor_settings ->> 'company', '') else null end,
    p_source, v_target_name,
    case when p_target_mode in ('business', 'event') then nullif(v_mode_settings ->> 'role', '') else null end,
    case when p_target_mode = 'business' then nullif(v_mode_settings ->> 'company', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'eventName', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'city', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'dateLabel', '') else null end
  ) returning id into v_encounter_id;

  return jsonb_build_object('connection_id', v_connection_id, 'encounter_id', v_encounter_id, 'created', v_created);
end;
$function$;

create or replace function public.get_registered_connection_state(p_target_username text, p_target_mode text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_target_id uuid;
  v_connection_id uuid;
  v_encounter jsonb;
begin
  if v_actor_id is null or p_target_mode not in ('personal', 'event', 'business') then return null; end if;
  select id into v_target_id from public.profiles where username = lower(btrim(p_target_username)) and is_published;
  if v_target_id is null or v_target_id = v_actor_id then return null; end if;
  if not exists (select 1 from public.profile_modes where profile_id = v_target_id and slug = p_target_mode and is_enabled) then return null; end if;
  select id into v_connection_id from public.connections
  where (user_id = v_target_id and connected_user_id = v_actor_id)
     or (user_id = v_actor_id and connected_user_id = v_target_id);
  if v_connection_id is null then return null; end if;
  select jsonb_build_object('mode', shared_mode_slug, 'event', event_name, 'city', city, 'dateLabel', date_label)
    into v_encounter from public.connection_encounters
    where connection_id = v_connection_id and shared_mode_slug = p_target_mode
    order by created_at desc limit 1;
  return jsonb_build_object('connection_id', v_connection_id, 'context', v_encounter);
end;
$function$;

create or replace function public.get_guest_connection_state(
  p_target_username text, p_target_mode text, p_session_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_guest_id uuid;
  v_target_id uuid;
  v_connection_id uuid;
  v_encounter jsonb;
begin
  if p_session_token is null or p_session_token !~ '^[A-Za-z0-9_-]{43}$'
     or p_target_mode not in ('personal', 'event', 'business') then return null; end if;
  select guest_sessions.guest_identity_id into v_guest_id
  from public.guest_sessions join public.guest_identities on guest_identities.id = guest_sessions.guest_identity_id
  where guest_sessions.token_hash = extensions.digest(pg_catalog.convert_to(p_session_token, 'UTF8'), 'sha256')
    and guest_sessions.expires_at > pg_catalog.statement_timestamp()
    and guest_sessions.revoked_at is null and guest_identities.claimed_user_id is null;
  if v_guest_id is null then return null; end if;
  select id into v_target_id from public.profiles where username = lower(btrim(p_target_username)) and is_published;
  if v_target_id is null or not exists (select 1 from public.profile_modes
    where profile_id = v_target_id and slug = p_target_mode and is_enabled) then return null; end if;
  select id into v_connection_id from public.connections
  where user_id = v_target_id and guest_identity_id = v_guest_id;
  if v_connection_id is null then return null; end if;
  select jsonb_build_object('mode', shared_mode_slug, 'event', event_name, 'city', city, 'dateLabel', date_label)
    into v_encounter from public.connection_encounters
    where connection_id = v_connection_id and shared_mode_slug = p_target_mode
    order by created_at desc limit 1;
  return jsonb_build_object('connection_id', v_connection_id, 'context', v_encounter);
end;
$function$;

create or replace function public.get_guest_connection_detail(p_connection_id uuid, p_session_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_guest_id uuid;
  v_result jsonb;
begin
  if p_session_token is null or p_session_token !~ '^[A-Za-z0-9_-]{43}$' then return null; end if;
  select guest_sessions.guest_identity_id into v_guest_id
  from public.guest_sessions join public.guest_identities on guest_identities.id = guest_sessions.guest_identity_id
  where guest_sessions.token_hash = extensions.digest(pg_catalog.convert_to(p_session_token, 'UTF8'), 'sha256')
    and guest_sessions.expires_at > pg_catalog.statement_timestamp()
    and guest_sessions.revoked_at is null and guest_identities.claimed_user_id is null;
  if v_guest_id is null then return null; end if;
  select jsonb_build_object(
    'connection_id', connections.id,
    'profile_name', connections.user_display_name_snapshot,
    'encounters', coalesce((select jsonb_agg(jsonb_build_object(
      'id', e.id, 'mode', e.shared_mode_slug, 'event', e.event_name,
      'city', e.city, 'dateLabel', e.date_label, 'created_at', e.created_at
    ) order by e.created_at desc) from public.connection_encounters e where e.connection_id = connections.id), '[]'::jsonb)
  ) into v_result
  from public.connections where connections.id = p_connection_id
    and connections.guest_identity_id = v_guest_id;
  return v_result;
end;
$function$;

-- Reconciliation uses auth.uid() and the confirmed email in auth.users only;
-- there is intentionally no caller-supplied identity/email parameter.
create or replace function public.claim_guest_connections(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_guest_id uuid;
  v_connection record;
  v_existing_id uuid;
  v_count integer := 0;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Sign in required'; end if;
  if p_session_token is null or p_session_token !~ '^[A-Za-z0-9_-]{43}$' then
    return jsonb_build_object('claimed_connections', 0);
  end if;
  select lower(btrim(email)) into v_email from auth.users
  where id = v_user_id and email_confirmed_at is not null;
  if v_email is null then raise exception using errcode = '42501', message = 'Verified email required'; end if;

  select guest_identities.id into v_guest_id
  from public.guest_sessions
  join public.guest_identities on guest_identities.id = guest_sessions.guest_identity_id
  where guest_sessions.token_hash = extensions.digest(pg_catalog.convert_to(p_session_token, 'UTF8'), 'sha256')
    and guest_sessions.expires_at > pg_catalog.statement_timestamp()
    and guest_sessions.revoked_at is null
    and guest_identities.claimed_user_id is null
    and guest_identities.normalized_email = v_email
  for update of guest_identities;
  if v_guest_id is null then return jsonb_build_object('claimed_connections', 0); end if;

    for v_connection in select id, user_id from public.connections
      where guest_identity_id = v_guest_id for update
    loop
      if v_connection.user_id = v_user_id then
        delete from public.connections where id = v_connection.id;
      else
        select id into v_existing_id from public.connections
        where (user_id = v_connection.user_id and connected_user_id = v_user_id)
           or (user_id = v_user_id and connected_user_id = v_connection.user_id)
        for update;
        if v_existing_id is not null then
          update public.connection_encounters set connection_id = v_existing_id where connection_id = v_connection.id;
          insert into public.connection_notes (connection_id, user_id, note, created_at, updated_at)
            select v_existing_id, user_id, note, created_at, updated_at
            from public.connection_notes where connection_id = v_connection.id
            on conflict (connection_id, user_id) do nothing;
          delete from public.connections where id = v_connection.id;
        else
          update public.connections set connected_user_id = v_user_id,
            guest_identity_id = null, guest_display_name = null
          where id = v_connection.id;
        end if;
        v_count := v_count + 1;
      end if;
    end loop;
    update public.guest_sessions set revoked_at = pg_catalog.statement_timestamp()
      where guest_identity_id = v_guest_id and revoked_at is null;
    update public.guest_identities set claimed_user_id = v_user_id, normalized_email = null
      where id = v_guest_id;
  return jsonb_build_object('claimed_connections', v_count);
end;
$function$;

revoke all on function public.create_guest_connection(text, text, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.connect_registered(text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.get_registered_connection_state(text, text) from public, anon, authenticated;
revoke all on function public.get_guest_connection_state(text, text, text) from public, anon, authenticated;
revoke all on function public.get_guest_connection_detail(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_guest_connections(text) from public, anon, authenticated;
revoke all on function public.get_guest_session_status(text) from public, anon, authenticated;
grant execute on function public.create_guest_connection(text, text, text, text, text, uuid, text) to anon;
grant execute on function public.connect_registered(text, text, text, uuid, text) to authenticated;
grant execute on function public.get_registered_connection_state(text, text) to authenticated;
grant execute on function public.get_guest_connection_state(text, text, text) to anon;
grant execute on function public.get_guest_connection_detail(uuid, text) to anon;
grant execute on function public.claim_guest_connections(text) to authenticated;
grant execute on function public.get_guest_session_status(text) to anon;

comment on table public.guest_identities is 'Private guest identity and normalized email used only for guest-session continuity and verified account claiming.';
comment on table public.guest_sessions is 'Private opaque guest sessions; only SHA-256 hashes of random browser tokens are stored.';
comment on table public.connections is 'One persistent relationship edge per registered-user pair or profile-owner/guest pair.';
comment on table public.connection_encounters is 'Immutable share/meeting snapshots; repeated connects append encounters to the same Connection.';
comment on table public.connection_notes is 'Private notes owned by one authenticated participant per Connection.';
comment on table public.encounter_context is 'Private Where You Met context owned by one participant per Encounter.';
