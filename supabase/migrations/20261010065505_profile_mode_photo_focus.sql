-- Where the subject (usually a face) sits inside a Mode photo, so every surface frames it the
-- same way: wide Event/Business bands, Full Bleed heroes, avatars and cards all centre on it.
-- Percent of the saved (already cropped 4:5) photo's width and height. Null means the app's
-- default focus, which is what photos saved before this column use.

alter table public.profile_modes
  add column if not exists image_focus_x smallint,
  add column if not exists image_focus_y smallint;

alter table public.profile_modes
  add constraint profile_modes_image_focus_check
  check (
    (image_focus_x is null or image_focus_x between 0 and 100)
    and (image_focus_y is null or image_focus_y between 0 and 100)
  );

comment on column public.profile_modes.image_focus_x is
  'Horizontal focus point of the Mode photo, percent of the saved photo width (0-100). Null uses the default.';
comment on column public.profile_modes.image_focus_y is
  'Vertical focus point of the Mode photo, percent of the saved photo height (0-100). Null uses the default.';
