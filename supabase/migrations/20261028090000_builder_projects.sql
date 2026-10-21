-- Builder Showcase, slice 1: projects, public roadmaps and project updates.
--
-- An optional section of Creator and Business Mode (never a Mode of its own): what the owner is
-- building, how far it is, and what shipped. It renders inside the Mode's public page and its
-- Appearance. Logos and covers are image blocks of the same Mode, like Action covers.
--
--   builder_projects        one project: name, pitch, status, category, stack, launch date, link
--   builder_roadmap_items   Planned → In progress → Shipped; shipped items are the changelog
--   builder_project_updates short owner posts on the project
--   builder_project_actions the Mode's Actions shown with a project (waitlist, beta, feedback…)
--
-- Plan limits (private.builder_plan_limits): public projects 1 / 5 / 20, roadmap items per
-- project 15 / 60 / 200. Drafts never count. Owners write under RLS; the public reads through
-- get_public_builder, which only returns public projects of a published profile's enabled Mode.

create table private.builder_plan_limits (
  plan_code text primary key check (plan_code in ('free','plus','pro')),
  public_projects integer not null check (public_projects between 0 and 100),
  roadmap_items integer not null check (roadmap_items between 0 and 1000)
);
insert into private.builder_plan_limits values ('free', 1, 15), ('plus', 5, 60), ('pro', 20, 200);
revoke all on private.builder_plan_limits from public, anon, authenticated;

create table public.builder_projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  mode_id uuid not null references public.profile_modes(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 1 and 48),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  tagline text not null default '' check (char_length(tagline) <= 140),
  description text not null default '' check (char_length(description) <= 2000),
  url text check (url is null or (char_length(url) <= 300 and url ~* '^https://[^\s/]+\.[^\s]+$')),
  status text not null default 'building' check (status in ('building','live','paused','shipped','acquired')),
  category text not null default '' check (char_length(category) <= 40),
  tech_stack text[] not null default '{}' check (cardinality(tech_stack) <= 12),
  launched_on date,
  logo_block_id uuid references public.profile_blocks(id) on delete set null,
  cover_block_id uuid references public.profile_blocks(id) on delete set null,
  visibility text not null default 'draft' check (visibility in ('draft','public')),
  roadmap_public boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (owner_user_id, slug)
);
create index builder_projects_mode_idx on public.builder_projects (mode_id, sort_order) where visibility = 'public';
create trigger builder_projects_set_updated_at before update on public.builder_projects for each row execute function private.set_updated_at();

create table public.builder_roadmap_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.builder_projects(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  stage text not null default 'planned' check (stage in ('planned','in_progress','shipped')),
  progress integer not null default 0 check (progress between 0 and 100),
  target_date date,
  shipped_at timestamptz,
  is_public boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  check ((stage = 'shipped') = (shipped_at is not null))
);
create index builder_roadmap_items_project_idx on public.builder_roadmap_items (project_id, stage, sort_order);
create trigger builder_roadmap_items_set_updated_at before update on public.builder_roadmap_items for each row execute function private.set_updated_at();

create table public.builder_project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.builder_projects(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  body text not null default '' check (char_length(body) <= 4000),
  published_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_at timestamptz not null default pg_catalog.statement_timestamp()
);
create index builder_project_updates_project_idx on public.builder_project_updates (project_id, published_at desc);

create table public.builder_project_actions (
  project_id uuid not null references public.builder_projects(id) on delete cascade,
  action_id uuid not null references public.profile_actions(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order between 0 and 100),
  primary key (project_id, action_id)
);

-- Projects live on Creator or Business Mode; images and Actions come from the same Mode; public counts stay in the plan.
create function private.validate_builder_project() returns trigger language plpgsql security definer set search_path='' as $function$
declare v_limit integer;
begin
  if not exists(select 1 from public.profile_modes m where m.id = new.mode_id and m.profile_id = new.owner_user_id and m.slug in ('creator','business')) then
    raise exception using errcode='23514', message='builder_mode_invalid';
  end if;
  if tg_op = 'UPDATE' and (new.owner_user_id <> old.owner_user_id or new.mode_id <> old.mode_id) then
    raise exception using errcode='23514', message='builder_identity_locked';
  end if;
  if (new.logo_block_id is not null and not exists(select 1 from public.profile_blocks b where b.id = new.logo_block_id and b.mode_id = new.mode_id and b.kind = 'image'))
     or (new.cover_block_id is not null and not exists(select 1 from public.profile_blocks b where b.id = new.cover_block_id and b.mode_id = new.mode_id and b.kind = 'image')) then
    raise exception using errcode='23514', message='builder_image_invalid';
  end if;
  if exists(select 1 from pg_catalog.unnest(new.tech_stack) t where pg_catalog.char_length(pg_catalog.btrim(t)) not between 1 and 30) then
    raise exception using errcode='23514', message='builder_stack_invalid';
  end if;
  if new.visibility = 'public' and (tg_op = 'INSERT' or old.visibility <> 'public') then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('builder_projects:' || new.owner_user_id::text, 0));
    select l.public_projects into v_limit from private.builder_plan_limits l where l.plan_code = private.member_plan(new.owner_user_id);
    if (select count(*) from public.builder_projects p where p.owner_user_id = new.owner_user_id and p.visibility = 'public' and p.id <> new.id) >= v_limit then
      raise exception using errcode='P0001', message='plan_project_limit';
    end if;
  end if;
  return new;
end;
$function$;
create trigger builder_projects_validate before insert or update on public.builder_projects for each row execute function private.validate_builder_project();

