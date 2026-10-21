-- Business Mode 2.0, slice 4: Business Teams.
--
--   1. Seats. A Pro business can bring in up to five teammates (Free and Plus: none). The owner
--      invites by email with a private link (7 days, only a hash of the token is stored); the person
--      signs in with that confirmed email and accepts. Removing someone, or the owner leaving Pro,
--      closes the door at once: access is decided per request, never copied.
--   2. Roles. A member works the leads: stages, notes (on Plus or Pro), bookings coming up. A manager
--      also exports leads. Only the owner changes the page, Actions, hours, testimonials and the team.
--   3. One rule. private.business_can() now answers for teammates too, so every business table and
--      function that already uses it (leads, history, bookings, testimonials) widens in one place.
--      Owner-only steps use private.business_can_manage() or stay on the owner's own id.
--
-- Business data a teammate reads but has no row access to (the inquiry answers, Action titles,
-- names on upcoming bookings) comes from the business_* functions below, after the same check.

alter table private.business_plan_limits add column team_seats integer not null default 0
  check (team_seats between 0 and 50);
update private.business_plan_limits set team_seats = case plan_code when 'pro' then 5 else 0 end;

create or replace function public.my_business_limits()
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('plan', l.plan_code, 'can_note', l.can_note, 'can_export', l.can_export, 'funnel_days', l.funnel_days,
    'booking_horizon_days', l.booking_horizon_days, 'testimonials_shown', l.testimonials_shown, 'team_seats', l.team_seats)
  from private.business_plan_limits l where l.plan_code = private.member_plan(auth.uid())
$function$;

-- 1. Members. One row per invitation; it becomes the membership when accepted.
create table public.business_team_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  email_norm text not null check (char_length(email_norm) between 3 and 254),
  role text not null default 'member' check (role in ('manager', 'member')),
  status text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  token_hash bytea unique,
  expires_at timestamptz,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  accepted_at timestamptz,
  removed_at timestamptz,
  check (user_id is null or user_id <> business_id),
  check (status <> 'invited' or (token_hash is not null and expires_at is not null)),
  check (status <> 'active' or (user_id is not null and accepted_at is not null and token_hash is null)),
  check (status <> 'removed' or removed_at is not null)
);
create unique index business_team_members_email_uidx on public.business_team_members (business_id, email_norm) where status in ('invited', 'active');
create unique index business_team_members_user_uidx on public.business_team_members (business_id, user_id) where status = 'active';
create index business_team_members_user_idx on public.business_team_members (user_id) where user_id is not null;
create index business_team_members_business_idx on public.business_team_members (business_id, created_at desc);
create index business_team_members_inviter_idx on public.business_team_members (invited_by) where invited_by is not null;

-- 2. The rule. 'owner', or an active teammate's role while the owner's plan has seats and Business
-- Mode still exists. Anything else is no access.
create function private.business_role(p_business uuid, p_user uuid)
returns text language sql stable security definer set search_path='' as $function$
  select case
    when p_user is null or p_business is null then null
    when p_business = p_user then 'owner'
    else (select m.role from public.business_team_members m
      where m.business_id = p_business and m.user_id = p_user and m.status = 'active'
        and exists (select 1 from public.profile_modes pm where pm.profile_id = p_business and pm.slug = 'business')
        and (select l.team_seats from private.business_plan_limits l where l.plan_code = private.member_plan(p_business)) > 0)
  end
$function$;
revoke all on function private.business_role(uuid, uuid) from public, anon, authenticated;

