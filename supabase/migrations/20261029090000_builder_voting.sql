-- Builder Showcase, slice 2: feature voting and suggestions.
--
--   * Voting: a signed-in Setuvara member with a confirmed email can vote once per roadmap item
--     (planned or in progress) of a public project with voting on, and take the vote back. The
--     public sees counts only; who voted is never exposed.
--   * Suggestions: the same members can suggest an idea. It stays private until the owner approves
--     it; approving can add it to the roadmap as a planned item the author follows. Authors see
--     their own suggestions and where each one stands (pending, declined, planned, in progress,
--     shipped). Nothing an author writes is published without the owner.
--   * Abuse: votes 60 per member per hour; suggestions 5 per member per day and 3 pending per
--     member per project; text length limits; the owner can't vote on or suggest to their own project.
--   * Plans (builder_plan_limits): voting on every plan; suggestions on Plus and Pro; CSV export of
--     aggregate counts on Pro. Owner analytics: totals per item and votes over the last 30 days.

alter table private.builder_plan_limits
  add column suggestions boolean not null default false,
  add column export boolean not null default false;
update private.builder_plan_limits set suggestions = (plan_code <> 'free'), export = (plan_code = 'pro');

alter table public.builder_projects
  add column voting_enabled boolean not null default true,
  add column suggestions_enabled boolean not null default false;

create table public.builder_votes (
  item_id uuid not null references public.builder_roadmap_items(id) on delete cascade,
  project_id uuid not null references public.builder_projects(id) on delete cascade,
  voter_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  primary key (item_id, voter_user_id)
);
create index builder_votes_project_idx on public.builder_votes (project_id, created_at desc);
create index builder_votes_voter_idx on public.builder_votes (voter_user_id, created_at desc);

