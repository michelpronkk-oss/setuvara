-- Five more content blocks: Text, Section, FAQ, Location and Countdown. Their shapes are validated
-- in the app (lib/blocks/registry.ts); the table keeps bounding kind and size.
alter table public.profile_blocks
  drop constraint profile_blocks_kind_check,
  add constraint profile_blocks_kind_check check (kind = any (array[
    'video', 'music', 'feature', 'services', 'highlights', 'testimonial', 'image',
    'text', 'section', 'faq', 'location', 'countdown'
  ]));
