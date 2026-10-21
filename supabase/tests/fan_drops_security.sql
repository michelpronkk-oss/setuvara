begin;

select plan(20);

-- A creator, a follower, a connection, a newsletter subscriber, and a stranger.
create temporary table fd_accounts(kind text primary key, user_id uuid not null unique, username text not null unique, email text not null);
insert into fd_accounts select kind, id, 'fd_'||substr(replace(id::text,'-',''),1,12), email
from (select kind, gen_random_uuid() id, email from (values
  ('creator','creator@fd.test'),('follower','follower@fd.test'),('friend','friend@fd.test'),
  ('fan','Fan.Person+setuvara@gmail.com'),('stranger','stranger@fd.test')) v(kind, email)) s;
grant select on fd_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',email,jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from fd_accounts;
update public.profiles set is_published=true where id in (select user_id from fd_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from fd_accounts);
create temporary table fd_blocks(name text primary key, id uuid);
grant select, insert on fd_blocks to anon, authenticated, service_role;

create function pg_temp.as_user(p_kind text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from fd_accounts where kind=p_kind),'role','authenticated')::text, true);
$$;
create function pg_temp.uid(p_kind text) returns uuid language sql as $$ select user_id from fd_accounts where kind=p_kind $$;
create function pg_temp.blk(p_name text) returns uuid language sql as $$ select id from fd_blocks where name=p_name $$;
create function pg_temp.sees(p_name text) returns boolean language sql as $$ select exists(select 1 from public.profile_blocks where id=pg_temp.blk(p_name)) $$;
grant execute on function pg_temp.as_user(text), pg_temp.uid(text), pg_temp.blk(text), pg_temp.sees(text) to anon, authenticated, service_role;

-- Five Work pieces, one per audience, plus an early-access drop.
do $blocks$
declare name text; v_id uuid;
begin
  foreach name in array array['followers','connections','subscribers','members','early'] loop
    insert into public.profile_blocks(profile_id,mode_id,kind,data,is_visible)
      select m.profile_id, m.id, 'feature', jsonb_build_object('title', name), true from public.profile_modes m
      where m.profile_id=pg_temp.uid('creator') and m.slug='creator' returning id into v_id;
    insert into fd_blocks values (name, v_id);
  end loop;
end
$blocks$;
insert into public.creator_content_rules(profile_block_id, creator_user_id, access_level, teaser_title)
select pg_temp.blk(name), pg_temp.uid('creator'), name, 'For '||name from unnest(array['followers','connections','subscribers','members']) name;
insert into public.creator_drops(creator_user_id, profile_block_id, title, status, starts_at, early_access_level, early_access_starts_at)
values (pg_temp.uid('creator'), pg_temp.blk('early'), 'New print', 'scheduled', now() + interval '2 days', 'followers', now() - interval '1 hour');

-- The audiences: a follow, a connection, a confirmed subscriber (signed up with another spelling).
insert into public.creator_follows(creator_user_id, follower_user_id) values (pg_temp.uid('creator'), pg_temp.uid('follower'));
insert into public.connections(user_id, connected_user_id, user_display_name_snapshot, connected_display_name_snapshot) values (pg_temp.uid('friend'), pg_temp.uid('creator'), 'Friend', 'Creator');
insert into public.profile_actions(profile_id, mode_id, kind, title, status)
select m.profile_id, m.id, 'newsletter', 'Studio notes', 'published' from public.profile_modes m where m.profile_id=pg_temp.uid('creator') and m.slug='creator';
set local role service_role;
select public.confirm_action_entry(public.submit_profile_action((select id from public.profile_actions where profile_id=pg_temp.uid('creator') and kind='newsletter'),
  null, '', 'fanperson@gmail.com', '{}', false, 'fd-fan-key-000000001', null)->>'verify_token');
reset role;

select throws_ok($$insert into public.creator_content_rules(profile_block_id, creator_user_id, access_level) values (pg_temp.blk('early'), pg_temp.uid('creator'), 'everyone')$$,
  '23514', null, 'only the known audiences are accepted');
