begin;

select plan(32);

create temporary table rv(kind text primary key, id uuid);
grant select, insert on rv to anon, authenticated, service_role;
insert into rv select k, gen_random_uuid() from unnest(array['owner','other','free']) k;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select id,'authenticated','authenticated','rv_'||substr(replace(id::text,'-',''),1,10)||'@example.test',
  jsonb_build_object('username','rv_'||substr(replace(id::text,'-',''),1,10),'display_name',initcap(kind)), now(), now(), now() from rv;
update public.profiles set is_published=true where id in (select id from rv);
update public.profile_modes set is_enabled=true where profile_id in (select id from rv);
insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at, current_period_end)
select 'sub_Rv'||kind, id, 'cus_Rv'||kind, 'pdt_RvPlus', 'plus', 'monthly', 'active', 'rv-fixture', now(), now(), now() + interval '30 days' from rv where kind in ('owner','other');
create function pg_temp.as_user(p text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from rv where kind=p),'role','authenticated')::text, true) $$;
create function pg_temp.v(p text) returns uuid language sql as $$ select id from rv where kind=p $$;
create function pg_temp.uname(p text) returns text language sql as $$ select username from public.profiles where id=(select id from rv where kind=p) $$;
grant execute on function pg_temp.as_user(text), pg_temp.v(text), pg_temp.uname(text) to anon, authenticated, service_role;

with p as (insert into public.builder_projects(owner_user_id, mode_id, slug, name, visibility)
  select pg_temp.v(k), m.id, 'app', 'App', 'public' from unnest(array['owner','free']) k join public.profile_modes m on m.profile_id=pg_temp.v(k) and m.slug='creator' returning id, owner_user_id)
insert into rv select case when owner_user_id=pg_temp.v('owner') then 'project' else 'free_project' end, id from p;

select ok((select relrowsecurity from pg_class where oid='public.revenue_connections'::regclass) and (select relrowsecurity from pg_class where oid='public.revenue_snapshots'::regclass), 'connections and snapshots have RLS');
select ok(not has_column_privilege('authenticated','public.revenue_connections','vault_secret_id','select'), 'members never read the Vault reference');
select ok(not has_table_privilege('authenticated','public.revenue_snapshots','insert') and not has_table_privilege('authenticated','public.revenue_connections','insert'), 'members cannot write connections or numbers');
select ok(not has_function_privilege('authenticated','public.revenue_connect(uuid,uuid,text,text,text,text,text)','execute'), 'only the server opens a connection');
select ok(not has_function_privilege('authenticated','public.revenue_connection_secret(uuid)','execute') and not has_function_privilege('anon','public.revenue_connection_secret(uuid)','execute'), 'only the server reads a key');
select ok(not has_function_privilege('authenticated','public.revenue_record_sync(uuid,boolean,text,jsonb,text)','execute'), 'only the sync writes snapshots');

-- The server, as service role.
set local role service_role;
select throws_ok($$select public.revenue_connect(pg_temp.v('free'), pg_temp.v('free_project'), 'stripe', 'live', null, 'fixture…0001', 'fixture-key-not-real-0001')$$, 'P0001', 'plan_limit', 'Free has no providers');
select throws_ok($$select public.revenue_connect(pg_temp.v('other'), pg_temp.v('project'), 'stripe', 'live', null, 'fixture…0001', 'fixture-key-not-real-0001')$$, 'P0002', 'project_not_found', 'a connection only goes on your own project');
insert into rv select 'conn', public.revenue_connect(pg_temp.v('owner'), pg_temp.v('project'), 'stripe', 'live', 'acct_1', 'fixture…0001', 'fixture-key-not-real-0002');
select is(public.revenue_connection_secret(pg_temp.v('conn')), 'fixture-key-not-real-0002', 'the key round-trips through Vault');
select throws_ok($$select public.revenue_connect(pg_temp.v('owner'), pg_temp.v('project'), 'dodo', 'live', null, 'fixture…0003', 'fixture-key-not-real-0003')$$, 'P0001', 'plan_limit', 'Plus has one provider');
select public.revenue_record_sync(pg_temp.v('conn'), true, null, '[{"currency":"EUR","mrr_minor":420000,"paying_customers":37,"active_subscriptions":40}]', 'stripe_subscriptions_v1');
reset role;

select is((public.get_public_builder_revenue(pg_temp.uname('owner'), 'creator')), '{}'::jsonb, 'revenue is hidden by default');
update public.builder_projects set revenue_visibility='range' where id=pg_temp.v('project');
select is((public.get_public_builder_revenue(pg_temp.uname('owner'), 'creator')->(pg_temp.v('project')::text)->0->>'band'), '1k-5k', 'range shows a band');
select ok((public.get_public_builder_revenue(pg_temp.uname('owner'), 'creator')->(pg_temp.v('project')::text)->0->>'mrr_minor') is null, 'and not the amount');
update public.builder_projects set revenue_visibility='exact' where id=pg_temp.v('project');
select is((public.get_public_builder_revenue(pg_temp.uname('owner'), 'creator')->(pg_temp.v('project')::text)->0->>'mrr_minor'), '420000', 'exact shows the amount');
select is((public.get_public_builder_revenue(pg_temp.uname('owner'), 'creator')->(pg_temp.v('project')::text)->0->'trend'), '[1.000]'::jsonb, 'the trend is a shape relative to its peak, never amounts');

