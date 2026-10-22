begin;
select plan(8);

create temporary table lc(kind text primary key, id uuid);
grant select on lc to anon, authenticated;
insert into lc select k, gen_random_uuid() from unnest(array['owner','other']) k;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select id,'authenticated','authenticated','lc_'||substr(replace(id::text,'-',''),1,10)||'@example.test',
  jsonb_build_object('username','lc_'||substr(replace(id::text,'-',''),1,10),'display_name',initcap(kind)), now(), now(), now() from lc where kind in ('owner','other');
insert into lc select 'mode', m.id from public.profile_modes m where m.profile_id = (select id from lc where kind='owner') and m.slug='personal';
insert into lc values ('link', gen_random_uuid());
insert into public.profile_links(id, profile_id, mode_id, title, url, link_type, is_visible, sort_order)
values ((select id from lc where kind='link'), (select id from lc where kind='owner'), (select id from lc where kind='mode'), 'Site', 'https://example.com', 'website', true, 0);
create function pg_temp.as_user(p text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from lc where kind=p),'role','authenticated')::text, true) $$;
grant execute on function pg_temp.as_user(text) to authenticated;

select is(public.record_link_click((select id from lc where kind='link')), false, 'a draft page counts nothing');
update public.profiles set is_published = true where id = (select id from lc where kind='owner');
update public.profile_modes set is_enabled = true where id = (select id from lc where kind='mode');
select is(public.record_link_click((select id from lc where kind='link')), true, 'a live link counts');
select public.record_link_click((select id from lc where kind='link'));
select is(public.record_link_click((select id from lc where kind='link'), (select id from lc where kind='owner')), false, 'the owner''s own taps don''t count');
select ok(not has_function_privilege('anon', 'public.record_link_click(uuid, uuid)', 'execute'), 'visitors cannot write counts directly');
select ok(not has_function_privilege('authenticated', 'public.record_link_click(uuid, uuid)', 'execute'), 'members cannot write counts directly');

set local role authenticated;
select pg_temp.as_user('owner');
select is((public.get_link_clicks(current_date - 7, current_date) ->> 'total')::int, 2, 'the owner reads their taps');
select pg_temp.as_user('other');
select is((public.get_link_clicks(current_date - 7, current_date) ->> 'total')::int, 0, 'nobody reads someone else''s taps');
reset role;
set local role anon;
select throws_ok($$select public.get_link_clicks(current_date - 7, current_date)$$, '42501', null, 'visitors cannot read taps');
reset role;

select * from finish();
rollback;