create or replace function private.business_can(p_profile_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path='' as $function$
  select private.business_role(p_profile_id, p_user) is not null
$function$;

create function private.business_can_manage(p_profile_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path='' as $function$
  select coalesce(private.business_role(p_profile_id, p_user) in ('owner', 'manager'), false)
$function$;
revoke all on function private.business_can_manage(uuid, uuid) from public, anon, authenticated;

-- The owner's own rows never need the membership lookup.
drop policy business_leads_read on public.business_leads;
create policy business_leads_read on public.business_leads for select to authenticated
  using (profile_id = (select auth.uid()) or public.can_access_business(profile_id));
drop policy business_lead_activities_read on public.business_lead_activities;
create policy business_lead_activities_read on public.business_lead_activities for select to authenticated
  using (profile_id = (select auth.uid()) or public.can_access_business(profile_id));

-- Owner-only steps that business_can() used to cover by being owner-only.
create or replace function public.save_booking_availability(p_action_id uuid, p_enabled boolean, p_timezone text, p_slot_minutes integer,
  p_buffer_minutes integer, p_notice_hours integer, p_horizon_days integer, p_weekly jsonb)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  a public.profile_actions;
  v_cap integer;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  select * into a from public.profile_actions where id = p_action_id;
  if not found or a.profile_id <> auth.uid() then raise exception using errcode='P0002', message='action_not_found'; end if;
  if a.kind <> 'booking' or coalesce(a.config->>'offering', 'booking') <> 'booking' then
    raise exception using errcode='22023', message='not_a_booking';
  end if;
  if p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_timezone) then
    raise exception using errcode='22023', message='invalid_timezone';
  end if;
  if not private.booking_weekly_ok(p_weekly) then raise exception using errcode='22023', message='invalid_hours'; end if;
  select l.booking_horizon_days into v_cap from private.business_plan_limits l where l.plan_code = private.member_plan(a.profile_id);
  if p_horizon_days is null or p_horizon_days < 1 or p_horizon_days > coalesce(v_cap, 14) then
    raise exception using errcode='22023', message='horizon_over_plan';
  end if;
  insert into public.booking_availability (action_id, profile_id, enabled, timezone, slot_minutes, buffer_minutes, notice_hours, horizon_days, weekly)
    values (a.id, a.profile_id, coalesce(p_enabled, true), p_timezone, p_slot_minutes, p_buffer_minutes, p_notice_hours, p_horizon_days, p_weekly)
  on conflict (action_id) do update set enabled = excluded.enabled, timezone = excluded.timezone, slot_minutes = excluded.slot_minutes,
    buffer_minutes = excluded.buffer_minutes, notice_hours = excluded.notice_hours, horizon_days = excluded.horizon_days, weekly = excluded.weekly;
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.create_testimonial_request(p_lead_id uuid default null, p_name text default '')
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_user uuid := auth.uid();
  v_name text := pg_catalog.left(pg_catalog.btrim(coalesce(p_name, '')), 80);
  v_token text;
  v_id uuid;
begin
  if v_user is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if not exists (select 1 from public.profile_modes m where m.profile_id = v_user and m.slug = 'business') then
    raise exception using errcode='P0002', message='business_not_found';
  end if;
  if p_lead_id is not null then
    -- The owner's own lead only: a link is made for the business that sends it.
    select case when v_name = '' then l.name else v_name end into v_name from public.business_leads l
      where l.id = p_lead_id and l.profile_id = v_user;
    if not found then raise exception using errcode='P0002', message='lead_not_found'; end if;
  end if;
  if (select count(*) from public.business_testimonial_requests r where r.profile_id = v_user
      and r.created_at > pg_catalog.statement_timestamp() - interval '1 day') >= 40 then
    raise exception using errcode='54000', message='rate_limited';
  end if;
  v_token := pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.business_testimonial_requests (profile_id, lead_id, name, token_hash, expires_at)
    values (v_user, p_lead_id, coalesce(v_name, ''), extensions.digest(v_token, 'sha256'), pg_catalog.statement_timestamp() + interval '30 days')
    returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token);
end;
$function$;

create or replace function public.revoke_testimonial_request(p_request_id uuid)
returns boolean language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  update public.business_testimonial_requests r set revoked_at = pg_catalog.statement_timestamp()
    where r.id = p_request_id and r.profile_id = auth.uid() and r.used_at is null and r.revoked_at is null;
  return found;
end;
$function$;

