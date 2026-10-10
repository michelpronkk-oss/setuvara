-- Wallet records track one pass per identity and the minimal Apple update
-- registrations needed by PassKit. The share URL itself is never stored here;
-- Wallet passes point at the existing Quick Share locator.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table public.wallet_passes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  apple_serial_number uuid not null unique default pg_catalog.gen_random_uuid(),
  google_wallet_object_id text unique,
  appearance_preset text not null default 'classic'
    check (appearance_preset in ('classic', 'editorial')),
  content_updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  last_synced_content_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint wallet_pass_profile_serial_unique unique (profile_id, apple_serial_number),
  constraint wallet_google_object_id_format check (
    google_wallet_object_id is null
    or google_wallet_object_id ~ '^[A-Za-z0-9._-]{1,255}$'
  )
);

comment on table public.wallet_passes is
  'Private provider identifiers for the one identity-scoped Setuvara Wallet pass. The pass QR is derived from the existing Quick Share locator and is not stored.';

create trigger wallet_passes_set_updated_at
  before update on public.wallet_passes
  for each row execute function private.set_updated_at();

create table public.apple_wallet_registrations (
  device_library_hash bytea not null check (pg_catalog.octet_length(device_library_hash) = 32),
  profile_id uuid not null,
  pass_serial_number uuid not null,
  push_token text not null check (pg_catalog.length(push_token) between 1 and 512),
  registered_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  primary key (device_library_hash, pass_serial_number),
  foreign key (profile_id, pass_serial_number)
    references public.wallet_passes(profile_id, apple_serial_number) on delete cascade
);

create index apple_wallet_registrations_profile_idx
  on public.apple_wallet_registrations (profile_id);

comment on table public.apple_wallet_registrations is
  'Private PassKit update registrations. Device identifiers are stored as SHA-256 digests; APNs push tokens are server-only and must never be logged.';

alter table public.wallet_passes enable row level security;
alter table public.apple_wallet_registrations enable row level security;

revoke all on table public.wallet_passes, public.apple_wallet_registrations
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.wallet_passes,
  public.apple_wallet_registrations to service_role;

create policy wallet_passes_service_role_all
  on public.wallet_passes for all to service_role
  using (true) with check (true);

create policy apple_wallet_registrations_service_role_all
  on public.apple_wallet_registrations for all to service_role
  using (true) with check (true);

create or replace function private.touch_wallet_pass_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile_id uuid;
begin
  if tg_table_schema = 'public' and tg_table_name = 'profiles' then
    v_profile_id := coalesce(new.id, old.id);
  elsif tg_table_schema = 'public' and tg_table_name = 'profile_modes' then
    v_profile_id := coalesce(new.profile_id, old.profile_id);
  elsif tg_table_schema = 'public' and tg_table_name = 'equipped_share_states' then
    v_profile_id := coalesce(new.profile_id, old.profile_id);
  elsif tg_table_schema = 'public' and tg_table_name = 'quick_share_locators' then
    v_profile_id := coalesce(new.profile_id, old.profile_id);
  else
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  update public.wallet_passes
  set content_updated_at = pg_catalog.statement_timestamp(),
      updated_at = pg_catalog.statement_timestamp()
  where profile_id = v_profile_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function private.touch_wallet_pass_content() from public, anon, authenticated, service_role;

create trigger wallet_pass_content_profiles
  after update of username, display_name, is_published on public.profiles
  for each row execute function private.touch_wallet_pass_content();

create trigger wallet_pass_content_modes
  after insert or update or delete on public.profile_modes
  for each row execute function private.touch_wallet_pass_content();

create trigger wallet_pass_content_equipped
  after insert or update or delete on public.equipped_share_states
  for each row execute function private.touch_wallet_pass_content();

create trigger wallet_pass_content_quick_share
  after insert or update or delete on public.quick_share_locators
  for each row execute function private.touch_wallet_pass_content();
