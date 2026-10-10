-- Setuvara Tap infrastructure.
-- A public Tap token identifies a device; it is never an authentication credential.
-- Only SHA-256 hashes of Tap tokens and claim secrets are persisted. The equipped
-- share state belongs to the identity, so every device follows the same Mode.

create table public.equipped_share_states (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  mode_id uuid not null,
  intent text not null default 'view_profile'
    check (intent in ('view_profile', 'connect_in_person')),
  updated_at timestamptz not null default pg_catalog.now(),
  foreign key (profile_id, mode_id)
    references public.profile_modes(profile_id, id) on delete cascade
);

insert into public.equipped_share_states (profile_id, mode_id, intent)
select profiles.id, profile_modes.id, 'view_profile'
from public.profiles
join public.profile_modes
  on profile_modes.profile_id = profiles.id
 and profile_modes.slug = 'personal'
on conflict (profile_id) do nothing;

comment on table public.equipped_share_states is
  'One identity-wide Equipped Share State followed by every Tap device. Contains no per-device override.';

create table public.tap_devices (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_profile_id uuid references public.profiles(id) on delete cascade,
  token_hash bytea not null unique check (pg_catalog.octet_length(token_hash) = 32),
  claim_secret_hash bytea check (claim_secret_hash is null or pg_catalog.octet_length(claim_secret_hash) = 32),
  label text not null check (pg_catalog.char_length(pg_catalog.btrim(label)) between 1 and 60),
  kind text not null check (kind in ('card', 'ring', 'sticker', 'badge', 'other')),
  status text not null check (status in ('unclaimed', 'active', 'disabled', 'lost', 'retired')),
  claim_expires_at timestamptz,
  claimed_at timestamptz,
  last_tapped_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (owner_profile_id, id),
  check (
    (status = 'unclaimed'
      and owner_profile_id is null
      and claim_secret_hash is not null
      and claim_expires_at is not null
      and claimed_at is null)
    or
    (status <> 'unclaimed'
      and owner_profile_id is not null
      and claim_secret_hash is null
      and claim_expires_at is null
      and claimed_at is not null)
  ),
  check (claim_expires_at is null or
    (claim_expires_at > created_at and claim_expires_at <= created_at + interval '30 days'))
);

create index tap_devices_owner_created_idx
  on public.tap_devices (owner_profile_id, created_at desc)
  where owner_profile_id is not null;

comment on table public.tap_devices is
  'Tap device registry. Stores only SHA-256 hashes for public Tap tokens and one-time claim secrets; no raw token, IP, user agent, or location.';
comment on column public.tap_devices.token_hash is
  'SHA-256 digest of the opaque 256-bit public Tap token; raw token is only returned once by a trusted application API.';
comment on column public.tap_devices.claim_secret_hash is
  'SHA-256 digest of a separate one-time claim secret; cleared atomically when claimed.';

