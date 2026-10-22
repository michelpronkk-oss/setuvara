-- Verified Revenue: an owner setting per connection for past months. "daily" (the default) shows only
-- daily measurements. "reconstructed" also stores month-end points rebuilt from the provider's records,
-- flagged on each snapshot so they are labelled "Reconstructed from Stripe history" and never pass for
-- measurements. Switching back to daily deletes them.

set lock_timeout = '5s';

alter table public.revenue_connections
  add column history_mode text not null default 'daily' check (history_mode in ('daily','reconstructed'));
alter table public.revenue_snapshots add column reconstructed boolean not null default false;
grant select (history_mode) on public.revenue_connections to authenticated;

-- Owner: choose the history setting. Daily removes every reconstructed point.
create function public.revenue_set_history(p_connection uuid, p_mode text)
returns void language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501', message='not_allowed'; end if;
  if p_mode not in ('daily','reconstructed') then raise exception using errcode='22023', message='invalid_mode'; end if;
  update public.revenue_connections c set history_mode = p_mode
    where c.id = p_connection and c.owner_user_id = auth.uid() and c.status <> 'revoked';
  if not found then raise exception using errcode='P0002', message='connection_not_found'; end if;
  if p_mode = 'daily' then delete from public.revenue_snapshots s where s.connection_id = p_connection and s.reconstructed; end if;
end;
$function$;

-- Server only: replace the reconstructed points. Only days before the first measurement, inside the plan's
-- history window, and only while the owner has the setting on.
create function public.revenue_record_history(p_connection uuid, p_rows jsonb, p_method text)
returns integer language plpgsql security definer set search_path='' as $function$
declare v_conn public.revenue_connections; v_days integer; v_first date; v_count integer;
  v_today date := (pg_catalog.statement_timestamp() at time zone 'utc')::date;
