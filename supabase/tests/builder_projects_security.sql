begin;

select plan(18);

create temporary table bp(kind text primary key, id uuid);
grant select, insert on bp to anon, authenticated, service_role;
insert into bp select k, gen_random_uuid() from unnest(array['owner','other']) k;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select id,'authenticated','authenticated','bp_'||substr(replace(id::text,'-',''),1,10)||'@example.test',
  jsonb_build_object('username','bp_'||substr(replace(id::text,'-',''),1,10),'display_name',initcap(kind)),now(),now(),now() from bp;
update public.profiles set is_published=true where id in (select id from bp);
update public.profile_modes set is_enabled=true where profile_id in (select id from bp);
insert into bp select 'creator', id from public.profile_modes where profile_id=(select id from bp where kind='owner') and slug='creator';
insert into bp select 'personal', id from public.profile_modes where profile_id=(select id from bp where kind='owner') and slug='personal';
create function pg_temp.as_user(p text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from bp where kind=p),'role','authenticated')::text, true) $$;
create function pg_temp.v(p text) returns uuid language sql as $$ select id from bp where kind=p $$;
create function pg_temp.uname(p text) returns text language sql as $$ select username from public.profiles where id=(select id from bp where kind=p) $$;
grant execute on function pg_temp.as_user(text), pg_temp.v(text), pg_temp.uname(text) to anon, authenticated;

select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.builder_projects'::regclass,'public.builder_roadmap_items'::regclass,'public.builder_project_updates'::regclass,'public.builder_project_actions'::regclass)), 'every Builder table has RLS');
select ok(not has_table_privilege('anon','public.builder_projects','select'), 'visitors read projects only through the public function');

set local role authenticated;
select pg_temp.as_user('owner');
select throws_ok($$insert into public.builder_projects(owner_user_id, mode_id, slug, name) values (auth.uid(), pg_temp.v('personal'), 'x', 'X')$$,
  '23514', 'builder_mode_invalid', 'projects live on Creator or Business Mode only');
with x as (insert into public.builder_projects(owner_user_id, mode_id, slug, name, tagline, status, tech_stack, visibility)
  values (auth.uid(), pg_temp.v('creator'), 'my-saas', 'My SaaS', 'Invoices that chase themselves', 'building', '{Next.js,Postgres}', 'public') returning id) insert into bp select 'p1', id from x;
select isnt(pg_temp.v('p1'), null, 'Free: one public project');
select throws_ok($$insert into public.builder_projects(owner_user_id, mode_id, slug, name, visibility) values (auth.uid(), pg_temp.v('creator'), 'second', 'Second', 'public')$$,
  'P0001', 'plan_project_limit', 'Free: a second public project needs Plus');
select lives_ok($$insert into public.builder_projects(owner_user_id, mode_id, slug, name) values (auth.uid(), pg_temp.v('creator'), 'draft-one', 'Draft one')$$, 'drafts never count');
select throws_ok($$insert into public.builder_projects(owner_user_id, mode_id, slug, name, url) values (auth.uid(), pg_temp.v('creator'), 'bad-url', 'Bad', 'javascript:alert(1)')$$,
  '23514', null, 'project links must be https');

-- Roadmap: shipping stamps the date and completes progress; moving back clears it.
with x as (insert into public.builder_roadmap_items(project_id, owner_user_id, title, stage) values (pg_temp.v('p1'), auth.uid(), 'Stripe sync', 'planned') returning id) insert into bp select 'r1', id from x;
insert into public.builder_roadmap_items(project_id, owner_user_id, title, stage, is_public) values (pg_temp.v('p1'), auth.uid(), 'Secret pivot', 'planned', false);
update public.builder_roadmap_items set stage='shipped' where id=pg_temp.v('r1');
select ok((select shipped_at is not null and progress=100 from public.builder_roadmap_items where id=pg_temp.v('r1')), 'shipping stamps the date and sets progress to 100');
update public.builder_roadmap_items set stage='in_progress' where id=pg_temp.v('r1');
select ok((select shipped_at is null from public.builder_roadmap_items where id=pg_temp.v('r1')), 'moving back clears the ship date');
update public.builder_roadmap_items set stage='shipped' where id=pg_temp.v('r1');
insert into public.builder_project_updates(project_id, owner_user_id, title, body) values (pg_temp.v('p1'), auth.uid(), 'Beta is open', 'First 50 teams.');

-- Linking an Action: only one of the same Mode.
insert into public.profile_actions(profile_id, mode_id, kind, title, status) values (auth.uid(), pg_temp.v('creator'), 'newsletter', 'Waitlist', 'published');
insert into public.profile_actions(profile_id, mode_id, kind, title, status) values (auth.uid(), pg_temp.v('personal'), 'form', 'Personal form', 'draft');
select lives_ok($$insert into public.builder_project_actions(project_id, action_id, owner_user_id) select pg_temp.v('p1'), id, auth.uid() from public.profile_actions where title='Waitlist'$$, 'a Creator Action can sit with the project');
select throws_ok($$insert into public.builder_project_actions(project_id, action_id, owner_user_id) select pg_temp.v('p1'), id, auth.uid() from public.profile_actions where title='Personal form'$$,
  '23514', 'builder_action_invalid', 'an Action from another Mode cannot');

-- Another member cannot read or write any of it.
select pg_temp.as_user('other');
select is((select count(*)::int from public.builder_projects), 0, 'others see no projects directly');
select throws_ok($$insert into public.builder_roadmap_items(project_id, owner_user_id, title) values (pg_temp.v('p1'), auth.uid(), 'Hijack')$$,
  '23514', 'builder_project_mismatch', 'others cannot add to someone''s roadmap');
reset role;

-- The public view: public project, public items, the shipped changelog, the live Action; never drafts or private items.
set local role anon;
select is(jsonb_array_length(public.get_public_builder(pg_temp.uname('owner'), 'creator')), 1, 'visitors see the one public project, not the draft');
select is((public.get_public_builder(pg_temp.uname('owner'), 'creator')->0->'roadmap'->0->>'stage'), 'shipped', 'with its shipped item');
select is(jsonb_array_length(public.get_public_builder(pg_temp.uname('owner'), 'creator')->0->'roadmap'), 1, 'and never a private item');
select is(jsonb_array_length(public.get_public_builder(pg_temp.uname('owner'), 'creator')->0->'action_ids'), 1, 'with its live Action');
reset role;
update public.profiles set is_published=false where id=pg_temp.v('owner');
set local role anon;
select is(jsonb_array_length(public.get_public_builder(pg_temp.uname('owner'), 'creator')), 0, 'nothing shows once the profile is unpublished');
reset role;

select * from finish();
rollback;
