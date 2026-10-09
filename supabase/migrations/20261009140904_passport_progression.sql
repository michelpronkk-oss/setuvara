-- Setuvara Passport. Progress is derived from durable unique Connections;
-- repeat Encounters only create deduplicated real-world stamps.
alter table public.connection_encounters add column if not exists country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$');
alter table public.encounter_context add column if not exists country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$');
grant select (country_code) on public.connection_encounters to authenticated;

alter table public.profile_modes drop constraint if exists profile_modes_settings_fields_check;
alter table public.profile_modes add constraint profile_modes_settings_fields_check check (
  case slug
    when 'personal' then
      settings - array['note','location','pronouns'] = '{}'::jsonb
      and (not settings ? 'note' or (jsonb_typeof(settings->'note')='string' and char_length(settings->>'note')<=280))
      and (not settings ? 'location' or (jsonb_typeof(settings->'location')='string' and char_length(settings->>'location')<=80))
      and (not settings ? 'pronouns' or (jsonb_typeof(settings->'pronouns')='string' and char_length(settings->>'pronouns')<=40))
    when 'event' then
      settings - array['eventName','city','countryCode','dateLabel','role','hereToMeet'] = '{}'::jsonb
      and (not settings ? 'eventName' or (jsonb_typeof(settings->'eventName')='string' and char_length(settings->>'eventName')<=100))
      and (not settings ? 'city' or (jsonb_typeof(settings->'city')='string' and char_length(settings->>'city')<=80))
      and (not settings ? 'countryCode' or (jsonb_typeof(settings->'countryCode')='string' and (settings->>'countryCode'='' or settings->>'countryCode' ~ '^[A-Z]{2}$')))
      and (not settings ? 'dateLabel' or (jsonb_typeof(settings->'dateLabel')='string' and char_length(settings->>'dateLabel')<=80))
      and (not settings ? 'role' or (jsonb_typeof(settings->'role')='string' and char_length(settings->>'role')<=80))
      and (not settings ? 'hereToMeet' or (jsonb_typeof(settings->'hereToMeet')='string' and char_length(settings->>'hereToMeet')<=280))
    when 'business' then
      settings - array['role','company','city','description','contactEmail','showContactEmail','bookingLabel','bookingUrl'] = '{}'::jsonb
      and (not settings ? 'role' or (jsonb_typeof(settings->'role')='string' and char_length(settings->>'role')<=80))
      and (not settings ? 'company' or (jsonb_typeof(settings->'company')='string' and char_length(settings->>'company')<=100))
      and (not settings ? 'city' or (jsonb_typeof(settings->'city')='string' and char_length(settings->>'city')<=80))
      and (not settings ? 'description' or (jsonb_typeof(settings->'description')='string' and char_length(settings->>'description')<=280))
      and (not settings ? 'contactEmail' or (jsonb_typeof(settings->'contactEmail')='string' and char_length(settings->>'contactEmail')<=254))
      and (not settings ? 'showContactEmail' or jsonb_typeof(settings->'showContactEmail')='boolean')
      and (not settings ? 'bookingLabel' or (jsonb_typeof(settings->'bookingLabel')='string' and char_length(settings->>'bookingLabel')<=60))
      and (not settings ? 'bookingUrl' or (jsonb_typeof(settings->'bookingUrl')='string' and char_length(settings->>'bookingUrl')<=2048))
    else false
  end
);

