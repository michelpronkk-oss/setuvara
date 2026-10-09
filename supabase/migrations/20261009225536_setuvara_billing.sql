-- Setuvara billing state is private provider infrastructure. Clients have no
-- table privileges; server-side service-role functions perform all mutations.
create table public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dodo_customer_id text not null unique,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint billing_customers_id_format check (dodo_customer_id ~ '^cus_[A-Za-z0-9]+$')
);

create table public.billing_subscriptions (
  dodo_subscription_id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  dodo_customer_id text not null,
  dodo_product_id text not null,
  plan_code text,
  billing_interval text,
  provider_status text not null,
  provider_created_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_next_billing_date boolean not null default false,
  cancelled_at timestamptz,
  past_due_ends_at timestamptz,
  last_provider_event_id text not null,
  last_provider_event_at timestamptz not null,
  last_sync_started_at timestamptz not null,
  synchronized_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint billing_subscriptions_plan_check check (plan_code is null or plan_code in ('plus', 'pro')),
  constraint billing_subscriptions_interval_check check (billing_interval is null or billing_interval in ('monthly', 'yearly')),
  constraint billing_subscriptions_status_check check (provider_status in (
    'pending', 'active', 'on_hold', 'paused', 'cancelled', 'failed', 'expired', 'past_due'
  )),
  constraint billing_subscriptions_customer_id_format check (dodo_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  constraint billing_subscriptions_product_id_format check (dodo_product_id ~ '^pdt_[A-Za-z0-9]+$'),
  constraint billing_subscriptions_subscription_id_format check (dodo_subscription_id ~ '^sub_[A-Za-z0-9]+$')
);

create index billing_subscriptions_user_state_idx
  on public.billing_subscriptions (user_id, provider_status, plan_code)
  where user_id is not null;

create table public.billing_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key uuid not null,
  plan_code text not null check (plan_code in ('plus', 'pro')),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  dodo_product_id text not null check (dodo_product_id ~ '^pdt_[A-Za-z0-9]+$'),
  dodo_session_id text unique,
  checkout_url text,
  status text not null default 'creating' check (status in ('creating', 'open', 'complete', 'expired', 'failed')),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint billing_checkout_attempts_checkout_pair check (
    (dodo_session_id is null and checkout_url is null) or
    (dodo_session_id is not null and checkout_url is not null)
  )
);

create unique index billing_checkout_attempts_active_user_idx
  on public.billing_checkout_attempts (user_id)
  where status in ('creating', 'open');
create unique index billing_checkout_attempts_idempotency_idx
  on public.billing_checkout_attempts (user_id, idempotency_key);

create table public.billing_webhook_events (
  provider_event_id text primary key,
  event_type text not null,
  received_at timestamptz not null,
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'processed', 'ignored', 'failed')),
  processing_started_at timestamptz not null default pg_catalog.statement_timestamp(),
  processed_at timestamptz,
  processing_attempts integer not null default 1 check (processing_attempts > 0),
  safe_error_code text,
  constraint billing_webhook_events_id_format check (provider_event_id ~ '^[A-Za-z0-9_.:-]{1,160}$'),
  constraint billing_webhook_events_type_format check (event_type ~ '^[a-z_]+[.][a-z_]+$')
);

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_checkout_attempts enable row level security;
alter table public.billing_webhook_events enable row level security;

revoke all on table public.billing_customers, public.billing_subscriptions,
  public.billing_checkout_attempts, public.billing_webhook_events
  from public, anon, authenticated;
grant select, insert, update, delete on table public.billing_customers,
  public.billing_subscriptions, public.billing_checkout_attempts,
  public.billing_webhook_events to service_role;

