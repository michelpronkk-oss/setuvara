begin;

select no_plan();

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.quick_share_locators'::regclass),
  'Quick Share locators have RLS enabled'
);
select ok(
  not has_table_privilege(role_name, 'public.quick_share_locators', privilege_name),
  format('%s cannot %s Quick Share locator rows', role_name, privilege_name)
)
from (values ('anon'::name), ('authenticated'::name)) as roles(role_name)
cross join (values ('select'::text), ('insert'::text), ('update'::text), ('delete'::text)) as privileges(privilege_name);
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'quick_share_locators'
      and column_name in ('token', 'raw_token', 'url', 'raw_url', 'secret')
  ),
  'the locator table stores no raw URL token'
);
select ok(
  (select convalidated from pg_catalog.pg_constraint
   where conname = 'connection_share_grants_one_locator_check'),
  'a Connection Pass cannot be bound to both Quick Share and a Tap device'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_catalog.pg_proc where oid = function_name::regprocedure),
  format('%s is SECURITY DEFINER with locked search_path', function_name)
)
from (values
  ('public.ensure_quick_share_locator(bytea,bytea)'::text),
  ('public.rotate_quick_share_locator(bytea,bytea,bytea)'::text),
  ('public.resolve_quick_share(text,text[])'::text),
  ('private.revoke_quick_share_passes_on_rotation()'::text),
  ('private.revoke_quick_share_passes_on_equipped_change()'::text),
  ('private.revoke_quick_share_passes_on_unpublish()'::text),
  ('private.revoke_quick_share_passes_on_mode_disable()'::text)
) as functions(function_name);
select ok(has_function_privilege('authenticated', 'public.ensure_quick_share_locator(bytea,bytea)', 'execute'), 'owner may ensure a locator');
select ok(has_function_privilege('authenticated', 'public.rotate_quick_share_locator(bytea,bytea,bytea)', 'execute'), 'owner may rotate a locator');
select ok(not has_function_privilege('anon', 'public.ensure_quick_share_locator(bytea,bytea)', 'execute'), 'anon cannot ensure a locator');
select ok(not has_function_privilege('anon', 'public.rotate_quick_share_locator(bytea,bytea,bytea)', 'execute'), 'anon cannot rotate a locator');
select ok(has_function_privilege('anon', 'public.resolve_quick_share(text,text[])', 'execute'), 'anon may resolve a public locator');
select ok(has_function_privilege('authenticated', 'public.resolve_quick_share(text,text[])', 'execute'), 'authenticated visitor may resolve a public locator');
select ok(not has_function_privilege('anon', 'private.revoke_quick_share_passes_on_rotation()', 'execute'), 'anon cannot invoke private revocation helper');

create temporary table quick_test_accounts (
  name text primary key,
  user_id uuid not null unique,
  username text not null unique
);
create temporary table quick_test_values (
  token text not null,
  rotated_token text not null,
  token_hash bytea not null,
  rotated_hash bytea not null,
  nonce bytea not null,
  rotated_nonce bytea not null,
  locator_id uuid,
  pass_token text
);
grant select on quick_test_accounts to anon, authenticated;
grant select, update on quick_test_values to anon, authenticated;

insert into quick_test_accounts (name, user_id, username)
select names.name, names.user_id,
  'qs_' || names.name || '_' || pg_catalog.substr(pg_catalog.replace(names.user_id::text, '-', ''), 1, 8)
from (
  select labels.name, pg_catalog.gen_random_uuid() as user_id
  from (values ('owner'), ('other')) as labels(name)
) as names;

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
select user_id, 'authenticated', 'authenticated', username || '@example.test',
  pg_catalog.jsonb_build_object('username', username, 'display_name', initcap(name)),
  pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
from quick_test_accounts;

update public.profiles set is_published = true
where id in (select user_id from quick_test_accounts);
update public.profile_modes set is_enabled = true
where profile_id in (select user_id from quick_test_accounts);
update public.profile_modes set connect_policy = 'direct_only'
where profile_id = (select user_id from quick_test_accounts where name = 'owner')
  and slug = 'personal';
update public.profile_modes set connect_policy = 'nobody'
where profile_id = (select user_id from quick_test_accounts where name = 'owner')
  and slug = 'business';

