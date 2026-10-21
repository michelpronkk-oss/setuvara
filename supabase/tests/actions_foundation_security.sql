begin;

select plan(24);

-- An owner with a live Form, a draft Form and a scheduled Newsletter, and another member.
create temporary table af_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into af_accounts select kind, id, 'af_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('owner'),('member')) v(kind)) s;
grant select on af_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from af_accounts;
update public.profiles set is_published=true where id in (select user_id from af_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from af_accounts);
create temporary table af_ids(name text primary key, id uuid);
grant select, insert on af_ids to anon, authenticated, service_role;

with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status,starts_at,ends_at,show_before_start,show_after_end)
  select m.profile_id, m.id, v.kind, v.title, v.status, v.starts_at, v.ends_at, v.before, v.after from public.profile_modes m
  join (values
    ('live','form','Say hello','published',null::timestamptz,null::timestamptz,true,true),
    ('draft','form','Not yet','draft',null,null,true,true),
    ('soon','newsletter','Soon','published',now()+interval '2 days',null,false,true),
    ('teaser','newsletter','Teaser','published',now()+interval '2 days',null,true,true),
    ('gone','form','Gone','published',now()-interval '9 days',now()-interval '1 day',true,false)) v(name,kind,title,status,starts_at,ends_at,before,after) on m.slug='personal'
  where m.profile_id=(select user_id from af_accounts where kind='owner') returning id, title)
insert into af_ids select case title when 'Say hello' then 'live' when 'Not yet' then 'draft' when 'Soon' then 'soon' when 'Teaser' then 'teaser' else 'gone' end, id from x;
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'form', 'Theirs', 'published' from public.profile_modes m
  where m.profile_id=(select user_id from af_accounts where kind='member') and m.slug='personal' returning id)
insert into af_ids select 'theirs', id from x;
insert into public.action_submissions(action_id,profile_id,kind,name,email,email_norm,status,idempotency_key)
select (select id from af_ids where name='live'), (select user_id from af_accounts where kind='owner'), 'form', 'Erin', 'erin@example.test', 'erin@example.test', 'new', 'af-key-000000000001';

-- Scheduling: hidden-until-open and hidden-after-close Actions leave the public list.
select is((select array_agg(x->>'title' order by x->>'title') from jsonb_array_elements(public.get_public_profile_actions((select username from af_accounts where kind='owner'),'personal')) x),
  array['Say hello','Teaser'], 'scheduled Actions show only when their owner wants them shown');

-- Insights: counted only by the server, for live Actions, never for the owner.
set local role anon;
select throws_ok($$select public.record_action_event(array[(select id from af_ids where name='live')], 'view', null)$$, '42501', null, 'visitors cannot write counts directly');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from af_accounts where kind='member'),'role','authenticated')::text, true);
select throws_ok($$select public.record_action_event(array[(select id from af_ids where name='live')], 'view', null)$$, '42501', null, 'members cannot write counts directly');
select throws_ok($$select * from public.action_daily_stats$$, '42501', null, 'members cannot read raw counts');
reset role;
set local role service_role;
select is(public.record_action_event(array[(select id from af_ids where name='live'),(select id from af_ids where name='draft'),(select id from af_ids where name='teaser')], 'view', null), 2, 'drafts are not counted');
select is(public.record_action_event(array[(select id from af_ids where name='live')], 'view', (select user_id from af_accounts where kind='member')), 1, 'another member counts');
select is(public.record_action_event(array[(select id from af_ids where name='live')], 'open', (select user_id from af_accounts where kind='owner')), 0, 'the owner never counts');
select is(public.record_action_event(array[(select id from af_ids where name='live')], 'open', null), 1, 'an open counts');
select throws_ok($$select public.record_action_event(array[(select id from af_ids where name='live')], 'click', null)$$, '22023', 'invalid_event', 'only views and opens');
select is((select views||'/'||opens from public.action_daily_stats where action_id=(select id from af_ids where name='live')), '2/1', 'counts add up on one row per day');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from af_accounts where kind='owner'),'role','authenticated')::text, true);
select is(public.my_action_insights(30, (select id from af_ids where name='live'))->'actions'->0->>'views', '2', 'the owner reads their views');
select is(public.my_action_insights(30, (select id from af_ids where name='live'))->'actions'->0->>'responses', '1', 'responses come from submissions');
select is((public.my_action_insights(365, (select id from af_ids where name='live'))->>'days')::integer, 7, 'Free keeps a week');
select is(jsonb_array_length(public.my_action_insights(365, (select id from af_ids where name='live'))->'daily'), 7, 'one row per day in the window');
select is(jsonb_array_length(public.my_action_insights(30, (select id from af_ids where name='theirs'))->'actions'), 0, 'another member''s Action has no insights here');

-- Thank-you and reward.
select lives_ok($$insert into public.action_thanks(action_id, profile_id, heading) values ((select id from af_ids where name='live'), auth.uid(), 'Got it.')$$, 'Free can write a heading');
select throws_ok($$update public.action_thanks set reward_kind='code', reward_code='HELLO10' where action_id=(select id from af_ids where name='live')$$,
  'P0001', 'plan_reward_unavailable', 'rewards come with Plus');
select throws_ok($$insert into public.action_thanks(action_id, profile_id) values ((select id from af_ids where name='theirs'), auth.uid())$$,
  '23514', 'action_thanks_mismatch', 'nobody thanks for another member''s Action');
select throws_ok($$insert into public.action_thanks(action_id, profile_id) values ((select id from af_ids where name='theirs'), (select user_id from af_accounts where kind='member'))$$,
  '42501', null, 'nobody writes another member''s thanks');
select throws_ok($$select public.action_thanks_for((select id from af_ids where name='live'))$$, '42501', null, 'members cannot read thanks through the server function');
reset role;
update private.action_plan_limits set can_reward=true where plan_code='free';
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from af_accounts where kind='owner'),'role','authenticated')::text, true);
select lives_ok($$update public.action_thanks set reward_kind='code', reward_label='10% off', reward_code='HELLO10' where action_id=(select id from af_ids where name='live')$$, 'a plan with rewards can set one');
select throws_ok($$update public.action_thanks set reward_kind='link', reward_url='http://example.test' where action_id=(select id from af_ids where name='live')$$,
  '23514', null, 'reward links must be https');
reset role;

set local role service_role;
select is(public.action_thanks_for((select id from af_ids where name='live'))->'reward'->>'code', 'HELLO10', 'the server reveals the reward after a real submission');
reset role;
update private.action_plan_limits set can_reward=false where plan_code='free';
set local role service_role;
select ok(public.action_thanks_for((select id from af_ids where name='live'))->'reward' = 'null'::jsonb, 'a reward stops showing when the plan no longer includes it');
reset role;

select * from finish();
rollback;
