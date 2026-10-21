-- Creator Mode 2.0, slice 3: Fan Drops.
--
-- Built on what Creator already has: content rules (who can see a Work piece), drops (when it goes
-- out) and can_view_creator_block, which already guards the block rows and their files.
--   1. Two more audiences for exclusive content, beside followers, members and buyers:
--      * connections: people connected with the creator on Setuvara;
--      * subscribers: confirmed newsletter subscribers of the creator's Actions, matched to the
--        viewer's own verified account email (normalized the way signups are).
--   2. Early access: a drop can open to one of those audiences before its public start. During the
--      early window everyone sees the teaser; only that audience sees the piece.
-- Every check happens in the database for the signed-in viewer; nothing is decided in the browser.

-- 1. Audiences.
alter table public.creator_content_rules drop constraint if exists creator_content_rules_access_level_check;
alter table public.creator_content_rules add constraint creator_content_rules_access_level_check
  check (access_level in ('public','followers','connections','subscribers','members','purchase'));

-- The same normalization submit_profile_action uses for signup emails.
create function private.normalize_signup_email(p_email text)
returns text language sql immutable set search_path='' as $function$
  select case when v.email is null or v.email = '' then null else
    case when pg_catalog.split_part(v.email, '@', 2) in ('gmail.com','googlemail.com')
      then pg_catalog.replace(pg_catalog.split_part(pg_catalog.split_part(v.email, '@', 1), '+', 1), '.', '') || '@gmail.com'
      else pg_catalog.split_part(pg_catalog.split_part(v.email, '@', 1), '+', 1) || '@' || pg_catalog.split_part(v.email, '@', 2) end end
  from (select pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, ''))) as email) v
$function$;

-- Whether a viewer belongs to one of a creator's audiences. The creator always does.
create function private.creator_fan_eligible(p_creator uuid, p_viewer uuid, p_level text)
returns boolean language sql stable security definer set search_path='' as $function$
  select case
    when p_level = 'public' then true
    when p_viewer is null then false
    when p_viewer = p_creator then true
    when p_level = 'followers' then exists(select 1 from public.creator_follows f where f.creator_user_id = p_creator and f.follower_user_id = p_viewer)
    when p_level = 'connections' then exists(select 1 from public.connections c
      where (c.user_id = p_creator and c.connected_user_id = p_viewer) or (c.user_id = p_viewer and c.connected_user_id = p_creator))
    when p_level = 'subscribers' then exists(select 1 from auth.users u
      join public.action_submissions s on s.profile_id = p_creator and s.kind = 'newsletter' and s.status = 'subscribed'
        and s.email_norm = private.normalize_signup_email(u.email)
      where u.id = p_viewer and u.email_confirmed_at is not null)
    when p_level = 'members' then exists(select 1 from public.creator_memberships m
      where m.creator_user_id = p_creator and m.member_user_id = p_viewer and m.status = 'active'
        and (m.current_period_end is null or m.current_period_end > pg_catalog.statement_timestamp()))
    else false
  end
$function$;

-- 2. Early access on drops.
alter table public.creator_drops
  add column early_access_level text check (early_access_level is null or early_access_level in ('followers','connections','subscribers','members')),
  add column early_access_starts_at timestamptz,
  add constraint creator_drops_early_access_check check (
    (early_access_level is null) = (early_access_starts_at is null)
    and (early_access_starts_at is null or (starts_at is not null and early_access_starts_at < starts_at)));

-- A piece's teaser shows once its drop is out, or once its early window opens.
create or replace function public.creator_block_teaser_available(p_profile_block_id uuid)
returns boolean language sql stable security definer set search_path='' as $function$
  select exists(select 1 from public.profile_blocks b join public.profile_modes m on m.id=b.mode_id
      join public.profiles p on p.id=b.profile_id
    where b.id=p_profile_block_id and b.is_visible and p.is_published and m.slug='creator' and m.is_enabled)
    and not exists(select 1 from public.creator_drops d where d.profile_block_id=p_profile_block_id
      and (d.status in ('draft','cancelled','ended')
        or (d.ends_at is not null and d.ends_at<=pg_catalog.statement_timestamp())
        or (d.starts_at is not null and d.starts_at>pg_catalog.statement_timestamp()
          and (d.early_access_starts_at is null or d.early_access_starts_at>pg_catalog.statement_timestamp()))))
