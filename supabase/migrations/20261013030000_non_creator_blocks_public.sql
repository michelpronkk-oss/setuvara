-- Blocks outside the Creator Mode have no Creator rule and are public again (as intended by
-- 20261012220000: "No Creator rule means public"). The teaser check only applies to Creator
-- blocks; it ran first and hid every Personal, Event and Business block from visitors and
-- their media from storage, so visitors saw no content at all.
create or replace function public.can_view_creator_block(p_profile_block_id uuid)
returns boolean language sql stable security definer set search_path='' as $function$
  select case
    when exists(select 1 from public.profile_blocks b join public.profile_modes m on m.id=b.mode_id
      where b.id=p_profile_block_id and b.profile_id=auth.uid() and m.slug='creator') then true
    when not exists(select 1 from public.profile_blocks b join public.profile_modes m on m.id=b.mode_id
      where b.id=p_profile_block_id and m.slug='creator') then true
    when not public.creator_block_teaser_available(p_profile_block_id) then false
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