create or replace function public.set_testimonial_status(p_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if p_status not in ('approved', 'hidden', 'pending') then raise exception using errcode='22023', message='invalid_status'; end if;
  update public.business_testimonials t set status = p_status,
      approved_at = case when p_status = 'approved' then coalesce(t.approved_at, pg_catalog.statement_timestamp()) else t.approved_at end
    where t.id = p_id and t.profile_id = auth.uid();
  return found;
end;
$function$;

create or replace function public.delete_testimonial(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  delete from public.business_testimonials t where t.id = p_id and t.profile_id = auth.uid();
  return found;
end;
$function$;

-- Testimonial requests and testimonials stay with the owner.
drop policy business_testimonial_requests_read on public.business_testimonial_requests;
create policy business_testimonial_requests_read on public.business_testimonial_requests for select to authenticated
  using (profile_id = (select auth.uid()));
drop policy business_testimonials_read on public.business_testimonials;
create policy business_testimonials_read on public.business_testimonials for select to authenticated
  using (profile_id = (select auth.uid()));

alter table public.business_team_members enable row level security;
revoke all on public.business_team_members from public, anon, authenticated;
grant select (id, business_id, user_id, email, role, status, expires_at, created_at, accepted_at, removed_at) on public.business_team_members to authenticated;
grant all on public.business_team_members to service_role;
-- The owner sees their team; a teammate sees their own memberships.
create policy business_team_members_read on public.business_team_members for select to authenticated
  using (business_id = (select auth.uid()) or user_id = (select auth.uid()));

-- 3. The owner's side.
create function public.invite_business_member(p_email text, p_role text default 'member')
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_user uuid := auth.uid();
  v_email text := pg_catalog.btrim(coalesce(p_email, ''));
  v_norm text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_seats integer;
  v_token text;
  v_id uuid;
begin
  if v_user is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if p_role is null or p_role not in ('manager', 'member') then raise exception using errcode='22023', message='invalid_role'; end if;
  if pg_catalog.char_length(v_norm) not between 3 and 254 or v_norm !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using errcode='22023', message='invalid_email';
  end if;
  if not exists (select 1 from public.profile_modes m where m.profile_id = v_user and m.slug = 'business') then
    raise exception using errcode='P0002', message='business_not_found';
  end if;
  if exists (select 1 from auth.users u where u.id = v_user and pg_catalog.lower(u.email) = v_norm) then
    raise exception using errcode='22023', message='own_email';
  end if;
  -- One invite at a time per business, so two presses can't take the last seat twice.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('business-team:'||v_user::text, 0));
  select l.team_seats into v_seats from private.business_plan_limits l where l.plan_code = private.member_plan(v_user);
  if coalesce(v_seats, 0) = 0 then raise exception using errcode='P0001', message='teams_require_pro'; end if;
  if exists (select 1 from public.business_team_members m where m.business_id = v_user and m.email_norm = v_norm and m.status = 'active') then
    raise exception using errcode='23505', message='already_member';
  end if;
  if (select count(*) from public.business_team_members m where m.business_id = v_user and m.created_at > pg_catalog.statement_timestamp() - interval '1 day') >= 20 then
    raise exception using errcode='54000', message='rate_limited';
  end if;
  -- A lapsed invite for the same email is replaced; a live one gets a fresh link.
  update public.business_team_members m set status = 'removed', removed_at = pg_catalog.statement_timestamp(), token_hash = null
    where m.business_id = v_user and m.email_norm = v_norm and m.status = 'invited';
  if (select count(*) from public.business_team_members m where m.business_id = v_user
      and (m.status = 'active' or (m.status = 'invited' and m.expires_at > pg_catalog.statement_timestamp()))) >= v_seats then
    raise exception using errcode='P0001', message='no_seats';
  end if;
  v_token := pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.business_team_members (business_id, email, email_norm, role, token_hash, expires_at, invited_by)
    values (v_user, v_email, v_norm, p_role, extensions.digest(v_token, 'sha256'), pg_catalog.statement_timestamp() + interval '7 days', v_user)
    returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token);
end;
$function$;

create function public.set_business_member_role(p_member_id uuid, p_role text)
returns boolean language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if p_role is null or p_role not in ('manager', 'member') then raise exception using errcode='22023', message='invalid_role'; end if;
  update public.business_team_members m set role = p_role
    where m.id = p_member_id and m.business_id = auth.uid() and m.status in ('invited', 'active');
  return found;
end;
$function$;

-- The owner removes someone, or a teammate leaves. Either way the access ends now.
create function public.remove_business_member(p_member_id uuid)
returns boolean language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  update public.business_team_members m set status = 'removed', removed_at = pg_catalog.statement_timestamp(), token_hash = null
    where m.id = p_member_id and (m.business_id = auth.uid() or m.user_id = auth.uid()) and m.status in ('invited', 'active');
  return found;
end;
$function$;

-- The owner's team page: seats, and who is in or invited, with names for those who joined.
create function public.my_business_team()
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object(
    'seats', coalesce((select l.team_seats from private.business_plan_limits l where l.plan_code = private.member_plan(auth.uid())), 0),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'email', m.email, 'role', m.role, 'status', m.status,
        'expires_at', m.expires_at, 'created_at', m.created_at, 'accepted_at', m.accepted_at,
        'display_name', p.display_name, 'username', p.username) order by m.status, m.created_at)
      from public.business_team_members m left join public.profiles p on p.id = m.user_id
      where m.business_id = auth.uid() and (m.status = 'active' or (m.status = 'invited' and m.expires_at > pg_catalog.statement_timestamp()))), '[]'::jsonb))
  where auth.uid() is not null
