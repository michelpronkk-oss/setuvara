begin;

select plan(27);

-- An organizer, a member guest, and a stranger who also hosts.
create temporary table sc_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into sc_accounts select kind, id, 'sc_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('owner'),('member'),('stranger')) v(kind)) s;
grant select on sc_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from sc_accounts;
update public.profiles set is_published=true where id in (select user_id from sc_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from sc_accounts);
create temporary table sc_ids(name text primary key, id uuid);
grant select, insert, update on sc_ids to anon, authenticated, service_role;

create function pg_temp.as_user(p_kind text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from sc_accounts where kind=p_kind),'role','authenticated')::text, true);
$$;
create function pg_temp.uid(p_kind text) returns uuid language sql as $$ select user_id from sc_accounts where kind=p_kind $$;
create function pg_temp.ev(p_name text) returns uuid language sql as $$ select id from sc_ids where name=p_name $$;
create function pg_temp.reg(p_event text, p_name text, p_email text, p_user uuid default null) returns uuid language sql as $$
  select (public.register_for_event(pg_temp.ev(p_event), p_user, p_name, p_email, md5(p_event||p_email), null)->>'id')::uuid;
$$;
create function pg_temp.g(p_event text, p_email text) returns uuid language sql as $$
  select id from public.event_registrations where email=p_email and event_id=pg_temp.ev(p_event)
$$;
create function pg_temp.scan(p_event text, p_reg uuid, p_version int default 1) returns jsonb language sql as $$
  select public.owner_scan_event_pass(pg_temp.ev(p_event), p_reg, p_version::smallint)
$$;
grant execute on function pg_temp.as_user(text), pg_temp.uid(text), pg_temp.ev(text), pg_temp.reg(text,text,text,uuid), pg_temp.g(text,text), pg_temp.scan(text,uuid,int)
  to authenticated, service_role, anon;

