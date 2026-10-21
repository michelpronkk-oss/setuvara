begin;

select plan(51);

-- An organizer, a member who registers as themselves, and a stranger.
create temporary table ev_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into ev_accounts select kind, id, 'ev_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('owner'),('member'),('stranger')) v(kind)) s;
grant select on ev_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from ev_accounts;
update public.profiles set is_published=true where id in (select user_id from ev_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from ev_accounts);
create temporary table ev_ids(name text primary key, id uuid);
grant select, insert, update on ev_ids to anon, authenticated, service_role;

create function pg_temp.as_user(p_kind text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from ev_accounts where kind=p_kind),'role','authenticated')::text, true);
$$;
create function pg_temp.reg(p_event text, p_name text, p_email text, p_key text, p_ip text default null, p_user uuid default null) returns jsonb language sql as $$
  select public.register_for_event((select id from ev_ids where name=p_event), p_user, p_name, p_email, rpad(p_key, 16, '0'), case when p_ip is not null then encode(extensions.digest(p_ip,'sha256'),'hex') end);
$$;
grant execute on function pg_temp.as_user(text), pg_temp.reg(text,text,text,text,text,uuid) to authenticated, service_role, anon;

-- The organizer creates events in their Event Mode.
set local role authenticated;
select pg_temp.as_user('owner');
with x as (insert into public.events(profile_id, mode_id, title, slug, status, starts_at, ends_at, timezone, capacity)
  select auth.uid(), m.id, 'Founders dinner', 'founders-dinner', 'published', now() + interval '7 days', now() + interval '7 days 3 hours', 'Europe/Amsterdam', 2
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event' returning id)
insert into ev_ids select 'dinner', id from x;
select ok((select short_id ~ '^[0-9A-Za-z]{8}$' from public.events where id=(select id from ev_ids where name='dinner')), 'every event gets an 8-character short id');
with x as (insert into public.events(profile_id, mode_id, title, status, starts_at, ends_at, timezone, capacity, waitlist_enabled)
  select auth.uid(), m.id, 'Rooftop', 'published', now() + interval '2 days', now() + interval '2 days 2 hours', 'America/New_York', 1, false
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event' returning id)
insert into ev_ids select 'rooftop', id from x;
with x as (insert into public.events(profile_id, mode_id, title, status, starts_at, ends_at, timezone)
  select auth.uid(), m.id, 'Draft night', 'draft', now() + interval '3 days', now() + interval '3 days 2 hours', 'UTC'
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event' returning id)
insert into ev_ids select 'draft', id from x;
with x as (insert into public.events(profile_id, mode_id, title, status, starts_at, ends_at, timezone, registration_closes_at)
  select auth.uid(), m.id, 'Closed early', 'published', now() + interval '3 days', now() + interval '3 days 2 hours', 'UTC', now() - interval '1 minute'
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event' returning id)
insert into ev_ids select 'closed', id from x;
with x as (insert into public.events(profile_id, mode_id, title, status, starts_at, ends_at, timezone, registration_opens_at)
  select auth.uid(), m.id, 'Opens later', 'published', now() + interval '9 days', now() + interval '9 days 2 hours', 'UTC', now() + interval '1 day'
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event' returning id)
insert into ev_ids select 'later', id from x;

select throws_ok($$insert into public.events(profile_id, mode_id, title, starts_at, ends_at, timezone)
  select auth.uid(), m.id, 'x', now() + interval '1 day', now() + interval '1 day 1 hour', 'UTC' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='personal'$$,
  '23514', 'event_mode_mismatch', 'events live in Event Mode only');
select throws_ok($$insert into public.events(profile_id, mode_id, title, starts_at, ends_at, timezone)
  select auth.uid(), m.id, 'x', now() + interval '1 day', now() + interval '1 day 1 hour', 'Mars/Olympus' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event'$$,
  '23514', 'event_timezone_invalid', 'an unknown time zone is refused');
select throws_ok($$insert into public.events(profile_id, mode_id, title, starts_at, ends_at, timezone)
  select auth.uid(), m.id, 'x', now() + interval '1 day', now() - interval '1 day', 'UTC' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event'$$,
  '23514', null, 'an event ends after it starts');
select throws_ok($$insert into public.events(profile_id, mode_id, title, status, starts_at, ends_at, timezone)
  select auth.uid(), m.id, 'x', 'published', now() - interval '2 days', now() - interval '1 day', 'UTC' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event'$$,
  '23514', 'event_already_ended', 'a past event cannot be published');
select throws_ok($$insert into public.events(profile_id, mode_id, title, starts_at, ends_at, timezone, confirmed_count)
  select auth.uid(), m.id, 'x', now() + interval '1 day', now() + interval '1 day 1 hour', 'UTC', 5 from public.profile_modes m where m.profile_id=auth.uid() and m.slug='event'$$,
  '42501', null, 'owners cannot write the guest counters');
select throws_ok($$update public.events set confirmed_count=0 where id=(select id from ev_ids where name='dinner')$$,
  '42501', null, 'owners cannot change the guest counters');
select throws_ok($$select pg_temp.reg('dinner','Me','me@example.test','owner-key')$$,
  '42501', null, 'members cannot call the registration function directly');
select throws_ok($$select public.take_event_notices((select id from ev_ids where name='dinner'))$$,
  '42501', null, 'members cannot take guest notices');

-- Strangers see nothing and change nothing.
select pg_temp.as_user('stranger');
select is((select count(*) from public.events where profile_id=(select user_id from ev_accounts where kind='owner'))::integer, 0, 'another member cannot read the events');
update public.events set title='Hijacked' where id=(select id from ev_ids where name='dinner');
select throws_ok($$insert into public.events(profile_id, mode_id, title, starts_at, ends_at, timezone)
  select (select user_id from ev_accounts where kind='owner'), m.id, 'x', now() + interval '1 day', now() + interval '1 day 1 hour', 'UTC'
  from public.profile_modes m where m.profile_id=(select user_id from ev_accounts where kind='owner') and m.slug='event'$$,
  '42501', null, 'nobody creates an event on another member''s Mode');
reset role;
select is((select title from public.events where id=(select id from ev_ids where name='dinner')), 'Founders dinner', 'another member cannot edit the event');

set local role anon;
select throws_ok($$select count(*) from public.events$$, '42501', null, 'visitors cannot read the events table');
select throws_ok($$select public.get_public_event('AAAAAAAA')$$, '42501', null, 'visitors cannot call the event lookup directly');
reset role;

-- Registration: capacity 2, then the waitlist, oldest first.
set local role service_role;
select is(pg_temp.reg('dinner','Alice','alice@example.test','key-a','aa')->>'status', 'confirmed', 'first guest gets a seat');
select is(pg_temp.reg('dinner','Bob','b.o.b@gmail.com','key-b','bb')->>'status', 'confirmed', 'second guest gets the last seat');
select is(pg_temp.reg('dinner','Carol','carol@example.test','key-c','cc')->>'status', 'waitlisted', 'a full event puts the next guest on the waitlist');
select is(pg_temp.reg('dinner','Dave','dave@example.test','key-d','dd')->>'status', 'waitlisted', 'and the one after');
select is((select confirmed_count||'/'||waitlist_count from public.events where id=(select id from ev_ids where name='dinner')), '2/2', 'the counters match the guests');
select is((pg_temp.reg('dinner','Bob again','bob+party@googlemail.com','key-b2','b2')->>'duplicate')::boolean, true, 'the same Gmail address, written differently, is one guest');
select is((pg_temp.reg('dinner','Alice','alice@example.test','key-a','aa')->>'id')::uuid, (select id from public.event_registrations where email='alice@example.test'), 'a retried request returns the first answer');
select is((select count(*) from public.event_registrations where event_id=(select id from ev_ids where name='dinner'))::integer, 4, 'duplicates and retries never add a row');
select is(pg_temp.reg('dinner','Mallory','alice@example.test','key-m','mm')->>'shown_status', 'waitlisted', 'a duplicate hears what a new guest would hear, not who is going');
select is(pg_temp.reg('rooftop','Erin','erin@example.test','key-e','ee')->>'status', 'confirmed', 'a one-seat event takes one guest');
select throws_ok($$select pg_temp.reg('rooftop','Frank','frank@example.test','key-f','ff')$$, 'P0001', 'event_full', 'without a waitlist a full event refuses');
select throws_ok($$select pg_temp.reg('draft','G','g@example.test','key-g')$$, 'P0002', 'event_unavailable', 'a draft takes no guests');
select throws_ok($$select pg_temp.reg('closed','G','g@example.test','key-g')$$, 'P0002', 'registration_closed', 'registration closes on time by itself');
select throws_ok($$select pg_temp.reg('later','G','g@example.test','key-g')$$, 'P0002', 'registration_not_open', 'registration opens on time by itself');
select throws_ok($$select pg_temp.reg('dinner','Owner','owner@example.test','key-o',null,(select user_id from ev_accounts where kind='owner'))$$, '22023', 'own_event', 'organizers do not register for their own event');
select throws_ok($$select pg_temp.reg('dinner','','x@example.test','key-x')$$, '22023', 'name_required', 'a guest gives a name');
select throws_ok($$select pg_temp.reg('dinner','X','not-an-email','key-x')$$, '22023', 'invalid_email', 'a guest gives a real email');
select throws_ok($$select pg_temp.reg('dinner','R'||g,'r'||g||'@example.test','rate-key-'||g,'flood') from generate_series(1,7) g$$, '54000', 'rate_limited', 'one address cannot flood an event');

-- Cancelling frees the seat and promotes the waitlist in the same step.
select throws_ok($$select public.cancel_event_registration((select id from public.event_registrations where email='alice@example.test'), 2::smallint)$$,
  'P0002', 'registration_not_found', 'a link with an old version cannot cancel');
select is((public.cancel_event_registration((select id from public.event_registrations where email='alice@example.test'), 1::smallint)->>'promoted')::integer, 1, 'a guest cancelling promotes one person');
select is((select status||':'||coalesce(pending_notice,'') from public.event_registrations where email='carol@example.test'), 'confirmed:promoted', 'the oldest waitlisted guest gets the seat and an email is owed');
select is((select count(*) from public.take_event_notices((select id from ev_ids where name='dinner')))::integer, 1, 'the owed email is handed out');
select is((select count(*) from public.take_event_notices((select id from ev_ids where name='dinner')))::integer, 0, 'and only once');
select is((public.cancel_event_registration((select id from public.event_registrations where email='alice@example.test'), 1::smallint)->>'already')::boolean, true, 'cancelling twice changes nothing');
reset role;

-- The organizer: more seats promote, guests are read without the IP hash, the record is kept.
set local role authenticated;
select pg_temp.as_user('owner');
update public.events set capacity=3 where id=(select id from ev_ids where name='dinner');
select is((select status from public.event_registrations where email='dave@example.test'), 'confirmed', 'raising capacity promotes the waitlist straight away');
select is((select confirmed_count||'/'||waitlist_count from public.events where id=(select id from ev_ids where name='dinner')), '3/0', 'the counters follow');
select throws_ok($$select ip_hash from public.event_registrations$$, '42501', null, 'owners never read guests'' IP hashes');
select throws_ok($$update public.events set status='draft' where id=(select id from ev_ids where name='dinner')$$, '23514', 'event_has_guests', 'an event with guests cannot go back to draft');
delete from public.events where id=(select id from ev_ids where name='dinner');
select is((select count(*) from public.events where id=(select id from ev_ids where name='dinner'))::integer, 1, 'an event with guests is not deleted');
select is((public.owner_cancel_event_registration((select id from public.event_registrations where email='dave@example.test'))->>'status'), 'cancelled', 'the organizer can cancel a guest');
select pg_temp.as_user('stranger');
select throws_ok($$select public.owner_cancel_event_registration((select id from ev_ids where name='dinner'))$$, 'P0002', 'registration_not_found', 'another member cannot cancel guests');
select is((select count(*) from public.event_registrations)::integer, 0, 'another member reads no guests');
select pg_temp.as_user('owner');
update public.events set status='cancelled' where id=(select id from ev_ids where name='rooftop');
select throws_ok($$update public.events set status='published' where id=(select id from ev_ids where name='rooftop')$$, '23514', 'event_cancelled', 'a cancelled event stays cancelled');
reset role;

set local role service_role;
select throws_ok($$select pg_temp.reg('rooftop','G','g@example.test','key-g')$$, 'P0002', 'event_cancelled', 'a cancelled event takes no guests');
select is((select public.get_public_event(short_id)->>'registration' from public.events where id=(select id from ev_ids where name='dinner')), 'open', 'the public lookup reports the registration window');
select is((select public.get_public_event(short_id) from public.events where id=(select id from ev_ids where name='draft')), null, 'a draft has no public page');
reset role;
update public.profile_modes set is_enabled=false where profile_id=(select user_id from ev_accounts where kind='owner') and slug='event';
set local role service_role;
select is((select public.get_public_event(short_id) from public.events where id=(select id from ev_ids where name='dinner')), null, 'turning Event Mode off takes its events offline');
reset role;

select * from finish();
rollback;
