-- A deleted account can leave a useful encounter snapshot on the other
-- participant's Connection. The creator FK uses ON DELETE SET NULL, so allow
-- both creator references to be null after deletion while still forbidding a
-- row from naming both a user and a guest as its creator.
alter table public.connection_encounters
  drop constraint if exists connection_encounters_check,
  drop constraint if exists connection_encounters_creator_check;

alter table public.connection_encounters
  add constraint connection_encounters_creator_check
  check (created_by_user_id is null or created_by_guest_id is null);

comment on constraint connection_encounters_creator_check on public.connection_encounters is
  'A row has at most one creator. Both may be null after the creator account is deleted so the encounter snapshot remains available to the other participant.';
