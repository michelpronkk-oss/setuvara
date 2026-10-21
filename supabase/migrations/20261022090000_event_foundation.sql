-- Event Mode 2.0, slice 1: events and registrations (the RSVP base).
--
-- An organizer's Event Mode can hold many independent events. Each has its own page at
-- /e/<short_id>/<slug>, a schedule in its own time zone, an optional place and capacity, and a
-- lifecycle that follows the clock (registration closes, the event goes live, then ends) without a
-- cron. Guests register through one service-role function that locks the event row, so capacity,
-- the waitlist and promotions can never race. Guests manage their registration with a signed link
-- (HMAC of the registration id and token_version, made by the app; nothing secret is stored here).
--
-- Nothing existing changes: Form Actions people used for RSVPs keep working and keep their data.

-- 1. Short public ids: 8 Base62 characters from a CSPRNG, like Mode share links.
create function private.event_short_id()
returns text language plpgsql volatile security definer set search_path='' as $function$
declare
  v_alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  v_id text;
  v_bytes bytea;
  v_byte int;
  i int;
begin
  loop
    v_id := '';
    while pg_catalog.length(v_id) < 8 loop
      v_bytes := extensions.gen_random_bytes(16);
      for i in 0 .. 15 loop
        v_byte := pg_catalog.get_byte(v_bytes, i);
        -- 248 = 4 * 62: rejection sampling keeps every character equally likely.
        if v_byte < 248 and pg_catalog.length(v_id) < 8 then
          v_id := v_id || pg_catalog.substr(v_alphabet, (v_byte % 62) + 1, 1);
        end if;
      end loop;
    end loop;
    exit when not exists(select 1 from public.events e where e.short_id = v_id);
  end loop;
  return v_id;
end;
$function$;

-- 2. Events.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  mode_id uuid not null references public.profile_modes(id) on delete cascade,
  short_id text not null unique check (short_id ~ '^[0-9A-Za-z]{8}$'),
  slug text not null default '' check (char_length(slug) <= 60 and slug ~ '^([a-z0-9]+(-[a-z0-9]+)*)?$'),
  status text not null default 'draft' check (status in ('draft','published','cancelled')),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  summary text not null default '' check (char_length(summary) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null check (char_length(timezone) between 1 and 64),
  venue_name text not null default '' check (char_length(venue_name) <= 120),
  address text not null default '' check (char_length(address) <= 240),
  city text not null default '' check (char_length(city) <= 80),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  online_url text check (online_url is null or (char_length(online_url) <= 300 and online_url ~* '^https://[^\s/]+\.[^\s]+$')),
  capacity integer check (capacity is null or capacity between 1 and 10000),
  waitlist_enabled boolean not null default true,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  -- Kept by the registration functions under the event's row lock. Owners can't write them.
  confirmed_count integer not null default 0 check (confirmed_count >= 0),
  waitlist_count integer not null default 0 check (waitlist_count >= 0),
  published_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '14 days'),
  check (registration_closes_at is null or registration_closes_at <= ends_at),
  check (registration_opens_at is null or registration_closes_at is null or registration_opens_at < registration_closes_at)
);
create index events_owner_idx on public.events (profile_id, starts_at desc);
create index events_mode_idx on public.events (mode_id, starts_at) where status = 'published';

-- 3. Registrations: one row per guest per attempt; a cancelled row stays for the record.
create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  -- The organizer, so every owner read is a plain tenant filter.
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attendee_user_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  email text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  email_norm text not null check (char_length(email_norm) <= 254),
  status text not null check (status in ('confirmed','waitlisted','cancelled')),
  -- Bumped to void a guest's links (and, later, tickets) without touching the row's id.
  token_version smallint not null default 1 check (token_version between 1 and 1000),
  -- A guest email the app still owes (a waitlist promotion); taken once by take_event_notices.
  pending_notice text check (pending_notice is null or pending_notice in ('promoted')),
  cancelled_by text check (cancelled_by is null or cancelled_by in ('guest','organizer')),
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{16,64}$'),
  confirmed_at timestamptz,
  promoted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (event_id, idempotency_key),
  check ((status = 'cancelled') = (cancelled_at is not null))
);
create index event_registrations_event_idx on public.event_registrations (event_id, status, created_at, id);
create index event_registrations_owner_idx on public.event_registrations (profile_id, created_at desc);
create index event_registrations_ip_idx on public.event_registrations (ip_hash, created_at desc) where ip_hash is not null;
create index event_registrations_attendee_idx on public.event_registrations (attendee_user_id) where attendee_user_id is not null;
create index event_registrations_notice_idx on public.event_registrations (event_id) where pending_notice is not null;
-- One live registration per address, and per signed-in member.
create unique index event_registrations_email_uidx on public.event_registrations (event_id, email_norm) where status <> 'cancelled';
create unique index event_registrations_member_uidx on public.event_registrations (event_id, attendee_user_id)
  where status <> 'cancelled' and attendee_user_id is not null;

