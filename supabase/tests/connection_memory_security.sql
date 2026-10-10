begin;

select plan(19);

-- ---------------------------------------------------------------- Shape

select has_column('public', 'encounter_context', 'met_on', 'memory has a remembered date');
select has_column('public', 'encounter_context', 'met_time', 'memory has an optional remembered time');
select has_column('public', 'encounter_context', 'provenance', 'memory records where it came from');
select col_default_is('public', 'encounter_context', 'provenance', 'viewer', 'memory defaults to viewer provenance');
select ok(
  not has_column_privilege('authenticated', 'public.connection_encounters', 'created_at', 'update'),
  'nobody can rewrite a canonical encounter timestamp'
);
select ok(
  not has_column_privilege('authenticated', 'public.connections', 'created_at', 'update'),
  'nobody can rewrite a canonical connection timestamp'
);

-- ---------------------------------------------------------------- Fixtures

create temporary table cm_accounts (name text primary key, user_id uuid not null unique, username text not null unique);
create temporary table cm_ids (name text primary key, id uuid not null);
grant select on cm_accounts, cm_ids to authenticated;

insert into cm_accounts (name, user_id, username)
select generated.name, generated.user_id, 'cm_' || generated.name || '_' || pg_catalog.substr(pg_catalog.replace(generated.user_id::text, '-', ''), 1, 8)
from (select names.name, gen_random_uuid() as user_id from (values ('michel'), ('rayz'), ('visitor')) as names(name)) as generated;

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
select user_id, 'authenticated', 'authenticated', username || '@example.test',
  pg_catalog.jsonb_build_object('username', username, 'display_name', initcap(name)),
  pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
from cm_accounts;
update public.profiles set is_published = true from cm_accounts where profiles.id = cm_accounts.user_id;
update public.profile_modes set is_enabled = true from cm_accounts where profile_modes.profile_id = cm_accounts.user_id;

-- Michel connects to Rayz's Personal Mode through a shared link.
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from cm_accounts where name = 'michel'), 'role', 'authenticated')::text, true);
reset role;
insert into cm_ids
select 'connection', (r ->> 'connection_id')::uuid from (
  select public.connect_registered((select username from cm_accounts where name = 'rayz'), 'personal', 'personal', gen_random_uuid(), 'link', null) as r
) as connected;
insert into cm_ids select 'encounter', id from public.connection_encounters where connection_id = (select id from cm_ids where name = 'connection');
create temporary table cm_canonical as
  select connections.created_at as connection_at, connection_encounters.created_at as encounter_at
  from public.connections join public.connection_encounters on connection_encounters.connection_id = connections.id
  where connections.id = (select id from cm_ids where name = 'connection');

-- ---------------------------------------------------------------- Owner writes private memory

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from cm_accounts where name = 'michel'), 'role', 'authenticated')::text, true);

select lives_ok(
  $$insert into public.encounter_context (encounter_id, user_id, city, venue, met_on, met_time, provenance)
    values ((select id from cm_ids where name = 'encounter'), (select user_id from cm_accounts where name = 'michel'), 'Alkmaar', 'Café De Boom', date '2026-10-09', time '21:30', 'viewer')$$,
  'a participant saves their own memory with a remembered date'
);
select throws_ok(
  $$update public.encounter_context set provenance = 'guessed' where user_id = (select user_id from cm_accounts where name = 'michel')$$,
  '23514', null, 'provenance is a closed set'
);
select throws_ok(
  $$update public.encounter_context set met_on = null where user_id = (select user_id from cm_accounts where name = 'michel')$$,
  '23514', null, 'a remembered time needs a remembered date'
);
select lives_ok(
  $$insert into public.connection_notes (connection_id, user_id, note)
    values ((select id from cm_ids where name = 'connection'), (select user_id from cm_accounts where name = 'michel'), 'Ask about the studio')$$,
  'a participant saves their own note'
);
select is((select count(*)::integer from public.encounter_context), 1, 'the owner reads their memory');

-- ---------------------------------------------------------------- Counterpart cannot see it

select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from cm_accounts where name = 'rayz'), 'role', 'authenticated')::text, true);
select is((select count(*)::integer from public.connections where id = (select id from cm_ids where name = 'connection')), 1, 'the counterpart reads the Connection');
select is((select count(*)::integer from public.encounter_context), 0, 'the counterpart never reads the viewer''s memory');
select is((select count(*)::integer from public.connection_notes), 0, 'the counterpart never reads the viewer''s note');
select throws_ok(
  $$insert into public.encounter_context (encounter_id, user_id, city)
    values ((select id from cm_ids where name = 'encounter'), (select user_id from cm_accounts where name = 'michel'), 'Forged')$$,
  '42501', null, 'nobody writes memory as someone else'
);

-- ---------------------------------------------------------------- Unrelated users see nothing

select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from cm_accounts where name = 'visitor'), 'role', 'authenticated')::text, true);
select is((select count(*)::integer from public.connections), 0, 'an unrelated user reads no Connection');
select is((select count(*)::integer from public.connection_encounters), 0, 'an unrelated user reads no encounter');
select throws_ok(
  $$insert into public.encounter_context (encounter_id, user_id, city)
    values ((select id from cm_ids where name = 'encounter'), (select user_id from cm_accounts where name = 'visitor'), 'Intruder')$$,
  '42501', null, 'an unrelated user cannot attach memory to someone else''s encounter'
);
reset role;

select ok(
  (select connection_at = (select created_at from public.connections where id = (select id from cm_ids where name = 'connection'))
     and encounter_at = (select created_at from public.connection_encounters where id = (select id from cm_ids where name = 'encounter'))
   from cm_canonical),
  'saving memory left canonical timestamps untouched'
);

select * from finish();
rollback;
