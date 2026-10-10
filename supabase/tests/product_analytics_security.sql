begin;

select no_plan();

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'private.product_analytics_events'::regclass),
  'analytics facts have RLS enabled'
);

select ok(
  not has_table_privilege(role_name, 'private.product_analytics_events', privilege_name),
  format('%s has no %s privilege on analytics facts', role_name, privilege_name)
)
from (values ('public'::name), ('anon'::name), ('authenticated'::name), ('service_role'::name)) as roles(role_name)
cross join (values ('select'::text), ('insert'::text), ('update'::text), ('delete'::text)) as privileges(privilege_name);

select ok(
  not has_function_privilege(role_name, function_name::regprocedure, 'execute'),
  format('%s cannot execute %s', role_name, function_name)
)
from (values ('public'::name), ('anon'::name), ('authenticated'::name)) as roles(role_name)
cross join (values
  ('public.record_product_analytics_event(text,uuid,uuid,text,text,text)'::text),
  ('public.get_profile_analytics(uuid,text,text,date,date,text,text,uuid)'::text),
  ('public.get_internal_product_analytics(date,date)'::text)
) as functions(function_name);

select ok(
  has_function_privilege('service_role', function_name::regprocedure, 'execute'),
  format('service_role can execute %s', function_name)
)
from (values
  ('public.record_product_analytics_event(text,uuid,uuid,text,text,text)'::text),
  ('public.get_profile_analytics(uuid,text,text,date,date,text,text,uuid)'::text),
  ('public.get_internal_product_analytics(date,date)'::text)
) as functions(function_name);

select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_catalog.pg_proc as p
   where p.oid = function_name::regprocedure),
  format('%s is SECURITY DEFINER with a locked search_path', function_name)
)
from (values
  ('public.record_product_analytics_event(text,uuid,uuid,text,text,text)'::text),
  ('public.get_profile_analytics(uuid,text,text,date,date,text,text,uuid)'::text),
  ('public.get_internal_product_analytics(date,date)'::text)
) as functions(function_name);

select ok(
  (select p.prorettype = 'jsonb'::regtype
   from pg_catalog.pg_proc as p
   where p.oid = 'public.get_profile_analytics(uuid,text,text,date,date,text,text,uuid)'::regprocedure),
  'profile analytics returns aggregate JSON only'
);
select ok(
  (select p.prorettype = 'jsonb'::regtype
   from pg_catalog.pg_proc as p
   where p.oid = 'public.get_internal_product_analytics(date,date)'::regprocedure),
  'internal analytics returns aggregate JSON only'
);

create temporary table analytics_test_accounts (
  scenario text primary key,
  user_id uuid not null unique,
  username text not null unique
);

insert into analytics_test_accounts (scenario, user_id, username)
select scenario, user_id,
  'an_' || pg_catalog.substr(pg_catalog.replace(user_id::text, '-', ''), 1, 18)
from (
  select scenarios.scenario, gen_random_uuid() as user_id
  from (values ('free'), ('plus'), ('pro')) as scenarios(scenario)
) as generated;

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
select user_id, 'authenticated', 'authenticated', username || '@example.test',
  pg_catalog.jsonb_build_object('username', username, 'display_name', 'Analytics Test'),
  pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
from analytics_test_accounts;

update public.profiles
set is_published = true
where id in (select user_id from analytics_test_accounts);

insert into public.billing_customers (user_id, dodo_customer_id)
select user_id, 'cus_' || pg_catalog.replace(user_id::text, '-', '')
from analytics_test_accounts
where scenario in ('plus', 'pro');

insert into public.billing_subscriptions (
  dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id,
  plan_code, billing_interval, provider_status, current_period_start,
  current_period_end, last_provider_event_id, last_provider_event_at,
  last_sync_started_at
)
select
  'sub_' || pg_catalog.replace(accounts.user_id::text, '-', ''), accounts.user_id,
  'cus_' || pg_catalog.replace(accounts.user_id::text, '-', ''), 'pdt_analyticsfixture',
  accounts.scenario, 'monthly', 'active',
  pg_catalog.statement_timestamp() - interval '1 day',
  pg_catalog.statement_timestamp() + interval '1 year',
  'analytics_' || accounts.scenario,
  pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
from analytics_test_accounts as accounts
where accounts.scenario in ('plus', 'pro');

select is(
  (select events.event_name from private.product_analytics_events as events
   where events.owner_profile_id = (select user_id from analytics_test_accounts where scenario = 'free')
     and events.event_name = 'identity_created'),
  'identity_created', 'a newly created identity is recorded from the profile trigger'
);
select is(
  (select events.event_name from private.product_analytics_events as events
   where events.owner_profile_id = (select user_id from analytics_test_accounts where scenario = 'free')
     and events.event_name = 'identity_completed'),
  'identity_completed', 'first publish records identity completion'
);