-- 4. Lifecycle, from the clock. The app mirrors these in src/lib/events/model.ts.
create function private.event_phase(p_status text, p_starts timestamptz, p_ends timestamptz, p_now timestamptz)
returns text language sql immutable set search_path='' as $function$
  select case
    when p_status = 'draft' then 'draft'
    when p_status = 'cancelled' then 'cancelled'
    when p_now >= p_ends then 'ended'
    when p_now >= p_starts then 'live'
    else 'upcoming' end
$function$;

-- Registration: 'open', 'soon' (not open yet) or 'closed'. It closes at the start unless the
-- organizer chose another time, and never after the end.
create function private.event_registration_window(e public.events, p_now timestamptz)
returns text language sql stable set search_path='' as $function$
  select case
    when e.status <> 'published' then 'closed'
    when e.registration_opens_at is not null and p_now < e.registration_opens_at then 'soon'
    when p_now >= least(coalesce(e.registration_closes_at, e.starts_at), e.ends_at) then 'closed'
    else 'open' end
$function$;

-- 5. Owner writes: validation, status rules and a safety cap.
create function private.validate_event() returns trigger language plpgsql security definer set search_path='' as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
begin
  if not exists(select 1 from public.profile_modes m where m.id = new.mode_id and m.profile_id = new.profile_id and m.slug = 'event') then
    raise exception using errcode='23514', message='event_mode_mismatch';
  end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names z where z.name = new.timezone) or new.timezone !~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$' then
    raise exception using errcode='23514', message='event_timezone_invalid';
  end if;
  new.title := pg_catalog.btrim(new.title);

  if tg_op = 'INSERT' then
    -- The public id is always the database's, never the writer's.
    new.short_id := private.event_short_id();
    if new.status = 'cancelled' then raise exception using errcode='23514', message='event_status_invalid'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('events:'||new.profile_id::text, 0));
    if (select count(*) from public.events e where e.profile_id = new.profile_id and e.status <> 'cancelled' and e.ends_at > v_now) >= 50 then
      raise exception using errcode='P0001', message='event_limit';
    end if;
  else
    if new.profile_id <> old.profile_id or new.mode_id <> old.mode_id or new.short_id <> old.short_id or new.created_at <> old.created_at then
      raise exception using errcode='23514', message='event_identity_locked';
    end if;
    if old.status = 'cancelled' and (new.status <> 'cancelled' or row(new.title, new.starts_at, new.ends_at, new.capacity) is distinct from row(old.title, old.starts_at, old.ends_at, old.capacity)) then
      raise exception using errcode='23514', message='event_cancelled';
    end if;
    -- Back to draft hides the page; not once people have registered.
    if old.status = 'published' and new.status = 'draft' and (old.confirmed_count + old.waitlist_count) > 0 then
      raise exception using errcode='23514', message='event_has_guests';
    end if;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if new.ends_at <= v_now then raise exception using errcode='23514', message='event_already_ended'; end if;
    new.published_at := coalesce(new.published_at, v_now);
  end if;
  if new.status = 'cancelled' and (tg_op = 'INSERT' or old.status <> 'cancelled') then new.cancelled_at := v_now; end if;
  return new;
end;
$function$;
create trigger events_validate before insert or update on public.events
  for each row execute function private.validate_event();
create trigger events_set_updated_at before update on public.events
  for each row execute function private.set_updated_at();
create trigger event_registrations_set_updated_at before update on public.event_registrations
  for each row execute function private.set_updated_at();

-- 6. Waitlist promotion: oldest first, while seats are free. The caller holds the event's row lock.
create function private.promote_event_waitlist(p_event_id uuid)
returns integer language plpgsql security definer set search_path='' as $function$
declare
  e public.events;
  r public.event_registrations;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_promoted integer := 0;
