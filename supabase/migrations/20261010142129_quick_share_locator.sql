-- One stable, identity-scoped Quick Share locator, independent of physical Tap devices.
-- The application derives the public token from a server-only HMAC key and this
-- random nonce. Only the nonce and SHA-256 token hash are persisted here.
create table public.quick_share_locators (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  nonce bytea not null check (pg_catalog.octet_length(nonce) = 32),
  token_hash bytea not null unique check (pg_catalog.octet_length(token_hash) = 32),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (profile_id, id)
);

comment on table public.quick_share_locators is
  'One identity-wide Quick Share locator. Stores a random derivation nonce and public token hash, never the raw URL token.';

alter table public.quick_share_locators enable row level security;
revoke all on table public.quick_share_locators from public, anon, authenticated;

-- Direct-only Quick Share passes are distinguishable from Tap and legacy passes.
-- The composite FK prevents a grant from binding another profile's locator.
alter table public.connection_share_grants
  add column quick_share_locator_id uuid,
  add constraint connection_share_grants_quick_share_owner_fk
    foreign key (profile_id, quick_share_locator_id)
    references public.quick_share_locators(profile_id, id) on delete cascade,
  add constraint connection_share_grants_one_locator_check
    check (tap_device_id is null or quick_share_locator_id is null);

create index connection_share_grants_quick_share_active_idx
  on public.connection_share_grants (quick_share_locator_id, created_at desc)
  where quick_share_locator_id is not null and revoked_at is null;
create index connection_share_grants_profile_quick_share_idx
  on public.connection_share_grants (profile_id, quick_share_locator_id)
  where quick_share_locator_id is not null;
create index connection_share_grants_quick_revoked_idx
  on public.connection_share_grants (quick_share_locator_id, revoked_at)
  where quick_share_locator_id is not null and revoked_at is not null;

-- Existing passes retain their behavior. Quick Share grants additionally need
-- the current locator, published identity, enabled equipped Mode, in-person
-- intent, and Direct-only policy at the moment Connect is checked.
create or replace function private.connection_pass_authorizes(
  p_profile_id uuid,
  p_mode_id uuid,
  p_token text
)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select coalesce(p_token ~ '^[A-Za-z0-9_-]{43}$', false) and exists (
    select 1
    from public.connection_share_grants as grants
    where grants.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
      and grants.profile_id = p_profile_id
      and grants.mode_id = p_mode_id
      and grants.revoked_at is null
      and grants.expires_at > pg_catalog.statement_timestamp()
      and (
        (grants.tap_device_id is null and grants.quick_share_locator_id is null)
        or exists (
          select 1
          from public.tap_devices as devices
          cross join lateral (
            select private.resolve_equipped_share_state(grants.profile_id) as state
          ) as equipped
          where devices.id = grants.tap_device_id
            and devices.owner_profile_id = grants.profile_id
            and devices.status = 'active'
            and equipped.state ->> 'is_published' = 'true'
            and equipped.state ->> 'mode_id' = grants.mode_id::text
            and equipped.state ->> 'intent' = 'connect_in_person'
            and equipped.state ->> 'is_enabled' = 'true'
            and equipped.state ->> 'connect_policy' = 'direct_only'
        )
        or exists (
          select 1
          from public.quick_share_locators as locators
          cross join lateral (
            select private.resolve_equipped_share_state(grants.profile_id) as state
          ) as equipped
          where locators.id = grants.quick_share_locator_id
            and locators.profile_id = grants.profile_id
            and equipped.state ->> 'is_published' = 'true'
            and equipped.state ->> 'mode_id' = grants.mode_id::text
            and equipped.state ->> 'intent' = 'connect_in_person'
            and equipped.state ->> 'is_enabled' = 'true'
            and equipped.state ->> 'connect_policy' = 'direct_only'
        )
      )
  );
$function$;

revoke all on function private.connection_pass_authorizes(uuid, uuid, text)
  from public, anon, authenticated;