create table public.passport_reward_catalog (
  reward_id text primary key check (reward_id ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(name) between 1 and 80),
  category text not null check (category in ('profile_treatment','accent','share_treatment','qr_frame','passport_cover','passport_stamp_style','profile_mark')),
  milestone integer not null check (milestone in (5,10,25,50,100,250,500,1000)),
  rarity text not null check (rarity in ('common','uncommon','rare','signature','legendary')),
  sort_order integer not null unique
);
insert into public.passport_reward_catalog values
('first_circle_stamp','First Circle','passport_stamp_style',5,'common',5),
('paper_passport_cover','Paper Passport','passport_cover',5,'common',10),
('signal_accent','Signal Accent','accent',10,'uncommon',20),
('signal_share','Signal Share','share_treatment',10,'uncommon',25),
('editorial_profile','Editorial Profile','profile_treatment',25,'rare',30),
('signal_50_mark','Signal 50','profile_mark',50,'signature',40),
('coral_qr_frame','Coral Frame','qr_frame',50,'signature',45),
('century_cover','Century Cover','passport_cover',100,'rare',50),
('century_profile','Century Profile','profile_treatment',100,'rare',55),
('connector_treatment','Connector','profile_treatment',250,'signature',60),
('network_share','Network Share','share_treatment',500,'legendary',70),
('thousand_mark','Thousand Met','profile_mark',1000,'legendary',80),
('thousand_cover','Thousand Cover','passport_cover',1000,'legendary',90)
on conflict (reward_id) do nothing;
alter table public.passport_reward_catalog enable row level security;
revoke all on public.passport_reward_catalog from public, anon, authenticated;
grant select on public.passport_reward_catalog to authenticated;
create policy "authenticated users read reward catalog" on public.passport_reward_catalog for select to authenticated using (true);

create table public.passport_milestones (
  user_id uuid not null references public.profiles(id) on delete cascade,
  threshold integer not null check (threshold in (5,10,25,50,100,250,500,1000)),
  unlocked_at timestamptz not null default pg_catalog.statement_timestamp(),
  seen_at timestamptz,
  primary key(user_id,threshold)
);
create table public.passport_entitlements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_id text not null references public.passport_reward_catalog(reward_id) on delete restrict,
  unlocked_at timestamptz not null default pg_catalog.statement_timestamp(),
  primary key(user_id,reward_id)
);
create table public.passport_stamps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stamp_type text not null check (stamp_type in ('milestone','event','city','country')),
  context_key text not null check (char_length(context_key) between 1 and 120),
  title text not null check (char_length(title) between 1 and 100),
  subtitle text check (subtitle is null or char_length(subtitle) <= 120),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  earned_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique(user_id,stamp_type,context_key)
);
create index passport_stamps_user_recent_idx on public.passport_stamps(user_id,earned_at desc);
create index passport_stamps_user_type_idx on public.passport_stamps(user_id,stamp_type);
create table public.passport_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('profile_treatment','accent','share_treatment','qr_frame','passport_cover','passport_stamp_style','profile_mark')),
  reward_id text not null references public.passport_reward_catalog(reward_id) on delete restrict,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  primary key(user_id,category)
);

alter table public.passport_milestones enable row level security;
alter table public.passport_entitlements enable row level security;
alter table public.passport_stamps enable row level security;
alter table public.passport_preferences enable row level security;
revoke all on public.passport_milestones,public.passport_entitlements,public.passport_stamps,public.passport_preferences from public,anon,authenticated;
grant select on public.passport_milestones,public.passport_entitlements,public.passport_stamps,public.passport_preferences to authenticated;
grant select on public.passport_preferences to anon;
create policy "users read own passport milestones" on public.passport_milestones for select to authenticated using ((select auth.uid())=user_id);
create policy "users read own passport entitlements" on public.passport_entitlements for select to authenticated using ((select auth.uid())=user_id);
create policy "users read own passport stamps" on public.passport_stamps for select to authenticated using ((select auth.uid())=user_id);
create policy "users read own passport preferences" on public.passport_preferences for select to authenticated using ((select auth.uid())=user_id);
create policy "public can read chosen public cosmetics" on public.passport_preferences for select to anon,authenticated
  using (category in ('profile_treatment','accent','profile_mark') and exists (
    select 1 from public.profiles where profiles.id=passport_preferences.user_id and profiles.is_published
  ));

