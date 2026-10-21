begin;

select plan(40);

-- A Pro business owner, a Plus owner, two people to invite, and a stranger.
create temporary table tm_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into tm_accounts select kind, id, 'tm_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('owner'),('plusowner'),('mate'),('boss'),('stranger')) v(kind)) s;
grant select on tm_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)||' Person'),now(),now(),now() from tm_accounts;
update public.profiles set is_published=true where id in (select user_id from tm_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from tm_accounts);
create temporary table tm_vals(name text primary key, val text);
grant select, insert, update on tm_vals to anon, authenticated, service_role;

create function pg_temp.as_user(p_kind text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from tm_accounts where kind=p_kind),'role','authenticated')::text, true);
$$;
create function pg_temp.val(p_name text) returns text language sql as $$ select val from tm_vals where name=p_name $$;
create function pg_temp.mail(p_kind text) returns text language sql as $$ select username||'@example.test' from tm_accounts where kind=p_kind $$;
create function pg_temp.uid(p_kind text) returns uuid language sql as $$ select user_id from tm_accounts where kind=p_kind $$;
grant execute on function pg_temp.as_user(text), pg_temp.val(text), pg_temp.mail(text), pg_temp.uid(text) to anon, authenticated, service_role;

insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at, current_period_end)
select 'sub_Tm'||kind, user_id, 'cus_Tm'||kind, 'pdt_Tm'||kind, case kind when 'owner' then 'pro' else 'plus' end, 'monthly', 'active', 'tm-fixture', now(), now(), now() + interval '30 days'
from tm_accounts where kind in ('owner','plusowner');

-- The owner has a lead from a real Business inquiry, a Booking Action and a testimonial link.
set local role authenticated;
select pg_temp.as_user('owner');
with a as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'booking', 'Book a consult', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business' returning id)
insert into tm_vals select 'booking', a.id::text from a;
select public.create_testimonial_request(null, 'Someone');
reset role;
set local role service_role;
select public.submit_profile_action(pg_temp.val('booking')::uuid, null, 'Mara Vos', 'mara@example.test', '{"message":"Can we meet on Friday?"}', false, rpad('tm-mara',16,'0'), null);
reset role;
insert into tm_vals select 'lead', id::text from public.business_leads where email_norm='mara@example.test';

-- 1. Seats come with Pro.
set local role authenticated;
select pg_temp.as_user('plusowner');
select throws_ok($$ select public.invite_business_member(pg_temp.mail('mate'), 'member') $$, 'P0001', 'teams_require_pro', 'Plus has no team seats');
select pg_temp.as_user('owner');
select throws_ok($$ select public.invite_business_member('not an email', 'member') $$, '22023', 'invalid_email', 'an invite needs an email');
select throws_ok($$ select public.invite_business_member(pg_temp.mail('owner'), 'member') $$, '22023', 'own_email', 'nobody invites themselves');
select throws_ok($$ select public.invite_business_member(pg_temp.mail('mate'), 'owner') $$, '22023', 'invalid_role', 'there is one owner');
insert into tm_vals values ('mate_token', public.invite_business_member(upper(pg_temp.mail('mate')), 'member')->>'token');
select ok(length(pg_temp.val('mate_token')) >= 32, 'the owner gets a long private invite link');
select throws_ok($$ select token_hash from public.business_team_members $$, '42501', null, 'not even the owner can read the stored hash');
select is((select count(*) from public.business_team_members), 1::bigint, 'the owner sees the invite');
reset role;

-- 2. The invite page.
set local role anon;
select is(public.get_business_invite(pg_temp.val('mate_token'))->>'business_name', 'Owner Person', 'a live invite shows who is asking');
select is(public.get_business_invite('not-a-real-token-at-all-000000'), null, 'a wrong link shows nothing');
select throws_ok($$ select public.accept_business_invite(pg_temp.val('mate_token')) $$, '42501', null, 'a visitor cannot accept');
reset role;

-- 3. Only the invited, confirmed email can accept.
set local role authenticated;
select pg_temp.as_user('stranger');
select throws_ok($$ select public.accept_business_invite(pg_temp.val('mate_token')) $$, '42501', 'wrong_account', 'another account cannot take the seat');
select pg_temp.as_user('owner');
select throws_ok($$ select public.accept_business_invite(pg_temp.val('mate_token')) $$, '22023', 'own_business', 'the owner cannot join their own team');
reset role;
update auth.users set email_confirmed_at = null where id = pg_temp.uid('mate');
set local role authenticated;
select pg_temp.as_user('mate');
select throws_ok($$ select public.accept_business_invite(pg_temp.val('mate_token')) $$, '42501', 'wrong_account', 'an unconfirmed email cannot accept');
reset role;
update auth.users set email_confirmed_at = now() where id = pg_temp.uid('mate');
set local role authenticated;
select pg_temp.as_user('mate');
select is(public.accept_business_invite(pg_temp.val('mate_token'))->>'role', 'member', 'the invited person joins');
select throws_ok($$ select public.accept_business_invite(pg_temp.val('mate_token')) $$, 'P0002', 'invite_unavailable', 'an invite works once');

