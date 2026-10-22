-- Link taps: one counter per link per day. No visitor data of any kind (no IP, user agent,
-- account or referrer), the same rule as page views. Written only by the server; read only by
-- the link's owner, through get_link_clicks.

create table private.link_clicks_daily (
  link_id uuid not null references public.profile_links(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  clicks integer not null default 0 check (clicks >= 0),
  primary key (link_id, day)
);
create index link_clicks_owner_day_idx on private.link_clicks_daily (owner_profile_id, day desc);
alter table private.link_clicks_daily enable row level security;
revoke all on table private.link_clicks_daily from public, anon, authenticated, service_role;

-- Counts a tap on a visible link of a published page. The owner's own taps and anything else
-- are ignored.
create function public.record_link_click(p_link_id uuid, p_viewer uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $function$
declare v_owner uuid;
begin
  select l.profile_id into v_owner
  from public.profile_links l
  join public.profiles p on p.id = l.profile_id and p.is_published
  join public.profile_modes m on m.id = l.mode_id and m.is_enabled
  where l.id = p_link_id and l.is_visible;
  if v_owner is null or v_owner = p_viewer then return false; end if;
  insert into private.link_clicks_daily as c (link_id, owner_profile_id, day, clicks)
  values (p_link_id, v_owner, (pg_catalog.statement_timestamp() at time zone 'utc')::date, 1)
  on conflict (link_id, day) do update set clicks = c.clicks + 1;
  return true;
end
$function$;
revoke all on function public.record_link_click(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_link_click(uuid, uuid) to service_role;

-- The owner's taps per link in a window, newest Mode first, with a daily total. The window is
-- clamped to the plan's analytics history (Free 7 days, Plus 90, Pro 730), as elsewhere.
create function public.get_link_clicks(p_from date, p_to date, p_mode text default null)
returns jsonb language sql stable security definer set search_path = '' as $function$
  with me as (
    select auth.uid() as id,
      greatest(p_from, (pg_catalog.statement_timestamp() at time zone 'utc')::date - case private.member_plan(auth.uid()) when 'pro' then 730 when 'plus' then 90 else 7 end) as since,
      least(p_to, (pg_catalog.statement_timestamp() at time zone 'utc')::date) as until
  ), rows as (
    select c.link_id, c.day, c.clicks, l.title, l.link_type, m.slug as mode_slug
    from private.link_clicks_daily c
    join me on c.owner_profile_id = me.id and c.day between me.since and me.until
    join public.profile_links l on l.id = c.link_id
    join public.profile_modes m on m.id = l.mode_id
    where p_mode is null or m.slug = p_mode
  )
  select jsonb_build_object(
    'total', coalesce((select sum(clicks) from rows), 0),
    'links', coalesce((select jsonb_agg(x order by x.clicks desc, x.title) from (
      select link_id, title, link_type, mode_slug, sum(clicks)::int as clicks from rows group by link_id, title, link_type, mode_slug
    ) x), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'clicks', clicks) order by day) from (
      select day, sum(clicks)::int as clicks from rows group by day
    ) d), '[]'::jsonb)
  )
  where auth.uid() is not null
$function$;
revoke all on function public.get_link_clicks(date, date, text) from public, anon;
grant execute on function public.get_link_clicks(date, date, text) to authenticated;
