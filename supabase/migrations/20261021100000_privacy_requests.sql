-- Privacy requests: platform deauthorizations, platform data deletions (Meta callbacks) and member
-- account deletion requests, each with a status a person can check by confirmation code.
-- Additive only. Platform user ids are never stored: callbacks keep an HMAC of the id.

-- Instagram Login returns two ids: user_id (the professional account) and id (app-scoped). Meta's
-- callbacks carry one of them, so the second one is kept to match either.
alter table public.social_accounts
  add column if not exists provider_scoped_id text
  check (provider_scoped_id is null or char_length(provider_scoped_id) between 1 and 200);
create index if not exists social_accounts_provider_scoped_idx
  on public.social_accounts (provider, provider_scoped_id) where provider_scoped_id is not null;

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('platform_deauthorize','platform_data_deletion','account_deletion')),
  source text not null check (source in ('meta_callback','member')),
  provider text check (provider is null or provider in ('youtube','twitch','tiktok','instagram')),
  -- The member, when known. Kept as null once the account itself is deleted.
  profile_id uuid references public.profiles(id) on delete set null,
  -- HMAC of the platform user id (callbacks only), so retries of one signal find one request.
  subject_hash text check (subject_hash is null or subject_hash ~ '^[0-9a-f]{64}$'),
  -- issued_at from the signed request: one row per signal, whatever Meta retries.
  signal_issued_at timestamptz,
  confirmation_code text not null unique check (confirmation_code ~ '^[A-Z0-9]{20}$'),
  status text not null default 'received' check (status in ('received','processing','completed','no_data','failed','cancelled')),
  accounts_removed integer not null default 0 check (accounts_removed >= 0),
  error_code text check (error_code is null or char_length(error_code) <= 80),
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  completed_at timestamptz,
  check (source <> 'meta_callback' or (provider is not null and subject_hash is not null and signal_issued_at is not null)),
  check (kind <> 'account_deletion' or source = 'member')
);
create unique index privacy_requests_signal_key
  on public.privacy_requests (kind, subject_hash, signal_issued_at) where source = 'meta_callback';
-- One open account deletion request per member.
create unique index privacy_requests_open_account_deletion
  on public.privacy_requests (profile_id) where kind = 'account_deletion' and status in ('received','processing');
create index privacy_requests_profile_idx on public.privacy_requests (profile_id, created_at desc) where profile_id is not null;

create trigger privacy_requests_set_updated_at before update on public.privacy_requests
  for each row execute function private.set_updated_at();

alter table public.privacy_requests enable row level security;
revoke all on public.privacy_requests from public, anon, authenticated;
grant select on public.privacy_requests to authenticated;
grant all on public.privacy_requests to service_role;
-- Members see their own requests (status only; the hash column is not granted below).
create policy privacy_requests_owner_read on public.privacy_requests for select to authenticated
  using (profile_id = (select auth.uid()));
revoke select on public.privacy_requests from authenticated;
grant select (id, kind, source, provider, confirmation_code, status, accounts_removed, created_at, updated_at, completed_at)
  on public.privacy_requests to authenticated;

comment on table public.privacy_requests is 'Deauthorize, platform data deletion and account deletion requests with a public status by confirmation code. Written by server routes (service role) only.';
comment on column public.privacy_requests.subject_hash is 'HMAC-SHA256 of the platform user id under SOCIAL_TOKEN_KEY. The raw id is never stored.';
comment on column public.social_accounts.provider_scoped_id is 'Second platform id (Instagram app-scoped id) used only to match Meta deauthorize and deletion callbacks.';
