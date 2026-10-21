-- Business Mode 2.0, slice 2: Smart Bookings.
--
--   1. Availability. A Booking Action can open real times: the owner's weekly hours in their own
--      time zone, a slot length, a buffer, minimum notice and how far ahead people may book. The
--      horizon is capped by plan (Free 14 days, Plus 60, Pro 120).
--   2. Open times. Computed in the database from the hours, minus everything already requested or
--      confirmed across all of the owner's Booking Actions (with buffers), minus the notice window.
--      Daylight saving is handled by converting each local wall-clock time in the owner's zone.
--   3. Requests. request_booking() checks the time is still open, then makes the submission through
--      submit_profile_action() (so every existing check, rate limit and Lead still applies) and holds
--      the time. An exclusion constraint makes a double booking impossible, even at the same instant.
--   4. The owner decides on the request as before: Accepted or Completed confirms the time, Declined,
--      Spam or Archived frees it. Deleting the request frees it too.
--
-- Access goes through private.business_can(), like leads, so Business Teams widens it in one place.

create extension if not exists btree_gist with schema extensions;

alter table private.business_plan_limits add column booking_horizon_days integer not null default 14
  check (booking_horizon_days between 1 and 366);
update private.business_plan_limits set booking_horizon_days = case plan_code when 'free' then 14 when 'plus' then 60 else 120 end;

create or replace function public.my_business_limits()
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('plan', l.plan_code, 'can_note', l.can_note, 'can_export', l.can_export, 'funnel_days', l.funnel_days,
    'booking_horizon_days', l.booking_horizon_days)
  from private.business_plan_limits l where l.plan_code = private.member_plan(auth.uid())
$function$;

-- 1. Availability, one row per Booking Action. Written only by save_booking_availability().
create table public.booking_availability (
  action_id uuid primary key references public.profile_actions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  timezone text not null check (char_length(timezone) between 1 and 64),
  slot_minutes integer not null check (slot_minutes in (15, 20, 30, 45, 60, 90, 120, 180, 240)),
  buffer_minutes integer not null default 0 check (buffer_minutes in (0, 5, 10, 15, 30, 45, 60)),
  notice_hours integer not null default 12 check (notice_hours between 0 and 336),
  horizon_days integer not null default 14 check (horizon_days between 1 and 366),
  -- ISO weekday (1 = Monday) → up to three [start, end] local times, e.g. {"1":[["09:00","17:00"]]}.
  weekly jsonb not null default '{}'::jsonb check (jsonb_typeof(weekly) = 'object'),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp()
);
create index booking_availability_owner_idx on public.booking_availability (profile_id);
create trigger booking_availability_set_updated_at before update on public.booking_availability
  for each row execute function private.set_updated_at();

-- 2. Held and confirmed times. Written only by request_booking() and the status trigger.
create table public.business_bookings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action_id uuid not null references public.profile_actions(id) on delete cascade,
  submission_id uuid not null unique references public.action_submissions(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- The end plus the buffer: the time nobody else can take.
  held_until timestamptz not null,
  timezone text not null check (char_length(timezone) between 1 and 64),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'cancelled')),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  check (ends_at > starts_at and held_until >= ends_at),
  -- One owner is in one place at a time, across every Booking Action they run.
  constraint business_bookings_no_overlap exclude using gist (
    profile_id with =, tstzrange(starts_at, held_until, '[)') with &&
  ) where (status in ('requested', 'confirmed'))
);
create index business_bookings_owner_idx on public.business_bookings (profile_id, starts_at);
create index business_bookings_action_idx on public.business_bookings (action_id);
create trigger business_bookings_set_updated_at before update on public.business_bookings
  for each row execute function private.set_updated_at();

alter table public.booking_availability enable row level security;
alter table public.business_bookings enable row level security;
revoke all on public.booking_availability, public.business_bookings from public, anon, authenticated;
grant select on public.booking_availability, public.business_bookings to authenticated;
grant all on public.booking_availability, public.business_bookings to service_role;
create policy booking_availability_read on public.booking_availability for select to authenticated
  using (public.can_access_business(profile_id));
create policy business_bookings_read on public.business_bookings for select to authenticated
  using (public.can_access_business(profile_id));

-- Weekly hours are well formed: weekdays 1–7, at most three ordered, non-overlapping HH:MM ranges.
create function private.booking_weekly_ok(p_weekly jsonb)
returns boolean language plpgsql immutable set search_path='' as $function$
declare
  d text;
  r jsonb;
  v_prev time;
  v_start time;
  v_end time;
