-- Creator Mode is a fourth public identity Mode. Creator monetization remains a
-- separate, trusted workflow with no payment or verification provider attached.

alter table public.profile_modes drop constraint if exists profile_modes_slug_check;
alter table public.profile_modes add constraint profile_modes_slug_check
  check (slug in ('personal', 'event', 'business', 'creator'));

alter table public.connection_encounters drop constraint if exists connection_encounters_shared_mode_slug_check;
alter table public.connection_encounters drop constraint if exists connection_encounters_share_back_mode_slug_check;
alter table public.connection_encounters add constraint connection_encounters_shared_mode_slug_check
  check (shared_mode_slug in ('personal','event','business','creator'));
alter table public.connection_encounters add constraint connection_encounters_share_back_mode_slug_check
  check (share_back_mode_slug is null or share_back_mode_slug in ('personal','event','business','creator'));

alter table private.product_analytics_events drop constraint if exists product_analytics_events_mode_slug_check;
alter table private.product_analytics_events add constraint product_analytics_events_mode_slug_check
  check (mode_slug is null or mode_slug in ('personal','event','business','creator'));
alter table public.tap_events drop constraint if exists tap_events_mode_slug_check;
alter table public.tap_events add constraint tap_events_mode_slug_check
  check (mode_slug is null or mode_slug in ('personal','event','business','creator'));

-- These established RPCs resolve/authorize a Mode by slug. Extend only their
-- accepted slug lists; mode-specific Event snapshots stay Event-only.
do $migration$
declare routine record; definition text; expanded text;
begin
  for routine in
    select p.oid
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f' and n.nspname in ('public','private')
      and p.prosrc like '%personal%'
      and p.prosrc like '%business%'
  loop
    definition := pg_catalog.pg_get_functiondef(routine.oid);
    expanded := replace(definition, '''personal'', ''event'', ''business''', '''personal'', ''event'', ''business'', ''creator''');
    expanded := replace(expanded, '''personal'',''event'',''business''', '''personal'',''event'',''business'',''creator''');
    expanded := replace(expanded, '''personal'', ''event'',''business''', '''personal'', ''event'',''business'', ''creator''');
    if expanded is distinct from definition then execute expanded; end if;
  end loop;
end;
$migration$;

-- Preserve the existing strict validation for the three established Modes and
-- add a deliberately small Creator settings contract. Appearance remains
-- Mode-scoped and uses the shared curated system.
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
    when 'creator' then
      settings - array['tagline','category'] = '{}'::jsonb
      and (not settings ? 'tagline' or (jsonb_typeof(settings->'tagline')='string' and char_length(settings->>'tagline')<=280))
      and (not settings ? 'category' or (jsonb_typeof(settings->'category')='string' and char_length(settings->>'category')<=80))
    else false
  end
);

alter table public.profile_modes drop constraint if exists profile_modes_appearance_check;
alter table public.profile_modes add constraint profile_modes_appearance_check check (
  jsonb_typeof(appearance) = 'object'
  and appearance ?& array['theme','accent','layout','imageTreatment']
  and appearance - array['theme','accent','layout','imageTreatment','qrStyle','intensity','card','radius','button','links','soundStyle','portraitZoom','portraitNameSize','portraitShowUsername'] = '{}'::jsonb
  and jsonb_typeof(appearance->'theme') = 'string'
  and appearance->>'theme' in ('light','dark','editorial','noir','signal','studio')
  and jsonb_typeof(appearance->'accent') = 'string' and appearance->>'accent' ~ '^#[0-9A-Fa-f]{6}$'
  and jsonb_typeof(appearance->'layout') = 'string'
  and (appearance->>'layout' in ('portrait','poster','index')
    or (slug='personal' and appearance->>'layout' in ('full-bleed','portrait-editorial'))
    or (slug='event' and appearance->>'layout' in ('event-poster','conference-card'))
    or (slug='business' and appearance->>'layout' in ('structured','editorial-business'))
    or (slug='creator' and appearance->>'layout' in ('full-bleed','portrait-editorial')))
  and jsonb_typeof(appearance->'imageTreatment') = 'string'
  and appearance->>'imageTreatment' in ('full-bleed','portrait','compact','frame')
  and (not (appearance ? 'qrStyle') or appearance->>'qrStyle' in ('standard','accent-frame','label','inverse','rounded'))
  and (not (appearance ? 'intensity') or appearance->>'intensity' in ('quiet','balanced','signal'))
  and (not (appearance ? 'card') or appearance->>'card' in ('flat','outline','soft','layered','editorial'))
  and (not (appearance ? 'radius') or appearance->>'radius' in ('sharp','subtle','soft'))
  and (not (appearance ? 'button') or appearance->>'button' in ('pill','block','editorial','minimal'))
  and (not (appearance ? 'links') or appearance->>'links' in ('icons','list','chips','cards'))
  and (not (appearance ? 'soundStyle') or appearance->>'soundStyle' in ('core','strip','disc','poster'))
  and (not (appearance ? 'portraitZoom') or appearance->>'portraitZoom' in ('100','110','120','130','140'))
  and (not (appearance ? 'portraitNameSize') or appearance->>'portraitNameSize' in ('compact','standard','large','statement'))
  and (not (appearance ? 'portraitShowUsername') or jsonb_typeof(appearance->'portraitShowUsername')='boolean')
);