create table public.tap_events (
  id bigint generated always as identity primary key,
  tap_device_id uuid not null references public.tap_devices(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  mode_slug text check (mode_slug is null or mode_slug in ('personal', 'event', 'business')),
  intent text check (intent is null or intent in ('view_profile', 'connect_in_person')),
  outcome text not null check (outcome in ('resolved', 'connect_ready', 'connect_rate_limited', 'unavailable')),
  created_at timestamptz not null default pg_catalog.now(),
  foreign key (owner_profile_id, tap_device_id)
    references public.tap_devices(owner_profile_id, id) on delete cascade
);

create index tap_events_device_created_idx
  on public.tap_events (tap_device_id, created_at desc);
create index tap_events_owner_created_idx
  on public.tap_events (owner_profile_id, created_at desc);

comment on table public.tap_events is
  'Privacy-minimal Tap activity. Does not record raw URLs/tokens, IP addresses, user agents, email, or location.';

alter table public.equipped_share_states enable row level security;
alter table public.tap_devices enable row level security;
alter table public.tap_events enable row level security;
revoke all on table public.equipped_share_states, public.tap_devices, public.tap_events
  from public, anon, authenticated;

create trigger tap_devices_set_updated_at
before update on public.tap_devices
for each row execute function private.set_updated_at();

-- An encounter's source is context only. Authorization is recorded separately
-- and is always rechecked from the live Mode policy and Connection Pass grant.
alter table public.connection_encounters
  add column authorization_method text not null default 'open_mode'
    check (authorization_method in ('open_mode', 'connection_pass'));

update public.connection_encounters
set authorization_method = case
  when source = 'direct_share' then 'connection_pass'
  else 'open_mode'
end;

alter table public.connection_encounters
  drop constraint if exists connection_encounters_source_check,
  add constraint connection_encounters_source_check
    check (source in ('qr', 'link', 'share', 'native_share', 'profile', 'direct', 'direct_share', 'tap'));

comment on column public.connection_encounters.source is
  'Initiation context only (including tap); it never grants authorization.';
comment on column public.connection_encounters.authorization_method is
  'Server-validated authorization path at encounter creation: open_mode or a live Connection Pass.';

alter table public.connection_share_grants
  add column tap_device_id uuid,
  add constraint connection_share_grants_tap_device_owner_fk
    foreign key (profile_id, tap_device_id)
    references public.tap_devices(owner_profile_id, id) on delete cascade;

create index connection_share_grants_tap_device_active_idx
  on public.connection_share_grants (tap_device_id, created_at desc)
  where tap_device_id is not null and revoked_at is null;

-- Shared private resolver for Tap and future Wallet/Quick QR entry paths. It
-- returns only the current identity and its single equipped Mode; it never
-- selects a fallback Mode and is not executable by API roles directly.
create or replace function private.resolve_equipped_share_state(p_profile_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'username', profiles.username,
    'is_published', profiles.is_published,
    'mode_id', profile_modes.id,
    'mode', profile_modes.slug,
    'is_enabled', profile_modes.is_enabled,
    'connect_policy', profile_modes.connect_policy,
    'intent', equipped_share_states.intent
  )
  from public.profiles
  join public.equipped_share_states
    on equipped_share_states.profile_id = profiles.id
  join public.profile_modes
    on profile_modes.profile_id = equipped_share_states.profile_id
   and profile_modes.id = equipped_share_states.mode_id
  where profiles.id = p_profile_id;
$function$;

revoke all on function private.resolve_equipped_share_state(uuid)
  from public, anon, authenticated;

-- Keep legacy direct-share pass behavior intact. Tap-issued passes additionally
-- require the device, publication, selected Mode, and equipped intent to remain
-- valid at the instant a Connection is attempted.
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
        grants.tap_device_id is null
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
      )
  );
$function$;

revoke all on function private.connection_pass_authorizes(uuid, uuid, text)
  from public, anon, authenticated;