select ok(public.record_product_analytics_event(
  'profile_viewed', '11111111-1111-4111-8111-111111111111'::uuid,
  (select user_id from analytics_test_accounts where scenario = 'plus'),
  'personal', 'qr', 'desktop'
), 'first profile view event is accepted');
select ok(public.record_product_analytics_event(
  'profile_viewed', '22222222-2222-4222-8222-222222222222'::uuid,
  (select user_id from analytics_test_accounts where scenario = 'plus'),
  'personal', 'direct', 'mobile'
), 'second profile view event is accepted');
select ok(public.record_product_analytics_event(
  'quick_qr_scanned', '33333333-3333-4333-8333-333333333333'::uuid,
  (select user_id from analytics_test_accounts where scenario = 'plus'),
  'personal', 'quick_qr', 'tablet'
), 'quick QR scan is separately recorded');
select ok(public.record_product_analytics_event(
  'profile_shared', '44444444-4444-4444-8444-444444444444'::uuid,
  (select user_id from analytics_test_accounts where scenario = 'plus'),
  'personal', 'share', 'unknown'
), 'share event is accepted');
select ok(public.record_product_analytics_event(
  'profile_shared', '55555555-5555-4555-8555-555555555555'::uuid,
  (select user_id from analytics_test_accounts where scenario = 'plus'),
  'business', 'native_share', 'unknown'
), 'repeat share event is accepted');
select is(public.record_product_analytics_event(
  'profile_shared', '55555555-5555-4555-8555-555555555555'::uuid,
  (select user_id from analytics_test_accounts where scenario = 'plus'),
  'business', 'native_share', 'unknown'
), false, 'duplicate share request is idempotently ignored');

select ok(public.record_product_analytics_event(
  'profile_viewed', '66666666-6666-4666-8666-666666666666'::uuid,
  (select user_id from analytics_test_accounts where scenario = 'pro'),
  'event', 'profile', 'mobile'
), 'Pro profile view records only a coarse device class');
select ok(public.record_product_analytics_event(
  'profile_shared', '77777777-7777-4777-8777-777777777777'::uuid,
  (select user_id from analytics_test_accounts where scenario = 'pro'),
  'event', 'share', 'unknown'
), 'Pro share is available for internal funnel aggregates');

create temporary table analytics_test_connections (
  scenario text primary key,
  connection_id uuid not null
);

insert into analytics_test_connections (scenario, connection_id)
values
  ('registered', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
  ('guest', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid);

insert into public.connections (
  id, user_id, connected_user_id,
  user_display_name_snapshot, connected_display_name_snapshot
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  (select user_id from analytics_test_accounts where scenario = 'plus'),
  (select user_id from analytics_test_accounts where scenario = 'free'),
  'Plus Test', 'Free Test'
);

insert into public.connection_encounters (
  connection_id, request_id, created_by_user_id, shared_by_user_id,
  shared_mode_slug, share_back_mode_slug, share_back_display_name,
  source, shared_display_name
)
values (
  (select connection_id from analytics_test_connections where scenario = 'registered'),
  '88888888-8888-4888-8888-888888888888'::uuid,
  (select user_id from analytics_test_accounts where scenario = 'free'),
  (select user_id from analytics_test_accounts where scenario = 'plus'),
  'personal', 'personal', 'Free Test', 'qr', 'Plus Test'
);

insert into public.guest_identities (id, display_name)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 'Analytics Guest');

insert into public.connections (
  id, user_id, guest_identity_id, user_display_name_snapshot,
  connected_display_name_snapshot, guest_display_name
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  (select user_id from analytics_test_accounts where scenario = 'pro'),
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
  'Pro Test', 'Analytics Guest', 'Analytics Guest'
);

insert into public.connection_encounters (
  connection_id, request_id, created_by_guest_id, shared_by_user_id,
  shared_mode_slug, source, shared_display_name
)
values (
  (select connection_id from analytics_test_connections where scenario = 'guest'),
  '99999999-9999-4999-8999-999999999999'::uuid,
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
  (select user_id from analytics_test_accounts where scenario = 'pro'),
  'event', 'tap', 'Pro Test'
);

update public.guest_identities
set claimed_user_id = (select user_id from analytics_test_accounts where scenario = 'free')
where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid;

