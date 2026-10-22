-- Marketing and SEO pages get their own top-level paths; reserve them before anyone can claim them
-- as a username or handle. None are in use (checked before this migration).
insert into private.reserved_handles (handle) values
  ('blog'), ('compare'), ('explore'), ('features'), ('for'), ('gallery'), ('templates'), ('tools')
on conflict do nothing;