-- Tonight (door open, two seats), next week (door not open), an empty one, and the stranger's own.
set local role authenticated;
select pg_temp.as_user('owner');
with x as (insert into public.events(profile_id, mode_id, title, status, starts_at, ends_at, timezone, capacity)
  select auth.uid(), m.id, 'Door night', 'published', now() + interval '1 hour', now() + interval '4 hours', 'UTC', 2
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event' returning id)
insert into sc_ids select 'tonight', id from x;
with x as (insert into public.events(profile_id, mode_id, title, status, starts_at, ends_at, timezone)
  select auth.uid(), m.id, 'Next week', 'published', now() + interval '7 days', now() + interval '7 days 2 hours', 'UTC'
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event' returning id)
insert into sc_ids select 'later', id from x;
with x as (insert into public.events(profile_id, mode_id, title, status, starts_at, ends_at, timezone)
  select auth.uid(), m.id, 'Nobody yet', 'published', now() + interval '2 days', now() + interval '2 days 2 hours', 'UTC'
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event' returning id)
insert into sc_ids select 'empty', id from x;
select pg_temp.as_user('stranger');
with x as (insert into public.events(profile_id, mode_id, title, status, starts_at, ends_at, timezone)
  select auth.uid(), m.id, 'Other door', 'published', now() + interval '1 hour', now() + interval '3 hours', 'UTC'
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event' returning id)
insert into sc_ids select 'theirs', id from x;
reset role;

set local role service_role;
select pg_temp.reg('tonight', 'Ada', 'ada@example.test');
select pg_temp.reg('tonight', 'Member', 'member@example.test', pg_temp.uid('member'));
select pg_temp.reg('tonight', 'Wait', 'wait@example.test');
select pg_temp.reg('later', 'Ada', 'ada@example.test');
select pg_temp.reg('theirs', 'Theirs', 'theirs@example.test');
select public.set_event_connect_preference(pg_temp.g('tonight', 'member@example.test'), 1::smallint, true);
reset role;

-- 1. The door. One scan lets a guest in; the next scan of the same pass says it was used.
set local role authenticated;
select pg_temp.as_user('owner');
select is(pg_temp.scan('tonight', pg_temp.g('tonight', 'ada@example.test'))->>'result', 'checked_in', 'a valid pass checks the guest in');
select is(pg_temp.scan('tonight', pg_temp.g('tonight', 'ada@example.test'))->>'result', 'already_checked_in', 'the same pass again is already used');
select ok((pg_temp.scan('tonight', pg_temp.g('tonight', 'ada@example.test'))->'guest'->>'checked_in_at') is not null, 'an already-used pass shows when it was used');
select is(pg_temp.scan('tonight', pg_temp.g('tonight', 'member@example.test'))->'guest'->>'connected', 'true', 'a member who asked is connected at the door');
select is((pg_temp.scan('tonight', pg_temp.g('tonight', 'member@example.test'))->>'checked_in')::int, 2, 'the scan reports how many are in');
select is(pg_temp.scan('tonight', pg_temp.g('tonight', 'wait@example.test'))->>'result', 'not_going', 'a waitlisted guest is not let in');
select is(pg_temp.scan('tonight', pg_temp.g('tonight', 'wait@example.test'), 2)->>'result', 'invalid', 'a pass with an old version is invalid');
select is(pg_temp.scan('tonight', gen_random_uuid())->>'result', 'invalid', 'a made-up pass is invalid');
select is(pg_temp.scan('tonight', pg_temp.g('later', 'ada@example.test'))->>'other_event', 'Next week', 'a pass for another of your events names that event');
select is(pg_temp.scan('tonight', pg_temp.g('later', 'ada@example.test'))->'guest', 'null'::jsonb, '...and does not check anyone in or show them');
select is((select checked_in_at from public.event_registrations where id=pg_temp.g('later', 'ada@example.test')), null, 'the other event''s guest stays out');
select is(pg_temp.scan('later', pg_temp.g('later', 'ada@example.test'))->>'result', 'not_open', 'the door is not open days before');
select is(pg_temp.scan('tonight', pg_temp.g('theirs', 'theirs@example.test'))->'guest', 'null'::jsonb, 'someone else''s guest is invalid, with nothing about them');
select is(pg_temp.scan('tonight', pg_temp.g('theirs', 'theirs@example.test'))->>'result', 'invalid', '...reported as invalid');

-- 2. Only the organizer scans at their door.
select pg_temp.as_user('stranger');
select throws_ok($$select pg_temp.scan('tonight', pg_temp.g('tonight', 'wait@example.test'))$$, 'P0002', 'event_not_found', 'another member cannot scan at your door');
select is((select count(*)::int from public.event_scans), 0, 'another member reads none of your scans');
select throws_ok($$insert into public.event_scans(event_id, profile_id, result) values (pg_temp.ev('theirs'), auth.uid(), 'checked_in')$$, '42501', null, 'nobody writes scans directly');
select pg_temp.as_user('owner');
select is((select count(*)::int from public.event_scans where event_id=pg_temp.ev('tonight')), 12, 'every scan at the door is recorded for the organizer');
reset role;
set local role anon;
select throws_ok($$select pg_temp.scan('tonight', gen_random_uuid())$$, '42501', null, 'visitors cannot scan');
reset role;

-- A flood of scans is slowed down.
insert into public.event_scans(event_id, profile_id, result) select pg_temp.ev('tonight'), pg_temp.uid('owner'), 'invalid' from generate_series(1, 120);
set local role authenticated;
select pg_temp.as_user('owner');
select throws_ok($$select pg_temp.scan('tonight', gen_random_uuid())$$, 'P0001', 'rate_limited', 'more than 120 scans a minute is refused');

-- 3. Deleting: a coming event with guests stays until it is cancelled or over; then it goes, guests
-- and scans with it, and the Connection made at the door stays.
delete from public.events where id=pg_temp.ev('later');
select is((select count(*)::int from public.events where id=pg_temp.ev('later')), 1, 'a coming event with guests cannot be deleted');
delete from public.events where id=pg_temp.ev('empty');
select is((select count(*)::int from public.events where id=pg_temp.ev('empty')), 0, 'a coming event nobody joined can be deleted');
update public.events set status='cancelled' where id=pg_temp.ev('later');
select pg_temp.as_user('stranger');
delete from public.events where id=pg_temp.ev('later');
select pg_temp.as_user('owner');
select is((select count(*)::int from public.events where id=pg_temp.ev('later')), 1, 'nobody else can delete your cancelled event');
delete from public.events where id=pg_temp.ev('later');
select is((select count(*)::int from public.events where id=pg_temp.ev('later')), 0, 'a cancelled event can be deleted');
reset role;
-- Tonight is over (moved back in time as the database owner).
alter table public.events disable trigger events_validate;
update public.events set starts_at = now() - interval '2 days', ends_at = now() - interval '2 days' + interval '3 hours' where id=pg_temp.ev('tonight');
alter table public.events enable trigger events_validate;
set local role authenticated;
select pg_temp.as_user('owner');
delete from public.events where id=pg_temp.ev('tonight');
reset role;
select is((select count(*)::int from public.events where id=pg_temp.ev('tonight')), 0, 'an event that is over can be deleted, guests and all');
select is((select count(*)::int from public.event_registrations where event_id in (pg_temp.ev('tonight'), pg_temp.ev('later'))), 0, 'its guest list goes with it');
select is((select count(*)::int from public.connections where user_id=pg_temp.uid('owner') and connected_user_id=pg_temp.uid('member')), 1, 'a Connection made at the door stays');

select * from finish();
rollback;
