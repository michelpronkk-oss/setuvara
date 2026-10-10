-- Profile soundtrack: one visible music block per Mode can be that Mode's
-- soundtrack. The database guarantees there is never more than one, and
-- that a soundtrack is always a visible music block.
alter table public.profile_blocks
  add column is_soundtrack boolean not null default false;

alter table public.profile_blocks
  add constraint profile_blocks_soundtrack_is_visible_music
  check (not is_soundtrack or (kind = 'music' and is_visible));

create unique index profile_blocks_one_soundtrack_per_mode
  on public.profile_blocks (mode_id)
  where is_soundtrack;

comment on column public.profile_blocks.is_soundtrack is
  'This music block is its Mode''s profile soundtrack. At most one per Mode; making another block the soundtrack clears the previous one.';

-- Runs before the row is written, so the previous soundtrack is cleared
-- first and the unique index never sees two. Hiding a block or changing its
-- kind drops soundtrack status instead of failing.
create function private.profile_blocks_single_soundtrack()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind <> 'music' or not new.is_visible then
    new.is_soundtrack := false;
  end if;

  if new.is_soundtrack and (tg_op = 'INSERT' or not old.is_soundtrack or old.mode_id <> new.mode_id) then
    update public.profile_blocks
    set is_soundtrack = false
    where mode_id = new.mode_id
      and is_soundtrack
      and id <> new.id;
  end if;

  return new;
end;
$$;

revoke all on function private.profile_blocks_single_soundtrack() from public, anon, authenticated;

create trigger profile_blocks_single_soundtrack
before insert or update on public.profile_blocks
for each row execute function private.profile_blocks_single_soundtrack();