create table public.builder_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.builder_projects(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  body text not null default '' check (char_length(body) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  roadmap_item_id uuid references public.builder_roadmap_items(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp()
);
create index builder_suggestions_owner_idx on public.builder_suggestions (owner_user_id, status, created_at desc);
create index builder_suggestions_author_idx on public.builder_suggestions (author_user_id, created_at desc);

alter table public.builder_votes enable row level security;
alter table public.builder_suggestions enable row level security;
revoke all on public.builder_votes, public.builder_suggestions from public, anon, authenticated;
grant select on public.builder_suggestions to authenticated;
grant all on public.builder_votes, public.builder_suggestions to service_role;
-- Owners read suggestions to their projects; authors read their own. Votes are only read through functions.
create policy builder_suggestions_read on public.builder_suggestions for select to authenticated
  using (owner_user_id = (select auth.uid()) or author_user_id = (select auth.uid()));

create function private.builder_member_ok(p_uid uuid) returns boolean language sql stable security definer set search_path='' as $function$
  select exists(select 1 from auth.users u where u.id = p_uid and u.email_confirmed_at is not null and u.deleted_at is null and coalesce(u.banned_until, '-infinity') < pg_catalog.now())
$function$;

-- A public project of a published profile's enabled Creator or Business Mode, with its owner.
create function private.builder_public_project(p_project uuid) returns public.builder_projects language sql stable security definer set search_path='' as $function$
  select bp.* from public.builder_projects bp
  join public.profile_modes m on m.id = bp.mode_id and m.is_enabled and m.slug in ('creator','business')
  join public.profiles p on p.id = bp.owner_user_id and p.is_published
  where bp.id = p_project and bp.visibility = 'public'
$function$;

create function public.vote_builder_item(p_item_id uuid, p_vote boolean)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_uid uuid := auth.uid();
  v_item public.builder_roadmap_items;
  v_project public.builder_projects;
begin
  if v_uid is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if not private.builder_member_ok(v_uid) then raise exception using errcode='42501', message='confirm_email_first'; end if;
  select * into v_item from public.builder_roadmap_items where id = p_item_id;
  if not found then raise exception using errcode='P0002', message='item_not_found'; end if;
  v_project := private.builder_public_project(v_item.project_id);
  if v_project.id is null or not v_project.roadmap_public or not v_item.is_public then raise exception using errcode='P0002', message='item_not_found'; end if;
  if not v_project.voting_enabled then raise exception using errcode='P0001', message='voting_closed'; end if;
  if v_project.owner_user_id = v_uid then raise exception using errcode='P0001', message='own_project'; end if;
  if coalesce(p_vote, false) then
    if v_item.stage = 'shipped' then raise exception using errcode='P0001', message='already_shipped'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('builder_votes:' || v_uid::text, 0));
    if (select count(*) from public.builder_votes v where v.voter_user_id = v_uid and v.created_at > pg_catalog.statement_timestamp() - interval '1 hour') >= 60 then
      raise exception using errcode='P0001', message='rate_limited';
    end if;
    insert into public.builder_votes (item_id, project_id, voter_user_id) values (v_item.id, v_item.project_id, v_uid) on conflict do nothing;
  else
    delete from public.builder_votes where item_id = v_item.id and voter_user_id = v_uid;
  end if;
  return jsonb_build_object('voted', coalesce(p_vote, false), 'votes', (select count(*) from public.builder_votes v where v.item_id = v_item.id));
end;
$function$;

create function public.suggest_builder_feature(p_project_id uuid, p_title text, p_body text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_uid uuid := auth.uid();
  v_project public.builder_projects;
  v_title text := pg_catalog.btrim(coalesce(p_title, ''));
  v_body text := pg_catalog.btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_uid is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if not private.builder_member_ok(v_uid) then raise exception using errcode='42501', message='confirm_email_first'; end if;
  v_project := private.builder_public_project(p_project_id);
  if v_project.id is null then raise exception using errcode='P0002', message='project_not_found'; end if;
  if not v_project.suggestions_enabled or not (select l.suggestions from private.builder_plan_limits l where l.plan_code = private.member_plan(v_project.owner_user_id)) then
    raise exception using errcode='P0001', message='suggestions_closed';
  end if;
  if v_project.owner_user_id = v_uid then raise exception using errcode='P0001', message='own_project'; end if;
  if pg_catalog.char_length(v_title) not between 3 and 100 or pg_catalog.char_length(v_body) > 1000 then raise exception using errcode='22023', message='invalid_suggestion'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('builder_suggest:' || v_uid::text, 0));
  if (select count(*) from public.builder_suggestions s where s.author_user_id = v_uid and s.created_at > pg_catalog.statement_timestamp() - interval '1 day') >= 5
     or (select count(*) from public.builder_suggestions s where s.author_user_id = v_uid and s.project_id = v_project.id and s.status = 'pending') >= 3 then
    raise exception using errcode='P0001', message='rate_limited';
  end if;
  insert into public.builder_suggestions (project_id, owner_user_id, author_user_id, title, body)
    values (v_project.id, v_project.owner_user_id, v_uid, v_title, v_body) returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$function$;

-- The owner decides. Approving can add the idea to the roadmap as a planned public item.
create function public.review_builder_suggestion(p_suggestion_id uuid, p_approve boolean, p_add_to_roadmap boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_uid uuid := auth.uid();
  s public.builder_suggestions;
  v_item uuid;
begin
  if v_uid is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  select * into s from public.builder_suggestions where id = p_suggestion_id and owner_user_id = v_uid for update;
  if not found then raise exception using errcode='P0002', message='suggestion_not_found'; end if;
  if s.status <> 'pending' then return jsonb_build_object('status', s.status, 'roadmap_item_id', s.roadmap_item_id, 'changed', false); end if;
  if coalesce(p_approve, false) and coalesce(p_add_to_roadmap, true) then
    insert into public.builder_roadmap_items (project_id, owner_user_id, title, description, stage, sort_order)
      values (s.project_id, v_uid, pg_catalog.left(s.title, 100), pg_catalog.left(s.body, 1000), 'planned',
        (select coalesce(max(r.sort_order), 0) + 1 from public.builder_roadmap_items r where r.project_id = s.project_id))
      returning id into v_item;
  end if;
  update public.builder_suggestions set status = case when coalesce(p_approve, false) then 'approved' else 'declined' end,
    roadmap_item_id = v_item, decided_at = pg_catalog.statement_timestamp() where id = s.id;
  return jsonb_build_object('status', case when coalesce(p_approve, false) then 'approved' else 'declined' end, 'roadmap_item_id', v_item, 'changed', true);
end;
$function$;

-- What a signed-in visitor sees of a project: their votes and their own suggestions with progress.
create function public.my_builder_activity(p_project_id uuid)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object(
    'voted', coalesce((select jsonb_agg(v.item_id) from public.builder_votes v where v.project_id = p_project_id and v.voter_user_id = auth.uid()), '[]'::jsonb),
    'suggestions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'status', s.status, 'stage', r.stage, 'created_at', s.created_at) order by s.created_at desc)
      from public.builder_suggestions s left join public.builder_roadmap_items r on r.id = s.roadmap_item_id
      where s.project_id = p_project_id and s.author_user_id = auth.uid()), '[]'::jsonb))
  where auth.uid() is not null