begin
  if p_weekly is null or jsonb_typeof(p_weekly) <> 'object' then return false; end if;
  for d in select k from jsonb_object_keys(p_weekly) k loop
    if d !~ '^[1-7]$' or jsonb_typeof(p_weekly->d) <> 'array' or jsonb_array_length(p_weekly->d) > 3 then return false; end if;
    v_prev := null;
    for r in select x from jsonb_array_elements(p_weekly->d) x loop
      if jsonb_typeof(r) <> 'array' or jsonb_array_length(r) <> 2
         or coalesce(r->>0, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or coalesce(r->>1, '') !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' then return false; end if;
      v_start := (r->>0)::time;
      v_end := case when r->>1 = '24:00' then '23:59:59'::time else (r->>1)::time end;
      if v_end <= v_start or (v_prev is not null and v_start < v_prev) then return false; end if;
      v_prev := v_end;
    end loop;
  end loop;
  return true;
end;
$function$;

-- The open times of one Booking Action, from now on. Everything held or confirmed by the same owner
-- blocks its time plus buffers, on any of their Booking Actions.
create function private.booking_open_slots(p_action_id uuid)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path='' as $function$
  with s as (
    select b.*, pg_catalog.statement_timestamp() as now_at from public.booking_availability b
    where b.action_id = p_action_id and b.enabled
  ), days as (
    select s.*, (s.now_at at time zone s.timezone)::date + g as d
    from s, pg_catalog.generate_series(0, s.horizon_days) g
  ), windows as (
    select days.*, (r->>0)::time as t0,
      case when r->>1 = '24:00' then interval '24 hours' else (r->>1)::time - time '00:00' end as t1
    from days, jsonb_array_elements(coalesce(days.weekly->(extract(isodow from days.d)::int)::text, '[]'::jsonb)) r
  ), slots as (
    select w.profile_id, w.slot_minutes, w.buffer_minutes, w.notice_hours, w.horizon_days, w.now_at,
      ((w.d + w.t0 + pg_catalog.make_interval(mins => n * (w.slot_minutes + w.buffer_minutes))) at time zone w.timezone) as st
    from windows w,
      pg_catalog.generate_series(0, greatest(-1, floor(
        (extract(epoch from (w.t1 - (w.t0 - time '00:00'))) / 60 - w.slot_minutes) / (w.slot_minutes + w.buffer_minutes))::int)) n
  )
  select distinct sl.st, sl.st + pg_catalog.make_interval(mins => sl.slot_minutes)
  from slots sl
  where sl.st >= sl.now_at + pg_catalog.make_interval(hours => sl.notice_hours)
    and sl.st < sl.now_at + pg_catalog.make_interval(days => sl.horizon_days)
    and not exists (
      select 1 from public.business_bookings x
      where x.profile_id = sl.profile_id and x.status in ('requested', 'confirmed')
        and tstzrange(x.starts_at - pg_catalog.make_interval(mins => sl.buffer_minutes), x.held_until, '[)')
            && tstzrange(sl.st, sl.st + pg_catalog.make_interval(mins => sl.slot_minutes + sl.buffer_minutes), '[)'))
  order by 1
  limit 600
$function$;
revoke all on function private.booking_open_slots(uuid) from public, anon, authenticated;
revoke all on function private.booking_weekly_ok(jsonb) from public, anon, authenticated;

-- An Action that takes visitors right now: published, in its window, on an enabled Mode of a published profile.
create function private.booking_action_live(p_action_id uuid)
returns boolean language sql stable security definer set search_path='' as $function$
  select exists (
    select 1 from public.profile_actions a
      join public.profile_modes m on m.id = a.mode_id
      join public.profiles p on p.id = m.profile_id
    where a.id = p_action_id and a.kind = 'booking' and a.status = 'published' and m.is_enabled and p.is_published
      and coalesce(a.config->>'offering', 'booking') = 'booking'
      and (a.starts_at is null or a.starts_at <= pg_catalog.statement_timestamp())
      and (a.ends_at is null or a.ends_at > pg_catalog.statement_timestamp()))
$function$;
revoke all on function private.booking_action_live(uuid) from public, anon, authenticated;

-- The owner sets a Booking Action's hours. The horizon is capped by plan here, not in the page.
create function public.save_booking_availability(p_action_id uuid, p_enabled boolean, p_timezone text, p_slot_minutes integer,
  p_buffer_minutes integer, p_notice_hours integer, p_horizon_days integer, p_weekly jsonb)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  a public.profile_actions;
  v_cap integer;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  select * into a from public.profile_actions where id = p_action_id;
  if not found or not private.business_can(a.profile_id, auth.uid()) then raise exception using errcode='P0002', message='action_not_found'; end if;
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
revoke all on function public.save_booking_availability(uuid,boolean,text,integer,integer,integer,integer,jsonb) from public, anon;
grant execute on function public.save_booking_availability(uuid,boolean,text,integer,integer,integer,integer,jsonb) to authenticated;

-- Visitors see the open times of a live Booking Action that has hours. Only free times, never who
-- holds the others.
create function public.get_booking_slots(p_action_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare b public.booking_availability;
begin
  if not private.booking_action_live(p_action_id) then return jsonb_build_object('enabled', false); end if;
  select * into b from public.booking_availability where action_id = p_action_id and enabled;
  if not found then return jsonb_build_object('enabled', false); end if;
  return jsonb_build_object('enabled', true, 'timezone', b.timezone, 'slot_minutes', b.slot_minutes,
    'slots', coalesce((select jsonb_agg(s.starts_at order by s.starts_at) from private.booking_open_slots(p_action_id) s), '[]'::jsonb));
end;
$function$;
revoke all on function public.get_booking_slots(uuid) from public;
grant execute on function public.get_booking_slots(uuid) to anon, authenticated, service_role;

-- A visitor asks for one open time. The time is checked again under a lock, the submission goes
-- through submit_profile_action() as every other one does, and the time is held in the same
-- transaction; if anything fails, nothing is kept.
create function public.request_booking(p_action_id uuid, p_submitter uuid, p_name text, p_email text, p_answers jsonb,
  p_idempotency_key text, p_ip_hash text, p_starts_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  b public.booking_availability;
  v_result jsonb;
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  v_existing uuid;
begin
  if not private.booking_action_live(p_action_id) then raise exception using errcode='P0002', message='action_unavailable'; end if;
  select * into b from public.booking_availability where action_id = p_action_id and enabled for update;
  if not found then raise exception using errcode='P0002', message='action_unavailable'; end if;
  -- A retried request returns the first result.
  select s.id into v_existing from public.action_submissions s where s.action_id = p_action_id and s.idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return public.submit_profile_action(p_action_id, p_submitter, p_name, p_email, v_answers, false, p_idempotency_key, p_ip_hash);
  end if;
  if p_starts_at is null or not exists (select 1 from private.booking_open_slots(p_action_id) s where s.starts_at = p_starts_at) then
    raise exception using errcode='23P01', message='slot_taken';
  end if;
  -- The chosen time is written into the request as the owner reads it, in their own zone.
  v_answers := (v_answers - 'preferredDates') || jsonb_build_object('preferredDates',
    pg_catalog.to_char(p_starts_at at time zone b.timezone, 'Dy DD Mon YYYY, HH24:MI') || ' (' || b.timezone || ')');
  v_result := public.submit_profile_action(p_action_id, p_submitter, p_name, p_email, v_answers, false, p_idempotency_key, p_ip_hash);
  if (v_result->>'id') is null then return v_result; end if;
  begin
    insert into public.business_bookings (profile_id, action_id, submission_id, starts_at, ends_at, held_until, timezone)
      values (b.profile_id, b.action_id, (v_result->>'id')::uuid, p_starts_at,
        p_starts_at + pg_catalog.make_interval(mins => b.slot_minutes),
        p_starts_at + pg_catalog.make_interval(mins => b.slot_minutes + b.buffer_minutes), b.timezone);
  exception when exclusion_violation then
    raise exception using errcode='23P01', message='slot_taken';
  end;
  return v_result || jsonb_build_object('starts_at', p_starts_at);
end;
$function$;
revoke all on function public.request_booking(uuid,uuid,text,text,jsonb,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.request_booking(uuid,uuid,text,text,jsonb,text,text,timestamptz) to service_role;

-- The owner's decision on the request moves its time: accepted confirms it, a no frees it.
create function private.on_submission_booking() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if new.kind <> 'booking' or new.status = old.status then return null; end if;
  update public.business_bookings set status = case
      when new.status in ('accepted', 'completed') then 'confirmed'
      when new.status in ('declined', 'spam', 'archived') then 'cancelled'
      else 'requested' end
    where submission_id = new.id;
  return null;
exception when exclusion_violation then
  raise exception using errcode='23P01', message='slot_taken';
end;
$function$;
create trigger action_submissions_business_booking after update of status on public.action_submissions
  for each row execute function private.on_submission_booking();

comment on table public.booking_availability is 'Weekly hours, slot length, buffer, notice and horizon for one Booking Action. Owner-read under RLS; written by save_booking_availability().';
comment on table public.business_bookings is 'Times held (requested) or confirmed for Booking Action requests. An exclusion constraint prevents overlaps per owner.';
