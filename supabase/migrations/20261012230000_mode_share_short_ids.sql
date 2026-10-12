-- Short Mode share links: /s/K7mP2xQa instead of a 43-character token.
-- Each Mode keeps one stable locator, now addressed by an 8-character Base62
-- short id from a CSPRNG. The short id is only a pointer: it never
-- authenticates and never grants Connection Access. Long tokens issued
-- before this migration keep resolving until the owner regenerates the link.

-- 8 characters of [0-9A-Za-z] from gen_random_bytes, with rejection sampling
-- so every character is uniform (bytes >= 248 are discarded, 248 = 4 * 62).
create or replace function public.mode_share_short_id()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  v_id text;
  v_bytes bytea;
  v_byte int;
  v_attempt int := 0;
  i int;
begin
  loop
    v_attempt := v_attempt + 1;
    v_id := '';
    while pg_catalog.length(v_id) < 8 loop
      v_bytes := extensions.gen_random_bytes(16);
      for i in 0 .. 15 loop
        v_byte := pg_catalog.get_byte(v_bytes, i);
        if v_byte < 248 and pg_catalog.length(v_id) < 8 then
          v_id := v_id || pg_catalog.substr(v_alphabet, (v_byte % 62) + 1, 1);
        end if;
      end loop;
    end loop;
    -- The unique index is the real guard; this keeps collisions from surfacing.
    exit when not exists (select 1 from public.mode_share_locators where short_id = v_id) or v_attempt >= 5;
  end loop;
  return v_id;
end;
$function$;

revoke all on function public.mode_share_short_id() from public, anon, authenticated;

alter table public.mode_share_locators
  add column if not exists short_id text;

-- Every existing locator gets its short id now; its long token keeps working.
update public.mode_share_locators
  set short_id = public.mode_share_short_id()
  where short_id is null;

alter table public.mode_share_locators
  alter column short_id set default public.mode_share_short_id(),
  alter column short_id set not null,
  alter column nonce drop not null,
  alter column token_hash drop not null;

do $constraints$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'mode_share_locators_short_id_check') then
    alter table public.mode_share_locators
      add constraint mode_share_locators_short_id_check check (short_id ~ '^[0-9A-Za-z]{8}$');
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'mode_share_locators_short_id_key') then
    alter table public.mode_share_locators
      add constraint mode_share_locators_short_id_key unique (short_id);
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'mode_share_locators_legacy_pair_check') then
    -- A legacy long token needs both its nonce and hash, or neither.
    alter table public.mode_share_locators
      add constraint mode_share_locators_legacy_pair_check check ((nonce is null) = (token_hash is null));
  end if;
end;
$constraints$;

comment on column public.mode_share_locators.short_id is
  'Public 8-character Base62 locator used in /s/<short_id>. A pointer only, never authorization.';
comment on column public.mode_share_locators.token_hash is
  'Hash of a legacy 43-character token, kept so links shared before short ids keep working. Cleared when the owner regenerates the link.';

-- The server mints locators; the default fills in the short id.
grant execute on function public.mode_share_short_id() to service_role;

-- Resolution accepts the short id or a legacy long token, and nothing else.
create or replace function public.resolve_mode_share(p_token text)
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
  where (
      (p_token ~ '^[0-9A-Za-z]{8}$' and locators.short_id = p_token)
      or (p_token ~ '^[A-Za-z0-9_-]{43}$'
          and locators.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256'))
    )
    and profiles.is_published
    and profile_modes.is_enabled
    and profile_modes.slug in ('personal', 'event', 'business')
  limit 1;
$function$;

revoke all on function public.resolve_mode_share(text) from public;
grant execute on function public.resolve_mode_share(text) to anon, authenticated, service_role;

-- Owner-only rotation. Compare-and-swap on the current short id so a stale
-- tab cannot replace a newer link. Rotation also retires any legacy long
-- token, so every older link to this Mode stops working.
create or replace function public.rotate_mode_share_locator(p_mode text, p_expected_short_id text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_mode_id uuid;
  v_short_id text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_mode is null or p_mode not in ('event', 'business')
     or p_expected_short_id is null or p_expected_short_id !~ '^[0-9A-Za-z]{8}$' then
    raise exception using errcode = '22023', message = 'Invalid share link rotation';
  end if;

  select id into v_mode_id
  from public.profile_modes
  where profile_id = v_user_id and slug = p_mode;
  if v_mode_id is null then return null; end if;

  update public.mode_share_locators
    set short_id = public.mode_share_short_id(),
        nonce = null,
        token_hash = null,
        updated_at = pg_catalog.statement_timestamp()
    where profile_id = v_user_id
      and mode_id = v_mode_id
      and short_id = p_expected_short_id
  returning short_id into v_short_id;
  return v_short_id;
end;
$function$;

revoke all on function public.rotate_mode_share_locator(text, text) from public, anon;
grant execute on function public.rotate_mode_share_locator(text, text) to authenticated;
