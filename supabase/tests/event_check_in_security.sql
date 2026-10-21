begin;

select plan(29);

-- An organizer, two members who RSVP as themselves, and a stranger.
create temporary table ci_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into ci_accounts select kind, id, 'ci_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('owner'),('member'),('quiet'),('stranger')) v(kind)) s;
grant select on ci_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from ci_accounts;
update public.profiles set is_published=true where id in (select user_id from ci_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from ci_accounts);
create temporary table ci_ids(name text primary key, id uuid);
grant select, insert, update on ci_ids to anon, authenticated, service_role;

create function pg_temp.as_user(p_kind text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from ci_accounts where kind=p_kind),'role','authenticated')::text, true);
$$;
create function pg_temp.uid(p_kind text) returns uuid language sql as $$ select user_id from ci_accounts where kind=p_kind $$;
create function pg_temp.reg(p_event text, p_name text, p_email text, p_key text, p_user uuid default null) returns uuid language sql as $$
  select (public.register_for_event((select id from ci_ids where name=p_event), p_user, p_name, p_email, rpad(p_key, 16, '0'), null)->>'id')::uuid;
$$;
create function pg_temp.guest(p_email text) returns uuid language sql as $$ select id from public.event_registrations where email=p_email and event_id=(select id from ci_ids where name='tonight') $$;
grant execute on function pg_temp.as_user(text), pg_temp.uid(text), pg_temp.reg(text,text,text,text,uuid), pg_temp.guest(text) to authenticated, service_role, anon;

