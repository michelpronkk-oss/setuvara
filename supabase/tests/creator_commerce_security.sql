begin;

select plan(90);

-- Shape and grants.
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_offer_files'::regclass), 'offer files have RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_download_links'::regclass), 'download links have RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_refunds'::regclass), 'refunds have RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_disputes'::regclass), 'disputes have RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_offer_daily_stats'::regclass), 'product stats have RLS');
select ok(not (select public from storage.buckets where id='creator-commerce'), 'the product bucket is private');
select ok(not has_table_privilege('anon','public.creator_offer_files','select'), 'visitors cannot list product files');
select ok(not has_table_privilege('anon','public.creator_orders','select'), 'visitors cannot read orders');
select ok(not has_table_privilege('authenticated','public.creator_orders','insert'), 'members cannot create orders directly');
select ok(not has_table_privilege('authenticated','public.creator_orders','update'), 'members cannot edit orders');
select ok(not has_column_privilege('authenticated','public.creator_orders','buyer_ip_hash','select'), 'owners cannot read the buyer IP hash');
select ok(not has_column_privilege('authenticated','public.creator_download_links','token_hash','select'), 'owners cannot read download token hashes');
select ok(not has_table_privilege('authenticated','public.creator_refunds','insert'), 'members cannot record refunds');
select ok(not has_table_privilege('authenticated','public.creator_payout_accounts','update'), 'members cannot mark their own account as enabled');
select ok(not has_table_privilege('authenticated','public.creator_fee_policies','select'), 'members cannot read fee policies directly');
select ok(not has_function_privilege('anon','public.commerce_begin_checkout(uuid,uuid,text,text,text,text,text,boolean)','execute'), 'visitors cannot open checkouts without the server route');
select ok(not has_function_privilege('authenticated','public.commerce_record_payment(uuid,text,text,text,bigint,text,text,bigint,text,text)','execute'), 'members cannot mark orders paid');
select ok(not has_function_privilege('authenticated','public.commerce_sync_seller(uuid,text,text,text,text,boolean,boolean,boolean,text,text,text[],text[],text[],jsonb,text,timestamptz,boolean,boolean)','execute'), 'members cannot sync seller state');
select ok(not has_function_privilege('anon','public.commerce_use_download(text,uuid)','execute'), 'visitors cannot spend downloads without the server route');
select ok(not has_function_privilege('authenticated','public.admin_commerce_overview(date,date)','execute'), 'members cannot read the admin overview');
select ok(has_function_privilege('authenticated','public.commerce_seller_status()','execute'), 'owners read their seller status');
select ok(not has_function_privilege('anon','public.commerce_seller_status()','execute'), 'visitors cannot read seller status');

-- A seller, another creator and a buyer member.
create temporary table cm_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into cm_accounts select kind, id, 'cm_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('seller'),('other'),('buyer')) v(kind)) s;
grant select on cm_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from cm_accounts;
update public.profiles set is_published=true where id in (select user_id from cm_accounts);
update public.profile_modes set is_enabled=true where slug='creator' and profile_id in (select user_id from cm_accounts);
create temporary table cm_ids(name text primary key, id uuid, token text);
grant select, insert, update on cm_ids to anon, authenticated, service_role;

-- Uploaded objects (the storage API would create these).
insert into storage.objects(bucket_id, name, owner)
select 'creator-commerce', user_id||'/file/'||kind||'/pack.zip', user_id from cm_accounts where kind in ('seller','other')
union all select 'creator-commerce', user_id||'/file/seller/paid.zip', user_id from cm_accounts where kind='seller'
union all select 'creator-commerce', user_id||'/cover/a.webp', user_id from cm_accounts where kind='seller';

-- Owner builds products before payments are on.
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from cm_accounts where kind='seller'),'role','authenticated')::text, true);
with x as (insert into public.creator_offers(creator_user_id,kind,offer_type,title,currency,unit_amount_minor,status,cover_path)
  values (auth.uid(),'one_time','digital','Lightroom presets','EUR',1500,'draft',auth.uid()||'/cover/a.webp') returning id) insert into cm_ids(name,id) select 'paid', id from x;
with x as (insert into public.creator_offers(creator_user_id,kind,offer_type,title,currency,unit_amount_minor,status)
  values (auth.uid(),'one_time','digital','Free wallpaper pack','EUR',0,'draft') returning id) insert into cm_ids(name,id) select 'free', id from x;
select throws_ok($$update public.creator_offers set status='active' where id=(select id from cm_ids where name='free')$$,
  '23514', 'product_needs_file', 'a digital product cannot go live without a file');
