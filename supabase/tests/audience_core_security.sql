begin;

select plan(41);

-- An owner with two Newsletters (Personal, Business) and a Form, and another member.
create temporary table au_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into au_accounts select kind, id, 'au_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('owner'),('member')) v(kind)) s;
grant select on au_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from au_accounts;
update public.profiles set is_published=true where id in (select user_id from au_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from au_accounts);
create temporary table au_ids(name text primary key, id uuid);
grant select, insert on au_ids to anon, authenticated, service_role;

with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, v.kind, v.title, 'published' from public.profile_modes m
  join (values('personal','newsletter','Letters'),('business','newsletter','Studio notes'),('event','form','RSVP')) v(slug,kind,title) on v.slug=m.slug
  where m.profile_id=(select user_id from au_accounts where kind='owner') returning id, title)
insert into au_ids select case title when 'Letters' then 'letters' when 'Studio notes' then 'notes' else 'form' end, id from x;
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'newsletter', 'Theirs', 'published' from public.profile_modes m
  where m.profile_id=(select user_id from au_accounts where kind='member') and m.slug='personal' returning id)
insert into au_ids select 'theirs', id from x;

-- Alice is on both lists, Bob on Letters, Carol never confirmed, Dave left, Erin only filled the Form.
insert into public.action_submissions(action_id,profile_id,kind,name,email,email_norm,status,verified_at,idempotency_key)
select (select id from au_ids where name=v.list), (select user_id from au_accounts where kind='owner'), v.kind, v.name, v.email, v.email,
  v.status, case when v.status in ('subscribed','unsubscribed') then now() - interval '2 days' end, 'au-key-'||lpad(v.n::text, 12, '0')
from (values
  (1,'letters','newsletter','Alice','alice@example.test','subscribed'),
  (2,'notes','newsletter','Alice','alice@example.test','subscribed'),
  (3,'letters','newsletter','Bob','bob@example.test','subscribed'),
  (4,'letters','newsletter','Carol','carol@example.test','pending_verification'),
  (5,'letters','newsletter','Dave','dave@example.test','unsubscribed'),
  (6,'form','form','Erin','erin@example.test','new')) v(n,list,kind,name,email,status);

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from au_accounts where kind='owner'),'role','authenticated')::text, true);

-- The audience counts confirmed Newsletter people only, once each.
select is((public.my_audience_summary()->>'people')::integer, 2, 'people are confirmed newsletter addresses, one per address');
select is((public.my_audience_summary()->>'pending')::integer, 1, 'unconfirmed signups are counted apart');
select is(jsonb_array_length(public.my_audience_summary()->'lists'), 2, 'only Newsletters are lists');
select is(jsonb_array_length(public.my_audience_summary()->'daily'), 90, 'growth covers 90 days');

-- Drafts: the owner writes words and picks lists; nothing else.
with x as (insert into public.audience_campaigns(profile_id, list_ids, subject, body)
  values (auth.uid(), array[(select id from au_ids where name='letters'),(select id from au_ids where name='notes')], 'Hello', 'First letter.') returning id)
insert into au_ids select 'c1', id from x;
select is((select status from public.audience_campaigns where id=(select id from au_ids where name='c1')), 'draft', 'a new campaign is a draft');
select throws_ok($$insert into public.audience_campaigns(profile_id, list_ids, subject, body, status) values (auth.uid(), '{}', 'x', 'y', 'sent')$$,
  '42501', null, 'the owner cannot write a campaign status');
select throws_ok($$update public.audience_campaigns set recipient_count=99 where id=(select id from au_ids where name='c1')$$,
  '42501', null, 'the owner cannot write delivery counts');
select throws_ok($$insert into public.audience_campaigns(profile_id, list_ids, subject, body) values (auth.uid(), array[(select id from au_ids where name='form')], 'x', 'y')$$,
  '23514', 'campaign_list_invalid', 'a Form is not a list');
select throws_ok($$insert into public.audience_campaigns(profile_id, list_ids, subject, body) values (auth.uid(), array[(select id from au_ids where name='theirs')], 'x', 'y')$$,
  '23514', 'campaign_list_invalid', 'a list from another member is refused');
select throws_ok($$insert into public.audience_campaigns(profile_id, list_ids, subject, body) values ((select user_id from au_accounts where kind='member'), '{}', 'x', 'y')$$,
  '42501', null, 'nobody writes campaigns for another member');

-- Free can collect but not send.
select throws_ok($$select public.queue_audience_campaign((select id from au_ids where name='c1'))$$,
  'P0001', 'plan_send_unavailable', 'Free cannot send');
select throws_ok($$select public.note_audience_campaign_test((select id from au_ids where name='c1'))$$,
  'P0001', 'plan_send_unavailable', 'Free cannot send tests');
reset role;
update private.audience_plan_limits set can_send=true, monthly_emails=3, daily_campaigns=3, campaign_tests=1 where plan_code='free';
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from au_accounts where kind='owner'),'role','authenticated')::text, true);

select ok(public.note_audience_campaign_test((select id from au_ids where name='c1')), 'a test is counted');
select throws_ok($$select public.note_audience_campaign_test((select id from au_ids where name='c1'))$$,
  'P0001', 'plan_campaign_tests', 'tests have an allowance per campaign');

-- Queueing: one recipient per confirmed address on the lists.
select is((public.queue_audience_campaign((select id from au_ids where name='c1'))->>'recipients')::integer, 2, 'Alice once and Bob; not Carol, Dave or Erin');
select is((select array_agg(email order by email) from public.audience_campaign_recipients where campaign_id=(select id from au_ids where name='c1')),
  array['alice@example.test','bob@example.test'], 'the snapshot holds the confirmed addresses');
