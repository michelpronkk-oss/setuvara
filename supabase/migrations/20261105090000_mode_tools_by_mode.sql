-- Analytics: the Mode tools summary narrowed to one Mode (Plus). Same counts as before; with
-- p_mode set, each tool only counts what belongs to that Mode; null counts every Mode. Still
-- service role only. Added next to the three-argument version, which the app no longer calls;
-- p_mode has no default so the two never overlap.

create function public.get_mode_tools_summary(p_profile_id uuid, p_from date, p_to date, p_mode text)
returns jsonb language sql stable security definer set search_path='' as $function$
  with r as (select p_from::timestamptz as a, (p_to + 1)::timestamptz as b),
  in_mode as (select m.id from public.profile_modes m where m.profile_id = p_profile_id and (p_mode is null or m.slug = p_mode)),
  creator as (select p_mode is null or p_mode = 'creator' as ok)
  select jsonb_build_object(
    'action_responses', (select pg_catalog.count(*) from public.action_submissions s join public.profile_actions a on a.id = s.action_id, r
      where s.profile_id = p_profile_id and s.created_at >= r.a and s.created_at < r.b
        and s.status not in ('spam', 'pending_verification') and a.mode_id in (select id from in_mode)),
    'event_rsvps', (select pg_catalog.count(*) from public.event_registrations e join public.events ev on ev.id = e.event_id, r
      where e.profile_id = p_profile_id and e.created_at >= r.a and e.created_at < r.b and e.status <> 'cancelled'
        and ev.mode_id in (select id from in_mode)),
    'event_check_ins', (select pg_catalog.count(*) from public.event_registrations e join public.events ev on ev.id = e.event_id, r
      where e.profile_id = p_profile_id and e.checked_in_at >= r.a and e.checked_in_at < r.b and ev.mode_id in (select id from in_mode)),
    'leads', (select pg_catalog.count(*) from public.business_leads l, r
      where l.profile_id = p_profile_id and l.created_at >= r.a and l.created_at < r.b
        and (p_mode is null or l.mode_id in (select id from in_mode))),
    'bookings', (select pg_catalog.count(*) from public.business_bookings k, r
      where k.profile_id = p_profile_id and k.created_at >= r.a and k.created_at < r.b and k.status <> 'cancelled'
        and (p_mode is null or exists (select 1 from public.profile_actions a where a.id = k.action_id and a.mode_id in (select id from in_mode)))),
    'sales', (select pg_catalog.count(*) from public.creator_orders o, r, creator
      where creator.ok and o.creator_user_id = p_profile_id and o.livemode and o.paid_at >= r.a and o.paid_at < r.b
        and o.status in ('paid', 'partially_refunded')),
    'revenue', coalesce((select jsonb_agg(jsonb_build_object('currency', x.currency, 'minor', x.minor) order by x.minor desc) from (
      select pg_catalog.lower(o.currency) as currency, pg_catalog.sum(o.gross_amount_minor - coalesce(o.amount_refunded_minor, 0)) as minor
      from public.creator_orders o, r, creator
      where creator.ok and o.creator_user_id = p_profile_id and o.livemode and o.paid_at >= r.a and o.paid_at < r.b
        and o.status in ('paid', 'partially_refunded') group by 1) x), '[]'::jsonb),
    'deals', (select pg_catalog.count(*) from public.creator_deals d, r, creator
      where creator.ok and d.creator_user_id = p_profile_id and d.created_at >= r.a and d.created_at < r.b),
    'follows', (select pg_catalog.count(*) from public.creator_follows f, r, creator
      where creator.ok and f.creator_user_id = p_profile_id and f.created_at >= r.a and f.created_at < r.b),
    'builder_votes', (select pg_catalog.count(*) from public.builder_votes v join public.builder_projects bp on bp.id = v.project_id, r
      where bp.owner_user_id = p_profile_id and v.created_at >= r.a and v.created_at < r.b and bp.mode_id in (select id from in_mode)),
    'builder_suggestions', (select pg_catalog.count(*) from public.builder_suggestions g join public.builder_projects bp on bp.id = g.project_id, r
      where g.owner_user_id = p_profile_id and g.created_at >= r.a and g.created_at < r.b and bp.mode_id in (select id from in_mode))
  )
$function$;

revoke all on function public.get_mode_tools_summary(uuid, date, date, text) from public, anon, authenticated;
grant execute on function public.get_mode_tools_summary(uuid, date, date, text) to service_role;
