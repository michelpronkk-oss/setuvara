-- Mode photos keep their original upload; the crop becomes metadata.
--
-- Until now the crop dialog uploaded only a 4:5 crop, so zooming out or a wide frame could never
-- show more than that crop. From now on the app also uploads the original (capped to 2560px on
-- the long edge, re-encoded as WebP, so under the bucket's 5 MB limit) and stores the crop on it:
--
-- 1. profile_modes.image_original_path: the kept original, owner-scoped like image_path, in the
--    same private profile-media bucket. image_path stays the derived 4:5 crop (avatars, share
--    cards and older surfaces keep using it).
-- 2. profile_modes.image_crop: {x, y, w, h, width, height}: the crop in fractions (0-1) of the
--    original, and the original's pixel size. image_focus_x/y stay the face point in percent of
--    the crop (image_path), so their meaning does not change.
-- 3. Both are set together or not at all. Rows saved before this (no original) keep working
--    unchanged: the app renders them from image_path, which is all that exists for them.
-- 4. Storage: a published, enabled Mode's original is readable exactly like its photo.

alter table public.profile_modes
  add column if not exists image_original_path text,
  add column if not exists image_crop jsonb;

alter table public.profile_modes
  drop constraint if exists profile_modes_image_original_check;

alter table public.profile_modes
  add constraint profile_modes_image_original_check
    check (
      (image_original_path is null) = (image_crop is null)
      and (image_original_path is null or image_path is not null)
      and (
        image_original_path is null
        or (split_part(image_original_path, '/', 1) = profile_id::text
            and image_original_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
      )
      and (
        image_crop is null
        or (
          jsonb_typeof(image_crop) = 'object'
          and image_crop ?& array['x', 'y', 'w', 'h', 'width', 'height']
          and image_crop - array['x', 'y', 'w', 'h', 'width', 'height'] = '{}'::jsonb
          and jsonb_typeof(image_crop -> 'x') = 'number'
          and jsonb_typeof(image_crop -> 'y') = 'number'
          and jsonb_typeof(image_crop -> 'w') = 'number'
          and jsonb_typeof(image_crop -> 'h') = 'number'
          and jsonb_typeof(image_crop -> 'width') = 'number'
          and jsonb_typeof(image_crop -> 'height') = 'number'
          and (image_crop ->> 'x')::numeric between 0 and 1
          and (image_crop ->> 'y')::numeric between 0 and 1
          and (image_crop ->> 'w')::numeric > 0
          and (image_crop ->> 'h')::numeric > 0
          and (image_crop ->> 'x')::numeric + (image_crop ->> 'w')::numeric <= 1.0001
          and (image_crop ->> 'y')::numeric + (image_crop ->> 'h')::numeric <= 1.0001
          and (image_crop ->> 'width')::numeric between 1 and 10000
          and (image_crop ->> 'height')::numeric between 1 and 10000
        )
      )
    );

create index if not exists profile_modes_image_original_path_idx
  on public.profile_modes (image_original_path)
  where image_original_path is not null;

comment on column public.profile_modes.image_original_path is
  'Kept original of the Mode photo (size-capped WebP) in private profile-media, owner-scoped. Every profile surface frames from it with image_crop; null for photos saved before originals were kept.';
comment on column public.profile_modes.image_crop is
  'The member''s 4:5 crop on image_original_path: {x, y, w, h} in fractions of the original plus its pixel {width, height}. image_path is this crop, derived.';
comment on column public.profile_modes.image_focus_x is
  'Horizontal face point, percent of the saved crop (image_path) width (0-100). Null uses the default.';
comment on column public.profile_modes.image_focus_y is
  'Vertical face point, percent of the saved crop (image_path) height (0-100). Null uses the default.';

drop policy if exists "Public can read published Mode photo originals" on storage.objects;
create policy "Public can read published Mode photo originals"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'profile-media'
  and exists (
    select 1
    from public.profile_modes as modes
    join public.profiles as profiles on profiles.id = modes.profile_id
    where modes.image_original_path = storage.objects.name
      and modes.is_enabled
      and profiles.is_published
  )
);