begin
  select * into v_conn from public.revenue_connections c where c.id = p_connection and c.status <> 'revoked' for update;
  if not found or v_conn.history_mode <> 'reconstructed' then return 0; end if;
  select l.history_days into v_days from private.revenue_plan_limits l where l.plan_code = private.member_plan(v_conn.owner_user_id);
  select pg_catalog.min(s.day) into v_first from public.revenue_snapshots s where s.connection_id = p_connection and not s.reconstructed;
  delete from public.revenue_snapshots s where s.connection_id = p_connection and s.reconstructed;
  insert into public.revenue_snapshots (connection_id, owner_user_id, project_id, day, provider, environment, currency,
      mrr_minor, paying_customers, active_subscriptions, method, reconstructed)
    select v_conn.id, v_conn.owner_user_id, v_conn.project_id, (r->>'day')::date, v_conn.provider, v_conn.environment, pg_catalog.lower(r->>'currency'),
      (r->>'mrr_minor')::bigint, (r->>'paying_customers')::integer, (r->>'active_subscriptions')::integer, p_method, true
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
    where (r->>'day')::date < coalesce(v_first, v_today) and (r->>'day')::date >= v_today - coalesce(v_days, 0)
  on conflict (connection_id, day, currency) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.revenue_set_history(uuid, text), public.revenue_record_history(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.revenue_set_history(uuid, text) to authenticated;
grant execute on function public.revenue_record_history(uuid, jsonb, text) to service_role;

-- Reconstructed points count toward growth and the trend only while the setting is on, and the trend then
-- reaches back a year so past months show. Each source says whether its trend includes them.
create or replace function public.get_public_builder_revenue(p_username text, p_mode_slug text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_object_agg(x.project_id, x.sources), '{}'::jsonb) from (
    select bp.id as project_id, jsonb_agg(jsonb_build_object(
        'provider', c.provider, 'currency', s.currency, 'synced_at', c.last_sync_at, 'visibility', bp.revenue_visibility,
        'mrr_minor', case when bp.revenue_visibility = 'exact' then s.mrr_minor end,
        'arr_minor', case when bp.revenue_visibility = 'exact' then s.mrr_minor * 12 end,
        'paying_customers', case when bp.revenue_visibility = 'exact' then s.paying_customers end,
        'band', case when bp.revenue_visibility = 'range' then private.revenue_band(s.mrr_minor) end,
        'growth_pct', case when bp.revenue_visibility in ('exact','range','growth') and prev.mrr_minor > 0
          then pg_catalog.round((s.mrr_minor - prev.mrr_minor) * 100.0 / prev.mrr_minor, 1) end,
        'trend', (select jsonb_agg(pg_catalog.round(t.mrr_minor::numeric / nullif(t.mx, 0), 3) order by t.day) from (
          select s4.day, s4.mrr_minor, pg_catalog.max(s4.mrr_minor) over () as mx from public.revenue_snapshots s4
          where s4.connection_id = c.id and s4.currency = s.currency and s4.day <= s.day
            and (s4.day > s.day - 90 or (s4.reconstructed and c.history_mode = 'reconstructed' and s4.day > s.day - 366))
            and (not s4.reconstructed or c.history_mode = 'reconstructed')) t),
        'reconstructed', c.history_mode = 'reconstructed' and exists(select 1 from public.revenue_snapshots s5
          where s5.connection_id = c.id and s5.currency = s.currency and s5.reconstructed)
      ) order by c.provider, s.mrr_minor desc) as sources
    from public.profiles p
    join public.profile_modes m on m.profile_id = p.id and m.slug = p_mode_slug and m.is_enabled and m.slug in ('creator','business')
    join public.builder_projects bp on bp.mode_id = m.id and bp.visibility = 'public' and bp.revenue_visibility <> 'hidden'
    join public.revenue_connections c on c.project_id = bp.id and c.status = 'active' and c.environment = 'live'
      and c.last_sync_ok and c.last_sync_at > pg_catalog.statement_timestamp() - interval '48 hours'
    join public.revenue_snapshots s on s.connection_id = c.id and not s.reconstructed and s.day = (c.last_sync_at at time zone 'utc')::date
    left join lateral (select s2.mrr_minor from public.revenue_snapshots s2 where s2.connection_id = c.id and s2.currency = s.currency
      and s2.day <= s.day - 28 and (not s2.reconstructed or c.history_mode = 'reconstructed') order by s2.day desc limit 1) prev on true
    where p.username = pg_catalog.lower(pg_catalog.btrim(p_username)) and p.is_published
      and private.member_plan(p.id) in ('plus','pro')
    group by bp.id
  ) x
$function$;

create or replace function public.get_builder_revenue_preview(p_username text, p_mode_slug text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_object_agg(x.project_id, x.sources), '{}'::jsonb) from (
    select bp.id as project_id, jsonb_agg(jsonb_build_object(
        'provider', c.provider, 'currency', s.currency, 'synced_at', c.last_sync_at, 'visibility', bp.revenue_visibility,
        'mrr_minor', case when bp.revenue_visibility = 'exact' then s.mrr_minor end,
        'arr_minor', case when bp.revenue_visibility = 'exact' then s.mrr_minor * 12 end,
        'paying_customers', case when bp.revenue_visibility = 'exact' then s.paying_customers end,
        'band', case when bp.revenue_visibility = 'range' then private.revenue_band(s.mrr_minor) end,
        'growth_pct', case when bp.revenue_visibility in ('exact','range','growth') and prev.mrr_minor > 0
          then pg_catalog.round((s.mrr_minor - prev.mrr_minor) * 100.0 / prev.mrr_minor, 1) end,
        'preview', true,
        'test', c.environment = 'test',
        'stale', not coalesce(c.last_sync_ok and c.last_sync_at > pg_catalog.statement_timestamp() - interval '48 hours', false),
        'trend', (select jsonb_agg(pg_catalog.round(t.mrr_minor::numeric / nullif(t.mx, 0), 3) order by t.day) from (
          select s4.day, s4.mrr_minor, pg_catalog.max(s4.mrr_minor) over () as mx from public.revenue_snapshots s4
          where s4.connection_id = c.id and s4.currency = s.currency and s4.day <= s.day
            and (s4.day > s.day - 90 or (s4.reconstructed and c.history_mode = 'reconstructed' and s4.day > s.day - 366))
            and (not s4.reconstructed or c.history_mode = 'reconstructed')) t),
        'reconstructed', c.history_mode = 'reconstructed' and exists(select 1 from public.revenue_snapshots s5
          where s5.connection_id = c.id and s5.currency = s.currency and s5.reconstructed)
      ) order by c.provider, s.mrr_minor desc) as sources
    from public.profiles p
    join public.profile_modes m on m.profile_id = p.id and m.slug = p_mode_slug and m.slug in ('creator','business')
    join public.builder_projects bp on bp.mode_id = m.id and bp.revenue_visibility <> 'hidden'
    join public.revenue_connections c on c.project_id = bp.id and c.status <> 'revoked'
    join public.revenue_snapshots s on s.connection_id = c.id and not s.reconstructed
      and s.day = (select pg_catalog.max(s3.day) from public.revenue_snapshots s3 where s3.connection_id = c.id and not s3.reconstructed)
    left join lateral (select s2.mrr_minor from public.revenue_snapshots s2 where s2.connection_id = c.id and s2.currency = s.currency
      and s2.day <= s.day - 28 and (not s2.reconstructed or c.history_mode = 'reconstructed') order by s2.day desc limit 1) prev on true
    where p.username = pg_catalog.lower(pg_catalog.btrim(p_username)) and p.id = auth.uid()
    group by bp.id
  ) x
$function$;

comment on column public.revenue_snapshots.reconstructed is 'Month-end point rebuilt from provider records at the owner''s request, not a daily measurement.';
