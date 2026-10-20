-- Mode handles (phase 2 of the approved URL design): Business and Creator Modes may claim their own
-- handle in the same global namespace as usernames. Three separate, explicit owner choices:
--   claimed        the name is theirs (reserved, nothing else changes)
--   is_live        setuvara.com/<handle> opens the Mode (off by default; the Mode stays unlisted)
--   search_indexed search engines may list it (off by default; needs is_live)
-- Old Mode handles go to handle_history and stay with their owner, like usernames.
-- Additive: new table + RPCs; two existing functions are replaced to also check Mode handles.

create table public.mode_handles (
  handle text primary key check (handle ~ '^[a-z0-9_]{3,24}$'),
  profile_id uuid not null,
  mode_id uuid not null unique,
  mode_slug text not null check (mode_slug in ('business','creator')),
  is_live boolean not null default false,
  search_indexed boolean not null default false,
  claimed_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint mode_handles_mode_owner_fk foreign key (profile_id, mode_id) references public.profile_modes(profile_id, id) on delete cascade,
  constraint mode_handles_index_needs_live check (is_live or not search_indexed)
);
create unique index mode_handles_profile_mode_key on public.mode_handles (profile_id, mode_slug);
create trigger mode_handles_set_updated_at before update on public.mode_handles
  for each row execute function private.set_updated_at();
alter table public.mode_handles enable row level security;
revoke all on public.mode_handles from public, anon, authenticated;
grant select on public.mode_handles to authenticated;
grant all on public.mode_handles to service_role;
-- Owners read their own; everyone else goes through the resolve RPCs, which only answer for live handles.
create policy mode_handles_owner_read on public.mode_handles for select to authenticated using (profile_id = (select auth.uid()));
comment on table public.mode_handles is 'Optional public handle per Business or Creator Mode. Written only through claim/release/set RPCs.';

-- A Mode handle that is changed, released or deleted with its account goes to history, so it keeps
-- pointing at its owner and nobody else can take it. After an account deletion it stays blocked.
create function private.keep_mode_handle()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if tg_op = 'UPDATE' and new.handle = old.handle then return null; end if;
  insert into public.handle_history (handle, profile_id, mode_slug)
  values (old.handle, (select p.id from public.profiles p where p.id = old.profile_id), old.mode_slug)
  on conflict (handle) do update set profile_id = excluded.profile_id, mode_slug = excluded.mode_slug,
    retired_at = pg_catalog.statement_timestamp(), released_at = null;
  return null;
end;
$function$;
revoke all on function private.keep_mode_handle() from public, anon, authenticated;
create trigger mode_handles_keep_old after update of handle or delete on public.mode_handles
  for each row execute function private.keep_mode_handle();

-- Rate limit log for Mode handle changes (pruned to 30 days on each change).
create table private.mode_handle_changes (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  mode_slug text not null,
  changed_at timestamptz not null default pg_catalog.statement_timestamp()
);
create index mode_handle_changes_idx on private.mode_handle_changes (profile_id, mode_slug, changed_at desc);
revoke all on private.mode_handle_changes from public, anon, authenticated;

-- One place that says whether a name is free for this profile: format, reserved, live usernames,
-- live Mode handles, and kept old names (your own stay free for you). Callers hold the name's lock.
create function private.handle_free_for(p_handle text, p_profile uuid, p_mode_id uuid default null)
returns text language sql stable security definer set search_path = '' as $function$
  select case
    when p_handle !~ '^[a-z0-9_]{3,24}$' then 'invalid'
    when exists (select 1 from private.reserved_handles r where r.handle = p_handle) then 'reserved'
    when exists (select 1 from public.profiles p where p.username = p_handle) then 'taken'
    when exists (select 1 from public.mode_handles m where m.handle = p_handle and m.mode_id is distinct from p_mode_id) then 'taken'
    when exists (select 1 from public.handle_history h where h.handle = p_handle and h.released_at is null and h.profile_id is distinct from p_profile) then 'taken'
    else 'free'
  end
$function$;
revoke all on function private.handle_free_for(text, uuid, uuid) from public, anon, authenticated;

create function private.lock_handle(p_handle text)
returns void language sql volatile set search_path = '' as $function$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('handle:' || p_handle))
$function$;
revoke all on function private.lock_handle(text) from public, anon, authenticated;

-- Usernames now also respect Mode handles (same lock key as phase 1).
create or replace function private.guard_username_change()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  recent integer;
begin
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then return new; end if;
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
  if exists (select 1 from public.mode_handles m where m.handle = new.username) then
    raise exception using errcode = '23505', message = 'username_taken';
  end if;
  if tg_op = 'UPDATE' then
    select pg_catalog.count(*) into recent from private.username_changes c
    where c.profile_id = new.id and c.changed_at > pg_catalog.statement_timestamp() - interval '30 days';
    if recent >= 3 then
      raise exception using errcode = 'P0001', message = 'username_change_limit';
    end if;
    if not exists (select 1 from public.handle_history h where h.handle = new.username and h.profile_id = new.id)
       and (select pg_catalog.count(*) from public.handle_history h where h.profile_id = new.id and h.released_at is null) >= 20 then
      raise exception using errcode = 'P0001', message = 'username_history_limit';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.is_username_available(candidate_username text)
