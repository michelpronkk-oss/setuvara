-- Allow owner-scoped uploaded video blocks in the existing private media
-- bucket. Existing provider video rows continue to use their URL data shape.

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
where id = 'profile-media';

alter table public.profile_blocks
  add constraint profile_blocks_video_path_owner_check
  check (
    kind <> 'video'
    or (
      (
        data ->> 'source' is distinct from 'upload'
        or (
          data ? 'video_path'
          and
          jsonb_typeof(data -> 'video_path') = 'string'
          and data ->> 'video_mime_type' in ('video/mp4', 'video/webm')
        )
      )
      and (
        data ->> 'video_path' is null
        or (
          jsonb_typeof(data -> 'video_path') = 'string'
          and data ->> 'video_path' ~ ('^' || profile_id::text || '/[0-9a-f-]{36}\.(mp4|webm)$')
          and (
            (data ->> 'video_mime_type' = 'video/mp4' and data ->> 'video_path' ~ '\.mp4$')
            or (data ->> 'video_mime_type' = 'video/webm' and data ->> 'video_path' ~ '\.webm$')
          )
        )
      )
    )
  );

create index profile_blocks_video_path_idx
  on public.profile_blocks ((data ->> 'video_path'))
  where data ? 'video_path';

drop policy if exists "Public can read visible published block images" on storage.objects;
drop policy if exists "Public can read visible published block media" on storage.objects;

create policy "Public can read visible published block media"
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
    where (
        blocks.data ->> 'image_path' = storage.objects.name
        or blocks.data ->> 'video_path' = storage.objects.name
      )
      and split_part(storage.objects.name, '/', 1) = blocks.profile_id::text
      and blocks.is_visible
      and modes.is_enabled
      and profiles.is_published
  )
);

comment on constraint profile_blocks_video_path_owner_check on public.profile_blocks is
  'Uploaded video blocks use an owner-scoped MP4 or WebM object path and matching MIME type; legacy provider video rows remain URL-based.';