select throws_ok($$insert into public.creator_offer_files(offer_id,creator_user_id,storage_path,file_name,size_bytes)
  values ((select id from cm_ids where name='free'), auth.uid(), (select user_id from cm_accounts where kind='other')||'/file/other/pack.zip', 'pack.zip', 100)$$,
  '42501', 'file_not_owned', 'a product cannot point at another creator''s file');
select throws_ok($$insert into public.creator_offer_files(offer_id,creator_user_id,storage_path,file_name,size_bytes)
  values ((select id from cm_ids where name='free'), auth.uid(), auth.uid()||'/file/missing.zip', 'missing.zip', 100)$$,
  '42501', 'file_not_owned', 'a product file must exist in storage');
insert into public.creator_offer_files(offer_id,creator_user_id,storage_path,file_name,size_bytes)
  values ((select id from cm_ids where name='free'), auth.uid(), auth.uid()||'/file/seller/pack.zip', 'pack.zip', 100);
update public.creator_offers set status='active' where id=(select id from cm_ids where name='free');
select is((select status from public.creator_offers where id=(select id from cm_ids where name='free')), 'active', 'a free product with a file goes live without payments');
select throws_ok($$delete from public.creator_offer_files where offer_id=(select id from cm_ids where name='free')$$,
  '23514', 'last_file_of_live_product', 'the last file of a live product cannot be removed');
select throws_ok($$update public.creator_offers set cover_path=(select user_id from cm_accounts where kind='other')||'/cover/x.webp' where id=(select id from cm_ids where name='paid')$$,
  '42501', 'cover_not_owned', 'a cover must sit in the owner''s folder');
select throws_ok($$insert into public.creator_offers(creator_user_id,kind,offer_type,title,currency,unit_amount_minor,status) values (auth.uid(),'one_time','physical','Print','EUR',2000,'active')$$,
  '23514', 'physical_not_available', 'physical products cannot go live');
select throws_ok($$insert into public.creator_offers(creator_user_id,kind,offer_type,title,currency,unit_amount_minor,status) values (auth.uid(),'one_time','service','Call','JPY',2000,'active')$$,
  '23514', 'currency_not_supported', 'only EUR, USD and GBP sell');
select throws_ok($$insert into public.creator_offers(creator_user_id,kind,offer_type,title,currency,unit_amount_minor,status) values (auth.uid(),'one_time','service','Call','EUR',20,'active')$$,
  '23514', 'price_below_minimum', 'prices below the card minimum are rejected');
select throws_ok($$insert into public.creator_offers(creator_user_id,kind,offer_type,title,currency,unit_amount_minor,status) values (auth.uid(),'one_time','service','Call','EUR',0,'draft')$$,
  '23514', null, 'only digital products can be free');
select throws_ok($$insert into public.creator_offers(creator_user_id,kind,offer_type,title,currency,unit_amount_minor,status) values (auth.uid(),'one_time','service','Call','EUR',5000,'active')$$,
  '42501', null, 'a paid product cannot go live before payments are enabled');
select throws_ok($$insert into public.creator_offers(creator_user_id,kind,offer_type,title,currency,unit_amount_minor) values ((select user_id from cm_accounts where kind='other'),'one_time','digital','Hijack','EUR',500)$$,
  '42501', null, 'a member cannot create products for someone else');
insert into public.creator_offer_files(offer_id,creator_user_id,storage_path,file_name,size_bytes)
  values ((select id from cm_ids where name='paid'), auth.uid(), auth.uid()||'/file/seller/paid.zip', 'paid.zip', 100);
select is((public.commerce_seller_status()->>'can_sell')::boolean, false, 'before onboarding the seller cannot sell');
select ok(public.commerce_seller_status()->'account' = 'null'::jsonb, 'before onboarding there is no account');
select is((public.creator_submit_monetization_application('NL','commerce-2026-10'))->>'application_status', 'applied', 'accepting the seller terms records an application');

-- Stripe says: details submitted, charges not yet enabled. Never "ready" on that alone.
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is((public.commerce_sync_seller((select user_id from cm_accounts where kind='seller'),'stripe','acct_seller1','NL','eur',false,false,true,'pending','pending','{}','{}','{individual.verification.document}','[]',null,null,false))->>'can_sell', 'false', 'a submitted but unverified account cannot sell');
select throws_ok($$select public.commerce_sync_seller((select user_id from cm_accounts where kind='other'),'stripe','acct_seller1','NL','eur',true,true,true,'active','active','{}','{}','{}','[]',null,null,false)$$,
  '42501', 'account_owned_by_another_member', 'one Stripe account cannot be claimed by two members');
