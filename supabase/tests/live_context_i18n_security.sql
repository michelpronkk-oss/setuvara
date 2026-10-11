begin;

select no_plan();

-- Table visibility, row isolation, and narrowly granted write capabilities.
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.live_contexts'::regclass),
  'Live Context has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.account_preferences'::regclass),
  'account preferences have RLS enabled'
);
select ok(not has_table_privilege('anon', 'public.live_contexts', 'select'), 'anon has no Live Context table access');
select ok(not has_table_privilege('anon', 'public.account_preferences', 'select'), 'anon has no account preference table access');
select ok(has_table_privilege('authenticated', 'public.live_contexts', 'select'), 'authenticated owners can read their contexts through RLS');
select ok(not has_table_privilege('authenticated', 'public.live_contexts', 'insert'), 'Live Context inserts are column-granted only');
select ok(has_column_privilege('authenticated', 'public.live_contexts', 'owner_user_id', 'insert'), 'the owner id is available for the ownership check on insert');
select ok(not has_column_privilege('authenticated', 'public.live_contexts', 'owner_user_id', 'update'), 'owners cannot reassign a context');
select ok(not has_table_privilege('authenticated', 'public.account_preferences', 'delete'), 'account preferences cannot be deleted through the Data API');
select ok(not has_column_privilege('authenticated', 'public.connection_encounters', 'live_context_label_snapshot', 'update'), 'encounter snapshots cannot be edited by users');
select ok(not has_column_privilege('authenticated', 'public.connection_encounters', 'live_context_label_snapshot', 'insert'), 'encounter snapshots are trigger-controlled');

select ok(has_function_privilege('authenticated', 'public.set_active_live_context(text,text,timestamptz,text,text,text,timestamptz,text,boolean)', 'execute'), 'authenticated users can set their own active context');
select ok(not has_function_privilege('anon', 'public.set_active_live_context(text,text,timestamptz,text,text,text,timestamptz,text,boolean)', 'execute'), 'anon cannot set a Live Context');
select ok(
  (select not prosecdef and proconfig @> array['search_path=""']
   from pg_catalog.pg_proc
   where oid = 'public.set_active_live_context(text,text,timestamptz,text,text,text,timestamptz,text,boolean)'::regprocedure),
  'the context setter is invoker-rights with a locked search_path'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_catalog.pg_proc
   where oid = 'private.snapshot_live_context_on_encounter()'::regprocedure),
  'the snapshot trigger uses a locked search_path'
);
select ok(not has_function_privilege('anon', 'private.snapshot_live_context_on_encounter()', 'execute'), 'anon cannot invoke the snapshot trigger');
select ok(not has_function_privilege('authenticated', 'private.snapshot_live_context_on_encounter()', 'execute'), 'authenticated users cannot invoke the snapshot trigger');
select ok(
  exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.connection_encounters'::regclass and tgname = 'connection_encounters_snapshot_live_context' and not tgisinternal),
  'new encounters capture Live Context in a database trigger'
);

-- Local-only account fixtures. The transaction is rolled back at the end.
create temporary table lci_accounts (name text primary key, user_id uuid not null unique, username text not null unique);
create temporary table lci_ids (name text primary key, id uuid not null);
grant select on lci_accounts to anon, authenticated;
grant select, insert, update on lci_ids to authenticated;

insert into lci_accounts (name, user_id, username)
select generated.name, generated.user_id,
  'lci_' || generated.name || '_' || pg_catalog.substr(pg_catalog.replace(generated.user_id::text, '-', ''), 1, 8)
from (select names.name, pg_catalog.gen_random_uuid() as user_id from (values ('owner'), ('visitor'), ('other')) as names(name)) as generated;

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
select user_id, 'authenticated', 'authenticated', username || '@example.test',
  pg_catalog.jsonb_build_object('username', username, 'display_name', pg_catalog.initcap(name)),
  pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
from lci_accounts;

update public.profiles set is_published = true where id in (select user_id from lci_accounts);
update public.profile_modes set is_enabled = true where profile_id in (select user_id from lci_accounts) and slug = 'personal';

