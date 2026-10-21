-- Business Mode 2.0, slice 5: Lead Routing.
--
--   1. Owners. A lead can be assigned to the owner or one active teammate. The owner and managers
--      assign anyone; a member can take an unassigned lead or let go of their own.
--   2. Rules. On a team (Pro), the owner sets how new leads are routed: off, or round robin across
--      active teammates (and the owner, if they want). A rule per Action sends that Action's leads
--      to one person first. Someone who left or lost access is skipped, never assigned.
--   3. Alerts. The server emails a teammate when a lead is assigned to them, once per assignment.
--      business_assignment_alert() hands it the address and marks it sent; it is service-role only.
--
-- Every assignment, automatic or by hand, is a line in the lead's history.

alter table public.business_leads add column assigned_to uuid references public.profiles(id) on delete set null;
alter table public.business_leads add column assigned_at timestamptz;
alter table public.business_leads add column assignment_alerted_at timestamptz;
create index business_leads_assignee_idx on public.business_leads (assigned_to, last_activity_at desc) where assigned_to is not null;

alter table public.business_lead_activities add column assignee_id uuid references public.profiles(id) on delete set null;
alter table public.business_lead_activities drop constraint business_lead_activities_kind_check;
alter table public.business_lead_activities add constraint business_lead_activities_kind_check
  check (kind in ('created','inquiry','stage','note','assigned'));
create index business_lead_activities_assignee_idx on public.business_lead_activities (assignee_id) where assignee_id is not null;

-- 1. Routing rules, one row per business. Written only by save_lead_routing().
create table public.business_lead_routing (
  business_id uuid primary key references public.profiles(id) on delete cascade,
  mode text not null default 'off' check (mode in ('off', 'round_robin')),
  include_owner boolean not null default false,
  -- Action id → user id, e.g. {"<action>":"<user>"}: that Action's leads go to that person first.
  rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object'),
  last_user_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default pg_catalog.statement_timestamp()
);
create index business_lead_routing_last_user_idx on public.business_lead_routing (last_user_id) where last_user_id is not null;
alter table public.business_lead_routing enable row level security;
revoke all on public.business_lead_routing from public, anon, authenticated;
grant select on public.business_lead_routing to authenticated;
grant all on public.business_lead_routing to service_role;
create policy business_lead_routing_read on public.business_lead_routing for select to authenticated
  using (public.can_access_business(business_id));

-- Who can own a business's leads right now: the owner, and active teammates while the team is open.
create function private.business_people(p_business uuid)
returns table (user_id uuid, role text, joined_at timestamptz)
language sql stable security definer set search_path='' as $function$
  select p_business, 'owner', null::timestamptz
  union all
  select m.user_id, m.role, m.accepted_at from public.business_team_members m
  where m.business_id = p_business and m.status = 'active' and private.business_role(p_business, m.user_id) is not null
$function$;
revoke all on function private.business_people(uuid) from public, anon, authenticated;

-- 2. Routing a new lead: the Action's rule if its person can still take it, else the next in the rotation.
create function private.route_new_lead() returns trigger language plpgsql security definer set search_path='' as $function$
declare
  r public.business_lead_routing;
  v_pick uuid;
begin
  if new.assigned_to is not null then return new; end if;
  select * into r from public.business_lead_routing where business_id = new.profile_id for update;
  if not found or r.mode = 'off' then return new; end if;
  if (select l.team_seats from private.business_plan_limits l where l.plan_code = private.member_plan(new.profile_id)) = 0 then return new; end if;
  if new.source_action_id is not null then
    select p.user_id into v_pick from private.business_people(new.profile_id) p
      where p.user_id::text = r.rules->>(new.source_action_id::text);
  end if;
  if v_pick is null then
    with pool as (
      select p.user_id, row_number() over (order by p.joined_at nulls first, p.user_id) as n
      from private.business_people(new.profile_id) p where p.role <> 'owner' or r.include_owner
    ), last as (select n from pool where user_id = r.last_user_id)
    select pool.user_id into v_pick from pool
      order by (pool.n <= coalesce((select n from last), 0)), pool.n limit 1;
    if v_pick is not null then
      update public.business_lead_routing set last_user_id = v_pick where business_id = r.business_id;
    end if;
  end if;
  if v_pick is not null then
    new.assigned_to := v_pick;
    new.assigned_at := new.created_at;
  end if;
  return new;
end;
$function$;
create trigger business_leads_route before insert on public.business_leads
  for each row execute function private.route_new_lead();

