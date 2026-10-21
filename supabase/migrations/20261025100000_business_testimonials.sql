-- Business Mode 2.0, slice 3: Testimonials.
--
--   1. Requests. The owner asks a client for a testimonial with a private, single-use link (30 days),
--      optionally tied to one of their leads. Only a hash of the link's token is stored.
--   2. Testimonials. The client writes their words, an optional rating, and how they want to be
--      named, and agrees to be shown. Nothing is public until the owner approves it. A testimonial
--      from a lead the owner had marked Won when it was written is shown as a verified client.
--   3. The page. Approved testimonials show on Business Mode, newest approval first, as many as the
--      plan shows (Free 3, Plus 24, Pro 60). There is no open form: every testimonial was invited.
--
-- Access goes through private.business_can(), like leads, so Business Teams widens it in one place.

alter table private.business_plan_limits add column testimonials_shown integer not null default 3
  check (testimonials_shown between 0 and 200);
update private.business_plan_limits set testimonials_shown = case plan_code when 'free' then 3 when 'plus' then 24 else 60 end;

create or replace function public.my_business_limits()
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('plan', l.plan_code, 'can_note', l.can_note, 'can_export', l.can_export, 'funnel_days', l.funnel_days,
    'booking_horizon_days', l.booking_horizon_days, 'testimonials_shown', l.testimonials_shown)
  from private.business_plan_limits l where l.plan_code = private.member_plan(auth.uid())
$function$;

-- 1. Requests.
create table public.business_testimonial_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  lead_id uuid references public.business_leads(id) on delete set null,
  name text not null default '' check (char_length(name) <= 80),
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp()
);
create index business_testimonial_requests_owner_idx on public.business_testimonial_requests (profile_id, created_at desc);
create index business_testimonial_requests_lead_idx on public.business_testimonial_requests (lead_id) where lead_id is not null;

-- 2. Testimonials.
create table public.business_testimonials (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid unique references public.business_testimonial_requests(id) on delete set null,
  lead_id uuid references public.business_leads(id) on delete set null,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 80),
  author_role text not null default '' check (char_length(author_role) <= 80),
  author_company text not null default '' check (char_length(author_company) <= 100),
  body text not null check (char_length(btrim(body)) between 20 and 600),
  rating integer check (rating between 1 and 5),
  verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  approved_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  check (status <> 'approved' or approved_at is not null)
);
create index business_testimonials_owner_idx on public.business_testimonials (profile_id, status, approved_at desc);
create index business_testimonials_lead_idx on public.business_testimonials (lead_id) where lead_id is not null;
create trigger business_testimonials_set_updated_at before update on public.business_testimonials
  for each row execute function private.set_updated_at();

alter table public.business_testimonial_requests enable row level security;
alter table public.business_testimonials enable row level security;
revoke all on public.business_testimonial_requests, public.business_testimonials from public, anon, authenticated;
grant select (id, profile_id, lead_id, name, expires_at, used_at, revoked_at, created_at) on public.business_testimonial_requests to authenticated;
grant select on public.business_testimonials to authenticated;
grant all on public.business_testimonial_requests, public.business_testimonials to service_role;
create policy business_testimonial_requests_read on public.business_testimonial_requests for select to authenticated
  using (public.can_access_business(profile_id));
create policy business_testimonials_read on public.business_testimonials for select to authenticated
  using (public.can_access_business(profile_id));

-- The owner makes a link. The token is returned once and only its hash is kept.
create function public.create_testimonial_request(p_lead_id uuid default null, p_name text default '')
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
    select case when v_name = '' then l.name else v_name end into v_name from public.business_leads l
      where l.id = p_lead_id and private.business_can(l.profile_id, v_user);
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
revoke all on function public.create_testimonial_request(uuid, text) from public, anon;
grant execute on function public.create_testimonial_request(uuid, text) to authenticated;

create function public.revoke_testimonial_request(p_request_id uuid)
returns boolean language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  update public.business_testimonial_requests r set revoked_at = pg_catalog.statement_timestamp()
    where r.id = p_request_id and private.business_can(r.profile_id, auth.uid()) and r.used_at is null and r.revoked_at is null;
  return found;
end;
$function$;
revoke all on function public.revoke_testimonial_request(uuid) from public, anon;
grant execute on function public.revoke_testimonial_request(uuid) to authenticated;