returns boolean language sql stable security definer set search_path = '' as $function$
  select private.handle_free_for(pg_catalog.lower(pg_catalog.btrim(coalesce(candidate_username, ''))), (select auth.uid())) = 'free'
$function$;
revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- What the Share screen shows while typing: free, yours, taken, reserved or invalid. Signed-in only.
create function public.check_handle(p_handle text)
returns text language plpgsql stable security definer set search_path = '' as $function$
declare
  name text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_handle, '')));
  me uuid := (select auth.uid());
begin
  if me is null then raise exception using errcode = '42501', message = 'sign_in'; end if;
  if exists (select 1 from public.mode_handles m where m.handle = name and m.profile_id = me) then return 'yours'; end if;
  return private.handle_free_for(name, me);
end;
$function$;
revoke all on function public.check_handle(text) from public, anon;
grant execute on function public.check_handle(text) to authenticated;

-- Claim or change the handle of one of your own Business or Creator Modes. Never turns it live.
create function public.claim_mode_handle(p_mode text, p_handle text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $function$
declare
  me uuid := (select auth.uid());
  name text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_handle, '')));
  target record;
  current_row public.mode_handles;
  verdict text;
  recent integer;
begin
  if me is null then raise exception using errcode = '42501', message = 'sign_in'; end if;
  if p_mode not in ('business','creator') then raise exception using errcode = '22023', message = 'mode_not_supported'; end if;
  select id into target from public.profile_modes where profile_id = me and slug = p_mode;
  if target.id is null then raise exception using errcode = '22023', message = 'mode_missing'; end if;
  select * into current_row from public.mode_handles where mode_id = target.id for update;
  if current_row.handle = name then return pg_catalog.jsonb_build_object('handle', name, 'is_live', current_row.is_live, 'search_indexed', current_row.search_indexed); end if;

  -- Lock old and new names in a fixed order, then check under the lock.
  if current_row.handle is not null and current_row.handle < name then perform private.lock_handle(current_row.handle); end if;
  perform private.lock_handle(name);
  if current_row.handle is not null and current_row.handle > name then perform private.lock_handle(current_row.handle); end if;

  verdict := private.handle_free_for(name, me, target.id);
  if verdict <> 'free' then raise exception using errcode = case when verdict = 'taken' then '23505' else '23514' end, message = 'handle_' || verdict; end if;

  select pg_catalog.count(*) into recent from private.mode_handle_changes c
  where c.profile_id = me and c.mode_slug = p_mode and c.changed_at > pg_catalog.statement_timestamp() - interval '30 days';
  if recent >= 3 then raise exception using errcode = 'P0001', message = 'handle_change_limit'; end if;
  if current_row.handle is not null
     and not exists (select 1 from public.handle_history h where h.handle = name and h.profile_id = me)
     and (select pg_catalog.count(*) from public.handle_history h where h.profile_id = me and h.released_at is null) >= 20 then
    raise exception using errcode = 'P0001', message = 'handle_history_limit';
  end if;

  delete from public.handle_history where handle = name and (profile_id = me or released_at is not null);
  if current_row.handle is null then
    insert into public.mode_handles (handle, profile_id, mode_id, mode_slug) values (name, me, target.id, p_mode);
  else
    update public.mode_handles set handle = name where mode_id = target.id;
  end if;
  -- The Mode's share id backs its sub-pages (Creator actions, products); make sure it exists.
  insert into public.mode_share_locators (profile_id, mode_id) values (me, target.id) on conflict do nothing;
  delete from private.mode_handle_changes where profile_id = me and changed_at <= pg_catalog.statement_timestamp() - interval '30 days';
  insert into private.mode_handle_changes (profile_id, mode_slug) values (me, p_mode);
  select * into current_row from public.mode_handles where mode_id = target.id;
  return pg_catalog.jsonb_build_object('handle', current_row.handle, 'is_live', current_row.is_live, 'search_indexed', current_row.search_indexed);
end;
$function$;
revoke all on function public.claim_mode_handle(text, text) from public, anon;
grant execute on function public.claim_mode_handle(text, text) to authenticated;

