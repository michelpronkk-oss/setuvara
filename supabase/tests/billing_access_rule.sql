begin;
select plan(8);
-- The same cases as subscriptionHasAccess in tests/billing/billing.test.mjs: one rule in both places.
select ok(public.billing_subscription_has_access('active', now() + interval '1 day', false, null), 'active with a future period end grants access');
select ok(not public.billing_subscription_has_access('active', null, false, null), 'active without a period end fails closed');
select ok(not public.billing_subscription_has_access('active', now() - interval '1 day', false, null), 'a stale active period end fails closed');
select ok(public.billing_subscription_has_access('active', now() + interval '1 day', true, null), 'cancelling at the period end keeps access until then');
select ok(not public.billing_subscription_has_access('active', null, true, null), 'cancelling without a period end fails closed');
select ok(public.billing_subscription_has_access('past_due', null, false, now() + interval '1 day'), 'past due keeps access during its grace');
select ok(not public.billing_subscription_has_access('past_due', null, false, now() - interval '1 day'), 'and loses it after');
select ok(not public.billing_subscription_has_access('failed', now() + interval '1 day', false, null), 'other statuses never grant access');
select * from finish();
rollback;
