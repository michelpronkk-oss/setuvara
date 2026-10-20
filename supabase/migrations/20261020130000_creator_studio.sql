-- Creator studio: the parts of the Creator Mode design the foundation did not
-- cover. Work stays in Creator Mode profile_blocks and paid offers stay behind
-- monetization approval. This adds:
--   1. Creator page settings (city, sections, collabs availability).
--   2. Store offer types, including external offers that link out and never
--      take payment on Setuvara, so they need no monetization approval.
--   3. Collab inquiries from signed-in members, readable by both sides only.
--   4. A media kit the creator controls field by field.

-- 1. Creator settings. Established Modes keep their exact validation.
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
      settings - array['tagline','category','city','sections','collabsOpen','collabsNote','collabsPitch'] = '{}'::jsonb
      and (not settings ? 'tagline' or (jsonb_typeof(settings->'tagline')='string' and char_length(settings->>'tagline')<=280))
      and (not settings ? 'category' or (jsonb_typeof(settings->'category')='string' and char_length(settings->>'category')<=80))
      and (not settings ? 'city' or (jsonb_typeof(settings->'city')='string' and char_length(settings->>'city')<=80))
      -- The visible page sections, in order. A section left out is hidden.
      and (not settings ? 'sections' or (jsonb_typeof(settings->'sections')='string'
        and settings->>'sections' ~ '^((featured|work|store|collabs)(,(featured|work|store|collabs)){0,3})?$'))
      and (not settings ? 'collabsOpen' or jsonb_typeof(settings->'collabsOpen')='boolean')
      and (not settings ? 'collabsNote' or (jsonb_typeof(settings->'collabsNote')='string' and char_length(settings->>'collabsNote')<=120))
      and (not settings ? 'collabsPitch' or (jsonb_typeof(settings->'collabsPitch')='string' and char_length(settings->>'collabsPitch')<=280))
    else false
  end
);

-- 2. Offer types. Paid kinds still need approved monetization to go active;
-- an external offer only links to the creator's own shop elsewhere.
alter table public.creator_offers
  add column offer_type text not null default 'digital'
    check (offer_type in ('digital','booking','physical','service','external')),
  add column external_url text
    check (external_url is null or (char_length(external_url) <= 2048 and external_url ~ '^https://[^\s/]+')),
  add column sort_order integer not null default 0 check (sort_order between 0 and 1000),
  add constraint creator_offers_external_shape_check check (
    (offer_type = 'external' and external_url is not null and kind = 'one_time')
    or (offer_type <> 'external' and external_url is null)
  );

create or replace function private.require_creator_monetization_for_active_offer() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if new.status='active' and new.offer_type<>'external' and not private.creator_monetization_enabled_for_user(new.creator_user_id) then
    raise exception using errcode='42501',message='Creator monetization approval is required for active offers';
  end if;
  return new;
end;
$function$;
drop trigger if exists creator_offers_require_monetization on public.creator_offers;
create trigger creator_offers_require_monetization before insert or update of status, offer_type on public.creator_offers
  for each row execute function private.require_creator_monetization_for_active_offer();

-- The public read policy called a private function the visitor roles cannot
-- execute, so any visitor read of creator_offers failed. The decision now runs
-- in one definer function and answers only for a live Creator page.
create function public.creator_offer_is_public(p_creator_user_id uuid, p_offer_type text)
returns boolean language sql stable security definer set search_path='' as $function$
  select exists (select 1 from public.profile_modes m join public.profiles p on p.id=m.profile_id
    where m.profile_id=p_creator_user_id and m.slug='creator' and m.is_enabled and p.is_published)
    and (p_offer_type='external' or private.creator_monetization_enabled_for_user(p_creator_user_id))
$function$;
revoke all on function public.creator_offer_is_public(uuid,text) from public;
grant execute on function public.creator_offer_is_public(uuid,text) to anon, authenticated;

drop policy if exists creator_offers_public_active on public.creator_offers;
create policy creator_offers_public_active on public.creator_offers for select to anon, authenticated
  using (status = 'active' and public.creator_offer_is_public(creator_user_id, offer_type));