begin
  select * into e from public.events where id = p_event_id;
  if not found or e.status <> 'published' or v_now >= e.ends_at then return 0; end if;
  loop
    exit when e.capacity is not null and e.confirmed_count >= e.capacity;
    select * into r from public.event_registrations
      where event_id = p_event_id and status = 'waitlisted' order by created_at, id limit 1 for update;
    exit when not found;
    update public.event_registrations set status = 'confirmed', confirmed_at = v_now, promoted_at = v_now, pending_notice = 'promoted' where id = r.id;
    e.confirmed_count := e.confirmed_count + 1;
    e.waitlist_count := e.waitlist_count - 1;
    v_promoted := v_promoted + 1;
  end loop;
  if v_promoted > 0 then
    update public.events set confirmed_count = e.confirmed_count, waitlist_count = e.waitlist_count where id = p_event_id;
  end if;
  return v_promoted;
end;
$function$;

-- More seats (or no limit) promote the waitlist straight away, whoever made the change.
create function private.event_capacity_changed() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if pg_catalog.pg_trigger_depth() = 1 and new.status = 'published' and new.waitlist_count > 0
     and (new.capacity is null or new.capacity > new.confirmed_count) then
    perform private.promote_event_waitlist(new.id);
  end if;
  return null;
end;
$function$;
create trigger events_capacity_promote after update of capacity, status on public.events
  for each row execute function private.event_capacity_changed();

-- 7. Register. Service role only: the route checks origin, the spam trap, fill time and IP limits first.
create function public.register_for_event(
  p_event_id uuid, p_attendee uuid, p_name text, p_email text, p_idempotency_key text, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  e public.events;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_name text := pg_catalog.btrim(coalesce(p_name,''));
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email,'')));
  v_norm text;
  v_local text;
  v_domain text;
  v_status text;
  v_existing public.event_registrations;
  v_id uuid;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception using errcode='22023', message='invalid_request'; end if;
  if pg_catalog.char_length(v_name) not between 1 and 80 then raise exception using errcode='22023', message='name_required'; end if;
  if v_email = '' then raise exception using errcode='22023', message='email_required'; end if;
  if pg_catalog.char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception using errcode='22023', message='invalid_email'; end if;

  -- The row lock serializes every registration and cancellation for this event.
  select * into e from public.events where id = p_event_id for update;
  if not found or e.status = 'draft' or not exists(
      select 1 from public.profile_modes m join public.profiles p on p.id = m.profile_id
      where m.id = e.mode_id and m.is_enabled and p.is_published) then
    raise exception using errcode='P0002', message='event_unavailable';
  end if;
  if e.status = 'cancelled' then raise exception using errcode='P0002', message='event_cancelled'; end if;
  if p_attendee is not null and p_attendee = e.profile_id then raise exception using errcode='22023', message='own_event'; end if;

  -- A retried request returns the first answer.
  select * into v_existing from public.event_registrations r where r.event_id = e.id and r.idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('id', v_existing.id, 'status', v_existing.status, 'duplicate', true, 'token_version', v_existing.token_version); end if;

  case private.event_registration_window(e, v_now)
    when 'soon' then raise exception using errcode='P0002', message='registration_not_open';
    when 'closed' then raise exception using errcode='P0002', message='registration_closed';
    else null;
  end case;

  -- Flood guards that hold across server instances.
  if p_ip_hash is not null and (
      (select count(*) from public.event_registrations r where r.ip_hash = p_ip_hash and r.event_id = e.id and r.created_at > v_now - interval '1 hour') >= 6
      or (select count(*) from public.event_registrations r where r.ip_hash = p_ip_hash and r.created_at > v_now - interval '1 hour') >= 30) then
    raise exception using errcode='54000', message='rate_limited';
  end if;

  v_local := pg_catalog.split_part(pg_catalog.split_part(v_email,'@',1),'+',1);
  v_domain := pg_catalog.split_part(v_email,'@',2);
  if v_domain in ('gmail.com','googlemail.com') then v_local := pg_catalog.replace(v_local,'.',''); v_domain := 'gmail.com'; end if;
  v_norm := v_local||'@'||v_domain;

  -- Already on the list: no second seat. The caller re-sends that guest's own email, and tells the
  -- browser the same thing a new registration would hear, so the form never reveals who is going.
  select * into v_existing from public.event_registrations r
    where r.event_id = e.id and r.status <> 'cancelled'
      and (r.email_norm = v_norm or (p_attendee is not null and r.attendee_user_id = p_attendee))
    order by r.created_at limit 1;
  if found then
    return jsonb_build_object('id', v_existing.id, 'status', v_existing.status, 'duplicate', true, 'token_version', v_existing.token_version,
      'shown_status', case when p_attendee is not null and v_existing.attendee_user_id = p_attendee then v_existing.status
        when e.capacity is null or e.confirmed_count < e.capacity then 'confirmed' else 'waitlisted' end);
  end if;

  if e.capacity is null or e.confirmed_count < e.capacity then
    v_status := 'confirmed';
    update public.events set confirmed_count = confirmed_count + 1 where id = e.id;
  elsif e.waitlist_enabled then
    v_status := 'waitlisted';
    update public.events set waitlist_count = waitlist_count + 1 where id = e.id;
  else
    raise exception using errcode='P0001', message='event_full';
  end if;

  insert into public.event_registrations(event_id, profile_id, attendee_user_id, name, email, email_norm, status, confirmed_at, ip_hash, idempotency_key)
  values (e.id, e.profile_id, p_attendee, v_name, v_email, v_norm, v_status, case when v_status = 'confirmed' then v_now end, p_ip_hash, p_idempotency_key)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', v_status, 'duplicate', false, 'token_version', 1);
