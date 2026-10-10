begin;

select no_plan();

-- ---------------------------------------------------------------- Shape and grants

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.equipped_share_states'::regclass),
  'equipped_share_states has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.tap_devices'::regclass),
  'tap_devices has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.tap_events'::regclass),
  'tap_events has RLS enabled'
);

select ok(
  not has_table_privilege(role_name, table_name, privilege_name),
  format('%s has no %s privilege on %s', role_name, privilege_name, table_name)
)
from (values ('anon'::name), ('authenticated'::name)) as roles(role_name)
cross join (values
  ('public.equipped_share_states'::text),
  ('public.tap_devices'::text),
  ('public.tap_events'::text)
) as tables(table_name)
cross join (values ('select'::text), ('insert'::text), ('update'::text), ('delete'::text)) as privileges(privilege_name);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tap_devices'
      and column_name in ('token', 'raw_token', 'secret', 'claim_secret', 'raw_claim_secret')
  ),
  'tap_devices has no plaintext Tap or claim credential columns'
);
select ok(
  has_column_privilege('postgres', 'public.tap_devices', 'token_hash', 'select')
    and has_column_privilege('postgres', 'public.tap_devices', 'claim_secret_hash', 'select'),
  'database stores only hash columns for Tap credentials'
);
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tap_events'
      and column_name in ('ip', 'ip_address', 'user_agent', 'email', 'location', 'city', 'url', 'raw_url', 'token', 'token_hash', 'visitor_id')
  ),
  'Tap events contain no visitor identity, location, URL, or credential fields'
);

select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_catalog.pg_proc where oid = function_name::regprocedure),
  format('%s is SECURITY DEFINER with a locked search_path', function_name)
)
from (values
  ('public.get_equipped_share_state()'::text),
  ('public.set_equipped_share_state(text,text)'::text),
  ('public.list_tap_devices()'::text),
  ('public.create_tap_device(text,text,bytea)'::text),
  ('public.update_tap_device(uuid,text,text)'::text),
  ('public.set_tap_device_status(uuid,text)'::text),
  ('public.rotate_tap_device(uuid,bytea)'::text),
  ('public.claim_tap_device(text)'::text),
  ('public.resolve_tap(text,text[])'::text)
) as functions(function_name);

select ok(has_function_privilege('authenticated', 'public.get_equipped_share_state()', 'execute'), 'authenticated owners can read Equipped Share State through its RPC');
select ok(has_function_privilege('authenticated', 'public.set_equipped_share_state(text,text)', 'execute'), 'authenticated owners can set Equipped Share State through its RPC');
select ok(has_function_privilege('authenticated', 'public.list_tap_devices()', 'execute'), 'authenticated owners can list their own devices through its RPC');
select ok(has_function_privilege('authenticated', 'public.create_tap_device(text,text,bytea)', 'execute'), 'authenticated owners can register a device through its RPC');
select ok(has_function_privilege('authenticated', 'public.update_tap_device(uuid,text,text)', 'execute'), 'authenticated owners can update a device through its RPC');
select ok(has_function_privilege('authenticated', 'public.set_tap_device_status(uuid,text)', 'execute'), 'authenticated owners can change device status through its RPC');
select ok(has_function_privilege('authenticated', 'public.rotate_tap_device(uuid,bytea)', 'execute'), 'authenticated owners can rotate a device through its RPC');
select ok(has_function_privilege('authenticated', 'public.claim_tap_device(text)', 'execute'), 'authenticated owners can claim a device through its RPC');
select ok(has_function_privilege('anon', 'public.resolve_tap(text,text[])', 'execute'), 'anonymous visitors can resolve a public Tap token');
select ok(has_function_privilege('authenticated', 'public.resolve_tap(text,text[])', 'execute'), 'authenticated visitors can resolve a public Tap token');

