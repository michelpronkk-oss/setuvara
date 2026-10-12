-- Social icons placement per Mode: Under name, In links or Both.
--
-- profile_modes.appearance accepts one more optional key, socialPlacement
-- (name|links|both). Absent keeps today's meaning (socialStyle 'hidden' = In links,
-- otherwise Under name). It is a Free control: private.appearance_value_is_premium
-- already returns false for unknown fields, so the plan trigger needs no change.
-- Only the check constraint is recreated; existing rows already satisfy it.

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
        'namePosition', 'readability', 'socialStyle', 'socialPlacement', 'motion', 'soundtrackPresentation'
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
        not (appearance ? 'socialPlacement')
        or (jsonb_typeof(appearance -> 'socialPlacement') = 'string' and appearance ->> 'socialPlacement' in ('name', 'links', 'both'))
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
