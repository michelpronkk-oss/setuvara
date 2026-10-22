-- The gallery also needs the member's plan (the tier the member badge already shows), because the
-- plan decides which Look a page renders: paid Looks fall back after a downgrade. It rides in
-- details, so the return type stays. p_look still filters on the saved theme; the site filters on
-- the rendered Look after reading. The card line needs only location, city, role, company and
-- category, so nothing else leaves the settings.
create or replace function public.list_gallery(p_mode text default null, p_look text default null, p_limit integer default 60)
returns table (path text, name text, mode text, look text, accent text, image_path text, focus_x smallint, focus_y smallint, details jsonb, listed_at timestamptz)
language sql stable security definer set search_path = '' as $function$
  select
    case when pm.slug = 'personal' then p.username else h.handle end,
    pg_catalog.left(pg_catalog.btrim(p.display_name), 80),
    pm.slug,
    coalesce(pm.appearance ->> 'theme', 'immersive'),
    pm.appearance ->> 'accent',
    pm.image_path,
    pm.image_focus_x,
    pm.image_focus_y,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'location', pm.settings ->> 'location', 'city', pm.settings ->> 'city', 'role', pm.settings ->> 'role',
      'company', pm.settings ->> 'company', 'category', pm.settings ->> 'category', 'plan', private.member_plan(p.id))),
    g.listed_at
  from public.gallery_listings g
  join public.profile_modes pm on pm.id = g.mode_id and pm.is_enabled
  join public.profiles p on p.id = pm.profile_id and p.is_published
  left join public.mode_handles h on h.mode_id = pm.id and h.is_live
  where (pm.slug = 'personal' or h.handle is not null)
    and (p_mode is null or pm.slug = p_mode)
    and (p_look is null or coalesce(pm.appearance ->> 'theme', 'immersive') = p_look)
  order by g.listed_at desc
  limit greatest(0, least(coalesce(p_limit, 60), 200))
$function$;
