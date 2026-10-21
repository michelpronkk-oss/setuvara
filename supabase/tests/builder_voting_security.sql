begin;

select plan(24);

create temporary table bv(kind text primary key, id uuid);
grant select, insert on bv to anon, authenticated, service_role;
insert into bv select k, gen_random_uuid() from unnest(array['owner','fan','fan2','unconfirmed']) k;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select id,'authenticated','authenticated','bv_'||substr(replace(id::text,'-',''),1,10)||'@example.test',
  jsonb_build_object('username','bv_'||substr(replace(id::text,'-',''),1,10),'display_name',initcap(kind)),
  case when kind='unconfirmed' then null else now() end, now(), now() from bv;
update public.profiles set is_published=true where id in (select id from bv);
update public.profile_modes set is_enabled=true where profile_id in (select id from bv);
-- The owner is on Plus, so suggestions can open.
insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at, current_period_end)
select 'sub_BvOwner', id, 'cus_BvOwner', 'pdt_BvPlus', 'plus', 'monthly', 'active', 'bv-fixture', now(), now(), now() + interval '30 days' from bv where kind='owner';
create function pg_temp.as_user(p text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from bv where kind=p),'role','authenticated')::text, true) $$;
create function pg_temp.v(p text) returns uuid language sql as $$ select id from bv where kind=p $$;
grant execute on function pg_temp.as_user(text), pg_temp.v(text) to anon, authenticated;

with p as (insert into public.builder_projects(owner_user_id, mode_id, slug, name, visibility, suggestions_enabled)
  select pg_temp.v('owner'), m.id, 'my-saas', 'My SaaS', 'public', true from public.profile_modes m where m.profile_id=pg_temp.v('owner') and m.slug='creator' returning id)
insert into bv select 'project', id from p;
with r as (insert into public.builder_roadmap_items(project_id, owner_user_id, title, stage) values (pg_temp.v('project'), pg_temp.v('owner'), 'Dark mode', 'planned') returning id) insert into bv select 'item', id from r;
with r as (insert into public.builder_roadmap_items(project_id, owner_user_id, title, stage) values (pg_temp.v('project'), pg_temp.v('owner'), 'Shipped thing', 'shipped') returning id) insert into bv select 'shipped', id from r;
with r as (insert into public.builder_roadmap_items(project_id, owner_user_id, title, stage, is_public) values (pg_temp.v('project'), pg_temp.v('owner'), 'Secret', 'planned', false) returning id) insert into bv select 'private', id from r;

select ok((select relrowsecurity from pg_class where oid='public.builder_votes'::regclass) and (select relrowsecurity from pg_class where oid='public.builder_suggestions'::regclass), 'votes and suggestions have RLS');
select ok(not has_table_privilege('authenticated','public.builder_votes','select') and not has_table_privilege('authenticated','public.builder_votes','insert'), 'nobody reads or writes votes directly');
select ok(not has_table_privilege('authenticated','public.builder_suggestions','insert'), 'suggestions are only made through the function');

-- Voting.
set local role anon;
select throws_ok($$select public.vote_builder_item(pg_temp.v('item'), true)$$, '42501', null, 'visitors cannot vote');
reset role;
set local role authenticated;
select pg_temp.as_user('unconfirmed');
select throws_ok($$select public.vote_builder_item(pg_temp.v('item'), true)$$, '42501', 'confirm_email_first', 'an unconfirmed email cannot vote');
select pg_temp.as_user('fan');
select is((public.vote_builder_item(pg_temp.v('item'), true)->>'votes'), '1', 'a confirmed member votes');
select is((public.vote_builder_item(pg_temp.v('item'), true)->>'votes'), '1', 'voting twice still counts once');
select pg_temp.as_user('fan2');
select is((public.vote_builder_item(pg_temp.v('item'), true)->>'votes'), '2', 'a second member adds a second vote');
select is((public.vote_builder_item(pg_temp.v('item'), false)->>'votes'), '1', 'and can take it back');
select throws_ok($$select public.vote_builder_item(pg_temp.v('shipped'), true)$$, 'P0001', 'already_shipped', 'shipped items take no new votes');
select throws_ok($$select public.vote_builder_item(pg_temp.v('private'), true)$$, 'P0002', 'item_not_found', 'private items cannot be voted on');
select pg_temp.as_user('owner');
select throws_ok($$select public.vote_builder_item(pg_temp.v('item'), true)$$, 'P0001', 'own_project', 'owners cannot vote on their own roadmap');
reset role;
select is((public.get_public_builder((select username from public.profiles where id=pg_temp.v('owner')), 'creator')->0->'roadmap'->0->>'votes'), '1', 'the public sees the count');
select ok(position(pg_temp.v('fan')::text in public.get_public_builder((select username from public.profiles where id=pg_temp.v('owner')), 'creator')::text) = 0, 'but never who voted');

-- Suggestions.
set local role authenticated;
select pg_temp.as_user('fan');
insert into bv select 'sugg', (public.suggest_builder_feature(pg_temp.v('project'), 'CSV import', 'From my bank')->>'id')::uuid;
select is((select status from public.builder_suggestions where id=pg_temp.v('sugg')), 'pending', 'a suggestion starts pending');
select is(jsonb_array_length(public.get_public_builder((select username from public.profiles where id=pg_temp.v('owner')), 'creator')->0->'roadmap'), 2, 'and is not public');
select public.suggest_builder_feature(pg_temp.v('project'), 'Idea two', '');
select public.suggest_builder_feature(pg_temp.v('project'), 'Idea three', '');
select throws_ok($$select public.suggest_builder_feature(pg_temp.v('project'), 'Idea four', '')$$, 'P0001', 'rate_limited', 'at most three pending per member per project');
select pg_temp.as_user('fan2');
select is((select count(*)::int from public.builder_suggestions), 0, 'members never see others'' suggestions');
select throws_ok($$select public.review_builder_suggestion(pg_temp.v('sugg'), true)$$, 'P0002', 'suggestion_not_found', 'only the owner reviews');
select pg_temp.as_user('owner');
select is((select count(*)::int from public.builder_suggestions where status='pending'), 3, 'the owner sees the pending inbox');
select ok((public.review_builder_suggestion(pg_temp.v('sugg'), true, true)->>'roadmap_item_id') is not null, 'approving adds a planned roadmap item');
select is((public.builder_project_insights(pg_temp.v('project'))->>'approved'), '1', 'insights count the decision');
select pg_temp.as_user('fan');
select is((public.my_builder_activity(pg_temp.v('project'))->'suggestions'->-1->>'stage'), 'planned', 'the author follows their idea on the roadmap');
reset role;

-- Free owners can't open suggestions.
update public.billing_subscriptions set current_period_end = now() - interval '1 day' where dodo_subscription_id='sub_BvOwner';
set local role authenticated;
select pg_temp.as_user('fan2');
select throws_ok($$select public.suggest_builder_feature(pg_temp.v('project'), 'After downgrade', '')$$, 'P0001', 'suggestions_closed', 'suggestions close when the owner is back on Free');
reset role;

select * from finish();
rollback;