$function$;

-- Owner analytics: votes per item (total and last 30 days) and suggestion counts. Aggregates only.
create function public.builder_project_insights(p_project_id uuid)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'stage', r.stage,
        'votes', (select count(*) from public.builder_votes v where v.item_id = r.id),
        'votes_30d', (select count(*) from public.builder_votes v where v.item_id = r.id and v.created_at > pg_catalog.statement_timestamp() - interval '30 days'))
        order by (select count(*) from public.builder_votes v where v.item_id = r.id) desc, r.sort_order)
      from public.builder_roadmap_items r where r.project_id = bp.id), '[]'::jsonb),
    'voters', (select count(distinct v.voter_user_id) from public.builder_votes v where v.project_id = bp.id),
    'pending', (select count(*) from public.builder_suggestions s where s.project_id = bp.id and s.status = 'pending'),
    'approved', (select count(*) from public.builder_suggestions s where s.project_id = bp.id and s.status = 'approved'),
    'declined', (select count(*) from public.builder_suggestions s where s.project_id = bp.id and s.status = 'declined'),
    'can_export', (select l.export from private.builder_plan_limits l where l.plan_code = private.member_plan(bp.owner_user_id)))
  from public.builder_projects bp where bp.id = p_project_id and bp.owner_user_id = auth.uid()
$function$;

-- Plan limits for the studio, now with suggestions and export.
create or replace function public.my_builder_limits()
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('plan', l.plan_code, 'public_projects', l.public_projects, 'roadmap_items', l.roadmap_items, 'suggestions', l.suggestions, 'export', l.export)
  from private.builder_plan_limits l where l.plan_code = private.member_plan(auth.uid()) and auth.uid() is not null
$function$;

-- The public view gains vote counts per item and the project's voting and suggestion switches.
create or replace function public.get_public_builder(p_username text, p_mode_slug text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', bp.id, 'slug', bp.slug, 'name', bp.name, 'tagline', bp.tagline, 'description', bp.description, 'url', bp.url,
      'status', bp.status, 'category', bp.category, 'tech_stack', pg_catalog.to_jsonb(bp.tech_stack), 'launched_on', bp.launched_on,
      'logo_block_id', bp.logo_block_id, 'cover_block_id', bp.cover_block_id,
      'voting', bp.voting_enabled and bp.roadmap_public,
      'suggestions', bp.suggestions_enabled and (select l.suggestions from private.builder_plan_limits l where l.plan_code = private.member_plan(bp.owner_user_id)),
      'roadmap', case when bp.roadmap_public then coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'description', r.description,
          'stage', r.stage, 'progress', r.progress, 'target_date', r.target_date, 'shipped_at', r.shipped_at,
          'votes', (select count(*) from public.builder_votes v where v.item_id = r.id))
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

revoke all on function private.builder_member_ok(uuid), private.builder_public_project(uuid) from public, anon, authenticated;
revoke all on function public.vote_builder_item(uuid, boolean), public.suggest_builder_feature(uuid, text, text), public.review_builder_suggestion(uuid, boolean, boolean),
  public.my_builder_activity(uuid), public.builder_project_insights(uuid) from public, anon;
grant execute on function public.vote_builder_item(uuid, boolean), public.suggest_builder_feature(uuid, text, text), public.review_builder_suggestion(uuid, boolean, boolean),
  public.my_builder_activity(uuid), public.builder_project_insights(uuid) to authenticated;

comment on table public.builder_votes is 'One vote per confirmed member per roadmap item. Never public; counts only, via get_public_builder.';
comment on table public.builder_suggestions is 'Ideas from members, private until the project owner approves. Owner and author read.';
