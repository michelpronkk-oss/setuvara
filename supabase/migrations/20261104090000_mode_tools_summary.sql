-- Analytics: what each Mode tool did in a range. Counts only, for the profile owner; the API
-- route checks the member and their plan's range first and calls this with the service role.
create function public.get_mode_tools_summary(p_profile_id uuid, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path='' as $function$
  with r as (select p_from::timestamptz as a, (p_to + 1)::timestamptz as b)
  select jsonb_build_object(
    'action_responses', (select pg_catalog.count(*) from public.action_submissions s, r
      where s.profile_id = p_profile_id and s.created_at >= r.a and s.created_at < r.b
        and s.status not in ('spam', 'pending_verification')),
    'action_responses_by_mode', coalesce((select jsonb_object_agg(x.slug, x.n) from (
      select m.slug, pg_catalog.count(*) as n from public.action_submissions s
      join public.profile_actions a on a.id = s.action_id join public.profile_modes m on m.id = a.mode_id, r
      where s.profile_id = p_profile_id and s.created_at >= r.a and s.created_at < r.b
        and s.status not in ('spam', 'pending_verification') group by m.slug) x), '{}'::jsonb),
    'event_rsvps', (select pg_catalog.count(*) from public.event_registrations e, r
      where e.profile_id = p_profile_id and e.created_at >= r.a and e.created_at < r.b and e.status <> 'cancelled'),
    'event_check_ins', (select pg_catalog.count(*) from public.event_registrations e, r
      where e.profile_id = p_profile_id and e.checked_in_at >= r.a and e.checked_in_at < r.b),
    'leads', (select pg_catalog.count(*) from public.business_leads l, r
      where l.profile_id = p_profile_id and l.created_at >= r.a and l.created_at < r.b),
    'bookings', (select pg_catalog.count(*) from public.business_bookings k, r
      where k.profile_id = p_profile_id and k.created_at >= r.a and k.created_at < r.b and k.status <> 'cancelled'),
    'sales', (select pg_catalog.count(*) from public.creator_orders o, r
      where o.creator_user_id = p_profile_id and o.livemode and o.paid_at >= r.a and o.paid_at < r.b
        and o.status in ('paid', 'partially_refunded')),
    'revenue', coalesce((select jsonb_agg(jsonb_build_object('currency', x.currency, 'minor', x.minor) order by x.minor desc) from (
      select pg_catalog.lower(o.currency) as currency, pg_catalog.sum(o.gross_amount_minor - coalesce(o.amount_refunded_minor, 0)) as minor
      from public.creator_orders o, r
      where o.creator_user_id = p_profile_id and o.livemode and o.paid_at >= r.a and o.paid_at < r.b
        and o.status in ('paid', 'partially_refunded') group by 1) x), '[]'::jsonb),
    'deals', (select pg_catalog.count(*) from public.creator_deals d, r
      where d.creator_user_id = p_profile_id and d.created_at >= r.a and d.created_at < r.b),
    'follows', (select pg_catalog.count(*) from public.creator_follows f, r
      where f.creator_user_id = p_profile_id and f.created_at >= r.a and f.created_at < r.b),
    'builder_votes', (select pg_catalog.count(*) from public.builder_votes v join public.builder_projects bp on bp.id = v.project_id, r
      where bp.owner_user_id = p_profile_id and v.created_at >= r.a and v.created_at < r.b),
    'builder_suggestions', (select pg_catalog.count(*) from public.builder_suggestions g, r
      where g.owner_user_id = p_profile_id and g.created_at >= r.a and g.created_at < r.b)
  )
$function$;

revoke all on function public.get_mode_tools_summary(uuid, date, date) from public, anon, authenticated;
grant execute on function public.get_mode_tools_summary(uuid, date, date) to service_role;
