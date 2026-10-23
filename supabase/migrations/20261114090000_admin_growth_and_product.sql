-- Admin Control Center, brought up to date: site visits for every public page with a referrer
-- class, search and AI crawler visits, the IndexNow log, the off-site (GEO) checklist, product
-- usage across every Mode tool, and scheduled-job health.
--
-- Privacy: a visit stores the page path (a fixed public marketing path, never a member page or a
-- query string), the edge country, a device class and a referrer *class* such as "google" or
-- "chatgpt". No IP address, user agent, visitor ID, cookie or referrer URL is kept. Crawler visits
-- are daily counters per bot and site section.

-- ───────────────────────── Site visits ─────────────────────────

create table private.site_visits (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default pg_catalog.statement_timestamp(),
  path text not null check (path ~ '^/[a-z0-9/-]{0,120}$'),
  section text not null check (section ~ '^[a-z_]{2,24}$'),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  device_class text not null default 'unknown' check (device_class in ('mobile', 'tablet', 'desktop', 'unknown')),
  referrer text not null default 'direct' check (referrer ~ '^[a-z0-9_]{2,24}$')
);
create index site_visits_occurred_idx on private.site_visits (occurred_at desc);
alter table private.site_visits enable row level security;
revoke all on table private.site_visits from public, anon, authenticated, service_role;
comment on table private.site_visits is
  'Public site visits: fixed page path, section, edge country, device class and a referrer class. No IP, user agent, visitor ID or referrer URL.';

create or replace function public.record_site_visit(p_path text, p_section text, p_country text, p_device_class text, p_referrer text)
returns void language plpgsql security definer set search_path = '' as $function$
begin
  insert into private.site_visits (path, section, country, device_class, referrer)
  values (
    p_path,
    p_section,
    case when p_country ~ '^[A-Z]{2}$' and p_country <> 'XX' then p_country end,
    case when p_device_class in ('mobile', 'tablet', 'desktop') then p_device_class else 'unknown' end,
    case when p_referrer ~ '^[a-z0-9_]{2,24}$' then p_referrer else 'other' end
  );
end;
$function$;