-- Tonight (check-in open, three seats) and one in three days (check-in not open yet).
set local role authenticated;
select pg_temp.as_user('owner');
with x as (insert into public.events(profile_id, mode_id, title, status, starts_at, ends_at, timezone, capacity, venue_name, city, country_code)
  select auth.uid(), m.id, 'Studio night', 'published', now() + interval '2 hours', now() + interval '5 hours', 'Europe/Amsterdam', 3, 'De Studio', 'Amsterdam', 'NL'
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event' returning id)
insert into ci_ids select 'tonight', id from x;
with x as (insert into public.events(profile_id, mode_id, title, status, starts_at, ends_at, timezone)
  select auth.uid(), m.id, 'Later on', 'published', now() + interval '3 days', now() + interval '3 days 2 hours', 'UTC'
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event' returning id)
insert into ci_ids select 'later', id from x;
reset role;

set local role service_role;
select pg_temp.reg('tonight', 'Member', 'member@example.test', 'key-member', pg_temp.uid('member'));
select pg_temp.reg('tonight', 'Quiet', 'quiet@example.test', 'key-quiet', pg_temp.uid('quiet'));
select pg_temp.reg('tonight', 'Walk-in', 'walkin@example.test', 'key-walkin');
select pg_temp.reg('tonight', 'Late', 'late@example.test', 'key-late');
select pg_temp.reg('later', 'Member', 'member@example.test', 'key-member-later', pg_temp.uid('member'));

-- Connecting is the guest's choice, made from their signed link.
select is((select connect_on_check_in from public.event_registrations where id=pg_temp.guest('walkin@example.test')), false, 'connecting is off unless the guest asks');
select is(public.set_event_connect_preference(pg_temp.guest('member@example.test'), 1::smallint, true), '{"connect": true, "connected": false}'::jsonb, 'a member guest can ask to connect at check-in');
select throws_ok($$select public.set_event_connect_preference(pg_temp.guest('member@example.test'), 2::smallint, true)$$, 'P0002', 'registration_not_found', 'an old link cannot change the choice');
select throws_ok($$select public.set_event_connect_preference(pg_temp.guest('walkin@example.test'), 1::smallint, true)$$, '22023', 'not_a_member', 'a guest without an account has nothing to connect');
select is(public.get_event_registration(pg_temp.guest('member@example.test'), 1::smallint)->>'check_in', 'open', 'the guest''s page knows check-in is open');
reset role;

set local role authenticated;
select pg_temp.as_user('member');
select throws_ok($$select public.set_event_connect_preference(pg_temp.guest('member@example.test'), 1::smallint, false)$$, '42501', null, 'members cannot call the preference function directly');
reset role;
set local role anon;
select throws_ok($$select public.owner_check_in_event_registration(pg_temp.guest('member@example.test'), true)$$, '42501', null, 'visitors cannot check anyone in');
reset role;

-- The organizer checks guests in.
set local role authenticated;
select pg_temp.as_user('owner');
select is((public.owner_check_in_event_registration(pg_temp.guest('member@example.test'), true)->>'connected')::boolean, true, 'checking in a member who asked connects them');
select isnt((select checked_in_at from public.event_registrations where id=pg_temp.guest('member@example.test')), null, 'the check-in time is kept');
select is((select count(*) from public.connections where user_id=pg_temp.uid('owner') and connected_user_id=pg_temp.uid('member'))::integer, 1, 'the organizer and the guest are connected');
select is((public.owner_check_in_event_registration(pg_temp.guest('member@example.test'), true)->>'connected')::boolean, true, 'checking in twice is the same check-in');
reset role;
select is((select count(*) from public.connection_encounters where event_id=(select id from ci_ids where name='tonight'))::integer, 1, 'and writes one encounter');
select is((select source||':'||authorization_method from public.connection_encounters where event_id=(select id from ci_ids where name='tonight')), 'event_check_in:event_registration', 'the encounter records where it came from');
select is((select live_context_type_snapshot||':'||live_context_label_snapshot||':'||live_context_venue_snapshot||':'||live_context_city_snapshot||':'||live_context_country_code_snapshot
  from public.connection_encounters where event_id=(select id from ci_ids where name='tonight')), 'event:Studio night:De Studio:Amsterdam:NL', 'the event is where they met');
select is((select created_by_user_id||':'||shared_by_user_id from public.connection_encounters where event_id=(select id from ci_ids where name='tonight')), pg_temp.uid('member')||':'||pg_temp.uid('owner'), 'the guest connected with the organizer''s event');
select is((select count(*) from public.passport_stamps where user_id=pg_temp.uid('member') and stamp_type='event' and title='Studio night')::integer, 1, 'the guest earns the event stamp');

set local role authenticated;
select pg_temp.as_user('member');
select is((select count(*) from public.connection_encounters where source='event_check_in')::integer, 1, 'the guest sees the encounter as a participant');
select pg_temp.as_user('owner');
select is((public.owner_check_in_event_registration(pg_temp.guest('quiet@example.test'), true)->>'connected')::boolean, false, 'a member who did not ask is checked in, not connected');
select is((public.owner_check_in_event_registration(pg_temp.guest('walkin@example.test'), true)->>'connected')::boolean, false, 'a guest without an account is checked in only');
select throws_ok($$select public.owner_check_in_event_registration(pg_temp.guest('late@example.test'), true)$$, 'P0001', 'guest_not_going', 'the waitlist is not checked in');
select throws_ok($$select public.owner_check_in_event_registration((select id from public.event_registrations where event_id=(select id from ci_ids where name='later')), true)$$,
  'P0001', 'check_in_not_open', 'check-in opens twelve hours before the start');
select is(public.owner_check_in_event_registration(pg_temp.guest('member@example.test'), false)->>'checked_in_at', null, 'a check-in can be taken back');
select is((select count(*) from public.connections where user_id=pg_temp.uid('owner') and connected_user_id=pg_temp.uid('member'))::integer, 1, 'the Connection stays: it belongs to both people');
select throws_ok($$update public.event_registrations set checked_in_at=now() where id=pg_temp.guest('walkin@example.test')$$, '42501', null, 'owners only check in through the function');
select is((select count(*) from public.event_registrations where checked_in_at is not null and connect_on_check_in = false)::integer, 2, 'owners read check-in state on their own guests');
select pg_temp.as_user('stranger');
select throws_ok($$select public.owner_check_in_event_registration(pg_temp.guest('quiet@example.test'), true)$$, 'P0002', 'registration_not_found', 'another member cannot check guests in');
reset role;

-- Saying yes after being checked in connects straight away.
set local role service_role;
select is(public.set_event_connect_preference(pg_temp.guest('quiet@example.test'), 1::smallint, true)->>'connected', 'true', 'a checked-in member who now asks is connected');
reset role;
select is((select count(*) from public.connections where user_id=pg_temp.uid('owner') and connected_user_id=pg_temp.uid('quiet'))::integer, 1, 'with one Connection');

-- A cancelled event takes no check-ins.
set local role authenticated;
select pg_temp.as_user('owner');
update public.events set status='cancelled' where id=(select id from ci_ids where name='tonight');
select throws_ok($$select public.owner_check_in_event_registration(pg_temp.guest('walkin@example.test'), true)$$, 'P0002', 'event_cancelled', 'a cancelled event takes no check-ins');
reset role;

select * from finish();
rollback;
