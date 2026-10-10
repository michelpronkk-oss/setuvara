-- Mode-level Connection Access, part 2: the Connect RPCs enforce the target
-- Mode's connect_policy and accept a Connection Pass token. The actor's own
-- Modes and policies are never consulted for authorization (outbound independence).
drop function public.create_guest_connection(text, text, text, text, text, uuid, text);
drop function public.connect_registered(text, text, text, uuid, text);

create or replace function public.create_guest_connection(
  p_target_username text,
  p_target_mode text,
  p_display_name text,
  p_email text,
  p_session_token text,
  p_request_id uuid,
  p_source text default 'direct',
  p_pass_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_target_id uuid;
  v_target_name text;
  v_mode_id uuid;
  v_policy text;
  v_source text := p_source;
  v_mode_settings jsonb;
  v_guest_id uuid;
  v_guest_name text;
  v_email text;
  v_hash bytea;
  v_connection_id uuid;
  v_encounter_id uuid;
  v_created boolean := false;
  v_count integer;
begin
  if p_target_mode not in ('personal', 'event', 'business')
     or p_source not in ('qr', 'link', 'share', 'native_share', 'profile', 'direct')
     or p_request_id is null
     or p_session_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception using errcode = '22023', message = 'Invalid connection request';
  end if;
  if p_target_username is null or lower(btrim(p_target_username)) !~ '^[a-z0-9_]{3,24}$' then
    raise exception using errcode = '22023', message = 'Profile unavailable';
  end if;

  select profiles.id, profiles.display_name, profile_modes.id, profile_modes.connect_policy, profile_modes.settings
    into v_target_id, v_target_name, v_mode_id, v_policy, v_mode_settings
  from public.profiles
  join public.profile_modes on profile_modes.profile_id = profiles.id
  where profiles.username = lower(btrim(p_target_username))
    and profiles.is_published
    and profile_modes.slug = p_target_mode
    and profile_modes.is_enabled;
  if v_target_id is null then
    raise exception using errcode = '22023', message = 'Profile unavailable';
  end if;
  if v_policy = 'direct_only' and private.connection_pass_authorizes(v_target_id, v_mode_id, p_pass_token) then
    v_source := 'direct_share';
  elsif v_policy <> 'anyone' then
    raise exception using errcode = '42501', message = 'Connections are not open from this Mode';
  end if;

  v_hash := extensions.digest(pg_catalog.convert_to(p_session_token, 'UTF8'), 'sha256');
  select guest_sessions.guest_identity_id into v_guest_id
  from public.guest_sessions
  join public.guest_identities on guest_identities.id = guest_sessions.guest_identity_id
  where guest_sessions.token_hash = v_hash
    and guest_sessions.expires_at > pg_catalog.statement_timestamp()
    and guest_sessions.revoked_at is null
    and guest_identities.claimed_user_id is null
  for update of guest_sessions;

  if v_guest_id is null then
    v_guest_name := pg_catalog.btrim(coalesce(p_display_name, ''));
    v_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
    if char_length(v_guest_name) not between 1 and 80
       or v_guest_name ~ '[[:cntrl:]]'
       or char_length(v_email) > 254
       or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
      raise exception using errcode = '22023', message = 'Enter a name and valid email';
    end if;
    insert into public.guest_identities (display_name, normalized_email)
    values (v_guest_name, v_email)
    returning id into v_guest_id;
    insert into public.guest_sessions (token_hash, guest_identity_id)
    values (v_hash, v_guest_id);
  else
    select guest_identities.display_name into v_guest_name
    from public.guest_identities where id = v_guest_id for update;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_target_id::text || ':' || v_guest_id::text, 0));
  select id into v_connection_id from public.connections
  where user_id = v_target_id and guest_identity_id = v_guest_id for update;
  if v_connection_id is null then
    insert into public.connections (user_id, guest_identity_id, user_display_name_snapshot,
      connected_display_name_snapshot, guest_display_name)
    values (v_target_id, v_guest_id, v_target_name, v_guest_name, v_guest_name)
    on conflict (user_id, guest_identity_id) where guest_identity_id is not null do nothing
    returning id into v_connection_id;
    v_created := v_connection_id is not null;
    if v_connection_id is null then
      select id into v_connection_id from public.connections
      where user_id = v_target_id and guest_identity_id = v_guest_id for update;
    end if;
  end if;

  select id into v_encounter_id from public.connection_encounters
  where request_id = p_request_id and connection_id = v_connection_id and created_by_guest_id = v_guest_id;
  if v_encounter_id is not null then
    return jsonb_build_object('connection_id', v_connection_id, 'encounter_id', v_encounter_id, 'created', v_created);
  end if;
  if exists (select 1 from public.connection_encounters where request_id = p_request_id) then
    raise exception using errcode = '22023', message = 'Invalid connection request';
  end if;

  select count(*) into v_count from public.connection_encounters
  where created_by_guest_id = v_guest_id
    and created_at > pg_catalog.statement_timestamp() - interval '24 hours';
  if v_count >= 25 then
    raise exception using errcode = '22023', message = 'Connection limit reached';
  end if;

  insert into public.connection_encounters (
    connection_id, request_id, created_by_guest_id, shared_by_user_id,
    shared_mode_slug, source, shared_display_name, shared_role, shared_company,
    event_name, city, date_label
  ) values (
    v_connection_id, p_request_id, v_guest_id, v_target_id,
    p_target_mode, v_source, v_target_name,
    case when p_target_mode in ('business', 'event') then nullif(v_mode_settings ->> 'role', '') else null end,
    case when p_target_mode = 'business' then nullif(v_mode_settings ->> 'company', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'eventName', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'city', '') else null end,
    case when p_target_mode = 'event' then nullif(v_mode_settings ->> 'dateLabel', '') else null end
  ) returning id into v_encounter_id;

  return jsonb_build_object('connection_id', v_connection_id, 'encounter_id', v_encounter_id, 'created', v_created);