-- Which kind of source a referrer class is.
create or replace function private.referrer_kind(p_referrer text)
returns text language sql immutable set search_path = '' as $function$
  select case
    when p_referrer in ('direct') then 'direct'
    when p_referrer in ('internal') then 'internal'
    when p_referrer in ('google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'yandex', 'baidu', 'brave', 'naver', 'startpage', 'qwant') then 'search'
    when p_referrer in ('chatgpt', 'perplexity', 'copilot', 'gemini', 'claude', 'you', 'phind', 'mistral', 'meta_ai', 'deepseek', 'grok') then 'ai'
    when p_referrer in ('x', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube', 'reddit', 'threads', 'whatsapp', 'telegram', 'producthunt', 'hackernews', 'bluesky', 'pinterest') then 'social'
    else 'other'
  end
$function$;

-- ───────────────────────── Crawlers ─────────────────────────

create table private.crawler_visits (
  day date not null default (pg_catalog.statement_timestamp() at time zone 'UTC')::date,
  bot text not null check (bot ~ '^[a-z0-9_]{2,24}$'),
  section text not null check (section ~ '^[a-z_]{2,24}$'),
  hits integer not null default 1 check (hits >= 0),
  last_seen_at timestamptz not null default pg_catalog.statement_timestamp(),
  primary key (day, bot, section)
);
alter table private.crawler_visits enable row level security;
revoke all on table private.crawler_visits from public, anon, authenticated, service_role;
comment on table private.crawler_visits is 'Daily counts of known search and AI crawler requests per site section. No URLs or IPs.';

create or replace function public.record_crawler_visit(p_bot text, p_section text)
returns void language plpgsql security definer set search_path = '' as $function$
begin
  if p_bot !~ '^[a-z0-9_]{2,24}$' or p_section !~ '^[a-z_]{2,24}$' then return; end if;
  insert into private.crawler_visits (bot, section) values (p_bot, p_section)
  on conflict (day, bot, section) do update
    set hits = private.crawler_visits.hits + 1, last_seen_at = pg_catalog.statement_timestamp();
end;
$function$;

create or replace function private.crawler_kind(p_bot text)
returns text language sql immutable set search_path = '' as $function$
  select case
    when p_bot in ('googlebot', 'bingbot', 'applebot', 'duckduckbot', 'yandexbot', 'baiduspider', 'naverbot', 'seznambot') then 'search'
    when p_bot in ('oai_searchbot', 'chatgpt_user', 'perplexitybot', 'perplexity_user', 'claude_user', 'claude_searchbot', 'mistral_user', 'youbot', 'duckassist') then 'ai_answer'
    when p_bot in ('gptbot', 'claudebot', 'ccbot', 'google_extended', 'applebot_extended', 'bytespider', 'meta_agent', 'amazonbot', 'cohere_ai', 'diffbot') then 'ai_training'
    when p_bot in ('ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot') then 'seo_tool'
    else 'other'
  end
$function$;

-- ───────────────────────── IndexNow ─────────────────────────

create table private.indexnow_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default pg_catalog.statement_timestamp(),
  submitted integer not null check (submitted >= 0),
  status integer not null
);
alter table private.indexnow_runs enable row level security;
revoke all on table private.indexnow_runs from public, anon, authenticated, service_role;

create or replace function public.record_indexnow_run(p_submitted integer, p_status integer)
returns void language sql security definer set search_path = '' as $function$
  insert into private.indexnow_runs (submitted, status) values (greatest(coalesce(p_submitted, 0), 0), coalesce(p_status, 0));
$function$;

-- ───────────────────────── Off-site checklist ─────────────────────────

create table private.growth_checklist (
  key text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  done boolean not null default false,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by uuid
);
alter table private.growth_checklist enable row level security;
revoke all on table private.growth_checklist from public, anon, authenticated, service_role;

create or replace function public.admin_set_growth_item(p_actor uuid, p_key text, p_done boolean)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_role text;
  v_before boolean;
begin
  if p_key !~ '^[a-z0-9_]{2,40}$' or p_done is null then
    raise exception using errcode = '22023', message = 'invalid_growth_item';
  end if;
  v_role := private.admin_require_actor(p_actor, array['owner', 'admin']);
  select item.done into v_before from private.growth_checklist as item where item.key = p_key;
  insert into private.growth_checklist (key, done, updated_at, updated_by)
  values (p_key, p_done, pg_catalog.statement_timestamp(), p_actor)
  on conflict (key) do update set done = excluded.done, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  insert into private.admin_audit_log (actor_user_id, actor_role, action, target_type, target_id, before, after, context)
  values (p_actor, v_role, 'growth.checklist_changed', 'growth_item', p_key,
    pg_catalog.jsonb_build_object('done', coalesce(v_before, false)), pg_catalog.jsonb_build_object('done', p_done), '{}'::jsonb);
  return pg_catalog.jsonb_build_object('key', p_key, 'done', p_done);
end;
$function$;

-- ───────────────────────── Admin reads ─────────────────────────

-- Search and AI: where visits come from, which crawlers read the site, IndexNow, the checklist.
create or replace function public.admin_growth(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
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
    'recording_since', (select min(visit.occurred_at) from private.site_visits as visit),
    'totals', (
      select pg_catalog.jsonb_build_object(
        'visits', count(*) filter (where visit.occurred_at >= v_start),
        'visits_previous', count(*) filter (where visit.occurred_at < v_start),
        'search', count(*) filter (where visit.occurred_at >= v_start and private.referrer_kind(visit.referrer) = 'search'),
        'search_previous', count(*) filter (where visit.occurred_at < v_start and private.referrer_kind(visit.referrer) = 'search'),
        'ai', count(*) filter (where visit.occurred_at >= v_start and private.referrer_kind(visit.referrer) = 'ai'),
        'ai_previous', count(*) filter (where visit.occurred_at < v_start and private.referrer_kind(visit.referrer) = 'ai'),
        'social', count(*) filter (where visit.occurred_at >= v_start and private.referrer_kind(visit.referrer) = 'social'),
        'direct', count(*) filter (where visit.occurred_at >= v_start and private.referrer_kind(visit.referrer) = 'direct')
      )
      from private.site_visits as visit
      where visit.occurred_at >= v_prev_start and visit.occurred_at < v_end and visit.referrer <> 'internal'
    ),
    'daily', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'date', days.day::date::text,
        'search', coalesce(activity.search, 0),
        'ai', coalesce(activity.ai, 0),
        'other', coalesce(activity.other, 0)
      ) order by days.day), '[]'::jsonb)
      from pg_catalog.generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as days(day)
      left join (
        select (visit.occurred_at at time zone 'UTC')::date as day,
          count(*) filter (where private.referrer_kind(visit.referrer) = 'search') as search,
          count(*) filter (where private.referrer_kind(visit.referrer) = 'ai') as ai,
          count(*) filter (where private.referrer_kind(visit.referrer) not in ('search', 'ai')) as other
        from private.site_visits as visit
        where visit.occurred_at >= v_start and visit.occurred_at < v_end and visit.referrer <> 'internal'
        group by 1
      ) as activity on activity.day = days.day::date
    ),
    'referrers', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('referrer', grouped.referrer, 'kind', private.referrer_kind(grouped.referrer), 'count', grouped.count) order by grouped.count desc), '[]'::jsonb)
      from (
        select visit.referrer, count(*) as count from private.site_visits as visit
        where visit.occurred_at >= v_start and visit.occurred_at < v_end and visit.referrer <> 'internal'
        group by visit.referrer order by count(*) desc limit 20
      ) as grouped
    ),
    'landing', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('path', grouped.path, 'section', grouped.section, 'visits', grouped.visits, 'search', grouped.search, 'ai', grouped.ai) order by grouped.visits desc), '[]'::jsonb)
      from (
        select visit.path, min(visit.section) as section, count(*) as visits,
          count(*) filter (where private.referrer_kind(visit.referrer) = 'search') as search,
          count(*) filter (where private.referrer_kind(visit.referrer) = 'ai') as ai
        from private.site_visits as visit
        where visit.occurred_at >= v_start and visit.occurred_at < v_end and visit.referrer <> 'internal'
        group by visit.path order by count(*) desc limit 25
      ) as grouped
    ),
    'crawlers', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'bot', grouped.bot, 'kind', private.crawler_kind(grouped.bot), 'hits', grouped.hits,
        'llms', grouped.llms, 'sitemap', grouped.sitemap, 'pages', grouped.pages, 'last_seen_at', grouped.last_seen_at
      ) order by grouped.hits desc), '[]'::jsonb)
      from (
        select crawl.bot, sum(crawl.hits) as hits,
          coalesce(sum(crawl.hits) filter (where crawl.section = 'llms'), 0) as llms,
          coalesce(sum(crawl.hits) filter (where crawl.section in ('sitemap', 'robots')), 0) as sitemap,
          coalesce(sum(crawl.hits) filter (where crawl.section not in ('llms', 'sitemap', 'robots')), 0) as pages,
          max(crawl.last_seen_at) as last_seen_at
        from private.crawler_visits as crawl
        where crawl.day between p_from and p_to
        group by crawl.bot
      ) as grouped
    ),
    'crawler_daily', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'date', days.day::date::text, 'search', coalesce(activity.search, 0), 'ai', coalesce(activity.ai, 0)
      ) order by days.day), '[]'::jsonb)
      from pg_catalog.generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as days(day)
      left join (
        select crawl.day,
          sum(crawl.hits) filter (where private.crawler_kind(crawl.bot) = 'search') as search,
          sum(crawl.hits) filter (where private.crawler_kind(crawl.bot) in ('ai_answer', 'ai_training')) as ai
        from private.crawler_visits as crawl where crawl.day between p_from and p_to group by crawl.day
      ) as activity on activity.day = days.day::date
    ),
    'crawler_sections', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('section', grouped.section, 'hits', grouped.hits) order by grouped.hits desc), '[]'::jsonb)
      from (
        select crawl.section, sum(crawl.hits) as hits from private.crawler_visits as crawl
        where crawl.day between p_from and p_to and private.crawler_kind(crawl.bot) in ('ai_answer', 'ai_training')
        group by crawl.section order by sum(crawl.hits) desc limit 12
      ) as grouped
    ),
    'indexnow', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('ran_at', run.ran_at, 'submitted', run.submitted, 'status', run.status) order by run.ran_at desc), '[]'::jsonb)
      from (select * from private.indexnow_runs order by ran_at desc limit 10) as run
    ),
    'checklist', (
      select coalesce(pg_catalog.jsonb_object_agg(item.key, pg_catalog.jsonb_build_object('done', item.done, 'updated_at', item.updated_at)), '{}'::jsonb)
      from private.growth_checklist as item
    )
  );
