-- Product usage counts live Store orders only (paid or partially refunded, net of refunds) with gross
-- per currency; test-mode orders are counted separately.
create or replace function public.admin_product(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from + 1 > 366 then
    raise exception using errcode = '22023', message = 'invalid_admin_range';
  end if;
  v_start := p_from::timestamp at time zone 'UTC';
  v_end := (p_to + 1)::timestamp at time zone 'UTC';

  return pg_catalog.jsonb_build_object(
    'actions', pg_catalog.jsonb_build_object(
      'live', (select count(*) from public.profile_actions as action where action.status = 'published'),
      'members', (select count(distinct action.profile_id) from public.profile_actions as action),
      'by_kind', (select coalesce(pg_catalog.jsonb_object_agg(grouped.kind, grouped.count), '{}'::jsonb) from (select action.kind, count(*) as count from public.profile_actions as action group by action.kind) as grouped),
      'submissions', (select count(*) from public.action_submissions as entry where entry.created_at >= v_start and entry.created_at < v_end),
      'submissions_total', (select count(*) from public.action_submissions),
      'subscribers', (select count(*) from public.action_submissions as entry where entry.kind = 'newsletter' and entry.status = 'subscribed')
    ),
    'business', pg_catalog.jsonb_build_object(
      'leads', (select count(*) from public.business_leads as lead where lead.created_at >= v_start and lead.created_at < v_end),
      'leads_total', (select count(*) from public.business_leads),
      'by_stage', (select coalesce(pg_catalog.jsonb_object_agg(grouped.stage, grouped.count), '{}'::jsonb) from (select lead.stage, count(*) as count from public.business_leads as lead group by lead.stage) as grouped),
      'bookings', (select count(*) from public.business_bookings as booking where booking.created_at >= v_start and booking.created_at < v_end),
      'bookings_total', (select count(*) from public.business_bookings),
      'testimonials', (select count(*) from public.business_testimonials as item where item.status = 'approved'),
      'testimonial_requests', (select count(*) from public.business_testimonial_requests),
      'team_members', (select count(*) from public.business_team_members)
    ),
    'builder', pg_catalog.jsonb_build_object(
      'projects', (select count(*) from public.builder_projects),
      'builders', (select count(distinct project.owner_user_id) from public.builder_projects as project),
      'roadmap_items', (select count(*) from public.builder_roadmap_items),
      'shipped', (select count(*) from public.builder_roadmap_items as item where item.stage = 'shipped'),
      'votes', (select count(*) from public.builder_votes),
      'votes_in_range', (select count(*) from public.builder_votes as vote where vote.created_at >= v_start and vote.created_at < v_end),
      'suggestions', (select count(*) from public.builder_suggestions),
      'revenue_connections', (select count(*) from public.revenue_connections as connection where connection.status <> 'revoked'),
      'revenue_failing', (select count(*) from public.revenue_connections as connection where connection.status <> 'revoked' and connection.last_sync_ok is false),
      'revenue_by_provider', (select coalesce(pg_catalog.jsonb_object_agg(grouped.provider, grouped.count), '{}'::jsonb) from (select connection.provider, count(*) as count from public.revenue_connections as connection where connection.status <> 'revoked' group by connection.provider) as grouped),
      'last_sync_at', (select max(connection.last_sync_at) from public.revenue_connections as connection)
    ),
    'creator', pg_catalog.jsonb_build_object(
      'offers', (select count(*) from public.creator_offers as offer where offer.archived_at is null),
      'sellers', (select count(distinct offer.creator_user_id) from public.creator_offers as offer where offer.archived_at is null),
      'orders', (select count(*) from public.creator_orders as orders where orders.livemode and orders.status in ('paid', 'partially_refunded') and orders.paid_at >= v_start and orders.paid_at < v_end),
      'test_orders', (select count(*) from public.creator_orders as orders where not orders.livemode and orders.created_at >= v_start and orders.created_at < v_end),
      'gross', (select coalesce(pg_catalog.jsonb_object_agg(grouped.currency, grouped.gross), '{}'::jsonb) from (select pg_catalog.upper(orders.currency) as currency, sum(orders.gross_amount_minor - coalesce(orders.amount_refunded_minor, 0)) as gross from public.creator_orders as orders where orders.livemode and orders.status in ('paid', 'partially_refunded') and orders.paid_at >= v_start and orders.paid_at < v_end group by 1) as grouped),
      'media_kits', (select count(*) from public.creator_media_kits),
      'deals', (select count(*) from public.creator_deals as deal where deal.created_at >= v_start and deal.created_at < v_end),
      'deals_total', (select count(*) from public.creator_deals),
      'campaigns_sent', (select count(*) from public.audience_campaigns as campaign where campaign.finished_at >= v_start and campaign.finished_at < v_end),
      'emails_sent', (select coalesce(sum(campaign.sent_count), 0) from public.audience_campaigns as campaign where campaign.finished_at >= v_start and campaign.finished_at < v_end)
    ),
    'events', pg_catalog.jsonb_build_object(
      'events', (select count(*) from public.events as event where event.published_at is not null),
      'upcoming', (select count(*) from public.events as event where event.published_at is not null and event.cancelled_at is null and event.starts_at > pg_catalog.statement_timestamp()),
      'registrations', (select count(*) from public.event_registrations as registration where registration.created_at >= v_start and registration.created_at < v_end),
      'check_ins', (select count(*) from public.event_registrations as registration where registration.checked_in_at >= v_start and registration.checked_in_at < v_end),
      'live_contexts', (select count(*) from public.live_contexts)
    ),
    'sharing', pg_catalog.jsonb_build_object(
      'tap_devices', (select count(*) from public.tap_devices as device where device.status = 'active'),
      'taps', (select count(*) from public.tap_events as tap where tap.created_at >= v_start and tap.created_at < v_end),
      'gallery_listings', (select count(*) from public.gallery_listings),
      'mode_handles', (select count(*) from public.mode_handles),
      'messages', (select count(*) from public.chat_messages as message where message.created_at >= v_start and message.created_at < v_end),
      'stamps', (select count(*) from public.passport_stamps as stamp where stamp.earned_at >= v_start and stamp.earned_at < v_end)
    ),
    'pages', pg_catalog.jsonb_build_object(
      'looks', (select coalesce(pg_catalog.jsonb_object_agg(grouped.theme, grouped.count), '{}'::jsonb) from (select coalesce(mode.appearance->>'theme', 'immersive') as theme, count(*) as count from public.profile_modes as mode where mode.is_enabled group by 1) as grouped),
      'name_fonts', (select coalesce(pg_catalog.jsonb_object_agg(grouped.font, grouped.count), '{}'::jsonb) from (select coalesce(mode.appearance->>'nameFont', 'setuvara') as font, count(*) as count from public.profile_modes as mode where mode.is_enabled group by 1) as grouped),
      'blocks', (select coalesce(pg_catalog.jsonb_object_agg(grouped.kind, grouped.count), '{}'::jsonb) from (select block.kind, count(*) as count from public.profile_blocks as block where block.is_visible group by block.kind) as grouped),
      'soundtracks', (select count(*) from public.profile_blocks as block where block.is_soundtrack),
      'links', (select count(*) from public.profile_links as link where link.is_visible)
    )
  );
end;
$function$;