select is(
  (public.get_profile_analytics(
    (select user_id from analytics_test_accounts where scenario = 'free'), 'free', '7d',
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) -> 'summary' ->> 'profile_views'),
  '0', 'missing billing state resolves to the Free analytics matrix'
);
select ok(not (public.get_profile_analytics(
    (select user_id from analytics_test_accounts where scenario = 'free'), 'free', '7d',
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) ? 'daily'), 'Free reports contain no daily breakdown');

select is(
  (public.get_profile_analytics(
    (select user_id from analytics_test_accounts where scenario = 'plus'), 'plus', '7d',
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) -> 'summary' ->> 'profile_views'),
  '2', 'database-backed Plus report counts only the owner profile views'
);
select is(
  (public.get_profile_analytics(
    (select user_id from analytics_test_accounts where scenario = 'plus'), 'plus', '7d',
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) -> 'summary' ->> 'qr_scans'),
  '1', 'QR profile view is counted once in the QR metric'
);
select is(
  (public.get_profile_analytics(
    (select user_id from analytics_test_accounts where scenario = 'plus'), 'plus', '7d',
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) -> 'summary' ->> 'quick_qr_scans'),
  '1', 'Quick QR is counted separately from profile-view QR scans'
);
select is(
  (public.get_profile_analytics(
    (select user_id from analytics_test_accounts where scenario = 'plus'), 'plus', '7d',
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) -> 'summary' ->> 'connections'),
  '1', 'a completed registered connection is attributed once to each owner'
);
select is(
  pg_catalog.jsonb_array_length(public.get_profile_analytics(
    (select user_id from analytics_test_accounts where scenario = 'plus'), 'plus', '7d',
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) -> 'daily'),
  7, 'Plus receives daily rows for the requested seven-day range'
);
select ok(not (public.get_profile_analytics(
    (select user_id from analytics_test_accounts where scenario = 'plus'), 'plus', '7d',
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) ? 'funnel'), 'Plus cannot receive Pro funnel details');

select throws_ok(
  format($$select public.get_profile_analytics(%L::uuid, 'pro', '7d', (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6, (pg_catalog.statement_timestamp() at time zone 'UTC')::date)$$,
    (select user_id from analytics_test_accounts where scenario = 'free')),
  '42501', 'analytics_plan_mismatch', 'a Free account cannot claim a paid plan in the RPC'
);
select throws_ok(
  format($$select public.get_profile_analytics(%L::uuid, 'free', '30d', (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 29, (pg_catalog.statement_timestamp() at time zone 'UTC')::date)$$,
    (select user_id from analytics_test_accounts where scenario = 'free')),
  '42501', 'analytics_plan_limit', 'database enforcement rejects Free access to 30 days'
);
select throws_ok(
  format($$select public.get_profile_analytics(%L::uuid, 'plus', 'custom', (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6, (pg_catalog.statement_timestamp() at time zone 'UTC')::date)$$,
    (select user_id from analytics_test_accounts where scenario = 'plus')),
  '42501', 'analytics_plan_limit', 'database enforcement rejects Plus custom ranges'
);

select ok((public.get_profile_analytics(
    (select user_id from analytics_test_accounts where scenario = 'pro'), 'pro', 'custom',
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) ? 'funnel'), 'Pro receives the database-backed funnel');
select is(
  (public.get_profile_analytics(
    (select user_id from analytics_test_accounts where scenario = 'pro'), 'pro', 'custom',
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) -> 'devices' -> 0 ->> 'device_class'),
  'mobile', 'Pro receives only coarse device classes');

select is(
  (public.get_internal_product_analytics(
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) -> 'summary' ->> 'guest_connections'),
  '1', 'internal aggregation reports the actual guest connection');
select is(
  (public.get_internal_product_analytics(
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) -> 'summary' ->> 'guest_claims'),
  '1', 'internal aggregation reports the actual guest claim');
select is(
  (public.get_internal_product_analytics(
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) -> 'summary' ->> 'identities_created'),
  '3', 'internal aggregate counts newly created identities');
select is(
  (public.get_internal_product_analytics(
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) -> 'summary' ->> 'first_shares'),
  '2', 'internal aggregate separates first shares');
select is(
  (public.get_internal_product_analytics(
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) -> 'summary' ->> 'repeat_shares'),
  '1', 'internal aggregate separates repeat shares');
select is(
  (public.get_internal_product_analytics(
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date - 6,
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date
  ) -> 'summary' ->> 'new_connections_after_first_share'),
  '2', 'internal aggregate counts connections after a recorded share');

select ok(
  not has_table_privilege('authenticated', 'public.billing_subscriptions', 'update')
  and not has_table_privilege('authenticated', 'public.billing_subscriptions', 'insert'),
  'ordinary authenticated users cannot grant themselves paid plan state'
);

select * from finish();
rollback;
