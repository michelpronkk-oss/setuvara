begin;

select plan(78);

-- ---------------------------------------------------------------- Shape and privileges

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.connection_share_grants'::regclass),
  'connection_share_grants has RLS enabled'
);

select ok(
  not has_table_privilege(role_name, 'public.connection_share_grants', privilege_name),
  format('%s has no %s privilege on connection_share_grants', role_name, privilege_name)
)
from (values ('anon'::name), ('authenticated'::name)) as roles(role_name)
cross join (values ('select'::text), ('insert'::text), ('update'::text), ('delete'::text)) as privileges(privilege_name);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'connection_share_grants'
      and column_name in ('token', 'raw_token', 'secret')
  ),
  'grants have no plaintext token column'
);

select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_catalog.pg_proc where oid = function_name::regprocedure),
  format('%s is security definer with a locked search_path', function_name)
)
from (values
  ('public.issue_connection_pass(text,text)'::text),
  ('public.revoke_connection_passes(text)'::text),
  ('public.resolve_connection_pass(text)'::text),
  ('public.get_connect_access(text,text,text)'::text),
  ('public.create_guest_connection(text,text,text,text,text,uuid,text,text)'::text),
  ('public.connect_registered(text,text,text,uuid,text,text)'::text)
) as functions(function_name);

select ok(not has_function_privilege('anon', 'public.issue_connection_pass(text,text)', 'execute'), 'anon cannot issue passes');
select ok(not has_function_privilege('anon', 'public.revoke_connection_passes(text)', 'execute'), 'anon cannot revoke passes');
select ok(has_function_privilege('authenticated', 'public.issue_connection_pass(text,text)', 'execute'), 'authenticated may issue passes for their own Modes');
select ok(has_function_privilege('anon', 'public.get_connect_access(text,text,text)', 'execute'), 'anon may ask for Connect access');
select ok(has_function_privilege('anon', 'public.resolve_connection_pass(text)', 'execute'), 'anon may resolve a pass entry');
select ok(
  not has_function_privilege(role_name, 'private.connection_pass_authorizes(uuid,uuid,text)', 'execute'),
  format('%s cannot call the private pass check', role_name)
)
from (values ('anon'::name), ('authenticated'::name)) as roles(role_name);
select ok(
  not exists (select 1 from pg_catalog.pg_proc where proname in ('connect_registered', 'create_guest_connection')
    and pronamespace = 'public'::regnamespace and pronargs in (5, 7)),
  'old Connect RPC signatures without policy enforcement are gone'
);

-- ---------------------------------------------------------------- Fixtures

create temporary table ca_accounts (name text primary key, user_id uuid not null unique, username text not null unique);
create temporary table ca_tokens (name text primary key, token text not null);
grant select on ca_accounts to anon, authenticated;
grant select, insert, update on ca_tokens to anon, authenticated;

insert into ca_accounts (name, user_id, username)
select generated.name, generated.user_id, 'ca_' || generated.name || '_' || pg_catalog.substr(pg_catalog.replace(generated.user_id::text, '-', ''), 1, 8)
from (select names.name, gen_random_uuid() as user_id from (values ('michel'), ('rayz'), ('visitor')) as names(name)) as generated;

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
select user_id, 'authenticated', 'authenticated', username || '@example.test',
  pg_catalog.jsonb_build_object('username', username, 'display_name', initcap(name)),
  pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
from ca_accounts;

update public.profiles set is_published = true from ca_accounts where profiles.id = ca_accounts.user_id;
update public.profile_modes set is_enabled = true from ca_accounts where profile_modes.profile_id = ca_accounts.user_id;

select is(
  (select count(*)::integer from public.profile_modes join ca_accounts on ca_accounts.user_id = profile_modes.profile_id where connect_policy = 'anyone'),
  9, 'new Modes default to anyone, preserving current Connect behavior'
);
select throws_ok(
  $$update public.profile_modes set connect_policy = 'everyone' where profile_id = (select user_id from ca_accounts where name = 'michel')$$,
  '23514', null, 'connect_policy only accepts anyone, direct_only or nobody'
);
select is(public.is_username_available('connect'), false, 'connect is reserved for the Connection Pass entry route');

-- Michel: Personal direct_only, Event anyone, Business nobody. Rayz: everything anyone.
update public.profile_modes set connect_policy = case slug when 'personal' then 'direct_only' when 'business' then 'nobody' else 'anyone' end
where profile_id = (select user_id from ca_accounts where name = 'michel');

-- ---------------------------------------------------------------- Owner issues passes

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from ca_accounts where name = 'michel'), 'role', 'authenticated')::text, true);

