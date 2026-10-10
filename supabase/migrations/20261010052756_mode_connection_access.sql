-- Mode-level Connection Access. Profile visibility (who can view a Mode) stays
-- separate from connect_policy (who can start a new inbound Connection from it).
-- Direct-share Connection Passes are short-lived grants; only SHA-256 hashes of
-- the random tokens are stored, and every check runs server-side.

alter table public.profile_modes
  add column connect_policy text not null default 'anyone'
    constraint profile_modes_connect_policy_check
    check (connect_policy in ('anyone', 'direct_only', 'nobody'));

comment on column public.profile_modes.connect_policy is
  'Who can start a new inbound Connection from this Mode: anyone, direct_only (valid Connection Pass required), or nobody. Never limits the owner connecting to others.';

-- /connect/<token> is the Connection Pass entry route, so no profile may own it.
alter table public.profiles
  drop constraint profiles_username_not_reserved,
  add constraint profiles_username_not_reserved
  check (
    lower(username) not in (
      'app', 'login', 'signup', 'auth', 'api', 'pricing', 'about', 'help',
      'teams', 'events', 'security', 'privacy', 'terms', 'settings', 'account',
      'share', 'connections', 'wallet', 'admin', 'support', 'contact', 'careers',
      'brand', 'status', 'u', '_next', 'next', 'favicon', 'icon', 'robots',
      'sitemap', 'manifest', 'apple-touch-icon', 'assets', 'static', 'images',
      'fonts', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'manifest.json',
      'connect'
    )
  );

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    lower(btrim(coalesce(candidate_username, ''))) ~ '^[a-z0-9_]{3,24}$'
    and lower(btrim(coalesce(candidate_username, ''))) not in (
      'app', 'login', 'signup', 'auth', 'api', 'pricing', 'about', 'help',
      'teams', 'events', 'security', 'privacy', 'terms', 'settings', 'account',
      'share', 'connections', 'wallet', 'admin', 'support', 'contact', 'careers',
      'brand', 'status', 'u', '_next', 'next', 'favicon', 'icon', 'robots',
      'sitemap', 'manifest', 'apple-touch-icon', 'assets', 'static', 'images',
      'fonts', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'manifest.json',
      'connect'
    )
    and not exists (
      select 1
      from public.profiles
      where username = lower(btrim(coalesce(candidate_username, '')))
    );
$function$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create table public.connection_share_grants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  mode_id uuid not null,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  revoked_at timestamptz,
  foreign key (profile_id, mode_id) references public.profile_modes (profile_id, id) on delete cascade,
  check (created_by_user_id = profile_id),
  check (expires_at > created_at and expires_at <= created_at + interval '24 hours')
);

create index connection_share_grants_mode_active_idx
  on public.connection_share_grants (profile_id, mode_id, expires_at desc)
  where revoked_at is null;
create index connection_share_grants_created_idx
  on public.connection_share_grants (created_by_user_id, created_at desc);
create index connection_share_grants_mode_id_idx
  on public.connection_share_grants (mode_id);

-- No Data API access at all: grants are only created, revoked and checked
-- through the narrow SECURITY DEFINER functions below.
alter table public.connection_share_grants enable row level security;
revoke all on table public.connection_share_grants from public, anon, authenticated;

comment on table public.connection_share_grants is
  'Private Connection Passes for direct_only Modes. Stores only SHA-256 token hashes; scoped to one profile and one Mode; 24 hour maximum lifetime.';

-- True only for a live, unrevoked pass for exactly this profile and Mode.
create or replace function private.connection_pass_authorizes(p_profile_id uuid, p_mode_id uuid, p_token text)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select coalesce(p_token ~ '^[A-Za-z0-9_-]{43}$', false) and exists (
    select 1 from public.connection_share_grants
    where token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
      and profile_id = p_profile_id
      and mode_id = p_mode_id
      and revoked_at is null
      and expires_at > pg_catalog.statement_timestamp()
  );
$function$;

revoke all on function private.connection_pass_authorizes(uuid, uuid, text) from public, anon, authenticated;

-- Leaving direct_only revokes outstanding passes, so switching back later
-- never revives an old QR. Nobody also wins at check time regardless.
create or replace function private.revoke_passes_on_policy_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.connect_policy = 'direct_only' and new.connect_policy <> 'direct_only' then
    update public.connection_share_grants
      set revoked_at = pg_catalog.statement_timestamp()
      where profile_id = new.profile_id and mode_id = new.id and revoked_at is null;
  end if;
  return new;
end;
$function$;

revoke all on function private.revoke_passes_on_policy_change() from public, anon, authenticated;

create trigger profile_modes_revoke_passes_on_policy_change
after update of connect_policy on public.profile_modes
for each row execute function private.revoke_passes_on_policy_change();

