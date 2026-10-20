begin;

select plan(44);

-- Three members: A and B published, C unpublished.
create temporary table mh(kind text primary key, user_id uuid not null, username text not null);
insert into mh select kind, gen_random_uuid(), 'mh_'||kind||'_'||substr(md5(random()::text),1,8) from (values('a'),('b'),('c')) v(kind);
grant select on mh to anon, authenticated;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name','MH '||kind),now(),now(),now() from mh;
update public.profiles set is_published = true where id in (select user_id from mh where kind in ('a','b'));
update public.profile_modes set is_enabled = true where profile_id in (select user_id from mh) and slug in ('business','creator');

create temporary table mh_names(kind text primary key, name text);
insert into mh_names values
  ('biz', 'mhbiz_'||substr(md5(random()::text),1,8)),
  ('biz2', 'mhbiz2_'||substr(md5(random()::text),1,8)),
  ('cre', 'mhcre_'||substr(md5(random()::text),1,8)),
  ('gone', 'mhgone_'||substr(md5(random()::text),1,8));
grant select on mh_names to anon, authenticated;

create function pg_temp.as_member(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',(select user_id from mh where kind=k),'role','authenticated')::text, true);
$$;

-- Privileges: the table is written only through the RPCs, server-only resolvers stay server-only.
select ok(not has_table_privilege('anon','public.mode_handles','select'), 'visitors cannot read Mode handles');
select ok(not has_table_privilege('authenticated','public.mode_handles','insert'), 'members cannot insert Mode handles directly');
select ok(not has_table_privilege('authenticated','public.mode_handles','update'), 'members cannot update Mode handles directly');
select ok(not has_function_privilege('anon','public.resolve_mode_handle(text)','execute'), 'browsers cannot resolve a handle to a username');
select ok(not has_function_privilege('authenticated','public.resolve_mode_handle(text)','execute'), 'members cannot either');
select ok(not has_function_privilege('anon','public.live_mode_handle(uuid,text)','execute'), 'a profile cannot be mapped to its Mode handles by visitors');
select ok(not has_function_privilege('authenticated','public.live_mode_handle(uuid,text)','execute'), 'or by members');
select ok(not has_function_privilege('anon','public.claim_mode_handle(text,text)','execute'), 'visitors cannot claim');
select ok(not has_function_privilege('anon','public.check_handle(text)','execute'), 'visitors cannot probe handles');

-- A claims a Business handle: claimed, not live, not indexed.
set local role authenticated;
select pg_temp.as_member('a');
select is(public.check_handle((select name from mh_names where kind='biz')), 'free', 'a fresh name is free');
select is(public.check_handle('pricing'), 'reserved', 'a route is reserved');
select is(public.check_handle('ab'), 'invalid', 'too short is invalid');
select is(public.check_handle((select username from mh where kind='b')), 'taken', 'someone''s username is taken');
select is(public.claim_mode_handle('business', (select name from mh_names where kind='biz'))->>'is_live', 'false', 'claiming does not make the Mode public');
select is(public.check_handle((select name from mh_names where kind='biz')), 'yours', 'the claimed name reads as yours');
select is((select count(*)::int from public.mode_handles), 1, 'owners see their own handle row');
select throws_ok($$select public.claim_mode_handle('event', 'mh_event_x')$$, '22023', 'mode_not_supported', 'Event Modes cannot claim a handle');
select throws_ok($$select public.claim_mode_handle('personal', 'mh_personal_x')$$, '22023', 'mode_not_supported', 'Personal uses the username');
select throws_ok($$select public.claim_mode_handle('creator', (select username from mh where kind='a'))$$, '23505', 'handle_taken', 'a Mode cannot take your own live username');
select throws_ok($$select public.claim_mode_handle('creator', (select name from mh_names where kind='biz'))$$, '23505', 'handle_taken', 'two Modes cannot share one handle');
select ok(public.set_mode_handle_visibility('business', false, true)->>'search_indexed' = 'false', 'search listing needs the link to be live');
reset role;

select is(public.resolve_mode_handle((select name from mh_names where kind='biz')), null, 'a claimed but not live handle opens nothing');
select isnt((select short_id from public.mode_share_locators l join public.profile_modes m on m.id=l.mode_id where m.profile_id=(select user_id from mh where kind='a') and m.slug='business'), null, 'claiming mints the Mode''s share id');

-- B cannot take it, by handle or by username.
set local role authenticated;
select pg_temp.as_member('b');
select is(public.check_handle((select name from mh_names where kind='biz')), 'taken', 'others see it as taken');
select throws_ok($$select public.claim_mode_handle('business', (select name from mh_names where kind='biz'))$$, '23505', 'handle_taken', 'another member cannot claim it');
select is((select count(*)::int from public.mode_handles), 0, 'members cannot see others'' handles');
select throws_ok($$select public.set_mode_handle_visibility('business', true, true)$$, '22023', 'handle_missing', 'and cannot switch someone else''s link on');
reset role;
select throws_ok($$update public.profiles set username=(select name from mh_names where kind='biz') where id=(select user_id from mh where kind='b')$$, '23505', 'username_taken', 'a username cannot take a Mode handle');

-- A turns it live and listed.
set local role authenticated;
select pg_temp.as_member('a');
select is(public.set_mode_handle_visibility('business', true, true)->>'search_indexed', 'true', 'the owner can make it live and listed');
reset role;
select is(public.resolve_mode_handle((select name from mh_names where kind='biz'))->>'mode', 'business', 'a live handle opens its Mode');
select is((select count(*)::int from public.list_indexed_mode_handles() where handle=(select name from mh_names where kind='biz')), 1, 'listed handles go to the sitemap');
select is(public.live_mode_handle((select user_id from mh where kind='a'), 'business'), (select name from mh_names where kind='biz'), 'the server finds the live handle for QR and Tap');

-- Turning the Mode off or unpublishing hides it everywhere.
update public.profile_modes set is_enabled=false where profile_id=(select user_id from mh where kind='a') and slug='business';
select is(public.resolve_mode_handle((select name from mh_names where kind='biz')), null, 'a disabled Mode does not open by handle');
update public.profile_modes set is_enabled=true where profile_id=(select user_id from mh where kind='a') and slug='business';
update public.profiles set is_published=false where id=(select user_id from mh where kind='a');
select is((select count(*)::int from public.list_indexed_mode_handles() where handle=(select name from mh_names where kind='biz')), 0, 'an unpublished profile is not in the sitemap');
update public.profiles set is_published=true where id=(select user_id from mh where kind='a');

-- Change the handle: the old one stays A's and points at the new live one, one hop.
set local role authenticated;
select pg_temp.as_member('a');
select is(public.claim_mode_handle('business', (select name from mh_names where kind='biz2'))->>'is_live', 'true', 'changing the handle keeps the link live');
reset role;
select is(public.resolve_renamed_handle((select name from mh_names where kind='biz')), (select name from mh_names where kind='biz2'), 'the old handle redirects to the new one');
set local role authenticated;
select pg_temp.as_member('b');
select is(public.check_handle((select name from mh_names where kind='biz')), 'taken', 'nobody else can take the old handle');
reset role;

-- Release: kept for A, opens nothing, no redirect to the private /s/ link.
set local role authenticated;
select pg_temp.as_member('a');
select lives_ok($$select public.release_mode_handle('business')$$, 'the owner can give up a handle');
select is(public.check_handle((select name from mh_names where kind='biz2')), 'free', 'it stays free for its owner');
reset role;
select is(public.resolve_renamed_handle((select name from mh_names where kind='biz2')), null, 'a released handle never points at the unlisted Mode');
select pg_temp.as_member('b');
select ok(not public.is_username_available((select name from mh_names where kind='biz2')), 'and stays blocked for others');

-- Account deletion keeps the Mode handle blocked.
set local role authenticated;
select pg_temp.as_member('c');
select is(public.claim_mode_handle('creator', (select name from mh_names where kind='gone'))->>'handle', (select name from mh_names where kind='gone'), 'an unpublished member can claim');
reset role;
select is(public.resolve_mode_handle((select name from mh_names where kind='gone')), null, 'but nothing opens while unpublished');
delete from auth.users where id=(select user_id from mh where kind='c');
select ok(not public.is_username_available((select name from mh_names where kind='gone')), 'after account deletion the Mode handle stays blocked');

select * from finish();
rollback;