$function$;

-- 4. The invited person's side. The page shows who invited them and the email the invite is for.
create function public.get_business_invite(p_token text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('business_name', p.display_name, 'business_username', p.username, 'email', m.email, 'role', m.role,
      'company', coalesce(pm.settings->>'company', ''))
  from public.business_team_members m
    join public.profiles p on p.id = m.business_id
    left join public.profile_modes pm on pm.profile_id = m.business_id and pm.slug = 'business'
  where p_token is not null and pg_catalog.char_length(p_token) between 20 and 64
    and m.token_hash = extensions.digest(p_token, 'sha256')
    and m.status = 'invited' and m.expires_at > pg_catalog.statement_timestamp()
$function$;

-- Accepting needs the confirmed email the invite was sent to, and a free seat.
create function public.accept_business_invite(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_user uuid := auth.uid();
  m public.business_team_members;
  v_seats integer;
begin
  if v_user is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  select * into m from public.business_team_members x
    where p_token is not null and x.token_hash = extensions.digest(p_token, 'sha256') for update;
  if not found or m.status <> 'invited' or m.expires_at <= pg_catalog.statement_timestamp() then
    raise exception using errcode='P0002', message='invite_unavailable';
  end if;
  if m.business_id = v_user then raise exception using errcode='22023', message='own_business'; end if;
  if not exists (select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null and pg_catalog.lower(u.email) = m.email_norm) then
    raise exception using errcode='42501', message='wrong_account';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('business-team:'||m.business_id::text, 0));
  select l.team_seats into v_seats from private.business_plan_limits l where l.plan_code = private.member_plan(m.business_id);
  if (select count(*) from public.business_team_members x where x.business_id = m.business_id and x.status = 'active') >= coalesce(v_seats, 0) then
    raise exception using errcode='P0001', message='no_seats';
  end if;
  update public.business_team_members set user_id = v_user, status = 'active', accepted_at = pg_catalog.statement_timestamp(),
      token_hash = null, expires_at = null
    where id = m.id;
  return jsonb_build_object('business_id', m.business_id, 'role', m.role);
end;
$function$;

-- 5. A teammate's side: the businesses they work for, and one business's workspace.
create function public.my_business_teams()
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_agg(jsonb_build_object('member_id', m.id, 'business_id', m.business_id, 'role', m.role,
      'display_name', p.display_name, 'username', p.username, 'company', coalesce(pm.settings->>'company', ''),
      'open', private.business_role(m.business_id, auth.uid()) is not null) order by p.display_name), '[]'::jsonb)
  from public.business_team_members m
    join public.profiles p on p.id = m.business_id
    left join public.profile_modes pm on pm.profile_id = m.business_id and pm.slug = 'business'
  where m.user_id = auth.uid() and m.status = 'active'