insert into ca_tokens select 'personal', public.issue_connection_pass('personal') ->> 'token';
select matches((select token from ca_tokens where name = 'personal'), '^[A-Za-z0-9_-]{43}$', 'pass tokens are 256-bit base64url strings');
select is(
  public.issue_connection_pass('personal', (select token from ca_tokens where name = 'personal')) ->> 'token',
  (select token from ca_tokens where name = 'personal'),
  'a still-valid pass is reused instead of minting a new grant'
);
select is(
  (public.issue_connection_pass('personal', (select token from ca_tokens where name = 'personal')) ->> 'reused')::boolean,
  true, 'reuse is reported'
);
select throws_ok($$select public.issue_connection_pass('event')$$, '22023', 'Connect in person needs Direct share only', 'no pass for an anyone Mode');
select throws_ok($$select public.issue_connection_pass('business')$$, '22023', 'Connect in person needs Direct share only', 'no pass for a nobody Mode');

-- Another user can only ever address their own Modes.
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from ca_accounts where name = 'visitor'), 'role', 'authenticated')::text, true);
select throws_ok($$select public.issue_connection_pass('personal')$$, '22023', 'Connect in person needs Direct share only', 'an unrelated user cannot mint a pass (only their own anyone Mode is addressable)');
select is(public.revoke_connection_passes('personal'), 0, 'an unrelated user revokes nothing of the owner');
reset role;

select is(
  (select count(*)::integer from public.connection_share_grants where profile_id = (select user_id from ca_accounts where name = 'michel') and revoked_at is null),
  1, 'exactly one active grant exists after repeated reuse'
);
select ok(
  (select token_hash = extensions.digest(pg_catalog.convert_to((select token from ca_tokens where name = 'personal'), 'UTF8'), 'sha256')
   from public.connection_share_grants where profile_id = (select user_id from ca_accounts where name = 'michel')),
  'only the SHA-256 hash of the token is stored'
);
select ok(
  (select expires_at <= created_at + interval '24 hours' and expires_at > created_at + interval '23 hours'
   from public.connection_share_grants where profile_id = (select user_id from ca_accounts where name = 'michel')),
  'passes live for 24 hours'
);

-- ---------------------------------------------------------------- Public authorization

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'personal', null), false, 'Direct share only canonical URL: no Connect');
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'personal', (select token from ca_tokens where name = 'personal')), true, 'Direct share only with a valid pass: Connect');
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'personal', (select overlay(token placing case when pg_catalog.right(token, 1) = 'A' then 'B' else 'A' end from 43 for 1) from ca_tokens where name = 'personal')), false, 'a modified pass does not authorize');
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'personal', pg_catalog.repeat('x', 43)), false, 'a random pass does not authorize');
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'personal', 'source=qr'), false, 'malformed input does not authorize');
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'event', null), true, 'Event anyone works independently');
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'business', null), false, 'Business nobody works independently');
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'business', (select token from ca_tokens where name = 'personal')), false, 'a Personal pass cannot unlock Business');
select is(public.get_connect_access((select username from ca_accounts where name = 'rayz'), 'personal', null), true, 'Anyone canonical URL: Connect');
select is(
  public.resolve_connection_pass((select token from ca_tokens where name = 'personal')),
  pg_catalog.jsonb_build_object('username', (select username from ca_accounts where name = 'michel'), 'mode', 'personal', 'valid', true),
  'the entry route resolves a valid pass to its exact profile and Mode only'
);
select is(public.resolve_connection_pass(pg_catalog.repeat('x', 43)), null, 'unknown passes resolve to nothing');
reset role;

-- Another Mode and another profile cannot be unlocked by this pass.
update public.profile_modes set connect_policy = 'direct_only'
where profile_id = (select user_id from ca_accounts where name in ('michel')) and slug = 'event';
update public.profile_modes set connect_policy = 'direct_only'
where profile_id = (select user_id from ca_accounts where name = 'rayz') and slug = 'personal';
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'event', (select token from ca_tokens where name = 'personal')), false, 'grant for another Mode cannot authorize');
select is(public.get_connect_access((select username from ca_accounts where name = 'rayz'), 'personal', (select token from ca_tokens where name = 'personal')), false, 'grant for another profile cannot authorize');
update public.profile_modes set connect_policy = 'anyone'
where profile_id in (select user_id from ca_accounts where name in ('michel', 'rayz')) and slug in ('event', 'personal')
  and not (profile_id = (select user_id from ca_accounts where name = 'michel') and slug = 'personal');