-- Owner creates a Live Context with no location and persists an explicit locale.
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from lci_accounts where name = 'owner'), 'role', 'authenticated')::text, true);
insert into lci_ids (name, id)
select 'first_context', public.set_active_live_context(
  'event', 'Slush', pg_catalog.statement_timestamp() + interval '4 hours', null, null, null,
  pg_catalog.statement_timestamp() - interval '5 minutes', 'manual', false
);
select lives_ok($$select public.set_account_locale('nl-NL')$$, 'the owner can save an explicit locale');
select is((select preferred_locale from public.account_preferences where user_id = (select user_id from lci_accounts where name = 'owner')), 'nl-NL', 'the owner preference is stored');
select is((select region_code from public.account_preferences where user_id = (select user_id from lci_accounts where name = 'owner')), null, 'locale does not infer or mutate region');
select is((select count(*)::integer from public.live_contexts where owner_user_id = (select user_id from lci_accounts where name = 'owner')), 1, 'a location-free context is valid and owner-readable');
reset role;

-- Another account cannot read or mutate the owner's private context/preferences.
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from lci_accounts where name = 'other'), 'role', 'authenticated')::text, true);
select is((select count(*)::integer from public.live_contexts where owner_user_id = (select user_id from lci_accounts where name = 'owner')), 0, 'another account cannot read the owner context');
select is((select count(*)::integer from public.account_preferences where user_id = (select user_id from lci_accounts where name = 'owner')), 0, 'another account cannot read the owner preference');
update public.live_contexts set label = 'Forged' where id = (select id from lci_ids where name = 'first_context');
select is((select count(*)::integer from public.live_contexts where id = (select id from lci_ids where name = 'first_context')), 0, 'another account cannot target the owner context');
update public.account_preferences set preferred_locale = 'en' where user_id = (select user_id from lci_accounts where name = 'owner');
select throws_ok(
  $$insert into public.live_contexts (owner_user_id, context_type, label, expires_at) values ((select user_id from lci_accounts where name = 'owner'), 'event', 'Forged', pg_catalog.statement_timestamp() + interval '1 hour')$$,
  '42501', null, 'another account cannot create a context for the owner'
);
reset role;

select ok(
  exists (select 1 from public.live_contexts where id = (select id from lci_ids where name = 'first_context') and label = 'Slush'),
  'an unauthorized update left the owner context unchanged'
);

-- A visitor connects to the owner's published profile. The owner's explicit
-- active context is copied once, with no FK back to its mutable source row.
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from lci_accounts where name = 'visitor'), 'role', 'authenticated')::text, true);
insert into lci_ids (name, id)
select 'event_encounter', (result.value ->> 'encounter_id')::uuid
from (select public.connect_registered((select username from lci_accounts where name = 'owner'), 'personal', 'personal', pg_catalog.gen_random_uuid(), 'link', null) as value) as result;
select is((select live_context_label_snapshot from public.connection_encounters where id = (select id from lci_ids where name = 'event_encounter')), 'Slush', 'the encounter receives the active context snapshot');
select is((select live_context_type_snapshot from public.connection_encounters where id = (select id from lci_ids where name = 'event_encounter')), 'event', 'the encounter preserves its context type');
select is((select live_context_city_snapshot from public.connection_encounters where id = (select id from lci_ids where name = 'event_encounter')), null, 'a location-free context stays location-free in history');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from lci_accounts where name = 'owner'), 'role', 'authenticated')::text, true);
update public.live_contexts set label = 'Changed later' where id = (select id from lci_ids where name = 'first_context');
select is((select label from public.live_contexts where id = (select id from lci_ids where name = 'first_context')), 'Changed later', 'the owner can update their own context');
delete from public.live_contexts where id = (select id from lci_ids where name = 'first_context');
select is((select count(*)::integer from public.live_contexts where id = (select id from lci_ids where name = 'first_context')), 0, 'the owner can delete their own context');
reset role;
select is((select live_context_label_snapshot from public.connection_encounters where id = (select id from lci_ids where name = 'event_encounter')), 'Slush', 'editing and deleting context never rewrites an existing encounter');

-- Future-start, expired, meeting, and custom contexts are not misclassified as
-- Event stamps. A confirmed event gets an Event stamp through the snapshot path.
select is((select count(*)::integer from public.passport_stamps where user_id = (select user_id from lci_accounts where name = 'owner') and stamp_type = 'event' and title = 'Slush'), 1, 'an explicit Event context contributes an Event stamp');

-- Existing Event Mode details are presentation only. When no Live Context is
-- active, they are not copied into Encounter location/event columns or Passport.
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from lci_accounts where name = 'owner'), 'role', 'authenticated')::text, true);
update public.profile_modes
   set settings = coalesce(settings, '{}'::jsonb) || pg_catalog.jsonb_build_object(
     'eventName', 'Mode-only Summit', 'city', 'Berlin', 'dateLabel', 'Nov 2026', 'countryCode', 'DE'
   )
 where profile_id = (select user_id from lci_accounts where name = 'owner') and slug = 'event';
