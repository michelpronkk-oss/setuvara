-- /product (the profile playground) gets its own top-level path; reserve it before anyone can claim
-- it as a username or handle. Not in use (checked before this migration).
insert into private.reserved_handles (handle) values ('product')
on conflict do nothing;
