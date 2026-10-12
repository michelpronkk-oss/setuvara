-- Photo zoom out and the Plus/Pro photo slideshow.
--
-- 1. profile_modes.appearance: portraitZoom also accepts 70 and 85 (zoom out, so the full
--    photo fits; the app uses them on Immersive only), and one more optional key,
--    slideSpeed (slow|medium|fast). Both are Free values; the slideshow itself is gated
--    below. Only the check constraint is recreated; existing rows already satisfy it.
-- 2. profile_modes.slide_photos: the Mode's extra slideshow photos after its main photo,
--    as [{path, x, y}] (owner-scoped object path and face point in percent), at most three.
-- 3. Plan guard: Free has no extra photos, Plus one (two slides), Pro three (four slides).
--    A member may always remove photos; adding beyond the plan is refused. A downgrade
--    keeps what was saved (the app shows only what the plan allows).
-- 4. Storage: published, enabled Modes' slideshow photos are readable like the main photo.

alter table public.profile_modes
  drop constraint if exists profile_modes_appearance_check;

alter table public.profile_modes
  add constraint profile_modes_appearance_check
    check (
      jsonb_typeof(appearance) = 'object'
      and appearance ?& array['theme', 'accent']
      and appearance - array[
        'theme', 'accent', 'layout', 'imageTreatment', 'qrStyle',
        'intensity', 'card', 'radius', 'button', 'links', 'soundStyle',
        'portraitZoom', 'portraitNameSize', 'portraitShowUsername',
        'namePosition', 'readability', 'socialStyle', 'socialPlacement', 'identityAlign', 'slideSpeed', 'motion', 'soundtrackPresentation'
      ] = '{}'::jsonb
      and jsonb_typeof(appearance -> 'theme') = 'string'
      and jsonb_typeof(appearance -> 'accent') = 'string'
      and appearance ->> 'theme' in (
        'immersive', 'motion', 'aura', 'clean', 'glow', 'scene', 'frame', 'stack', 'social', 'film',
        'light', 'dark', 'editorial', 'noir', 'signal', 'studio'
      )
      and appearance ->> 'accent' ~ '^#[0-9A-Fa-f]{6}$'
      and (
        not (appearance ? 'layout')
        or (
          jsonb_typeof(appearance -> 'layout') = 'string'
          and (
            appearance ->> 'layout' in ('portrait', 'poster', 'index')
            or (slug = 'personal' and appearance ->> 'layout' in ('full-bleed', 'portrait-editorial', 'full-portrait'))
            or (slug = 'event' and appearance ->> 'layout' in ('event-poster', 'conference-card', 'full-portrait'))
            or (slug = 'business' and appearance ->> 'layout' in ('structured', 'editorial-business', 'full-portrait'))
          )
        )
      )
      and (
        not (appearance ? 'imageTreatment')
        or (jsonb_typeof(appearance -> 'imageTreatment') = 'string' and appearance ->> 'imageTreatment' in ('full-bleed', 'portrait', 'compact', 'frame'))
      )
      and (
        not (appearance ? 'qrStyle')
        or (jsonb_typeof(appearance -> 'qrStyle') = 'string' and appearance ->> 'qrStyle' in ('standard', 'accent-frame', 'label', 'inverse', 'rounded'))
      )
      and (
        not (appearance ? 'intensity')
        or (jsonb_typeof(appearance -> 'intensity') = 'string' and appearance ->> 'intensity' in ('quiet', 'balanced', 'signal'))
      )
      and (
        not (appearance ? 'card')
        or (jsonb_typeof(appearance -> 'card') = 'string' and appearance ->> 'card' in ('flat', 'outline', 'soft', 'layered', 'editorial'))
      )
      and (
        not (appearance ? 'radius')
        or (jsonb_typeof(appearance -> 'radius') = 'string' and appearance ->> 'radius' in ('sharp', 'subtle', 'soft'))
      )
      and (
        not (appearance ? 'button')
        or (jsonb_typeof(appearance -> 'button') = 'string' and appearance ->> 'button' in ('pill', 'block', 'editorial', 'minimal'))
      )
      and (
        not (appearance ? 'links')
        or (jsonb_typeof(appearance -> 'links') = 'string' and appearance ->> 'links' in ('icons', 'list', 'chips', 'cards'))
      )
      and (
        not (appearance ? 'soundStyle')
        or (jsonb_typeof(appearance -> 'soundStyle') = 'string' and appearance ->> 'soundStyle' in ('core', 'strip', 'disc', 'poster'))
      )
      and (
        not (appearance ? 'portraitZoom')
        or case when jsonb_typeof(appearance -> 'portraitZoom') = 'number'
          then (appearance ->> 'portraitZoom')::numeric in (70, 85, 100, 110, 115, 120, 130, 140)
          else false end
      )
      and (
        not (appearance ? 'portraitNameSize')
        or (jsonb_typeof(appearance -> 'portraitNameSize') = 'string' and appearance ->> 'portraitNameSize' in ('compact', 'standard', 'large', 'statement'))
      )
      and (not (appearance ? 'portraitShowUsername') or jsonb_typeof(appearance -> 'portraitShowUsername') = 'boolean')
      and (
        not (appearance ? 'namePosition')
        or (jsonb_typeof(appearance -> 'namePosition') = 'string' and appearance ->> 'namePosition' in ('auto', 'top', 'bottom'))
      )
      and (
        not (appearance ? 'readability')
        or (jsonb_typeof(appearance -> 'readability') = 'string' and appearance ->> 'readability' in ('auto', 'soft', 'deep'))
      )
      and (
        not (appearance ? 'socialStyle')
        or (jsonb_typeof(appearance -> 'socialStyle') = 'string' and appearance ->> 'socialStyle' in ('rail', 'row', 'compact', 'hidden'))
      )
      and (
        not (appearance ? 'socialPlacement')
        or (jsonb_typeof(appearance -> 'socialPlacement') = 'string' and appearance ->> 'socialPlacement' in ('name', 'links', 'both'))
      )
      and (
        not (appearance ? 'identityAlign')
        or (jsonb_typeof(appearance -> 'identityAlign') = 'string' and appearance ->> 'identityAlign' in ('auto', 'left', 'center'))
      )
      and (
        not (appearance ? 'slideSpeed')
        or (jsonb_typeof(appearance -> 'slideSpeed') = 'string' and appearance ->> 'slideSpeed' in ('slow', 'medium', 'fast'))
      )
      and (
        not (appearance ? 'motion')
        or (jsonb_typeof(appearance -> 'motion') = 'string' and appearance ->> 'motion' in ('off', 'subtle', 'full'))
      )
      and (
        not (appearance ? 'soundtrackPresentation')
        or (jsonb_typeof(appearance -> 'soundtrackPresentation') = 'string' and appearance ->> 'soundtrackPresentation' in ('ambient', 'minimal', 'featured'))
      )
    );