select is((public.commerce_sync_seller((select user_id from cm_accounts where kind='seller'),'stripe','acct_seller1','NL','eur',true,true,true,'active','active','{}','{}','{}','[]',null,null,false))->>'can_sell', 'true', 'charges enabled by Stripe makes the seller able to sell');
select is((select application_status from public.creator_monetization_accounts where user_id=(select user_id from cm_accounts where kind='seller')), 'approved', 'approval follows Stripe enabling charges');

-- Now the paid product can go live; the other creator still cannot sell.
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from cm_accounts where kind='seller'),'role','authenticated')::text, true);
update public.creator_offers set status='active', quantity_limit=2 where id=(select id from cm_ids where name='paid');
select is((select status from public.creator_offers where id=(select id from cm_ids where name='paid')), 'active', 'a paid product goes live once the seller can sell');
select ok((public.commerce_seller_status()->'account'->>'charges_enabled')::boolean, 'the owner sees the synced account');
select ok(not (public.commerce_seller_status()->'account' ? 'provider_account_id'), 'the owner status never includes the Stripe account id');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::integer from public.creator_offers where creator_user_id=(select user_id from cm_accounts where kind='seller')), 2, 'visitors see both live products');
select throws_ok($$select count(*) from public.creator_offer_files$$, '42501', null, 'visitors cannot see product files');
select is(jsonb_array_length(public.get_creator_public_summary((select username from cm_accounts where kind='seller'))->'offers'), 2, 'the public summary lists live products');

-- Checkout: the database decides price, fee and seller.
reset role;
insert into public.creator_fee_policies(currency, platform_fee_bps, effective_from, plan_code, fixed_fee_minor, note)
  values ('EUR', 500, now() - interval '1 day', null, 0, 'test all plans'),
         ('EUR', 300, now() - interval '1 day', 'pro', 0, 'test pro');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok($$select public.commerce_begin_checkout((select id from cm_ids where name='paid'), null, 'not-an-email', null, 'key-0000000000000001', 'ip-a', 'stripe', false)$$,
  '22023', 'invalid_email', 'a buyer email is required');
select throws_ok($$select public.commerce_begin_checkout((select id from cm_ids where name='paid'), (select user_id from cm_accounts where kind='seller'), 'seller@example.test', null, 'key-0000000000000002', 'ip-a', 'stripe', false)$$,
  'P0001', 'own_offer', 'a creator cannot buy their own product');
select throws_ok($$select public.commerce_begin_checkout((select id from cm_ids where name='paid'), null, 'aanya@example.test', null, 'key-0000000000000003', 'ip-a', 'stripe', true)$$,
  'P0001', 'seller_unavailable', 'a test-mode seller cannot take live payments');
select throws_ok($$select public.commerce_begin_checkout((select id from cm_ids where name='free'), null, 'aanya@example.test', null, 'key-0000000000000004', 'ip-a', 'stripe', false)$$,
  'P0001', 'offer_is_free', 'free products do not open a checkout');
insert into cm_ids(name,id) select 'order1', (public.commerce_begin_checkout((select id from cm_ids where name='paid'), null, ' Aanya@Example.test ', 'Aanya Rao', 'key-0000000000000005', 'ip-a', 'stripe', false)->>'order_id')::uuid;
select is((select row(gross_amount_minor, platform_fee_amount_minor, creator_net_amount_minor, buyer_email, provider_account_id, status)::text from public.creator_orders where id=(select id from cm_ids where name='order1')),
  row(1500::bigint, 75::bigint, 1425::bigint, 'aanya@example.test', 'acct_seller1', 'pending')::text, 'the order snapshots price, the 5% policy fee and the seller');
select is((public.commerce_begin_checkout((select id from cm_ids where name='paid'), null, 'aanya@example.test', null, 'key-0000000000000005', 'ip-a', 'stripe', false)->>'existing'), 'true', 'a retried checkout returns the same order');
select is((select checkout_starts from public.creator_offer_daily_stats where offer_id=(select id from cm_ids where name='paid')), 1, 'checkout starts are counted once per order');
insert into cm_ids(name,id) select 'order2', (public.commerce_begin_checkout((select id from cm_ids where name='paid'), null, 'lucas@example.test', null, 'key-0000000000000006', 'ip-b', 'stripe', false)->>'order_id')::uuid;
select throws_ok($$select public.commerce_begin_checkout((select id from cm_ids where name='paid'), null, 'third@example.test', null, 'key-0000000000000007', 'ip-c', 'stripe', false)$$,
  'P0001', 'sold_out', 'open checkouts hold the quantity limit');