insert into quick_test_values (token, rotated_token, token_hash, rotated_hash, nonce, rotated_nonce)
values (
  pg_catalog.repeat('Q', 43),
  pg_catalog.repeat('R', 43),
  extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('Q', 43), 'UTF8'), 'sha256'),
  extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('R', 43), 'UTF8'), 'sha256'),
  pg_catalog.decode(pg_catalog.repeat('11', 32), 'hex'),
  pg_catalog.decode(pg_catalog.repeat('22', 32), 'hex')
);

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from quick_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);

update quick_test_values
set locator_id = (public.ensure_quick_share_locator(nonce, token_hash) ->> 'id')::uuid;
select ok((select locator_id is not null from quick_test_values), 'owner creates one locator');
select is(
  (select public.ensure_quick_share_locator(rotated_nonce, rotated_hash) ->> 'id' from quick_test_values),
  (select locator_id::text from quick_test_values),
  'ensure is idempotent and retains the stable locator'
);
select is(
  (select public.ensure_quick_share_locator(rotated_nonce, rotated_hash) ->> 'token_hash' from quick_test_values),
  (select pg_catalog.encode(token_hash, 'hex') from quick_test_values),
  'ensure returns the existing token hash for repeat URL derivation'
);
select throws_ok(
  $$select public.ensure_quick_share_locator(pg_catalog.decode('aa','hex'), pg_catalog.decode(pg_catalog.repeat('bb',32),'hex'))$$,
  '22023', 'Invalid Quick Share locator', 'short nonce is rejected'
);
select is(
  (public.set_equipped_share_state('personal', 'view_profile') ->> 'intent'),
  'view_profile', 'owner can leave the stable URL in view-only state'
);
reset role;

select ok(
  (select token_hash = extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('Q', 43), 'UTF8'), 'sha256')
   from public.quick_share_locators where id = (select locator_id from quick_test_values)),
  'only the expected public token hash is stored'
);
select is(
  (select pg_catalog.count(*)::integer from public.quick_share_locators
   where profile_id = (select user_id from quick_test_accounts where name = 'owner')),
  1, 'owner has exactly one locator'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (public.resolve_quick_share((select token from quick_test_values), '{}'::text[]) ->> 'username'),
  (select username from quick_test_accounts where name = 'owner'),
  'anonymous visitor resolves a published Quick Share URL'
);
select is(
  (public.resolve_quick_share((select token from quick_test_values), '{}'::text[]) ->> 'mode'),
  'personal', 'Quick Share follows the Equipped Personal Mode'
);
select is(
  (public.resolve_quick_share((select token from quick_test_values), '{}'::text[]) ->> 'connection_pass'),
  null::text, 'view-only Quick Share issues no Connection Pass'
);
select is(public.resolve_quick_share('malformed', '{}'::text[]), null::jsonb, 'malformed locator fails closed');
select is(public.resolve_quick_share(pg_catalog.repeat('Z', 43), '{}'::text[]), null::jsonb, 'unknown locator fails closed');
select throws_ok($$select * from public.quick_share_locators$$, '42501', null, 'anonymous visitor cannot read locator rows');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from quick_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);
select is(
  (public.set_equipped_share_state('personal', 'connect_in_person') ->> 'intent'),
  'connect_in_person', 'owner equips in-person intent'
);
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
update quick_test_values
set pass_token = public.resolve_quick_share(token, '{}'::text[]) ->> 'connection_pass';
select ok((select pass_token ~ '^[A-Za-z0-9_-]{43}$' from quick_test_values), 'Direct-only Quick Share issues a 256-bit Connection Pass');
select is(
  (select public.resolve_quick_share(token, array[pass_token]) ->> 'connection_pass' from quick_test_values),
  (select pass_token from quick_test_values),
  'repeat Quick Share opening reuses its live pass'
);
select is(
  (select pg_catalog.count(distinct resolved ->> 'connection_pass')::integer
   from quick_test_values as quick
   cross join pg_catalog.generate_series(1, 120) as scans(n)
   cross join lateral public.resolve_quick_share(quick.token, array[scans.n::text]) as resolved),
  1, '120 anonymous scans without cookies share one live, short-lived pass'
);
select is(
  (select public.get_connect_access(
    (select username from quick_test_accounts where name = 'owner'), 'personal', pass_token
  ) from quick_test_values),
  true, 'a live Quick Share pass enables Direct-only Connect'
);
select ok(
  (select (public.create_guest_connection(
    (select username from quick_test_accounts where name = 'owner'),
    'personal', 'Quick Share Guest', 'quick-guest@example.test',
    pg_catalog.repeat('G', 43), pg_catalog.gen_random_uuid(), 'quick_qr', pass_token
  ) ->> 'connection_id') is not null from quick_test_values),
  'guest can Connect through a valid Quick Share pass'
);
reset role;