-- Stale or test data is never current verified revenue.
update public.revenue_connections set last_sync_at = now() - interval '3 days' where id=pg_temp.v('conn');
select is((public.get_public_builder_revenue(pg_temp.uname('owner'), 'creator')), '{}'::jsonb, 'a stale sync drops the figure');
update public.revenue_connections set last_sync_at = now(), environment='test' where id=pg_temp.v('conn');
select is((public.get_public_builder_revenue(pg_temp.uname('owner'), 'creator')), '{}'::jsonb, 'test mode never shows publicly');
set local role authenticated;
select pg_temp.as_user('owner');
select is((public.get_builder_revenue_preview(pg_temp.uname('owner'), 'creator')->(pg_temp.v('project')::text)->0->>'test'), 'true', 'the owner previews test data, flagged as test');
select pg_temp.as_user('other');
select is(public.get_builder_revenue_preview(pg_temp.uname('owner'), 'creator'), '{}'::jsonb, 'nobody else gets the preview');
reset role;
select ok(not has_function_privilege('anon','public.get_builder_revenue_preview(text,text)','execute'), 'visitors cannot call the preview');
update public.revenue_connections set environment='live' where id=pg_temp.v('conn');

-- History setting: reconstructed months only while the owner has it on, labelled, and gone when switched off.
select ok(not has_function_privilege('authenticated','public.revenue_record_history(uuid,jsonb,text)','execute'), 'only the server writes reconstructed history');
set local role service_role;
select is(public.revenue_record_history(pg_temp.v('conn'), '[{"day":"2000-01-31","currency":"eur","mrr_minor":1,"paying_customers":1,"active_subscriptions":1}]', 'stripe_history_v1'), 0, 'nothing is reconstructed while the setting is daily');
reset role;
set local role authenticated;
select pg_temp.as_user('other');
select throws_ok($$select public.revenue_set_history(pg_temp.v('conn'), 'reconstructed')$$, 'P0002', 'connection_not_found', 'only the owner changes the history setting');
select pg_temp.as_user('owner');
select public.revenue_set_history(pg_temp.v('conn'), 'reconstructed');
reset role;
set local role service_role;
select is(public.revenue_record_history(pg_temp.v('conn'), jsonb_build_array(
  jsonb_build_object('day', current_date - 60, 'currency', 'eur', 'mrr_minor', 210000, 'paying_customers', 20, 'active_subscriptions', 20),
  jsonb_build_object('day', current_date, 'currency', 'eur', 'mrr_minor', 1, 'paying_customers', 1, 'active_subscriptions', 1),
  jsonb_build_object('day', current_date - 4000, 'currency', 'eur', 'mrr_minor', 1, 'paying_customers', 1, 'active_subscriptions', 1)), 'stripe_history_v1'), 1,
  'only days before the first measurement and inside the plan window are stored');
reset role;
select is((public.get_public_builder_revenue(pg_temp.uname('owner'), 'creator')->(pg_temp.v('project')::text)->0->>'reconstructed'), 'true', 'the public card says it includes reconstructed history');
select is((public.get_public_builder_revenue(pg_temp.uname('owner'), 'creator')->(pg_temp.v('project')::text)->0->'trend'), '[0.500, 1.000]'::jsonb, 'and the trend reaches back to it');
select is((public.get_public_builder_revenue(pg_temp.uname('owner'), 'creator')->(pg_temp.v('project')::text)->0->>'mrr_minor'), '420000', 'the headline figure stays the latest measurement');
set local role authenticated;
select pg_temp.as_user('owner');
select public.revenue_set_history(pg_temp.v('conn'), 'daily');
reset role;
select ok(not exists(select 1 from public.revenue_snapshots where connection_id = pg_temp.v('conn') and reconstructed)
  and (public.get_public_builder_revenue(pg_temp.uname('owner'), 'creator')->(pg_temp.v('project')::text)->0->>'reconstructed') = 'false',
  'switching back to daily deletes the reconstructed months');

-- Isolation and disconnect.
set local role authenticated;
select pg_temp.as_user('other');
select is((select count(*)::int from public.revenue_snapshots) + (select count(*)::int from public.revenue_connections), 0, 'others see nothing');
select throws_ok($$select public.revenue_disconnect(pg_temp.v('conn'))$$, 'P0002', 'connection_not_found', 'and cannot disconnect it');
select pg_temp.as_user('owner');
select public.revenue_disconnect(pg_temp.v('conn'));
reset role;
select ok((select status='revoked' and vault_secret_id is null from public.revenue_connections where id=pg_temp.v('conn'))
  and public.revenue_connection_secret(pg_temp.v('conn')) is null, 'disconnect destroys the stored key');
select is((public.get_public_builder_revenue(pg_temp.uname('owner'), 'creator')), '{}'::jsonb, 'and the badge goes away');

select * from finish();
rollback;