select ok(
  not has_function_privilege('anon', function_name, 'execute'),
  format('anon cannot execute owner RPC %s', function_name)
)
from (values
  ('public.get_equipped_share_state()'::text),
  ('public.set_equipped_share_state(text,text)'::text),
  ('public.list_tap_devices()'::text),
  ('public.create_tap_device(text,text,bytea)'::text),
  ('public.update_tap_device(uuid,text,text)'::text),
  ('public.set_tap_device_status(uuid,text)'::text),
  ('public.rotate_tap_device(uuid,bytea)'::text),
  ('public.claim_tap_device(text)'::text)
) as functions(function_name);

select ok(not has_function_privilege('anon', 'private.provision_tap_device(text,text,bytea,bytea,timestamptz)', 'execute'), 'anon cannot provision unclaimed stock');
select ok(not has_function_privilege('authenticated', 'private.provision_tap_device(text,text,bytea,bytea,timestamptz)', 'execute'), 'authenticated users cannot provision unclaimed stock');
select ok(has_function_privilege('service_role', 'private.provision_tap_device(text,text,bytea,bytea,timestamptz)', 'execute'), 'only the explicitly trusted service role can provision unclaimed stock');

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select ok(
  private.provision_tap_device(
    'Tap SQL provisioning test', 'card', decode(pg_catalog.repeat('ab', 32), 'hex'),
    decode(pg_catalog.repeat('cd', 32), 'hex'), pg_catalog.statement_timestamp() + interval '7 days'
  ) is not null,
  'trusted service role can provision stock using credential hashes'
);
select throws_ok(
  $$select private.provision_tap_device(
      'Invalid Tap SQL test', 'card', decode(pg_catalog.repeat('ab', 31), 'hex'),
      decode(pg_catalog.repeat('cd', 32), 'hex'), pg_catalog.statement_timestamp() + interval '7 days'
    )$$,
  '22023', 'Invalid device provisioning request',
  'provisioning rejects credential hashes that are not 32 bytes'
);
reset role;
select ok(
  exists (
    select 1 from public.tap_devices
    where label = 'Tap SQL provisioning test'
      and status = 'unclaimed'
      and owner_profile_id is null
      and token_hash = decode(pg_catalog.repeat('ab', 32), 'hex')
      and claim_secret_hash = decode(pg_catalog.repeat('cd', 32), 'hex')
  ),
  'provisioning stores only the supplied hash bytes in an unclaimed device row'
);

-- ---------------------------------------------------------------- Fixtures

create temporary table tap_test_accounts (
  name text primary key,
  user_id uuid not null unique,
  username text not null unique
);
create temporary table tap_test_values (
  name text primary key,
  token text not null,
  new_token text not null,
  token_hash bytea not null,
  new_token_hash bytea not null,
  other_token_hash bytea not null,
  other_rotated_hash bytea not null,
  claim_secret text not null,
  expired_claim_secret text not null,
  device_id uuid,
  other_device_id uuid,
  unclaimed_device_id uuid,
  expired_device_id uuid,
  pass_token text
);
grant select on tap_test_accounts to anon, authenticated;
grant select, update, insert on tap_test_values to anon, authenticated;

insert into tap_test_accounts (name, user_id, username)
select generated.name, generated.user_id,
  'tap_' || generated.name || '_' || pg_catalog.substr(pg_catalog.replace(generated.user_id::text, '-', ''), 1, 8)
from (
  select names.name, pg_catalog.gen_random_uuid() as user_id
  from (values ('owner'), ('other')) as names(name)
) as generated;

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
select user_id, 'authenticated', 'authenticated', username || '@example.test',
  pg_catalog.jsonb_build_object('username', username, 'display_name', initcap(name)),
  pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
from tap_test_accounts;

update public.profiles set is_published = true
where id in (select user_id from tap_test_accounts);
update public.profile_modes set is_enabled = true
where profile_id in (select user_id from tap_test_accounts);
update public.profile_modes set connect_policy = 'direct_only'
where profile_id = (select user_id from tap_test_accounts where name = 'owner')
  and slug = 'personal';
