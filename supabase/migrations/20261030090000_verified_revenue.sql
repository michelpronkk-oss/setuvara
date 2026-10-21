-- Verified Revenue: read-only connections from a Builder project to a revenue provider, daily
-- source-labelled snapshots, and an opt-in public figure.
--
-- Credentials are member-supplied, least-privilege keys. Each is stored as its own Vault secret,
-- referenced only by id; nobody but the service role (the server, after verifying the key's
-- permissions with the provider) can create, read or revoke it. Numbers only ever come from a
-- provider sync; there is no path for a member to write a verified figure.

set lock_timeout = '5s';

create table private.revenue_plan_limits (
  plan_code text primary key check (plan_code in ('free','plus','pro')),
  providers integer not null check (providers between 0 and 10),
  history_days integer not null check (history_days between 0 and 3660)
);
insert into private.revenue_plan_limits values ('free', 0, 0), ('plus', 1, 365), ('pro', 3, 1095);
revoke all on private.revenue_plan_limits from public, anon, authenticated;

alter table public.builder_projects
  add column revenue_visibility text not null default 'hidden' check (revenue_visibility in ('hidden','exact','range','growth'));

create table public.revenue_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.builder_projects(id) on delete cascade,
  provider text not null check (provider in ('stripe','revenuecat','dodo')),
  environment text not null check (environment in ('live','test')),
  account_ref text check (account_ref is null or char_length(account_ref) <= 120),
  key_hint text not null check (char_length(key_hint) between 4 and 24),
  vault_secret_id uuid,
  status text not null default 'active' check (status in ('active','error','revoked')),
  verified_at timestamptz not null default pg_catalog.statement_timestamp(),
  last_sync_at timestamptz,
  last_sync_ok boolean,
  last_error text check (last_error is null or char_length(last_error) <= 200),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  check ((status = 'revoked') = (vault_secret_id is null))
);
-- One live connection per provider per project; revoked rows stay for the history they produced.
create unique index revenue_connections_one_per_provider on public.revenue_connections (project_id, provider) where status <> 'revoked';
create index revenue_connections_owner_idx on public.revenue_connections (owner_user_id);

create table public.revenue_snapshots (
  connection_id uuid not null references public.revenue_connections(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.builder_projects(id) on delete cascade,
  day date not null,
  provider text not null,
  environment text not null,
  currency text not null check (currency ~ '^[a-z]{3}$'),
  mrr_minor bigint not null check (mrr_minor >= 0),
  paying_customers integer not null check (paying_customers >= 0),
  active_subscriptions integer not null check (active_subscriptions >= 0),
  method text not null check (char_length(method) <= 80),
  synced_at timestamptz not null default pg_catalog.statement_timestamp(),
  primary key (connection_id, day, currency)
);
create index revenue_snapshots_project_idx on public.revenue_snapshots (project_id, day desc);

alter table public.revenue_connections enable row level security;
alter table public.revenue_snapshots enable row level security;
revoke all on public.revenue_connections, public.revenue_snapshots from public, anon, authenticated;
-- Owners read their own rows, never the Vault reference.
grant select (id, owner_user_id, project_id, provider, environment, account_ref, key_hint, status, verified_at,
  last_sync_at, last_sync_ok, last_error, created_at) on public.revenue_connections to authenticated;
grant select on public.revenue_snapshots to authenticated;
grant all on public.revenue_connections, public.revenue_snapshots to service_role;
create policy revenue_connections_owner_read on public.revenue_connections for select to authenticated
  using (owner_user_id = (select auth.uid()));
create policy revenue_snapshots_owner_read on public.revenue_snapshots for select to authenticated
  using (owner_user_id = (select auth.uid()));

-- The owner's provider allowance.
create function public.my_revenue_limits()
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('plan', l.plan_code, 'providers', l.providers, 'history_days', l.history_days)
  from private.revenue_plan_limits l where l.plan_code = private.member_plan(auth.uid()) and auth.uid() is not null
$function$;

-- Server only, after it verified the key with the provider. Stores the key in Vault and opens the connection.
create function public.revenue_connect(p_user uuid, p_project uuid, p_provider text, p_environment text,
  p_account_ref text, p_key_hint text, p_secret text)
returns uuid language plpgsql security definer set search_path='' as $function$
declare v_allowed integer; v_used integer; v_secret uuid; v_id uuid;
begin
  if not exists(select 1 from public.builder_projects bp where bp.id = p_project and bp.owner_user_id = p_user) then
    raise exception using errcode='P0002', message='project_not_found';
  end if;
  if pg_catalog.length(coalesce(p_secret,'')) not between 16 and 400 then raise exception using errcode='22023', message='invalid_key'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('revenue_connect:' || p_user::text, 0));
  if exists(select 1 from public.revenue_connections c where c.project_id = p_project and c.provider = p_provider and c.status <> 'revoked') then
    raise exception using errcode='P0001', message='already_connected';
  end if;
  select l.providers into v_allowed from private.revenue_plan_limits l where l.plan_code = private.member_plan(p_user);
  select pg_catalog.count(*) into v_used from public.revenue_connections c where c.owner_user_id = p_user and c.status <> 'revoked';
  if coalesce(v_allowed, 0) <= v_used then raise exception using errcode='P0001', message='plan_limit'; end if;
  v_secret := vault.create_secret(p_secret, 'revenue_' || pg_catalog.replace(gen_random_uuid()::text, '-', ''), 'Verified Revenue read-only key');
  insert into public.revenue_connections (owner_user_id, project_id, provider, environment, account_ref, key_hint, vault_secret_id)
    values (p_user, p_project, p_provider, p_environment, nullif(pg_catalog.btrim(coalesce(p_account_ref,'')), ''), p_key_hint, v_secret)
    returning id into v_id;
  return v_id;
