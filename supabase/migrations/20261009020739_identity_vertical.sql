create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username = lower(username) and username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 80),
  bio text not null default ''
    check (char_length(bio) <= 280),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_modes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null check (slug in ('social', 'business')),
  label text not null check (char_length(btrim(label)) between 1 and 40),
  sort_order smallint not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, slug),
  unique (profile_id, id)
);

create table public.profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  mode_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  url text not null check (url ~* '^https?://'),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, mode_id)
    references public.profile_modes (profile_id, id)
    on delete cascade
);

create index profile_modes_profile_order_idx
  on public.profile_modes (profile_id, sort_order);
create index profile_links_profile_mode_order_idx
  on public.profile_links (profile_id, mode_id, sort_order);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger profile_modes_set_updated_at
before update on public.profile_modes
for each row execute function private.set_updated_at();

create trigger profile_links_set_updated_at
before update on public.profile_links
for each row execute function private.set_updated_at();

revoke all on function private.set_updated_at() from public, anon, authenticated;

create function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_username text;
  requested_display_name text;
begin
  requested_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_display_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));

  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception using errcode = '23514', message = 'Invalid username';
  end if;

  if char_length(requested_display_name) not between 1 and 80 then
    requested_display_name := requested_username;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, requested_username, requested_display_name);

  insert into public.profile_modes (profile_id, slug, label, sort_order)
  values
    (new.id, 'social', 'Social', 1),
    (new.id, 'business', 'Business', 2);

  return new;
end;
$function$;

revoke all on function private.create_profile_for_new_user() from public, anon, authenticated;
create trigger on_auth_user_created_setuvara_profile
after insert on auth.users
for each row execute function private.create_profile_for_new_user();

create function public.is_username_available(candidate_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    lower(btrim(coalesce(candidate_username, ''))) ~ '^[a-z0-9_]{3,24}$'
    and not exists (
      select 1
      from public.profiles
      where username = lower(btrim(coalesce(candidate_username, '')))
    );
$function$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.profile_modes enable row level security;
alter table public.profile_links enable row level security;

revoke all on table public.profiles, public.profile_modes, public.profile_links
  from public, anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant update (username, display_name, bio, is_published)
  on public.profiles to authenticated;

create policy "published profiles and owners can read profiles"
on public.profiles for select
to anon, authenticated
using (is_published or (select auth.uid()) = id);

create policy "owners can update their profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

grant select on public.profile_modes to anon, authenticated;

create policy "owners and published profiles can read modes"
on public.profile_modes for select
to anon, authenticated
using (
  profile_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles
    where profiles.id = profile_modes.profile_id
      and profiles.is_published
      and profile_modes.is_enabled
  )
);

grant insert, update, delete on public.profile_modes to authenticated;

create policy "owners can add modes"
on public.profile_modes for insert
to authenticated
with check ((select auth.uid()) = profile_id);

create policy "owners can update modes"
on public.profile_modes for update
to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);

create policy "owners can delete modes"
on public.profile_modes for delete
to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.profile_links to anon, authenticated;
grant insert, update, delete on public.profile_links to authenticated;

create policy "owners and published profiles can read visible links"
on public.profile_links for select
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
      where profiles.id = profile_links.profile_id
        and profile_modes.id = profile_links.mode_id
        and profiles.is_published
        and profile_modes.is_enabled
    )
  )
);

create policy "owners can add links"
on public.profile_links for insert
to authenticated
with check ((select auth.uid()) = profile_id);

create policy "owners can update links"
on public.profile_links for update
to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);

create policy "owners can delete links"
on public.profile_links for delete
to authenticated
using ((select auth.uid()) = profile_id);