select throws_ok($$select public.queue_audience_campaign((select id from au_ids where name='c1'))$$,
  '22023', 'campaign_locked', 'a campaign queues once');
update public.audience_campaigns set subject='Changed' where id=(select id from au_ids where name='c1');
select is((select subject from public.audience_campaigns where id=(select id from au_ids where name='c1')), 'Hello', 'a queued campaign cannot be edited');
delete from public.audience_campaigns where id=(select id from au_ids where name='c1');
select is((select count(*)::integer from public.audience_campaigns where id=(select id from au_ids where name='c1')), 1, 'a queued campaign cannot be deleted');

with x as (insert into public.audience_campaigns(profile_id, list_ids, subject, body)
  values (auth.uid(), array[(select id from au_ids where name='letters')], 'Again', 'Second.') returning id)
insert into au_ids select 'c2', id from x;
select throws_ok($$select public.queue_audience_campaign((select id from au_ids where name='c2'))$$,
  'P0001', 'plan_monthly_emails', 'the monthly email allowance holds');

-- Another member sees none of it, and nobody but the server delivers.
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from au_accounts where kind='member'),'role','authenticated')::text, true);
select is((select count(*)::integer from public.audience_campaigns), 0, 'another member reads no campaigns');
select is((select count(*)::integer from public.audience_campaign_recipients), 0, 'another member reads no recipients');
select is((public.my_audience_summary()->>'people')::integer, 0, 'a summary covers only its reader');
select throws_ok($$select public.claim_audience_batch(null, 100)$$, '42501', null, 'members cannot claim deliveries');
select throws_ok($$select public.audience_unsubscribe(gen_random_uuid())$$, '42501', null, 'members cannot call unsubscribe directly');
reset role;
set local role anon;
select throws_ok($$select public.complete_audience_batch(gen_random_uuid(), true, '{}', null, false)$$, '42501', null, 'visitors cannot report deliveries');
reset role;

-- Delivery: a claimed batch is leased, a lost batch comes back with the same key, then it completes.
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
create temporary table au_batch(n integer primary key, body jsonb);
grant all on au_batch to service_role;
insert into au_batch select 1, public.claim_audience_batch((select id from au_ids where name='c1'), 100);
select is(jsonb_array_length((select body->'recipients' from au_batch where n=1)), 2, 'a batch holds the queued recipients');
select is((select status from public.audience_campaigns where id=(select id from au_ids where name='c1')), 'sending', 'claiming starts the campaign');
select is(public.claim_audience_batch((select id from au_ids where name='c1'), 100), null, 'a leased batch is not handed out twice');
update public.audience_campaign_recipients set lease_until=now() - interval '1 minute' where campaign_id=(select id from au_ids where name='c1');
insert into au_batch select 2, public.claim_audience_batch((select id from au_ids where name='c1'), 100);
select is((select body->>'batch_key' from au_batch where n=2), (select body->>'batch_key' from au_batch where n=1), 'a batch that never reported returns with the same key');
select public.complete_audience_batch(((select body->>'batch_key' from au_batch where n=1))::uuid, false, '{}', 'resend_429', true);
select is((select count(*)::integer from public.audience_campaign_recipients where campaign_id=(select id from au_ids where name='c1') and status='queued'), 2, 'a retryable failure puts people back in the queue');
update public.audience_campaign_recipients set lease_until=null where campaign_id=(select id from au_ids where name='c1');
insert into au_batch select 3, public.claim_audience_batch((select id from au_ids where name='c1'), 100);
select public.complete_audience_batch(((select body->>'batch_key' from au_batch where n=3))::uuid, true, '{}', null, false);
select is((select status||':'||sent_count from public.audience_campaigns where id=(select id from au_ids where name='c1')), 'sent:2', 'a completed batch closes the campaign');

-- Unsubscribing from the email takes Alice off both lists, and the owner cannot put her back.
select is((public.audience_unsubscribe((select id from public.audience_campaign_recipients where email='alice@example.test')))->>'removed', '2', 'leaving removes the address from every list the campaign went to');
select is((select count(*)::integer from public.action_submissions where email='alice@example.test' and status='unsubscribed' and unsubscribed_by='person'), 2, 'the person left by themselves');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from au_accounts where kind='owner'),'role','authenticated')::text, true);
select throws_ok($$select public.set_action_submission_status((select id from public.action_submissions where email='alice@example.test' and action_id=(select id from au_ids where name='letters')), 'subscribed')$$,
  '22023', 'invalid_status', 'the owner cannot re-subscribe someone who left');
select ok(public.set_action_submission_status((select id from public.action_submissions where email='bob@example.test'), 'unsubscribed'), 'the owner removes Bob');
select ok(public.set_action_submission_status((select id from public.action_submissions where email='bob@example.test'), 'subscribed'), 'and can undo their own removal');
reset role;

-- People who leave after queueing are skipped, never sent.
update private.audience_plan_limits set monthly_emails=100 where plan_code='free';
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from au_accounts where kind='owner'),'role','authenticated')::text, true);
select is((public.queue_audience_campaign((select id from au_ids where name='c2'))->>'recipients')::integer, 1, 'only Bob is still on Letters');
select ok(public.set_action_submission_status((select id from public.action_submissions where email='bob@example.test'), 'unsubscribed'), 'Bob is removed before delivery');
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(public.claim_audience_batch((select id from au_ids where name='c2'), 100), null, 'nothing is sent to people who left');
select is((select status||':'||skipped_count from public.audience_campaigns where id=(select id from au_ids where name='c2')), 'sent:1', 'the campaign closes with Bob skipped');
reset role;

select * from finish();
rollback;
