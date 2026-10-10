-- Keep profile Mode appearance in the existing JSON column while allowing the
-- optional, curated QR frame choice. This adds no table and does not alter RLS.
alter table public.profile_modes
  drop constraint profile_modes_appearance_check;

alter table public.profile_modes
  add constraint profile_modes_appearance_check
    check (
      jsonb_typeof(appearance) = 'object'
      and appearance ?& array['theme', 'accent', 'layout', 'imageTreatment']
      and appearance - array['theme', 'accent', 'layout', 'imageTreatment', 'qrStyle'] = '{}'::jsonb
      and jsonb_typeof(appearance -> 'theme') = 'string'
      and jsonb_typeof(appearance -> 'accent') = 'string'
      and jsonb_typeof(appearance -> 'layout') = 'string'
      and jsonb_typeof(appearance -> 'imageTreatment') = 'string'
      and appearance ->> 'theme' in ('light', 'dark', 'editorial')
      and appearance ->> 'accent' ~ '^#[0-9A-Fa-f]{6}$'
      and (
        (slug = 'personal' and appearance ->> 'layout' in ('full-bleed', 'portrait-editorial'))
        or (slug = 'event' and appearance ->> 'layout' in ('event-poster', 'conference-card'))
        or (slug = 'business' and appearance ->> 'layout' in ('structured', 'editorial-business'))
      )
      and appearance ->> 'imageTreatment' in ('full-bleed', 'portrait', 'compact')
      and (
        not (appearance ? 'qrStyle')
        or (
          jsonb_typeof(appearance -> 'qrStyle') = 'string'
          and appearance ->> 'qrStyle' in ('standard', 'accent-frame')
        )
      )
    );

comment on constraint profile_modes_appearance_check on public.profile_modes is
  'Validates the curated per-Mode appearance and optional QR frame; plan access is resolved server-side.';