create or replace function private.award_passport_milestones(p_user_id uuid,p_at timestamptz)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_count bigint;
begin
  if p_user_id is null then return; end if;
  select count(*) into v_count from public.connections where user_id=p_user_id or connected_user_id=p_user_id;
  insert into public.passport_milestones(user_id,threshold,unlocked_at)
    select p_user_id,l.threshold,p_at from (values(5),(10),(25),(50),(100),(250),(500),(1000)) as l(threshold) where l.threshold<=v_count
    on conflict(user_id,threshold) do nothing;
  insert into public.passport_entitlements(user_id,reward_id,unlocked_at)
    select m.user_id,c.reward_id,m.unlocked_at from public.passport_milestones as m join public.passport_reward_catalog as c on c.milestone=m.threshold where m.user_id=p_user_id
    on conflict(user_id,reward_id) do nothing;
  insert into public.passport_stamps(user_id,stamp_type,context_key,title,subtitle,earned_at)
    select m.user_id,'milestone',m.threshold::text,
      case m.threshold when 5 then 'First Circle' when 10 then 'Ten Met' when 25 then 'In Motion' when 50 then 'Signal 50' when 100 then 'Century' when 250 then 'Connector' when 500 then 'Network 500' when 1000 then 'Thousand Met' end,
      m.threshold::text||' Connections',m.unlocked_at from public.passport_milestones as m where m.user_id=p_user_id
    on conflict(user_id,stamp_type,context_key) do nothing;
end;
$function$;
revoke all on function private.award_passport_milestones(uuid,timestamptz) from public,anon,authenticated;

create or replace function private.on_connection_passport_progress()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if tg_op='INSERT' or old.connected_user_id is distinct from new.connected_user_id then
    perform private.award_passport_milestones(new.user_id,new.created_at);
    if new.connected_user_id is not null then perform private.award_passport_milestones(new.connected_user_id,new.created_at); end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.on_connection_passport_progress() from public,anon,authenticated;
create trigger connections_award_passport_progress after insert or update of connected_user_id on public.connections for each row execute function private.on_connection_passport_progress();

create or replace function private.add_passport_context_stamps(p_user_id uuid,p_event text,p_city text,p_country text,p_at timestamptz)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_event text:=nullif(pg_catalog.regexp_replace(pg_catalog.btrim(p_event),'\s+',' ','g'),''); v_city text:=nullif(pg_catalog.regexp_replace(pg_catalog.btrim(p_city),'\s+',' ','g'),''); v_country text:=nullif(pg_catalog.upper(pg_catalog.btrim(p_country)),'');
begin
  if p_user_id is null then return; end if;
  if v_event is not null then insert into public.passport_stamps(user_id,stamp_type,context_key,title,subtitle,country_code,earned_at) values(p_user_id,'event',pg_catalog.lower(v_event),v_event,pg_catalog.concat_ws(' · ',v_city,extract(year from p_at)::integer::text),v_country,p_at) on conflict(user_id,stamp_type,context_key) do nothing; end if;
  if v_city is not null then insert into public.passport_stamps(user_id,stamp_type,context_key,title,subtitle,country_code,earned_at) values(p_user_id,'city',pg_catalog.lower(v_city),v_city,extract(year from p_at)::integer::text,v_country,p_at) on conflict(user_id,stamp_type,context_key) do nothing; end if;
  if v_country is not null then insert into public.passport_stamps(user_id,stamp_type,context_key,title,subtitle,country_code,earned_at) values(p_user_id,'country',v_country,v_country,extract(year from p_at)::integer::text,v_country,p_at) on conflict(user_id,stamp_type,context_key) do nothing; end if;
end;
$function$;
revoke all on function private.add_passport_context_stamps(uuid,text,text,text,timestamptz) from public,anon,authenticated;

create or replace function private.on_encounter_passport_stamps()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_user_id uuid;
begin
  for v_user_id in select user_id from public.connections where id=new.connection_id union select connected_user_id from public.connections where id=new.connection_id and connected_user_id is not null loop
    perform private.add_passport_context_stamps(v_user_id,new.event_name,new.city,new.country_code,new.created_at);
  end loop;
  return new;
end;
$function$;
revoke all on function private.on_encounter_passport_stamps() from public,anon,authenticated;
create trigger encounters_award_passport_stamps after insert on public.connection_encounters for each row execute function private.on_encounter_passport_stamps();