create function private.validate_builder_child() returns trigger language plpgsql security definer set search_path='' as $function$
declare v_limit integer;
begin
  if not exists(select 1 from public.builder_projects p where p.id = new.project_id and p.owner_user_id = new.owner_user_id) then
    raise exception using errcode='23514', message='builder_project_mismatch';
  end if;
  if tg_op = 'UPDATE' and (new.project_id <> old.project_id or new.owner_user_id <> old.owner_user_id) then
    raise exception using errcode='23514', message='builder_identity_locked';
  end if;
  if tg_table_name = 'builder_roadmap_items' then
    -- Shipping stamps the date (the changelog's order); moving back clears it.
    if new.stage = 'shipped' and new.shipped_at is null then new.shipped_at := pg_catalog.statement_timestamp(); new.progress := 100; end if;
    if new.stage <> 'shipped' then new.shipped_at := null; end if;
    if tg_op = 'INSERT' then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('builder_roadmap:' || new.project_id::text, 0));
      select l.roadmap_items into v_limit from private.builder_plan_limits l where l.plan_code = private.member_plan(new.owner_user_id);
      if (select count(*) from public.builder_roadmap_items r where r.project_id = new.project_id) >= v_limit then
        raise exception using errcode='P0001', message='plan_roadmap_limit';
      end if;
    end if;
  elsif tg_table_name = 'builder_project_actions' then
    if not exists(select 1 from public.profile_actions a join public.builder_projects p on p.id = new.project_id
        where a.id = new.action_id and a.profile_id = new.owner_user_id and a.mode_id = p.mode_id) then
      raise exception using errcode='23514', message='builder_action_invalid';
    end if;
  end if;
  return new;
end;
$function$;
create trigger builder_roadmap_items_validate before insert or update on public.builder_roadmap_items for each row execute function private.validate_builder_child();
create trigger builder_project_updates_validate before insert or update on public.builder_project_updates for each row execute function private.validate_builder_child();
create trigger builder_project_actions_validate before insert or update on public.builder_project_actions for each row execute function private.validate_builder_child();

alter table public.builder_projects enable row level security;
alter table public.builder_roadmap_items enable row level security;
alter table public.builder_project_updates enable row level security;
alter table public.builder_project_actions enable row level security;
revoke all on public.builder_projects, public.builder_roadmap_items, public.builder_project_updates, public.builder_project_actions from public, anon, authenticated;
grant select, insert, update, delete on public.builder_projects, public.builder_roadmap_items, public.builder_project_updates, public.builder_project_actions to authenticated;
grant all on public.builder_projects, public.builder_roadmap_items, public.builder_project_updates, public.builder_project_actions to service_role;
create policy builder_projects_owner_all on public.builder_projects for all to authenticated
  using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy builder_roadmap_items_owner_all on public.builder_roadmap_items for all to authenticated
  using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy builder_project_updates_owner_all on public.builder_project_updates for all to authenticated
  using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy builder_project_actions_owner_all on public.builder_project_actions for all to authenticated
  using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));

-- The owner's plan limits for the studio.
create function public.my_builder_limits()
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('plan', l.plan_code, 'public_projects', l.public_projects, 'roadmap_items', l.roadmap_items)
  from private.builder_plan_limits l where l.plan_code = private.member_plan(auth.uid()) and auth.uid() is not null
$function$;

-- What visitors see: public projects of a published profile's enabled Creator or Business Mode.
create function public.get_public_builder(p_username text, p_mode_slug text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', bp.id, 'slug', bp.slug, 'name', bp.name, 'tagline', bp.tagline, 'description', bp.description, 'url', bp.url,
      'status', bp.status, 'category', bp.category, 'tech_stack', pg_catalog.to_jsonb(bp.tech_stack), 'launched_on', bp.launched_on,
      'logo_block_id', bp.logo_block_id, 'cover_block_id', bp.cover_block_id,
      'roadmap', case when bp.roadmap_public then coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'description', r.description,
          'stage', r.stage, 'progress', r.progress, 'target_date', r.target_date, 'shipped_at', r.shipped_at)
          order by case r.stage when 'in_progress' then 0 when 'planned' then 1 else 2 end, r.sort_order, r.shipped_at desc nulls last, r.created_at)
        from public.builder_roadmap_items r where r.project_id = bp.id and r.is_public), '[]'::jsonb) else '[]'::jsonb end,
      'updates', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'title', u.title, 'body', u.body, 'published_at', u.published_at) order by u.published_at desc)
        from (select * from public.builder_project_updates u2 where u2.project_id = bp.id and u2.published_at <= pg_catalog.statement_timestamp() order by u2.published_at desc limit 5) u), '[]'::jsonb),
      'action_ids', coalesce((select jsonb_agg(pa.action_id order by pa.sort_order) from public.builder_project_actions pa
        join public.profile_actions a on a.id = pa.action_id and a.status = 'published' where pa.project_id = bp.id), '[]'::jsonb)
    ) order by bp.sort_order, bp.created_at), '[]'::jsonb)
  from public.profiles p
  join public.profile_modes m on m.profile_id = p.id and m.slug = p_mode_slug and m.is_enabled and m.slug in ('creator','business')
  join public.builder_projects bp on bp.mode_id = m.id and bp.visibility = 'public'
  where p.username = pg_catalog.lower(pg_catalog.btrim(p_username)) and p.is_published
$function$;

revoke all on function private.validate_builder_project(), private.validate_builder_child() from public, anon, authenticated;
revoke all on function public.my_builder_limits(), public.get_public_builder(text, text) from public;
grant execute on function public.my_builder_limits() to authenticated;
grant execute on function public.get_public_builder(text, text) to anon, authenticated, service_role;

comment on table public.builder_projects is 'Builder Showcase projects on Creator/Business Mode. Owner-managed under RLS; public via get_public_builder.';
comment on table public.builder_roadmap_items is 'Planned / in progress / shipped items of a project; shipped items form the changelog.';