update public.profile_modes set connect_policy = 'nobody'
where profile_id = (select user_id from tap_test_accounts where name = 'owner')
  and slug = 'business';

insert into tap_test_values (
  name, token, new_token, token_hash, new_token_hash, other_token_hash,
  other_rotated_hash, claim_secret, expired_claim_secret
)
values (
  'owner_device',
  pg_catalog.repeat('A', 43),
  pg_catalog.repeat('B', 43),
  extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('A', 43), 'UTF8'), 'sha256'),
  extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('B', 43), 'UTF8'), 'sha256'),
  extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('J', 43), 'UTF8'), 'sha256'),
  extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('K', 43), 'UTF8'), 'sha256'),
  pg_catalog.repeat('C', 43),
  pg_catalog.repeat('D', 43)
);

-- Simulate factory-provisioned devices inside the rollback-only test transaction.
-- The real private provisioning function accepts hashes only and is tested above.
insert into public.tap_devices (
  owner_profile_id, token_hash, claim_secret_hash, label, kind, status,
  claim_expires_at, claimed_at, created_at, updated_at
)
select null,
  extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('E', 43), 'UTF8'), 'sha256'),
  extensions.digest(pg_catalog.convert_to(tap_test_values.claim_secret, 'UTF8'), 'sha256'),
  'Claim fixture', 'card', 'unclaimed', pg_catalog.statement_timestamp() + interval '1 day', null,
  pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
from tap_test_values where name = 'owner_device';

-- Save the generated fixture id without exposing it outside this transaction.
update tap_test_values
set unclaimed_device_id = (
  select id from public.tap_devices
  where token_hash = extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('E', 43), 'UTF8'), 'sha256')
)
where name = 'owner_device';

insert into public.tap_devices (
  owner_profile_id, token_hash, claim_secret_hash, label, kind, status,
  claim_expires_at, claimed_at, created_at, updated_at
)
select null,
  extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('F', 43), 'UTF8'), 'sha256'),
  extensions.digest(pg_catalog.convert_to(tap_test_values.expired_claim_secret, 'UTF8'), 'sha256'),
  'Expired claim fixture', 'sticker', 'unclaimed',
  pg_catalog.statement_timestamp() - interval '1 day', null,
  pg_catalog.statement_timestamp() - interval '3 days', pg_catalog.statement_timestamp() - interval '3 days'
from tap_test_values where name = 'owner_device';

update tap_test_values
set expired_device_id = (
  select id from public.tap_devices
  where token_hash = extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('F', 43), 'UTF8'), 'sha256')
)
where name = 'owner_device';
select ok(
  (select tap_devices.claim_secret_hash = extensions.digest(pg_catalog.convert_to(tap_test_values.claim_secret, 'UTF8'), 'sha256')
   from public.tap_devices
   join tap_test_values on tap_test_values.name = 'owner_device'
   where tap_devices.id = tap_test_values.unclaimed_device_id),
  'factory claim credentials are persisted only as SHA-256 hashes'
);

-- The owner creates a normal active Tap device through the authenticated RPC.
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from tap_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);
update tap_test_values
set device_id = public.create_tap_device(
  'Everyday card', 'card', token_hash
)
where name = 'owner_device';

select is(
  (public.get_equipped_share_state() ->> 'mode'),
  'personal', 'new profiles default to Personal Equipped Share State'
);
select is(
  (public.get_equipped_share_state() ->> 'intent'),
  'view_profile', 'new profiles default to view_profile intent'
);
select is(
  (public.set_equipped_share_state('event', 'view_profile') ->> 'mode'),
  'event', 'owner can equip their enabled Event Mode'
);
select throws_ok(
  $$select public.set_equipped_share_state('missing', 'view_profile')$$,
  '22023', 'Choose an available Mode and intent', 'owner cannot equip an unknown Mode'
);
select throws_ok(
  $$select public.set_equipped_share_state('business', 'unknown')$$,
  '22023', 'Choose an available Mode and intent', 'owner cannot set an unknown Tap intent'
);

