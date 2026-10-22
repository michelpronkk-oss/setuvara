begin;
select plan(6);

select ok(not has_function_privilege('anon', 'public.get_mode_tools_summary(uuid,date,date,text)', 'execute'), 'visitors cannot read a summary');
select ok(not has_function_privilege('authenticated', 'public.get_mode_tools_summary(uuid,date,date,text)', 'execute'), 'members go through the plan-checked API, not the function');

create temporary table mt(kind text primary key, id uuid);
insert into mt select k, gen_random_uuid() from unnest(array['owner','fan']) k;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select id,'authenticated','authenticated','mt_'||substr(replace(id::text,'-',''),1,10)||'@example.test',
  jsonb_build_object('username','mt_'||substr(replace(id::text,'-',''),1,10),'display_name',initcap(kind)), now(), now(), now() from mt;
update public.profile_modes set is_enabled = true where profile_id = (select id from mt where kind='owner');
with p as (insert into public.builder_projects(owner_user_id, mode_id, slug, name, visibility)
  select (select id from mt where kind='owner'), m.id, 'app', 'App', 'public' from public.profile_modes m where m.profile_id=(select id from mt where kind='owner') and m.slug='creator' returning id)
insert into mt select 'project', id from p;
with i as (insert into public.builder_roadmap_items(project_id, owner_user_id, title) values ((select id from mt where kind='project'), (select id from mt where kind='owner'), 'Dark mode') returning id)
insert into public.builder_votes(item_id, project_id, voter_user_id) select i.id, (select id from mt where kind='project'), (select id from mt where kind='fan') from i;

select is((public.get_mode_tools_summary((select id from mt where kind='owner'), current_date - 6, current_date, null)->>'builder_votes'), '1', 'a vote on the owner''s roadmap counts');
select is((public.get_mode_tools_summary((select id from mt where kind='fan'), current_date - 6, current_date, null)->>'builder_votes'), '0', 'and only for the owner');

select is((public.get_mode_tools_summary((select id from mt where kind='owner'), current_date - 6, current_date, 'creator')->>'builder_votes'), '1', 'the Creator Mode keeps its own vote');
select is((public.get_mode_tools_summary((select id from mt where kind='owner'), current_date - 6, current_date, 'business')->>'builder_votes'), '0', 'another Mode does not');

select * from finish();
rollback;
