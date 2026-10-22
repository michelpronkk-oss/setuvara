-- Gallery: members choose, per Mode, to show their page in the public gallery at /gallery.
-- Off by default. Only pages that already have a public address can be listed: Personal at the
-- username of a published profile, Business and Creator at a live Mode handle. Event Modes and
-- every /s/ link stay private, and a Mode handle's username is never returned.

create table public.gallery_listings (
  mode_id uuid primary key references public.profile_modes (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  listed_at timestamptz not null default now()
);
create index gallery_listings_profile_idx on public.gallery_listings (profile_id);
create index gallery_listings_listed_at_idx on public.gallery_listings (listed_at desc);
alter table public.gallery_listings enable row level security;
-- No policies: owners go through set/get_gallery_listing, visitors through list_gallery.
revoke all on public.gallery_listings from anon, authenticated;
comment on table public.gallery_listings is 'Opt-in gallery listing per Mode. Written only by set_gallery_listing; public reads go through list_gallery.';

-- Turn listing on or off for one of my Modes. On needs a public address for that Mode.
create function public.set_gallery_listing(p_mode text, p_listed boolean)
returns boolean language plpgsql volatile security definer set search_path = '' as $function$
declare
  me uuid := (select auth.uid());
  target public.profile_modes;
begin
  if me is null then raise exception using errcode = '42501', message = 'sign_in'; end if;
  select * into target from public.profile_modes where profile_id = me and slug = p_mode;
  if target.id is null then raise exception using errcode = '22023', message = 'mode_missing'; end if;
  if not coalesce(p_listed, false) then
    delete from public.gallery_listings where mode_id = target.id;
    return false;
  end if;
  if not target.is_enabled then raise exception using errcode = '22023', message = 'mode_disabled'; end if;
  if p_mode = 'personal' then
    if not exists (select 1 from public.profiles where id = me and is_published) then
      raise exception using errcode = '22023', message = 'not_published';
    end if;
  elsif not exists (select 1 from public.mode_handles where mode_id = target.id and is_live) then
    raise exception using errcode = '22023', message = 'needs_public_handle';
  end if;
  insert into public.gallery_listings (mode_id, profile_id) values (target.id, me) on conflict (mode_id) do nothing;
  return true;
end;
$function$;
revoke all on function public.set_gallery_listing(text, boolean) from public, anon;
grant execute on function public.set_gallery_listing(text, boolean) to authenticated;

-- Which of my Modes are listed.
create function public.my_gallery_listings()
returns setof text language sql stable security definer set search_path = '' as $function$
  select pm.slug from public.gallery_listings g join public.profile_modes pm on pm.id = g.mode_id
  where g.profile_id = (select auth.uid())
$function$;
revoke all on function public.my_gallery_listings() from public, anon;
grant execute on function public.my_gallery_listings() to authenticated;

-- The public gallery. Re-checks every condition at read time, so a page that is unpublished,
-- disabled or loses its handle drops out without anyone touching the listing.
create function public.list_gallery(p_mode text default null, p_look text default null, p_limit integer default 60)
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
      'company', pm.settings ->> 'company', 'tagline', pm.settings ->> 'tagline', 'category', pm.settings ->> 'category',
      'description', pm.settings ->> 'description', 'note', pm.settings ->> 'note')),
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
revoke all on function public.list_gallery(text, text, integer) from public;
grant execute on function public.list_gallery(text, text, integer) to anon, authenticated, service_role;