select public.commerce_attach_checkout((select id from cm_ids where name='order1'), 'cs_test_1', 'https://checkout.stripe.com/c/pay/cs_test_1', now() + interval '30 minutes');

-- Payment confirmation is checked against the snapshot.
select throws_ok($$select public.commerce_record_payment((select id from cm_ids where name='order1'), 'stripe', 'cs_test_1', 'pi_1', 1000, 'eur', 'acct_seller1', 75, 'NL', 'evt_bad')$$,
  'P0001', 'payment_mismatch', 'a different amount is refused');
select throws_ok($$select public.commerce_record_payment((select id from cm_ids where name='order1'), 'stripe', 'cs_test_1', 'pi_1', 1500, 'eur', 'acct_other', 75, 'NL', 'evt_bad')$$,
  'P0001', 'payment_mismatch', 'a different seller account is refused');
select throws_ok($$select public.commerce_record_payment((select id from cm_ids where name='order1'), 'stripe', 'cs_test_1', 'pi_1', 1500, 'eur', 'acct_seller1', 0, 'NL', 'evt_bad')$$,
  'P0001', 'payment_mismatch', 'a missing application fee is refused');
select throws_ok($$select public.commerce_issue_download((select id from cm_ids where name='order1'), repeat('0',64))$$,
  'P0001', 'order_not_deliverable', 'an unpaid order gets no download');
select is((public.commerce_record_payment((select id from cm_ids where name='order1'), 'stripe', 'cs_test_1', 'pi_1', 1500, 'eur', 'acct_seller1', 75, 'NL', 'evt_paid')->>'became_paid'), 'true', 'a matching payment marks the order paid');
select is((public.commerce_record_payment((select id from cm_ids where name='order1'), 'stripe', 'cs_test_1', 'pi_1', 1500, 'eur', 'acct_seller1', 75, 'NL', 'evt_paid_again')->>'became_paid'), 'false', 'a repeated payment event changes nothing');
select public.commerce_record_processing_fee((select id from cm_ids where name='order1'), 47, 'eur', 'evt_paid');
select public.commerce_record_processing_fee((select id from cm_ids where name='order1'), 99, 'eur', 'evt_paid_again');
select is((select array_agg(entry_type||':'||amount_minor order by entry_type)::text from public.creator_ledger_entries where order_id=(select id from cm_ids where name='order1')),
  '{payment_fee:-47,platform_fee:-75,sale:1500}', 'the ledger holds the sale, the Setuvara fee and the Stripe fee once each');
select is(public.commerce_set_order_state((select id from cm_ids where name='order1'), 'expired', 'checkout_expired'), 'paid', 'an expiry after payment cannot undo it');

-- Event replay protection.
select ok(public.commerce_receive_event('stripe','evt_1','checkout.session.completed','acct_seller1','cs_test_1',false,now()), 'a new event is processed');
select ok(not public.commerce_receive_event('stripe','evt_1','checkout.session.completed','acct_seller1','cs_test_1',false,now()), 'the same event in flight is not processed twice');
select public.commerce_finish_event('stripe','evt_1','processed',null);
select ok(not public.commerce_receive_event('stripe','evt_1','checkout.session.completed','acct_seller1','cs_test_1',false,now()), 'a processed event is never replayed');
select public.commerce_receive_event('stripe','evt_2','checkout.session.completed','acct_seller1','cs_test_1',false,now());
select public.commerce_finish_event('stripe','evt_2','failed','record_payment_failed');
select ok(public.commerce_receive_event('stripe','evt_2','checkout.session.completed','acct_seller1','cs_test_1',false,now()), 'a failed event runs again on retry');

-- Delivery: hashed tokens, limits, revocation.
update cm_ids set token=repeat('a',64) where name='order1';
select is((public.commerce_issue_download((select id from cm_ids where name='order1'), repeat('a',64))->>'max_downloads')::integer, 10, 'a paid order gets a download link with the product limit');
select is(public.commerce_open_download(repeat('a',64))->>'state', 'ok', 'the link opens');
select is(jsonb_array_length(public.commerce_open_download(repeat('a',64))->'files'), 1, 'the link lists the product files');
select is(public.commerce_use_download(repeat('a',64), (select id from public.creator_offer_files where offer_id=(select id from cm_ids where name='paid') limit 1))->>'file_name', 'paid.zip', 'a download spends one use and returns the file');
select throws_ok($$select public.commerce_use_download(repeat('a',64), (select id from public.creator_offer_files where offer_id=(select id from cm_ids where name='free') limit 1))$$,
  'P0001', 'link_not_found', 'a link cannot fetch another product''s file');