-- Future unclaimed stock is provisioned only by an explicitly granted
-- service_role operation. This accepts hashes only; no browser or anon caller
-- can enumerate, claim, or administer unclaimed device records.
create or replace function private.provision_tap_device(
  p_label text,
  p_kind text,
  p_token_hash bytea,
  p_claim_secret_hash bytea,
  p_claim_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_now timestamptz := pg_catalog.statement_timestamp();
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Forbidden';
  end if;
  if p_token_hash is null or pg_catalog.octet_length(p_token_hash) <> 32
     or p_claim_secret_hash is null or pg_catalog.octet_length(p_claim_secret_hash) <> 32
     or p_label is null or pg_catalog.char_length(pg_catalog.btrim(p_label)) not between 1 and 60
     or p_kind is null or p_kind not in ('card', 'ring', 'sticker', 'badge', 'other')
     or p_claim_expires_at is null
     or p_claim_expires_at <= v_now
     or p_claim_expires_at > v_now + interval '30 days' then
    raise exception using errcode = '22023', message = 'Invalid device provisioning request';
  end if;

  insert into public.tap_devices (
    owner_profile_id, token_hash, claim_secret_hash, label, kind, status,
    claim_expires_at, claimed_at, created_at, updated_at
  ) values (
    null, p_token_hash, p_claim_secret_hash, pg_catalog.btrim(p_label), p_kind,
    'unclaimed', p_claim_expires_at, null, v_now, v_now
  ) returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function private.provision_tap_device(text, text, bytea, bytea, timestamptz)
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.provision_tap_device(text, text, bytea, bytea, timestamptz)
  to service_role;

create or replace function public.get_equipped_share_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;

  v_result := private.resolve_equipped_share_state(v_user_id);
  if v_result is null then return null; end if;
  select equipped_share_states.updated_at into v_updated_at
  from public.equipped_share_states
  where equipped_share_states.profile_id = v_user_id;

  return pg_catalog.jsonb_build_object(
    'mode', v_result ->> 'mode',
    'intent', v_result ->> 'intent',
    'updated_at', v_updated_at
  );
end;
$function$;

create or replace function public.set_equipped_share_state(p_mode text, p_intent text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_mode_id uuid;
  v_old_mode_id uuid;
  v_old_intent text;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_mode is null or p_intent is null
     or p_mode not in ('personal', 'event', 'business')
     or p_intent not in ('view_profile', 'connect_in_person') then
    raise exception using errcode = '22023', message = 'Choose an available Mode and intent';
  end if;

  select profile_modes.id into v_mode_id
  from public.profile_modes
  where profile_modes.profile_id = v_user_id
    and profile_modes.slug = p_mode
    and profile_modes.is_enabled
  for share;
  if v_mode_id is null then
    raise exception using errcode = '22023', message = 'Mode unavailable';
  end if;

  select mode_id, intent into v_old_mode_id, v_old_intent
  from public.equipped_share_states
  where profile_id = v_user_id
  for update;

  insert into public.equipped_share_states (profile_id, mode_id, intent, updated_at)
  values (v_user_id, v_mode_id, p_intent, pg_catalog.statement_timestamp())
  on conflict (profile_id) do update
    set mode_id = excluded.mode_id,
        intent = excluded.intent,
        updated_at = excluded.updated_at;

  if v_old_mode_id is distinct from v_mode_id or v_old_intent is distinct from p_intent then
    update public.connection_share_grants
      set revoked_at = pg_catalog.statement_timestamp()
      where profile_id = v_user_id
        and tap_device_id is not null
        and revoked_at is null;
  end if;

  select pg_catalog.jsonb_build_object(
    'mode', profile_modes.slug,
    'intent', equipped_share_states.intent,
    'updated_at', equipped_share_states.updated_at
  ) into v_result
  from public.equipped_share_states
  join public.profile_modes
    on profile_modes.profile_id = equipped_share_states.profile_id
   and profile_modes.id = equipped_share_states.mode_id
  where equipped_share_states.profile_id = v_user_id;

  return v_result;
end;
$function$;

create or replace function public.list_tap_devices()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', tap_devices.id,
    'label', tap_devices.label,
    'kind', tap_devices.kind,
    'status', tap_devices.status,
    'last_tapped_at', tap_devices.last_tapped_at,
    'created_at', tap_devices.created_at
  ) order by tap_devices.created_at desc), '[]'::jsonb)
  into v_result
  from public.tap_devices
  where tap_devices.owner_profile_id = v_user_id;

  return v_result;
end;
$function$;

