-- Mode content blocks: rich, Mode-specific sections shown on the public
-- profile alongside links (videos, music, featured links, services,
-- highlights, testimonials). Each block belongs to exactly one Mode and
-- follows the same ownership, ordering and visibility rules as profile_links.
create table public.profile_blocks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  mode_id uuid not null,
  kind text not null check (kind in ('video', 'music', 'feature', 'services', 'highlights', 'testimonial')),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 8192),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, mode_id)
    references public.profile_modes (profile_id, id)
    on delete cascade
);

comment on table public.profile_blocks is
  'Mode content blocks. data is validated per kind by the application block registry; the database bounds kind and size.';

create index profile_blocks_profile_mode_order_idx
  on public.profile_blocks (profile_id, mode_id, sort_order);
create index profile_blocks_mode_id_idx
  on public.profile_blocks (mode_id);

create trigger profile_blocks_set_updated_at
before update on public.profile_blocks
for each row execute function private.set_updated_at();

alter table public.profile_blocks enable row level security;

revoke all on table public.profile_blocks from public, anon, authenticated;
grant select on public.profile_blocks to anon, authenticated;
grant insert, update, delete on public.profile_blocks to authenticated;

create policy "owners and published profiles can read visible blocks"
on public.profile_blocks for select
to anon, authenticated
using (
  profile_id = (select auth.uid())
  or (
    is_visible
    and exists (
      select 1
      from public.profiles
      join public.profile_modes
        on profile_modes.profile_id = profiles.id
      where profiles.id = profile_blocks.profile_id
        and profile_modes.id = profile_blocks.mode_id
        and profiles.is_published
        and profile_modes.is_enabled
    )
  )
);

create policy "owners can add blocks"
on public.profile_blocks for insert
to authenticated
with check ((select auth.uid()) = profile_id);

create policy "owners can update blocks"
on public.profile_blocks for update
to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);

create policy "owners can delete blocks"
on public.profile_blocks for delete
to authenticated
using ((select auth.uid()) = profile_id);
