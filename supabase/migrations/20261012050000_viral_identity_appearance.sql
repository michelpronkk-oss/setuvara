-- Setuvara viral identity Appearances.
--
-- 1. profile_modes.appearance accepts the ten Appearance ids (immersive, motion, aura,
--    clean, glow, scene, frame, stack, social, film) next to the retired legacy themes,
--    which stay readable and are normalized by the app resolver. layout and
--    imageTreatment become optional legacy keys. New bounded personalization keys:
--    namePosition (auto|top|bottom), readability (auto|soft|deep), socialStyle
--    (rail|row|compact|hidden), motion (off|subtle|full), soundtrackPresentation
--    (ambient|minimal|featured). portraitZoom also accepts 115. Every value is an
--    enumerated id or a bounded number; no CSS, pixels, HTML, JS or fonts are stored.
--    Existing rows already satisfy the new check, so no data is rewritten.
-- 2. Entitlement guard: Immersive and Clean are Free, the other eight are Plus.
--    portraitZoom, portraitShowUsername and socialStyle are Free. Newly introduced
--    premium values are refused for accounts without Plus/Pro; unchanged saved premium
--    values pass, so a downgrade never deletes configuration.
-- 3. New accounts start on Immersive (Personal, Event) and Clean (Business). A validated
--    signup hint may choose Immersive or Clean for Personal; it never grants anything.
-- 4. get_public_live_context(username): the label, type and expiry of a published
--    profile's currently effective Live Context, for the temporary "Live" pill. Venue,
--    city and history stay private. The table's owner-only RLS is unchanged.
-- Applied migrations 20261011190000, 20261011220000 and 20261011221000 are not edited.

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
        'namePosition', 'readability', 'socialStyle', 'motion', 'soundtrackPresentation'
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
          then (appearance ->> 'portraitZoom')::numeric in (100, 110, 115, 120, 130, 140)
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

-- Whether a saved appearance value is above Free. Mirrors capabilityForField() in
-- src/components/profile/appearance.ts.
create or replace function private.appearance_value_is_premium(p_field text, p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or p_value = 'null'::jsonb then false
    when p_field = 'theme' then p_value #>> '{}' not in ('immersive', 'clean', 'light', 'dark')
    when p_field = 'layout' then p_value #>> '{}' in ('portrait', 'poster', 'index', 'full-portrait')
    when p_field in ('portraitZoom', 'portraitShowUsername', 'socialStyle') then false
    when p_field = 'portraitNameSize' then p_value #>> '{}' <> 'standard'
    when p_field = 'namePosition' then p_value #>> '{}' = 'top'
    when p_field = 'readability' then p_value #>> '{}' in ('soft', 'deep')
    when p_field = 'motion' then p_value #>> '{}' = 'full'
    when p_field = 'soundtrackPresentation' then p_value #>> '{}' = 'featured'
    when p_field = 'imageTreatment' then p_value #>> '{}' = 'frame'
    when p_field = 'intensity' then p_value #>> '{}' <> 'balanced'
    when p_field in ('card', 'radius', 'button', 'links') then true
    when p_field = 'soundStyle' then p_value #>> '{}' <> 'core'
    when p_field = 'qrStyle' then p_value #>> '{}' <> 'standard'
    else false
  end
$$;

create or replace function private.enforce_profile_mode_appearance_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  field text;
  introduced boolean := false;
begin
  -- Server-side jobs (service role, migrations) are trusted; members' own writes are checked.
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;

  foreach field in array array[
    'theme', 'layout', 'portraitZoom', 'portraitNameSize', 'portraitShowUsername',
    'namePosition', 'readability', 'socialStyle', 'motion', 'soundtrackPresentation',
    'imageTreatment', 'intensity', 'card', 'radius', 'button', 'links', 'soundStyle', 'qrStyle'
  ] loop
    if private.appearance_value_is_premium(field, new.appearance -> field)
      and (tg_op = 'INSERT' or (old.appearance -> field) is distinct from (new.appearance -> field)) then
      introduced := true;
      exit;
    end if;
  end loop;

  if not introduced then
    return new;
  end if;

  if exists (
    select 1
    from public.billing_subscriptions s
    where s.user_id = new.profile_id
      and s.plan_code in ('plus', 'pro')
      and public.billing_subscription_has_access(
        s.provider_status, s.current_period_end, s.cancel_at_next_billing_date, s.past_due_ends_at
      )
  ) then
    return new;
  end if;

  raise exception 'appearance_requires_plus'
    using errcode = 'P0001',
      hint = 'Premium appearance values need an active Setuvara Plus or Pro membership. Saved values are kept.';
end;
$$;

revoke all on function private.appearance_value_is_premium(text, jsonb) from public, anon, authenticated;
revoke all on function private.enforce_profile_mode_appearance_plan() from public, anon, authenticated;

comment on function private.enforce_profile_mode_appearance_plan() is
  'Refuses newly introduced premium Appearance values (the eight Plus Appearances and Plus personalization) for accounts without active Plus/Pro. Unchanged saved values pass.';

-- New accounts: Immersive for Personal and Event, Clean for Business. An optional,
-- enum-validated signup hint ("Make yours") may pick a Free Appearance for Personal.
create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_username text;
  requested_display_name text;
  personal_theme text;
begin
  requested_username := pg_catalog.lower(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_display_name := pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  personal_theme := case
    when new.raw_user_meta_data ->> 'appearance' = 'clean' then 'clean'
    else 'immersive'
  end;

  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception using errcode = '23514', message = 'Invalid username';
  end if;
  if pg_catalog.char_length(requested_display_name) not between 1 and 80 then
    requested_display_name := requested_username;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, requested_username, requested_display_name);

  insert into public.profile_modes (profile_id, slug, label, sort_order, appearance)
  values
    (new.id, 'personal', 'Personal', 1, pg_catalog.jsonb_build_object('theme', personal_theme, 'accent', '#FF5A4F')),
    (new.id, 'event', 'Event', 2, '{"theme":"immersive","accent":"#FF5A4F"}'::jsonb),
    (new.id, 'business', 'Business', 3, '{"theme":"clean","accent":"#FF5A4F"}'::jsonb);

  insert into public.equipped_share_states (profile_id, mode_id, intent)
  select new.id, profile_modes.id, 'view_profile'
  from public.profile_modes
  where profile_modes.profile_id = new.id and profile_modes.slug = 'personal';

  return new;
end;
$function$;

revoke all on function private.create_profile_for_new_user() from public, anon, authenticated;

-- Public, read-only view of a published profile's effective Live Context. Only the label,
-- type and expiry leave the table; venue, city, country, saved and recent contexts stay
-- owner-only. Expired, inactive or not-yet-started contexts return nothing.
create or replace function public.get_public_live_context(p_username text)
returns table (context_type text, label text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select lc.context_type, lc.label, lc.expires_at
  from public.profiles p
  join public.live_contexts lc on lc.owner_user_id = p.id
  where p.username = pg_catalog.lower(pg_catalog.btrim(coalesce(p_username, '')))
    and p.is_published
    and lc.is_active
    and lc.expires_at > pg_catalog.now()
    and (lc.starts_at is null or lc.starts_at <= pg_catalog.now())
  order by lc.created_at desc
  limit 1
$$;

revoke all on function public.get_public_live_context(text) from public;
grant execute on function public.get_public_live_context(text) to anon, authenticated;

comment on function public.get_public_live_context(text) is
  'Label, type and expiry of a published profile''s currently effective Live Context, for the temporary public Live pill. Venue and history stay private.';