select ok((select device_id is not null from tap_test_values where name = 'owner_device'), 'owner creates a Tap device through the RPC');
select matches(
  (select token from tap_test_values where name = 'owner_device'),
  '^[A-Za-z0-9_-]{43}$', 'fixture public Tap credential is a 256-bit base64url token'
);
reset role;
select ok(
  (select token_hash = extensions.digest(pg_catalog.convert_to((select token from tap_test_values where name = 'owner_device'), 'UTF8'), 'sha256')
   from public.tap_devices where id = (select device_id from tap_test_values where name = 'owner_device')),
  'device creation stores only the SHA-256 Tap token hash'
);
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from tap_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);
select is(
  public.update_tap_device((select device_id from tap_test_values where name = 'owner_device'), 'Work card', 'badge'),
  true, 'owner can update their own device label and kind'
);
select ok(
  (public.list_tap_devices() -> 0 ->> 'label') = 'Work card'
    and (public.list_tap_devices() -> 0 ->> 'kind') = 'badge',
  'owner list RPC returns their sanitized device details'
);
select ok(
  not ((public.list_tap_devices() -> 0) ? 'token_hash')
    and not ((public.list_tap_devices() -> 0) ? 'claim_secret_hash')
    and not ((public.list_tap_devices() -> 0) ? 'owner_profile_id'),
  'owner device list omits credentials and internal ownership identifiers'
);

-- An equipped Mode is one identity-wide state. It drives every Tap device.
select is(
  (public.set_equipped_share_state('personal', 'view_profile') ->> 'mode'),
  'personal', 'owner can equip Personal for every device'
);
reset role;

-- ---------------------------------------------------------------- Anonymous resolution and privacy

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (public.resolve_tap((select token from tap_test_values where name = 'owner_device'), '{}'::text[]) ->> 'username'),
  (select username from tap_test_accounts where name = 'owner'),
  'anonymous visitor resolves an active Tap to its published identity'
);
select is(
  (public.resolve_tap((select token from tap_test_values where name = 'owner_device'), '{}'::text[]) ->> 'mode'),
  'personal', 'anonymous Tap resolution uses the equipped Mode'
);
select is(
  (public.resolve_tap((select token from tap_test_values where name = 'owner_device'), '{}'::text[]) ->> 'intent'),
  'view_profile', 'anonymous Tap resolution returns the equipped intent'
);
select is(
  public.resolve_tap('malformed', '{}'::text[]), null::jsonb,
  'malformed Tap credentials resolve safely to unavailable'
);
select is(
  public.resolve_tap(pg_catalog.repeat('E', 43), '{}'::text[]), null::jsonb,
  'an unclaimed stock device is never publicly resolvable'
);
select ok(
  not has_table_privilege('anon', 'public.tap_devices', 'select')
    and not has_table_privilege('anon', 'public.tap_events', 'select')
    and not has_table_privilege('anon', 'public.equipped_share_states', 'select'),
  'anon cannot enumerate devices, events, or Equipped Share State'
);
select throws_ok($$select * from public.tap_devices$$, '42501', null, 'anon cannot read device rows directly');
select throws_ok($$select * from public.tap_events$$, '42501', null, 'anon cannot read activity rows directly');
select throws_ok($$select * from public.equipped_share_states$$, '42501', null, 'anon cannot read Equipped Share State directly');
reset role;

-- ---------------------------------------------------------------- Tap intent and Connection Pass behavior

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from tap_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);