create or replace function private.snapshot_encounter_event_country()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_country text;
begin
  if new.shared_mode_slug='event' and new.country_code is null then
    select settings->>'countryCode' into v_country from public.profile_modes
      where profile_id=new.shared_by_user_id and slug='event' and is_enabled;
    if v_country ~ '^[A-Z]{2}$' then new.country_code:=v_country; end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.snapshot_encounter_event_country() from public,anon,authenticated;
create trigger encounters_snapshot_event_country before insert on public.connection_encounters
  for each row execute function private.snapshot_encounter_event_country();

create or replace function private.on_context_passport_stamps()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_at timestamptz;
begin
  select created_at into v_at from public.connection_encounters where id=new.encounter_id;
  perform private.add_passport_context_stamps(new.user_id,new.event_label,new.city,new.country_code,coalesce(v_at,new.created_at));
  return new;
end;
$function$;
revoke all on function private.on_context_passport_stamps() from public,anon,authenticated;
create trigger encounter_context_award_passport_stamps after insert or update of city,event_label,country_code on public.encounter_context for each row execute function private.on_context_passport_stamps();

create or replace function public.set_passport_reward(p_category text,p_reward_id text)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='42501',message='Sign in required'; end if;
  if not exists(select 1 from public.passport_reward_catalog c join public.passport_entitlements e on e.reward_id=c.reward_id where e.user_id=v_user_id and c.reward_id=p_reward_id and c.category=p_category) then raise exception using errcode='42501',message='Reward is not unlocked'; end if;
  insert into public.passport_preferences(user_id,category,reward_id,updated_at) values(v_user_id,p_category,p_reward_id,pg_catalog.statement_timestamp()) on conflict(user_id,category) do update set reward_id=excluded.reward_id,updated_at=excluded.updated_at;
  return true;
end;
$function$;
revoke all on function public.set_passport_reward(text,text) from public,anon,authenticated;
grant execute on function public.set_passport_reward(text,text) to authenticated;

create or replace function public.ack_passport_milestone(p_threshold integer)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='42501',message='Sign in required'; end if;
  update public.passport_milestones set seen_at=pg_catalog.statement_timestamp() where user_id=v_user_id and threshold=p_threshold and seen_at is null;
  return found;
end;
$function$;
revoke all on function public.ack_passport_milestone(integer) from public,anon,authenticated;
grant execute on function public.ack_passport_milestone(integer) to authenticated;

create or replace function public.get_passport_overview()
returns jsonb language sql stable security invoker set search_path=''
as $function$
  with who as (select auth.uid() as id), totals as (
    select count(*)::integer as n from public.connections,who where connections.user_id=who.id or connections.connected_user_id=who.id
  ), counts as (
    select count(*) filter(where stamp_type='city')::integer cities,count(*) filter(where stamp_type='event')::integer events,count(*) filter(where stamp_type='country')::integer countries
    from public.passport_stamps,who where passport_stamps.user_id=who.id
  ), milestones as (
    select coalesce(jsonb_agg(jsonb_build_object('threshold',threshold,'unlockedAt',unlocked_at,'seenAt',seen_at) order by threshold),'[]'::jsonb) v from public.passport_milestones,who where user_id=who.id
  ), rewards as (
    select coalesce(jsonb_agg(jsonb_build_object('id',e.reward_id,'name',c.name,'category',c.category,'milestone',c.milestone,'rarity',c.rarity,'unlockedAt',e.unlocked_at) order by c.sort_order),'[]'::jsonb) v
    from public.passport_entitlements e join public.passport_reward_catalog c on c.reward_id=e.reward_id cross join who where e.user_id=who.id
  ), recent_stamps as (
    select passport_stamps.id,stamp_type,context_key,title,subtitle,country_code,earned_at from public.passport_stamps,who where passport_stamps.user_id=who.id order by earned_at desc limit 100
  ), stamps as (
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'type',stamp_type,'key',context_key,'title',title,'subtitle',subtitle,'countryCode',country_code,'earnedAt',earned_at) order by earned_at desc),'[]'::jsonb) v from recent_stamps
  ), preferences as (
    select coalesce(jsonb_object_agg(category,reward_id),'{}'::jsonb) v from public.passport_preferences,who where user_id=who.id
  )
  select jsonb_build_object('connectionCount',totals.n,'cities',counts.cities,'events',counts.events,'countries',counts.countries,'milestones',milestones.v,'rewards',rewards.v,'stamps',stamps.v,'preferences',preferences.v) from totals,counts,milestones,rewards,stamps,preferences
