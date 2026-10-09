-- Setuvara profile editor vertical: preserve existing mode rows and links while
-- moving Social to Personal, adding Event, and introducing scoped presentation.

alter table public.profile_modes
  drop constraint if exists profile_modes_slug_check;

update public.profile_modes
set slug = 'personal', label = 'Personal', sort_order = 1
where slug = 'social';

alter table public.profile_modes
  add constraint profile_modes_slug_check
  check (slug in ('personal', 'event', 'business'));

update public.profile_modes
set label = case slug when 'business' then 'Business' else label end,
    sort_order = case slug when 'business' then 3 else sort_order end
where slug = 'business';

insert into public.profile_modes (profile_id, slug, label, sort_order)
select profiles.id, built_in.slug, built_in.label, built_in.sort_order
from public.profiles
cross join (values
  ('personal'::text, 'Personal'::text, 1::smallint),
  ('event'::text, 'Event'::text, 2::smallint),
  ('business'::text, 'Business'::text, 3::smallint)
) as built_in(slug, label, sort_order)
where not exists (
  select 1 from public.profile_modes as existing
  where existing.profile_id = profiles.id and existing.slug = built_in.slug
)
on conflict (profile_id, slug) do nothing;

alter table public.profile_modes
  add column settings jsonb not null default '{}'::jsonb,
  add column appearance jsonb not null default '{"theme":"light","accent":"#FF5A4F","layout":"portrait","imageTreatment":"portrait"}'::jsonb,
  add column image_path text;

update public.profile_modes
set appearance = jsonb_set(
  appearance,
  '{layout}',
  to_jsonb(case slug when 'personal' then 'portrait-editorial' when 'event' then 'conference-card' else 'structured' end)
);