select is(
  (public.set_equipped_share_state('personal', 'connect_in_person') ->> 'intent'),
  'connect_in_person', 'owner can equip Connect in person intent for an enabled Mode'
);
update tap_test_values
set pass_token = public.resolve_tap(token, '{}'::text[]) ->> 'connection_pass'
where name = 'owner_device';
select matches(
  (select pass_token from tap_test_values where name = 'owner_device'),
  '^[A-Za-z0-9_-]{43}$', 'Direct share only Tap resolution provides a short-lived Connection Pass'
);
select ok(
  (public.resolve_tap((select token from tap_test_values where name = 'owner_device'), '{}'::text[]) ->> 'pass_expires_at')::timestamptz
    between pg_catalog.statement_timestamp() + interval '14 minutes'
        and pg_catalog.statement_timestamp() + interval '15 minutes',
  'Tap Connection Pass lifetime is bounded to 15 minutes'
);
reset role;
select ok(
  (select grants.tap_device_id = tap_test_values.device_id
       and grants.token_hash = extensions.digest(pg_catalog.convert_to(tap_test_values.pass_token, 'UTF8'), 'sha256')
       and grants.expires_at <= grants.created_at + interval '15 minutes'
   from public.connection_share_grants as grants
   join tap_test_values on tap_test_values.name = 'owner_device'
   where grants.tap_device_id = tap_test_values.device_id and grants.token_hash = extensions.digest(pg_catalog.convert_to(tap_test_values.pass_token, 'UTF8'), 'sha256')),
  'Tap Connection Pass stores only its hash and is scoped to the exact device'
);
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from tap_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);
select is(
  public.resolve_tap(
    (select token from tap_test_values where name = 'owner_device'),
    array[(select pass_token from tap_test_values where name = 'owner_device')]
  ) ->> 'connection_pass',
  (select pass_token from tap_test_values where name = 'owner_device'),
  'the resolver reuses a valid pass scoped to the same device and Equipped Mode'
);

select is(
  (public.set_equipped_share_state('event', 'connect_in_person') ->> 'mode'),
  'event', 'all devices immediately follow a changed Equipped Mode'
);
select is(
  (public.resolve_tap((select token from tap_test_values where name = 'owner_device'), '{}'::text[]) ->> 'mode'),
  'event', 'public resolution follows the new identity-wide Equipped Mode'
);
select is(
  public.resolve_tap((select token from tap_test_values where name = 'owner_device'), '{}'::text[]) ->> 'connection_pass',
  null::text, 'an anyone Mode needs no Tap Connection Pass'
);

select is(
  (public.set_equipped_share_state('business', 'connect_in_person') ->> 'mode'),
  'business', 'owner can equip Business with Connect in person intent'
);
select is(
  public.resolve_tap((select token from tap_test_values where name = 'owner_device'), '{}'::text[]) ->> 'connection_pass',
  null::text, 'a Nobody Mode never gets a Tap Connection Pass'
);
select is(
  (public.resolve_tap((select token from tap_test_values where name = 'owner_device'), '{}'::text[]) ->> 'mode'),
  'business', 'a Nobody Mode may still resolve to its published profile'
);

-- Disabled selected Modes fail closed; there is no fallback to Personal.
select is((public.set_equipped_share_state('event', 'view_profile') ->> 'mode'), 'event', 'Event remains selected before disabled-mode test');
update public.profile_modes
set is_enabled = false
where profile_id = (select user_id from tap_test_accounts where name = 'owner') and slug = 'event';
select is(
  public.resolve_tap((select token from tap_test_values where name = 'owner_device'), '{}'::text[]),
  null::jsonb, 'disabled selected Mode is unavailable rather than falling back to another Mode'
);
update public.profile_modes
set is_enabled = true
where profile_id = (select user_id from tap_test_accounts where name = 'owner') and slug = 'event';

-- Hidden/unpublished identities are unavailable through Tap.
update public.profiles set is_published = false
where id = (select user_id from tap_test_accounts where name = 'owner');
select is(
  public.resolve_tap((select token from tap_test_values where name = 'owner_device'), '{}'::text[]),
  null::jsonb, 'unpublished identity is unavailable through Tap'
);
update public.profiles set is_published = true
where id = (select user_id from tap_test_accounts where name = 'owner');