-- ---------------------------------------------------------------- Connect RPC enforcement

set local role anon;
select throws_ok(
  format($$select public.create_guest_connection(%L, 'personal', 'Guest Ada', 'ada@example.test', %L, gen_random_uuid(), 'qr', null)$$,
    (select username from ca_accounts where name = 'michel'), pg_catalog.repeat('g', 43)),
  '42501', 'Connections are not open from this Mode', 'guest Connect without a pass is refused on Direct share only'
);
select lives_ok(
  format($$select public.create_guest_connection(%L, 'personal', 'Guest Ada', 'ada@example.test', %L, gen_random_uuid(), 'qr', %L)$$,
    (select username from ca_accounts where name = 'michel'), pg_catalog.repeat('g', 43), (select token from ca_tokens where name = 'personal')),
  'guest Connect with a valid pass succeeds'
);
select throws_ok(
  format($$select public.create_guest_connection(%L, 'business', 'Guest Ada', 'ada@example.test', %L, gen_random_uuid(), 'qr', %L)$$,
    (select username from ca_accounts where name = 'michel'), pg_catalog.repeat('g', 43), (select token from ca_tokens where name = 'personal')),
  '42501', 'Connections are not open from this Mode', 'guest Connect to a nobody Mode is refused even with a pass'
);
reset role;
select is(
  (select source from public.connection_encounters where shared_by_user_id = (select user_id from ca_accounts where name = 'michel') and created_by_guest_id is not null),
  'direct_share', 'pass-authorized guest encounters are recorded as direct_share'
);

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from ca_accounts where name = 'visitor'), 'role', 'authenticated')::text, true);
select throws_ok(
  format($$select public.connect_registered(%L, 'personal', 'personal', gen_random_uuid(), 'qr')$$, (select username from ca_accounts where name = 'michel')),
  '42501', 'Connections are not open from this Mode', 'registered Connect without a pass is refused on Direct share only'
);
select throws_ok(
  format($$select public.connect_registered(%L, 'personal', 'personal', gen_random_uuid(), 'qr', %L)$$, (select username from ca_accounts where name = 'michel'), pg_catalog.repeat('x', 43)),
  '42501', 'Connections are not open from this Mode', 'registered Connect with a forged pass is refused'
);
select lives_ok(
  format($$select public.connect_registered(%L, 'personal', 'personal', gen_random_uuid(), 'qr', %L)$$, (select username from ca_accounts where name = 'michel'), (select token from ca_tokens where name = 'personal')),
  'registered Connect with a valid pass succeeds'
);
select lives_ok(
  format($$select public.connect_registered(%L, 'event', 'personal', gen_random_uuid(), 'link')$$, (select username from ca_accounts where name = 'michel')),
  'registered Connect to an anyone Mode needs no pass'
);
select throws_ok(
  format($$select public.connect_registered(%L, 'business', 'personal', gen_random_uuid(), 'qr', %L)$$, (select username from ca_accounts where name = 'michel'), (select token from ca_tokens where name = 'personal')),
  '42501', 'Connections are not open from this Mode', 'registered Connect to a nobody Mode is refused'
);
reset role;
select is(
  (select pg_catalog.array_agg(source order by created_at, source) from public.connection_encounters
   where shared_by_user_id = (select user_id from ca_accounts where name = 'michel') and created_by_user_id = (select user_id from ca_accounts where name = 'visitor')),
  array['direct_share', 'link'], 'registered encounters keep direct_share and normal sources apart'
);

-- Outbound independence: Michel's own Personal is closed, yet he can connect to Rayz.
update public.profile_modes set connect_policy = 'nobody'
where profile_id = (select user_id from ca_accounts where name = 'michel');
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from ca_accounts where name = 'michel'), 'role', 'authenticated')::text, true);
select lives_ok(
  format($$select public.connect_registered(%L, 'personal', 'personal', gen_random_uuid(), 'qr')$$, (select username from ca_accounts where name = 'rayz')),
  'an owner with every Mode on Nobody can still connect to someone who allows it'
);
reset role;

-- ---------------------------------------------------------------- Policy changes, expiry, availability

