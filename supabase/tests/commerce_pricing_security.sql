begin;

select plan(17);

-- The approved pricing rows.
select is((select count(*)::integer from public.creator_fee_policies where note = 'Approved pricing: Free 5%, Plus 0%, Pro 0%'), 9, 'one rule per plan for EUR, USD and GBP');
select is((select array_agg(distinct platform_fee_bps order by platform_fee_bps) from public.creator_fee_policies where note like 'Approved pricing%' and plan_code = 'free'), array[500], 'Free pays 5%');
select is((select array_agg(distinct platform_fee_bps) from public.creator_fee_policies where note like 'Approved pricing%' and plan_code in ('plus','pro')), array[0], 'Plus and Pro pay 0%');

-- A seller with Stripe enabled and two products.
create temporary table cp(kind text primary key, id uuid);
grant select, insert on cp to anon, authenticated, service_role;
insert into cp values ('seller', gen_random_uuid());
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select id,'authenticated','authenticated','cp_'||substr(replace(id::text,'-',''),1,10)||'@example.test',
  jsonb_build_object('username','cp_'||substr(replace(id::text,'-',''),1,10),'display_name','Seller'),now(),now(),now() from cp where kind='seller';
update public.profiles set is_published=true where id=(select id from cp where kind='seller');
update public.profile_modes set is_enabled=true where slug='creator' and profile_id=(select id from cp where kind='seller');

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from cp where kind='seller'),'role','authenticated')::text, true);
select public.creator_submit_monetization_application('NL','commerce-2026-10');
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.commerce_sync_seller((select id from cp where kind='seller'),'stripe','acct_cp_seller','NL','eur',true,true,true,'active','active','{}','{}','{}','[]',null,null,false,false);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from cp where kind='seller'),'role','authenticated')::text, true);
with x as (insert into public.creator_offers(creator_user_id,kind,offer_type,title,currency,unit_amount_minor,status)
  values (auth.uid(),'one_time','service','Portfolio review','EUR',1500,'active') returning id) insert into cp select 'offer15', id from x;
with x as (insert into public.creator_offers(creator_user_id,kind,offer_type,title,currency,unit_amount_minor,status)
  values (auth.uid(),'one_time','service','Quick call','EUR',999,'active') returning id) insert into cp select 'offer999', id from x;
reset role;

create function pg_temp.buy(p_offer text, p_key text) returns uuid language sql as $$
  select (public.commerce_begin_checkout((select id from cp where kind=p_offer), null, 'buyer@example.test', null, p_key, null, 'stripe', false)->>'order_id')::uuid
$$;
create function pg_temp.fee(p_order uuid) returns bigint language sql as $$ select platform_fee_amount_minor from public.creator_orders where id=p_order $$;

-- Free plan: 5%, rounded down, snapshotted.
insert into cp select 'o_free', pg_temp.buy('offer15', 'cp-key-000000000001');
select is(pg_temp.fee((select id from cp where kind='o_free')), 75::bigint, 'Free: 5% of 15.00 is 0.75');
select is((select platform_fee_bps from public.creator_orders where id=(select id from cp where kind='o_free')), 500, 'the rate is kept on the order');
select is((select creator_net_amount_minor from public.creator_orders where id=(select id from cp where kind='o_free')), 1425::bigint, 'the seller keeps 14.25 before Stripe');
select isnt((select fee_policy_id from public.creator_orders where id=(select id from cp where kind='o_free')), null, 'the rule used is recorded');
select is(pg_temp.fee(pg_temp.buy('offer999', 'cp-key-000000000002')), 49::bigint, 'Free: 5% of 9.99 rounds down to 0.49');

-- Upgrading to Plus: new orders carry no fee; the earlier order keeps its fee.
insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at, current_period_end)
select 'sub_CpSeller', id, 'cus_CpSeller', 'pdt_CpPlus', 'plus', 'monthly', 'active', 'cp-fixture', now(), now(), now() + interval '30 days' from cp where kind='seller';
select is(pg_temp.fee(pg_temp.buy('offer15', 'cp-key-000000000003')), 0::bigint, 'Plus: no Setuvara fee');
select is(pg_temp.fee((select id from cp where kind='o_free')), 75::bigint, 'an earlier order is not recalculated after a plan change');
select throws_ok($$update public.creator_orders set platform_fee_amount_minor=0, creator_net_amount_minor=1500 where id=(select id from cp where kind='o_free')$$,
  '23514', 'Creator order snapshots are immutable', 'a fee snapshot cannot be edited');

-- Plus has run out: the seller is Free again.
update public.billing_subscriptions set current_period_end = now() - interval '1 day' where dodo_subscription_id='sub_CpSeller';
select is(pg_temp.fee(pg_temp.buy('offer15', 'cp-key-000000000004')), 75::bigint, 'an expired subscription pays the Free fee');

-- The reconciliation lease: one run at a time.
set local role service_role;
insert into cp select 'run1', public.commerce_job_begin('cp_test', 60);
select isnt((select id from cp where kind='run1'), null, 'a run starts');
select is(public.commerce_job_begin('cp_test', 60), null, 'a second run waits while the first holds the lease');
select public.commerce_job_finish((select id from cp where kind='run1'), true, '{"errors":0}', null);
select isnt(public.commerce_job_begin('cp_test', 60), null, 'after the first run finishes, the next one starts');

-- The caller secret never leaves Vault, and only the server can ask about it.
select ok(public.commerce_cron_token_valid((select decrypted_secret from vault.decrypted_secrets where name='setuvara_commerce_reconcile'))
  and not public.commerce_cron_token_valid(repeat('a', 64)) and not public.commerce_cron_token_valid(null), 'only the Vault secret is accepted');
reset role;
select ok(not has_function_privilege('anon','public.commerce_cron_token_valid(text)','execute')
  and not has_function_privilege('authenticated','public.commerce_job_begin(text,integer)','execute')
  and not has_table_privilege('authenticated','public.commerce_job_runs','select'), 'members and visitors cannot reach the job functions or log');

select * from finish();
rollback;
