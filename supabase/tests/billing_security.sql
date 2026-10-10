begin;

select plan(76);

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.billing_customers'::regclass),
  'billing_customers has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.billing_subscriptions'::regclass),
  'billing_subscriptions has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.billing_checkout_attempts'::regclass),
  'billing_checkout_attempts has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.billing_webhook_events'::regclass),
  'billing_webhook_events has RLS enabled'
);

select ok(
  not has_table_privilege(role_name, table_name, privilege_name),
  format('%s has no %s privilege on %s', role_name, privilege_name, table_name)
)
from (values ('anon'::name), ('authenticated'::name)) as roles(role_name)
cross join (values
  ('public.billing_customers'::text),
  ('public.billing_subscriptions'::text),
  ('public.billing_checkout_attempts'::text),
  ('public.billing_webhook_events'::text)
) as tables(table_name)
cross join (values ('select'::text), ('insert'::text), ('update'::text), ('delete'::text)) as privileges(privilege_name);

select ok(
  not has_function_privilege(role_name, function_name::regprocedure, 'execute'),
  format('%s cannot execute %s', role_name, function_name)
)
from (values ('anon'::name), ('authenticated'::name)) as roles(role_name)
cross join (values
  ('public.reserve_billing_checkout(uuid,uuid,text,text,text)'::text),
  ('public.store_billing_checkout_session(uuid,text,text)'::text),
  ('public.fail_billing_checkout_attempt(uuid)'::text),
  ('public.claim_billing_webhook_event(text,text,timestamptz)'::text),
  ('public.sync_billing_subscription(uuid,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean,timestamptz,timestamptz,text,timestamptz,timestamptz)'::text),
  ('public.billing_subscription_has_access(text,timestamptz,boolean,timestamptz)'::text)
) as functions(function_name);

select ok(
  has_function_privilege('service_role', function_name::regprocedure, 'execute'),
  format('service_role can execute %s', function_name)
)
from (values
  ('public.reserve_billing_checkout(uuid,uuid,text,text,text)'::text),
  ('public.store_billing_checkout_session(uuid,text,text)'::text),
  ('public.fail_billing_checkout_attempt(uuid)'::text),
  ('public.claim_billing_webhook_event(text,text,timestamptz)'::text),
  ('public.sync_billing_subscription(uuid,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean,timestamptz,timestamptz,text,timestamptz,timestamptz)'::text),
  ('public.billing_subscription_has_access(text,timestamptz,boolean,timestamptz)'::text)
) as functions(function_name);

select ok(
  has_function_privilege('anon', 'public.get_public_profile_billing_entitlements(text)', 'execute'),
  'anon may call the limited public entitlement function'
);
select ok(
  has_function_privilege('authenticated', 'public.get_public_profile_billing_entitlements(text)', 'execute'),
  'authenticated may call the limited public entitlement function'
);
select ok(
  (select proretset and prorettype = 'record'::regtype and prosecdef
      and proconfig @> array['search_path=""']
   from pg_catalog.pg_proc
   where oid = 'public.get_public_profile_billing_entitlements(text)'::regprocedure),
  'public entitlement function is security-definer with locked search_path and table return shape'
);
select ok(
  (select p.proallargtypes[2:3] = array['boolean'::regtype::oid, 'boolean'::regtype::oid]
   from pg_catalog.pg_proc p
   where p.oid = 'public.get_public_profile_billing_entitlements(text)'::regprocedure),
  'public entitlement function returns only two booleans'
);

create temporary table billing_test_accounts (
  scenario text primary key,
  user_id uuid not null unique,
  username text not null unique
);

insert into billing_test_accounts (scenario, user_id, username)
select generated.scenario, generated.user_id,
  'bill_' || pg_catalog.substr(pg_catalog.replace(generated.user_id::text, '-', ''), 1, 12)
from (
  select scenarios.scenario, gen_random_uuid() as user_id
  from (values
    ('free'), ('plus'), ('pro'), ('expired'), ('unknown_product'), ('unpublished')
  ) as scenarios(scenario)
) as generated;

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
select user_id, 'authenticated', 'authenticated', username || '@example.test',
  pg_catalog.jsonb_build_object('username', username, 'display_name', 'Billing Test'),
  pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
