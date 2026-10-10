-- Cover the composite wallet-pass foreign key and profile-scoped lookups.
drop index if exists public.apple_wallet_registrations_profile_idx;

create index apple_wallet_registrations_profile_serial_idx
  on public.apple_wallet_registrations (profile_id, pass_serial_number);
