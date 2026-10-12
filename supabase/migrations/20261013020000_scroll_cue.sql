-- Scroll cue: the small sign at the foot of a profile's hero that there is more below.
--
-- profile_modes.appearance gains one optional key, scrollCue:
--   auto (the Appearance's own cue; the default when absent) and off are Free;
--   glide, rail, orb, mouse, beam, cascade, caption, cards, swipe and credits (choosing one of the
--   ten explicitly) need Plus or Pro.
-- Only ids are stored. The check constraint is recreated with the new key, and the plan trigger
-- learns the field: a member without Plus cannot newly save a chosen cue, while a saved one
-- survives a downgrade (it renders as the Appearance's own until Plus returns). Existing rows
-- already satisfy the new check.

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
        'namePosition', 'readability', 'socialStyle', 'socialPlacement', 'identityAlign', 'slideSpeed', 'mediaLayout', 'nameFont', 'scrollCue', 'motion', 'soundtrackPresentation'
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
        not (appearance ? 'mediaLayout')
        or (jsonb_typeof(appearance -> 'mediaLayout') = 'string' and appearance ->> 'mediaLayout' in ('featured', 'stack', 'grid', 'carousel'))
      )
      and (
        not (appearance ? 'nameFont')
        or (jsonb_typeof(appearance -> 'nameFont') = 'string' and appearance ->> 'nameFont' in ('setuvara', 'modern', 'editorial', 'condensed', 'impact', 'soft'))
      )
      and (
        not (appearance ? 'scrollCue')
        or (jsonb_typeof(appearance -> 'scrollCue') = 'string' and appearance ->> 'scrollCue' in ('auto', 'off', 'glide', 'rail', 'orb', 'mouse', 'beam', 'cascade', 'caption', 'cards', 'swipe', 'credits'))
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
    when p_field = 'nameFont' then p_value #>> '{}' not in ('setuvara', 'modern')
    when p_field = 'scrollCue' then p_value #>> '{}' not in ('auto', 'off')
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
    'imageTreatment', 'intensity', 'card', 'radius', 'button', 'links', 'soundStyle', 'qrStyle', 'nameFont', 'scrollCue'
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
  'Refuses newly introduced premium Appearance values (the eight Plus Appearances, Plus name types, chosen scroll cues and Plus personalization) for accounts without active Plus/Pro. Unchanged saved values pass.';