from billing_test_accounts;

update public.profiles
set is_published = scenario <> 'unpublished'
from billing_test_accounts
where profiles.id = billing_test_accounts.user_id;

insert into public.billing_customers (user_id, dodo_customer_id)
select user_id, 'cus_' || pg_catalog.replace(user_id::text, '-', '')
from billing_test_accounts
where scenario in ('plus', 'pro', 'expired', 'unknown_product');

insert into public.billing_subscriptions (
  dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id,
  plan_code, billing_interval, provider_status, current_period_start,
  current_period_end, past_due_ends_at, last_provider_event_id,
  last_provider_event_at, last_sync_started_at
)
select
  'sub_' || pg_catalog.replace(account.user_id::text, '-', ''), account.user_id,
  'cus_' || pg_catalog.replace(account.user_id::text, '-', ''),
  case account.scenario when 'unknown_product' then 'pdt_unknown123' else 'pdt_fixture123' end,
  case account.scenario when 'plus' then 'plus' when 'pro' then 'pro' when 'expired' then 'plus' else null end,
  case account.scenario when 'plus' then 'monthly' when 'pro' then 'yearly' when 'expired' then 'monthly' else null end,
  case account.scenario when 'expired' then 'expired' else 'active' end,
  pg_catalog.statement_timestamp() - interval '1 day',
  case account.scenario when 'expired' then pg_catalog.statement_timestamp() - interval '1 second'
    else pg_catalog.statement_timestamp() + interval '1 year' end,
  null, 'billing_fixture_' || account.scenario,
  pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
from billing_test_accounts account
where account.scenario in ('plus', 'pro', 'expired', 'unknown_product');

select is(
  (select entitlements.verified_badge::text || ',' || entitlements.remove_setuvara_branding::text
   from public.get_public_profile_billing_entitlements((select username from billing_test_accounts where scenario = 'free')) entitlements),
  'false,false', 'a published profile with no billing row resolves to Free public entitlements'
);
select is(
  (select entitlements.verified_badge::text || ',' || entitlements.remove_setuvara_branding::text
   from public.get_public_profile_billing_entitlements((select username from billing_test_accounts where scenario = 'plus')) entitlements),
  'true,false', 'an active Plus subscription grants a member badge but keeps attribution enabled'
);
select is(
  (select entitlements.verified_badge::text || ',' || entitlements.remove_setuvara_branding::text
   from public.get_public_profile_billing_entitlements((select username from billing_test_accounts where scenario = 'pro')) entitlements),
  'true,false', 'an active Pro subscription grants a member badge but keeps attribution enabled'
);
select is(
  (select entitlements.verified_badge::text || ',' || entitlements.remove_setuvara_branding::text
   from public.get_public_profile_billing_entitlements((select username from billing_test_accounts where scenario = 'expired')) entitlements),
  'false,false', 'an ended subscription grants no public billing flags'
);
select is(
  (select entitlements.verified_badge::text || ',' || entitlements.remove_setuvara_branding::text
   from public.get_public_profile_billing_entitlements((select username from billing_test_accounts where scenario = 'unknown_product')) entitlements),
  'false,false', 'an unknown product mapped to no plan grants no public billing flags'
);
select is(
  (select count(*)::integer
   from public.get_public_profile_billing_entitlements((select username from billing_test_accounts where scenario = 'unpublished'))),
  0, 'unpublished profiles expose no public billing entitlements'
);