select is(
  (select pg_catalog.count(*)::integer from public.connection_share_grants
   where quick_share_locator_id = (select locator_id from quick_test_values)),
  1, 'repeat openings create only one locator-scoped pass'
);
select ok(
  exists (select 1 from public.connection_encounters
    where source = 'quick_qr' and authorization_method = 'connection_pass'
      and shared_by_user_id = (select user_id from quick_test_accounts where name = 'owner')),
  'encounter keeps quick_qr attribution separate from pass authorization'
);
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select ok(
  (select (public.create_guest_connection(
    (select username from quick_test_accounts where name = 'owner'),
    'personal', 'Quick Source Guest', 'quick-source@example.test',
    pg_catalog.repeat('H', 43), pg_catalog.gen_random_uuid(), 'tap', pass_token
  ) ->> 'encounter_id') is not null from quick_test_values),
  'Quick locator pass can authorize a second guest'
);
reset role;
select ok(
  exists (select 1 from public.connection_encounters
    where source = 'quick_qr' and authorization_method = 'connection_pass'
      and created_by_guest_id = (
        select guest_sessions.guest_identity_id from public.guest_sessions
        where guest_sessions.token_hash = extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('H', 43), 'UTF8'), 'sha256')
      )),
  'a forged Tap source is corrected to the Quick locator channel'
);
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select ok(
  (public.create_guest_connection(
    (select username from quick_test_accounts where name = 'owner'),
    'event', 'Unverified Source', 'unverified-source@example.test',
    pg_catalog.repeat('I', 43), pg_catalog.gen_random_uuid(), 'quick_qr', null
  ) ->> 'encounter_id') is not null,
  'Anyone Mode can still accept a regular connection'
);
reset role;
select ok(
  exists (select 1 from public.connection_encounters
    where source = 'profile' and authorization_method = 'open_mode'
      and created_by_guest_id = (
        select guest_sessions.guest_identity_id from public.guest_sessions
        where guest_sessions.token_hash = extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('I', 43), 'UTF8'), 'sha256')
      )),
  'an unproven Quick QR source does not become verified attribution'
);

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from quick_test_accounts where name = 'other'), 'role', 'authenticated'
)::text, true);
select is(
  (select public.rotate_quick_share_locator(token_hash, rotated_nonce, rotated_hash)
   from quick_test_values),
  null::jsonb, 'another account cannot rotate the owner locator'
);
select throws_ok($$select * from public.quick_share_locators$$, '42501', null, 'another account cannot read locator rows');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from quick_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);
select is(
  (select public.rotate_quick_share_locator(
     extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('S', 43), 'UTF8'), 'sha256'),
     rotated_nonce, rotated_hash)
   from quick_test_values),
  null::jsonb, 'stale expected token hash cannot rotate the locator'
);
select is(
  (select public.rotate_quick_share_locator(token_hash, rotated_nonce, rotated_hash) ->> 'token_hash'
   from quick_test_values),
  (select pg_catalog.encode(rotated_hash, 'hex') from quick_test_values),
  'owner rotates the locator with compare-and-swap'
);
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (select public.resolve_quick_share(token, '{}'::text[]) from quick_test_values),
  null::jsonb, 'old locator URL stops resolving immediately after rotation'
);
select is(
  (select public.get_connect_access(
    (select username from quick_test_accounts where name = 'owner'), 'personal', pass_token
  ) from quick_test_values),
  false, 'rotation invalidates the old Quick Share Connection Pass'
);
select is(
  (select public.resolve_quick_share(rotated_token, '{}'::text[]) ->> 'mode'
   from quick_test_values),
  'personal', 'rotated locator resolves the current Mode'
);
reset role;