-- Device lifecycle and rotation revoke the old credential immediately.
select is(public.set_tap_device_status((select device_id from tap_test_values where name = 'owner_device'), 'disabled'), true, 'owner can disable their own device');
select is(public.resolve_tap((select token from tap_test_values where name = 'owner_device'), '{}'::text[]), null::jsonb, 'disabled device is unavailable');
select is(public.set_tap_device_status((select device_id from tap_test_values where name = 'owner_device'), 'active'), true, 'owner can reactivate a disabled device');
select is(public.rotate_tap_device(
  (select device_id from tap_test_values where name = 'owner_device'),
  (select new_token_hash from tap_test_values where name = 'owner_device')
), true, 'owner can rotate their device credential');
select is(public.resolve_tap((select token from tap_test_values where name = 'owner_device'), '{}'::text[]), null::jsonb, 'old Tap token stops working after rotation');
select is((public.resolve_tap((select new_token from tap_test_values where name = 'owner_device'), '{}'::text[]) ->> 'username'), (select username from tap_test_accounts where name = 'owner'), 'rotated Tap token resolves successfully');
select is(public.set_tap_device_status((select device_id from tap_test_values where name = 'owner_device'), 'lost'), true, 'owner can mark their device lost');
select is(public.resolve_tap((select new_token from tap_test_values where name = 'owner_device'), '{}'::text[]), null::jsonb, 'lost device is unavailable');
select is(public.rotate_tap_device(
  (select device_id from tap_test_values where name = 'owner_device'),
  (select token_hash from tap_test_values where name = 'owner_device')
), true, 'owner can rotate a lost device to recover it');

-- Tap-created passes are revoked when Equipped Share State changes.
select is((public.set_equipped_share_state('personal', 'connect_in_person') ->> 'mode'), 'personal', 'Personal selected for grant revocation test');
update tap_test_values
set pass_token = public.resolve_tap(token, '{}'::text[]) ->> 'connection_pass'
where name = 'owner_device';
select ok((select pass_token is not null from tap_test_values where name = 'owner_device'), 'Tap mints a pass before an identity-wide state change');
select is(
  public.get_connect_access(
    (select username from tap_test_accounts where name = 'owner'),
    'personal', (select pass_token from tap_test_values where name = 'owner_device')
  ), true, 'live Tap pass authorizes Connect for its current Direct share only Mode'
);
update public.profile_modes
set connect_policy = 'direct_only'
where profile_id = (select user_id from tap_test_accounts where name = 'owner')
  and slug = 'event';
select is(
  public.get_connect_access(
    (select username from tap_test_accounts where name = 'owner'),
    'event', (select pass_token from tap_test_values where name = 'owner_device')
  ), false, 'Tap pass cannot authorize a different Mode'
);
update public.profile_modes
set connect_policy = 'anyone'
where profile_id = (select user_id from tap_test_accounts where name = 'owner')
  and slug = 'event';