-- Existing accounts and future auth-trigger provisioning get an unpublished,
-- disabled Creator row. No identity or links are copied from another Mode.
insert into public.profile_modes (profile_id, slug, label, sort_order, is_enabled, appearance)
select p.id, 'creator', 'Creator', 4, false,
       '{"theme":"light","accent":"#FF5A4F","layout":"portrait-editorial","imageTreatment":"portrait"}'::jsonb
from public.profiles p
on conflict (profile_id, slug) do nothing;

create or replace function private.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  requested_username text;
  requested_display_name text;
begin
  requested_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_display_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception using errcode = '23514', message = 'Invalid username';
  end if;
  if char_length(requested_display_name) not between 1 and 80 then requested_display_name := requested_username; end if;
  insert into public.profiles (id, username, display_name) values (new.id, requested_username, requested_display_name);
  insert into public.profile_modes (profile_id, slug, label, sort_order, is_enabled, appearance)
  values (new.id, 'personal', 'Personal', 1, true, '{"theme":"light","accent":"#FF5A4F","layout":"portrait-editorial","imageTreatment":"portrait"}'::jsonb),
         (new.id, 'event', 'Event', 2, true, '{"theme":"light","accent":"#FF5A4F","layout":"conference-card","imageTreatment":"portrait"}'::jsonb),
         (new.id, 'business', 'Business', 3, true, '{"theme":"light","accent":"#FF5A4F","layout":"structured","imageTreatment":"portrait"}'::jsonb),
         (new.id, 'creator', 'Creator', 4, false, '{"theme":"light","accent":"#FF5A4F","layout":"portrait-editorial","imageTreatment":"portrait"}'::jsonb);
  insert into public.equipped_share_states (profile_id, mode_id, intent)
  select new.id, profile_modes.id, 'view_profile'
  from public.profile_modes
  where profile_modes.profile_id = new.id and profile_modes.slug = 'personal';
  return new;
end;
$function$;
revoke all on function private.create_profile_for_new_user() from public, anon, authenticated;

-- The initial caller's migration has one canonical appearance check; Creator
-- shares common system layouts but is never assigned a business/event layout.
-- Add all user-owned follower relationships without exposing follower identity.
create table public.creator_follows (
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  follower_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  primary key (creator_user_id, follower_user_id),
  constraint creator_follows_no_self check (creator_user_id <> follower_user_id)
);
create index creator_follows_by_follower_idx on public.creator_follows (follower_user_id, created_at desc);
alter table public.creator_follows enable row level security;
revoke all on public.creator_follows from public, anon, authenticated;
grant select, insert, delete on public.creator_follows to authenticated;
create policy creator_follows_read_own on public.creator_follows for select to authenticated
  using (follower_user_id = (select auth.uid()));
create policy creator_follows_add_self on public.creator_follows for insert to authenticated
  with check (follower_user_id = (select auth.uid()) and exists (
    select 1 from public.profile_modes m join public.profiles p on p.id=m.profile_id
    where m.profile_id=creator_follows.creator_user_id and m.slug='creator' and m.is_enabled and p.is_published));
create policy creator_follows_remove_self on public.creator_follows for delete to authenticated
  using (follower_user_id = (select auth.uid()));

create table public.creator_monetization_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  application_status text not null default 'not_applied' check (application_status in ('not_applied','applied','under_review','approved','rejected','suspended')),
  kyc_status text not null default 'not_started' check (kyc_status in ('not_started','pending','verified','failed','restricted')),
  payout_status text not null default 'not_connected' check (payout_status in ('not_connected','pending','enabled','restricted','disabled')),
  monetization_status text not null default 'inactive' check (monetization_status in ('inactive','pending','active','suspended')),
  provider text check (provider is null or (provider ~ '^[a-z][a-z0-9_]{1,39}$')),
  provider_account_id text check (provider_account_id is null or char_length(provider_account_id) between 1 and 200),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  terms_version text check (terms_version is null or char_length(terms_version) between 1 and 40),
  terms_accepted_at timestamptz,
  applied_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  check ((terms_version is null) = (terms_accepted_at is null)),
  check (application_status <> 'approved' or approved_at is not null),
  check (application_status <> 'suspended' or suspended_at is not null)
);
create trigger creator_monetization_accounts_set_updated_at before update on public.creator_monetization_accounts
  for each row execute function private.set_updated_at();