reset role;
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub', (select user_id from lci_accounts where name = 'visitor'), 'role', 'authenticated')::text, true);
insert into lci_ids (name, id)
select 'mode_only_encounter', (result.value ->> 'encounter_id')::uuid
from (select public.connect_registered((select username from lci_accounts where name = 'owner'), 'event', 'personal', pg_catalog.gen_random_uuid(), 'link', null) as value) as result;
reset role;
select is((select count(*)::integer from public.connection_encounters
  where id = (select id from lci_ids where name = 'mode_only_encounter')
    and event_name is null and city is null and date_label is null and country_code is null
    and live_context_id_snapshot is null), 1,
  'an Event Mode without explicit Live Context does not become Encounter context');
select is((select count(*)::integer from public.passport_stamps
  where user_id = (select user_id from lci_accounts where name = 'owner') and stamp_type = 'event' and title = 'Mode-only Summit'), 0,
  'Event Mode labels alone do not award Passport event stamps');

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from lci_accounts where name = 'owner'), 'role', 'authenticated')::text, true);
select public.set_active_live_context(
  'meeting', 'Investor catch-up', pg_catalog.statement_timestamp() + interval '4 hours', null, 'Amsterdam', 'NL',
  pg_catalog.statement_timestamp() - interval '5 minutes', 'manual', false
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from lci_accounts where name = 'visitor'), 'role', 'authenticated')::text, true);
insert into lci_ids (name, id)
select 'meeting_encounter', (result.value ->> 'encounter_id')::uuid
from (select public.connect_registered((select username from lci_accounts where name = 'owner'), 'personal', 'personal', pg_catalog.gen_random_uuid(), 'link', null) as value) as result;
reset role;
select is((select live_context_label_snapshot from public.connection_encounters where id = (select id from lci_ids where name = 'meeting_encounter')), 'Investor catch-up', 'a meeting context is snapshotted');
select is((select count(*)::integer from public.passport_stamps where user_id = (select user_id from lci_accounts where name = 'owner') and stamp_type = 'event' and title = 'Investor catch-up'), 0, 'meeting labels are not Event collectibles');

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from lci_accounts where name = 'owner'), 'role', 'authenticated')::text, true);
select public.set_active_live_context(
  'custom', 'Design Week', pg_catalog.statement_timestamp() + interval '4 hours', null, 'Amsterdam', 'NL',
  pg_catalog.statement_timestamp() - interval '5 minutes', 'manual', false
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from lci_accounts where name = 'visitor'), 'role', 'authenticated')::text, true);
insert into lci_ids (name, id)
select 'custom_encounter', (result.value ->> 'encounter_id')::uuid
from (select public.connect_registered((select username from lci_accounts where name = 'owner'), 'personal', 'personal', pg_catalog.gen_random_uuid(), 'link', null) as value) as result;
reset role;
select is((select count(*)::integer from public.passport_stamps where user_id = (select user_id from lci_accounts where name = 'owner') and stamp_type = 'event' and title = 'Design Week'), 0, 'custom labels are not Event collectibles');

-- A direct expired row models a context whose expiry passed while the app was
-- offline. The insertion trigger must not copy it into a fresh Connection.
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from lci_accounts where name = 'owner'), 'role', 'authenticated')::text, true);
delete from public.live_contexts where owner_user_id = (select user_id from lci_accounts where name = 'owner') and is_active;
reset role;
insert into public.live_contexts (owner_user_id, context_type, label, city, country_code, starts_at, expires_at, is_active, created_at, updated_at)
select user_id, 'event', 'Expired Summit', 'Berlin', 'DE', null,
  pg_catalog.statement_timestamp() - interval '1 minute', true,
  pg_catalog.statement_timestamp() - interval '1 hour', pg_catalog.statement_timestamp() - interval '1 hour'
from lci_accounts where name = 'owner';
set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object('sub', (select user_id from lci_accounts where name = 'visitor'), 'role', 'authenticated')::text, true);
insert into lci_ids (name, id)
select 'expired_encounter', (result.value ->> 'encounter_id')::uuid
from (select public.connect_registered((select username from lci_accounts where name = 'owner'), 'personal', 'personal', pg_catalog.gen_random_uuid(), 'link', null) as value) as result;
reset role;
select is((select live_context_id_snapshot from public.connection_encounters where id = (select id from lci_ids where name = 'expired_encounter')), null, 'an expired Live Context is not attached to a new Connection');

select * from finish();
rollback;