end;
$function$;

-- 8. Cancel: by the guest (signed link, checked by the app) or by the organizer. Frees the seat and
-- promotes the waitlist in the same transaction.
create function private.cancel_event_registration_core(p_registration_id uuid, p_by text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  r public.event_registrations;
  e public.events;
  v_now timestamptz := pg_catalog.statement_timestamp();
begin
  select * into r from public.event_registrations where id = p_registration_id;
  if not found then raise exception using errcode='P0002', message='registration_not_found'; end if;
  select * into e from public.events where id = r.event_id for update;
  select * into r from public.event_registrations where id = p_registration_id for update;
  if r.status = 'cancelled' then return jsonb_build_object('id', r.id, 'status', 'cancelled', 'already', true, 'promoted', 0); end if;
  if v_now >= e.ends_at then raise exception using errcode='P0002', message='event_ended'; end if;
  update public.event_registrations set status = 'cancelled', cancelled_at = v_now, cancelled_by = p_by, pending_notice = null where id = r.id;
  if r.status = 'confirmed' then
    update public.events set confirmed_count = confirmed_count - 1 where id = e.id;
  else
    update public.events set waitlist_count = waitlist_count - 1 where id = e.id;
  end if;
  return jsonb_build_object('id', r.id, 'status', 'cancelled', 'already', false, 'promoted', private.promote_event_waitlist(e.id));
end;
$function$;

create function public.cancel_event_registration(p_registration_id uuid, p_token_version smallint)
returns jsonb language plpgsql security definer set search_path='' as $function$
begin
  if not exists(select 1 from public.event_registrations r where r.id = p_registration_id and r.token_version = p_token_version) then
    raise exception using errcode='P0002', message='registration_not_found';
  end if;
  return private.cancel_event_registration_core(p_registration_id, 'guest');
end;
$function$;

create function public.owner_cancel_event_registration(p_registration_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
begin
  if not exists(select 1 from public.event_registrations r where r.id = p_registration_id and r.profile_id = (select auth.uid())) then
    raise exception using errcode='P0002', message='registration_not_found';
  end if;
  return private.cancel_event_registration_core(p_registration_id, 'organizer');
end;
$function$;

-- 9. The guest emails the app still owes (promotions), each handed out once.
create function public.take_event_notices(p_event_id uuid)
returns table (id uuid, name text, email text, notice text, token_version smallint)
language sql volatile security definer set search_path='' as $function$
  with due as (
    select r.id from public.event_registrations r
    where r.event_id = p_event_id and r.pending_notice is not null
    order by r.promoted_at nulls last, r.id
    for update skip locked limit 200)
  update public.event_registrations r set pending_notice = null
  from due where r.id = due.id
  returning r.id, r.name, r.email, 'promoted'::text, r.token_version
$function$;

-- 10. One registration, for its guest's signed link (the app has already checked the signature).
create function public.get_event_registration(p_registration_id uuid, p_token_version smallint)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('id', r.id, 'event_id', r.event_id, 'short_id', e.short_id, 'name', r.name, 'email', r.email, 'status', r.status,
    'created_at', r.created_at, 'cancelled_at', r.cancelled_at, 'cancelled_by', r.cancelled_by)
  from public.event_registrations r join public.events e on e.id = r.event_id
  where r.id = p_registration_id and r.token_version = p_token_version
$function$;

-- 11. A public event page. Service role only, because it names the organizer's profile for the
-- server to draw the Event Mode's Appearance; the page never prints the username.
create function public.get_public_event(p_short_id text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object(
    'id', e.id, 'short_id', e.short_id, 'slug', e.slug, 'status', e.status, 'title', e.title, 'summary', e.summary,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
    'venue_name', e.venue_name, 'address', e.address, 'city', e.city, 'country_code', e.country_code, 'online_url', e.online_url,
    'capacity', e.capacity, 'waitlist_enabled', e.waitlist_enabled, 'confirmed_count', e.confirmed_count,
    'registration_opens_at', e.registration_opens_at, 'registration_closes_at', e.registration_closes_at,
    'phase', private.event_phase(e.status, e.starts_at, e.ends_at, pg_catalog.statement_timestamp()),
    'registration', private.event_registration_window(e, pg_catalog.statement_timestamp()),
    'profile_id', e.profile_id, 'username', p.username, 'display_name', p.display_name)
  from public.events e
  join public.profiles p on p.id = e.profile_id
  join public.profile_modes m on m.id = e.mode_id
  where p_short_id ~ '^[0-9A-Za-z]{8}$' and e.short_id = p_short_id
    and e.status <> 'draft' and p.is_published and m.is_enabled
$function$;

-- 12. Access. Owners manage their own events and read their own guests; nobody else sees either.
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
revoke all on public.events, public.event_registrations from public, anon, authenticated;
grant select, delete on public.events to authenticated;
grant insert (profile_id, mode_id, slug, status, title, summary, starts_at, ends_at, timezone, venue_name, address, city, country_code, online_url, capacity, waitlist_enabled, registration_opens_at, registration_closes_at)
  on public.events to authenticated;
grant update (slug, status, title, summary, starts_at, ends_at, timezone, venue_name, address, city, country_code, online_url, capacity, waitlist_enabled, registration_opens_at, registration_closes_at)
  on public.events to authenticated;
grant select (id, event_id, profile_id, attendee_user_id, name, email, status, cancelled_by, confirmed_at, promoted_at, cancelled_at, created_at, updated_at)
  on public.event_registrations to authenticated;
grant all on public.events, public.event_registrations to service_role;

create policy events_owner_all on public.events for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
-- An event with guests is cancelled, not deleted, so the record stays.
create policy events_owner_delete_empty on public.events as restrictive for delete to authenticated
  using (confirmed_count + waitlist_count = 0 and not exists(select 1 from public.event_registrations r where r.event_id = events.id));
create policy event_registrations_owner_read on public.event_registrations for select to authenticated
  using (profile_id = (select auth.uid()));

revoke all on function private.event_short_id(), private.event_phase(text,timestamptz,timestamptz,timestamptz),
  private.event_registration_window(public.events,timestamptz), private.validate_event(), private.promote_event_waitlist(uuid),
  private.event_capacity_changed(), private.cancel_event_registration_core(uuid,text) from public, anon, authenticated;
revoke all on function public.register_for_event(uuid,uuid,text,text,text,text), public.cancel_event_registration(uuid,smallint),
  public.take_event_notices(uuid), public.get_event_registration(uuid,smallint), public.get_public_event(text) from public, anon, authenticated;
grant execute on function public.register_for_event(uuid,uuid,text,text,text,text), public.cancel_event_registration(uuid,smallint),
  public.take_event_notices(uuid), public.get_event_registration(uuid,smallint), public.get_public_event(text) to service_role;
revoke all on function public.owner_cancel_event_registration(uuid) from public, anon;
grant execute on function public.owner_cancel_event_registration(uuid) to authenticated;

comment on table public.events is 'Event Mode events: one public page each at /e/<short_id>/<slug>. Owner-managed via RLS; counters only change inside register/cancel/promote.';
comment on table public.event_registrations is 'Event guests (RSVP). Written only by register_for_event and the cancel functions; owners read their own under RLS.';