-- 4. A member works the leads, and nothing else.
select is((select count(*) from public.business_leads where profile_id = pg_temp.uid('owner')), 1::bigint, 'a member sees the business''s leads');
select is((public.set_business_lead_stage(pg_temp.val('lead')::uuid, 'contacted')->>'changed')::boolean, true, 'a member moves a lead');
select lives_ok($$ select public.add_business_lead_note(pg_temp.val('lead')::uuid, 'Called, sending a quote.', rpad('tm-note',16,'0')) $$, 'a member writes a note on the owner''s plan');
select is((select actor_user_id from public.business_lead_activities where kind = 'note'), pg_temp.uid('mate'), 'the history records who did it');
select is(public.business_lead_detail(pg_temp.val('lead')::uuid)->'inquiries'->0->'answers'->>'message', 'Can we meet on Friday?', 'a member reads what the lead asked');
select is(public.business_lead_detail(pg_temp.val('lead')::uuid)->'activity'->0->>'actor', 'You', 'and sees their own steps as theirs');
select is((select count(*) from public.action_submissions where profile_id = pg_temp.uid('owner')), 0::bigint, 'but has no row access to the owner''s submissions');
select is((select count(*) from public.business_testimonial_requests where profile_id = pg_temp.uid('owner')), 0::bigint, 'nor to testimonial links');
select throws_ok($$ select public.save_booking_availability(pg_temp.val('booking')::uuid, true, 'UTC', 60, 0, 0, 14, '{}') $$, 'P0002', 'action_not_found', 'a member cannot change the hours');
select throws_ok($$ select public.create_testimonial_request(pg_temp.val('lead')::uuid, '') $$, 'P0002', 'lead_not_found', 'nor send a testimonial link for the owner''s lead');
select is(public.business_workspace(pg_temp.uid('owner'))->>'role', 'member', 'the workspace knows the role');
select is((public.business_workspace(pg_temp.uid('owner'))->'limits'->>'can_export')::boolean, false, 'a member cannot export');
select is(jsonb_array_length(public.my_business_teams()), 1, 'the member sees the business they work for');
select throws_ok($$ select public.invite_business_member(pg_temp.mail('boss'), 'member') $$, 'P0001', 'teams_require_pro', 'a member cannot invite on the owner''s behalf');
select pg_temp.as_user('stranger');
select is(public.business_workspace(pg_temp.uid('owner')), null, 'nobody else gets the workspace');
select is(public.business_lead_detail(pg_temp.val('lead')::uuid), null, 'nor a lead''s detail');
select is((select count(*) from public.business_team_members), 0::bigint, 'nor the team');

-- 5. A manager also exports; seats run out at five.
select pg_temp.as_user('owner');
insert into tm_vals values ('boss_token', public.invite_business_member(pg_temp.mail('boss'), 'manager')->>'token');
select public.invite_business_member('extra'||g||'@example.test', 'member') from generate_series(1,3) g;
select throws_ok($$ select public.invite_business_member('sixth@example.test', 'member') $$, 'P0001', 'no_seats', 'Pro has five seats, invites included');
select pg_temp.as_user('boss');
select public.accept_business_invite(pg_temp.val('boss_token'));
select is((public.business_workspace(pg_temp.uid('owner'))->'limits'->>'can_export')::boolean, true, 'a manager exports on the owner''s plan');

-- 6. Removing someone, or leaving Pro, ends access now.
select pg_temp.as_user('owner');
select is(public.remove_business_member((select id from public.business_team_members where user_id = pg_temp.uid('mate'))), true, 'the owner removes a member');
select pg_temp.as_user('mate');
select is((select count(*) from public.business_leads where profile_id = pg_temp.uid('owner')), 0::bigint, 'a removed member sees nothing');
select throws_ok($$ select public.set_business_lead_stage(pg_temp.val('lead')::uuid, 'qualified') $$, 'P0002', 'lead_not_found', 'and can change nothing');
reset role;
update public.billing_subscriptions set plan_code = 'plus' where user_id = pg_temp.uid('owner');
set local role authenticated;
select pg_temp.as_user('boss');
select is(public.business_workspace(pg_temp.uid('owner')), null, 'when the owner leaves Pro the team closes');
reset role;
update public.billing_subscriptions set plan_code = 'pro' where user_id = pg_temp.uid('owner');
set local role authenticated;
select pg_temp.as_user('boss');
select is(public.remove_business_member((select id from public.business_team_members where user_id = pg_temp.uid('boss'))), true, 'a teammate can leave');
select is((select count(*) from public.business_leads where profile_id = pg_temp.uid('owner')), 0::bigint, 'and then sees nothing');
reset role;

select * from finish();
rollback;