end;
$function$;

-- Server only: the key for a sync.
create function public.revenue_connection_secret(p_connection uuid)
returns text language sql stable security definer set search_path='' as $function$
  select s.decrypted_secret from public.revenue_connections c join vault.decrypted_secrets s on s.id = c.vault_secret_id
  where c.id = p_connection and c.status <> 'revoked'
$function$;

-- Disconnect: the owner (or the server on a provider-side revocation) destroys the stored key.
-- Snapshots stay for the owner's history but never count as verified again.
create function public.revenue_disconnect(p_connection uuid, p_user uuid default null)
returns void language plpgsql security definer set search_path='' as $function$
declare v_secret uuid; v_user uuid := coalesce(auth.uid(), case when auth.role() = 'service_role' then p_user end);
begin
  if v_user is null then raise exception using errcode='42501', message='not_allowed'; end if;
  select c.vault_secret_id into v_secret from public.revenue_connections c
    where c.id = p_connection and c.owner_user_id = v_user and c.status <> 'revoked' for update;
  if not found then raise exception using errcode='P0002', message='connection_not_found'; end if;
  update public.revenue_connections set status = 'revoked', vault_secret_id = null where id = p_connection;
  delete from vault.secrets where id = v_secret;
end;
$function$;

-- Server only: record one sync. Writes a snapshot per currency for today, trims history past the plan.
create function public.revenue_record_sync(p_connection uuid, p_ok boolean, p_error text, p_rows jsonb, p_method text)
returns void language plpgsql security definer set search_path='' as $function$
declare v_conn public.revenue_connections; v_days integer; v_today date := (pg_catalog.statement_timestamp() at time zone 'utc')::date;
begin
  select * into v_conn from public.revenue_connections c where c.id = p_connection and c.status <> 'revoked' for update;
  if not found then return; end if;
  update public.revenue_connections set last_sync_at = pg_catalog.statement_timestamp(), last_sync_ok = p_ok,
    last_error = case when p_ok then null else pg_catalog.left(p_error, 200) end,
    status = case when p_ok then 'active' else 'error' end
    where id = p_connection;
  if not p_ok then return; end if;
  delete from public.revenue_snapshots s where s.connection_id = p_connection and s.day = v_today;
  insert into public.revenue_snapshots (connection_id, owner_user_id, project_id, day, provider, environment, currency,
      mrr_minor, paying_customers, active_subscriptions, method)
    select v_conn.id, v_conn.owner_user_id, v_conn.project_id, v_today, v_conn.provider, v_conn.environment, pg_catalog.lower(r->>'currency'),
      (r->>'mrr_minor')::bigint, (r->>'paying_customers')::integer, (r->>'active_subscriptions')::integer, p_method
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
  select l.history_days into v_days from private.revenue_plan_limits l where l.plan_code = private.member_plan(v_conn.owner_user_id);
  delete from public.revenue_snapshots s where s.connection_id = p_connection and s.day < v_today - greatest(coalesce(v_days, 0), 31);
end;
$function$;

-- A rounded band for the "range" setting, in major units.
create function private.revenue_band(p_minor bigint)
returns text language sql immutable set search_path='' as $function$
  select case
    when p_minor < 100000 then '<1k' when p_minor < 500000 then '1k-5k' when p_minor < 1000000 then '5k-10k'
    when p_minor < 2500000 then '10k-25k' when p_minor < 5000000 then '25k-50k' when p_minor < 10000000 then '50k-100k'
    when p_minor < 25000000 then '100k-250k' when p_minor < 100000000 then '250k-1m' else '1m+' end
$function$;

