-- Handle rules, revised (approved 2026-10-23):
-- 1. Usernames and Business/Creator handles change at most once every 30 days (was 3). The first
--    username comes from signup and a first Mode handle claim has no earlier change, so neither waits.
-- 2. Old names are no longer kept forever. After a rename the old name stays its owner's for
--    30 days (they can take it back), then anyone may claim it. Until someone does, it keeps
--    redirecting to the owner's current name. Claiming it removes the redirect.
-- 3. An owner holds one old name per Mode: renaming again releases the previous one at once.
-- 4. Changed your mind: switching back to the name you just left is allowed once inside the
--    30 days (it counts as a change, so there's no flipping back and forth).
-- Setuvara QR codes, Tap and /s/ links point at the account, not the name, so they never move.
-- An old name is "held" while released_at is null and it was retired under 30 days ago.

create or replace function private.handle_held(p_released_at timestamptz, p_retired_at timestamptz)
returns boolean language sql stable set search_path = '' as $function$
  select p_released_at is null and p_retired_at > pg_catalog.statement_timestamp() - interval '30 days'
$function$;
revoke all on function private.handle_held(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function private.handle_free_for(p_handle text, p_profile uuid, p_mode_id uuid default null)
returns text language sql stable security definer set search_path = '' as $function$
  select case
    when p_handle !~ '^[a-z0-9_]{3,24}$' then 'invalid'
    when exists (select 1 from private.reserved_handles r where r.handle = p_handle) then 'reserved'
    when exists (select 1 from public.profiles p where p.username = p_handle) then 'taken'
    when exists (select 1 from public.mode_handles m where m.handle = p_handle and m.mode_id is distinct from p_mode_id) then 'taken'
    -- A deleted account's name (no owner) is held from everyone, signed in or not.
    when exists (select 1 from public.handle_history h where h.handle = p_handle and (h.profile_id is null or h.profile_id is distinct from p_profile) and private.handle_held(h.released_at, h.retired_at)) then 'taken'
    else 'free'
  end
$function$;

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
  if exists (select 1 from public.handle_history h where h.handle = new.username and h.profile_id is distinct from new.id and private.handle_held(h.released_at, h.retired_at)) then
    raise exception using errcode = '23505', message = 'username_held';
  end if;
  if exists (select 1 from public.mode_handles m where m.handle = new.username) then
    raise exception using errcode = '23505', message = 'username_taken';
  end if;
  if tg_op = 'UPDATE' then
    select pg_catalog.count(*) into recent from private.username_changes c
    where c.profile_id = new.id and c.changed_at > pg_catalog.statement_timestamp() - interval '30 days';
    if recent >= 1 and not (recent = 1 and exists (select 1 from public.handle_history h where h.handle = new.username and h.profile_id = new.id and h.mode_slug = 'personal' and private.handle_held(h.released_at, h.retired_at))) then
      raise exception using errcode = 'P0001', message = 'username_change_limit';
    end if;
  end if;
  -- Someone else's released old name: claiming it ends its redirect.
  delete from public.handle_history h where h.handle = new.username and h.profile_id is distinct from new.id;
  return new;
end;
$function$;

create or replace function public.claim_mode_handle(p_mode text, p_handle text)
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
  if recent >= 1 and not (recent = 1 and exists (select 1 from public.handle_history h where h.handle = name and h.profile_id = me and h.mode_slug = p_mode and private.handle_held(h.released_at, h.retired_at))) then
    raise exception using errcode = 'P0001', message = 'handle_change_limit';
  end if;

  -- Free means not held by anyone else: taking it ends any redirect it had.
  delete from public.handle_history where handle = name;
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

-- A changed or released Mode handle is held for its owner; their earlier ones for that Mode are released.
create or replace function private.keep_mode_handle()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if tg_op = 'UPDATE' and new.handle = old.handle then return null; end if;
  update public.handle_history set released_at = pg_catalog.statement_timestamp()
  where profile_id = old.profile_id and mode_slug = old.mode_slug and released_at is null;
  insert into public.handle_history (handle, profile_id, mode_slug)
  values (old.handle, (select p.id from public.profiles p where p.id = old.profile_id), old.mode_slug)
  on conflict (handle) do update set profile_id = excluded.profile_id, mode_slug = excluded.mode_slug,
    retired_at = pg_catalog.statement_timestamp(), released_at = null;
  return null;
end;
$function$;

-- After a rename: hold the old username for its owner; release their earlier old usernames.
create or replace function private.record_username_change()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if new.username is not distinct from old.username then return new; end if;
  delete from private.username_changes where profile_id = new.id and changed_at <= pg_catalog.statement_timestamp() - interval '30 days';
  insert into private.username_changes (profile_id) values (new.id);
  delete from public.handle_history where handle = new.username;
  update public.handle_history set released_at = pg_catalog.statement_timestamp()
  where profile_id = new.id and mode_slug = 'personal' and released_at is null;
  insert into public.handle_history (handle, profile_id, mode_slug)
  values (old.username, new.id, 'personal')
  on conflict (handle) do update set profile_id = excluded.profile_id, mode_slug = excluded.mode_slug,
    retired_at = pg_catalog.statement_timestamp(), released_at = null;
  return new;
end;
$function$;

-- Old names redirect (one hop, same owner) while held and after release, until someone claims them.
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
  limit 1
$function$;

-- For the editor: when the owner may change this name again (null = now), and the name they just
-- left if they can still switch back to it (null otherwise). Signed-in owner only.
create or replace function public.handle_change_state(p_mode text default 'personal')
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare
  me uuid := (select auth.uid());
  last_change timestamptz;
  recent integer;
  back text;
begin
  if me is null then raise exception using errcode = '42501', message = 'sign_in'; end if;
  if p_mode = 'personal' then
    select pg_catalog.max(c.changed_at), pg_catalog.count(*) filter (where c.changed_at > pg_catalog.statement_timestamp() - interval '30 days')
    into last_change, recent from private.username_changes c where c.profile_id = me;
  elsif p_mode in ('business','creator') then
    select pg_catalog.max(c.changed_at), pg_catalog.count(*) filter (where c.changed_at > pg_catalog.statement_timestamp() - interval '30 days')
    into last_change, recent from private.mode_handle_changes c where c.profile_id = me and c.mode_slug = p_mode;
  else
    raise exception using errcode = '22023', message = 'mode_not_supported';
  end if;
  if last_change is null or last_change + interval '30 days' <= pg_catalog.statement_timestamp() then
    return pg_catalog.jsonb_build_object('next_change_at', null, 'switch_back', null);
  end if;
  if recent = 1 then
    select h.handle into back from public.handle_history h
    where h.profile_id = me and h.mode_slug = p_mode and private.handle_held(h.released_at, h.retired_at)
    order by h.retired_at desc limit 1;
  end if;
  return pg_catalog.jsonb_build_object('next_change_at', last_change + interval '30 days', 'switch_back', back);
end;
$function$;
revoke all on function public.handle_change_state(text) from public, anon;
grant execute on function public.handle_change_state(text) to authenticated;