create or replace function public.reserve_billing_checkout(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_plan_code text,
  p_billing_interval text,
  p_dodo_product_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.billing_checkout_attempts%rowtype;
begin
  if p_plan_code not in ('plus', 'pro')
    or p_billing_interval not in ('monthly', 'yearly')
    or p_dodo_product_id !~ '^pdt_[A-Za-z0-9]+$' then
    raise exception 'invalid_billing_checkout_request' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 42));

  update public.billing_checkout_attempts
  set status = 'expired', updated_at = pg_catalog.statement_timestamp()
  where user_id = p_user_id and status in ('creating', 'open')
    and expires_at <= pg_catalog.statement_timestamp();

  select * into v_attempt
  from public.billing_checkout_attempts
  where user_id = p_user_id and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_attempt.plan_code <> p_plan_code
      or v_attempt.billing_interval <> p_billing_interval
      or v_attempt.dodo_product_id <> p_dodo_product_id then
      return pg_catalog.jsonb_build_object('result', 'idempotency_conflict');
    end if;
    if v_attempt.status in ('creating', 'open') then
      return pg_catalog.jsonb_build_object(
        'result', 'existing', 'attemptId', v_attempt.id,
        'sessionId', v_attempt.dodo_session_id, 'checkoutUrl', v_attempt.checkout_url,
        'status', v_attempt.status
      );
    end if;
    return pg_catalog.jsonb_build_object('result', 'expired');
  end if;

  select * into v_attempt
  from public.billing_checkout_attempts
  where user_id = p_user_id and status in ('creating', 'open')
  order by created_at desc limit 1
  for update;

  if found then
    return pg_catalog.jsonb_build_object('result', 'checkout_in_progress');
  end if;

  insert into public.billing_checkout_attempts (
    user_id, idempotency_key, plan_code, billing_interval, dodo_product_id,
    expires_at
  ) values (
    p_user_id, p_idempotency_key, p_plan_code, p_billing_interval,
    p_dodo_product_id, pg_catalog.statement_timestamp() + interval '24 hours'
  ) returning * into v_attempt;

  return pg_catalog.jsonb_build_object(
    'result', 'created', 'attemptId', v_attempt.id,
    'sessionId', null, 'checkoutUrl', null, 'status', v_attempt.status
  );
end;
$$;