create function private.on_lead_routed() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if new.assigned_to is not null then
    insert into public.business_lead_activities (lead_id, profile_id, kind, assignee_id, created_at)
      values (new.id, new.profile_id, 'assigned', new.assigned_to, new.created_at + interval '1 millisecond');
  end if;
  return null;
end;
$function$;
create trigger business_leads_routed after insert on public.business_leads
  for each row execute function private.on_lead_routed();
revoke all on function private.route_new_lead(), private.on_lead_routed() from public, anon, authenticated;

-- The owner sets the rules. Each rule names one of their Business Actions and someone on the team.
create function public.save_lead_routing(p_mode text, p_include_owner boolean, p_rules jsonb)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_user uuid := auth.uid();
  v_rules jsonb := coalesce(p_rules, '{}'::jsonb);
begin
  if v_user is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if p_mode is null or p_mode not in ('off', 'round_robin') then raise exception using errcode='22023', message='invalid_mode'; end if;
  if jsonb_typeof(v_rules) <> 'object' or (select count(*) from jsonb_object_keys(v_rules)) > 50 then
    raise exception using errcode='22023', message='invalid_rules';
  end if;
  if coalesce((select l.team_seats from private.business_plan_limits l where l.plan_code = private.member_plan(v_user)), 0) = 0 then
    raise exception using errcode='P0001', message='teams_require_pro';
  end if;
  if exists (
    select 1 from jsonb_each_text(v_rules) e
    where e.key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or e.value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists (select 1 from public.profile_actions a join public.profile_modes m on m.id = a.mode_id
        where a.id = e.key::uuid and a.profile_id = v_user and m.slug = 'business')
      or not exists (select 1 from private.business_people(v_user) p where p.user_id = e.value::uuid)
  ) then
    raise exception using errcode='22023', message='invalid_rules';
  end if;
  insert into public.business_lead_routing (business_id, mode, include_owner, rules, updated_at)
    values (v_user, p_mode, coalesce(p_include_owner, false), v_rules, pg_catalog.statement_timestamp())
  on conflict (business_id) do update set mode = excluded.mode, include_owner = excluded.include_owner, rules = excluded.rules, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true);
end;
$function$;

