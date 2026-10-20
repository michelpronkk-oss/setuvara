begin;

select plan(24);

-- One member with Personal, Event and Business Modes, and a visitor member.
create temporary table am_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into am_accounts select kind, id, 'am_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('owner'),('member')) v(kind)) s;
grant select on am_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from am_accounts;
update public.profiles set is_published=true where id in (select user_id from am_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from am_accounts);
create temporary table am_ids(name text primary key, id uuid);
grant select, insert on am_ids to anon, authenticated, service_role;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from am_accounts where kind='owner'),'role','authenticated')::text, true);

-- Newsletter on Personal, Form on Event.
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,config,status)
  select m.profile_id, m.id, 'newsletter', 'Letters from Lisbon', '{"promise":"One photo and one paragraph","frequency":"Monthly","askName":true,"thanks":"See you in your inbox."}'::jsonb, 'published'
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='personal' returning id) insert into am_ids select 'newsletter', id from x;
select is((select status from public.profile_actions where id=(select id from am_ids where name='newsletter')), 'published', 'a newsletter publishes on Personal');
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,config,status)
  select m.profile_id, m.id, 'form', 'Join the dinner', '{"askName":false,"questions":[{"id":"q1","label":"Diet","type":"choice","options":["None","Vegetarian"],"required":true}]}'::jsonb, 'published'
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event' returning id) insert into am_ids select 'form', id from x;
select is((select status from public.profile_actions where id=(select id from am_ids where name='form')), 'published', 'a form publishes on Event');
select is(jsonb_array_length(public.get_public_profile_actions((select username from am_accounts where kind='owner'),'personal')), 1, 'Personal shows its live Actions');
select is(jsonb_array_length(public.get_public_profile_actions((select username from am_accounts where kind='owner'),'event')), 1, 'Event shows its own Actions only');
select throws_ok($$insert into public.profile_actions(profile_id,mode_id,kind,title,config) select m.profile_id,m.id,'newsletter','Bad','{"questions":[]}'::jsonb from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business'$$,
  '23514', 'action_config_invalid', 'newsletters take no custom questions');
select throws_ok($$insert into public.profile_actions(profile_id,mode_id,kind,title,config) select m.profile_id,m.id,'form','Bad',jsonb_build_object('thanks',repeat('x',201)) from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business'$$,
  '23514', 'action_config_invalid', 'the thank-you line has a cap');
select lives_ok($$insert into public.profile_actions(profile_id,mode_id,kind,title,config) select m.profile_id,m.id,'collab','Work with me','{"thanks":"Talk soon."}'::jsonb from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business'$$,
  'every kind accepts a thank-you line');
select throws_ok($$insert into public.profile_actions(profile_id,mode_id,kind,title) values ((select user_id from am_accounts where kind='member'), (select m.id from public.profile_modes m where m.profile_id=(select user_id from am_accounts where kind='member') and m.slug='personal'), 'newsletter', 'Hijack')$$,
  '42501', null, 'a member cannot add Actions to another profile');

-- Signups come through the service role, wait for the email, and never repeat.
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select ok((public.submit_profile_action((select id from am_ids where name='newsletter'), null, '', 'Aanya.Rao+news@gmail.com', '{}', false, 'news-key-000000001', null))->>'verify_token' ~ '^[0-9a-f]{64}$', 'a signup without a name gets a verification token');
select is((select status from public.action_submissions where action_id=(select id from am_ids where name='newsletter')), 'pending_verification', 'a signup waits for its email');
select is((public.submit_profile_action((select id from am_ids where name='newsletter'), null, 'Aanya', 'aanyarao@gmail.com', '{}', false, 'news-key-000000002', null))->>'duplicate', 'true', 'the same address signs up once');
select throws_ok($$select public.submit_profile_action((select id from am_ids where name='newsletter'), null, 'X', null, '{}', false, 'news-key-000000003', null)$$,
  '22023', 'email_required', 'a newsletter needs an email');
select throws_ok($$select public.submit_profile_action((select id from am_ids where name='newsletter'), null, 'X', 'x@example.test', '{"message":"hi"}', false, 'news-key-000000004', null)$$,
  '22023', 'unknown_field', 'a newsletter takes no other fields');
reset role;
update public.action_submissions set verify_token_hash=extensions.digest(repeat('c',64),'sha256') where action_id=(select id from am_ids where name='newsletter');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is((public.confirm_action_entry(repeat('c',64)))->>'kind', 'newsletter', 'confirming says which kind it was');
select is((select status from public.action_submissions where action_id=(select id from am_ids where name='newsletter')), 'subscribed', 'a confirmed signup is Subscribed');

-- Forms: the owner's questions, a name only when asked for.
select is((public.submit_profile_action((select id from am_ids where name='form'), null, '', null, '{"q1":"Vegetarian"}', false, 'form-key-000000001', null))->>'status', 'new', 'a form without a name is accepted when the owner allows it');
select throws_ok($$select public.submit_profile_action((select id from am_ids where name='form'), null, 'X', null, '{}', false, 'form-key-000000002', null)$$,
  '22023', 'answer_required', 'required form questions are enforced');
select throws_ok($$select public.submit_profile_action((select id from am_ids where name='form'), null, 'X', null, '{"q1":"Vegan"}', false, 'form-key-000000003', null)$$,
  '22023', 'invalid_choice', 'form choices must be one of the options');

-- A pending signup gets a second row to test the owner's tools.
select ok((public.submit_profile_action((select id from am_ids where name='newsletter'), null, '', 'lucas@example.test', '{}', false, 'news-key-000000005', null))->>'verify_token' is not null, 'a second address signs up');

-- The owner: removes people, but can't count anyone who never confirmed.
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from am_accounts where kind='owner'),'role','authenticated')::text, true);
select throws_ok($$select public.set_action_submission_status((select id from public.action_submissions where email='lucas@example.test'), 'subscribed')$$,
  '22023', 'invalid_status', 'an unconfirmed signup cannot be marked Subscribed');
select ok(public.set_action_submission_status((select id from public.action_submissions where email='lucas@example.test'), 'unsubscribed'), 'the owner can remove an unconfirmed signup');
select throws_ok($$select public.set_action_submission_status((select id from public.action_submissions where email='lucas@example.test'), 'subscribed')$$,
  '22023', 'invalid_status', 'removing first does not make an unconfirmed signup count');
select ok(public.set_action_submission_status((select id from public.action_submissions where email='aanya.rao+news@gmail.com'), 'unsubscribed'), 'the owner removes a subscriber');

-- Another member sees none of it.
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from am_accounts where kind='member'),'role','authenticated')::text, true);
select is((select count(*)::integer from public.action_submissions), 0, 'a visitor member reads no signups');

select * from finish();
rollback;
