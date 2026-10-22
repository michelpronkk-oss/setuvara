-- Analytics for Pro: the previous period of the same length (totals and a daily line to draw behind
-- the current one) and the loop per Mode (views, shares, connections). Server only; it checks the plan
-- itself so a stale client can never read Pro numbers on another plan.
set lock_timeout = '5s';

create function public.get_profile_analytics_pro(p_profile_id uuid, p_from date, p_to date, p_mode text default null, p_source text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare
  v_today date := (pg_catalog.statement_timestamp() at time zone 'UTC')::date;
  v_days integer;
  v_prev_from date;
  v_prev_to date;
  v_previous jsonb;
  v_daily jsonb;
  v_modes jsonb;
begin
  if p_profile_id is null or p_from is null or p_to is null or p_from > p_to or p_to > v_today
    or (p_mode is not null and p_mode not in ('personal', 'event', 'business', 'creator'))
    or (p_source is not null and p_source not in ('direct', 'profile', 'share', 'qr', 'quick_qr', 'tap', 'link', 'native_share', 'other')) then
    raise exception using errcode = '22023', message = 'invalid_analytics_query';
  end if;
  v_days := p_to - p_from + 1;
  if v_days > 730 then raise exception using errcode = '42501', message = 'analytics_plan_limit'; end if;
  if not exists (
    select 1 from public.billing_subscriptions s
    where s.user_id = p_profile_id and s.plan_code = 'pro'
      and public.billing_subscription_has_access(s.provider_status, s.current_period_end, s.cancel_at_next_billing_date, s.past_due_ends_at)
  ) then
    raise exception using errcode = '42501', message = 'analytics_plan_mismatch';
  end if;

  v_prev_to := p_from - 1;
  v_prev_from := p_from - v_days;

  select pg_catalog.jsonb_build_object(
      'from', v_prev_from::text, 'to', v_prev_to::text,
      'profile_views', pg_catalog.count(*) filter (where e.event_name = 'profile_viewed'),
      'qr_scans', pg_catalog.count(*) filter (where e.event_name = 'profile_viewed' and e.source = 'qr'),
      'quick_qr_scans', pg_catalog.count(*) filter (where e.event_name = 'quick_qr_scanned'),
      'tap_scans', pg_catalog.count(*) filter (where e.event_name = 'tap_scanned'),
      'shares', pg_catalog.count(*) filter (where e.event_name = 'profile_shared'),
      'connections', pg_catalog.count(*) filter (where e.event_name = 'connection_created'))
    into v_previous
  from private.product_analytics_events e
  where e.owner_profile_id = p_profile_id
    and e.occurred_at >= v_prev_from::timestamp at time zone 'UTC' and e.occurred_at < p_from::timestamp at time zone 'UTC'
    and (p_source is null or e.source = p_source) and (p_mode is null or e.mode_slug = p_mode);

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'date', days.day::date::text,
      'profile_views', coalesce(d.profile_views, 0),
      'connections', coalesce(d.connections, 0)) order by days.day)
    into v_daily
  from pg_catalog.generate_series(v_prev_from::timestamp, v_prev_to::timestamp, interval '1 day') as days(day)
  left join (
    select (e.occurred_at at time zone 'UTC')::date as day,
      pg_catalog.count(*) filter (where e.event_name = 'profile_viewed') as profile_views,
      pg_catalog.count(*) filter (where e.event_name = 'connection_created') as connections
    from private.product_analytics_events e
    where e.owner_profile_id = p_profile_id
      and e.occurred_at >= v_prev_from::timestamp at time zone 'UTC' and e.occurred_at < p_from::timestamp at time zone 'UTC'
      and (p_source is null or e.source = p_source) and (p_mode is null or e.mode_slug = p_mode)
    group by 1
  ) d on d.day = days.day::date;

  -- The loop per Mode in the current period; Modes with no activity are left out.
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'mode', m.mode_slug, 'profile_views', m.profile_views, 'shares', m.shares, 'connections', m.connections)
      order by m.profile_views desc, m.mode_slug), '[]'::jsonb)
    into v_modes
  from (
    select e.mode_slug,
      pg_catalog.count(*) filter (where e.event_name = 'profile_viewed') as profile_views,
      pg_catalog.count(*) filter (where e.event_name = 'profile_shared') as shares,
      pg_catalog.count(*) filter (where e.event_name = 'connection_created') as connections
    from private.product_analytics_events e
    where e.owner_profile_id = p_profile_id and e.mode_slug in ('personal', 'event', 'business', 'creator')
      and e.occurred_at >= p_from::timestamp at time zone 'UTC' and e.occurred_at < (p_to + 1)::timestamp at time zone 'UTC'
      and (p_source is null or e.source = p_source) and (p_mode is null or e.mode_slug = p_mode)
    group by e.mode_slug
  ) m
  where m.profile_views + m.shares + m.connections > 0;

  return pg_catalog.jsonb_build_object('previous', v_previous || pg_catalog.jsonb_build_object('daily', coalesce(v_daily, '[]'::jsonb)), 'mode_funnels', v_modes);
end;
$function$;

revoke all on function public.get_profile_analytics_pro(uuid, date, date, text, text) from public, anon, authenticated;
grant execute on function public.get_profile_analytics_pro(uuid, date, date, text, text) to service_role;
