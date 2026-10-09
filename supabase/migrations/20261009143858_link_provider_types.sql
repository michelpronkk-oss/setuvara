-- Preserve existing provider identifiers and URLs while allowing the typed
-- application registry to add provider-specific links and safe contact schemes.
-- Ownership, RLS, ordering, and rows are unchanged.
alter table public.profile_links
  drop constraint if exists profile_links_link_type_check,
  add constraint profile_links_link_type_check
    check (link_type ~ '^[a-z][a-z0-9_]{0,31}$');

alter table public.profile_links
  drop constraint if exists profile_links_url_type_check,
  add constraint profile_links_url_type_check
    check (
      (link_type = 'email' and url ~* '^mailto:[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$')
      or (link_type = 'phone' and url ~ '^tel:\+[1-9][0-9]{7,14}$')
      or (link_type = 'sms' and url ~ '^sms:\+[1-9][0-9]{7,14}$')
      or (link_type = 'whatsapp' and url ~ '^https://wa\.me/[1-9][0-9]{7,14}$')
      or (link_type not in ('email', 'phone', 'sms') and url ~* '^https?://')
    );

comment on constraint profile_links_link_type_check on public.profile_links is
  'Provider identifiers are validated against the application Link Provider Registry; the database accepts only a bounded lowercase identifier format.';

comment on constraint profile_links_url_type_check on public.profile_links is
  'Link destinations are limited to HTTP(S), valid mailto addresses, or international tel/sms URIs. Provider-aware normalization is validated by the server registry.';