select ok(
  (select revoked_at is not null from public.connection_share_grants
   where quick_share_locator_id = (select locator_id from quick_test_values)
   order by created_at limit 1),
  'rotation records revocation of the previously issued pass'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
update quick_test_values
set pass_token = public.resolve_quick_share(rotated_token, '{}'::text[]) ->> 'connection_pass';
select ok((select pass_token is not null from quick_test_values), 'rotated locator can issue a fresh pass');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from quick_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);
select is((public.set_equipped_share_state('event', 'view_profile') ->> 'mode'), 'event', 'Quick Share follows a changed Equipped Mode');
reset role;
select ok(
  (select revoked_at is not null from public.connection_share_grants
   where token_hash = extensions.digest(
     pg_catalog.convert_to((select pass_token from quick_test_values), 'UTF8'), 'sha256')),
  'changing Equipped Mode revokes the locator pass'
);
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (select public.resolve_quick_share(rotated_token, '{}'::text[]) ->> 'mode'
   from quick_test_values),
  'event', 'the same Quick Share URL now opens Event without regeneration'
);
select is(
  (select public.resolve_quick_share(rotated_token, '{}'::text[]) ->> 'connection_pass'
   from quick_test_values),
  null::text, 'view-profile Event issues no pass'
);
select is(
  (select public.get_connect_access(
    (select username from quick_test_accounts where name = 'owner'), 'personal', pass_token
  ) from quick_test_values),
  false, 'a pass from the prior Equipped Mode cannot authorize Connect'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from quick_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);
select is((public.set_equipped_share_state('business', 'connect_in_person') ->> 'mode'), 'business', 'owner may equip Business');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (select public.resolve_quick_share(rotated_token, '{}'::text[]) ->> 'connection_pass'
   from quick_test_values),
  null::text, 'Nobody policy stays view-only even with in-person intent'
);
select is(
  public.get_connect_access((select username from quick_test_accounts where name = 'owner'), 'business', null),
  false, 'Nobody Mode does not permit inbound Connect'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from quick_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);
select is((public.set_equipped_share_state('personal', 'connect_in_person') ->> 'mode'), 'personal', 'owner restores Personal for publication test');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
update quick_test_values
set pass_token = public.resolve_quick_share(rotated_token, '{}'::text[]) ->> 'connection_pass';
select ok((select pass_token is not null from quick_test_values), 'published Personal may issue a fresh pass');
reset role;

update public.profiles set is_published = false
where id = (select user_id from quick_test_accounts where name = 'owner');
select ok(
  (select revoked_at is not null from public.connection_share_grants
   where token_hash = extensions.digest(
     pg_catalog.convert_to((select pass_token from quick_test_values), 'UTF8'), 'sha256')),
  'unpublishing revokes the active Quick Share pass'
);
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (select public.resolve_quick_share(rotated_token, '{}'::text[]) from quick_test_values),
  null::jsonb, 'unpublished identity does not resolve through Quick Share'
);
reset role;

update public.profiles set is_published = true
where id = (select user_id from quick_test_accounts where name = 'owner');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
update quick_test_values
set pass_token = public.resolve_quick_share(rotated_token, '{}'::text[]) ->> 'connection_pass';
select ok((select pass_token is not null from quick_test_values), 'republished Personal can issue a new pass');
reset role;
update public.profile_modes set is_enabled = false
where profile_id = (select user_id from quick_test_accounts where name = 'owner')
  and slug = 'personal';
select ok(
  (select revoked_at is not null from public.connection_share_grants
   where token_hash = extensions.digest(
     pg_catalog.convert_to((select pass_token from quick_test_values), 'UTF8'), 'sha256')),
  'disabling the Equipped Mode revokes its active Quick Share pass'
);
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (select public.resolve_quick_share(rotated_token, '{}'::text[]) from quick_test_values),
  null::jsonb, 'disabled Equipped Mode does not resolve through Quick Share'
);
reset role;

select * from finish();
rollback;