-- 3. Collab inquiries. Members write only through creator_send_inquiry; the
-- creator moves status only through creator_set_inquiry_status.
create table public.creator_inquiries (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  sender_mode_slug text not null check (sender_mode_slug in ('personal','event','business','creator')),
  sender_display_name text not null check (char_length(btrim(sender_display_name)) between 1 and 80),
  kind text not null check (kind in ('campaign','commission','licensing','speaking')),
  budget text not null check (budget in ('under_2k','2k_5k','5k_10k','10k_plus','unsure')),
  brand text not null default '' check (char_length(brand) <= 100),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  status text not null default 'new' check (status in ('new','in_talks','booked','delivered','declined')),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  check (creator_user_id <> sender_user_id)
);
create index creator_inquiries_creator_idx on public.creator_inquiries (creator_user_id, created_at desc);
create index creator_inquiries_sender_idx on public.creator_inquiries (sender_user_id, created_at desc);
create trigger creator_inquiries_set_updated_at before update on public.creator_inquiries
  for each row execute function private.set_updated_at();
alter table public.creator_inquiries enable row level security;
revoke all on public.creator_inquiries from public, anon, authenticated;
grant select on public.creator_inquiries to authenticated;
grant all on public.creator_inquiries to service_role;
create policy creator_inquiries_participant_read on public.creator_inquiries for select to authenticated
  using (creator_user_id=(select auth.uid()) or sender_user_id=(select auth.uid()));

create function public.creator_send_inquiry(p_creator_username text, p_kind text, p_budget text, p_brand text, p_message text, p_sender_mode text)
returns uuid language plpgsql security definer set search_path='' as $function$
declare
  v_sender uuid := auth.uid();
  v_creator uuid;
  v_name text;
  v_brand text := pg_catalog.btrim(coalesce(p_brand,''));
  v_message text := pg_catalog.btrim(coalesce(p_message,''));
  v_id uuid;
begin
  if v_sender is null then raise exception using errcode='42501',message='Sign in required'; end if;
  if p_kind not in ('campaign','commission','licensing','speaking')
    or p_budget not in ('under_2k','2k_5k','5k_10k','10k_plus','unsure')
    or p_sender_mode not in ('personal','event','business','creator')
    or pg_catalog.char_length(v_brand) > 100
    or pg_catalog.char_length(v_message) not between 1 and 2000 then
    raise exception using errcode='22023',message='Invalid inquiry';
  end if;
  -- Only a published Creator page that is open for collabs takes inquiries.
  select p.id into v_creator from public.profiles p join public.profile_modes m on m.profile_id=p.id
    where p.username=pg_catalog.lower(pg_catalog.btrim(p_creator_username)) and p.is_published
      and m.slug='creator' and m.is_enabled and coalesce((m.settings->>'collabsOpen')::boolean,false);
  if v_creator is null then raise exception using errcode='P0002',message='Not open for collabs'; end if;
  if v_creator = v_sender then raise exception using errcode='22023',message='You cannot send yourself an inquiry'; end if;
  -- The sender writes as one of their own enabled Modes.
  if not exists(select 1 from public.profile_modes m where m.profile_id=v_sender and m.slug=p_sender_mode and m.is_enabled) then
    raise exception using errcode='22023',message='Choose one of your Modes';
  end if;
  -- Serialize per sender so the limits hold under concurrent sends.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('creator_inquiry:'||v_sender::text, 0));
  if (select count(*) from public.creator_inquiries i where i.sender_user_id=v_sender
      and i.created_at > pg_catalog.statement_timestamp() - interval '1 day') >= 5
    or (select count(*) from public.creator_inquiries i where i.sender_user_id=v_sender and i.creator_user_id=v_creator
      and i.created_at > pg_catalog.statement_timestamp() - interval '30 days') >= 2 then
    raise exception using errcode='54000',message='Too many inquiries';
  end if;
  select pg_catalog.left(p.display_name,80) into v_name from public.profiles p where p.id=v_sender;
  insert into public.creator_inquiries(creator_user_id,sender_user_id,sender_mode_slug,sender_display_name,kind,budget,brand,message)
    values(v_creator,v_sender,p_sender_mode,coalesce(nullif(pg_catalog.btrim(v_name),''),'A Setuvara member'),p_kind,p_budget,v_brand,v_message)
    returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.creator_send_inquiry(text,text,text,text,text,text) from public,anon;