$function$;

-- Who sees a block. Unchanged for every existing level; adds connections, subscribers and the
-- early window (only its audience sees the piece until the public start).
create or replace function public.can_view_creator_block(p_profile_block_id uuid)
returns boolean language sql stable security definer set search_path='' as $function$
  select case
    when exists(select 1 from public.profile_blocks b join public.profile_modes m on m.id=b.mode_id
      where b.id=p_profile_block_id and b.profile_id=auth.uid() and m.slug='creator') then true
    when not exists(select 1 from public.profile_blocks b join public.profile_modes m on m.id=b.mode_id
      where b.id=p_profile_block_id and m.slug='creator') then true
    when not public.creator_block_teaser_available(p_profile_block_id) then false
    when exists(select 1 from public.creator_drops d where d.profile_block_id=p_profile_block_id
      and d.starts_at > pg_catalog.statement_timestamp()
      and not private.creator_fan_eligible(d.creator_user_id, auth.uid(), d.early_access_level)) then false
    when not exists(select 1 from public.creator_content_rules r where r.profile_block_id=p_profile_block_id) then true
    when (select r.access_level from public.creator_content_rules r where r.profile_block_id=p_profile_block_id)='public' then true
    when auth.uid() is null then false
    when (select r.access_level from public.creator_content_rules r where r.profile_block_id=p_profile_block_id) in ('followers','connections','subscribers','members') then
      (select private.creator_fan_eligible(r.creator_user_id, auth.uid(), r.access_level) from public.creator_content_rules r where r.profile_block_id=p_profile_block_id)
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

-- The public Creator summary also lists early-access drops and every locked piece the viewer can
-- see the teaser of, with whether this viewer can open it. Offers are unchanged.
create or replace function public.get_creator_public_summary(p_username text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object(
    'creator_user_id',p.id,
    'follower_count',(select count(*) from public.creator_follows f where f.creator_user_id=p.id),
    'is_following',case when auth.uid() is null then false else exists(select 1 from public.creator_follows f where f.creator_user_id=p.id and f.follower_user_id=auth.uid()) end,
    'offers',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'kind',o.kind,'offer_type',o.offer_type,'external_url',o.external_url,'title',o.title,'description',o.description,'currency',o.currency,'unit_amount_minor',o.unit_amount_minor) order by o.sort_order, o.created_at desc)
      from public.creator_offers o where o.creator_user_id=p.id and private.creator_offer_sellable(o)),'[]'::jsonb),
    'drops',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'profile_block_id',d.profile_block_id,'title',d.title,
        'status',case when d.starts_at > pg_catalog.statement_timestamp() then 'early' else 'live' end,
        'starts_at',d.starts_at,'ends_at',d.ends_at,'offer_id',d.offer_id,'early_access_level',d.early_access_level,
        'is_accessible',public.can_view_creator_block(d.profile_block_id)))
      from public.creator_drops d where d.creator_user_id=p.id
        and d.status in ('live','scheduled')
        and public.creator_block_teaser_available(d.profile_block_id)),'[]'::jsonb),
    'locked_content',coalesce((select jsonb_agg(jsonb_build_object('profile_block_id',r.profile_block_id,'access_level',r.access_level,'offer_id',r.offer_id,'teaser_title',r.teaser_title,'teaser_text',r.teaser_text,'teaser_image_url',r.teaser_image_url,'is_accessible',public.can_view_creator_block(r.profile_block_id)))
      from public.creator_content_rules r join public.profile_blocks b on b.id=r.profile_block_id
      where r.creator_user_id=p.id and r.access_level<>'public' and b.is_visible
        and public.creator_block_teaser_available(b.id)),'[]'::jsonb)
  )
  from public.profiles p join public.profile_modes m on m.profile_id=p.id
  where p.username=lower(btrim(p_username)) and p.is_published and m.slug='creator' and m.is_enabled;
$function$;

revoke all on function private.normalize_signup_email(text), private.creator_fan_eligible(uuid,uuid,text) from public, anon, authenticated;
