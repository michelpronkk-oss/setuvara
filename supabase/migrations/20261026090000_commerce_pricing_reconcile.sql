-- Commerce pricing and the reconciliation job.
--
-- 1. Approved pricing, per checkout currency: Free sellers pay Setuvara 5% of each paid sale,
--    Plus and Pro sellers pay 0%. Stripe's processing fee is separate and always the seller's.
--    The plan is the seller's own (private.member_plan, fail-closed on expiry), read when the
--    order opens; the fee is snapshotted on the order and never recalculated (the snapshot
--    trigger already makes it immutable). Rules are versioned rows: a new price is a new row.
-- 2. Checkout refuses to open when no rule covers the currency, instead of selling fee-free.
-- 3. The hourly reconciliation run takes a lease so two runs never overlap, logs every run,
--    and checks its caller against a secret kept in Vault. The schedule itself is created
--    once per environment by supabase/ops/commerce_reconcile_cron.sql, not here, so a local
--    or branch database never calls production.

-- 1. Pricing.
insert into public.creator_fee_policies (currency, platform_fee_bps, fixed_fee_minor, plan_code, effective_from, note)
select c.code, p.bps, 0, p.plan, pg_catalog.statement_timestamp(), 'Approved pricing: Free 5%, Plus 0%, Pro 0%'
from (values ('EUR'), ('USD'), ('GBP')) c(code)
cross join (values ('free', 500), ('plus', 0), ('pro', 0)) p(plan, bps);

-- 2. No rule, no sale.
create or replace function public.commerce_begin_checkout(p_offer_id uuid, p_buyer_user uuid, p_buyer_email text, p_buyer_name text, p_idempotency_key text, p_ip_hash text, p_provider text, p_livemode boolean)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_offer public.creator_offers; v_acct public.creator_payout_accounts; v_order public.creator_orders;
  v_policy record; v_fee bigint; v_email text := lower(btrim(coalesce(p_buyer_email,''))); v_sold integer;
begin
  if p_idempotency_key !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception using errcode='22023', message='invalid_request'; end if;
  select * into v_order from public.creator_orders o where o.offer_id=p_offer_id and o.idempotency_key=p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_order.id, 'existing', true, 'status', v_order.status, 'checkout_url', v_order.checkout_url,
      'expires_at', v_order.expires_at, 'provider_account_id', v_order.provider_account_id);
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception using errcode='22023', message='invalid_email'; end if;

  select * into v_offer from public.creator_offers o where o.id=p_offer_id for share;
  if not found or not private.creator_offer_sellable(v_offer) or v_offer.offer_type='external'
     or not public.creator_offer_is_public(v_offer.creator_user_id, v_offer.offer_type) then
    raise exception using errcode='P0001', message='offer_unavailable';
  end if;
  if v_offer.unit_amount_minor = 0 then raise exception using errcode='P0001', message='offer_is_free'; end if;
  if p_buyer_user is not null and p_buyer_user=v_offer.creator_user_id then raise exception using errcode='P0001', message='own_offer'; end if;
  select * into v_acct from public.creator_payout_accounts pa where pa.creator_user_id=v_offer.creator_user_id and pa.provider=p_provider and pa.disconnected_at is null;
  if not found or not v_acct.charges_enabled or v_acct.livemode is distinct from p_livemode then
    raise exception using errcode='P0001', message='seller_unavailable';
  end if;
  if p_ip_hash is not null and (select count(*) from public.creator_orders o where o.buyer_ip_hash=p_ip_hash
      and o.created_at > pg_catalog.statement_timestamp() - interval '1 hour') >= 20 then
    raise exception using errcode='P0001', message='rate_limited';
  end if;
  if v_offer.quantity_limit is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_offer.id::text, 7));
    select count(*) into v_sold from public.creator_orders o where o.offer_id=v_offer.id
      and (o.status in ('paid','processing','partially_refunded','disputed') or (o.status='pending' and o.expires_at > pg_catalog.statement_timestamp()));
    if v_sold >= v_offer.quantity_limit then raise exception using errcode='P0001', message='sold_out'; end if;
  end if;

  -- The seller's plan right now decides the fee; the buyer has no part in it. Rounded down to a whole minor unit.
  select * into v_policy from private.commerce_fee_policy(v_offer.creator_user_id, v_offer.currency);
  if v_policy.policy_id is null then raise exception using errcode='P0001', message='fee_policy_missing'; end if;
  v_fee := pg_catalog.floor(v_offer.unit_amount_minor * v_policy.fee_bps / 10000.0)::bigint + v_policy.fixed_fee_minor;
  if v_fee >= v_offer.unit_amount_minor then raise exception using errcode='P0001', message='fee_exceeds_price'; end if;

  insert into public.creator_orders (creator_user_id, buyer_user_id, offer_id, currency, gross_amount_minor, platform_fee_bps,
    platform_fee_amount_minor, payment_fee_amount_minor, creator_net_amount_minor, status, provider, idempotency_key, order_kind,
    offer_title, offer_type, buyer_email, buyer_name, fee_policy_id, platform_fee_fixed_minor, provider_account_id, livemode,
    expires_at, fulfillment_status, buyer_ip_hash)
  values (v_offer.creator_user_id, p_buyer_user, v_offer.id, v_offer.currency, v_offer.unit_amount_minor, v_policy.fee_bps,
    v_fee, 0, v_offer.unit_amount_minor - v_fee, 'pending', p_provider, p_idempotency_key, 'purchase', v_offer.title, v_offer.offer_type,
    v_email, nullif(left(btrim(coalesce(p_buyer_name,'')),120),''), v_policy.policy_id, v_policy.fixed_fee_minor,
    v_acct.provider_account_id, p_livemode, pg_catalog.statement_timestamp() + interval '35 minutes',
    case when v_offer.offer_type='digital' then 'pending' else 'not_required' end, p_ip_hash)
  returning * into v_order;

  insert into public.creator_offer_daily_stats as s (offer_id, creator_user_id, day, checkout_starts)
    values (v_offer.id, v_offer.creator_user_id, (pg_catalog.statement_timestamp() at time zone 'utc')::date, 1)
    on conflict (offer_id, day) do update set checkout_starts = s.checkout_starts + 1;

  return jsonb_build_object('order_id', v_order.id, 'existing', false, 'status', v_order.status, 'currency', v_order.currency,
    'amount_minor', v_order.gross_amount_minor, 'platform_fee_minor', v_order.platform_fee_amount_minor,
    'provider_account_id', v_order.provider_account_id, 'title', v_offer.title, 'description', v_offer.description,
    'creator_user_id', v_offer.creator_user_id, 'expires_at', v_order.expires_at);
