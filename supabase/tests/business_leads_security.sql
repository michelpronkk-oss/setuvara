begin;

select plan(31);

-- A business owner (Free, later Plus), a second business, and a stranger.
create temporary table bl_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into bl_accounts select kind, id, 'bl_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('owner'),('rival'),('stranger')) v(kind)) s;
grant select on bl_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from bl_accounts;
update public.profiles set is_published=true where id in (select user_id from bl_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from bl_accounts);
create temporary table bl_ids(name text primary key, id uuid);
grant select, insert on bl_ids to anon, authenticated, service_role;

create function pg_temp.as_user(p_kind text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from bl_accounts where kind=p_kind),'role','authenticated')::text, true);
$$;
create function pg_temp.uid(p_kind text) returns uuid language sql as $$ select user_id from bl_accounts where kind=p_kind $$;
create function pg_temp.act(p_name text) returns uuid language sql as $$ select id from bl_ids where name=p_name $$;
create function pg_temp.submit(p_action text, p_name text, p_email text, p_answers jsonb, p_key text) returns uuid language sql as $$
  select (public.submit_profile_action(pg_temp.act(p_action), null, p_name, p_email, p_answers, false, rpad(p_key, 16, '0'), null)->>'id')::uuid
$$;
create function pg_temp.lead(p_email text) returns uuid language sql as $$ select id from public.business_leads where email_norm=p_email order by created_at desc limit 1 $$;
grant execute on function pg_temp.as_user(text), pg_temp.uid(text), pg_temp.act(text), pg_temp.submit(text,text,text,jsonb,text), pg_temp.lead(text) to authenticated, service_role, anon;

-- The owner has Plus; the rival business stays on Free.
insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at)
select 'sub_BlOwner', user_id, 'cus_BlOwner', 'pdt_BlPlus', 'plus', 'monthly', 'active', 'bl-fixture', now(), now() from bl_accounts where kind='owner';

set local role authenticated;
select pg_temp.as_user('owner');
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'booking', 'Book a consult', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business' returning id)
insert into bl_ids select 'booking', id from x;
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'collab', 'Work with us', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business' returning id)
insert into bl_ids select 'collab', id from x;
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'submission', 'Ask me', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='personal' returning id)
insert into bl_ids select 'personal', id from x;
select pg_temp.as_user('rival');
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'booking', 'Rival booking', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business' returning id)
insert into bl_ids select 'rival', id from x;
reset role;

-- Inquiries arrive (service role, as the public route sends them).
set local role service_role;
select pg_temp.submit('booking', 'Mara Vos', 'Mara.Vos@example.test', '{"message":"Can we meet Thursday?","company":"Vos & Co"}', 'k-mara-1');
select pg_temp.submit('collab', 'Mara Vos', 'mara.vos@example.test', '{"message":"Also a collab","collabType":"campaign"}', 'k-mara-2');
select pg_temp.submit('booking', 'Jun Park', 'jun@example.test', '{"message":"Hello"}', 'k-jun-1');
select pg_temp.submit('personal', 'Not Business', 'pers@example.test', '{"message":"Hi"}', 'k-pers-1');
select pg_temp.submit('rival', 'Mara Vos', 'mara.vos@example.test', '{"message":"Other business"}', 'k-rival-1');
select pg_temp.submit('booking', 'Spammy', 'spam@example.test', '{"message":"Buy now"}', 'k-spam-1');
reset role;

select is((select count(*) from public.business_leads where profile_id=pg_temp.uid('owner'))::integer, 3, 'Business inquiries become leads; Personal ones do not');
select is((select inquiries from public.business_leads where email_norm='mara.vos@example.test' and profile_id=pg_temp.uid('owner')), 2, 'a second inquiry from the same email joins the open lead');
select is((select count(*) from public.business_lead_activities where lead_id=(select id from public.business_leads where profile_id=pg_temp.uid('owner') and email_norm='mara.vos@example.test'))::integer, 2, 'the lead keeps both inquiries in its history');
select is((select count(*) from public.business_leads where profile_id=pg_temp.uid('rival'))::integer, 1, 'the same person writing to another business is that business''s lead');
select is((select stage from public.business_leads where profile_id=pg_temp.uid('owner') and email_norm='jun@example.test'), 'new', 'new leads start as New');

-- Spam takes an untouched lead away, and back again when it was a mistake.
set local role authenticated;
select pg_temp.as_user('owner');
select ok(public.set_action_submission_status((select id from public.action_submissions where email='spam@example.test'), 'spam'), 'the owner marks an inquiry as spam');
select is((select count(*) from public.business_leads where email_norm='spam@example.test')::integer, 0, 'an untouched lead from spam is removed');
select ok(public.set_action_submission_status((select id from public.action_submissions where email='spam@example.test'), 'new'), 'and un-marks it');
select is((select count(*) from public.business_leads where email_norm='spam@example.test')::integer, 1, 'the lead comes back');

