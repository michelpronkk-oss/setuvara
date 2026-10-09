-- Mode settings are publicly readable for enabled published Modes. Keep
-- contact details in profile_links, where is_visible is protected by RLS.
alter table public.profile_modes
  drop constraint profile_modes_settings_fields_check,
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
          settings - array['role', 'company', 'city', 'description'] = '{}'::jsonb
          and (not settings ? 'role' or (jsonb_typeof(settings -> 'role') = 'string' and char_length(settings ->> 'role') <= 80))
          and (not settings ? 'company' or (jsonb_typeof(settings -> 'company') = 'string' and char_length(settings ->> 'company') <= 100))
          and (not settings ? 'city' or (jsonb_typeof(settings -> 'city') = 'string' and char_length(settings ->> 'city') <= 80))
          and (not settings ? 'description' or (jsonb_typeof(settings -> 'description') = 'string' and char_length(settings ->> 'description') <= 280))
        else false
      end
    );

comment on column public.profile_modes.settings is
  'Public Mode presentation context only: Personal(note/location/pronouns), Event(eventName/city/dateLabel/role/hereToMeet), Business(role/company/city/description). Put contact and booking details in profile_links so is_visible and RLS govern their public access.';
