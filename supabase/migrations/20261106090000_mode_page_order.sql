-- One page order per Mode, across blocks, links, Actions, Builder projects and the Mode's own
-- sections. Entries are "kind:uuid" or "section:name"; the app drops anything gone or not allowed
-- on the Mode, so a stale entry never shows anything. No row means today's default order.
create table public.mode_page_order (
  mode_id uuid primary key references public.profile_modes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  items text[] not null default '{}' check (
    cardinality(items) <= 300
    and pg_catalog.array_to_string(items, ',') ~ '^(((block|link|action|project):[0-9a-f-]{36}|section:(testimonials|creator|audience))(,|$))*$'
  ),
  updated_at timestamptz not null default pg_catalog.statement_timestamp()
);

alter table public.mode_page_order enable row level security;
revoke all on public.mode_page_order from public, anon, authenticated;
grant select on public.mode_page_order to anon, authenticated;
grant insert, update, delete on public.mode_page_order to authenticated;
grant all on public.mode_page_order to service_role;

-- The owner manages their own Modes' order.
create policy mode_page_order_owner on public.mode_page_order for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and exists (
    select 1 from public.profile_modes m where m.id = mode_id and m.profile_id = (select auth.uid())));
-- Visitors read it for live pages only, where every listed item is already public.
create policy mode_page_order_public_read on public.mode_page_order for select to anon, authenticated
  using (exists (
    select 1 from public.profile_modes m join public.profiles p on p.id = m.profile_id
    where m.id = mode_id and m.is_enabled and p.is_published));

create trigger mode_page_order_set_updated_at before update on public.mode_page_order
  for each row execute function private.set_updated_at();

comment on table public.mode_page_order is 'Owner-set order of everything on a Mode page (blocks, links, Actions, projects, Mode sections).';