end;
$function$;

-- Product usage: what members do with every Mode tool, in the range and in total.
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
      'orders', (select count(*) from public.creator_orders as orders where orders.paid_at >= v_start and orders.paid_at < v_end),
      'gross_minor', (select coalesce(sum(orders.gross_amount_minor), 0) from public.creator_orders as orders where orders.paid_at >= v_start and orders.paid_at < v_end and orders.currency = 'usd'),
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

-- Scheduled jobs: every Setuvara pg_cron job with its last run, plus the app's own job logs.
create or replace function public.admin_jobs()
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
begin
  return pg_catalog.jsonb_build_object(
    'cron', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', job.jobname, 'schedule', job.schedule, 'active', job.active,
        'last_status', last_run.status, 'last_started_at', last_run.start_time, 'last_finished_at', last_run.end_time,
        'failed_7d', (select count(*) from cron.job_run_details as run where run.jobid = job.jobid and run.status = 'failed' and run.start_time > pg_catalog.statement_timestamp() - interval '7 days')
      ) order by job.jobname), '[]'::jsonb)
      from cron.job as job
      left join lateral (
        select run.status, run.start_time, run.end_time from cron.job_run_details as run
        where run.jobid = job.jobid order by run.start_time desc limit 1
      ) as last_run on true
      where job.jobname like 'setuvara-%'
    ),
    'app_jobs', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'job', grouped.job, 'last_started_at', grouped.last_started_at, 'last_ok', grouped.last_ok, 'failed_7d', grouped.failed_7d
      ) order by grouped.job), '[]'::jsonb)
      from (
        select runs.job, max(runs.started_at) as last_started_at,
          (array_agg(runs.ok order by runs.started_at desc))[1] as last_ok,
          count(*) filter (where runs.ok is false and runs.started_at > pg_catalog.statement_timestamp() - interval '7 days') as failed_7d
        from public.commerce_job_runs as runs group by runs.job
      ) as grouped
    ),
    'indexnow_last', (select pg_catalog.jsonb_build_object('ran_at', run.ran_at, 'submitted', run.submitted, 'status', run.status) from private.indexnow_runs as run order by run.ran_at desc limit 1)
  );