comment on constraint profile_modes_appearance_check on public.profile_modes is
  'Curated per-Mode Appearance ids and bounded personalization only (no CSS). Legacy themes and layouts stay readable. Plan access is resolved server-side; premium values survive downgrade.';

alter table public.profile_modes
  add column if not exists slide_photos jsonb not null default '[]'::jsonb;

alter table public.profile_modes
  drop constraint if exists profile_modes_slide_photos_check;

alter table public.profile_modes
  add constraint profile_modes_slide_photos_check
    check (
      jsonb_typeof(slide_photos) = 'array'
      and jsonb_array_length(slide_photos) <= 3
      and not jsonb_path_exists(
        slide_photos,
        '$[*] ? (@.type() != "object" || !exists(@.path) || !exists(@.x) || !exists(@.y)
          || exists(@.keyvalue() ? (@.key != "path" && @.key != "x" && @.key != "y"))
          || @.path.type() != "string" || !(@.path starts with $owner)
          || !(@.path like_regex "^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$")
          || @.x.type() != "number" || @.y.type() != "number"
          || @.x < 0 || @.x > 100 || @.y < 0 || @.y > 100)',
        jsonb_build_object('owner', profile_id::text || '/')
      )
    );

comment on column public.profile_modes.slide_photos is
  'Extra slideshow photos after image_path: [{path, x, y}], at most three. Plus shows one, Pro three; enforced on write by private.enforce_profile_mode_slides_plan().';

create or replace function private.enforce_profile_mode_slides_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed integer := 0;
  added integer;
begin
  -- Server-side jobs (service role, migrations) are trusted; members' own writes are checked.
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;

  added := jsonb_array_length(new.slide_photos)
    - case when tg_op = 'UPDATE' then jsonb_array_length(old.slide_photos) else 0 end;
  -- Removing (or reordering without adding) is always allowed, so a downgrade never traps a member.
  if added <= 0 then
    return new;
  end if;

  select coalesce(max(case s.plan_code when 'pro' then 3 when 'plus' then 1 else 0 end), 0)
  into allowed
  from public.billing_subscriptions s
  where s.user_id = new.profile_id
    and s.plan_code in ('plus', 'pro')
    and public.billing_subscription_has_access(
      s.provider_status, s.current_period_end, s.cancel_at_next_billing_date, s.past_due_ends_at
    );

  if jsonb_array_length(new.slide_photos) <= allowed then
    return new;
  end if;

  raise exception 'slideshow_requires_plan'
    using errcode = 'P0001',
      hint = 'The photo slideshow needs Setuvara Plus (2 slides) or Pro (4 slides).';
end;
$$;

revoke all on function private.enforce_profile_mode_slides_plan() from public, anon, authenticated;

drop trigger if exists enforce_profile_mode_slides_plan on public.profile_modes;
create trigger enforce_profile_mode_slides_plan
before insert or update of slide_photos on public.profile_modes
for each row execute function private.enforce_profile_mode_slides_plan();

drop policy if exists "Public can read published Mode slideshow photos" on storage.objects;
create policy "Public can read published Mode slideshow photos"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'profile-media'
  and exists (
    select 1
    from public.profile_modes as modes
    join public.profiles as profiles on profiles.id = modes.profile_id
    where modes.slide_photos @> jsonb_build_array(jsonb_build_object('path', storage.objects.name))
      and split_part(storage.objects.name, '/', 1) = modes.profile_id::text
      and modes.is_enabled
      and profiles.is_published
  )
);
