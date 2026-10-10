-- Add owner-scoped Image content and allow public reads only for visible image
-- assets attached to a published profile's enabled Mode.

alter table public.profile_blocks
  drop constraint if exists profile_blocks_kind_check,
  add constraint profile_blocks_kind_check
    check (kind in ('video', 'music', 'feature', 'services', 'highlights', 'testimonial', 'image'));

alter table public.profile_blocks
  add constraint profile_blocks_image_path_owner_check
    check (
      (kind <> 'image' or (
        data ? 'image_path'
        and jsonb_typeof(data -> 'image_path') = 'string'
        and data ->> 'image_path' ~ ('^' || profile_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
      ))
      and (
        data -> 'image_path' is null
        or jsonb_typeof(data -> 'image_path') = 'null'
        or (
          jsonb_typeof(data -> 'image_path') = 'string'
          and data ->> 'image_path' ~ ('^' || profile_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
        )
      )
    );

create index profile_blocks_image_path_idx
  on public.profile_blocks ((data ->> 'image_path'))
  where data ? 'image_path';

create policy "Public can read visible published block images"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'profile-media'
  and exists (
    select 1
    from public.profile_blocks as blocks
    join public.profile_modes as modes
      on modes.id = blocks.mode_id
     and modes.profile_id = blocks.profile_id
    join public.profiles as profiles
      on profiles.id = blocks.profile_id
    where blocks.data ->> 'image_path' = storage.objects.name
      and split_part(storage.objects.name, '/', 1) = blocks.profile_id::text
      and blocks.is_visible
      and modes.is_enabled
      and profiles.is_published
  )
);

comment on constraint profile_blocks_image_path_owner_check on public.profile_blocks is
  'Image blocks require an image in the owning profile folder; custom Featured Link images may be omitted but must use the same owner-scoped path.';