-- 3. Assigning by hand. Owner and managers assign anyone on the team, or nobody; a member takes an
-- unassigned lead or lets go of their own.
create function public.assign_business_lead(p_lead_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  l public.business_leads;
  v_me uuid := auth.uid();
  v_role text;
begin
  if v_me is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  select * into l from public.business_leads where id = p_lead_id for update;
  v_role := case when found then private.business_role(l.profile_id, v_me) end;
  if v_role is null then raise exception using errcode='P0002', message='lead_not_found'; end if;
  if v_role = 'member' and not ((p_user_id = v_me and l.assigned_to is null) or (p_user_id is null and l.assigned_to = v_me)) then
    raise exception using errcode='42501', message='assign_not_allowed';
  end if;
  if p_user_id is not null and not exists (select 1 from private.business_people(l.profile_id) p where p.user_id = p_user_id) then
    raise exception using errcode='22023', message='not_on_team';
  end if;
  if l.assigned_to is not distinct from p_user_id then
    return jsonb_build_object('id', l.id, 'assigned_to', l.assigned_to, 'changed', false);
  end if;
  update public.business_leads set assigned_to = p_user_id, assigned_at = case when p_user_id is null then null else pg_catalog.statement_timestamp() end
    where id = l.id;
  insert into public.business_lead_activities (lead_id, profile_id, kind, assignee_id, actor_user_id)
    values (l.id, l.profile_id, 'assigned', p_user_id, v_me);
  return jsonb_build_object('id', l.id, 'assigned_to', p_user_id, 'changed', true);
end;
$function$;

-- The people a lead can go to, with names, for anyone who works this business.
create function public.business_people(p_business_id uuid)
returns jsonb language sql stable security definer set search_path='' as $function$
  select case when private.business_role(p_business_id, auth.uid()) is null then null else coalesce(jsonb_agg(jsonb_build_object(
      'user_id', p.user_id, 'role', p.role, 'name', coalesce(nullif(pr.display_name, ''), pr.username, 'Someone'), 'you', p.user_id = auth.uid())
      order by p.role <> 'owner', pr.display_name), '[]'::jsonb) end
  from private.business_people(p_business_id) p join public.profiles pr on pr.id = p.user_id
$function$;

-- The routing rules, for the owner's Team page.
create function public.my_lead_routing()
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce((select jsonb_build_object('mode', r.mode, 'include_owner', r.include_owner, 'rules', r.rules)
    from public.business_lead_routing r where r.business_id = auth.uid()),
    jsonb_build_object('mode', 'off', 'include_owner', false, 'rules', '{}'::jsonb))
  where auth.uid() is not null
$function$;

-- 4. Alerts. Once per assignment, for a teammate who can still see the lead.
create function public.business_assignment_alert(p_lead_id uuid default null, p_submission_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  l public.business_leads;
  v_email text;
begin
  select x.* into l from public.business_leads x
    where (p_lead_id is not null and x.id = p_lead_id)
       or (p_lead_id is null and p_submission_id is not null and x.id = (select a.lead_id from public.business_lead_activities a where a.submission_id = p_submission_id limit 1))
    for update;
  if not found or l.assigned_to is null or l.assigned_to = l.profile_id
     or (l.assignment_alerted_at is not null and l.assignment_alerted_at >= l.assigned_at)
     or private.business_role(l.profile_id, l.assigned_to) is null then
    return null;
  end if;
  select u.email into v_email from auth.users u where u.id = l.assigned_to and u.email_confirmed_at is not null;
  if v_email is null then return null; end if;
  update public.business_leads set assignment_alerted_at = pg_catalog.statement_timestamp() where id = l.id;
  return (select jsonb_build_object('email', v_email, 'lead_id', l.id, 'lead_name', coalesce(nullif(l.name, ''), 'A new lead'),
      'business_id', l.profile_id, 'business_name', coalesce(nullif(pm.settings->>'company', ''), p.display_name))
    from public.profiles p left join public.profile_modes pm on pm.profile_id = p.id and pm.slug = 'business' where p.id = l.profile_id);
end;
$function$;

-- Lead detail now names who a lead was assigned to.
create or replace function public.business_lead_detail(p_lead_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare
  l public.business_leads;
begin
  select * into l from public.business_leads where id = p_lead_id;
  if not found or not private.business_can(l.profile_id, auth.uid()) then return null; end if;
  return jsonb_build_object(
    'activity', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'lead_id', x.lead_id, 'kind', x.kind, 'submission_id', x.submission_id,
        'from_stage', x.from_stage, 'to_stage', x.to_stage, 'body', x.body, 'created_at', x.created_at,
        'actor', case when x.actor_user_id is null then null when x.actor_user_id = auth.uid() then 'You' else coalesce(nullif(p.display_name, ''), p.username) end,
        'assignee', case when x.kind <> 'assigned' or x.assignee_id is null then null when x.assignee_id = auth.uid() then 'you' else coalesce(nullif(q.display_name, ''), q.username) end)
        order by x.created_at desc)
      from (select * from public.business_lead_activities y where y.lead_id = l.id order by y.created_at desc limit 200) x
        left join public.profiles p on p.id = x.actor_user_id
        left join public.profiles q on q.id = x.assignee_id), '[]'::jsonb),
    'inquiries', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'action_id', s.action_id, 'kind', s.kind, 'answers', s.answers,
        'status', s.status, 'created_at', s.created_at, 'questions', coalesce(a.config->'questions', '[]'::jsonb)))
      from public.action_submissions s left join public.profile_actions a on a.id = s.action_id
      where s.profile_id = l.profile_id and s.id in (select y.submission_id from public.business_lead_activities y where y.lead_id = l.id and y.submission_id is not null)), '[]'::jsonb));
end;
$function$;

-- Removing a teammate hands their open leads back to nobody, so none sit with someone who can't see them.
create function private.on_member_removed() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if old.status = 'active' and new.status = 'removed' and old.user_id is not null then
    with freed as (
      update public.business_leads set assigned_to = null, assigned_at = null
        where profile_id = old.business_id and assigned_to = old.user_id and stage not in ('won','lost') returning id, profile_id
    )
    insert into public.business_lead_activities (lead_id, profile_id, kind, assignee_id)
      select id, profile_id, 'assigned', null from freed;
  end if;
  return null;
end;
$function$;
create trigger business_team_members_removed after update of status on public.business_team_members
  for each row execute function private.on_member_removed();
revoke all on function private.on_member_removed() from public, anon, authenticated;

revoke all on function public.save_lead_routing(text, boolean, jsonb), public.assign_business_lead(uuid, uuid), public.business_people(uuid),
  public.my_lead_routing() from public, anon;
grant execute on function public.save_lead_routing(text, boolean, jsonb), public.assign_business_lead(uuid, uuid), public.business_people(uuid),
  public.my_lead_routing() to authenticated;
revoke all on function public.business_assignment_alert(uuid, uuid) from public, anon, authenticated;
grant execute on function public.business_assignment_alert(uuid, uuid) to service_role;

comment on table public.business_lead_routing is 'Business Mode lead routing: off or round robin, plus per-Action rules. Applied by a trigger when a lead is created.';
