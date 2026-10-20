-- Public handle foundation (phase 1 of the approved URL design).
-- 1. One reserved-name table used by the database, replacing the two inline lists.
-- 2. Renamed usernames stay with their owner for good: nobody else can claim them, and they
--    redirect (307) to the owner's current username while the profile is published.
-- 3. Abuse limits: 3 username changes per 30 days, at most 20 held old names per profile.
--    Rows are ~100 bytes, so even the cap is negligible storage.
-- Additive: no existing username changes, the old check constraint stays as a subset.

create table private.reserved_handles (
  handle text primary key check (handle = pg_catalog.lower(handle))
);
revoke all on private.reserved_handles from public, anon, authenticated;

-- Every top-level route and system word. Keep in sync with src/lib/usernames.ts (a test checks it).
insert into private.reserved_handles (handle) values
  ('about'), ('account'), ('admin'), ('api'), ('app'), ('apple-touch-icon'), ('assets'), ('auth'),
  ('brand'), ('careers'), ('connect'), ('connections'), ('contact'), ('cookies'), ('d'), ('data'),
  ('data-deletion'), ('e'), ('events'), ('favicon'), ('favicon.ico'), ('fonts'), ('handles'), ('help'),
  ('icon'), ('images'), ('internal'), ('login'), ('manifest'), ('manifest.json'), ('modes'), ('next'),
  ('nl'), ('og'), ('pricing'), ('privacy'), ('purchase'), ('q'), ('refunds'), ('roadmap'), ('robots'),
  ('robots.txt'), ('s'), ('security'), ('settings'), ('share'), ('signup'), ('sitemap'), ('sitemap.xml'),
  ('static'), ('status'), ('support'), ('t'), ('teams'), ('terms'), ('u'), ('wallet'), ('_next')
on conflict do nothing;

create function public.is_reserved_handle(p_handle text)
returns boolean language sql stable security definer set search_path = '' as $function$
  select exists (select 1 from private.reserved_handles where handle = pg_catalog.lower(pg_catalog.btrim(coalesce(p_handle, ''))))
$function$;
revoke all on function public.is_reserved_handle(text) from public;
grant execute on function public.is_reserved_handle(text) to anon, authenticated, service_role;

-- Old handles, kept for their owner. Phase 2 adds Mode handles to the same table.
-- profile_id becomes null when the account is deleted: the name stays blocked (a printed card or
-- backlink can't be taken over) and redirects nowhere. released_at is for a later, controlled,
-- admin-only release; nothing sets it yet.
create table public.handle_history (
  handle text primary key check (handle ~ '^[a-z0-9_]{3,24}$'),
  profile_id uuid references public.profiles(id) on delete set null,
  mode_slug text not null default 'personal' check (mode_slug in ('personal','event','business','creator')),
  retired_at timestamptz not null default pg_catalog.statement_timestamp(),
  released_at timestamptz
);
create index handle_history_profile_idx on public.handle_history (profile_id, retired_at desc);
alter table public.handle_history enable row level security;
revoke all on public.handle_history from public, anon, authenticated;
grant all on public.handle_history to service_role;
comment on table public.handle_history is 'Retired handles, kept for their owner (never auto-released). Redirected with 307 to the owner''s current handle; nobody else can claim them.';

-- Change log for the rate limit only; rows older than 30 days are pruned on each change.
create table private.username_changes (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  changed_at timestamptz not null default pg_catalog.statement_timestamp()
);
create index username_changes_profile_idx on private.username_changes (profile_id, changed_at desc);
revoke all on private.username_changes from public, anon, authenticated;

-- Guards every username write: reserved, held by someone else, or too many changes.
create function private.guard_username_change()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  recent integer;
begin
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then return new; end if;
  -- Serialise every write that touches these names, so a rename away from a name and someone else
  -- claiming it can't both pass their checks. Locks in a fixed order to avoid deadlocks.
  if tg_op = 'UPDATE' and old.username < new.username then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('handle:' || old.username));
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('handle:' || new.username));
  if tg_op = 'UPDATE' and old.username > new.username then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('handle:' || old.username));
  end if;
  if exists (select 1 from private.reserved_handles where handle = pg_catalog.lower(new.username)) then
    raise exception using errcode = '23514', message = 'username_reserved';
  end if;
  if exists (select 1 from public.handle_history h where h.handle = new.username and h.profile_id is distinct from new.id and h.released_at is null) then
    raise exception using errcode = '23505', message = 'username_held';
  end if;
  if tg_op = 'UPDATE' then
    select pg_catalog.count(*) into recent from private.username_changes c
    where c.profile_id = new.id and c.changed_at > pg_catalog.statement_timestamp() - interval '30 days';
    if recent >= 3 then
      raise exception using errcode = 'P0001', message = 'username_change_limit';
    end if;
    -- Taking back one of your own old names doesn't add a held name.
    if not exists (select 1 from public.handle_history h where h.handle = new.username and h.profile_id = new.id)
       and (select pg_catalog.count(*) from public.handle_history h where h.profile_id = new.id and h.released_at is null) >= 20 then
      raise exception using errcode = 'P0001', message = 'username_history_limit';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.guard_username_change() from public, anon, authenticated;

create trigger profiles_guard_username before insert or update of username on public.profiles
  for each row execute function private.guard_username_change();

-- After a rename: keep the old one for the owner; taking back your own old name removes it from history.
create function private.record_username_change()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if new.username is not distinct from old.username then return new; end if;
  delete from private.username_changes where profile_id = new.id and changed_at <= pg_catalog.statement_timestamp() - interval '30 days';
  insert into private.username_changes (profile_id) values (new.id);
  delete from public.handle_history where handle = new.username and (profile_id = new.id or released_at is not null);
  insert into public.handle_history (handle, profile_id, mode_slug)
  values (old.username, new.id, 'personal')
  on conflict (handle) do update set profile_id = excluded.profile_id, mode_slug = excluded.mode_slug,
    retired_at = pg_catalog.statement_timestamp(), released_at = null;
  return new;
end;
$function$;
revoke all on function private.record_username_change() from public, anon, authenticated;

create trigger profiles_record_username_change after update of username on public.profiles
  for each row execute function private.record_username_change();

-- Availability: format, reserved, live and kept names (your own old names stay available to you). Only yes or no.
create or replace function public.is_username_available(candidate_username text)
returns boolean language sql stable security definer set search_path = '' as $function$
  with c as (select pg_catalog.lower(pg_catalog.btrim(coalesce(candidate_username, ''))) as name)
  select
    c.name ~ '^[a-z0-9_]{3,24}$'
    and not exists (select 1 from private.reserved_handles r where r.handle = c.name)
    and not exists (select 1 from public.profiles p where p.username = c.name)
    and not exists (
      select 1 from public.handle_history h
      where h.handle = c.name and h.released_at is null
        and h.profile_id is distinct from (select auth.uid())
    )
  from c
$function$;
revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- Where an old handle now lives: always the same owner's current username, one hop, never another
-- old name. Published profiles only; anything else is null (same as unknown).
create function public.resolve_renamed_handle(p_handle text)
returns text language sql stable security definer set search_path = '' as $function$
  select p.username
  from public.handle_history h
  join public.profiles p on p.id = h.profile_id and p.is_published
  where h.handle = pg_catalog.lower(pg_catalog.btrim(coalesce(p_handle, '')))
    and h.mode_slug = 'personal'
    and h.released_at is null
    and p.username <> h.handle
  limit 1
$function$;
revoke all on function public.resolve_renamed_handle(text) from public;
grant execute on function public.resolve_renamed_handle(text) to anon, authenticated, service_role;
