-- Owner preview of Verified Revenue on their own public page. Same shape as get_public_builder_revenue, but
-- only for the signed-in owner, and it includes test-mode and stale connections, flagged so the page can say
-- so. Visitors never get these rows: the function returns nothing unless auth.uid() owns the profile.
create function public.get_builder_revenue_preview(p_username text, p_mode_slug text)
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
        'stale', not coalesce(c.last_sync_ok and c.last_sync_at > pg_catalog.statement_timestamp() - interval '48 hours', false)
      ) order by c.provider, s.mrr_minor desc) as sources
    from public.profiles p
    join public.profile_modes m on m.profile_id = p.id and m.slug = p_mode_slug and m.slug in ('creator','business')
    join public.builder_projects bp on bp.mode_id = m.id and bp.revenue_visibility <> 'hidden'
    join public.revenue_connections c on c.project_id = bp.id and c.status <> 'revoked'
    join public.revenue_snapshots s on s.connection_id = c.id
      and s.day = (select pg_catalog.max(s3.day) from public.revenue_snapshots s3 where s3.connection_id = c.id)
    left join lateral (select s2.mrr_minor from public.revenue_snapshots s2 where s2.connection_id = c.id and s2.currency = s.currency
      and s2.day <= s.day - 28 order by s2.day desc limit 1) prev on true
    where p.username = pg_catalog.lower(pg_catalog.btrim(p_username)) and p.id = auth.uid()
    group by bp.id
  ) x
$function$;

revoke all on function public.get_builder_revenue_preview(text, text) from public, anon, authenticated;
grant execute on function public.get_builder_revenue_preview(text, text) to authenticated;
