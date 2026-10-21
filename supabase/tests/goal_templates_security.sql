begin;

select plan(16);

create temporary table gt(kind text primary key, id uuid);
grant select, insert on gt to anon, authenticated, service_role;
insert into gt select k, gen_random_uuid() from unnest(array['owner','other']) k;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select id,'authenticated','authenticated','gt_'||substr(replace(id::text,'-',''),1,10)||'@example.test',
  jsonb_build_object('username','gt_'||substr(replace(id::text,'-',''),1,10),'display_name',initcap(kind)),now(),now(),now() from gt;
update public.profile_modes set is_enabled=true where profile_id in (select id from gt);
insert into gt select 'biz', id from public.profile_modes where profile_id=(select id from gt where kind='owner') and slug='business';
insert into gt select 'creator', id from public.profile_modes where profile_id=(select id from gt where kind='owner') and slug='creator';
insert into gt select 'event', id from public.profile_modes where profile_id=(select id from gt where kind='owner') and slug='event';

create function pg_temp.as_user(p text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from gt where kind=p),'role','authenticated')::text, true) $$;
create function pg_temp.m(p text) returns uuid language sql as $$ select id from gt where kind=p $$;
grant execute on function pg_temp.as_user(text), pg_temp.m(text) to authenticated;

select ok((select relrowsecurity from pg_class where oid='public.goal_setups'::regclass), 'goal setups have RLS');
select ok(not has_table_privilege('authenticated','public.goal_setups','insert'), 'members cannot write setups directly');

set local role authenticated;
select pg_temp.as_user('owner');

-- Free owner: the Business starter works, and everything comes out as drafts.
insert into gt select 'setup1', (public.apply_goal_setup(pg_temp.m('biz'), 'get_more_clients', 'gt-key-000000000001', '{"service":"Design"}',
  '[{"kind":"form","title":"Work with us","intro":"Tell us.","cta_label":"Send inquiry","config":{"askName":true,"emailRequired":true,"questions":[{"id":"q1","label":"What do you need?","type":"long","required":true}]},"thanks_heading":"Inquiry received","status":"published"}]'::jsonb)->>'id')::uuid;
select is((select count(*)::int from public.profile_actions a where a.profile_id=auth.uid() and a.status='draft' and a.title='Work with us'), 1, 'the starter creates its Action as a draft, whatever the payload says');
select is((select heading from public.action_thanks t join public.profile_actions a on a.id=t.action_id where a.title='Work with us'), 'Inquiry received', 'with its thank-you heading');
select is((public.apply_goal_setup(pg_temp.m('biz'), 'get_more_clients', 'gt-key-000000000001', '{}', '[{"kind":"form","title":"Again","config":{}}]'::jsonb)->>'duplicate'), 'true', 'the same key returns the same setup');
select is((select count(*)::int from public.profile_actions where profile_id=auth.uid()), 1, 'and creates nothing twice');

select throws_ok($$select public.apply_goal_setup(pg_temp.m('creator'), 'launch_product', 'gt-key-000000000002', '{}', '[{"kind":"newsletter","title":"Waitlist","config":{}}]'::jsonb)$$,
  'P0001', 'goal_requires_plus', 'Plus goals are refused on Free');
select throws_ok($$select public.apply_goal_setup(pg_temp.m('creator'), 'get_more_clients', 'gt-key-000000000003', '{}', '[{"kind":"form","title":"X","config":{}}]'::jsonb)$$,
  '42501', 'mode_not_owned', 'a goal only runs on its own Mode');
select throws_ok($$select public.apply_goal_setup(pg_temp.m('biz'), 'get_more_clients', 'gt-key-000000000004', '{}', '[{"kind":"form","title":"X","config":{"status":"published"}}]'::jsonb)$$,
  '23514', 'action_config_invalid', 'the existing Action rules still apply');

-- The Event starter: an event draft with capacity and waitlist.
select public.apply_goal_setup(pg_temp.m('event'), 'host_event', 'gt-key-000000000005', '{}', '[]'::jsonb,
  '{"title":"Supper Club","starts_at":"2026-12-12T18:00:00Z","ends_at":"2026-12-12T21:00:00Z","timezone":"Europe/Amsterdam","city":"Amsterdam","capacity":40,"waitlist_enabled":true}'::jsonb);
select is((select status||':'||capacity||':'||waitlist_enabled from public.events where profile_id=auth.uid() and title='Supper Club'), 'draft:40:true', 'the event is a draft with its capacity and waitlist');

-- Progress: each record with its state.
select is(jsonb_array_length(public.goal_progress()), 2, 'progress lists both setups');
select is((public.goal_progress()->1->'records'->0->>'status'), 'draft', 'with each record''s status');

-- Plus unlocks Launch a Product: a waitlist and an unpublished product draft.
reset role;
insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at, current_period_end)
values ('sub_GtOwner', pg_temp.m('owner'), 'cus_GtOwner', 'pdt_GtPlus', 'plus', 'monthly', 'active', 'gt-fixture', now(), now(), now() + interval '30 days');
set local role authenticated;
select pg_temp.as_user('owner');
select public.apply_goal_setup(pg_temp.m('creator'), 'launch_product', 'gt-key-000000000007', '{}',
  '[{"kind":"newsletter","title":"Get early access: Presets","config":{"promise":"First access","askName":true}}]'::jsonb, null,
  '{"offer_type":"digital","title":"Presets","currency":"EUR","unit_amount_minor":1900}'::jsonb);
select is((select status||':'||unit_amount_minor from public.creator_offers where creator_user_id=auth.uid() and title='Presets'), 'draft:1900', 'Plus: the product is a draft at the launch price');
select is((select status from public.profile_actions where profile_id=auth.uid() and title='Get early access: Presets'), 'draft', 'and the waitlist is a draft');

-- Another member sees and touches nothing.
select pg_temp.as_user('other');
select is((select count(*)::int from public.goal_setups), 0, 'others cannot read the setups');
select throws_ok($$select public.apply_goal_setup(pg_temp.m('biz'), 'get_more_clients', 'gt-key-000000000006', '{}', '[{"kind":"form","title":"X","config":{}}]'::jsonb)$$,
  '42501', 'mode_not_owned', 'nobody can create drafts on someone else''s Mode');
reset role;

select * from finish();
rollback;
