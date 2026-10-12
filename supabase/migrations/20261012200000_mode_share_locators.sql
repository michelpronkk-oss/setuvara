-- Opaque, stable share locators for non-default Modes.
-- The canonical username URL only ever shows the default (Personal) Mode.
-- Event and Business are opened through /s/<token>, which resolves here to
-- one profile and one Mode. Like Quick Share, the application derives the
-- public token from a server-only HMAC key and the random nonce stored here;
-- only the nonce and the SHA-256 token hash are persisted.
create table public.mode_share_locators (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  mode_id uuid not null unique,
  nonce bytea not null check (pg_catalog.octet_length(nonce) = 32),
  token_hash bytea not null unique check (pg_catalog.octet_length(token_hash) = 32),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint mode_share_locators_mode_owner_fk
    foreign key (profile_id, mode_id)
    references public.profile_modes(profile_id, id) on delete cascade
);

comment on table public.mode_share_locators is
  'One opaque share locator per Mode. Stores a random derivation nonce and public token hash, never the raw URL token.';

create index mode_share_locators_profile_idx on public.mode_share_locators (profile_id);

-- Only the server (service role) mints locators; browsers never read them.
alter table public.mode_share_locators enable row level security;
revoke all on table public.mode_share_locators from public, anon, authenticated, service_role;
grant select, insert on table public.mode_share_locators to service_role;

-- Public resolution: a token is a pointer to one published identity and one
-- enabled Mode. It never authenticates and never grants Connection Access.
create function public.resolve_mode_share(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'username', profiles.username,
    'mode', profile_modes.slug
  )
  from public.mode_share_locators as locators
  join public.profiles on profiles.id = locators.profile_id
  join public.profile_modes
    on profile_modes.id = locators.mode_id
   and profile_modes.profile_id = locators.profile_id
  where p_token ~ '^[A-Za-z0-9_-]{43}$'
    and locators.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    and profiles.is_published
    and profile_modes.is_enabled
    and profile_modes.slug in ('personal', 'event', 'business')
  limit 1;
$function$;

revoke all on function public.resolve_mode_share(text) from public;
grant execute on function public.resolve_mode_share(text) to anon, authenticated, service_role;
