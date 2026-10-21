begin;

select plan(35);

-- A business owner on Plus, a rival business on Free, and a stranger.
create temporary table bb_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into bb_accounts select kind, id, 'bb_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('owner'),('rival'),('stranger')) v(kind)) s;
grant select on bb_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from bb_accounts;
update public.profiles set is_published=true where id in (select user_id from bb_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from bb_accounts);
create temporary table bb_ids(name text primary key, id uuid);
grant select, insert on bb_ids to anon, authenticated, service_role;
create temporary table bb_slot(name text primary key, at timestamptz);
grant select, insert on bb_slot to anon, authenticated, service_role;

create function pg_temp.as_user(p_kind text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from bb_accounts where kind=p_kind),'role','authenticated')::text, true);
$$;
create function pg_temp.act(p_name text) returns uuid language sql as $$ select id from bb_ids where name=p_name $$;
create function pg_temp.slots(p_name text) returns jsonb language sql as $$ select public.get_booking_slots(pg_temp.act(p_name)) $$;
create function pg_temp.slot(p_name text, p_index int) returns timestamptz language sql as $$ select (pg_temp.slots(p_name)->'slots'->>p_index)::timestamptz $$;
create function pg_temp.book(p_name text, p_who text, p_at timestamptz, p_key text) returns jsonb language sql as $$
  select public.request_booking(pg_temp.act(p_name), null, p_who, lower(replace(p_who,' ','.'))||'@example.test', '{"message":"A first session"}', rpad(p_key,16,'0'), null, p_at)
$$;
grant execute on function pg_temp.as_user(text), pg_temp.act(text), pg_temp.slots(text), pg_temp.slot(text,int), pg_temp.book(text,text,timestamptz,text) to anon, authenticated, service_role;

insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at, current_period_end)
select 'sub_BbOwner', user_id, 'cus_BbOwner', 'pdt_BbPlus', 'plus', 'monthly', 'active', 'bb-fixture', now(), now(), now() + interval '30 days' from bb_accounts where kind='owner';

set local role authenticated;
select pg_temp.as_user('owner');
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'booking', 'Book a consult', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business' returning id)
insert into bb_ids select 'consult', id from x;
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'booking', 'Studio visit', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business' returning id)
insert into bb_ids select 'visit', id from x;
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status,config)
  select m.profile_id, m.id, 'booking', 'Apply', 'published', '{"offering":"application"}' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business' returning id)
insert into bb_ids select 'application', id from x;

-- 1. Hours: every day 09:00–17:00 in Amsterdam, 60-minute slots, 15-minute buffer, 2 hours' notice.
select lives_ok($$ select public.save_booking_availability(pg_temp.act('consult'), true, 'Europe/Amsterdam', 60, 15, 2, 60,
  '{"1":[["09:00","17:00"]],"2":[["09:00","17:00"]],"3":[["09:00","17:00"]],"4":[["09:00","17:00"]],"5":[["09:00","17:00"]],"6":[["09:00","17:00"]],"7":[["09:00","17:00"]]}') $$,
  'the owner sets hours, with a 60-day horizon on Plus');
select lives_ok($$ select public.save_booking_availability(pg_temp.act('visit'), true, 'Europe/Amsterdam', 30, 0, 0, 14,
  '{"1":[["09:00","12:00"],["13:00","17:00"]],"2":[["09:00","17:00"]],"3":[["09:00","17:00"]],"4":[["09:00","17:00"]],"5":[["09:00","17:00"]],"6":[["09:00","17:00"]],"7":[["09:00","17:00"]]}') $$,
  'a second Booking Action of the same owner, with a lunch break');
select throws_ok($$ select public.save_booking_availability(pg_temp.act('consult'), true, 'Europe/Amsterdam', 60, 15, 2, 61, '{}') $$, '22023', 'horizon_over_plan', 'Plus cannot book further out than 60 days');
select throws_ok($$ select public.save_booking_availability(pg_temp.act('consult'), true, 'Mars/Olympus', 60, 15, 2, 30, '{}') $$, '22023', 'invalid_timezone', 'an unknown time zone is refused');
select throws_ok($$ select public.save_booking_availability(pg_temp.act('consult'), true, 'Europe/Amsterdam', 60, 15, 2, 30, '{"1":[["17:00","09:00"]]}') $$, '22023', 'invalid_hours', 'a range that ends before it starts is refused');
select throws_ok($$ select public.save_booking_availability(pg_temp.act('consult'), true, 'Europe/Amsterdam', 60, 15, 2, 30, '{"8":[["09:00","17:00"]]}') $$, '22023', 'invalid_hours', 'a weekday outside 1–7 is refused');
select throws_ok($$ select public.save_booking_availability(pg_temp.act('consult'), true, 'Europe/Amsterdam', 60, 15, 2, 30, '{"1":[["09:00","13:00"],["12:00","17:00"]]}') $$, '22023', 'invalid_hours', 'overlapping ranges are refused');
select throws_ok($$ select public.save_booking_availability(pg_temp.act('consult'), true, 'Europe/Amsterdam', 7, 15, 2, 30, '{}') $$, '23514', null, 'a slot length outside the list is refused');
select throws_ok($$ select public.save_booking_availability(pg_temp.act('application'), true, 'Europe/Amsterdam', 60, 0, 0, 14, '{}') $$, '22023', 'not_a_booking', 'applications do not take times');