end;
$function$;

-- 3. Scheduled jobs: a lease per job and a run log.
create table public.commerce_job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null check (job ~ '^[a-z][a-z0-9_]{1,39}$'),
  started_at timestamptz not null default pg_catalog.clock_timestamp(),
  lease_until timestamptz not null,
  finished_at timestamptz,
  ok boolean,
  report jsonb,
  error text check (error is null or char_length(error) <= 300)
);
create index commerce_job_runs_job_idx on public.commerce_job_runs (job, started_at desc);
alter table public.commerce_job_runs enable row level security;
revoke all on public.commerce_job_runs from public, anon, authenticated;
grant all on public.commerce_job_runs to service_role;

-- Starts a run unless one still holds the lease. Returns the run id, or null when another run is active.
create function public.commerce_job_begin(p_job text, p_lease_seconds integer default 300)
returns uuid language plpgsql security definer set search_path='' as $function$
declare v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('commerce_job:' || p_job, 0));
  if exists(select 1 from public.commerce_job_runs r where r.job = p_job and r.finished_at is null and r.lease_until > pg_catalog.clock_timestamp()) then
    return null;
  end if;
  insert into public.commerce_job_runs (job, lease_until)
    values (p_job, pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => greatest(least(p_lease_seconds, 3600), 30)))
    returning id into v_id;
  delete from public.commerce_job_runs r where r.job = p_job and r.started_at < pg_catalog.clock_timestamp() - interval '30 days';
  return v_id;
end;
$function$;

create function public.commerce_job_finish(p_run_id uuid, p_ok boolean, p_report jsonb, p_error text)
returns void language sql security definer set search_path='' as $function$
  update public.commerce_job_runs set finished_at = pg_catalog.clock_timestamp(), ok = p_ok, report = p_report,
    error = pg_catalog.left(p_error, 300)
  where id = p_run_id and finished_at is null;
$function$;

-- Whether a caller holds the reconciliation secret. The secret lives in Vault and never leaves the database.
create function public.commerce_cron_token_valid(p_token text)
returns boolean language sql stable security definer set search_path='' as $function$
  select coalesce(pg_catalog.length(p_token) >= 32 and exists(
    select 1 from vault.decrypted_secrets s where s.name = 'setuvara_commerce_reconcile' and s.decrypted_secret = p_token), false)
$function$;

revoke all on function public.commerce_job_begin(text, integer), public.commerce_job_finish(uuid, boolean, jsonb, text),
  public.commerce_cron_token_valid(text) from public, anon, authenticated;
grant execute on function public.commerce_job_begin(text, integer), public.commerce_job_finish(uuid, boolean, jsonb, text),
  public.commerce_cron_token_valid(text) to service_role;

-- The secret, created once; random and never written anywhere else.
do $vault$
begin
  if not exists(select 1 from vault.secrets where name = 'setuvara_commerce_reconcile') then
    perform vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'), 'setuvara_commerce_reconcile',
      'Bearer token pg_cron sends to /api/commerce/reconcile');
  end if;
end
$vault$;

comment on table public.commerce_job_runs is 'One row per scheduled commerce job run: lease, outcome and counts. Service role only.';