select is(public.commerce_open_download(repeat('f',64))->>'state', 'not_found', 'an unknown token opens nothing');

-- Refunds: partial keeps access, full revokes it; the fee returned is recorded.
select is(public.commerce_record_refund((select id from cm_ids where name='order1'), 'stripe', 're_1', 500, 'eur', 'succeeded', 25, 'requested_by_customer', null)->>'order_status', 'partially_refunded', 'a partial refund keeps the order');
select is(public.commerce_record_refund((select id from cm_ids where name='order1'), 'stripe', 're_1', 500, 'eur', 'succeeded', 25, 'requested_by_customer', null)->>'amount_refunded_minor', '500', 'a repeated refund event is counted once');
select is(public.commerce_open_download(repeat('a',64))->>'state', 'ok', 'a partial refund keeps download access');
select is(public.commerce_record_refund((select id from cm_ids where name='order1'), 'stripe', 're_2', 1000, 'eur', 'succeeded', 50, null, null)->>'order_status', 'refunded', 'refunding the rest refunds the order');
select is(public.commerce_open_download(repeat('a',64))->>'state', 'revoked', 'a full refund revokes the download');
select is((select sum(amount_minor)::bigint from public.creator_ledger_entries where order_id=(select id from cm_ids where name='order1') and entry_type in ('refund','adjustment')), -1425::bigint, 'the ledger records both refunds and the Setuvara fee returned');

-- Disputes: a lost dispute revokes access and books the chargeback.
select public.commerce_record_payment((select id from cm_ids where name='order2'), 'stripe', null, 'pi_2', 1500, 'eur', 'acct_seller1', 75, 'GB', 'evt_paid2');
select public.commerce_issue_download((select id from cm_ids where name='order2'), repeat('b',64));
select is(public.commerce_record_dispute((select id from cm_ids where name='order2'), 'stripe', 'dp_1', 1500, 'eur', 'needs_response', 'fraudulent', now() + interval '7 days'), 'disputed', 'an open dispute marks the order disputed');
select is(public.commerce_record_dispute((select id from cm_ids where name='order2'), 'stripe', 'dp_1', 1500, 'eur', 'lost', 'fraudulent', null), 'charged_back', 'a lost dispute charges the order back');
select is(public.commerce_open_download(repeat('b',64))->>'state', 'revoked', 'a lost dispute revokes the download');

-- Free claims are rate limited per email.
select is(public.commerce_claim_free((select id from cm_ids where name='free'), null, 'lucas@example.test', 'Lucas Meyer', 'free-000000000001', 'ip-f')->>'status', 'paid', 'a free claim is delivered without payment');
select public.commerce_claim_free((select id from cm_ids where name='free'), null, 'lucas@example.test', null, 'free-000000000002', 'ip-f');
select public.commerce_claim_free((select id from cm_ids where name='free'), null, 'lucas@example.test', null, 'free-000000000003', 'ip-f');
select throws_ok($$select public.commerce_claim_free((select id from cm_ids where name='free'), null, 'lucas@example.test', null, 'free-000000000004', 'ip-f')$$,
  'P0001', 'rate_limited', 'the same email cannot claim endlessly');

-- Owners see only their own orders; the other creator sees nothing.
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from cm_accounts where kind='other'),'role','authenticated')::text, true);
select is((select count(*)::integer from public.creator_orders), 0, 'another creator cannot see these orders');
select is((select count(*)::integer from public.creator_refunds) + (select count(*)::integer from public.creator_disputes) + (select count(*)::integer from public.creator_download_links), 0, 'another creator cannot see refunds, disputes or links');
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from cm_accounts where kind='seller'),'role','authenticated')::text, true);
select is((select count(*)::integer from public.creator_orders), 5, 'the seller sees their own orders');
select throws_ok($$update public.creator_orders set status='paid'$$, '42501', null, 'the seller cannot change an order');

-- Admin overview keeps sandbox money apart and counts Setuvara's fee net of refunds.
reset role;
select is((public.admin_commerce_overview(current_date - 1, current_date)->'by_currency'->0->>'livemode'), 'false', 'sandbox orders are reported as sandbox');
select is((public.admin_commerce_overview(current_date - 1, current_date)->'by_currency'->0->>'platform_fees_refunded_minor')::bigint, 75::bigint, 'fees returned on refunds are reported');

select * from finish();
rollback;
