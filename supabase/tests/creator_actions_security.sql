begin;

select plan(58);

-- Shape and grants.
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.profile_actions'::regclass), 'profile_actions has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.action_submissions'::regclass), 'action_submissions has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.social_accounts'::regclass), 'social_accounts has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.social_account_secrets'::regclass), 'social_account_secrets has RLS');
select ok(not has_table_privilege('anon','public.profile_actions','select'), 'anon cannot read Actions directly');
select ok(not has_table_privilege('anon','public.action_submissions','select'), 'anon cannot read submissions');
select ok(not has_table_privilege('authenticated','public.action_submissions','insert'), 'members cannot insert submissions directly');
select ok(not has_table_privilege('authenticated','public.action_submissions','update'), 'members cannot edit submissions directly');
select ok(not has_column_privilege('authenticated','public.action_submissions','verify_token_hash','select'), 'the verification secret is not readable by owners');
select ok(not has_column_privilege('authenticated','public.action_submissions','ip_hash','select'), 'the IP hash is not readable by owners');
select ok(not has_table_privilege('authenticated','public.social_account_secrets','select'), 'members cannot read token ciphertext');
select ok(not has_table_privilege('anon','public.social_account_secrets','select'), 'visitors cannot read token ciphertext');
select ok(not has_table_privilege('authenticated','public.social_accounts','insert'), 'members cannot fake a connected account');
select ok(not has_column_privilege('authenticated','public.social_accounts','audience_count','update'), 'members cannot edit synced audience counts');
select ok(not has_function_privilege('anon','public.submit_profile_action(uuid,uuid,text,text,jsonb,boolean,text,text)','execute'), 'visitors cannot call the submission RPC directly');
select ok(not has_function_privilege('authenticated','public.submit_profile_action(uuid,uuid,text,text,jsonb,boolean,text,text)','execute'), 'members cannot call the submission RPC directly');
select ok(not has_function_privilege('anon','public.confirm_action_entry(text)','execute'), 'visitors cannot confirm entries without the server route');
select ok(has_function_privilege('anon','public.get_public_profile_actions(text,text)','execute'), 'visitors read published Actions through the public RPC');
select ok(not has_function_privilege('anon','public.set_action_submission_status(uuid,text)','execute'), 'visitors cannot change statuses');

-- Two creators and a visitor member.
create temporary table act_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into act_accounts select kind, id, 'ac_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('creator'),('other'),('member')) v(kind)) s;
grant select on act_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from act_accounts;
update public.profiles set is_published=true where id in (select user_id from act_accounts);
update public.profile_modes set is_enabled=true where slug='creator' and profile_id in (select user_id from act_accounts);
create temporary table act_ids(name text primary key, id uuid);
grant select, insert on act_ids to anon, authenticated, service_role;

-- Owner creates Actions; plan limits apply on publish.
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from act_accounts where kind='creator'),'role','authenticated')::text, true);
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,intro,config,status)
  select m.profile_id, m.id, 'collab', 'Work with me', 'Campaigns and commissions', '{"types":["campaign","ugc"],"askBudget":true}'::jsonb, 'draft'
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='creator' returning id) insert into act_ids select 'collab', id from x;
select is((select status from public.profile_actions where id=(select id from act_ids where name='collab')), 'draft', 'a new Action saves as a draft');
select is(jsonb_array_length(public.get_public_profile_actions((select username from act_accounts where kind='creator'),'creator')), 0, 'drafts are not public');
update public.profile_actions set status='published' where id=(select id from act_ids where name='collab');
select ok((select published_at is not null from public.profile_actions where id=(select id from act_ids where name='collab')), 'publishing stamps published_at');
select throws_ok($$insert into public.profile_actions(profile_id,mode_id,kind,title,config) select m.profile_id,m.id,'collab','Bad','{"surprise":true}'::jsonb from public.profile_modes m where m.profile_id=auth.uid() and m.slug='creator'$$,
  '23514', 'action_config_invalid', 'unknown config keys are rejected');
select throws_ok($$insert into public.profile_actions(profile_id,mode_id,kind,title,config) select m.profile_id,m.id,'submission','Bad','{"questions":[{"id":"q1","label":"Pick","type":"choice"}]}'::jsonb from public.profile_modes m where m.profile_id=auth.uid() and m.slug='creator'$$,
  '23514', 'action_config_invalid', 'a choice question needs options');