-- Owner-only: returns a usable pass for one of the caller's own Modes. Reuses
-- the caller's current pass while it has at least two hours left.
create or replace function public.issue_connection_pass(p_mode text, p_current_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_mode_id uuid;
  v_policy text;
  v_expires timestamptz;
  v_token text;
  v_count integer;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Sign in required'; end if;
  if p_mode is null or p_mode not in ('personal', 'event', 'business') then
    raise exception using errcode = '22023', message = 'Choose a Mode';
  end if;
  select id, connect_policy into v_mode_id, v_policy from public.profile_modes
    where profile_id = v_user_id and slug = p_mode
    for update;
  if v_mode_id is null then raise exception using errcode = '22023', message = 'Mode unavailable'; end if;
  if v_policy <> 'direct_only' then
    raise exception using errcode = '22023', message = 'Connect in person needs Direct share only';
  end if;

  if p_current_token ~ '^[A-Za-z0-9_-]{43}$' then
    select expires_at into v_expires from public.connection_share_grants
      where token_hash = extensions.digest(pg_catalog.convert_to(p_current_token, 'UTF8'), 'sha256')
        and profile_id = v_user_id and mode_id = v_mode_id and revoked_at is null
        and expires_at > pg_catalog.statement_timestamp() + interval '2 hours';
    if v_expires is not null then
      return jsonb_build_object('token', p_current_token, 'expires_at', v_expires, 'reused', true);
    end if;
  end if;

  select count(*) into v_count from public.connection_share_grants
    where created_by_user_id = v_user_id
      and created_at > pg_catalog.statement_timestamp() - interval '24 hours';
  if v_count >= 20 then
    raise exception using errcode = '22023', message = 'Too many Connection Passes today';
  end if;

  v_token := pg_catalog.translate(pg_catalog.rtrim(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  insert into public.connection_share_grants (profile_id, mode_id, token_hash, created_by_user_id)
    values (v_user_id, v_mode_id, extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'), v_user_id)
    returning expires_at into v_expires;
  return jsonb_build_object('token', v_token, 'expires_at', v_expires, 'reused', false);
end;
$function$;

-- Owner-only: ends every active pass for one of the caller's own Modes.
create or replace function public.revoke_connection_passes(p_mode text)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Sign in required'; end if;
  if p_mode is null or p_mode not in ('personal', 'event', 'business') then
    raise exception using errcode = '22023', message = 'Choose a Mode';
  end if;
  update public.connection_share_grants
    set revoked_at = pg_catalog.statement_timestamp()
    where profile_id = v_user_id and revoked_at is null
      and mode_id = (select id from public.profile_modes where profile_id = v_user_id and slug = p_mode);
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- Entry route lookup. Returns where the pass points and whether it authorizes
-- Connect now; null for unknown tokens or unavailable profiles/Modes, so an
-- expired pass still lands on a live profile without Connect.
create or replace function public.resolve_connection_pass(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_username text;
  v_mode text;
  v_policy text;
  v_live boolean;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return null; end if;
  select profiles.username, profile_modes.slug, profile_modes.connect_policy,
         grants.revoked_at is null and grants.expires_at > pg_catalog.statement_timestamp()
    into v_username, v_mode, v_policy, v_live
  from public.connection_share_grants as grants
  join public.profiles on profiles.id = grants.profile_id
  join public.profile_modes on profile_modes.id = grants.mode_id and profile_modes.profile_id = grants.profile_id
  where grants.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    and profiles.is_published
    and profile_modes.is_enabled;
  if v_username is null then return null; end if;
  return jsonb_build_object('username', v_username, 'mode', v_mode, 'valid', v_live and v_policy = 'direct_only');
end;
$function$;

-- Server-side canInitiateConnection for one public profile Mode.
create or replace function public.get_connect_access(p_target_username text, p_target_mode text, p_pass_token text default null)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_profile_id uuid;
  v_mode_id uuid;
  v_policy text;
begin
  if p_target_mode is null or p_target_mode not in ('personal', 'event', 'business')
     or p_target_username is null or pg_catalog.lower(pg_catalog.btrim(p_target_username)) !~ '^[a-z0-9_]{3,24}$' then
    return false;
  end if;
  select profiles.id, profile_modes.id, profile_modes.connect_policy
    into v_profile_id, v_mode_id, v_policy
  from public.profiles
  join public.profile_modes on profile_modes.profile_id = profiles.id
  where profiles.username = pg_catalog.lower(pg_catalog.btrim(p_target_username))
    and profiles.is_published
    and profile_modes.slug = p_target_mode
    and profile_modes.is_enabled;
  if v_profile_id is null then return false; end if;
  return case v_policy
    when 'anyone' then true
    when 'direct_only' then private.connection_pass_authorizes(v_profile_id, v_mode_id, p_pass_token)
    else false
  end;
end;
$function$;

revoke all on function public.issue_connection_pass(text, text) from public, anon, authenticated;
revoke all on function public.revoke_connection_passes(text) from public, anon, authenticated;
revoke all on function public.resolve_connection_pass(text) from public, anon, authenticated;
revoke all on function public.get_connect_access(text, text, text) from public, anon, authenticated;
grant execute on function public.issue_connection_pass(text, text) to authenticated;
grant execute on function public.revoke_connection_passes(text) to authenticated;
grant execute on function public.resolve_connection_pass(text) to anon, authenticated;
grant execute on function public.get_connect_access(text, text, text) to anon, authenticated;
