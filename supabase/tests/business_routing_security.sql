begin;

select plan(26);

-- A Pro owner with two teammates (a manager and a member), and a stranger.
create temporary table rt_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into rt_accounts select kind, id, 'rt_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('owner'),('boss'),('mate'),('stranger')) v(kind)) s;
grant select on rt_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)||' Person'),now(),now(),now() from rt_accounts;
update public.profiles set is_published=true where id in (select user_id from rt_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from rt_accounts);
create temporary table rt_vals(name text primary key, val text);
grant select, insert, update on rt_vals to anon, authenticated, service_role;

create function pg_temp.as_user(p_kind text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from rt_accounts where kind=p_kind),'role','authenticated')::text, true);
$$;
create function pg_temp.val(p_name text) returns text language sql as $$ select val from rt_vals where name=p_name $$;
create function pg_temp.uid(p_kind text) returns uuid language sql as $$ select user_id from rt_accounts where kind=p_kind $$;
create function pg_temp.ask(p_action text, p_name text) returns uuid language sql as $$
  select (public.submit_profile_action(pg_temp.val(p_action)::uuid, null, p_name, lower(replace(p_name,' ','.'))||'@example.test', '{"message":"Hello there"}', false, rpad('rt-'||replace(p_name,' ',''),16,'0'), null)->>'id')::uuid
$$;
create function pg_temp.lead(p_name text) returns uuid language sql as $$ select id from public.business_leads where name = p_name $$;
create function pg_temp.owner_of(p_name text) returns uuid language sql as $$ select assigned_to from public.business_leads where name = p_name $$;
grant execute on function pg_temp.as_user(text), pg_temp.val(text), pg_temp.uid(text), pg_temp.ask(text,text), pg_temp.lead(text), pg_temp.owner_of(text) to anon, authenticated, service_role;

insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at, current_period_end)
select 'sub_RtOwner', user_id, 'cus_RtOwner', 'pdt_RtPro', 'pro', 'monthly', 'active', 'rt-fixture', now(), now(), now() + interval '30 days' from rt_accounts where kind='owner';

-- The team: boss joins first, then mate. Two Business Actions.
set local role authenticated;
select pg_temp.as_user('owner');
insert into rt_vals values ('boss_token', public.invite_business_member((select username||'@example.test' from rt_accounts where kind='boss'), 'manager')->>'token');
insert into rt_vals values ('mate_token', public.invite_business_member((select username||'@example.test' from rt_accounts where kind='mate'), 'member')->>'token');
with a as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'booking', 'Book a consult', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business' returning id)
insert into rt_vals select 'consult', a.id::text from a;
with a as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'booking', 'Studio visit', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business' returning id)
insert into rt_vals select 'collab', a.id::text from a;
select pg_temp.as_user('boss');
select public.accept_business_invite(pg_temp.val('boss_token'));
reset role;
update public.business_team_members set accepted_at = accepted_at - interval '1 hour' where user_id = pg_temp.uid('boss');
set local role authenticated;
select pg_temp.as_user('mate');
select public.accept_business_invite(pg_temp.val('mate_token'));
reset role;

-- 1. Off by default: leads arrive unassigned.
set local role service_role;
select pg_temp.ask('consult', 'Lead One');
reset role;
select is(pg_temp.owner_of('Lead One'), null, 'routing is off until the owner turns it on');

-- 2. Rules are the owner's, on Pro, and name their own Actions and team.
set local role authenticated;
select pg_temp.as_user('boss');
select throws_ok($$ select public.save_lead_routing('round_robin', false, '{}') $$, 'P0001', 'teams_require_pro', 'a teammate cannot set routing');
select is((select count(*) from public.business_lead_routing where business_id = pg_temp.uid('owner')), 0::bigint, 'the owner''s rules stay the owner''s');
select pg_temp.as_user('owner');
select throws_ok($$ select public.save_lead_routing('round_robin', false, jsonb_build_object(pg_temp.val('consult'), pg_temp.uid('stranger'))) $$, '22023', 'invalid_rules', 'a rule cannot route to someone off the team');
select throws_ok($$ select public.save_lead_routing('round_robin', false, jsonb_build_object(gen_random_uuid(), pg_temp.uid('mate'))) $$, '22023', 'invalid_rules', 'a rule must name one of the owner''s Actions');
select throws_ok($$ select public.save_lead_routing('everyone', false, '{}') $$, '22023', 'invalid_mode', 'only known modes');
select lives_ok($$ select public.save_lead_routing('round_robin', false, '{}') $$, 'the owner turns on round robin');
select is(public.my_lead_routing()->>'mode', 'round_robin', 'and reads it back');
reset role;