-- Stages.
select is(public.set_business_lead_stage((select id from public.business_leads where profile_id=auth.uid() and email_norm='jun@example.test'), 'contacted')->>'stage', 'contacted', 'the owner moves a lead to Contacted');
select is((select from_stage||'>'||to_stage from public.business_lead_activities where kind='stage' and lead_id=(select id from public.business_leads where profile_id=auth.uid() and email_norm='jun@example.test')), 'new>contacted', 'the stage change is in the history');
select is(public.set_business_lead_stage((select id from public.business_leads where profile_id=auth.uid() and email_norm='jun@example.test'), 'contacted')->>'changed', 'false', 'the same stage twice is one change');
select throws_ok($$select public.set_business_lead_stage((select id from public.business_leads where profile_id=auth.uid() and email_norm='jun@example.test'), 'paid')$$, '22023', 'invalid_stage', 'only the five stages exist');
select throws_ok($$select public.set_business_lead_stage((select id from public.business_leads where profile_id=auth.uid() and email_norm='jun@example.test'), 'qualified', 'too early')$$, '22023', 'invalid_reason', 'a reason belongs to Lost only');
select is(public.set_business_lead_stage((select id from public.business_leads where profile_id=auth.uid() and email_norm='jun@example.test'), 'lost', 'Went elsewhere')->>'stage', 'lost', 'a lead can be lost with a reason');
select is(public.set_business_lead_stage((select id from public.business_leads where profile_id=auth.uid() and email_norm='mara.vos@example.test'), 'won')->>'stage', 'won', 'a lead can be won');
reset role;

-- After a closed lead, the same email starts a new one.
set local role service_role;
select pg_temp.submit('booking', 'Jun Park', 'jun@example.test', '{"message":"Back again"}', 'k-jun-2');
reset role;
select is((select count(*) from public.business_leads where profile_id=pg_temp.uid('owner') and email_norm='jun@example.test')::integer, 2, 'a new inquiry after Lost opens a new lead');
set local role authenticated;
select pg_temp.as_user('owner');
select throws_ok($$select public.set_business_lead_stage((select id from public.business_leads where profile_id=auth.uid() and email_norm='jun@example.test' and stage='lost'), 'new')$$,
  '23505', 'lead_open_elsewhere', 'a closed lead cannot reopen while the email has another open lead');

-- Notes are Plus: the rival is on Free.
select pg_temp.as_user('rival');
select throws_ok($$select public.add_business_lead_note((select id from public.business_leads where profile_id=auth.uid()), 'Signed', 'note-key-00000009')$$,
  'P0001', 'notes_require_plus', 'notes need Plus');
select is(public.my_business_limits()->>'funnel_days', '7', 'Free sees a 7-day funnel');
select pg_temp.as_user('owner');
select isnt(public.add_business_lead_note((select id from public.business_leads where profile_id=auth.uid() and stage='won'), 'Signed for Q1', 'note-key-00000001'), null, 'with Plus the owner adds a note');
select is(public.add_business_lead_note((select id from public.business_leads where profile_id=auth.uid() and stage='won'), 'Signed for Q1', 'note-key-00000001'),
  (select id from public.business_lead_activities where kind='note'), 'a retried note is the same note');
select throws_ok($$select public.add_business_lead_note((select id from public.business_leads where profile_id=auth.uid() and stage='won'), '   ', 'note-key-00000002')$$, '22023', 'invalid_note', 'an empty note is refused');

-- The funnel counts what happened, from what is recorded.
select is((public.my_business_funnel(30)->>'days')::integer, 30, 'Plus asks for 30 days and gets them');
select is((public.my_business_funnel(1000)->>'days')::integer, 90, 'never more than the plan allows');
select is(public.my_business_funnel(30)->'leads', '4'::jsonb, 'leads in the window');
select is(public.my_business_funnel(30)->'bookings', '4'::jsonb, 'booking requests, without spam');
select is(public.my_business_funnel(30)->'won', '1'::jsonb, 'won is what the owner marked');

-- Nobody else reads or changes these leads.
select pg_temp.as_user('stranger');
select is((select count(*) from public.business_leads)::integer, 0, 'another member reads no leads');
select throws_ok($$select public.set_business_lead_stage((select id from bl_ids where name='booking'), 'won')$$, 'P0002', 'lead_not_found', 'another member cannot move a lead');
reset role;
set local role anon;
select throws_ok($$select count(*) from public.business_leads$$, '42501', null, 'visitors cannot read leads');
reset role;

select * from finish();
rollback;