create or replace function public.create_tap_device(p_label text, p_kind text, p_token_hash bytea)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_now timestamptz := pg_catalog.statement_timestamp();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_token_hash is null or pg_catalog.octet_length(p_token_hash) <> 32
     or p_label is null or pg_catalog.char_length(pg_catalog.btrim(p_label)) not between 1 and 60
     or p_kind is null or p_kind not in ('card', 'ring', 'sticker', 'badge', 'other') then
    raise exception using errcode = '22023', message = 'Invalid device';
  end if;

  insert into public.tap_devices (
    owner_profile_id, token_hash, label, kind, status, claimed_at, created_at, updated_at
  ) values (
    v_user_id, p_token_hash, pg_catalog.btrim(p_label), p_kind, 'active', v_now, v_now, v_now
  ) returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.update_tap_device(p_device_id uuid, p_label text, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_device_id is null
     or p_label is null or pg_catalog.char_length(pg_catalog.btrim(p_label)) not between 1 and 60
     or p_kind is null or p_kind not in ('card', 'ring', 'sticker', 'badge', 'other') then
    raise exception using errcode = '22023', message = 'Invalid device';
  end if;

  update public.tap_devices
    set label = pg_catalog.btrim(p_label), kind = p_kind
    where id = p_device_id and owner_profile_id = v_user_id and status <> 'retired';
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$function$;

create or replace function public.set_tap_device_status(p_device_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_current_status text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_device_id is null or p_status is null
     or p_status not in ('active', 'disabled', 'lost', 'retired') then
    raise exception using errcode = '22023', message = 'Invalid device status';
  end if;

  select status into v_current_status
  from public.tap_devices
  where id = p_device_id and owner_profile_id = v_user_id
  for update;
  if v_current_status is null then return false; end if;
  if v_current_status = 'retired' then return p_status = 'retired'; end if;
  if v_current_status = 'lost' and p_status <> 'retired' then return false; end if;
  if p_status = 'active' and v_current_status <> 'disabled' then
    return v_current_status = 'active';
  end if;

  update public.tap_devices
    set status = p_status
    where id = p_device_id and owner_profile_id = v_user_id;
  return true;
end;
$function$;

create or replace function public.rotate_tap_device(p_device_id uuid, p_token_hash bytea)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_device_id is null or p_token_hash is null or pg_catalog.octet_length(p_token_hash) <> 32 then
    raise exception using errcode = '22023', message = 'Invalid device token';
  end if;

  update public.tap_devices
    set token_hash = p_token_hash, status = 'active'
    where id = p_device_id
      and owner_profile_id = v_user_id
      and status in ('active', 'disabled', 'lost');
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$function$;

create or replace function public.claim_tap_device(p_claim_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_device public.tap_devices%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_claim_secret is null or p_claim_secret !~ '^[A-Za-z0-9_-]{43}$' then
    return null;
  end if;

  select * into v_device
  from public.tap_devices
  where claim_secret_hash = extensions.digest(pg_catalog.convert_to(p_claim_secret, 'UTF8'), 'sha256')
    and status = 'unclaimed'
    and claim_expires_at > pg_catalog.statement_timestamp()
  for update;
  if not found then return null; end if;

  update public.tap_devices
    set owner_profile_id = v_user_id,
        claim_secret_hash = null,
        claim_expires_at = null,
        claimed_at = pg_catalog.statement_timestamp(),
        status = 'active'
  where id = v_device.id;

  return pg_catalog.jsonb_build_object(
    'id', v_device.id,
    'label', v_device.label,
    'kind', v_device.kind,
    'status', 'active'
  );
end;
$function$;

-- Each device follows one identity-wide mode/intent. Resolve only published
-- profiles and enabled selected Modes; no fallback is attempted. When the
-- selected intent is in-person Connect and the Mode is direct_only, this
-- mints/reuses a 15-minute existing Connection Pass tied to this Tap device.
create or replace function public.resolve_tap(
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
  v_device_id uuid;
  v_profile_id uuid;
  v_mode_id uuid;
  v_mode_slug text;
  v_intent text;
  v_connect_policy text;
  v_username text;
  v_pass_token text;
  v_pass_expires_at timestamptz;
  v_candidate text;
  v_count integer;
  v_outcome text := 'resolved';
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_equipped jsonb;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return null; end if;

  select tap_devices.id, tap_devices.owner_profile_id
    into v_device_id, v_profile_id
  from public.tap_devices
  where tap_devices.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    and tap_devices.status = 'active'
    and tap_devices.owner_profile_id is not null
  for update;
  if v_device_id is null then return null; end if;

  -- Lock identity and state before the shared resolver's final read. This
  -- linearizes resolution against publish, Mode, and equipped-state changes.
  perform 1 from public.profiles where id = v_profile_id for share;
  perform 1 from public.equipped_share_states where profile_id = v_profile_id for share;
  v_equipped := private.resolve_equipped_share_state(v_profile_id);
  if v_equipped is not null then
    v_mode_id := (v_equipped ->> 'mode_id')::uuid;
    perform 1 from public.profile_modes
      where profile_id = v_profile_id and id = v_mode_id
      for share;
    v_equipped := private.resolve_equipped_share_state(v_profile_id);
  end if;

  if v_equipped is null
     or v_equipped ->> 'is_published' <> 'true'
     or v_equipped ->> 'is_enabled' <> 'true' then
    v_outcome := 'unavailable';
  else
    v_username := v_equipped ->> 'username';
    v_mode_id := (v_equipped ->> 'mode_id')::uuid;
    v_mode_slug := v_equipped ->> 'mode';
    v_intent := v_equipped ->> 'intent';
    v_connect_policy := v_equipped ->> 'connect_policy';
  end if;

  if v_username is not null and v_intent = 'connect_in_person' and v_connect_policy = 'direct_only' then
    -- Existing cookie values are untrusted candidates. At most 32 are hashed;
    -- reuse is allowed only for a live grant scoped to this exact device,
    -- profile, and currently equipped Mode.
    if coalesce(pg_catalog.array_ndims(p_current_pass_tokens), 0) = 1
       and pg_catalog.cardinality(p_current_pass_tokens) between 1 and 32 then
      foreach v_candidate in array p_current_pass_tokens loop
        if v_candidate ~ '^[A-Za-z0-9_-]{43}$' then
          select grants.expires_at into v_pass_expires_at
          from public.connection_share_grants as grants
          where grants.token_hash = extensions.digest(pg_catalog.convert_to(v_candidate, 'UTF8'), 'sha256')
            and grants.tap_device_id = v_device_id
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
      select pg_catalog.count(*) into v_count
      from public.connection_share_grants as grants
      where grants.tap_device_id = v_device_id
        and grants.created_at > v_now - interval '24 hours';

      if v_count < 100 then
        v_pass_token := pg_catalog.translate(
          pg_catalog.rtrim(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '='),
          '+/', '-_'
        );
        v_pass_expires_at := v_now + interval '15 minutes';
        insert into public.connection_share_grants (
          profile_id, mode_id, token_hash, created_by_user_id,
          tap_device_id, created_at, expires_at
        ) values (
          v_profile_id, v_mode_id,
          extensions.digest(pg_catalog.convert_to(v_pass_token, 'UTF8'), 'sha256'),
          v_profile_id, v_device_id, v_now, v_pass_expires_at
        );
      else
        v_outcome := 'connect_rate_limited';
      end if;
    end if;
    if v_pass_token is not null then v_outcome := 'connect_ready'; end if;
  end if;

  update public.tap_devices
    set last_tapped_at = v_now
    where id = v_device_id;

  -- Keep event volume bounded under repeat hits while storing no visitor data.
  begin
    if not exists (
      select 1 from public.tap_events
      where tap_device_id = v_device_id
        and created_at > v_now - interval '30 seconds'
    ) then
      insert into public.tap_events (
        tap_device_id, owner_profile_id, mode_slug, intent, outcome, created_at
      ) values (
        v_device_id, v_profile_id, v_mode_slug, v_intent,
        case when v_username is null then 'unavailable' else v_outcome end, v_now
      );
    end if;
  exception when others then
    -- Analytics are best-effort and must never block profile resolution.
    null;
  end;

  if v_username is null then return null; end if;
  return pg_catalog.jsonb_build_object(
    'username', v_username,
    'mode', v_mode_slug,
    'intent', v_intent,
    'connection_pass', v_pass_token,
    'pass_expires_at', v_pass_expires_at
  );
end;
$function$;

-- Any device credential/status change invalidates all Tap-minted Connection
-- Passes for that device. Existing non-Tap direct-share passes are untouched.
create or replace function private.revoke_tap_passes_on_device_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.token_hash is distinct from new.token_hash or old.status is distinct from new.status then
    update public.connection_share_grants
      set revoked_at = pg_catalog.statement_timestamp()
      where tap_device_id = new.id and revoked_at is null;
  end if;
  return new;
end;
$function$;

revoke all on function private.revoke_tap_passes_on_device_change() from public, anon, authenticated;
create trigger tap_devices_revoke_passes_on_change
after update of token_hash, status on public.tap_devices
for each row execute function private.revoke_tap_passes_on_device_change();

create or replace function private.revoke_tap_passes_on_unpublish()
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
        and tap_device_id is not null
        and revoked_at is null;
  end if;
  return new;
end;
$function$;

revoke all on function private.revoke_tap_passes_on_unpublish() from public, anon, authenticated;
create trigger profiles_revoke_tap_passes_on_unpublish
after update of is_published on public.profiles
for each row execute function private.revoke_tap_passes_on_unpublish();

create or replace function private.revoke_tap_passes_on_mode_disable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.is_enabled and not new.is_enabled then
    update public.connection_share_grants
      set revoked_at = pg_catalog.statement_timestamp()
      where profile_id = new.profile_id
        and mode_id = new.id
        and tap_device_id is not null
        and revoked_at is null;
  end if;
  return new;
end;
$function$;

revoke all on function private.revoke_tap_passes_on_mode_disable() from public, anon, authenticated;
create trigger profile_modes_revoke_tap_passes_on_disable
after update of is_enabled on public.profile_modes
for each row execute function private.revoke_tap_passes_on_mode_disable();

create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_username text;
  requested_display_name text;
begin
  requested_username := pg_catalog.lower(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_display_name := pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));

  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception using errcode = '23514', message = 'Invalid username';
  end if;
  if pg_catalog.char_length(requested_display_name) not between 1 and 80 then
    requested_display_name := requested_username;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, requested_username, requested_display_name);

  insert into public.profile_modes (profile_id, slug, label, sort_order, appearance)
  values
    (new.id, 'personal', 'Personal', 1, '{"theme":"light","accent":"#FF5A4F","layout":"portrait-editorial","imageTreatment":"portrait"}'::jsonb),
    (new.id, 'event', 'Event', 2, '{"theme":"light","accent":"#FF5A4F","layout":"conference-card","imageTreatment":"portrait"}'::jsonb),
    (new.id, 'business', 'Business', 3, '{"theme":"light","accent":"#FF5A4F","layout":"structured","imageTreatment":"portrait"}'::jsonb);

  insert into public.equipped_share_states (profile_id, mode_id, intent)
  select new.id, profile_modes.id, 'view_profile'
  from public.profile_modes
  where profile_modes.profile_id = new.id and profile_modes.slug = 'personal';

  return new;
end;
$function$;

revoke all on function private.create_profile_for_new_user() from public, anon, authenticated;

-- The Tap route is only source context. A live Connection Pass is still the
-- authorization mechanism for direct_only Modes, and is recorded separately.
drop function public.create_guest_connection(text, text, text, text, text, uuid, text, text);
drop function public.connect_registered(text, text, text, uuid, text, text);

create function public.create_guest_connection(
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
     or p_source not in ('qr', 'link', 'share', 'native_share', 'profile', 'direct', 'tap')
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

  if v_policy = 'direct_only' and private.connection_pass_authorizes(v_target_id, v_mode_id, p_pass_token) then
    v_authorization_method := 'connection_pass';
    if p_source <> 'tap' then v_source := 'direct_share'; end if;
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

create function public.connect_registered(
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
     or p_source not in ('qr', 'link', 'share', 'native_share', 'profile', 'direct', 'tap')
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

  if v_policy = 'direct_only' and private.connection_pass_authorizes(v_target_id, v_mode_id, p_pass_token) then
    v_authorization_method := 'connection_pass';
    if p_source <> 'tap' then v_source := 'direct_share'; end if;
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

revoke all on function public.get_equipped_share_state() from public, anon, authenticated;
revoke all on function public.set_equipped_share_state(text, text) from public, anon, authenticated;
revoke all on function public.list_tap_devices() from public, anon, authenticated;
revoke all on function public.create_tap_device(text, text, bytea) from public, anon, authenticated;
revoke all on function public.update_tap_device(uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_tap_device_status(uuid, text) from public, anon, authenticated;
revoke all on function public.rotate_tap_device(uuid, bytea) from public, anon, authenticated;
revoke all on function public.claim_tap_device(text) from public, anon, authenticated;
revoke all on function public.resolve_tap(text, text[]) from public, anon, authenticated;
revoke all on function public.create_guest_connection(text, text, text, text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.connect_registered(text, text, text, uuid, text, text) from public, anon, authenticated;

grant execute on function public.get_equipped_share_state() to authenticated;
grant execute on function public.set_equipped_share_state(text, text) to authenticated;
grant execute on function public.list_tap_devices() to authenticated;
grant execute on function public.create_tap_device(text, text, bytea) to authenticated;
grant execute on function public.update_tap_device(uuid, text, text) to authenticated;
grant execute on function public.set_tap_device_status(uuid, text) to authenticated;
grant execute on function public.rotate_tap_device(uuid, bytea) to authenticated;
grant execute on function public.claim_tap_device(text) to authenticated;
grant execute on function public.resolve_tap(text, text[]) to anon, authenticated;
grant execute on function public.create_guest_connection(text, text, text, text, text, uuid, text, text) to anon;
grant execute on function public.connect_registered(text, text, text, uuid, text, text) to authenticated;

-- Keep RPC execute grants as the only management path for these private tables.
comment on function public.resolve_tap(text, text[]) is
  'Resolves a random public Tap token to a published identity and its enabled equipped Mode; any returned 15-minute Connection Pass is scoped to that Tap device and current Mode.';