select is(private.normalize_signup_email('Fan.Person+setuvara@gmail.com'), 'fanperson@gmail.com', 'account emails normalize like signups');

set local role anon;
select ok(not pg_temp.sees('followers') and not pg_temp.sees('connections') and not pg_temp.sees('subscribers'), 'visitors see no exclusive piece');
reset role;

set local role authenticated;
select pg_temp.as_user('follower');
select ok(pg_temp.sees('followers'), 'a follower sees the followers piece');
select ok(not pg_temp.sees('connections') and not pg_temp.sees('subscribers') and not pg_temp.sees('members'), 'and nothing meant for other audiences');
select pg_temp.as_user('friend');
select ok(pg_temp.sees('connections'), 'a connection sees the connections piece');
select ok(not pg_temp.sees('followers'), 'a connection is not a follower');
select pg_temp.as_user('fan');
select ok(pg_temp.sees('subscribers'), 'a confirmed subscriber with a matching verified email sees the subscribers piece');
select pg_temp.as_user('stranger');
select ok(not pg_temp.sees('followers') and not pg_temp.sees('connections') and not pg_temp.sees('subscribers') and not pg_temp.sees('members'), 'a stranger sees no exclusive piece');
select is((select count(*) from public.creator_content_rules where creator_user_id=pg_temp.uid('creator'))::integer, 4, 'but sees every teaser');
reset role;

-- An unverified account email never counts as a subscriber.
update auth.users set email_confirmed_at = null where id = pg_temp.uid('fan');
set local role authenticated;
select pg_temp.as_user('fan');
select ok(not pg_temp.sees('subscribers'), 'an unverified email is not a subscriber');
reset role;
update auth.users set email_confirmed_at = now() where id = pg_temp.uid('fan');

-- Early access: followers now, everyone in two days.
set local role authenticated;
select pg_temp.as_user('follower');
select ok(pg_temp.sees('early'), 'followers open the drop during early access');
select pg_temp.as_user('stranger');
select ok(not pg_temp.sees('early'), 'others wait for the public start');
select is((public.get_creator_public_summary((select username from fd_accounts where kind='creator'))->'drops'->0->>'status'), 'early', 'the drop is listed as early access');
select is((public.get_creator_public_summary((select username from fd_accounts where kind='creator'))->'drops'->0->>'is_accessible'), 'false', 'and locked for this viewer');
reset role;
update public.creator_drops set early_access_starts_at = now() + interval '1 day' where profile_block_id = pg_temp.blk('early');
set local role authenticated;
select pg_temp.as_user('follower');
select ok(not pg_temp.sees('early'), 'before the early window, even followers wait');
reset role;
update public.creator_drops set early_access_level = null, early_access_starts_at = null, starts_at = now() - interval '1 minute', status = 'live' where profile_block_id = pg_temp.blk('early');
set local role authenticated;
select pg_temp.as_user('stranger');
select ok(pg_temp.sees('early'), 'after the public start, everyone sees it');
reset role;

select throws_ok($$insert into public.creator_drops(creator_user_id, profile_block_id, title, status, starts_at, early_access_level, early_access_starts_at)
  values (pg_temp.uid('creator'), pg_temp.blk('members'), 'Bad', 'scheduled', now() + interval '1 day', 'followers', now() + interval '2 days')$$,
  '23514', null, 'early access starts before the public start');
select throws_ok($$insert into public.creator_drops(creator_user_id, profile_block_id, title, status, starts_at, early_access_level, early_access_starts_at)
  values (pg_temp.uid('creator'), pg_temp.blk('members'), 'Bad', 'scheduled', now() + interval '1 day', 'everyone', now())$$,
  '23514', null, 'early access is for one fan audience');

set local role authenticated;
select pg_temp.as_user('creator');
select ok(pg_temp.sees('followers') and pg_temp.sees('subscribers') and pg_temp.sees('members'), 'the creator sees everything of their own');
reset role;

select * from finish();
rollback;