-- What visitors see, per project and per source. Only live-mode connections with a successful sync in the
-- last 48 hours count; each provider is shown on its own, never summed, so overlapping providers can't double-count.
create function public.get_public_builder_revenue(p_username text, p_mode_slug text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_object_agg(x.project_id, x.sources), '{}'::jsonb) from (
    select bp.id as project_id, jsonb_agg(jsonb_build_object(
        'provider', c.provider, 'currency', s.currency, 'synced_at', c.last_sync_at, 'visibility', bp.revenue_visibility,
        'mrr_minor', case when bp.revenue_visibility = 'exact' then s.mrr_minor end,
        'arr_minor', case when bp.revenue_visibility = 'exact' then s.mrr_minor * 12 end,
        'paying_customers', case when bp.revenue_visibility = 'exact' then s.paying_customers end,
        'band', case when bp.revenue_visibility = 'range' then private.revenue_band(s.mrr_minor) end,
        'growth_pct', case when bp.revenue_visibility in ('exact','range','growth') and prev.mrr_minor > 0
          then pg_catalog.round((s.mrr_minor - prev.mrr_minor) * 100.0 / prev.mrr_minor, 1) end
      ) order by c.provider, s.mrr_minor desc) as sources
    from public.profiles p
    join public.profile_modes m on m.profile_id = p.id and m.slug = p_mode_slug and m.is_enabled and m.slug in ('creator','business')
    join public.builder_projects bp on bp.mode_id = m.id and bp.visibility = 'public' and bp.revenue_visibility <> 'hidden'
    join public.revenue_connections c on c.project_id = bp.id and c.status = 'active' and c.environment = 'live'
      and c.last_sync_ok and c.last_sync_at > pg_catalog.statement_timestamp() - interval '48 hours'
    join public.revenue_snapshots s on s.connection_id = c.id and s.day = (c.last_sync_at at time zone 'utc')::date
    left join lateral (select s2.mrr_minor from public.revenue_snapshots s2 where s2.connection_id = c.id and s2.currency = s.currency
      and s2.day <= s.day - 28 order by s2.day desc limit 1) prev on true
    where p.username = pg_catalog.lower(pg_catalog.btrim(p_username)) and p.is_published
      and private.member_plan(p.id) in ('plus','pro')
    group by bp.id
  ) x
$function$;

-- The connections the sync job should run, oldest first.
create function public.revenue_due_connections(p_limit integer default 50)
returns table (id uuid, provider text, environment text)
language sql stable security definer set search_path='' as $function$
  select c.id, c.provider, c.environment from public.revenue_connections c
  where c.status <> 'revoked' and (c.last_sync_at is null or c.last_sync_at < pg_catalog.statement_timestamp() - interval '20 hours')
    and private.member_plan(c.owner_user_id) in ('plus','pro')
  order by c.last_sync_at nulls first limit greatest(least(p_limit, 200), 1)
$function$;

create function public.revenue_cron_token_valid(p_token text)
returns boolean language sql stable security definer set search_path='' as $function$
  select coalesce(pg_catalog.length(p_token) >= 32 and exists(
    select 1 from vault.decrypted_secrets s where s.name = 'setuvara_revenue_sync' and s.decrypted_secret = p_token), false)
$function$;

revoke all on function public.my_revenue_limits(), public.revenue_connect(uuid, uuid, text, text, text, text, text),
  public.revenue_connection_secret(uuid), public.revenue_disconnect(uuid, uuid), public.revenue_record_sync(uuid, boolean, text, jsonb, text),
  public.get_public_builder_revenue(text, text), public.revenue_due_connections(integer), public.revenue_cron_token_valid(text),
  private.revenue_band(bigint) from public, anon, authenticated;
grant execute on function public.my_revenue_limits(), public.revenue_disconnect(uuid, uuid) to authenticated;
grant execute on function public.get_public_builder_revenue(text, text) to anon, authenticated, service_role;
grant execute on function public.revenue_connect(uuid, uuid, text, text, text, text, text), public.revenue_connection_secret(uuid),
  public.revenue_disconnect(uuid, uuid), public.revenue_record_sync(uuid, boolean, text, jsonb, text),
  public.revenue_due_connections(integer), public.revenue_cron_token_valid(text) to service_role;

do $vault$
begin
  if not exists(select 1 from vault.secrets where name = 'setuvara_revenue_sync') then
    perform vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'), 'setuvara_revenue_sync',
      'Bearer token pg_cron sends to /api/revenue/sync');
  end if;
end
$vault$;

comment on table public.revenue_connections is 'Verified Revenue: a read-only provider key (in Vault) linked to a Builder project. Written by the server only.';
comment on table public.revenue_snapshots is 'Daily provider-computed revenue per connection and currency. Written by the sync job only.';