$function$;
revoke all on function public.get_passport_overview() from public,anon;
grant execute on function public.get_passport_overview() to authenticated;

-- Snapshot the Event Mode's optional ISO country onto each real connection encounter.
create or replace function public.connect_registered(p_target_username text,p_target_mode text,p_share_back_mode text,p_request_id uuid,p_source text default 'direct')
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_actor_id uuid:=auth.uid(); v_target_id uuid; v_target_name text; v_actor_name text; v_actor_settings jsonb; v_mode_settings jsonb; v_connection_id uuid; v_encounter_id uuid; v_created boolean:=false; v_count integer;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='Sign in required'; end if;
  if p_target_mode not in('personal','event','business') or p_share_back_mode not in('personal','event','business') or p_source not in('qr','link','share','native_share','profile','direct') or p_request_id is null or p_target_username is null or pg_catalog.lower(pg_catalog.btrim(p_target_username)) !~ '^[a-z0-9_]{3,24}$' then raise exception using errcode='22023',message='Invalid connection request'; end if;
  select id,display_name into v_target_id,v_target_name from public.profiles where username=pg_catalog.lower(pg_catalog.btrim(p_target_username)) and is_published;
  if v_target_id is null or v_target_id=v_actor_id then raise exception using errcode='22023',message='Profile unavailable'; end if;
  select settings into v_mode_settings from public.profile_modes where profile_id=v_target_id and slug=p_target_mode and is_enabled;
  if not found then raise exception using errcode='22023',message='Mode unavailable'; end if;
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
    case when p_share_back_mode='business' then nullif(v_actor_settings->>'company','') else null end,p_source,v_target_name,
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
revoke all on function public.connect_registered(text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.connect_registered(text,text,text,uuid,text) to authenticated;

-- Existing records justify backfilled achievements. Migration time is used because
-- historical threshold-crossing times cannot be reconstructed exactly.
do $backfill$
declare v_user record; v_now timestamptz:=pg_catalog.statement_timestamp();
begin
  for v_user in select id from public.profiles loop perform private.award_passport_milestones(v_user.id,v_now); end loop;
  for v_user in
    select connections.user_id as owner_id,encounter.event_name,encounter.city,encounter.country_code,encounter.created_at
    from public.connections join public.connection_encounters encounter on encounter.connection_id=connections.id
    union all
    select connections.connected_user_id,encounter.event_name,encounter.city,encounter.country_code,encounter.created_at
    from public.connections join public.connection_encounters encounter on encounter.connection_id=connections.id
    where connections.connected_user_id is not null
  loop perform private.add_passport_context_stamps(v_user.owner_id,v_user.event_name,v_user.city,v_user.country_code,v_user.created_at); end loop;
  for v_user in select user_id,event_label,city,country_code,created_at from public.encounter_context loop
    perform private.add_passport_context_stamps(v_user.user_id,v_user.event_label,v_user.city,v_user.country_code,v_user.created_at);
  end loop;
end;
$backfill$;
comment on table public.passport_milestones is 'Private durable milestones derived from unique persistent Connections.';
comment on table public.passport_entitlements is 'Server-awarded cosmetic entitlements; browser roles cannot write.';
comment on table public.passport_stamps is 'Private deduplicated milestone and real-world location stamps.';
comment on table public.passport_preferences is 'Owner-selected earned cosmetics updated through the entitlement-checking RPC.';
