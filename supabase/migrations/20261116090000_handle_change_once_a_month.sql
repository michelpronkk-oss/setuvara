-- Handle changes: once every 30 days (was 3), for usernames and for Business/Creator handles.
-- The first username comes from signup and the first Mode handle claim has no earlier change, so
-- neither waits. Old names still stay with their owner and redirect, as before.
-- Replaces two functions (only the limit changes) and adds handle_next_change_at for the editor.

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
    if recent >= 1 then
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
  if recent >= 1 then raise exception using errcode = 'P0001', message = 'handle_change_limit'; end if;
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

-- When the signed-in owner may change this handle again; null means now.
create or replace function public.handle_next_change_at(p_mode text default 'personal')
returns timestamptz language plpgsql stable security definer set search_path = '' as $function$
declare
  me uuid := (select auth.uid());
  last_change timestamptz;
begin
  if me is null then raise exception using errcode = '42501', message = 'sign_in'; end if;
  if p_mode = 'personal' then
    select pg_catalog.max(c.changed_at) into last_change from private.username_changes c where c.profile_id = me;
  elsif p_mode in ('business','creator') then
    select pg_catalog.max(c.changed_at) into last_change from private.mode_handle_changes c where c.profile_id = me and c.mode_slug = p_mode;
  else
    raise exception using errcode = '22023', message = 'mode_not_supported';
  end if;
  if last_change is null or last_change + interval '30 days' <= pg_catalog.statement_timestamp() then return null; end if;
  return last_change + interval '30 days';
end;
$function$;
revoke all on function public.handle_next_change_at(text) from public, anon;
grant execute on function public.handle_next_change_at(text) to authenticated;