-- Owner-only idempotent setup. Repeated calls return the existing locator so
-- the server can rederive the same URL on any signed-in device.
create function public.ensure_quick_share_locator(p_nonce bytea, p_token_hash bytea)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_locator public.quick_share_locators%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_nonce is null or pg_catalog.octet_length(p_nonce) <> 32
     or p_token_hash is null or pg_catalog.octet_length(p_token_hash) <> 32 then
    raise exception using errcode = '22023', message = 'Invalid Quick Share locator';
  end if;

  insert into public.quick_share_locators (profile_id, nonce, token_hash)
  values (v_user_id, p_nonce, p_token_hash)
  on conflict (profile_id) do nothing;

  select * into v_locator
  from public.quick_share_locators
  where profile_id = v_user_id;
  if not found then return null; end if;
  return pg_catalog.jsonb_build_object(
    'id', v_locator.id,
    'nonce', pg_catalog.encode(v_locator.nonce, 'hex'),
    'token_hash', pg_catalog.encode(v_locator.token_hash, 'hex')
  );
end;
$function$;
-- Compare-and-swap rotation prevents a stale tab from replacing a newer URL.
-- The trigger below revokes all Quick-issued Connection Passes on a real change.
create function public.rotate_quick_share_locator(
  p_expected_token_hash bytea,
  p_nonce bytea,
  p_token_hash bytea
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_locator public.quick_share_locators%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_expected_token_hash is null or pg_catalog.octet_length(p_expected_token_hash) <> 32
     or p_nonce is null or pg_catalog.octet_length(p_nonce) <> 32
     or p_token_hash is null or pg_catalog.octet_length(p_token_hash) <> 32
     or p_token_hash = p_expected_token_hash then
    raise exception using errcode = '22023', message = 'Invalid Quick Share rotation';
  end if;

  update public.quick_share_locators
    set nonce = p_nonce,
        token_hash = p_token_hash,
        updated_at = pg_catalog.statement_timestamp()
    where profile_id = v_user_id
      and token_hash = p_expected_token_hash
  returning * into v_locator;
  if not found then return null; end if;
  return pg_catalog.jsonb_build_object(
    'id', v_locator.id,
    'nonce', pg_catalog.encode(v_locator.nonce, 'hex'),
    'token_hash', pg_catalog.encode(v_locator.token_hash, 'hex')
  );
end;
$function$;

-- Public locator resolution follows exactly one current Equipped Share State.
-- The token is a public pointer, never account authentication. A Direct-only
-- pass is short-lived, HttpOnly at the app route, and bound to this locator.
create function public.resolve_quick_share(
  p_token text,
  p_current_pass_tokens text[] default '{}'::text[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_locator_id uuid;
  v_profile_id uuid;
  v_locator_nonce bytea;
  v_mode_id uuid;
  v_mode_slug text;
  v_intent text;
  v_connect_policy text;
  v_username text;
  v_pass_token text;
  v_pass_expires_at timestamptz;
  v_candidate text;
  v_generation bigint;
  v_window bigint;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_equipped jsonb;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return null; end if;

  select locators.id, locators.profile_id, locators.nonce
    into v_locator_id, v_profile_id, v_locator_nonce
  from public.quick_share_locators as locators
  where locators.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
  for update;
  if v_locator_id is null then return null; end if;

  perform 1 from public.profiles where id = v_profile_id for share;
  perform 1 from public.equipped_share_states where profile_id = v_profile_id for share;
  v_equipped := private.resolve_equipped_share_state(v_profile_id);
  if v_equipped is not null then
    v_mode_id := (v_equipped ->> 'mode_id')::uuid;
    perform 1 from public.profile_modes
      where profile_id = v_profile_id and id = v_mode_id for share;
    v_equipped := private.resolve_equipped_share_state(v_profile_id);
  end if;

  if v_equipped is null
     or v_equipped ->> 'is_published' <> 'true'
     or v_equipped ->> 'is_enabled' <> 'true' then
    return null;
  end if;
  v_username := v_equipped ->> 'username';
  v_mode_id := (v_equipped ->> 'mode_id')::uuid;
  v_mode_slug := v_equipped ->> 'mode';
  v_intent := v_equipped ->> 'intent';
  v_connect_policy := v_equipped ->> 'connect_policy';

  if v_intent = 'connect_in_person' and v_connect_policy = 'direct_only' then
    if coalesce(pg_catalog.array_ndims(p_current_pass_tokens), 0) = 1
       and pg_catalog.cardinality(p_current_pass_tokens) between 1 and 32 then
      foreach v_candidate in array p_current_pass_tokens loop
        if v_candidate ~ '^[A-Za-z0-9_-]{43}$' then
          select grants.expires_at into v_pass_expires_at
          from public.connection_share_grants as grants
          where grants.token_hash = extensions.digest(pg_catalog.convert_to(v_candidate, 'UTF8'), 'sha256')
            and grants.quick_share_locator_id = v_locator_id
            and grants.profile_id = v_profile_id
            and grants.mode_id = v_mode_id
            and grants.revoked_at is null
            and grants.expires_at > v_now + interval '1 minute';
          if v_pass_expires_at is not null then
            v_pass_token := v_candidate;
            exit;
          end if;
          v_pass_expires_at := null;
        end if;
      end loop;
    end if;

    if v_pass_token is null then
      -- One pass per locator/window instead of one per anonymous scan. A public
      -- QR cannot exhaust a daily grant quota by requesting without cookies.
      -- Every revocation changes the generation, so policy/equipped changes
      -- cannot resurrect a token issued earlier in the same time window.
      select pg_catalog.count(*) into v_generation
      from public.connection_share_grants as grants
      where grants.quick_share_locator_id = v_locator_id
        and grants.revoked_at is not null;
      v_window := pg_catalog.floor(extract(epoch from v_now) / 900)::bigint;
      v_pass_token := pg_catalog.translate(
        pg_catalog.rtrim(pg_catalog.encode(extensions.hmac(
          pg_catalog.convert_to('setuvara-quick-pass-v1:' || p_token || ':' ||
            v_generation::text || ':' || v_window::text, 'UTF8'),
          v_locator_nonce, 'sha256'
        ), 'base64'), '='), '+/', '-_'
      );
      v_pass_expires_at := v_now + interval '15 minutes';
      insert into public.connection_share_grants (
        profile_id, mode_id, token_hash, created_by_user_id,
        quick_share_locator_id, created_at, expires_at
      ) values (
        v_profile_id, v_mode_id,
        extensions.digest(pg_catalog.convert_to(v_pass_token, 'UTF8'), 'sha256'),
        v_profile_id, v_locator_id, v_now, v_pass_expires_at
      ) on conflict (token_hash) do nothing;
      select grants.expires_at into v_pass_expires_at
      from public.connection_share_grants as grants
      where grants.token_hash = extensions.digest(pg_catalog.convert_to(v_pass_token, 'UTF8'), 'sha256')
        and grants.quick_share_locator_id = v_locator_id
        and grants.profile_id = v_profile_id
        and grants.mode_id = v_mode_id
        and grants.revoked_at is null
        and grants.expires_at > v_now;
      if not found then
        v_pass_token := null;
        v_pass_expires_at := null;
      end if;
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'username', v_username,
    'mode', v_mode_slug,
    'intent', v_intent,
    'connection_pass', v_pass_token,
    'pass_expires_at', v_pass_expires_at
  );
end;
$function$;

-- Rotate, equip, unpublish, and disable invalidate previously issued passes.
create function private.revoke_quick_share_passes_on_rotation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.token_hash is distinct from new.token_hash then
    update public.connection_share_grants
      set revoked_at = pg_catalog.statement_timestamp()
      where quick_share_locator_id = new.id and revoked_at is null;
  end if;
  return new;
end;
$function$;

create trigger quick_share_revoke_passes_on_rotation
after update of token_hash on public.quick_share_locators
for each row execute function private.revoke_quick_share_passes_on_rotation();

create function private.revoke_quick_share_passes_on_equipped_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.mode_id is distinct from new.mode_id or old.intent is distinct from new.intent then
    update public.connection_share_grants
      set revoked_at = pg_catalog.statement_timestamp()
      where profile_id = new.profile_id
        and quick_share_locator_id is not null
        and revoked_at is null;
  end if;
  return new;
end;
$function$;

create trigger equipped_revoke_quick_share_passes_on_change
after update of mode_id, intent on public.equipped_share_states
for each row execute function private.revoke_quick_share_passes_on_equipped_change();

create function private.revoke_quick_share_passes_on_unpublish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.is_published and not new.is_published then
    update public.connection_share_grants
      set revoked_at = pg_catalog.statement_timestamp()
      where profile_id = new.id
        and quick_share_locator_id is not null
        and revoked_at is null;
  end if;
  return new;
end;
$function$;

create trigger profiles_revoke_quick_share_passes_on_unpublish
after update of is_published on public.profiles
for each row execute function private.revoke_quick_share_passes_on_unpublish();

create function private.revoke_quick_share_passes_on_mode_disable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (old.is_enabled and not new.is_enabled)
     or old.connect_policy is distinct from new.connect_policy then
    update public.connection_share_grants
      set revoked_at = pg_catalog.statement_timestamp()
      where profile_id = new.profile_id
        and mode_id = new.id
        and quick_share_locator_id is not null
        and revoked_at is null;
  end if;
  return new;
end;
$function$;

create trigger profile_modes_revoke_quick_share_passes_on_disable
after update of is_enabled, connect_policy on public.profile_modes
for each row execute function private.revoke_quick_share_passes_on_mode_disable();

alter table public.connection_encounters
  drop constraint connection_encounters_source_check,
  add constraint connection_encounters_source_check
    check (source in (
      'qr', 'link', 'share', 'native_share', 'profile', 'direct',
      'direct_share', 'tap', 'quick_qr'
    ));

revoke all on function public.ensure_quick_share_locator(bytea, bytea) from public, anon, authenticated;
revoke all on function public.rotate_quick_share_locator(bytea, bytea, bytea) from public, anon, authenticated;
revoke all on function public.resolve_quick_share(text, text[]) from public, anon, authenticated;
revoke all on function private.revoke_quick_share_passes_on_rotation() from public, anon, authenticated;
revoke all on function private.revoke_quick_share_passes_on_equipped_change() from public, anon, authenticated;
revoke all on function private.revoke_quick_share_passes_on_unpublish() from public, anon, authenticated;
revoke all on function private.revoke_quick_share_passes_on_mode_disable() from public, anon, authenticated;
grant execute on function public.ensure_quick_share_locator(bytea, bytea) to authenticated;
grant execute on function public.rotate_quick_share_locator(bytea, bytea, bytea) to authenticated;
grant execute on function public.resolve_quick_share(text, text[]) to anon, authenticated;

-- The existing guest and registered Connect RPCs are replaced below only to
-- admit quick_qr as source context and preserve it when a pass authorizes.

create or replace function public.create_guest_connection(
  p_target_username text,
  p_target_mode text,
  p_display_name text,
  p_email text,
  p_session_token text,
  p_request_id uuid,
  p_source text default 'direct',
  p_pass_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_target_id uuid;
  v_target_name text;
  v_mode_id uuid;
  v_policy text;
  v_source text := p_source;
  v_authorization_method text := 'open_mode';
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
  if p_target_mode is null or p_source is null
     or p_target_mode not in ('personal', 'event', 'business')
     or p_source not in ('qr', 'link', 'share', 'native_share', 'profile', 'direct', 'tap', 'quick_qr')
     or p_request_id is null
     or p_session_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception using errcode = '22023', message = 'Invalid connection request';
  end if;
  if p_target_username is null or pg_catalog.lower(pg_catalog.btrim(p_target_username)) !~ '^[a-z0-9_]{3,24}$' then
    raise exception using errcode = '22023', message = 'Profile unavailable';
  end if;

  select profiles.id, profiles.display_name, profile_modes.id,
         profile_modes.connect_policy, profile_modes.settings
    into v_target_id, v_target_name, v_mode_id, v_policy, v_mode_settings
  from public.profiles
  join public.profile_modes on profile_modes.profile_id = profiles.id
  where profiles.username = pg_catalog.lower(pg_catalog.btrim(p_target_username))
    and profiles.is_published
    and profile_modes.slug = p_target_mode
    and profile_modes.is_enabled;
  if v_target_id is null then
    raise exception using errcode = '22023', message = 'Profile unavailable';
  end if;

  -- A query string may suggest a channel, but cannot prove a Tap or Quick QR.
  -- Only a live, channel-bound pass may produce verified channel attribution.
  if v_source in ('tap', 'quick_qr') then v_source := 'profile'; end if;
  if v_policy = 'direct_only' and private.connection_pass_authorizes(v_target_id, v_mode_id, p_pass_token) then
    v_authorization_method := 'connection_pass';
    select case
      when grants.quick_share_locator_id is not null then 'quick_qr'
      when grants.tap_device_id is not null then 'tap'
      else 'direct_share'
    end into v_source
    from public.connection_share_grants as grants
    where grants.token_hash = extensions.digest(pg_catalog.convert_to(p_pass_token, 'UTF8'), 'sha256')
      and grants.profile_id = v_target_id and grants.mode_id = v_mode_id;
  elsif v_policy <> 'anyone' then
    raise exception using errcode = '42501', message = 'Connections are not open from this Mode';
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
    if pg_catalog.char_length(v_guest_name) not between 1 and 80
       or v_guest_name ~ '[[:cntrl:]]'
       or pg_catalog.char_length(v_email) > 254
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
    return pg_catalog.jsonb_build_object('connection_id', v_connection_id, 'encounter_id', v_encounter_id, 'created', v_created);
  end if;
  if exists (select 1 from public.connection_encounters where request_id = p_request_id) then
    raise exception using errcode = '22023', message = 'Invalid connection request';
  end if;

  select pg_catalog.count(*) into v_count from public.connection_encounters
  where created_by_guest_id = v_guest_id
    and created_at > pg_catalog.statement_timestamp() - interval '24 hours';
  if v_count >= 25 then
    raise exception using errcode = '22023', message = 'Connection limit reached';
  end if;

  insert into public.connection_encounters (
    connection_id, request_id, created_by_guest_id, shared_by_user_id,
    shared_mode_slug, source, authorization_method, shared_display_name,
    shared_role, shared_company, event_name, city, date_label
  ) values (
    v_connection_id, p_request_id, v_guest_id, v_target_id,
    p_target_mode, v_source, v_authorization_method, v_target_name,
    case when p_target_mode in ('business', 'event') then nullif(v_mode_settings ->> 'role', '') else null end,
    case when p_target_mode = 'business' then nullif(v_mode_settings ->> 'company', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'eventName', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'city', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'dateLabel', '') else null end
  ) returning id into v_encounter_id;

  return pg_catalog.jsonb_build_object('connection_id', v_connection_id, 'encounter_id', v_encounter_id, 'created', v_created);
end;
$function$;
create or replace function public.connect_registered(
  p_target_username text,
  p_target_mode text,
  p_share_back_mode text,
  p_request_id uuid,
  p_source text default 'direct',
  p_pass_token text default null
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
  v_mode_id uuid;
  v_policy text;
  v_source text := p_source;
  v_authorization_method text := 'open_mode';
  v_connection_id uuid;
  v_encounter_id uuid;
  v_created boolean := false;
  v_count integer;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_target_mode is null or p_share_back_mode is null or p_source is null
     or p_target_mode not in ('personal', 'event', 'business')
     or p_share_back_mode not in ('personal', 'event', 'business')
     or p_source not in ('qr', 'link', 'share', 'native_share', 'profile', 'direct', 'tap', 'quick_qr')
     or p_request_id is null
     or p_target_username is null
     or pg_catalog.lower(pg_catalog.btrim(p_target_username)) !~ '^[a-z0-9_]{3,24}$' then
    raise exception using errcode = '22023', message = 'Invalid connection request';
  end if;

  select profiles.id, profiles.display_name into v_target_id, v_target_name
  from public.profiles
  where profiles.username = pg_catalog.lower(pg_catalog.btrim(p_target_username))
    and profiles.is_published;
  if v_target_id is null or v_target_id = v_actor_id then
    raise exception using errcode = '22023', message = 'Profile unavailable';
  end if;

  select profile_modes.id, profile_modes.settings, profile_modes.connect_policy
    into v_mode_id, v_mode_settings, v_policy
  from public.profile_modes
  where profile_modes.profile_id = v_target_id
    and profile_modes.slug = p_target_mode
    and profile_modes.is_enabled;
  if not found then
    raise exception using errcode = '22023', message = 'Mode unavailable';
  end if;

  if v_source in ('tap', 'quick_qr') then v_source := 'profile'; end if;
  if v_policy = 'direct_only' and private.connection_pass_authorizes(v_target_id, v_mode_id, p_pass_token) then
    v_authorization_method := 'connection_pass';
    select case
      when grants.quick_share_locator_id is not null then 'quick_qr'
      when grants.tap_device_id is not null then 'tap'
      else 'direct_share'
    end into v_source
    from public.connection_share_grants as grants
    where grants.token_hash = extensions.digest(pg_catalog.convert_to(p_pass_token, 'UTF8'), 'sha256')
      and grants.profile_id = v_target_id and grants.mode_id = v_mode_id;
  elsif v_policy <> 'anyone' then
    raise exception using errcode = '42501', message = 'Connections are not open from this Mode';
  end if;

  select profile_modes.settings into v_actor_settings
  from public.profile_modes
  where profile_modes.profile_id = v_actor_id
    and profile_modes.slug = p_share_back_mode
    and profile_modes.is_enabled;
  if not found then
    raise exception using errcode = '22023', message = 'Choose an available Mode';
  end if;
  select profiles.display_name into v_actor_name
  from public.profiles where profiles.id = v_actor_id;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(v_target_id::text, v_actor_id::text) || ':' ||
    greatest(v_target_id::text, v_actor_id::text), 0));
  select connections.id into v_connection_id
  from public.connections
  where (connections.user_id = v_target_id and connections.connected_user_id = v_actor_id)
     or (connections.user_id = v_actor_id and connections.connected_user_id = v_target_id)
  for update;
  if v_connection_id is null then
    insert into public.connections (user_id, connected_user_id, user_display_name_snapshot,
      connected_display_name_snapshot)
    values (v_target_id, v_actor_id, v_target_name, v_actor_name)
    on conflict do nothing returning id into v_connection_id;
    v_created := v_connection_id is not null;
    if v_connection_id is null then
      select connections.id into v_connection_id
      from public.connections
      where (connections.user_id = v_target_id and connections.connected_user_id = v_actor_id)
         or (connections.user_id = v_actor_id and connections.connected_user_id = v_target_id)
      for update;
    end if;
  end if;

  select connection_encounters.id into v_encounter_id
  from public.connection_encounters
  where connection_encounters.request_id = p_request_id
    and connection_encounters.connection_id = v_connection_id
    and connection_encounters.created_by_user_id = v_actor_id;
  if v_encounter_id is not null then
    return pg_catalog.jsonb_build_object('connection_id', v_connection_id, 'encounter_id', v_encounter_id, 'created', v_created);
  end if;
  if exists (select 1 from public.connection_encounters where request_id = p_request_id) then
    raise exception using errcode = '22023', message = 'Invalid connection request';
  end if;

  select pg_catalog.count(*) into v_count
  from public.connection_encounters
  where created_by_user_id = v_actor_id
    and created_at > pg_catalog.statement_timestamp() - interval '24 hours';
  if v_count >= 100 then
    raise exception using errcode = '22023', message = 'Connection limit reached';
  end if;

  insert into public.connection_encounters (
    connection_id, request_id, created_by_user_id, shared_by_user_id,
    shared_mode_slug, share_back_mode_slug, share_back_display_name,
    share_back_role, share_back_company, source, authorization_method,
    shared_display_name, shared_role, shared_company, event_name, city,
    date_label, country_code
  ) values (
    v_connection_id, p_request_id, v_actor_id, v_target_id,
    p_target_mode, p_share_back_mode, v_actor_name,
    case when p_share_back_mode in ('business', 'event') then nullif(v_actor_settings ->> 'role', '') else null end,
    case when p_share_back_mode = 'business' then nullif(v_actor_settings ->> 'company', '') else null end,
    v_source, v_authorization_method, v_target_name,
    case when p_target_mode in ('business', 'event') then nullif(v_mode_settings ->> 'role', '') else null end,
    case when p_target_mode = 'business' then nullif(v_mode_settings ->> 'company', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'eventName', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'city', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'dateLabel', '') else null end,
    case when p_target_mode = 'event' and v_mode_settings ->> 'countryCode' ~ '^[A-Z]{2}$'
      then v_mode_settings ->> 'countryCode' else null end
  ) returning id into v_encounter_id;

  return pg_catalog.jsonb_build_object('connection_id', v_connection_id, 'encounter_id', v_encounter_id, 'created', v_created);
end;
$function$;
