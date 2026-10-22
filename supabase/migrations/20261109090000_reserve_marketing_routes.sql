-- Marketing pages that live at the root: the four Mode pages, the feature, comparison, template,
-- tool and gallery sections, and the blog. Reserved before the pages ship so no member can
-- register a name a page would hide. Keep in sync with src/lib/usernames.ts (a test checks it).
insert into private.reserved_handles (handle) values
  ('blog'), ('business'), ('compare'), ('creator'), ('event'), ('features'), ('gallery'),
  ('personal'), ('templates'), ('tools')
on conflict do nothing;