-- What the invite page may show for a live link: who asks, and the name it was made for.
create function public.get_testimonial_request(p_token text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('name', r.name, 'owner_name', p.display_name, 'owner_username', p.username,
      'company', coalesce(m.settings->>'company', ''))
  from public.business_testimonial_requests r
    join public.profiles p on p.id = r.profile_id
    left join public.profile_modes m on m.profile_id = r.profile_id and m.slug = 'business'
  where p_token is not null and pg_catalog.char_length(p_token) between 20 and 64
    and r.token_hash = extensions.digest(p_token, 'sha256')
    and r.used_at is null and r.revoked_at is null and r.expires_at > pg_catalog.statement_timestamp()
$function$;
revoke all on function public.get_testimonial_request(text) from public;
grant execute on function public.get_testimonial_request(text) to anon, authenticated, service_role;

-- The client's words, through a live link, once. Called by the server route after its own checks.
create function public.submit_testimonial(p_token text, p_name text, p_role text, p_company text, p_body text, p_rating integer, p_consent boolean)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  r public.business_testimonial_requests;
  v_body text := pg_catalog.btrim(coalesce(p_body, ''));
  v_name text := pg_catalog.btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  select * into r from public.business_testimonial_requests
    where p_token is not null and token_hash = extensions.digest(p_token, 'sha256') for update;
  if not found or r.used_at is not null or r.revoked_at is not null or r.expires_at <= pg_catalog.statement_timestamp() then
    raise exception using errcode='P0002', message='request_unavailable';
  end if;
  if coalesce(p_consent, false) is false then raise exception using errcode='22023', message='consent_required'; end if;
  if pg_catalog.char_length(v_name) not between 1 and 80 then raise exception using errcode='22023', message='name_required'; end if;
  if pg_catalog.char_length(v_body) not between 20 and 600 then raise exception using errcode='22023', message='body_length'; end if;
  if p_rating is not null and p_rating not between 1 and 5 then raise exception using errcode='22023', message='invalid_rating'; end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_role, ''))) > 80 or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_company, ''))) > 100 then
    raise exception using errcode='22023', message='too_long';
  end if;
  insert into public.business_testimonials (profile_id, request_id, lead_id, author_name, author_role, author_company, body, rating, verified)
    values (r.profile_id, r.id, r.lead_id, v_name, pg_catalog.btrim(coalesce(p_role, '')), pg_catalog.btrim(coalesce(p_company, '')), v_body, p_rating,
      exists (select 1 from public.business_leads l where l.id = r.lead_id and l.stage = 'won'))
    returning id into v_id;
  update public.business_testimonial_requests set used_at = pg_catalog.statement_timestamp() where id = r.id;
  return jsonb_build_object('id', v_id);
end;
$function$;
revoke all on function public.submit_testimonial(text, text, text, text, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.submit_testimonial(text, text, text, text, text, integer, boolean) to service_role;

-- The owner approves, hides or deletes. Only approved testimonials are public.
create function public.set_testimonial_status(p_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if p_status not in ('approved', 'hidden', 'pending') then raise exception using errcode='22023', message='invalid_status'; end if;
  update public.business_testimonials t set status = p_status,
      approved_at = case when p_status = 'approved' then coalesce(t.approved_at, pg_catalog.statement_timestamp()) else t.approved_at end
    where t.id = p_id and private.business_can(t.profile_id, auth.uid());
  return found;
end;
$function$;
revoke all on function public.set_testimonial_status(uuid, text) from public, anon;
grant execute on function public.set_testimonial_status(uuid, text) to authenticated;

create function public.delete_testimonial(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  delete from public.business_testimonials t where t.id = p_id and private.business_can(t.profile_id, auth.uid());
  return found;
end;
$function$;
revoke all on function public.delete_testimonial(uuid) from public, anon;
grant execute on function public.delete_testimonial(uuid) to authenticated;

-- 3. The page: approved testimonials of a live Business Mode, as many as the owner's plan shows.
create function public.get_public_testimonials(p_username text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'author_name', t.author_name, 'author_role', t.author_role,
      'author_company', t.author_company, 'body', t.body, 'rating', t.rating, 'verified', t.verified) order by t.approved_at desc), '[]'::jsonb)
  from (
    select t.* from public.profiles p
      join public.profile_modes m on m.profile_id = p.id and m.slug = 'business' and m.is_enabled
      join public.business_testimonials t on t.profile_id = p.id and t.status = 'approved'
    where p.username = pg_catalog.lower(pg_catalog.btrim(p_username)) and p.is_published
    order by t.approved_at desc
    limit (select l.testimonials_shown from public.profiles p2 join private.business_plan_limits l on l.plan_code = private.member_plan(p2.id)
           where p2.username = pg_catalog.lower(pg_catalog.btrim(p_username)))
  ) t
$function$;
revoke all on function public.get_public_testimonials(text) from public;
grant execute on function public.get_public_testimonials(text) to anon, authenticated, service_role;

comment on table public.business_testimonial_requests is 'Single-use testimonial invite links (hash only). Owner-read under RLS; written by create/revoke_testimonial_request and submit_testimonial.';
comment on table public.business_testimonials is 'Invited client testimonials. Public only when approved, via get_public_testimonials, capped by plan.';