grant execute on function public.creator_send_inquiry(text,text,text,text,text,text) to authenticated;

create function public.creator_set_inquiry_status(p_inquiry_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Sign in required'; end if;
  if p_status not in ('new','in_talks','booked','delivered','declined') then
    raise exception using errcode='22023',message='Invalid status';
  end if;
  update public.creator_inquiries set status=p_status where id=p_inquiry_id and creator_user_id=auth.uid();
  return found;
end;
$function$;
revoke all on function public.creator_set_inquiry_status(uuid,text) from public,anon;
grant execute on function public.creator_set_inquiry_status(uuid,text) to authenticated;

-- 4. Media kit. Every number partners see is either the creator's own entry
-- (rates, partners) or Setuvara's; platform counts arrive with platform sign-in.
create function private.creator_rates_valid(p_rates jsonb)
returns boolean language sql immutable set search_path='' as $function$
  select jsonb_typeof(p_rates)='array' and jsonb_array_length(p_rates) <= 6
    and not exists(select 1 from jsonb_array_elements(p_rates) r
      where jsonb_typeof(r) <> 'object'
        or (r - array['label','amount_minor','currency']) <> '{}'::jsonb
        or jsonb_typeof(r->'label') is distinct from 'string'
        or char_length(btrim(r->>'label')) not between 1 and 40
        or jsonb_typeof(r->'amount_minor') is distinct from 'number'
        or (r->>'amount_minor') !~ '^[0-9]{1,11}$'
        or (r->>'amount_minor')::bigint <= 0
        or jsonb_typeof(r->'currency') is distinct from 'string'
        or (r->>'currency') !~ '^[A-Z]{3}$')
$function$;
create function private.creator_partners_valid(p_partners text[])
returns boolean language sql immutable set search_path='' as $function$
  select cardinality(p_partners) <= 12
    and not exists(select 1 from unnest(p_partners) n where n is null or char_length(btrim(n)) not between 1 and 40)
$function$;

create table public.creator_media_kits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  languages text not null default '' check (char_length(languages) <= 60),
  partners text[] not null default '{}',
  rates jsonb not null default '[]'::jsonb,
  contact_email text check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  show_platforms boolean not null default true,
  show_partners boolean not null default true,
  show_rates boolean not null default true,
  show_contact boolean not null default false,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp()
);
create function private.validate_creator_media_kit() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if not private.creator_rates_valid(new.rates) or not private.creator_partners_valid(new.partners) then
    raise exception using errcode='23514',message='Invalid media kit';
  end if;
  return new;
end;
$function$;
revoke all on function private.creator_rates_valid(jsonb), private.creator_partners_valid(text[]), private.validate_creator_media_kit() from public, anon, authenticated;
create trigger creator_media_kits_validate before insert or update on public.creator_media_kits
  for each row execute function private.validate_creator_media_kit();
create trigger creator_media_kits_set_updated_at before update on public.creator_media_kits
  for each row execute function private.set_updated_at();
alter table public.creator_media_kits enable row level security;
revoke all on public.creator_media_kits from public, anon, authenticated;
grant select, insert, update, delete on public.creator_media_kits to authenticated;
grant all on public.creator_media_kits to service_role;
create policy creator_media_kits_owner_all on public.creator_media_kits for all to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