alter table public.creator_monetization_accounts enable row level security;
revoke all on public.creator_monetization_accounts from public, anon, authenticated;
grant select on public.creator_monetization_accounts to authenticated;
create function private.creator_monetization_enabled_for_user(p_user_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $function$
begin
  return exists(select 1 from public.creator_monetization_accounts a
    where a.user_id=p_user_id and a.application_status='approved' and a.kyc_status='verified'
      and a.payout_status='enabled' and a.terms_version is not null and a.terms_accepted_at is not null
      and a.suspended_at is null and a.application_status<>'suspended')
    and exists(select 1 from public.creator_payout_accounts pa where pa.creator_user_id=p_user_id
      and pa.status='enabled' and pa.payouts_enabled and pa.details_submitted);
end;
$function$;
revoke all on function private.creator_monetization_enabled_for_user(uuid) from public,anon,authenticated;
create policy creator_monetization_read_owner on public.creator_monetization_accounts for select to authenticated
  using (user_id = (select auth.uid()));

create table public.creator_offers (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('membership','one_time')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  unit_amount_minor bigint not null check (unit_amount_minor > 0 and unit_amount_minor <= 100000000000),
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  archived_at timestamptz,
  unique (creator_user_id, id),
  check ((status = 'archived') = (archived_at is not null))
);
create index creator_offers_owner_status_idx on public.creator_offers (creator_user_id, status, created_at desc);
create trigger creator_offers_set_updated_at before update on public.creator_offers for each row execute function private.set_updated_at();
alter table public.creator_offers enable row level security;
revoke all on public.creator_offers from public, anon, authenticated;
grant select on public.creator_offers to anon, authenticated;
grant insert, update, delete on public.creator_offers to authenticated;
create policy creator_offers_public_active on public.creator_offers for select to anon, authenticated
  using (status = 'active' and exists (select 1 from public.profile_modes m join public.profiles p on p.id=m.profile_id
    where m.profile_id=creator_offers.creator_user_id and m.slug='creator' and m.is_enabled and p.is_published
      and private.creator_monetization_enabled_for_user(p.id)));
create function private.require_creator_monetization_for_active_offer() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if new.status='active' and not private.creator_monetization_enabled_for_user(new.creator_user_id) then
    raise exception using errcode='42501',message='Creator monetization approval is required for active offers';
  end if;
  return new;
end;
$function$;
create trigger creator_offers_require_monetization before insert or update of status on public.creator_offers
  for each row execute function private.require_creator_monetization_for_active_offer();
create policy creator_offers_owner_all on public.creator_offers for all to authenticated
  using (creator_user_id=(select auth.uid())) with check (creator_user_id=(select auth.uid()));

create table public.creator_memberships (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  member_user_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid not null,
  status text not null default 'pending' check (status in ('pending','active','past_due','cancelled','expired','refunded','suspended')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  provider text check (provider is null or provider ~ '^[a-z][a-z0-9_]{1,39}$'),
  provider_subscription_id text check (provider_subscription_id is null or char_length(provider_subscription_id) <= 200),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  foreign key (creator_user_id, offer_id) references public.creator_offers(creator_user_id,id) on delete restrict,
  check (creator_user_id <> member_user_id),
  check (current_period_end is null or current_period_start is not null and current_period_start < current_period_end),
  unique (provider, provider_subscription_id)
);
create index creator_memberships_creator_status_idx on public.creator_memberships (creator_user_id,status,current_period_end desc);
create index creator_memberships_member_status_idx on public.creator_memberships (member_user_id,status,current_period_end desc);
create trigger creator_memberships_set_updated_at before update on public.creator_memberships for each row execute function private.set_updated_at();
alter table public.creator_memberships enable row level security;
revoke all on public.creator_memberships from public, anon, authenticated;
grant select on public.creator_memberships to authenticated;
create policy creator_memberships_participant_read on public.creator_memberships for select to authenticated
  using (member_user_id=(select auth.uid()) or creator_user_id=(select auth.uid()));

create table public.creator_content_rules (
  profile_block_id uuid primary key references public.profile_blocks(id) on delete cascade,
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  access_level text not null check (access_level in ('public','followers','members','purchase')),
  offer_id uuid,
  teaser_title text check (teaser_title is null or char_length(teaser_title) <= 120),
  teaser_text text check (teaser_text is null or char_length(teaser_text) <= 500),
  teaser_image_url text check (teaser_image_url is null or (char_length(teaser_image_url) <= 2048 and teaser_image_url ~ '^https://')),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  foreign key (creator_user_id, offer_id) references public.creator_offers(creator_user_id,id) on delete restrict,
  check ((access_level='purchase' and offer_id is not null) or (access_level<>'purchase'))
);
create index creator_content_rules_owner_level_idx on public.creator_content_rules(creator_user_id,access_level);
create trigger creator_content_rules_set_updated_at before update on public.creator_content_rules for each row execute function private.set_updated_at();
create function private.validate_creator_content_rule() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if not exists (select 1 from public.profile_blocks b join public.profile_modes m on m.id=b.mode_id
    where b.id=new.profile_block_id and b.profile_id=new.creator_user_id and m.profile_id=new.creator_user_id and m.slug='creator') then
    raise exception using errcode='23514', message='Creator access rules require a Creator Mode block';
  end if;
  if new.offer_id is not null and not exists(select 1 from public.creator_offers o where o.id=new.offer_id
    and o.creator_user_id=new.creator_user_id and o.kind=case when new.access_level='purchase' then 'one_time' else 'membership' end
    and o.status<>'archived') then
    raise exception using errcode='23514', message='Creator content rules require a compatible non-archived offer';
  end if;
  return new;
end;
$function$;
create trigger creator_content_rules_validate before insert or update on public.creator_content_rules
  for each row execute function private.validate_creator_content_rule();
alter table public.creator_content_rules enable row level security;
revoke all on public.creator_content_rules from public, anon, authenticated;
grant select on public.creator_content_rules to anon, authenticated;
grant insert, update, delete on public.creator_content_rules to authenticated;
create policy creator_content_rules_public_teaser on public.creator_content_rules for select to anon, authenticated
  using (exists(select 1 from public.profiles p join public.profile_modes m on m.profile_id=p.id
    where p.id=creator_content_rules.creator_user_id and p.is_published and m.slug='creator' and m.is_enabled));
create policy creator_content_rules_owner_manage on public.creator_content_rules for all to authenticated
  using (creator_user_id=(select auth.uid())) with check (creator_user_id=(select auth.uid()));

create table public.creator_drops (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  profile_block_id uuid not null references public.profile_blocks(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  status text not null default 'draft' check (status in ('draft','scheduled','live','ended','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  offer_id uuid,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  foreign key (creator_user_id,offer_id) references public.creator_offers(creator_user_id,id) on delete restrict,
  check (ends_at is null or starts_at is not null and starts_at < ends_at),
  check (status<>'scheduled' or starts_at is not null)
);
create index creator_drops_owner_status_start_idx on public.creator_drops(creator_user_id,status,starts_at);
create trigger creator_drops_set_updated_at before update on public.creator_drops for each row execute function private.set_updated_at();
create function private.validate_creator_drop() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if not exists(select 1 from public.profile_blocks b join public.profile_modes m on m.id=b.mode_id
    where b.id=new.profile_block_id and b.profile_id=new.creator_user_id and m.profile_id=new.creator_user_id and m.slug='creator') then
    raise exception using errcode='23514', message='Creator Drops require Creator Mode content';
  end if;
  return new;
end;
$function$;
create trigger creator_drops_validate before insert or update on public.creator_drops for each row execute function private.validate_creator_drop();

drop policy creator_content_rules_public_teaser on public.creator_content_rules;
create function public.creator_block_teaser_available(p_profile_block_id uuid)
returns boolean language sql stable security definer set search_path='' as $function$
  select exists(select 1 from public.profile_blocks b join public.profile_modes m on m.id=b.mode_id
      join public.profiles p on p.id=b.profile_id
    where b.id=p_profile_block_id and b.is_visible and p.is_published and m.slug='creator' and m.is_enabled)
    and not exists(select 1 from public.creator_drops d where d.profile_block_id=p_profile_block_id
      and (d.status in ('draft','cancelled','ended') or (d.starts_at is not null and d.starts_at>pg_catalog.statement_timestamp())
        or (d.ends_at is not null and d.ends_at<=pg_catalog.statement_timestamp())))
$function$;
revoke all on function public.creator_block_teaser_available(uuid) from public;
grant execute on function public.creator_block_teaser_available(uuid) to anon,authenticated;
create policy creator_content_rules_public_teaser on public.creator_content_rules for select to anon,authenticated
  using (public.creator_block_teaser_available(creator_content_rules.profile_block_id));
alter table public.creator_drops enable row level security;
revoke all on public.creator_drops from public, anon, authenticated;
grant select on public.creator_drops to anon,authenticated;
grant insert,update,delete on public.creator_drops to authenticated;
create policy creator_drops_public_live on public.creator_drops for select to anon,authenticated
  using (status in ('live','scheduled')
    and (starts_at is null or starts_at<=pg_catalog.statement_timestamp())
    and (ends_at is null or ends_at>pg_catalog.statement_timestamp())
    and exists(select 1 from public.profiles p join public.profile_modes m on m.profile_id=p.id
      where p.id=creator_drops.creator_user_id and p.is_published and m.slug='creator' and m.is_enabled));
create policy creator_drops_owner_all on public.creator_drops for all to authenticated
  using (creator_user_id=(select auth.uid())) with check (creator_user_id=(select auth.uid()));

create table public.creator_access_grants (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid not null,
  profile_block_id uuid references public.profile_blocks(id) on delete cascade,
  source text not null check (source in ('purchase','membership','admin')),
  order_id uuid,
  starts_at timestamptz not null default pg_catalog.statement_timestamp(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  foreign key (creator_user_id,offer_id) references public.creator_offers(creator_user_id,id) on delete restrict,
  check (creator_user_id <> user_id),
  check (expires_at is null or starts_at < expires_at),
  check ((source='purchase' and order_id is not null) or source<>'purchase')
);
create unique index creator_access_grants_order_block_uidx on public.creator_access_grants(order_id,profile_block_id) where order_id is not null;
create index creator_access_grants_user_access_idx on public.creator_access_grants(user_id,creator_user_id,expires_at) where revoked_at is null;
create index creator_access_grants_block_access_idx on public.creator_access_grants(profile_block_id,user_id,expires_at) where revoked_at is null;
alter table public.creator_access_grants enable row level security;
revoke all on public.creator_access_grants from public, anon, authenticated;
grant select on public.creator_access_grants to authenticated;
create policy creator_access_grants_participant_read on public.creator_access_grants for select to authenticated
  using (user_id=(select auth.uid()) or creator_user_id=(select auth.uid()));

create table public.creator_fee_policies (
  id uuid primary key default gen_random_uuid(),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  platform_fee_bps integer not null check (platform_fee_bps between 0 and 10000),
  effective_from timestamptz not null,
  effective_until timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  check (effective_until is null or effective_from < effective_until)
);
create index creator_fee_policies_effective_idx on public.creator_fee_policies(currency,effective_from desc);
alter table public.creator_fee_policies enable row level security;
revoke all on public.creator_fee_policies from public, anon, authenticated;
grant all on public.creator_fee_policies to service_role;
create function private.reject_creator_fee_policy_mutation() returns trigger language plpgsql set search_path='' as $function$
begin raise exception using errcode='23514',message='Creator fee policies are versioned; add a new effective policy'; end;
$function$;
create trigger creator_fee_policies_append_only before update or delete on public.creator_fee_policies
  for each row execute function private.reject_creator_fee_policy_mutation();
create function public.creator_fee_policy_for_currency(p_currency text)
returns integer language sql stable security definer set search_path='' as $function$
  select f.platform_fee_bps from public.creator_fee_policies f
  where f.currency=p_currency and f.effective_from<=pg_catalog.statement_timestamp()
    and (f.effective_until is null or f.effective_until>pg_catalog.statement_timestamp())
  order by f.effective_from desc limit 1
$function$;
revoke all on function public.creator_fee_policy_for_currency(text) from public,anon,authenticated;
grant execute on function public.creator_fee_policy_for_currency(text) to service_role;

create table public.creator_orders (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  buyer_user_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  gross_amount_minor bigint not null check (gross_amount_minor > 0),
  platform_fee_bps integer not null check (platform_fee_bps between 0 and 10000),
  platform_fee_amount_minor bigint not null check (platform_fee_amount_minor >= 0),
  payment_fee_amount_minor bigint not null default 0 check (payment_fee_amount_minor >= 0),
  creator_net_amount_minor bigint not null check (creator_net_amount_minor >= 0),
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','cancelled','refunded','partially_refunded','charged_back')),
  provider text check (provider is null or provider ~ '^[a-z][a-z0-9_]{1,39}$'),
  provider_payment_id text check (provider_payment_id is null or char_length(provider_payment_id) <= 200),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  paid_at timestamptz,
  refunded_at timestamptz,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  foreign key (creator_user_id,offer_id) references public.creator_offers(creator_user_id,id) on delete restrict,
  check (creator_user_id <> buyer_user_id),
  check (platform_fee_amount_minor + payment_fee_amount_minor + creator_net_amount_minor = gross_amount_minor),
  unique (buyer_user_id,idempotency_key),
  unique (provider,provider_payment_id)
);
create index creator_orders_creator_status_idx on public.creator_orders(creator_user_id,status,created_at desc);
create index creator_orders_buyer_status_idx on public.creator_orders(buyer_user_id,status,created_at desc);
create trigger creator_orders_set_updated_at before update on public.creator_orders for each row execute function private.set_updated_at();
create function private.protect_creator_order_snapshot() returns trigger language plpgsql set search_path='' as $function$
begin
  if (new.creator_user_id,new.buyer_user_id,new.offer_id,new.currency,new.gross_amount_minor,new.platform_fee_bps,
      new.platform_fee_amount_minor,new.payment_fee_amount_minor,new.creator_net_amount_minor,new.idempotency_key,new.created_at)
     is distinct from
     (old.creator_user_id,old.buyer_user_id,old.offer_id,old.currency,old.gross_amount_minor,old.platform_fee_bps,
      old.platform_fee_amount_minor,old.payment_fee_amount_minor,old.creator_net_amount_minor,old.idempotency_key,old.created_at) then
    raise exception using errcode='23514',message='Creator order snapshots are immutable';
  end if;
  return new;
end;
$function$;
create trigger creator_orders_snapshot_immutable before update on public.creator_orders for each row execute function private.protect_creator_order_snapshot();
alter table public.creator_orders enable row level security;
revoke all on public.creator_orders from public, anon, authenticated;
grant select on public.creator_orders to authenticated;
create policy creator_orders_participant_read on public.creator_orders for select to authenticated
  using (buyer_user_id=(select auth.uid()) or creator_user_id=(select auth.uid()));

alter table public.creator_access_grants add constraint creator_access_grants_order_fk
  foreign key (order_id) references public.creator_orders(id) on delete restrict;

create table public.creator_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{1,39}$'),
  provider_event_id text not null check (char_length(provider_event_id) between 1 and 200),
  event_type text not null check (char_length(event_type) between 1 and 120),
  processing_status text not null default 'received' check (processing_status in ('received','processing','processed','ignored','failed')),
  received_at timestamptz not null default pg_catalog.statement_timestamp(),
  processed_at timestamptz,
  safe_error_code text check (safe_error_code is null or safe_error_code ~ '^[a-z0-9_]{1,80}$'),
  unique (provider,provider_event_id)
);
create index creator_payment_events_processing_idx on public.creator_payment_events(processing_status,received_at);
alter table public.creator_payment_events enable row level security;
revoke all on public.creator_payment_events from public, anon, authenticated;

create table public.creator_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  entry_type text not null check (entry_type in ('sale','platform_fee','payment_fee','refund','chargeback','payout','adjustment')),
  amount_minor bigint not null check (amount_minor <> 0),
  order_id uuid references public.creator_orders(id) on delete restrict,
  payout_id uuid,
  provider_event_id text,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  check ((entry_type in ('sale','platform_fee','payment_fee','refund','chargeback') and order_id is not null)
      or (entry_type='payout' and payout_id is not null) or entry_type='adjustment'),
  check ((entry_type='sale' and amount_minor>0)
      or (entry_type in ('platform_fee','payment_fee','refund','chargeback','payout') and amount_minor<0)
      or entry_type='adjustment'),
  check (entry_type<>'refund' or provider_event_id is not null)
);
create unique index creator_ledger_provider_event_uidx on public.creator_ledger_entries(provider_event_id,entry_type) where provider_event_id is not null;
create unique index creator_ledger_order_once_uidx on public.creator_ledger_entries(order_id,entry_type)
  where order_id is not null and entry_type in ('sale','platform_fee','payment_fee','chargeback');
create index creator_ledger_balance_idx on public.creator_ledger_entries(creator_user_id,currency,created_at,id);
alter table public.creator_ledger_entries enable row level security;
revoke all on public.creator_ledger_entries from public, anon, authenticated;
grant select on public.creator_ledger_entries to authenticated;
create policy creator_ledger_read_owner on public.creator_ledger_entries for select to authenticated
  using (creator_user_id=(select auth.uid()));
create function private.reject_creator_ledger_mutation() returns trigger language plpgsql set search_path='' as $function$
begin raise exception using errcode='23514',message='Creator ledger entries are append-only'; end;
$function$;
create trigger creator_ledger_entries_no_update before update or delete on public.creator_ledger_entries
  for each row execute function private.reject_creator_ledger_mutation();

create table public.creator_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{1,39}$'),
  provider_account_id text not null check (char_length(provider_account_id) between 1 and 200),
  status text not null default 'not_connected' check (status in ('not_connected','pending','enabled','restricted','disabled')),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (provider,provider_account_id),
  unique (creator_user_id,provider)
);
create index creator_payout_accounts_owner_status_idx on public.creator_payout_accounts(creator_user_id,status);
create trigger creator_payout_accounts_set_updated_at before update on public.creator_payout_accounts for each row execute function private.set_updated_at();
alter table public.creator_payout_accounts enable row level security;
revoke all on public.creator_payout_accounts from public, anon, authenticated;
grant select on public.creator_payout_accounts to authenticated;
create policy creator_payout_accounts_read_owner on public.creator_payout_accounts for select to authenticated using (creator_user_id=(select auth.uid()));

create table public.creator_payouts (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','cancelled')),
  provider text check (provider is null or provider ~ '^[a-z][a-z0-9_]{1,39}$'),
  provider_payout_id text check (provider_payout_id is null or char_length(provider_payout_id) <= 200),
  requested_at timestamptz not null default pg_catalog.statement_timestamp(),
  processing_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (provider,provider_payout_id)
);
create index creator_payouts_owner_status_idx on public.creator_payouts(creator_user_id,status,requested_at desc);
create trigger creator_payouts_set_updated_at before update on public.creator_payouts for each row execute function private.set_updated_at();
alter table public.creator_payouts enable row level security;
revoke all on public.creator_payouts from public, anon, authenticated;
grant select on public.creator_payouts to authenticated;
create policy creator_payouts_read_owner on public.creator_payouts for select to authenticated using (creator_user_id=(select auth.uid()));
alter table public.creator_ledger_entries add constraint creator_ledger_payout_fk foreign key(payout_id) references public.creator_payouts(id) on delete restrict;

create function private.validate_creator_access_grant() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if new.source='purchase' and not exists(select 1 from public.creator_orders o
    where o.id=new.order_id and o.creator_user_id=new.creator_user_id and o.buyer_user_id=new.user_id
      and o.offer_id=new.offer_id and o.status='paid') then
    raise exception using errcode='23514',message='Purchase grants require a matching paid order';
  end if;
  return new;
end;
$function$;
create trigger creator_access_grants_validate before insert or update on public.creator_access_grants
  for each row execute function private.validate_creator_access_grant();

-- The only access decision used by block RLS, storage RLS, and future server
-- code. No Creator rule means public for compatibility. A rule's teaser fields
-- are deliberately stored separately from the protected profile_blocks.data.
create or replace function public.can_view_creator_block(p_profile_block_id uuid)
returns boolean language sql stable security definer set search_path='' as $function$
  select case
    when exists(select 1 from public.profile_blocks b join public.profile_modes m on m.id=b.mode_id
      where b.id=p_profile_block_id and b.profile_id=auth.uid() and m.slug='creator') then true
    when not public.creator_block_teaser_available(p_profile_block_id) then false
    when not exists(select 1 from public.profile_blocks b join public.profile_modes m on m.id=b.mode_id
      where b.id=p_profile_block_id and m.slug='creator') then true
    when not exists(select 1 from public.creator_content_rules r where r.profile_block_id=p_profile_block_id) then true
    when (select r.access_level from public.creator_content_rules r where r.profile_block_id=p_profile_block_id)='public' then true
    when auth.uid() is null then false
    when (select r.access_level from public.creator_content_rules r where r.profile_block_id=p_profile_block_id)='followers' then exists(
      select 1 from public.creator_content_rules r join public.creator_follows f
        on f.creator_user_id=r.creator_user_id and f.follower_user_id=auth.uid()
      where r.profile_block_id=p_profile_block_id)
    when (select r.access_level from public.creator_content_rules r where r.profile_block_id=p_profile_block_id)='members' then exists(
      select 1 from public.creator_content_rules r join public.creator_memberships m
        on m.creator_user_id=r.creator_user_id and m.member_user_id=auth.uid()
      where r.profile_block_id=p_profile_block_id and m.status='active'
        and (m.current_period_end is null or m.current_period_end > pg_catalog.statement_timestamp()))
    when (select r.access_level from public.creator_content_rules r where r.profile_block_id=p_profile_block_id)='purchase' then exists(
      select 1 from public.creator_content_rules r join public.creator_access_grants g
        on g.creator_user_id=r.creator_user_id and g.user_id=auth.uid()
      where r.profile_block_id=p_profile_block_id and (g.profile_block_id is null or g.profile_block_id=p_profile_block_id)
        and g.offer_id=r.offer_id
        and g.revoked_at is null and g.starts_at <= pg_catalog.statement_timestamp()
        and (g.expires_at is null or g.expires_at > pg_catalog.statement_timestamp())
        and (g.source<>'purchase' or not exists(select 1 from public.creator_orders o where o.id=g.order_id and o.status in ('refunded','charged_back'))))
    else false
  end;
$function$;
revoke all on function public.can_view_creator_block(uuid) from public;
grant execute on function public.can_view_creator_block(uuid) to anon,authenticated;

drop policy if exists "owners and published profiles can read visible blocks" on public.profile_blocks;
create policy "owners and authorized published blocks can read"
on public.profile_blocks for select to anon,authenticated using (
  profile_id=(select auth.uid()) or (is_visible and exists(
    select 1 from public.profiles p join public.profile_modes m on m.profile_id=p.id
    where p.id=profile_blocks.profile_id and m.id=profile_blocks.mode_id and p.is_published and m.is_enabled)
    and public.can_view_creator_block(id))
);

drop policy if exists "Public can read visible published block media" on storage.objects;
create policy "Public can read authorized published block media"
on storage.objects for select to anon,authenticated using (
  bucket_id='profile-media' and exists(
    select 1 from public.profile_blocks b join public.profile_modes m on m.id=b.mode_id and m.profile_id=b.profile_id
    join public.profiles p on p.id=b.profile_id
    where (b.data->>'image_path'=storage.objects.name or b.data->>'video_path'=storage.objects.name)
      and split_part(storage.objects.name,'/',1)=b.profile_id::text and b.is_visible and m.is_enabled and p.is_published
      and public.can_view_creator_block(b.id))
);

create function public.get_creator_public_summary(p_username text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object(
    'creator_user_id',p.id,
    'follower_count',(select count(*) from public.creator_follows f where f.creator_user_id=p.id),
    'is_following',case when auth.uid() is null then false else exists(select 1 from public.creator_follows f where f.creator_user_id=p.id and f.follower_user_id=auth.uid()) end,
    'offers',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'kind',o.kind,'title',o.title,'description',o.description,'currency',o.currency,'unit_amount_minor',o.unit_amount_minor) order by o.created_at desc)
      from public.creator_offers o where o.creator_user_id=p.id and o.status='active'
        and private.creator_monetization_enabled_for_user(p.id)),'[]'::jsonb),
    'drops',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'profile_block_id',d.profile_block_id,'title',d.title,'status','live','starts_at',d.starts_at,'ends_at',d.ends_at,'offer_id',d.offer_id))
      from public.creator_drops d where d.creator_user_id=p.id
        and d.status in ('live','scheduled')
        and (d.starts_at is null or d.starts_at<=pg_catalog.statement_timestamp())
        and (d.ends_at is null or d.ends_at>pg_catalog.statement_timestamp())),'[]'::jsonb),
    'locked_content',coalesce((select jsonb_agg(jsonb_build_object('profile_block_id',r.profile_block_id,'access_level',r.access_level,'offer_id',r.offer_id,'teaser_title',r.teaser_title,'teaser_text',r.teaser_text,'teaser_image_url',r.teaser_image_url,'is_accessible',public.can_view_creator_block(r.profile_block_id)))
      from public.creator_content_rules r join public.profile_blocks b on b.id=r.profile_block_id
      where r.creator_user_id=p.id and r.access_level<>'public' and b.is_visible
        and public.creator_block_teaser_available(b.id)),'[]'::jsonb)
  )
  from public.profiles p join public.profile_modes m on m.profile_id=p.id
  where p.username=lower(btrim(p_username)) and p.is_published and m.slug='creator' and m.is_enabled;
