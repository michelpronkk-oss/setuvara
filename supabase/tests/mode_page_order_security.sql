begin;
select plan(6);

create temporary table po(kind text primary key, id uuid);
grant select on po to anon, authenticated;
insert into po select k, gen_random_uuid() from unnest(array['owner','other']) k;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select id,'authenticated','authenticated','po_'||substr(replace(id::text,'-',''),1,10)||'@example.test',
  jsonb_build_object('username','po_'||substr(replace(id::text,'-',''),1,10),'display_name',initcap(kind)), now(), now(), now() from po;
insert into po select 'mode', m.id from public.profile_modes m where m.profile_id = (select id from po where kind='owner') and m.slug='personal';
create function pg_temp.as_user(p text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from po where kind=p),'role','authenticated')::text, true) $$;
grant execute on function pg_temp.as_user(text) to authenticated;

set local role authenticated;
select pg_temp.as_user('owner');
select lives_ok($$insert into public.mode_page_order(mode_id, profile_id, items) values ((select id from po where kind='mode'), (select id from po where kind='owner'), array['section:creator', 'link:' || gen_random_uuid()::text])$$, 'the owner saves an order');
select throws_ok($$update public.mode_page_order set items = array['link:x; drop table x'] where mode_id = (select id from po where kind='mode')$$, '23514', null, 'junk entries are refused');
select pg_temp.as_user('other');
select is((select count(*)::int from public.mode_page_order), 0, 'others cannot read a draft page''s order');
select throws_ok($$insert into public.mode_page_order(mode_id, profile_id, items) values ((select id from po where kind='mode'), (select id from po where kind='other'), '{}')$$, '42501', null, 'nobody orders someone else''s Mode');
reset role;
update public.profiles set is_published = true where id = (select id from po where kind='owner');
update public.profile_modes set is_enabled = true where id = (select id from po where kind='mode');
set local role anon;
select is((select count(*)::int from public.mode_page_order), 1, 'visitors read a live page''s order');
select ok(not has_table_privilege('anon', 'public.mode_page_order', 'insert'), 'visitors cannot write');
reset role;

select * from finish();
rollback;