alter table public.profile_modes
  add constraint profile_modes_settings_object_check
    check (jsonb_typeof(settings) = 'object'),
  add constraint profile_modes_appearance_check
    check (
      jsonb_typeof(appearance) = 'object'
      and appearance ?& array['theme', 'accent', 'layout', 'imageTreatment']
      and appearance - array['theme', 'accent', 'layout', 'imageTreatment'] = '{}'::jsonb
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
    ),
  add constraint profile_modes_settings_fields_check
    check (
      case slug
        when 'personal' then
          settings - array['note', 'location', 'pronouns'] = '{}'::jsonb
          and (not settings ? 'note' or (jsonb_typeof(settings -> 'note') = 'string' and char_length(settings ->> 'note') <= 280))
          and (not settings ? 'location' or (jsonb_typeof(settings -> 'location') = 'string' and char_length(settings ->> 'location') <= 80))
          and (not settings ? 'pronouns' or (jsonb_typeof(settings -> 'pronouns') = 'string' and char_length(settings ->> 'pronouns') <= 40))
        when 'event' then
          settings - array['eventName', 'city', 'dateLabel', 'role', 'hereToMeet'] = '{}'::jsonb
          and (not settings ? 'eventName' or (jsonb_typeof(settings -> 'eventName') = 'string' and char_length(settings ->> 'eventName') <= 100))
          and (not settings ? 'city' or (jsonb_typeof(settings -> 'city') = 'string' and char_length(settings ->> 'city') <= 80))
          and (not settings ? 'dateLabel' or (jsonb_typeof(settings -> 'dateLabel') = 'string' and char_length(settings ->> 'dateLabel') <= 80))
          and (not settings ? 'role' or (jsonb_typeof(settings -> 'role') = 'string' and char_length(settings ->> 'role') <= 80))
          and (not settings ? 'hereToMeet' or (jsonb_typeof(settings -> 'hereToMeet') = 'string' and char_length(settings ->> 'hereToMeet') <= 280))
        when 'business' then
          settings - array['role', 'company', 'city', 'description', 'contactEmail', 'showContactEmail', 'bookingLabel', 'bookingUrl'] = '{}'::jsonb
          and (not settings ? 'role' or (jsonb_typeof(settings -> 'role') = 'string' and char_length(settings ->> 'role') <= 80))
          and (not settings ? 'company' or (jsonb_typeof(settings -> 'company') = 'string' and char_length(settings ->> 'company') <= 100))
          and (not settings ? 'city' or (jsonb_typeof(settings -> 'city') = 'string' and char_length(settings ->> 'city') <= 80))
          and (not settings ? 'description' or (jsonb_typeof(settings -> 'description') = 'string' and char_length(settings ->> 'description') <= 280))
          and (not settings ? 'contactEmail' or (jsonb_typeof(settings -> 'contactEmail') = 'string' and char_length(settings ->> 'contactEmail') <= 254))
          and (not settings ? 'showContactEmail' or jsonb_typeof(settings -> 'showContactEmail') = 'boolean')
          and (not settings ? 'bookingLabel' or (jsonb_typeof(settings -> 'bookingLabel') = 'string' and char_length(settings ->> 'bookingLabel') <= 60))
          and (not settings ? 'bookingUrl' or (jsonb_typeof(settings -> 'bookingUrl') = 'string' and char_length(settings ->> 'bookingUrl') <= 2048))
        else false
      end
    ),
  add constraint profile_modes_image_path_owner_check
    check (
      image_path is null
      or (split_part(image_path, '/', 1) = profile_id::text
          and image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
    );

alter table public.profile_links
  add column link_type text not null default 'url'
    check (link_type in ('url', 'instagram', 'linkedin', 'spotify', 'whatsapp', 'email', 'calendar', 'document'));

alter table public.profile_links
  drop constraint if exists profile_links_url_check,
  add constraint profile_links_url_type_check
    check (
      (link_type = 'email' and url ~* '^mailto:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
      or (link_type <> 'email' and url ~* '^https?://')
    );

create index profile_modes_image_path_idx
  on public.profile_modes (image_path)
  where image_path is not null;

-- New signups receive the same three built-in modes as existing accounts.
create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_username text;
  requested_display_name text;
begin
  requested_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_display_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));

  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception using errcode = '23514', message = 'Invalid username';
  end if;

  if char_length(requested_display_name) not between 1 and 80 then
    requested_display_name := requested_username;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, requested_username, requested_display_name);

  insert into public.profile_modes (profile_id, slug, label, sort_order, appearance)
  values
    (new.id, 'personal', 'Personal', 1, '{"theme":"light","accent":"#FF5A4F","layout":"portrait-editorial","imageTreatment":"portrait"}'::jsonb),
    (new.id, 'event', 'Event', 2, '{"theme":"light","accent":"#FF5A4F","layout":"conference-card","imageTreatment":"portrait"}'::jsonb),
    (new.id, 'business', 'Business', 3, '{"theme":"light","accent":"#FF5A4F","layout":"structured","imageTreatment":"portrait"}'::jsonb);

  return new;
end;
$function$;

revoke all on function private.create_profile_for_new_user() from public, anon, authenticated;

-- Private media prevents unpublished Mode images from being fetched by URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners and published Modes can read profile media"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'profile-media'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.profile_modes as modes
      join public.profiles as profiles on profiles.id = modes.profile_id
      where modes.image_path = storage.objects.name
        and modes.is_enabled
        and profiles.is_published
    )
  )
);

create policy "Owners can upload profile media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Owners can replace profile media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Owners can delete profile media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

comment on column public.profile_modes.settings is
  'Validated Mode-specific context: Personal(note/location/pronouns), Event(eventName/city/dateLabel/role/hereToMeet), Business(role/company/city/description/contactEmail/showContactEmail/bookingLabel/bookingUrl).';
comment on column public.profile_modes.appearance is
  'Curated Mode presentation: theme, validated hex accent, Mode-specific layout, and image treatment.';
comment on column public.profile_modes.image_path is
  'Private profile-media object path, scoped to this profile owner and visible publicly only when this Mode is enabled and the profile is published.';
