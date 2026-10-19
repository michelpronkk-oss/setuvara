-- Site traffic for the admin console: one row per page view of the public site.
-- Stores only the page (a fixed key, never a URL), a country code taken from the
-- hosting edge, and a coarse device class. No IP address, visitor ID, cookie,
-- user agent or referrer is kept, and rows are not linked to any profile.

create table private.site_page_views (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default pg_catalog.statement_timestamp(),
  page text not null check (page in (
    'home', 'pricing', 'modes', 'events', 'teams', 'contact', 'roadmap',
    'privacy', 'terms', 'cookies', 'refunds', 'login', 'signup', 'profile'
  )),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  device_class text not null default 'unknown'
    check (device_class in ('mobile', 'tablet', 'desktop', 'unknown'))
);

create index site_page_views_occurred_idx on private.site_page_views (occurred_at desc);

alter table private.site_page_views enable row level security;
revoke all on table private.site_page_views from public, anon, authenticated, service_role;

comment on table private.site_page_views is
  'Aggregate site traffic. Page key, edge country code and device class only; no IP, visitor ID, user agent, URL or profile link.';

create or replace function public.record_site_page_view(p_page text, p_country text, p_device_class text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into private.site_page_views (page, country, device_class)
  values (
    p_page,
    case when p_country ~ '^[A-Z]{2}$' and p_country <> 'XX' then p_country end,
    coalesce(p_device_class, 'unknown')
  );
end;
$function$;

create or replace function public.admin_site_traffic(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_prev_start timestamptz;
begin
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from + 1 > 366 then
    raise exception using errcode = '22023', message = 'invalid_admin_range';
  end if;
  v_start := p_from::timestamp at time zone 'UTC';
  v_end := (p_to + 1)::timestamp at time zone 'UTC';
  v_prev_start := v_start - (v_end - v_start);

  return pg_catalog.jsonb_build_object(
    'recording_since', (select min(views.occurred_at) from private.site_page_views as views),
    'totals', (
      select pg_catalog.jsonb_build_object(
        'views', count(*) filter (where views.occurred_at >= v_start),
        'views_previous', count(*) filter (where views.occurred_at < v_start),
        'home', count(*) filter (where views.occurred_at >= v_start and views.page = 'home'),
        'home_previous', count(*) filter (where views.occurred_at < v_start and views.page = 'home'),
        'countries', count(distinct views.country) filter (where views.occurred_at >= v_start)
      )
      from private.site_page_views as views
      where views.occurred_at >= v_prev_start and views.occurred_at < v_end
    ),
    'daily', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'date', days.day::date::text,
        'views', coalesce(activity.views, 0),
        'home', coalesce(activity.home, 0)
      ) order by days.day), '[]'::jsonb)
      from pg_catalog.generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as days(day)
      left join (
        select (views.occurred_at at time zone 'UTC')::date as day,
          count(*) as views,
          count(*) filter (where views.page = 'home') as home
        from private.site_page_views as views
        where views.occurred_at >= v_start and views.occurred_at < v_end
        group by 1
      ) as activity on activity.day = days.day::date
    ),
    'pages', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('page', grouped.page, 'count', grouped.count) order by grouped.count desc, grouped.page), '[]'::jsonb)
      from (
        select views.page, count(*) as count
        from private.site_page_views as views
        where views.occurred_at >= v_start and views.occurred_at < v_end
        group by views.page
      ) as grouped
    ),
    'countries', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('country', grouped.country, 'count', grouped.count) order by grouped.count desc, grouped.country nulls last), '[]'::jsonb)
      from (
        select views.country, count(*) as count
        from private.site_page_views as views
        where views.occurred_at >= v_start and views.occurred_at < v_end
        group by views.country
      ) as grouped
    )
  );
end;
$function$;

revoke all on function public.record_site_page_view(text, text, text) from public, anon, authenticated;
grant execute on function public.record_site_page_view(text, text, text) to service_role;
revoke all on function public.admin_site_traffic(date, date) from public, anon, authenticated;
grant execute on function public.admin_site_traffic(date, date) to service_role;