end;
$function$;

create or replace function public.connect_registered(
  p_target_username text,
  p_target_mode text,
  p_share_back_mode text,
  p_request_id uuid,
  p_source text default 'direct',
  p_pass_token text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_actor_id uuid:=auth.uid(); v_target_id uuid; v_target_name text; v_actor_name text; v_actor_settings jsonb; v_mode_settings jsonb;
  v_mode_id uuid; v_policy text; v_source text:=p_source; v_connection_id uuid; v_encounter_id uuid; v_created boolean:=false; v_count integer;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='Sign in required'; end if;
  if p_target_mode not in('personal','event','business') or p_share_back_mode not in('personal','event','business') or p_source not in('qr','link','share','native_share','profile','direct') or p_request_id is null or p_target_username is null or pg_catalog.lower(pg_catalog.btrim(p_target_username)) !~ '^[a-z0-9_]{3,24}$' then raise exception using errcode='22023',message='Invalid connection request'; end if;
  select id,display_name into v_target_id,v_target_name from public.profiles where username=pg_catalog.lower(pg_catalog.btrim(p_target_username)) and is_published;
  if v_target_id is null or v_target_id=v_actor_id then raise exception using errcode='22023',message='Profile unavailable'; end if;
  select id,settings,connect_policy into v_mode_id,v_mode_settings,v_policy from public.profile_modes where profile_id=v_target_id and slug=p_target_mode and is_enabled;
  if not found then raise exception using errcode='22023',message='Mode unavailable'; end if;
  if v_policy='direct_only' and private.connection_pass_authorizes(v_target_id,v_mode_id,p_pass_token) then v_source:='direct_share';
  elsif v_policy<>'anyone' then raise exception using errcode='42501',message='Connections are not open from this Mode'; end if;
  -- The actor's share-back Mode only has to exist and be on; its connect_policy is irrelevant.
  select settings into v_actor_settings from public.profile_modes where profile_id=v_actor_id and slug=p_share_back_mode and is_enabled;
  if not found then raise exception using errcode='22023',message='Choose an available Mode'; end if;
  select display_name into v_actor_name from public.profiles where id=v_actor_id;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(v_target_id::text,v_actor_id::text)||':'||greatest(v_target_id::text,v_actor_id::text),0));
  select id into v_connection_id from public.connections where(user_id=v_target_id and connected_user_id=v_actor_id)or(user_id=v_actor_id and connected_user_id=v_target_id) for update;
  if v_connection_id is null then
    insert into public.connections(user_id,connected_user_id,user_display_name_snapshot,connected_display_name_snapshot) values(v_target_id,v_actor_id,v_target_name,v_actor_name) on conflict do nothing returning id into v_connection_id;
    v_created:=v_connection_id is not null;
    if v_connection_id is null then select id into v_connection_id from public.connections where(user_id=v_target_id and connected_user_id=v_actor_id)or(user_id=v_actor_id and connected_user_id=v_target_id) for update; end if;
  end if;
  select id into v_encounter_id from public.connection_encounters where request_id=p_request_id and connection_id=v_connection_id and created_by_user_id=v_actor_id;
  if v_encounter_id is not null then return jsonb_build_object('connection_id',v_connection_id,'encounter_id',v_encounter_id,'created',v_created); end if;
  if exists(select 1 from public.connection_encounters where request_id=p_request_id) then raise exception using errcode='22023',message='Invalid connection request'; end if;
  select count(*) into v_count from public.connection_encounters where created_by_user_id=v_actor_id and created_at>pg_catalog.statement_timestamp()-interval '24 hours';
  if v_count>=100 then raise exception using errcode='22023',message='Connection limit reached'; end if;
  insert into public.connection_encounters(connection_id,request_id,created_by_user_id,shared_by_user_id,shared_mode_slug,share_back_mode_slug,share_back_display_name,share_back_role,share_back_company,source,shared_display_name,shared_role,shared_company,event_name,city,date_label,country_code)
  values(v_connection_id,p_request_id,v_actor_id,v_target_id,p_target_mode,p_share_back_mode,v_actor_name,
    case when p_share_back_mode in('business','event') then nullif(v_actor_settings->>'role','') else null end,
    case when p_share_back_mode='business' then nullif(v_actor_settings->>'company','') else null end,v_source,v_target_name,
    case when p_target_mode in('business','event') then nullif(v_mode_settings->>'role','') else null end,
    case when p_target_mode='business' then nullif(v_mode_settings->>'company','') else null end,
    case when p_target_mode='event' then nullif(v_mode_settings->>'eventName','') else null end,
    case when p_target_mode='event' then nullif(v_mode_settings->>'city','') else null end,
    case when p_target_mode='event' then nullif(v_mode_settings->>'dateLabel','') else null end,
    case when p_target_mode='event' and v_mode_settings->>'countryCode' ~ '^[A-Z]{2}$' then v_mode_settings->>'countryCode' else null end
  ) returning id into v_encounter_id;
  return jsonb_build_object('connection_id',v_connection_id,'encounter_id',v_encounter_id,'created',v_created);
end;
$function$;

-- Encounters opened through a Connection Pass are recorded as direct_share.
-- Source is context only; authorization always comes from the validated grant.
alter table public.connection_encounters
  drop constraint connection_encounters_source_check,
  add constraint connection_encounters_source_check
  check (source in ('qr', 'link', 'share', 'native_share', 'profile', 'direct', 'direct_share'));

revoke all on function public.create_guest_connection(text, text, text, text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.connect_registered(text, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_guest_connection(text, text, text, text, text, uuid, text, text) to anon;
grant execute on function public.connect_registered(text, text, text, uuid, text, text) to authenticated;