-- 3. Round robin across teammates, in the order they joined.
set local role service_role;
select pg_temp.ask('consult', 'Lead Two');
select pg_temp.ask('consult', 'Lead Three');
select pg_temp.ask('consult', 'Lead Four');
reset role;
select is(pg_temp.owner_of('Lead Two'), pg_temp.uid('boss'), 'the first lead goes to the first teammate');
select is(pg_temp.owner_of('Lead Three'), pg_temp.uid('mate'), 'the next to the next');
select is(pg_temp.owner_of('Lead Four'), pg_temp.uid('boss'), 'and it wraps around');
select is((select count(*) from public.business_lead_activities where lead_id = pg_temp.lead('Lead Two') and kind = 'assigned'), 1::bigint, 'the history records the assignment');

-- 4. A rule per Action wins over the rotation.
set local role authenticated;
select pg_temp.as_user('owner');
select public.save_lead_routing('round_robin', true, jsonb_build_object(pg_temp.val('collab'), pg_temp.uid('mate')));
reset role;
set local role service_role;
select pg_temp.ask('collab', 'Lead Five');
select pg_temp.ask('collab', 'Lead Six');
reset role;
select is(pg_temp.owner_of('Lead Five'), pg_temp.uid('mate'), 'an Action''s rule sends its leads to one person');
select is(pg_temp.owner_of('Lead Six'), pg_temp.uid('mate'), 'every time');

-- 5. Alerts, once per assignment, for teammates only.
set local role authenticated;
select pg_temp.as_user('mate');
select throws_ok($$ select public.business_assignment_alert(pg_temp.lead('Lead Five'), null) $$, '42501', null, 'nobody signed in reads alert addresses');
reset role;
set local role service_role;
select is(public.business_assignment_alert(pg_temp.lead('Lead Five'), null)->>'email', (select username||'@example.test' from rt_accounts where kind='mate'), 'the server gets the assignee''s address');
select is(public.business_assignment_alert(pg_temp.lead('Lead Five'), null), null, 'and only once');
reset role;

-- 6. Assigning by hand.
set local role authenticated;
select pg_temp.as_user('mate');
select throws_ok($$ select public.assign_business_lead(pg_temp.lead('Lead Two'), pg_temp.uid('mate')) $$, '42501', 'assign_not_allowed', 'a member cannot take someone else''s lead');
select is((public.assign_business_lead(pg_temp.lead('Lead One'), pg_temp.uid('mate'))->>'changed')::boolean, true, 'a member takes an unassigned lead');
select is((public.assign_business_lead(pg_temp.lead('Lead One'), null)->>'changed')::boolean, true, 'and lets go of it');
select pg_temp.as_user('boss');
select is((public.assign_business_lead(pg_temp.lead('Lead One'), pg_temp.uid('owner'))->>'assigned_to')::uuid, pg_temp.uid('owner'), 'a manager assigns anyone on the team');
select throws_ok($$ select public.assign_business_lead(pg_temp.lead('Lead One'), pg_temp.uid('stranger')) $$, '22023', 'not_on_team', 'but nobody off it');
select pg_temp.as_user('stranger');
select throws_ok($$ select public.assign_business_lead(pg_temp.lead('Lead One'), pg_temp.uid('stranger')) $$, 'P0002', 'lead_not_found', 'a stranger cannot touch the lead');
select is(public.business_people(pg_temp.uid('owner')), null, 'nor see the team');

-- 7. A removed teammate's open leads go back to nobody, and the rotation skips them.
select pg_temp.as_user('owner');
select public.remove_business_member((select id from public.business_team_members where user_id = pg_temp.uid('mate')));
reset role;
select is((select count(*) from public.business_leads where assigned_to = pg_temp.uid('mate')), 0::bigint, 'their open leads are freed');
set local role service_role;
select pg_temp.ask('collab', 'Lead Seven');
reset role;
select isnt(pg_temp.owner_of('Lead Seven'), pg_temp.uid('mate'), 'a rule for someone who left is skipped');

select * from finish();
rollback;