select throws_ok($$insert into public.profile_actions(profile_id,mode_id,kind,title) select (select user_id from act_accounts where kind='other'), m.id,'collab','Hijack' from public.profile_modes m where m.profile_id=(select user_id from act_accounts where kind='other') and m.slug='creator'$$,
  '42501', null, 'a member cannot create Actions on another profile');
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,config,status)
  select m.profile_id, m.id, 'submission', 'Ask me anything', '{"prompt":"What should I film next?","allowAnonymous":true,"questions":[{"id":"q1","label":"Topic","type":"choice","options":["Gear","Places"],"required":true}]}'::jsonb, 'published'
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='creator' returning id) insert into act_ids select 'questions', id from x;
select throws_ok($$insert into public.profile_actions(profile_id,mode_id,kind,title,status) select m.profile_id,m.id,'booking','Third','published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='creator'$$,
  'P0001', 'plan_action_limit', 'Free allows two published Actions');
select throws_ok($$insert into public.profile_actions(profile_id,mode_id,kind,title,status,ends_at) select m.profile_id,m.id,'giveaway','Win','published',now()+interval '7 days' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='creator'$$,
  'P0001', null, 'Free cannot publish a giveaway');
select is(jsonb_array_length(public.get_public_profile_actions((select username from act_accounts where kind='creator'),'creator')), 2, 'published Actions are public');

-- Plus allows a giveaway (set by billing, as the service role would).
reset role;
insert into public.billing_customers(user_id, dodo_customer_id) select user_id, 'cus_acttest' from act_accounts where kind='creator';
insert into public.billing_subscriptions(dodo_subscription_id,user_id,dodo_customer_id,dodo_product_id,plan_code,billing_interval,provider_status,
  current_period_start,current_period_end,last_provider_event_id,last_provider_event_at,last_sync_started_at)
select 'sub_acttest', user_id, 'cus_acttest', 'pdt_fixture123', 'plus', 'monthly', 'active', now()-interval '1 day', now()+interval '20 days',
  'act_fixture', now(), now() from act_accounts where kind='creator';
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from act_accounts where kind='creator'),'role','authenticated')::text, true);
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,config,status,ends_at)
  select m.profile_id, m.id, 'giveaway', 'Win a gaming headset', '{"prize":"One headset","rules":"One entry per person. No purchase necessary.","minAge":18}'::jsonb, 'published', now()+interval '7 days'
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='creator' returning id) insert into act_ids select 'giveaway', id from x;
select is((select status from public.profile_actions where id=(select id from act_ids where name='giveaway')), 'published', 'Plus can publish a giveaway');
select is((public.my_action_limits()->>'published_actions')::integer, 8, 'the owner reads their plan limits');

-- Submissions come only through the service role (the server route).
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is((public.submit_profile_action((select id from act_ids where name='collab'), null, 'Lucas Meyer', 'lucas@example.test',
  '{"collabType":"campaign","budget":"5k_10k","company":"Ondina Swim","message":"A winter campaign."}', false, 'collab-key-0000001', repeat('a',64)))->>'status', 'new', 'a valid collaboration request is stored as New');
select is((public.submit_profile_action((select id from act_ids where name='collab'), null, 'Lucas Meyer', 'lucas@example.test',
  '{"collabType":"campaign","message":"A winter campaign."}', false, 'collab-key-0000001', repeat('a',64)))->>'duplicate', 'true', 'a retried request with the same key is not stored twice');
select throws_ok($$select public.submit_profile_action((select id from act_ids where name='collab'), null, 'X', 'x@example.test', '{"collabType":"campaign","message":"hi","admin":"1"}', false, 'collab-key-0000002', null)$$,
  '22023', 'unknown_field', 'unknown fields are rejected');
select throws_ok($$select public.submit_profile_action((select id from act_ids where name='collab'), null, 'X', 'not-an-email', '{"collabType":"campaign","message":"hi"}', false, 'collab-key-0000003', null)$$,
  '22023', 'invalid_email', 'a malformed email is rejected');
select throws_ok($$select public.submit_profile_action((select id from act_ids where name='collab'), null, 'X', 'x@example.test', '{"collabType":"licensing","message":"hi"}', false, 'collab-key-0000004', null)$$,
  '22023', 'invalid_collab_type', 'only the collab types the creator offers are accepted');
select throws_ok($$select public.submit_profile_action((select id from act_ids where name='questions'), null, '', null, '{"message":"Which lens?","q1":"Cars"}', false, 'question-key-00001', null)$$,
  '22023', 'invalid_choice', 'a choice answer must be one of the options');