-- Turn the public link on or off, and search listing on or off. Off also turns listing off.
create function public.set_mode_handle_visibility(p_mode text, p_live boolean, p_indexed boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $function$
declare
  me uuid := (select auth.uid());
  row_out public.mode_handles;
begin
  if me is null then raise exception using errcode = '42501', message = 'sign_in'; end if;
  update public.mode_handles set is_live = coalesce(p_live, false), search_indexed = coalesce(p_live, false) and coalesce(p_indexed, false)
  where profile_id = me and mode_slug = p_mode
  returning * into row_out;
  if row_out.handle is null then raise exception using errcode = '22023', message = 'handle_missing'; end if;
  return pg_catalog.jsonb_build_object('handle', row_out.handle, 'is_live', row_out.is_live, 'search_indexed', row_out.search_indexed);
end;
$function$;
revoke all on function public.set_mode_handle_visibility(text, boolean, boolean) from public, anon;
grant execute on function public.set_mode_handle_visibility(text, boolean, boolean) to authenticated;

-- Give a handle up. It stays yours in history (nobody else can take it) and stops opening.
create function public.release_mode_handle(p_mode text)
returns void language plpgsql volatile security definer set search_path = '' as $function$
declare
  me uuid := (select auth.uid());
  gone public.mode_handles;
begin
  if me is null then raise exception using errcode = '42501', message = 'sign_in'; end if;
  select * into gone from public.mode_handles where profile_id = me and mode_slug = p_mode for update;
  if gone.handle is null then return; end if;
  perform private.lock_handle(gone.handle);
  delete from public.mode_handles where mode_id = gone.mode_id;
end;
$function$;
revoke all on function public.release_mode_handle(text) from public, anon;
grant execute on function public.release_mode_handle(text) to authenticated;

-- A live Mode handle: which profile and Mode it opens, plus the Mode's share id for its sub-pages.
-- Answers only when the handle is live, the profile published and the Mode enabled. Server only:
-- the username behind a Mode handle is never handed to browsers.
create function public.resolve_mode_handle(p_handle text)
returns jsonb language sql stable security definer set search_path = '' as $function$
  select pg_catalog.jsonb_build_object('username', p.username, 'mode', m.mode_slug, 'handle', m.handle,
    'indexed', m.search_indexed, 'share_id', l.short_id)
  from public.mode_handles m
  join public.profiles p on p.id = m.profile_id and p.is_published
  join public.profile_modes pm on pm.id = m.mode_id and pm.profile_id = m.profile_id and pm.is_enabled
  left join public.mode_share_locators l on l.mode_id = m.mode_id and l.profile_id = m.profile_id
  where m.handle = pg_catalog.lower(pg_catalog.btrim(coalesce(p_handle, ''))) and m.is_live
  limit 1
$function$;
revoke all on function public.resolve_mode_handle(text) from public, anon, authenticated;
grant execute on function public.resolve_mode_handle(text) to service_role;

-- The live handle of one profile's Mode, for Quick QR, Tap and share URLs. Null unless it would open.
-- Server only, keyed by profile id: a username must never reveal that person's other Modes.
create function public.live_mode_handle(p_profile uuid, p_mode text)
returns text language sql stable security definer set search_path = '' as $function$
  select m.handle
  from public.mode_handles m
  join public.profiles p on p.id = m.profile_id and p.is_published
  join public.profile_modes pm on pm.id = m.mode_id and pm.is_enabled
  where m.profile_id = p_profile and m.mode_slug = p_mode and m.is_live
  limit 1
$function$;
revoke all on function public.live_mode_handle(uuid, text) from public, anon, authenticated;
grant execute on function public.live_mode_handle(uuid, text) to service_role;

-- Old handles: a username moves to the current username; an old Mode handle moves only to that
-- Mode's current live handle (never to its private /s/ link). One hop, same owner, else null.
create or replace function public.resolve_renamed_handle(p_handle text)
returns text language sql stable security definer set search_path = '' as $function$
  select case when h.mode_slug = 'personal' then (case when p.username <> h.handle then p.username end)
              else (select m.handle from public.mode_handles m
                    join public.profile_modes pm on pm.id = m.mode_id and pm.is_enabled
                    where m.profile_id = h.profile_id and m.mode_slug = h.mode_slug and m.is_live and m.handle <> h.handle)
         end
  from public.handle_history h
  join public.profiles p on p.id = h.profile_id and p.is_published
  where h.handle = pg_catalog.lower(pg_catalog.btrim(coalesce(p_handle, '')))
    and h.released_at is null
  limit 1
$function$;

-- Sitemap: live, listed Mode handles only.
create function public.list_indexed_mode_handles(p_limit integer default 5000)
returns table (handle text, updated_at timestamptz) language sql stable security definer set search_path = '' as $function$
  select m.handle, greatest(m.updated_at, pm.updated_at, p.updated_at)
  from public.mode_handles m
  join public.profiles p on p.id = m.profile_id and p.is_published
  join public.profile_modes pm on pm.id = m.mode_id and pm.is_enabled
  where m.is_live and m.search_indexed
  order by m.handle
  limit greatest(0, least(coalesce(p_limit, 5000), 50000))
$function$;
revoke all on function public.list_indexed_mode_handles(integer) from public;
grant execute on function public.list_indexed_mode_handles(integer) to anon, authenticated, service_role;
