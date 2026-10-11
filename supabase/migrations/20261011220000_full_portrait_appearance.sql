-- Extend the existing curated appearance JSON for Full Portrait. Preserve the
-- Setuvara hosted constraint's wider, already-allowed curated appearance keys
-- and values, even though the current editor only writes a subset of them.
-- Existing rows and RLS policies are untouched. Photo focus remains in
-- image_focus_x/y.
alter table public.profile_modes
  drop constraint if exists profile_modes_appearance_check;

alter table public.profile_modes
  add constraint profile_modes_appearance_check
    check (
      jsonb_typeof(appearance) = 'object'
      and appearance ?& array['theme', 'accent', 'layout', 'imageTreatment']
      and appearance - array['theme', 'accent', 'layout', 'imageTreatment', 'qrStyle', 'intensity', 'card', 'radius', 'button', 'links', 'soundStyle', 'portraitZoom', 'portraitNameSize', 'portraitShowUsername'] = '{}'::jsonb
      and jsonb_typeof(appearance -> 'theme') = 'string'
      and jsonb_typeof(appearance -> 'accent') = 'string'
      and jsonb_typeof(appearance -> 'layout') = 'string'
      and jsonb_typeof(appearance -> 'imageTreatment') = 'string'
      and appearance ->> 'theme' in ('light', 'dark', 'editorial', 'noir', 'signal', 'studio')
      and appearance ->> 'accent' ~ '^#[0-9A-Fa-f]{6}$'
      and (
        appearance ->> 'layout' in ('portrait', 'poster', 'index')
        or (slug = 'personal' and appearance ->> 'layout' in ('full-bleed', 'portrait-editorial', 'full-portrait'))
        or (slug = 'event' and appearance ->> 'layout' in ('event-poster', 'conference-card', 'full-portrait'))
        or (slug = 'business' and appearance ->> 'layout' in ('structured', 'editorial-business', 'full-portrait'))
      )
      and appearance ->> 'imageTreatment' in ('full-bleed', 'portrait', 'compact', 'frame')
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
          then (appearance ->> 'portraitZoom')::numeric in (100, 110, 120, 130, 140)
          else false end
      )
      and (
        not (appearance ? 'portraitNameSize')
        or (jsonb_typeof(appearance -> 'portraitNameSize') = 'string' and appearance ->> 'portraitNameSize' in ('compact', 'standard', 'large', 'statement'))
      )
      and (not (appearance ? 'portraitShowUsername') or jsonb_typeof(appearance -> 'portraitShowUsername') = 'boolean')
    );

comment on constraint profile_modes_appearance_check on public.profile_modes is
  'Curated per-Mode appearance including Full Portrait controls; existing hosted choices preserved; paid presentation is resolved from billing server-side.';
