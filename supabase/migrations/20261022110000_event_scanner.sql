-- Event Mode: the organizer's door scanner, and deleting events that are over.
--
-- The scanner reads a guest's door pass (signed by the app) and asks the database once: the check-in
-- is decided under the event's row lock, so two phones scanning the same pass at the same moment get
-- one "checked in" and one "already checked in". Every scan is recorded for the organizer.

-- 1. What each scan found. Owners read their own; only the scan function writes.
create table public.event_scans (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  registration_id uuid references public.event_registrations(id) on delete set null,
  result text not null check (result in ('checked_in','already_checked_in','not_going','other_event','invalid','not_open','closed')),
  created_at timestamptz not null default pg_catalog.statement_timestamp()
);
create index event_scans_event_idx on public.event_scans (event_id, created_at desc);
create index event_scans_owner_idx on public.event_scans (profile_id, created_at desc);
create index event_scans_registration_idx on public.event_scans (registration_id) where registration_id is not null;

alter table public.event_scans enable row level security;
revoke all on public.event_scans from public, anon, authenticated;
grant select on public.event_scans to authenticated;
grant all on public.event_scans to service_role;
create policy event_scans_owner_read on public.event_scans for select to authenticated
  using (profile_id = (select auth.uid()));

-- 2. One scan at this event's door. The app has checked the pass signature; the version is checked
-- here, so a pass voided by a newer link stops working. A pass for someone else's event says nothing
-- about that guest.
create function public.owner_scan_event_pass(p_event_id uuid, p_registration_id uuid, p_token_version smallint)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  e public.events;
  r public.event_registrations;
  v_uid uuid := (select auth.uid());
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_result text;
  v_other text;
  v_connected boolean := false;
begin
  select * into e from public.events where id = p_event_id and profile_id = v_uid for update;
  if v_uid is null or not found then raise exception using errcode='P0002', message='event_not_found'; end if;
  if e.status = 'cancelled' then raise exception using errcode='P0001', message='event_cancelled'; end if;
  if (select count(*) from public.event_scans s where s.profile_id = v_uid and s.created_at > v_now - interval '1 minute') >= 120 then
    raise exception using errcode='P0001', message='rate_limited';
  end if;

  select * into r from public.event_registrations where id = p_registration_id;
  if not found or r.profile_id <> v_uid or r.token_version <> p_token_version then
    v_result := 'invalid';
    r := null;
  elsif r.event_id <> e.id then
    v_result := 'other_event';
    select x.title into v_other from public.events x where x.id = r.event_id;
  else
    select * into r from public.event_registrations where id = p_registration_id for update;
    v_result := case private.event_check_in_window(e, v_now) when 'soon' then 'not_open' when 'closed' then 'closed' end;
    if v_result is null then
      if r.status <> 'confirmed' then v_result := 'not_going';
      elsif r.checked_in_at is not null then v_result := 'already_checked_in';
      else
        update public.event_registrations set checked_in_at = v_now where id = r.id;
        perform private.connect_checked_in_guest(r.id);
        v_result := 'checked_in';
      end if;
    end if;
    select * into r from public.event_registrations where id = p_registration_id;
    v_connected := r.connection_id is not null;
  end if;

  insert into public.event_scans(event_id, profile_id, registration_id, result) values (e.id, v_uid, r.id, v_result);
  return jsonb_build_object(
    'result', v_result,
    'guest', case when v_result in ('invalid', 'other_event') then null else jsonb_build_object(
      'id', r.id, 'name', r.name, 'status', r.status, 'checked_in_at', r.checked_in_at, 'connected', v_connected) end,
    'other_event', v_other,
    'checked_in', (select count(*) from public.event_registrations x where x.event_id = e.id and x.status = 'confirmed' and x.checked_in_at is not null),
    'going', e.confirmed_count);
end;
$function$;

revoke all on function public.owner_scan_event_pass(uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.owner_scan_event_pass(uuid, uuid, smallint) to authenticated;

-- 3. Deleting. An event that is cancelled or over can go, with its guest list; one that is still
-- coming with people on the list is cancelled first, so their links say so rather than vanish.
-- Connections made at the door stay (their encounter keeps the where-you-met snapshot).
drop policy events_owner_delete_empty on public.events;
create policy events_owner_delete_finished on public.events as restrictive for delete to authenticated
  using (status = 'cancelled' or ends_at <= pg_catalog.statement_timestamp()
    or not exists(select 1 from public.event_registrations r where r.event_id = events.id));

comment on table public.event_scans is 'Door scans at an event: what each scan found. Written only by owner_scan_event_pass; owners read their own.';