$function$;
revoke all on function public.get_creator_public_summary(text) from public;
grant execute on function public.get_creator_public_summary(text) to anon,authenticated;

create function public.creator_follow(p_creator_user_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Sign in required'; end if;
  if p_creator_user_id=auth.uid() then raise exception using errcode='22023',message='You cannot follow yourself'; end if;
  insert into public.creator_follows(creator_user_id,follower_user_id)
    values(p_creator_user_id,auth.uid()) on conflict do nothing;
  return true;
end;
$function$;
create function public.creator_unfollow(p_creator_user_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Sign in required'; end if;
  delete from public.creator_follows where creator_user_id=p_creator_user_id and follower_user_id=auth.uid();
  return true;
end;
$function$;
revoke all on function public.creator_follow(uuid) from public,anon;
revoke all on function public.creator_unfollow(uuid) from public,anon;
grant execute on function public.creator_follow(uuid),public.creator_unfollow(uuid) to authenticated;

create function public.creator_follower_count()
returns bigint language sql stable security definer set search_path='' as $function$
  select count(*) from public.creator_follows f where f.creator_user_id=auth.uid()
$function$;
revoke all on function public.creator_follower_count() from public,anon;
grant execute on function public.creator_follower_count() to authenticated;

create function public.creator_submit_monetization_application(p_country_code text, p_terms_version text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_user_id uuid := auth.uid(); v_row public.creator_monetization_accounts;
begin
  if v_user_id is null then raise exception using errcode='42501',message='Sign in required'; end if;
  if p_country_code !~ '^[A-Z]{2}$' or char_length(p_terms_version) not between 1 and 40 then
    raise exception using errcode='22023',message='Invalid creator application';
  end if;
  insert into public.creator_monetization_accounts(user_id,application_status,country_code,terms_version,terms_accepted_at,applied_at)
    values(v_user_id,'applied',p_country_code,p_terms_version,pg_catalog.statement_timestamp(),pg_catalog.statement_timestamp())
    on conflict(user_id) do update set
      application_status=case when public.creator_monetization_accounts.application_status='rejected' then 'applied' else public.creator_monetization_accounts.application_status end,
      country_code=excluded.country_code,terms_version=excluded.terms_version,terms_accepted_at=excluded.terms_accepted_at,
      applied_at=case when public.creator_monetization_accounts.application_status='rejected' then excluded.applied_at else public.creator_monetization_accounts.applied_at end
    returning * into v_row;
  return jsonb_build_object('application_status',v_row.application_status,'kyc_status',v_row.kyc_status,
    'payout_status',v_row.payout_status,'monetization_status',v_row.monetization_status,'terms_version',v_row.terms_version,
    'applied_at',v_row.applied_at);
end;
$function$;
revoke all on function public.creator_submit_monetization_application(text,text) from public,anon;
grant execute on function public.creator_submit_monetization_application(text,text) to authenticated;

-- No client-facing write capability can approve accounts, settle orders,
-- change KYC/payout status, mint grants, or write/rewrite ledger entries.
create function public.creator_monetization_enabled()
returns boolean language sql stable security definer set search_path='' as $function$
  select private.creator_monetization_enabled_for_user(auth.uid())
$function$;
revoke all on function public.creator_monetization_enabled() from public,anon;
grant execute on function public.creator_monetization_enabled() to authenticated;

grant all on public.creator_monetization_accounts,public.creator_offers,public.creator_memberships,
  public.creator_content_rules,public.creator_drops,public.creator_access_grants,public.creator_orders,
  public.creator_payment_events,public.creator_payout_accounts,public.creator_payouts to service_role;
grant select,insert on public.creator_ledger_entries to service_role;

create function public.creator_get_balance()
returns table(currency text, balance_minor bigint) language sql stable security invoker set search_path='' as $function$
  select e.currency,sum(e.amount_minor)::bigint
  from public.creator_ledger_entries e where e.creator_user_id=auth.uid()
  group by e.currency order by e.currency
$function$;
revoke all on function public.creator_get_balance() from public,anon;
grant execute on function public.creator_get_balance() to authenticated;

comment on table public.creator_follows is 'Creator audience follows; independent of Setuvara Connections and never emits encounters or Passport events.';
comment on table public.creator_monetization_accounts is 'Provider-neutral review state only; never stores identity documents or raw KYC payloads.';
comment on table public.creator_content_rules is 'Access rules and safe teaser metadata for existing Creator Mode profile_blocks.';
comment on function public.can_view_creator_block(uuid) is 'Canonical Creator block access decision used by public.profile_blocks and profile-media object RLS; viewer identity always comes from auth.uid().';
comment on function public.creator_monetization_enabled() is 'True only for the signed-in user when approved + verified + payout-enabled + terms-accepted and not suspended.';
