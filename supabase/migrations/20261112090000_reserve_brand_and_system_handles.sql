-- Brand, staff, trust-and-safety, email-like, system and product words: reserved so no member can
-- pose as Setuvara or claim a name people would read as a page. None were in use (checked first).
-- Keep in sync with src/lib/usernames.ts (a test checks it).
insert into private.reserved_handles (handle) values
  ('setuvara'), ('setuvara_app'), ('official'), ('staff'), ('team'), ('moderator'), ('mod'), ('verified'), ('verify'), ('abuse'), ('report'), ('safety'), ('trust'), ('legal'), ('policy'), ('press'), ('media'), ('jobs'), ('partners'), ('hello'), ('info'), ('noreply'), ('no_reply'), ('mail'), ('www'), ('root'), ('system'), ('null'), ('undefined'), ('home'), ('dashboard'), ('billing'), ('upgrade'), ('checkout'), ('pay'), ('invoice'), ('studio'), ('live'), ('search'), ('discover'), ('passport'), ('card'), ('tap'), ('nfc'), ('guest'), ('profile'), ('user'), ('users'), ('demo'), ('test'), ('example')
on conflict do nothing;