revoke all on function public.reserve_billing_checkout(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_billing_checkout(uuid, uuid, text, text, text) to service_role;

create or replace function public.store_billing_checkout_session(
  p_attempt_id uuid,
  p_session_id text,
  p_checkout_url text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.billing_checkout_attempts
  set dodo_session_id = p_session_id,
      checkout_url = p_checkout_url,
      status = 'open',
      updated_at = pg_catalog.statement_timestamp()
  where id = p_attempt_id and status = 'creating' and expires_at > pg_catalog.statement_timestamp();
  return found;
end;
$$;

revoke all on function public.store_billing_checkout_session(uuid, text, text) from public, anon, authenticated;
grant execute on function public.store_billing_checkout_session(uuid, text, text) to service_role;

create or replace function public.fail_billing_checkout_attempt(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.billing_checkout_attempts
  set status = 'failed', updated_at = pg_catalog.statement_timestamp()
  where id = p_attempt_id and status = 'creating';
  return found;
end;
$$;

revoke all on function public.fail_billing_checkout_attempt(uuid) from public, anon, authenticated;
grant execute on function public.fail_billing_checkout_attempt(uuid) to service_role;

create or replace function public.claim_billing_webhook_event(
  p_provider_event_id text,
  p_event_type text,
  p_received_at timestamptz
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.billing_webhook_events%rowtype;
begin
  insert into public.billing_webhook_events (provider_event_id, event_type, received_at)
  values (p_provider_event_id, p_event_type, p_received_at)
  on conflict (provider_event_id) do nothing;

  if found then return 'claimed'; end if;

  select * into v_event
  from public.billing_webhook_events
  where provider_event_id = p_provider_event_id
  for update;

  if v_event.processing_status in ('processed', 'ignored') then
    return 'duplicate';
  end if;

  if v_event.processing_status = 'processing'
    and v_event.processing_started_at > pg_catalog.statement_timestamp() - interval '30 seconds' then
    return 'busy';
  end if;

  update public.billing_webhook_events
  set processing_status = 'processing',
      processing_started_at = pg_catalog.statement_timestamp(),
      processing_attempts = processing_attempts + 1,
      safe_error_code = null
  where provider_event_id = p_provider_event_id;
  return 'claimed';
end;
$$;

revoke all on function public.claim_billing_webhook_event(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_billing_webhook_event(text, text, timestamptz) to service_role;

create or replace function public.sync_billing_subscription(
  p_user_id uuid,
  p_dodo_subscription_id text,
  p_dodo_customer_id text,
  p_dodo_product_id text,
  p_plan_code text,
  p_billing_interval text,
  p_provider_status text,
  p_provider_created_at timestamptz,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_next_billing_date boolean,
  p_cancelled_at timestamptz,
  p_past_due_ends_at timestamptz,
  p_provider_event_id text,
  p_provider_event_at timestamptz,
  p_sync_started_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_plan_code is not null and p_plan_code not in ('plus', 'pro') then
    raise exception 'invalid_billing_plan' using errcode = '22023';
  end if;
  if p_billing_interval is not null and p_billing_interval not in ('monthly', 'yearly') then
    raise exception 'invalid_billing_interval' using errcode = '22023';
  end if;
  if p_provider_status not in ('pending', 'active', 'on_hold', 'paused', 'cancelled', 'failed', 'expired', 'past_due') then
    raise exception 'invalid_billing_status' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.billing_customers c
    where c.user_id = p_user_id and c.dodo_customer_id = p_dodo_customer_id
  ) then
    raise exception 'billing_customer_mapping_missing' using errcode = '23503';
  end if;

  insert into public.billing_subscriptions (
    dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id,
    plan_code, billing_interval, provider_status, provider_created_at,
    current_period_start, current_period_end, cancel_at_next_billing_date,
    cancelled_at, past_due_ends_at, last_provider_event_id,
    last_provider_event_at, last_sync_started_at, synchronized_at, updated_at
  ) values (
    p_dodo_subscription_id, p_user_id, p_dodo_customer_id, p_dodo_product_id,
    p_plan_code, p_billing_interval, p_provider_status, p_provider_created_at,
    p_current_period_start, p_current_period_end, p_cancel_at_next_billing_date,
    p_cancelled_at, p_past_due_ends_at, p_provider_event_id,
    p_provider_event_at, p_sync_started_at, pg_catalog.statement_timestamp(),
    pg_catalog.statement_timestamp()
  )
  on conflict (dodo_subscription_id) do update set
    user_id = excluded.user_id,
    dodo_customer_id = excluded.dodo_customer_id,
    dodo_product_id = excluded.dodo_product_id,
    plan_code = excluded.plan_code,
    billing_interval = excluded.billing_interval,
    provider_status = excluded.provider_status,
    provider_created_at = excluded.provider_created_at,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_next_billing_date = excluded.cancel_at_next_billing_date,
    cancelled_at = excluded.cancelled_at,
    past_due_ends_at = excluded.past_due_ends_at,
    last_provider_event_id = excluded.last_provider_event_id,
    last_provider_event_at = excluded.last_provider_event_at,
    last_sync_started_at = excluded.last_sync_started_at,
    synchronized_at = pg_catalog.statement_timestamp(),
    updated_at = pg_catalog.statement_timestamp()
  where public.billing_subscriptions.last_sync_started_at <= excluded.last_sync_started_at;

  return found;
end;
$$;

revoke all on function public.sync_billing_subscription(uuid, text, text, text, text, text, text, timestamptz, timestamptz, timestamptz, boolean, timestamptz, timestamptz, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.sync_billing_subscription(uuid, text, text, text, text, text, text, timestamptz, timestamptz, timestamptz, boolean, timestamptz, timestamptz, text, timestamptz, timestamptz) to service_role;

create or replace function public.billing_subscription_has_access(
  p_status text,
  p_period_end timestamptz,
  p_cancel_at_next_billing_date boolean,
  p_past_due_ends_at timestamptz
) returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when p_status = 'active' then case
      when coalesce(p_cancel_at_next_billing_date, false)
        then coalesce(p_period_end > pg_catalog.statement_timestamp(), false)
      else true
    end
    when p_status = 'past_due' then coalesce(p_past_due_ends_at > pg_catalog.statement_timestamp(), false)
    else false
  end
$$;

revoke all on function public.billing_subscription_has_access(text, timestamptz, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.billing_subscription_has_access(text, timestamptz, boolean, timestamptz) to service_role;

create or replace function public.get_public_profile_billing_entitlements(p_username text)
returns table (verified_badge boolean, remove_setuvara_branding boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(bool_or(s.plan_code in ('plus', 'pro') and public.billing_subscription_has_access(
      s.provider_status, s.current_period_end, s.cancel_at_next_billing_date, s.past_due_ends_at
    )), false) as verified_badge,
    coalesce(bool_or(s.plan_code in ('plus', 'pro') and public.billing_subscription_has_access(
      s.provider_status, s.current_period_end, s.cancel_at_next_billing_date, s.past_due_ends_at
    )), false) as remove_setuvara_branding
  from public.profiles p
  left join public.billing_subscriptions s on s.user_id = p.id
  where p.username = pg_catalog.lower(pg_catalog.btrim(p_username))
    and p.is_published = true
  group by p.id
$$;

-- Public is allowed to see only the two explicitly public plan booleans for an
-- already-published username. No billing state, price, IDs, or period dates.
revoke all on function public.get_public_profile_billing_entitlements(text) from public;
grant execute on function public.get_public_profile_billing_entitlements(text) to anon, authenticated;

comment on table public.billing_customers is 'Server-only mapping from Setuvara users to Dodo customers. Never exposed through the Data API.';
comment on table public.billing_subscriptions is 'Provider-synchronized subscription state. Entitlements are derived centrally; clients cannot mutate or read provider state.';
comment on table public.billing_checkout_attempts is 'Server-only idempotent Dodo Checkout Session attempts; active rows prevent duplicate sessions per user.';
comment on table public.billing_webhook_events is 'Durable Dodo webhook event identities and processing outcomes; raw provider payloads and payment PII are not stored.';
comment on function public.get_public_profile_billing_entitlements(text) is 'Intentional SECURITY DEFINER: aggregates private billing state and exposes only two booleans for published profiles; no billing rows, identifiers, or dates are returned.';
