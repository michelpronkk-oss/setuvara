-- Cover the Connections foreign keys used for account deletion, guest claiming,
-- and per-user note ownership. Remove expression indexes that do not support
-- the current bounded in-app search query.
drop index if exists public.connection_encounters_event_search_idx;
drop index if exists public.connection_encounters_person_search_idx;

create index if not exists connection_encounters_shared_by_user_created_idx
  on public.connection_encounters (shared_by_user_id, created_at desc);

create index if not exists connection_notes_user_id_connection_id_idx
  on public.connection_notes (user_id, connection_id);

create index if not exists connections_guest_identity_user_idx
  on public.connections (guest_identity_id, user_id)
  where guest_identity_id is not null;

create index if not exists guest_identities_claimed_user_id_idx
  on public.guest_identities (claimed_user_id)
  where claimed_user_id is not null;