select is((public.submit_profile_action((select id from act_ids where name='questions'), null, '', null, '{"message":"Which lens?","q1":"Gear"}', false, 'question-key-00002', null))->>'status', 'new', 'an anonymous question is accepted when the creator allows it');

-- Giveaway: verify by email, one entry per address.
select ok((public.submit_profile_action((select id from act_ids where name='giveaway'), null, 'Noor', 'Noor.Haddad+win@gmail.com', '{}', false, 'give-key-000000001', null))->>'verify_token' ~ '^[0-9a-f]{64}$', 'a giveaway entry gets a verification token');
select is((select status from public.action_submissions where action_id=(select id from act_ids where name='giveaway')), 'pending_verification', 'entries wait for email confirmation');
select is((public.submit_profile_action((select id from act_ids where name='giveaway'), null, 'Noor again', 'noorhaddad@gmail.com', '{}', false, 'give-key-000000002', null))->>'duplicate', 'true', 'the same Gmail address with dots or a +tag is the same entry');
select is((select count(*)::integer from public.action_submissions where action_id=(select id from act_ids where name='giveaway')), 1, 'duplicate entries are not stored');
select is((public.confirm_action_entry(repeat('0',64)))->>'ok', 'false', 'an unknown token confirms nothing');
reset role;
update public.action_submissions set verify_token_hash=extensions.digest(repeat('b',64),'sha256') where action_id=(select id from act_ids where name='giveaway');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is((public.confirm_action_entry(repeat('b',64)))->>'ok', 'true', 'the emailed token confirms the entry');
select is((select status from public.action_submissions where action_id=(select id from act_ids where name='giveaway')), 'entered', 'a confirmed entry counts');

-- Closed giveaways and unpublished pages take nothing.
reset role;
update public.profile_actions set status='closed' where id=(select id from act_ids where name='giveaway');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok($$select public.submit_profile_action((select id from act_ids where name='giveaway'), null, 'Late', 'late@example.test', '{}', false, 'give-key-000000003', null)$$,
  'P0002', 'action_unavailable', 'a closed giveaway rejects entries');
reset role;
update public.profile_modes set is_enabled=false where slug='creator' and profile_id=(select user_id from act_accounts where kind='creator');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok($$select public.submit_profile_action((select id from act_ids where name='collab'), null, 'X', 'x@example.test', '{"collabType":"campaign","message":"hi"}', false, 'collab-key-0000005', null)$$,
  'P0002', 'action_unavailable', 'turning the Mode off stops submissions');
select is(jsonb_array_length(public.get_public_profile_actions((select username from act_accounts where kind='creator'),'creator')), 0, 'an off Mode shows no Actions');
reset role;
update public.profile_modes set is_enabled=true where slug='creator' and profile_id=(select user_id from act_accounts where kind='creator');

-- Isolation between creators.
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from act_accounts where kind='other'),'role','authenticated')::text, true);
select is((select count(*)::integer from public.action_submissions), 0, 'another creator sees none of these submissions');
select is((select count(*)::integer from public.profile_actions), 0, 'another creator sees none of these Actions');
select is(public.set_action_submission_status((select s.id from public.action_submissions s limit 1), 'declined'), false, 'another creator cannot change a status');
select ok(not public.can_export_action((select id from act_ids where name='giveaway')), 'another creator cannot export entries');

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from act_accounts where kind='member'),'role','authenticated')::text, true);
select is((select count(*)::integer from public.action_submissions), 0, 'a visitor member cannot read submissions');

-- The owner manages their inbox.
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from act_accounts where kind='creator'),'role','authenticated')::text, true);
select is((select count(*)::integer from public.action_submissions), 3, 'the owner sees their submissions');
select ok(public.set_action_submission_status((select s.id from public.action_submissions s where s.kind='collab'), 'interested'), 'the owner moves a request to Interested');
select throws_ok($$select public.set_action_submission_status((select s.id from public.action_submissions s where s.kind='collab'), 'entered')$$,
  '22023', 'invalid_status', 'statuses must fit the Action kind');
select ok(public.can_export_action((select id from act_ids where name='giveaway')), 'Plus owners can export entries');
select throws_ok($$update public.profile_actions set config='{"prize":"Something else"}' where id=(select id from act_ids where name='giveaway')$$,
  '23514', 'giveaway_terms_locked', 'giveaway terms cannot change once people entered');
select ok(public.delete_action_submission((select s.id from public.action_submissions s where s.kind='submission')), 'the owner can delete a submission');

select * from finish();
rollback;
