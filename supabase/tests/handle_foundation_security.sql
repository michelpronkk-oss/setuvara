begin;

select plan(26);

-- Two members, one published.
create temporary table hf(kind text primary key, user_id uuid not null, username text not null);
insert into hf select kind, gen_random_uuid(), 'hf_'||kind||'_'||substr(md5(random()::text),1,8) from (values('a'),('b'),('c')) v(kind);
grant select on hf to anon, authenticated;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name','HF '||kind),now(),now(),now() from hf;
update public.profiles set is_published = true where id in (select user_id from hf where kind in ('a','b'));

select ok(not has_table_privilege('anon','public.handle_history','select'), 'visitors cannot read handle history');
select ok(not has_table_privilege('authenticated','public.handle_history','select'), 'members cannot read handle history');
select ok(not has_table_privilege('authenticated','public.handle_history','insert'), 'members cannot write handle history');
select ok(not has_function_privilege('authenticated','private.guard_username_change()','execute'), 'trigger functions are private');

-- Reserved names, through the table, on sign-up and on rename.
select ok(public.is_reserved_handle('Roadmap'), 'roadmap is reserved (case-insensitive)');
select ok(not public.is_username_available('internal'), 'internal is not available');
select throws_ok($$update public.profiles set username='roadmap' where id=(select user_id from hf where kind='a')$$, '23514', 'username_reserved', 'renaming to a reserved route is refused');
select throws_ok($$insert into auth.users(id,aud,role,email,raw_user_meta_data) values (gen_random_uuid(),'authenticated','authenticated','r@example.test','{"username":"refunds"}')$$, '23514', null, 'signing up with a reserved route is refused');

-- A renames: the old name stays A's and redirects.
create temporary table hf_names(kind text primary key, old text, new text);
insert into hf_names select 'a', username, username||'x' from hf where kind='a';
grant select on hf_names to anon, authenticated;
update public.profiles set username=(select new from hf_names) where id=(select user_id from hf where kind='a');
select is((select profile_id from public.handle_history where handle=(select old from hf_names)), (select user_id from hf where kind='a'), 'the old name is kept for its owner');
select is(public.resolve_renamed_handle((select old from hf_names)), (select new from hf_names), 'the old name resolves to the current one');
select is(public.resolve_renamed_handle(upper((select old from hf_names))), (select new from hf_names), 'resolving is case-insensitive');
select is(public.resolve_renamed_handle((select new from hf_names)), null, 'a live name never redirects');

-- Nobody else can take it, ever (no automatic release).
update public.handle_history set retired_at = now() - interval '5 years' where handle=(select old from hf_names);
select ok(not public.is_username_available((select old from hf_names)), 'the old name is not available to others even years later');
select throws_ok($$update public.profiles set username=(select old from hf_names) where id=(select user_id from hf where kind='b')$$, '23505', 'username_held', 'another member cannot take it');

-- The owner sees it as available and can take it back; history row goes, no loop.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',(select user_id from hf where kind='a'),'role','authenticated')::text, true);
select ok(public.is_username_available((select old from hf_names)), 'the owner can see their old name as available');
reset role;
-- Changes are once a month; move the first one back so the owner can take the name back now.
update private.username_changes set changed_at = now() - interval '31 days' where profile_id=(select user_id from hf where kind='a');
update public.profiles set username=(select old from hf_names) where id=(select user_id from hf where kind='a');
select is((select count(*)::int from public.handle_history where handle=(select old from hf_names)), 0, 'taking it back removes it from history');
select is(public.resolve_renamed_handle((select new from hf_names)), (select old from hf_names), 'the in-between name now points back, one hop');
select is(public.resolve_renamed_handle((select old from hf_names)), null, 'and the live name does not redirect: no loop');

-- Change limit: once in 30 days (taking a name back counted as A's change).
select throws_ok($$update public.profiles set username=(select new from hf_names)||'y' where id=(select user_id from hf where kind='a')$$, 'P0001', 'username_change_limit', 'a second change in 30 days is refused');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',(select user_id from hf where kind='a'),'role','authenticated')::text, true);
select ok(public.handle_next_change_at('personal') > now() + interval '29 days', 'the owner can see when the next change opens');
reset role;
update private.username_changes set changed_at = now() - interval '31 days' where profile_id=(select user_id from hf where kind='a');
set local role authenticated;
select is(public.handle_next_change_at('personal'), null, 'after 30 days the username can change again');
reset role;
update public.profiles set username=(select new from hf_names)||'y' where id=(select user_id from hf where kind='a');

-- Unpublished owners don't redirect; deleted owners keep the name blocked.
update public.profiles set username=(select username from hf where kind='c')||'n' where id=(select user_id from hf where kind='c');
select is(public.resolve_renamed_handle((select username from hf where kind='c')), null, 'an unpublished owner''s old name does not redirect');
delete from auth.users where id=(select user_id from hf where kind='c');
select is((select profile_id from public.handle_history where handle=(select username from hf where kind='c')), null, 'after account deletion the row stays with no owner');
select ok(not public.is_username_available((select username from hf where kind='c')), 'and the name stays blocked');

-- Visitors only get the redirect target, nothing else.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(public.resolve_renamed_handle((select old from hf_names)), (select new from hf_names)||'y', 'visitors resolve a published rename');
select ok(not public.is_username_available((select new from hf_names)), 'visitors see a kept name as taken');
reset role;

select * from finish();
rollback;