-- Partners read the kit through this function only, and only the parts the
-- creator chose to include, while the Creator page is live.
create function public.get_creator_media_kit(p_username text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object(
    'display_name',p.display_name,
    'username',p.username,
    'tagline',coalesce(m.settings->>'tagline',''),
    'category',coalesce(m.settings->>'category',''),
    'city',coalesce(m.settings->>'city',''),
    'languages',coalesce(k.languages,''),
    'updated_at',greatest(m.updated_at,coalesce(k.updated_at,m.updated_at)),
    'platforms',case when coalesce(k.show_platforms,true) then coalesce((select jsonb_agg(jsonb_build_object('type',l.link_type,'url',l.url) order by l.sort_order)
      from public.profile_links l where l.profile_id=p.id and l.mode_id=m.id and l.is_visible
        and l.link_type in ('instagram','tiktok','youtube','twitch','x','threads','spotify','substack','patreon')),'[]'::jsonb) else '[]'::jsonb end,
    'partners',case when coalesce(k.show_partners,true) then to_jsonb(coalesce(k.partners,'{}'::text[])) else '[]'::jsonb end,
    'rates',case when coalesce(k.show_rates,true) then coalesce(k.rates,'[]'::jsonb) else '[]'::jsonb end,
    'contact_email',case when k.show_contact then k.contact_email else null end
  )
  from public.profiles p
  join public.profile_modes m on m.profile_id=p.id and m.slug='creator'
  left join public.creator_media_kits k on k.user_id=p.id
  where p.username=lower(btrim(p_username)) and p.is_published and m.is_enabled;
$function$;
revoke all on function public.get_creator_media_kit(text) from public;
grant execute on function public.get_creator_media_kit(text) to anon, authenticated;

-- External offers join the public summary; paid offers still need approval.
create or replace function public.get_creator_public_summary(p_username text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object(
    'creator_user_id',p.id,
    'follower_count',(select count(*) from public.creator_follows f where f.creator_user_id=p.id),
    'is_following',case when auth.uid() is null then false else exists(select 1 from public.creator_follows f where f.creator_user_id=p.id and f.follower_user_id=auth.uid()) end,
    'offers',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'kind',o.kind,'offer_type',o.offer_type,'external_url',o.external_url,'title',o.title,'description',o.description,'currency',o.currency,'unit_amount_minor',o.unit_amount_minor) order by o.sort_order, o.created_at desc)
      from public.creator_offers o where o.creator_user_id=p.id and o.status='active'
        and (o.offer_type='external' or private.creator_monetization_enabled_for_user(p.id))),'[]'::jsonb),
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

comment on table public.creator_inquiries is 'Collab inquiries from signed-in members to a Creator page open for collabs. Written only by creator_send_inquiry; read by the two participants.';
comment on table public.creator_media_kits is 'Creator-entered media kit fields and include switches. Public reads go through get_creator_media_kit only.';
comment on column public.creator_offers.offer_type is 'Store label. external links out to the creator''s own shop and never takes payment on Setuvara.';

-- Creator pages open through the same opaque /s/<id> links as Event and
-- Business. The short-id migration ran after the Creator foundation, so its
-- Mode lists never gained the fourth Mode.
create or replace function public.resolve_mode_share(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'username', profiles.username,
    'mode', profile_modes.slug
  )
  from public.mode_share_locators as locators
  join public.profiles on profiles.id = locators.profile_id
  join public.profile_modes
    on profile_modes.id = locators.mode_id
   and profile_modes.profile_id = locators.profile_id
  where (
      (p_token ~ '^[0-9A-Za-z]{8}$' and locators.short_id = p_token)
      or (p_token ~ '^[A-Za-z0-9_-]{43}$'
          and locators.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256'))
    )
    and profiles.is_published
    and profile_modes.is_enabled
    and profile_modes.slug in ('personal', 'event', 'business', 'creator')
  limit 1;
$function$;
revoke all on function public.resolve_mode_share(text) from public;
grant execute on function public.resolve_mode_share(text) to anon, authenticated, service_role;

create or replace function public.rotate_mode_share_locator(p_mode text, p_expected_short_id text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_mode_id uuid;
  v_short_id text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_mode is null or p_mode not in ('event', 'business', 'creator')
     or p_expected_short_id is null or p_expected_short_id !~ '^[0-9A-Za-z]{8}$' then
    raise exception using errcode = '22023', message = 'Invalid share link rotation';
  end if;

  select id into v_mode_id
  from public.profile_modes
  where profile_id = v_user_id and slug = p_mode;
  if v_mode_id is null then return null; end if;

  update public.mode_share_locators
    set short_id = public.mode_share_short_id(),
        nonce = null,
        token_hash = null,
        updated_at = pg_catalog.statement_timestamp()
    where profile_id = v_user_id
      and mode_id = v_mode_id
      and short_id = p_expected_short_id
  returning short_id into v_short_id;
  return v_short_id;
end;
$function$;
revoke all on function public.rotate_mode_share_locator(text, text) from public, anon;
grant execute on function public.rotate_mode_share_locator(text, text) to authenticated;