select is(
  public.reserve_billing_checkout(
    (select user_id from billing_test_accounts where scenario = 'free'),
    '11111111-1111-4111-8111-111111111111'::uuid,
    'plus', 'monthly', 'pdt_fixture123'
  ) ->> 'result',
  'created', 'checkout reservation creates an attempt for an eligible Free user'
);
select is(
  public.reserve_billing_checkout(
    (select user_id from billing_test_accounts where scenario = 'free'),
    '11111111-1111-4111-8111-111111111111'::uuid,
    'plus', 'monthly', 'pdt_fixture123'
  ) ->> 'result',
  'existing', 'repeated checkout reservation reuses the same idempotent attempt'
);
select ok(public.store_billing_checkout_session(
  (select id from public.billing_checkout_attempts where idempotency_key = '11111111-1111-4111-8111-111111111111'::uuid),
  'cs_fixture123', 'https://checkout.dodopayments.com/session/cs_fixture123'
), 'provider checkout session can be stored on its reservation');
select is(
  (select status from public.billing_checkout_attempts where idempotency_key = '11111111-1111-4111-8111-111111111111'::uuid),
  'open', 'stored checkout attempt transitions to open');
select is(
  public.reserve_billing_checkout(
    (select user_id from billing_test_accounts where scenario = 'free'),
    '11111111-1111-4111-8111-111111111111'::uuid,
    'plus', 'monthly', 'pdt_fixture123'
  ) ->> 'checkoutUrl',
  'https://checkout.dodopayments.com/session/cs_fixture123', 'retry returns the existing stored checkout URL');
select is(
  public.reserve_billing_checkout(
    (select user_id from billing_test_accounts where scenario = 'free'),
    '22222222-2222-4222-8222-222222222222'::uuid,
    'pro', 'yearly', 'pdt_fixture123'
  ) ->> 'result',
  'checkout_in_progress', 'a user cannot create a parallel active checkout reservation');

select is(
  public.claim_billing_webhook_event('billing_fixture.event', 'subscription.active', pg_catalog.statement_timestamp()),
  'claimed', 'the first provider event is claimed'
);
update public.billing_webhook_events
set processing_status = 'processed', processed_at = pg_catalog.statement_timestamp()
where provider_event_id = 'billing_fixture.event';
select is(
  public.claim_billing_webhook_event('billing_fixture.event', 'subscription.active', pg_catalog.statement_timestamp()),
  'duplicate', 'a processed provider event is idempotently rejected as a duplicate'
);
select is(
  (select count(*)::integer from public.billing_webhook_events where provider_event_id = 'billing_fixture.event'),
  1, 'duplicate delivery persists only one provider event row'
);

select ok(public.sync_billing_subscription(
  (select user_id from billing_test_accounts where scenario = 'plus'),
  'sub_' || pg_catalog.replace((select user_id::text from billing_test_accounts where scenario = 'plus'), '-', ''),
  'cus_' || pg_catalog.replace((select user_id::text from billing_test_accounts where scenario = 'plus'), '-', ''),
  'pdt_fixture123', 'pro', 'yearly', 'active', pg_catalog.statement_timestamp(),
  pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp() + interval '2 years',
  false, null, null, 'billing_fixture.newer_event', pg_catalog.statement_timestamp() + interval '2 seconds',
  pg_catalog.statement_timestamp() + interval '2 seconds'
), 'a newer verified provider snapshot is accepted');
select ok(not public.sync_billing_subscription(
  (select user_id from billing_test_accounts where scenario = 'plus'),
  'sub_' || pg_catalog.replace((select user_id::text from billing_test_accounts where scenario = 'plus'), '-', ''),
  'cus_' || pg_catalog.replace((select user_id::text from billing_test_accounts where scenario = 'plus'), '-', ''),
  'pdt_fixture123', 'plus', 'monthly', 'cancelled', pg_catalog.statement_timestamp(),
  pg_catalog.statement_timestamp() - interval '2 years', pg_catalog.statement_timestamp() - interval '1 year',
  true, pg_catalog.statement_timestamp(), null, 'billing_fixture.stale_event', pg_catalog.statement_timestamp(),
  pg_catalog.statement_timestamp()
), 'a stale provider snapshot cannot replace newer canonical billing state');
select is(
  (select plan_code || ':' || provider_status || ':' || last_provider_event_id
   from public.billing_subscriptions
   where user_id = (select user_id from billing_test_accounts where scenario = 'plus')),
  'pro:active:billing_fixture.newer_event', 'newer canonical provider state remains stored after stale synchronization'
);

select * from finish();
rollback;