select pg_temp.as_user('stranger');
select throws_ok($$ select public.save_booking_availability(pg_temp.act('consult'), false, 'UTC', 60, 0, 0, 14, '{}') $$, 'P0002', 'action_not_found', 'nobody else can change the hours');
select is((select count(*) from public.booking_availability), 0::bigint, 'nobody else can read the hours');
select pg_temp.as_user('rival');
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'booking', 'Rival booking', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business' returning id)
insert into bb_ids select 'rival', id from x;
select throws_ok($$ select public.save_booking_availability(pg_temp.act('rival'), true, 'UTC', 60, 0, 0, 30, '{"1":[["09:00","17:00"]]}') $$, '22023', 'horizon_over_plan', 'Free books up to 14 days ahead');
reset role;

-- 2. Open times, as a visitor sees them.
set local role anon;
select is((pg_temp.slots('consult')->>'enabled')::boolean, true, 'a visitor sees that times are open');
select ok(jsonb_array_length(pg_temp.slots('consult')->'slots') > 40, 'and many open times across the horizon');
select ok((select bool_and((s::timestamptz at time zone 'Europe/Amsterdam')::time between '09:00' and '16:00')
  from jsonb_array_elements_text(pg_temp.slots('consult')->'slots') s), 'every time starts inside the hours in the owner''s zone, through any clock change');
select ok((select bool_and(s::timestamptz >= now() + interval '2 hours') from jsonb_array_elements_text(pg_temp.slots('consult')->'slots') s), 'nothing inside the notice window');
select ok((select bool_and(s::timestamptz < now() + interval '60 days') from jsonb_array_elements_text(pg_temp.slots('consult')->'slots') s), 'nothing past the horizon');
select is((pg_temp.slots('application')->>'enabled')::boolean, false, 'an Action without hours shows no times');
select throws_ok($$ select public.request_booking(pg_temp.act('consult'), null, 'Bot', 'bot@example.test', '{"message":"x"}', rpad('bot',16,'0'), null, now()) $$, '42501', null, 'a visitor cannot write a request straight to the database');
select throws_ok($$ select count(*) from public.business_bookings $$, '42501', null, 'a visitor cannot read held times');
reset role;

-- 3. Requests (service role, as the public route sends them).
set local role service_role;
insert into bb_slot values ('first', pg_temp.slot('consult', 0)), ('second', pg_temp.slot('consult', 1));
select lives_ok($$ select pg_temp.book('consult', 'Mara Vos', (select at from bb_slot where name='first'), 'k-mara') $$, 'a visitor requests an open time');
select is((select b.status from public.business_bookings b join public.action_submissions s on s.id=b.submission_id where s.name='Mara Vos'), 'requested', 'the time is held as requested');
select ok((select answers->>'preferredDates' like '%(Europe/Amsterdam)' from public.action_submissions where name='Mara Vos'), 'the request carries the time in the owner''s zone');
select is((select count(*) from public.business_leads where email_norm='mara.vos@example.test'), 1::bigint, 'and arrives as a lead');
select is((pg_temp.book('consult', 'Mara Vos', (select at from bb_slot where name='first'), 'k-mara')->>'duplicate')::boolean, true, 'a retried request is the same request');
select throws_ok($$ select pg_temp.book('consult', 'Jun Park', (select at from bb_slot where name='first'), 'k-jun') $$, '23P01', 'slot_taken', 'the same time cannot be taken twice');
select throws_ok($$ select pg_temp.book('visit', 'Jun Park', (select at from bb_slot where name='first') + interval '30 minutes', 'k-jun2') $$, '23P01', 'slot_taken', 'another of the owner''s Actions cannot take an overlapping time');
select throws_ok($$ select pg_temp.book('consult', 'Ada Host', date_trunc('day', now()) + interval '3 days 3 hours 17 minutes', 'k-ada') $$, '23P01', 'slot_taken', 'a time that was never open is refused');
insert into bb_ids select 'jun_sub', (public.submit_profile_action(pg_temp.act('visit'), null, 'Jun Park', 'jun@example.test', '{"message":"Direct"}', false, rpad('k-jun-direct',16,'0'), null)->>'id')::uuid;
select throws_ok($$ insert into public.business_bookings (profile_id, action_id, submission_id, starts_at, ends_at, held_until, timezone)
  select b.profile_id, pg_temp.act('visit'), pg_temp.act('jun_sub'), b.starts_at + interval '10 minutes', b.ends_at + interval '10 minutes', b.held_until + interval '10 minutes', 'UTC'
  from public.business_bookings b limit 1 $$, '23P01', null, 'the database itself refuses overlapping holds');
select ok(not exists(select 1 from jsonb_array_elements_text(pg_temp.slots('consult')->'slots') x where x::timestamptz = (select at from bb_slot where name='first')), 'the held time is no longer offered');
select ok(not exists(select 1 from jsonb_array_elements_text(pg_temp.slots('visit')->'slots') x
  where tstzrange(x::timestamptz, x::timestamptz + interval '30 minutes') && tstzrange((select at from bb_slot where name='first'), (select at from bb_slot where name='first') + interval '75 minutes')), 'and the owner''s other Action skips it too, with the buffer after it');
reset role;

-- 4. The owner decides.
set local role authenticated;
select pg_temp.as_user('owner');
select is((select count(*) from public.business_bookings), 1::bigint, 'the owner sees the held time');
select public.set_action_submission_status((select id from public.action_submissions where name='Mara Vos'), 'declined');
select is((select status from public.business_bookings), 'cancelled', 'declining frees the time');
select ok(exists(select 1 from jsonb_array_elements_text(public.get_booking_slots(pg_temp.act('consult'))->'slots') x where x::timestamptz = (select at from bb_slot where name='first')), 'and offers it again');
select public.set_action_submission_status((select id from public.action_submissions where name='Mara Vos'), 'accepted');
select is((select status from public.business_bookings), 'confirmed', 'accepting confirms it');
reset role;

select * from finish();
rollback;