$function$;

create function public.business_workspace(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare
  v_role text := private.business_role(p_business_id, auth.uid());
begin
  if v_role is null then return null; end if;
  return (select jsonb_build_object(
    'business_id', p.id, 'display_name', p.display_name, 'username', p.username, 'role', v_role,
    'company', coalesce(pm.settings->>'company', ''),
    'limits', (select jsonb_build_object('plan', l.plan_code, 'can_note', l.can_note, 'can_export', l.can_export and v_role in ('owner', 'manager'))
      from private.business_plan_limits l where l.plan_code = private.member_plan(p.id)),
    'actions', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'kind', a.kind) order by a.sort_order, a.created_at)
      from public.profile_actions a where a.mode_id = pm.id), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'action_id', b.action_id, 'submission_id', b.submission_id,
        'starts_at', b.starts_at, 'ends_at', b.ends_at, 'timezone', b.timezone, 'status', b.status,
        'name', coalesce(nullif(s.name, ''), s.email, 'Someone'), 'title', a.title) order by b.starts_at)
      from (select * from public.business_bookings x where x.profile_id = p.id and x.status <> 'cancelled' and x.ends_at > pg_catalog.statement_timestamp()
        order by x.starts_at limit 50) b
        join public.action_submissions s on s.id = b.submission_id
        join public.profile_actions a on a.id = b.action_id), '[]'::jsonb))
  from public.profiles p left join public.profile_modes pm on pm.profile_id = p.id and pm.slug = 'business'
  where p.id = p_business_id);
end;
$function$;

-- One lead's history and the inquiries behind it, for anyone who works the lead. Teammates have no
-- row access to the inquiries themselves; this hands over only the ones linked to this lead.
create function public.business_lead_detail(p_lead_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare
  l public.business_leads;
begin
  select * into l from public.business_leads where id = p_lead_id;
  if not found or not private.business_can(l.profile_id, auth.uid()) then return null; end if;
  return jsonb_build_object(
    'activity', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'lead_id', x.lead_id, 'kind', x.kind, 'submission_id', x.submission_id,
        'from_stage', x.from_stage, 'to_stage', x.to_stage, 'body', x.body, 'created_at', x.created_at,
        'actor', case when x.actor_user_id is null then null when x.actor_user_id = auth.uid() then 'You' else coalesce(nullif(p.display_name, ''), p.username) end)
        order by x.created_at desc)
      from (select * from public.business_lead_activities y where y.lead_id = l.id order by y.created_at desc limit 200) x
        left join public.profiles p on p.id = x.actor_user_id), '[]'::jsonb),
    'inquiries', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'action_id', s.action_id, 'kind', s.kind, 'answers', s.answers,
        'status', s.status, 'created_at', s.created_at, 'questions', coalesce(a.config->'questions', '[]'::jsonb)))
      from public.action_submissions s left join public.profile_actions a on a.id = s.action_id
      where s.profile_id = l.profile_id and s.id in (select y.submission_id from public.business_lead_activities y where y.lead_id = l.id and y.submission_id is not null)), '[]'::jsonb));
end;
$function$;

revoke all on function public.invite_business_member(text, text), public.set_business_member_role(uuid, text), public.remove_business_member(uuid),
  public.my_business_team(), public.accept_business_invite(text), public.my_business_teams(), public.business_workspace(uuid),
  public.business_lead_detail(uuid) from public, anon;
grant execute on function public.invite_business_member(text, text), public.set_business_member_role(uuid, text), public.remove_business_member(uuid),
  public.my_business_team(), public.accept_business_invite(text), public.my_business_teams(), public.business_workspace(uuid),
  public.business_lead_detail(uuid) to authenticated;
revoke all on function public.get_business_invite(text) from public;
grant execute on function public.get_business_invite(text) to anon, authenticated, service_role;

comment on table public.business_team_members is 'Business Teams: invitations and memberships. Access is private.business_role(), checked per request against the owner''s plan.';