select is(
  (select count(*)::integer from public.connection_share_grants where profile_id = (select user_id from ca_accounts where name = 'michel') and revoked_at is null),
  0, 'leaving Direct share only revokes outstanding passes'
);
-- A stale but unexpired grant (for example one written before a policy change) never beats Nobody.
insert into public.connection_share_grants (profile_id, mode_id, token_hash, created_by_user_id)
select profile_id, id, extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('n', 43), 'UTF8'), 'sha256'), profile_id
from public.profile_modes where profile_id = (select user_id from ca_accounts where name = 'michel') and slug = 'personal';
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'personal', pg_catalog.repeat('n', 43)), false, 'Nobody overrides a valid grant');
select is(
  (public.resolve_connection_pass(pg_catalog.repeat('n', 43)) ->> 'valid')::boolean, false,
  'a pass for a Nobody Mode resolves to the profile without authorization'
);

select is(
  (select count(*)::integer from public.connections where user_id = (select user_id from ca_accounts where name = 'michel')
     and connected_user_id = (select user_id from ca_accounts where name = 'visitor')),
  1, 'existing Connections survive a change to Nobody'
);
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from ca_accounts where name = 'visitor'), 'role', 'authenticated')::text, true);
select isnt(
  public.get_registered_connection_state((select username from ca_accounts where name = 'michel'), 'personal'), null,
  'existing Connection state is still visible to the connected visitor'
);
reset role;

update public.profile_modes set connect_policy = 'direct_only'
where profile_id = (select user_id from ca_accounts where name = 'michel') and slug = 'personal';
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'personal', (select token from ca_tokens where name = 'personal')), false, 'returning to Direct share only does not revive a revoked pass');

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from ca_accounts where name = 'michel'), 'role', 'authenticated')::text, true);
select isnt(
  public.issue_connection_pass('personal', (select token from ca_tokens where name = 'personal')) ->> 'token',
  (select token from ca_tokens where name = 'personal'),
  'a revoked pass is replaced by a fresh one'
);
update ca_tokens set token = public.issue_connection_pass('personal') ->> 'token' where name = 'personal';
select is(public.revoke_connection_passes('personal'), 3, 'owner revoke ends every active pass for the Mode');
reset role;
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'personal', (select token from ca_tokens where name = 'personal')), false, 'a revoked pass cannot authorize');

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from ca_accounts where name = 'michel'), 'role', 'authenticated')::text, true);
update ca_tokens set token = public.issue_connection_pass('personal') ->> 'token' where name = 'personal';
reset role;
update public.connection_share_grants set created_at = pg_catalog.statement_timestamp() - interval '25 hours', expires_at = pg_catalog.statement_timestamp() - interval '1 hour'
where token_hash = extensions.digest(pg_catalog.convert_to((select token from ca_tokens where name = 'personal'), 'UTF8'), 'sha256');
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'personal', (select token from ca_tokens where name = 'personal')), false, 'an expired pass cannot authorize');
select is(
  public.resolve_connection_pass((select token from ca_tokens where name = 'personal')),
  pg_catalog.jsonb_build_object('username', (select username from ca_accounts where name = 'michel'), 'mode', 'personal', 'valid', false),
  'an expired pass still lands on the live profile, without Connect'
);

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from ca_accounts where name = 'michel'), 'role', 'authenticated')::text, true);
update ca_tokens set token = public.issue_connection_pass('personal') ->> 'token' where name = 'personal';
reset role;
update public.profile_modes set is_enabled = false
where profile_id = (select user_id from ca_accounts where name = 'michel') and slug = 'personal';
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'personal', (select token from ca_tokens where name = 'personal')), false, 'a disabled Mode cannot be unlocked');
select is(public.resolve_connection_pass((select token from ca_tokens where name = 'personal')), null, 'a pass for a disabled Mode resolves to nothing');
update public.profile_modes set is_enabled = true
where profile_id = (select user_id from ca_accounts where name = 'michel') and slug = 'personal';
update public.profiles set is_published = false where id = (select user_id from ca_accounts where name = 'michel');
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'personal', (select token from ca_tokens where name = 'personal')), false, 'an unpublished profile cannot be unlocked');
select is(public.resolve_connection_pass((select token from ca_tokens where name = 'personal')), null, 'a pass for an unpublished profile resolves to nothing');
update public.profiles set is_published = true where id = (select user_id from ca_accounts where name = 'michel');
select is(public.get_connect_access((select username from ca_accounts where name = 'michel'), 'personal', (select token from ca_tokens where name = 'personal')), true, 'the same pass works again once the profile is live');

-- Pass creation is bounded per owner per day.
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from ca_accounts where name = 'michel'), 'role', 'authenticated')::text, true);
select throws_ok(
  $$select public.issue_connection_pass('personal') from pg_catalog.generate_series(1, 25)$$,
  '22023', 'Too many Connection Passes today', 'pass creation is rate limited'
);
reset role;

select * from finish();
rollback;