select is(public.set_tap_device_status((select device_id from tap_test_values where name = 'owner_device'), 'disabled'), true, 'owner can disable a device that has a live Tap pass');
select is(
  public.get_connect_access(
    (select username from tap_test_accounts where name = 'owner'),
    'personal', (select pass_token from tap_test_values where name = 'owner_device')
  ), false, 'disabling a device immediately invalidates its Tap pass'
);
select is(public.set_tap_device_status((select device_id from tap_test_values where name = 'owner_device'), 'active'), true, 'owner can reactivate a disabled Tap device');
select is(
  public.get_connect_access(
    (select username from tap_test_accounts where name = 'owner'),
    'personal', (select pass_token from tap_test_values where name = 'owner_device')
  ), false, 'reactivating a device does not revive its old Tap pass'
);
update tap_test_values
set pass_token = public.resolve_tap(token, '{}'::text[]) ->> 'connection_pass'
where name = 'owner_device';
select ok((select pass_token is not null from tap_test_values where name = 'owner_device'), 'Tap issues a fresh pass while the original Mode and intent are equipped');
select is((public.set_equipped_share_state('personal', 'view_profile') ->> 'mode'), 'personal', 'owner can switch the same Mode to view-only intent');
select is(
  public.get_connect_access(
    (select username from tap_test_accounts where name = 'owner'),
    'personal', (select pass_token from tap_test_values where name = 'owner_device')
  ), false, 'a Tap pass is invalid after its connect intent is no longer equipped'
);
select is((public.set_equipped_share_state('event', 'view_profile') ->> 'mode'), 'event', 'owner can change Equipped Share State');
select is(
  public.get_connect_access(
    (select username from tap_test_accounts where name = 'owner'),
    'personal', (select pass_token from tap_test_values where name = 'owner_device')
  ), false, 'changing Equipped Share State immediately invalidates its old Tap pass'
);
reset role;
select ok(
  (select grants.revoked_at is not null
   from public.connection_share_grants as grants
   join tap_test_values on tap_test_values.name = 'owner_device'
   where grants.tap_device_id = tap_test_values.device_id
     and grants.token_hash = extensions.digest(pg_catalog.convert_to(tap_test_values.pass_token, 'UTF8'), 'sha256')),
  'changing the Equipped Mode or intent revokes Tap-minted passes'
);
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from tap_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);

-- Only valid one-time claim secrets can claim unclaimed stock, and they are cleared.
select is(public.resolve_tap(pg_catalog.repeat('E', 43), '{}'::text[]), null::jsonb, 'unclaimed device remains unavailable until claimed');
select is(
  public.claim_tap_device((select claim_secret from tap_test_values where name = 'owner_device')) ->> 'status',
  'active', 'authenticated owner can claim a valid one-time device secret'
);
reset role;
select ok(
  (select tap_devices.owner_profile_id = (select user_id from tap_test_accounts where name = 'owner')
      and tap_devices.status = 'active'
      and tap_devices.claim_secret_hash is null
      and tap_devices.claim_expires_at is null
      and tap_devices.claimed_at is not null
   from public.tap_devices
   where id = (select unclaimed_device_id from tap_test_values where name = 'owner_device')),
  'claim atomically assigns ownership and clears the one-time claim hash'
);
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from tap_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);
select is(
  public.claim_tap_device((select expired_claim_secret from tap_test_values where name = 'owner_device')),
  null::jsonb, 'expired claim secret fails safely'
);

-- ---------------------------------------------------------------- Second-account isolation

select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from tap_test_accounts where name = 'other'), 'role', 'authenticated'
)::text, true);
select is(
  public.list_tap_devices(), '[]'::jsonb,
  'another authenticated account cannot enumerate the owner devices'
);
update tap_test_values
set other_device_id = public.create_tap_device(
  'Other account card', 'ring', other_token_hash
)
where name = 'owner_device';
select is(
  pg_catalog.jsonb_array_length(public.list_tap_devices()), 1,
  'another account can list its own device without seeing the owner device'
);
select is(
  public.update_tap_device((select device_id from tap_test_values where name = 'owner_device'), 'Hijack', 'ring'),
  false, 'another account cannot update the owner device'
);
select is(
  public.set_tap_device_status((select device_id from tap_test_values where name = 'owner_device'), 'disabled'),
  false, 'another account cannot change the owner device status'
);
select is(
  public.rotate_tap_device(
    (select device_id from tap_test_values where name = 'owner_device'),
    (select other_rotated_hash from tap_test_values where name = 'owner_device')
  ),
  false, 'another account cannot rotate the owner device credential'
);
select is(
  public.claim_tap_device((select claim_secret from tap_test_values where name = 'owner_device')),
  null::jsonb, 'a consumed claim secret cannot be claimed by another account'
);
select is(
  (public.get_equipped_share_state() ->> 'mode'),
  'personal', 'another account reads only its own default Equipped Share State'
);
select is(
  (public.set_equipped_share_state('event', 'view_profile') ->> 'mode'),
  'event', 'another account can set only its own Equipped Share State'
);
select is(
  public.set_tap_device_status((select other_device_id from tap_test_values where name = 'owner_device'), 'retired'),
  true, 'owner can retire their own device'
);
select is(
  public.set_tap_device_status((select other_device_id from tap_test_values where name = 'owner_device'), 'active'),
  false, 'retired device cannot be reactivated'
);
select is(
  public.update_tap_device((select other_device_id from tap_test_values where name = 'owner_device'), 'Again', 'card'),
  false, 'retired device cannot be edited'
);
select is(
  public.rotate_tap_device(
    (select other_device_id from tap_test_values where name = 'owner_device'),
    (select other_rotated_hash from tap_test_values where name = 'owner_device')
  ),
  false, 'retired device cannot be rotated'
);
reset role;