end;
$function$;

-- The old site traffic now reads both the original page views and the new visits.
create or replace function public.admin_site_traffic(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
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

  return (
    with all_views as (
      select views.occurred_at, views.page, views.country from private.site_page_views as views
      union all
      select visit.occurred_at, visit.section, visit.country from private.site_visits as visit
    )
    select pg_catalog.jsonb_build_object(
      'recording_since', (select min(all_views.occurred_at) from all_views),
      'totals', (
        select pg_catalog.jsonb_build_object(
          'views', count(*) filter (where v.occurred_at >= v_start),
          'views_previous', count(*) filter (where v.occurred_at < v_start),
          'home', count(*) filter (where v.occurred_at >= v_start and v.page = 'home'),
          'home_previous', count(*) filter (where v.occurred_at < v_start and v.page = 'home'),
          'countries', count(distinct v.country) filter (where v.occurred_at >= v_start)
        ) from all_views as v where v.occurred_at >= v_prev_start and v.occurred_at < v_end
      ),
      'daily', (
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('date', days.day::date::text, 'views', coalesce(activity.views, 0), 'home', coalesce(activity.home, 0)) order by days.day), '[]'::jsonb)
        from pg_catalog.generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as days(day)
        left join (
          select (v.occurred_at at time zone 'UTC')::date as day, count(*) as views, count(*) filter (where v.page = 'home') as home
          from all_views as v where v.occurred_at >= v_start and v.occurred_at < v_end group by 1
        ) as activity on activity.day = days.day::date
      ),
      'pages', (
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('page', grouped.page, 'count', grouped.count) order by grouped.count desc), '[]'::jsonb)
        from (select v.page, count(*) as count from all_views as v where v.occurred_at >= v_start and v.occurred_at < v_end group by v.page) as grouped
      ),
      'countries', (
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('country', grouped.country, 'count', grouped.count) order by grouped.count desc), '[]'::jsonb)
        from (select v.country, count(*) as count from all_views as v where v.occurred_at >= v_start and v.occurred_at < v_end group by v.country order by count(*) desc limit 12) as grouped
      )
    )
  );
end;
$function$;

-- Writers are called by the app's server with the service role; admin reads likewise.
revoke all on function public.record_site_visit(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.record_crawler_visit(text, text) from public, anon, authenticated;
revoke all on function public.record_indexnow_run(integer, integer) from public, anon, authenticated;
revoke all on function public.admin_set_growth_item(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.admin_growth(date, date) from public, anon, authenticated;
revoke all on function public.admin_product(date, date) from public, anon, authenticated;
revoke all on function public.admin_jobs() from public, anon, authenticated;
revoke all on function public.admin_site_traffic(date, date) from public, anon, authenticated;
revoke all on function private.referrer_kind(text) from public, anon, authenticated, service_role;
revoke all on function private.crawler_kind(text) from public, anon, authenticated, service_role;
grant execute on function public.record_site_visit(text, text, text, text, text), public.record_crawler_visit(text, text),
  public.record_indexnow_run(integer, integer), public.admin_set_growth_item(uuid, text, boolean),
  public.admin_growth(date, date), public.admin_product(date, date), public.admin_jobs(), public.admin_site_traffic(date, date)
  to service_role;
