-- Support the presentation-to-stamp foreign key lookup during stamp deletion.
create index if not exists passport_presentation_featured_stamp_idx
  on public.passport_presentation_preferences(featured_stamp_id)
  where featured_stamp_id is not null;