select is(
  (select profile_modes.slug
   from public.equipped_share_states
   join public.profile_modes on profile_modes.id = equipped_share_states.mode_id
     and profile_modes.profile_id = equipped_share_states.profile_id
   where equipped_share_states.profile_id = (select user_id from tap_test_accounts where name = 'owner')),
  'event', 'second-account Equipped Share State update did not alter the owner state'
);

-- ---------------------------------------------------------------- Anon cannot manage/claim, and private activity has no arbitrary writes

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select public.claim_tap_device('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC')$$,
  '42501', null, 'anonymous visitors cannot claim a device'
);
select throws_ok(
  $$insert into public.tap_devices (owner_profile_id, token_hash, label, kind, status, claimed_at)
    values (null, (select token_hash from tap_test_values where name = 'owner_device'), 'Forged', 'card', 'active', now())$$,
  '42501', null, 'anonymous visitors cannot insert devices'
);
select throws_ok(
  $$insert into public.tap_events (tap_device_id, owner_profile_id, outcome)
    values (gen_random_uuid(), gen_random_uuid(), 'resolved')$$,
  '42501', null, 'anonymous visitors cannot forge Tap activity'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from tap_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);
select throws_ok(
  $$insert into public.tap_devices (owner_profile_id, token_hash, label, kind, status, claimed_at)
    values (auth.uid(), (select other_rotated_hash from tap_test_values where name = 'owner_device'), 'Forged', 'card', 'active', now())$$,
  '42501', null, 'authenticated users cannot bypass the device RPCs with direct inserts'
);
select throws_ok(
  $$update public.tap_devices set status = 'disabled' where id = (select device_id from tap_test_values where name = 'owner_device')$$,
  '42501', null, 'authenticated users cannot bypass device lifecycle RPCs with direct updates'
);
select throws_ok(
  $$insert into public.tap_events (tap_device_id, owner_profile_id, outcome)
    values (gen_random_uuid(), auth.uid(), 'resolved')$$,
  '42501', null, 'authenticated users cannot forge Tap activity'
);
select throws_ok($$select * from public.tap_events$$, '42501', null, 'owners cannot directly inspect private raw activity rows');
reset role;

select ok(
  (select pg_catalog.count(*) > 0
   from public.tap_events
   where owner_profile_id = (select user_id from tap_test_accounts where name = 'owner')),
  'successful resolutions produce privacy-minimal server-side activity'
);
select ok(
  (select pg_catalog.bool_and(outcome in ('resolved', 'connect_ready', 'connect_rate_limited', 'unavailable'))
   from public.tap_events
   where owner_profile_id = (select user_id from tap_test_accounts where name = 'owner')),
  'Tap activity stores only a closed outcome set'
);

select * from finish();
rollback;
