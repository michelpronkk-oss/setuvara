-- Creator Commerce: sell digital products and services from a Creator page,
-- paid to the creator's own payment-provider account (Stripe Connect first).
--
-- This extends the provider-neutral creator foundation (20261012220000) instead
-- of adding a second commerce system:
--   creator_monetization_accounts  seller terms, Setuvara-side suspension
--   creator_payout_accounts        the seller's provider account and its live state
--   creator_offers                 products (digital, service, booking, external)
--   creator_orders                 one row per checkout or free claim (guests allowed)
--   creator_payment_events         webhook receipts, once per provider event
--   creator_ledger_entries         append-only money movements per creator
--   creator_payouts                provider payouts, mirrored for display
--   creator_fee_policies           versioned platform fee rules
-- New: product files and private storage, download links, refunds, disputes,
-- daily product stats. Every money or status write goes through service-role
-- functions called from server routes; creators read their own rows only.
-- Nothing here turns on payments: the app keeps checkout closed until
-- COMMERCE_ENABLED is set and a provider key is configured.

-- ------------------------------------------------------------------ storage

-- Product covers and product files. Private: covers are signed for public pages
-- by the server, files are only ever handed out through a download link.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creator-commerce', 'creator-commerce', false, 524288000, null)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "Creators read their own commerce files" on storage.objects for select to authenticated
  using (bucket_id = 'creator-commerce' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Creators upload their own commerce files" on storage.objects for insert to authenticated
  with check (bucket_id = 'creator-commerce' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] in ('cover', 'file'));
create policy "Creators delete their own commerce files" on storage.objects for delete to authenticated
  using (bucket_id = 'creator-commerce' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ------------------------------------------------------------------ seller accounts

alter table public.creator_payout_accounts
  add column country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add column default_currency text check (default_currency is null or default_currency ~ '^[A-Z]{3}$'),
  add column card_payments_status text not null default 'inactive' check (card_payments_status in ('inactive','pending','active','unrequested')),
  add column transfers_status text not null default 'inactive' check (transfers_status in ('inactive','pending','active','unrequested')),
  add column requirements_currently_due text[] not null default '{}' check (cardinality(requirements_currently_due) <= 200),
  add column requirements_past_due text[] not null default '{}' check (cardinality(requirements_past_due) <= 200),
  add column requirements_pending text[] not null default '{}' check (cardinality(requirements_pending) <= 200),
  add column requirements_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(requirements_errors) = 'array'),
  add column disabled_reason text check (disabled_reason is null or char_length(disabled_reason) <= 120),
  add column current_deadline timestamptz,
  add column livemode boolean not null default false,
  add column synced_at timestamptz,
  add column disconnected_at timestamptz;

comment on column public.creator_payout_accounts.provider_account_id is 'The seller''s account id at the provider (Stripe acct_…). An identifier, not a credential.';
comment on column public.creator_payout_accounts.charges_enabled is 'Copied from the provider on every sync; never set from a browser redirect.';

-- Checkout opens only for a seller who accepted Setuvara's seller terms, is not
-- suspended by Setuvara, and whose provider account can take card payments now.
-- Payouts can be paused by the provider while sales continue; the studio says so.
create or replace function private.creator_monetization_enabled_for_user(p_user_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $function$
begin
  return exists(select 1 from public.creator_monetization_accounts a
    where a.user_id=p_user_id and a.application_status='approved' and a.terms_version is not null
      and a.terms_accepted_at is not null and a.suspended_at is null)
    and exists(select 1 from public.creator_payout_accounts pa where pa.creator_user_id=p_user_id
      and pa.disconnected_at is null and pa.charges_enabled and pa.details_submitted
      and pa.card_payments_status='active' and pa.disabled_reason is null);
end;
$function$;

-- ------------------------------------------------------------------ products

alter table public.creator_offers drop constraint creator_offers_unit_amount_minor_check;
alter table public.creator_offers
  add constraint creator_offers_unit_amount_minor_check check (unit_amount_minor >= 0 and unit_amount_minor <= 100000000000),
  -- Only digital products can be free; everything else has a price.
  add constraint creator_offers_free_shape_check check (unit_amount_minor > 0 or offer_type = 'digital'),
  add column cover_path text check (cover_path is null or char_length(cover_path) <= 300),
  add column gallery_paths text[] not null default '{}' check (cardinality(gallery_paths) <= 6),
  add column delivery_note text not null default '' check (char_length(delivery_note) <= 1000),
  add column quantity_limit integer check (quantity_limit is null or quantity_limit between 1 and 100000),
  add column download_days integer default 30 check (download_days is null or download_days between 1 and 3650),
  add column download_limit integer not null default 10 check (download_limit between 1 and 100);

comment on column public.creator_offers.cover_path is 'creator-commerce object under <owner>/cover/. Signed by the server for public pages.';
comment on column public.creator_offers.download_days is 'Days a buyer''s download link works. Null keeps it working until a refund.';

create table public.creator_offer_files (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.creator_offers(id) on delete cascade,
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 1 and 300),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 160),
  content_type text not null default 'application/octet-stream' check (char_length(content_type) <= 120),
  size_bytes bigint not null check (size_bytes between 1 and 524288000),
  sort_order integer not null default 0 check (sort_order between 0 and 100),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  foreign key (creator_user_id, offer_id) references public.creator_offers(creator_user_id, id) on delete cascade
);
create index creator_offer_files_offer_idx on public.creator_offer_files (offer_id, sort_order);
alter table public.creator_offer_files enable row level security;
revoke all on public.creator_offer_files from public, anon, authenticated;
grant select, insert, delete on public.creator_offer_files to authenticated;
grant all on public.creator_offer_files to service_role;
create policy creator_offer_files_owner_read on public.creator_offer_files for select to authenticated
  using (creator_user_id = (select auth.uid()));
create policy creator_offer_files_owner_insert on public.creator_offer_files for insert to authenticated
  with check (creator_user_id = (select auth.uid()));
create policy creator_offer_files_owner_delete on public.creator_offer_files for delete to authenticated
  using (creator_user_id = (select auth.uid()));

-- A file row must point at an object its owner uploaded under <owner>/file/.
create function private.validate_creator_offer_file() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if tg_op = 'DELETE' then
    if exists(select 1 from public.creator_offers o where o.id=old.offer_id and o.status='active' and o.offer_type='digital')
       and not exists(select 1 from public.creator_offer_files f where f.offer_id=old.offer_id and f.id<>old.id) then
      raise exception using errcode='23514', message='last_file_of_live_product';
    end if;
    return old;
  end if;
  if (storage.foldername(new.storage_path))[1] is distinct from new.creator_user_id::text
     or (storage.foldername(new.storage_path))[2] is distinct from 'file'
     or not exists(select 1 from storage.objects s where s.bucket_id='creator-commerce' and s.name=new.storage_path) then
    raise exception using errcode='42501', message='file_not_owned';
  end if;
  if (select count(*) from public.creator_offer_files f where f.offer_id=new.offer_id) >= 20 then
    raise exception using errcode='23514', message='too_many_files';
  end if;
  return new;
end;
$function$;
create trigger creator_offer_files_validate before insert or delete on public.creator_offer_files
  for each row execute function private.validate_creator_offer_file();

-- What a live offer needs before it can show on a page and sell.
create or replace function private.require_creator_monetization_for_active_offer() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if new.cover_path is not null and ((storage.foldername(new.cover_path))[1] is distinct from new.creator_user_id::text
       or (storage.foldername(new.cover_path))[2] is distinct from 'cover') then
    raise exception using errcode='42501', message='cover_not_owned';
  end if;
  if exists(select 1 from pg_catalog.unnest(new.gallery_paths) g(path)
      where (storage.foldername(g.path))[1] is distinct from new.creator_user_id::text or (storage.foldername(g.path))[2] is distinct from 'cover') then
    raise exception using errcode='42501', message='cover_not_owned';
  end if;
  if new.status <> 'active' or new.offer_type = 'external' then return new; end if;
  if new.kind <> 'one_time' then
    raise exception using errcode='23514', message='memberships_not_available';
  end if;
  if new.offer_type = 'physical' then
    raise exception using errcode='23514', message='physical_not_available';
  end if;
  if new.currency not in ('EUR','USD','GBP') then
    raise exception using errcode='23514', message='currency_not_supported';
  end if;
  if new.unit_amount_minor > 0 and new.unit_amount_minor < (case new.currency when 'GBP' then 30 else 50 end) then
    raise exception using errcode='23514', message='price_below_minimum';
  end if;
  if new.offer_type = 'digital' and not exists(select 1 from public.creator_offer_files f where f.offer_id=new.id) then
    raise exception using errcode='23514', message='product_needs_file';
  end if;
  if new.unit_amount_minor > 0 and not private.creator_monetization_enabled_for_user(new.creator_user_id) then
    raise exception using errcode='42501', message='Creator monetization approval is required for active offers';
  end if;
  return new;
end;
$function$;
drop trigger if exists creator_offers_require_monetization on public.creator_offers;
create trigger creator_offers_require_monetization before insert or update on public.creator_offers
  for each row execute function private.require_creator_monetization_for_active_offer();

-- Whether a live offer can be shown: external links always; free digital
-- products with a file; paid ones only while the seller can take payments.
create function private.creator_offer_sellable(p_offer public.creator_offers)
returns boolean language sql stable security definer set search_path='' as $function$
  select p_offer.status='active' and (
    p_offer.offer_type='external'
    or (p_offer.offer_type in ('digital','service','booking') and p_offer.kind='one_time'
      and (p_offer.offer_type<>'digital' or exists(select 1 from public.creator_offer_files f where f.offer_id=p_offer.id))
      and (p_offer.unit_amount_minor=0 or private.creator_monetization_enabled_for_user(p_offer.creator_user_id))))
$function$;
revoke all on function private.creator_offer_sellable(public.creator_offers) from public, anon, authenticated;

create or replace function public.creator_offer_is_public(p_creator_user_id uuid, p_offer_type text)
returns boolean language sql stable security definer set search_path='' as $function$
  select exists (select 1 from public.profile_modes m join public.profiles p on p.id=m.profile_id
    where m.profile_id=p_creator_user_id and m.slug='creator' and m.is_enabled and p.is_published)
$function$;
-- Visitors read a live offer only when it can be shown. The decision runs in a
-- definer function so visitor roles never need the private schema.
create function public.creator_offer_listed(p_offer_id uuid)
returns boolean language sql stable security definer set search_path='' as $function$
  select exists(select 1 from public.creator_offers o where o.id=p_offer_id
    and public.creator_offer_is_public(o.creator_user_id, o.offer_type) and private.creator_offer_sellable(o))
$function$;
revoke all on function public.creator_offer_listed(uuid) from public;
grant execute on function public.creator_offer_listed(uuid) to anon, authenticated;
drop policy if exists creator_offers_public_active on public.creator_offers;
create policy creator_offers_public_active on public.creator_offers for select to anon, authenticated
  using (status = 'active' and public.creator_offer_listed(id));

create or replace function public.get_creator_public_summary(p_username text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object(
    'creator_user_id',p.id,
    'follower_count',(select count(*) from public.creator_follows f where f.creator_user_id=p.id),
    'is_following',case when auth.uid() is null then false else exists(select 1 from public.creator_follows f where f.creator_user_id=p.id and f.follower_user_id=auth.uid()) end,
    'offers',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'kind',o.kind,'offer_type',o.offer_type,'external_url',o.external_url,'title',o.title,'description',o.description,'currency',o.currency,'unit_amount_minor',o.unit_amount_minor) order by o.sort_order, o.created_at desc)
      from public.creator_offers o where o.creator_user_id=p.id and private.creator_offer_sellable(o)),'[]'::jsonb),
    'drops',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'profile_block_id',d.profile_block_id,'title',d.title,'status','live','starts_at',d.starts_at,'ends_at',d.ends_at,'offer_id',d.offer_id))
      from public.creator_drops d where d.creator_user_id=p.id
        and d.status in ('live','scheduled')
        and (d.starts_at is null or d.starts_at<=pg_catalog.statement_timestamp())
        and (d.ends_at is null or d.ends_at>pg_catalog.statement_timestamp())),'[]'::jsonb),
    'locked_content',coalesce((select jsonb_agg(jsonb_build_object('profile_block_id',r.profile_block_id,'access_level',r.access_level,'offer_id',r.offer_id,'teaser_title',r.teaser_title,'teaser_text',r.teaser_text,'teaser_image_url',r.teaser_image_url,'is_accessible',public.can_view_creator_block(r.profile_block_id)))
      from public.creator_content_rules r join public.profile_blocks b on b.id=r.profile_block_id
      where r.creator_user_id=p.id and r.access_level<>'public' and b.is_visible
        and public.creator_block_teaser_available(b.id)),'[]'::jsonb)
  )
  from public.profiles p join public.profile_modes m on m.profile_id=p.id
  where p.username=lower(btrim(p_username)) and p.is_published and m.slug='creator' and m.is_enabled;
$function$;

-- ------------------------------------------------------------------ fee rules

-- Versioned rules, newest effective row wins. A plan-specific rule beats the
-- all-plans rule for the same currency. No rule means no platform fee.
alter table public.creator_fee_policies
  add column plan_code text check (plan_code is null or plan_code in ('free','plus','pro')),
  add column fixed_fee_minor bigint not null default 0 check (fixed_fee_minor between 0 and 100000),
  add column note text not null default '' check (char_length(note) <= 200);

create function private.commerce_fee_policy(p_user uuid, p_currency text)
returns table(policy_id uuid, fee_bps integer, fixed_fee_minor bigint)
language sql stable security definer set search_path='' as $function$
  select f.id, f.platform_fee_bps, f.fixed_fee_minor from public.creator_fee_policies f
  where f.currency=p_currency and f.effective_from<=pg_catalog.statement_timestamp()
    and (f.effective_until is null or f.effective_until>pg_catalog.statement_timestamp())
    and (f.plan_code is null or f.plan_code=private.member_plan(p_user))
  order by (f.plan_code is not null) desc, f.effective_from desc limit 1
$function$;
revoke all on function private.commerce_fee_policy(uuid,text) from public, anon, authenticated;

-- ------------------------------------------------------------------ orders

alter table public.creator_orders alter column buyer_user_id drop not null;
alter table public.creator_orders drop constraint creator_orders_gross_amount_minor_check;
alter table public.creator_orders drop constraint creator_orders_status_check;
alter table public.creator_orders
  add constraint creator_orders_gross_amount_minor_check check (gross_amount_minor >= 0),
  add constraint creator_orders_status_check check (status in ('pending','processing','paid','failed','cancelled','expired','refunded','partially_refunded','disputed','charged_back')),
  add column order_kind text not null default 'purchase' check (order_kind in ('purchase','free_claim')),
  add column offer_title text not null default '' check (char_length(offer_title) <= 120),
  add column offer_type text not null default 'digital' check (offer_type in ('digital','booking','service')),
  add column buyer_email text check (buyer_email is null or char_length(buyer_email) between 3 and 254),
  add column buyer_name text check (buyer_name is null or char_length(buyer_name) <= 120),
  add column buyer_country text check (buyer_country is null or buyer_country ~ '^[A-Z]{2}$'),
  add column fee_policy_id uuid references public.creator_fee_policies(id) on delete restrict,
  add column platform_fee_fixed_minor bigint not null default 0 check (platform_fee_fixed_minor >= 0),
  add column provider_account_id text check (provider_account_id is null or char_length(provider_account_id) <= 200),
  add column provider_checkout_id text check (provider_checkout_id is null or char_length(provider_checkout_id) <= 200),
  add column checkout_url text check (checkout_url is null or (char_length(checkout_url) <= 2048 and checkout_url ~ '^https://')),
  add column livemode boolean not null default false,
  add column expires_at timestamptz,
  add column failure_code text check (failure_code is null or failure_code ~ '^[a-z0-9_]{1,80}$'),
  add column provider_fee_amount_minor bigint check (provider_fee_amount_minor is null or provider_fee_amount_minor >= 0),
  add column amount_refunded_minor bigint not null default 0 check (amount_refunded_minor >= 0),
  add column fulfillment_status text not null default 'not_required' check (fulfillment_status in ('not_required','pending','delivered','failed')),
  add column delivered_at timestamptz,
  add column delivery_attempts integer not null default 0 check (delivery_attempts between 0 and 1000),
  add column buyer_ip_hash text check (buyer_ip_hash is null or char_length(buyer_ip_hash) <= 128),
  add constraint creator_orders_buyer_present_check check (buyer_user_id is not null or buyer_email is not null),
  add constraint creator_orders_refund_bound_check check (amount_refunded_minor <= gross_amount_minor),
  add constraint creator_orders_free_shape_check check ((order_kind='free_claim') = (gross_amount_minor=0));
create unique index creator_orders_offer_idempotency_uidx on public.creator_orders (offer_id, idempotency_key);
create unique index creator_orders_provider_checkout_uidx on public.creator_orders (provider, provider_checkout_id) where provider_checkout_id is not null;
create index creator_orders_ip_recent_idx on public.creator_orders (buyer_ip_hash, created_at desc) where buyer_ip_hash is not null;
create index creator_orders_offer_status_idx on public.creator_orders (offer_id, status);
create index creator_orders_buyer_email_idx on public.creator_orders (creator_user_id, lower(buyer_email));

comment on column public.creator_orders.creator_net_amount_minor is 'Gross minus the platform fee, fixed at checkout. Processing fees arrive later in provider_fee_amount_minor and the ledger.';
comment on column public.creator_orders.buyer_ip_hash is 'Salted hash for abuse limits only; cleared after 30 days by commerce_purge().';

-- The checkout snapshot never changes after creation.
create or replace function private.protect_creator_order_snapshot() returns trigger language plpgsql set search_path='' as $function$
begin
  if (new.creator_user_id,new.buyer_user_id,new.offer_id,new.currency,new.gross_amount_minor,new.platform_fee_bps,
      new.platform_fee_amount_minor,new.payment_fee_amount_minor,new.creator_net_amount_minor,new.idempotency_key,new.created_at,
      new.order_kind,new.offer_title,new.offer_type,new.buyer_email,new.fee_policy_id,new.platform_fee_fixed_minor,new.provider_account_id,new.livemode)
     is distinct from
     (old.creator_user_id,old.buyer_user_id,old.offer_id,old.currency,old.gross_amount_minor,old.platform_fee_bps,
      old.platform_fee_amount_minor,old.payment_fee_amount_minor,old.creator_net_amount_minor,old.idempotency_key,old.created_at,
      old.order_kind,old.offer_title,old.offer_type,old.buyer_email,old.fee_policy_id,old.platform_fee_fixed_minor,old.provider_account_id,old.livemode) then
    raise exception using errcode='23514',message='Creator order snapshots are immutable';
  end if;
  return new;
end;
$function$;

-- Creators and signed-in buyers read orders; the IP hash stays server-side.
revoke select on public.creator_orders from authenticated;
grant select (id, creator_user_id, buyer_user_id, offer_id, currency, gross_amount_minor, platform_fee_bps, platform_fee_amount_minor,
  payment_fee_amount_minor, creator_net_amount_minor, status, provider, provider_payment_id, created_at, paid_at, refunded_at, updated_at,
  order_kind, offer_title, offer_type, buyer_email, buyer_name, buyer_country, platform_fee_fixed_minor, livemode, expires_at, failure_code,
  provider_fee_amount_minor, amount_refunded_minor, fulfillment_status, delivered_at, delivery_attempts) on public.creator_orders to authenticated;

-- ------------------------------------------------------------------ delivery

create table public.creator_download_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.creator_orders(id) on delete cascade,
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz,
  max_downloads integer not null check (max_downloads between 1 and 1000),
  download_count integer not null default 0 check (download_count >= 0),
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp()
);
create index creator_download_links_order_idx on public.creator_download_links (order_id, created_at desc);
alter table public.creator_download_links enable row level security;
revoke all on public.creator_download_links from public, anon, authenticated;
grant select (id, order_id, creator_user_id, expires_at, max_downloads, download_count, revoked_at, last_used_at, created_at) on public.creator_download_links to authenticated;
grant all on public.creator_download_links to service_role;
create policy creator_download_links_owner_read on public.creator_download_links for select to authenticated
  using (creator_user_id = (select auth.uid()));

-- ------------------------------------------------------------------ refunds and disputes

create table public.creator_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.creator_orders(id) on delete restrict,
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{1,39}$'),
  provider_refund_id text not null check (char_length(provider_refund_id) between 1 and 200),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('pending','requires_action','succeeded','failed','canceled')),
  platform_fee_refunded_minor bigint not null default 0 check (platform_fee_refunded_minor >= 0),
  reason text check (reason is null or reason ~ '^[a-z_]{1,60}$'),
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (provider, provider_refund_id)
);
create index creator_refunds_order_idx on public.creator_refunds (order_id);
create trigger creator_refunds_set_updated_at before update on public.creator_refunds for each row execute function private.set_updated_at();
alter table public.creator_refunds enable row level security;
revoke all on public.creator_refunds from public, anon, authenticated;
grant select on public.creator_refunds to authenticated;
grant all on public.creator_refunds to service_role;
create policy creator_refunds_owner_read on public.creator_refunds for select to authenticated using (creator_user_id = (select auth.uid()));

create table public.creator_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.creator_orders(id) on delete restrict,
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{1,39}$'),
  provider_dispute_id text not null check (char_length(provider_dispute_id) between 1 and 200),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('warning_needs_response','warning_under_review','warning_closed','needs_response','under_review','won','lost','prevented')),
  reason text check (reason is null or reason ~ '^[a-z_]{1,60}$'),
  evidence_due_by timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (provider, provider_dispute_id)
);
create index creator_disputes_order_idx on public.creator_disputes (order_id);
create trigger creator_disputes_set_updated_at before update on public.creator_disputes for each row execute function private.set_updated_at();
alter table public.creator_disputes enable row level security;
revoke all on public.creator_disputes from public, anon, authenticated;
grant select on public.creator_disputes to authenticated;
grant all on public.creator_disputes to service_role;
create policy creator_disputes_owner_read on public.creator_disputes for select to authenticated using (creator_user_id = (select auth.uid()));

-- ------------------------------------------------------------------ events, payouts, stats

alter table public.creator_payment_events
  add column account_id text check (account_id is null or char_length(account_id) <= 200),
  add column object_id text check (object_id is null or char_length(object_id) <= 200),
  add column livemode boolean not null default false,
  add column attempts integer not null default 0 check (attempts between 0 and 1000),
  add column provider_created_at timestamptz;
grant all on public.creator_payment_events to service_role;

alter table public.creator_payouts
  add column arrival_date timestamptz,
  add column failure_code text check (failure_code is null or failure_code ~ '^[a-z0-9_]{1,80}$');

create table public.creator_offer_daily_stats (
  offer_id uuid not null references public.creator_offers(id) on delete cascade,
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  views integer not null default 0 check (views >= 0),
  checkout_starts integer not null default 0 check (checkout_starts >= 0),
  primary key (offer_id, day)
);
create index creator_offer_daily_stats_owner_idx on public.creator_offer_daily_stats (creator_user_id, day desc);
alter table public.creator_offer_daily_stats enable row level security;
revoke all on public.creator_offer_daily_stats from public, anon, authenticated;
grant select on public.creator_offer_daily_stats to authenticated;
grant all on public.creator_offer_daily_stats to service_role;
create policy creator_offer_daily_stats_owner_read on public.creator_offer_daily_stats for select to authenticated using (creator_user_id = (select auth.uid()));

-- ------------------------------------------------------------------ service functions
-- Called only by server routes with the service role, after the route has
-- verified the caller (a signed webhook, a signed-in owner, or a rate-limited
-- visitor). Each one re-checks the facts it depends on.

-- Seller account state, copied from the provider's own account object.
create function public.commerce_sync_seller(
  p_user uuid, p_provider text, p_account_id text, p_country text, p_default_currency text,
  p_charges_enabled boolean, p_payouts_enabled boolean, p_details_submitted boolean,
  p_card_payments text, p_transfers text, p_currently_due text[], p_past_due text[], p_pending text[],
  p_errors jsonb, p_disabled_reason text, p_deadline timestamptz, p_livemode boolean, p_disconnected boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_row public.creator_payout_accounts; v_status text; v_kyc text;
begin
  if exists(select 1 from public.creator_payout_accounts pa where pa.provider=p_provider and pa.provider_account_id=p_account_id and pa.creator_user_id<>p_user) then
    raise exception using errcode='42501', message='account_owned_by_another_member';
  end if;
  v_status := case
    when p_disconnected then 'disabled'
    when p_disabled_reason is not null and p_disabled_reason like 'rejected%' then 'disabled'
    when p_charges_enabled and p_payouts_enabled and coalesce(cardinality(p_past_due),0)=0 then 'enabled'
    when p_charges_enabled or p_disabled_reason is not null or coalesce(cardinality(p_past_due),0)>0 then 'restricted'
    else 'pending' end;
  insert into public.creator_payout_accounts as pa (creator_user_id, provider, provider_account_id, status, charges_enabled, payouts_enabled,
    details_submitted, country_code, default_currency, card_payments_status, transfers_status, requirements_currently_due,
    requirements_past_due, requirements_pending, requirements_errors, disabled_reason, current_deadline, livemode, synced_at, disconnected_at)
  values (p_user, p_provider, p_account_id, v_status, p_charges_enabled, p_payouts_enabled, p_details_submitted, p_country,
    upper(p_default_currency), coalesce(p_card_payments,'inactive'), coalesce(p_transfers,'inactive'), coalesce(p_currently_due,'{}'),
    coalesce(p_past_due,'{}'), coalesce(p_pending,'{}'), coalesce(p_errors,'[]'::jsonb), p_disabled_reason, p_deadline, p_livemode,
    pg_catalog.statement_timestamp(), case when p_disconnected then pg_catalog.statement_timestamp() end)
  on conflict (creator_user_id, provider) do update set
    provider_account_id=excluded.provider_account_id, status=excluded.status, charges_enabled=excluded.charges_enabled,
    payouts_enabled=excluded.payouts_enabled, details_submitted=excluded.details_submitted, country_code=excluded.country_code,
    default_currency=excluded.default_currency, card_payments_status=excluded.card_payments_status, transfers_status=excluded.transfers_status,
    requirements_currently_due=excluded.requirements_currently_due, requirements_past_due=excluded.requirements_past_due,
    requirements_pending=excluded.requirements_pending, requirements_errors=excluded.requirements_errors,
    disabled_reason=excluded.disabled_reason, current_deadline=excluded.current_deadline, livemode=excluded.livemode,
    synced_at=excluded.synced_at, disconnected_at=excluded.disconnected_at
  returning * into v_row;

  -- The Setuvara-side record follows the provider. Approval is automatic once
  -- the provider enables charges; a suspension or rejection by Setuvara stays.
  v_kyc := case when v_status='disabled' then 'restricted' when p_charges_enabled and p_details_submitted then 'verified'
    when p_disabled_reason is not null then 'restricted' when p_details_submitted then 'pending' else 'not_started' end;
  update public.creator_monetization_accounts a set
    provider=p_provider, provider_account_id=p_account_id, country_code=coalesce(p_country, a.country_code),
    kyc_status=v_kyc,
    payout_status=case when v_status='disabled' then 'disabled' when p_payouts_enabled then 'enabled' when p_details_submitted then 'restricted' else 'pending' end,
    application_status=case when a.application_status in ('applied','under_review') and p_charges_enabled and p_details_submitted then 'approved' else a.application_status end,
    approved_at=case when a.application_status in ('applied','under_review') and p_charges_enabled and p_details_submitted then pg_catalog.statement_timestamp() else a.approved_at end,
    reviewed_at=case when a.application_status in ('applied','under_review') and p_charges_enabled and p_details_submitted then pg_catalog.statement_timestamp() else a.reviewed_at end,
    monetization_status=case when a.suspended_at is not null then 'suspended' when p_charges_enabled and p_details_submitted and v_status<>'disabled' then 'active' else 'pending' end
  where a.user_id=p_user;
  return jsonb_build_object('status', v_row.status, 'charges_enabled', v_row.charges_enabled, 'payouts_enabled', v_row.payouts_enabled,
    'can_sell', private.creator_monetization_enabled_for_user(p_user));
end;
$function$;

-- Opens an order for a paid checkout. Price, fee and seller come from the
-- database; the browser only names the product.
create function public.commerce_begin_checkout(
  p_offer_id uuid, p_buyer_user uuid, p_buyer_email text, p_buyer_name text, p_idempotency_key text,
  p_ip_hash text, p_provider text, p_livemode boolean)
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

  select * into v_policy from private.commerce_fee_policy(v_offer.creator_user_id, v_offer.currency);
  v_fee := case when v_policy.policy_id is null then 0
    else pg_catalog.floor(v_offer.unit_amount_minor * v_policy.fee_bps / 10000.0)::bigint + v_policy.fixed_fee_minor end;
  if v_fee >= v_offer.unit_amount_minor then raise exception using errcode='P0001', message='fee_exceeds_price'; end if;

  insert into public.creator_orders (creator_user_id, buyer_user_id, offer_id, currency, gross_amount_minor, platform_fee_bps,
    platform_fee_amount_minor, payment_fee_amount_minor, creator_net_amount_minor, status, provider, idempotency_key, order_kind,
    offer_title, offer_type, buyer_email, buyer_name, fee_policy_id, platform_fee_fixed_minor, provider_account_id, livemode,
    expires_at, fulfillment_status, buyer_ip_hash)
  values (v_offer.creator_user_id, p_buyer_user, v_offer.id, v_offer.currency, v_offer.unit_amount_minor, coalesce(v_policy.fee_bps,0),
    v_fee, 0, v_offer.unit_amount_minor - v_fee, 'pending', p_provider, p_idempotency_key, 'purchase', v_offer.title, v_offer.offer_type,
    v_email, nullif(left(btrim(coalesce(p_buyer_name,'')),120),''), v_policy.policy_id, coalesce(v_policy.fixed_fee_minor,0),
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

create function public.commerce_attach_checkout(p_order_id uuid, p_checkout_id text, p_checkout_url text, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path='' as $function$
begin
  update public.creator_orders set provider_checkout_id=p_checkout_id, checkout_url=p_checkout_url, expires_at=p_expires_at
  where id=p_order_id and status='pending' and (provider_checkout_id is null or provider_checkout_id=p_checkout_id);
  if not found then raise exception using errcode='P0001', message='order_not_pending'; end if;
end;
$function$;

-- A free product: no payment, delivered by email to whoever claims it.
create function public.commerce_claim_free(p_offer_id uuid, p_buyer_user uuid, p_buyer_email text, p_buyer_name text, p_idempotency_key text, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_offer public.creator_offers; v_order public.creator_orders; v_email text := lower(btrim(coalesce(p_buyer_email,'')));
begin
  if p_idempotency_key !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception using errcode='22023', message='invalid_request'; end if;
  select * into v_order from public.creator_orders o where o.offer_id=p_offer_id and o.idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('order_id', v_order.id, 'existing', true, 'status', v_order.status); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception using errcode='22023', message='invalid_email'; end if;
  select * into v_offer from public.creator_offers o where o.id=p_offer_id;
  if not found or not private.creator_offer_sellable(v_offer) or v_offer.offer_type<>'digital' or v_offer.unit_amount_minor<>0
     or not public.creator_offer_is_public(v_offer.creator_user_id, v_offer.offer_type) then
    raise exception using errcode='P0001', message='offer_unavailable';
  end if;
  if p_buyer_user is not null and p_buyer_user=v_offer.creator_user_id then raise exception using errcode='P0001', message='own_offer'; end if;
  if (p_ip_hash is not null and (select count(*) from public.creator_orders o where o.buyer_ip_hash=p_ip_hash
        and o.created_at > pg_catalog.statement_timestamp() - interval '1 hour') >= 20)
     or (select count(*) from public.creator_orders o where o.offer_id=v_offer.id and lower(o.buyer_email)=v_email
        and o.created_at > pg_catalog.statement_timestamp() - interval '1 day') >= 3 then
    raise exception using errcode='P0001', message='rate_limited';
  end if;
  insert into public.creator_orders (creator_user_id, buyer_user_id, offer_id, currency, gross_amount_minor, platform_fee_bps,
    platform_fee_amount_minor, payment_fee_amount_minor, creator_net_amount_minor, status, idempotency_key, order_kind, offer_title,
    offer_type, buyer_email, buyer_name, paid_at, fulfillment_status, buyer_ip_hash)
  values (v_offer.creator_user_id, p_buyer_user, v_offer.id, v_offer.currency, 0, 0, 0, 0, 0, 'paid', p_idempotency_key, 'free_claim',
    v_offer.title, 'digital', v_email, nullif(left(btrim(coalesce(p_buyer_name,'')),120),''), pg_catalog.statement_timestamp(), 'pending', p_ip_hash)
  returning * into v_order;
  return jsonb_build_object('order_id', v_order.id, 'existing', false, 'status', v_order.status);
end;
$function$;

-- Records a verified webhook event once. Returns false when it was already handled.
create function public.commerce_receive_event(p_provider text, p_event_id text, p_type text, p_account text, p_object text, p_livemode boolean, p_created timestamptz)
returns boolean language plpgsql security definer set search_path='' as $function$
declare v_status text;
begin
  insert into public.creator_payment_events (provider, provider_event_id, event_type, account_id, object_id, livemode, provider_created_at, processing_status, attempts)
    values (p_provider, p_event_id, left(p_type,120), p_account, p_object, p_livemode, p_created, 'processing', 1)
    on conflict (provider, provider_event_id) do nothing;
  if found then return true; end if;
  -- A retry of an event that failed (or stalled) runs again; a processed one does not.
  update public.creator_payment_events set processing_status='processing', attempts=attempts+1
    where provider=p_provider and provider_event_id=p_event_id
      and (processing_status='failed' or (processing_status in ('received','processing') and received_at < pg_catalog.statement_timestamp() - interval '2 minutes'))
    returning processing_status into v_status;
  return v_status is not null;
end;
$function$;

create function public.commerce_finish_event(p_provider text, p_event_id text, p_status text, p_error text)
returns void language sql security definer set search_path='' as $function$
  update public.creator_payment_events set processing_status=p_status, processed_at=pg_catalog.statement_timestamp(),
    safe_error_code=case when p_error ~ '^[a-z0-9_]{1,80}$' then p_error end
  where provider=p_provider and provider_event_id=p_event_id
$function$;

-- Payment confirmed by the provider. Checks amount, currency and seller
-- against the order snapshot; moves it to paid once; writes the ledger once.
create function public.commerce_record_payment(p_order_id uuid, p_provider text, p_checkout_id text, p_payment_id text,
  p_amount_minor bigint, p_currency text, p_account_id text, p_application_fee_minor bigint, p_buyer_country text, p_event_id text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_order public.creator_orders;
begin
  select * into v_order from public.creator_orders where id=p_order_id for update;
  if not found then raise exception using errcode='P0001', message='order_not_found'; end if;
  if v_order.provider is distinct from p_provider or v_order.provider_account_id is distinct from p_account_id
     or (v_order.provider_checkout_id is not null and v_order.provider_checkout_id is distinct from p_checkout_id)
     or v_order.gross_amount_minor<>p_amount_minor or v_order.currency<>upper(p_currency)
     or v_order.platform_fee_amount_minor<>coalesce(p_application_fee_minor,0) then
    raise exception using errcode='P0001', message='payment_mismatch';
  end if;
  if v_order.status in ('paid','partially_refunded','refunded','disputed','charged_back') then
    return jsonb_build_object('became_paid', false, 'status', v_order.status);
  end if;
  update public.creator_orders set status='paid', paid_at=pg_catalog.statement_timestamp(), provider_checkout_id=coalesce(provider_checkout_id,p_checkout_id),
    provider_payment_id=p_payment_id, buyer_country=coalesce(buyer_country, case when p_buyer_country ~ '^[A-Z]{2}$' then p_buyer_country end), failure_code=null
  where id=p_order_id returning * into v_order;
  insert into public.creator_ledger_entries (creator_user_id, currency, entry_type, amount_minor, order_id, provider_event_id)
    values (v_order.creator_user_id, v_order.currency, 'sale', v_order.gross_amount_minor, v_order.id, p_event_id)
    on conflict do nothing;
  if v_order.platform_fee_amount_minor > 0 then
    insert into public.creator_ledger_entries (creator_user_id, currency, entry_type, amount_minor, order_id, provider_event_id)
      values (v_order.creator_user_id, v_order.currency, 'platform_fee', -v_order.platform_fee_amount_minor, v_order.id, p_event_id)
      on conflict do nothing;
  end if;
  return jsonb_build_object('became_paid', true, 'status', v_order.status, 'offer_type', v_order.offer_type);
end;
$function$;

-- The provider's processing fee, once known (charged to the seller with direct charges).
create function public.commerce_record_processing_fee(p_order_id uuid, p_fee_minor bigint, p_currency text, p_event_id text)
returns void language plpgsql security definer set search_path='' as $function$
declare v_order public.creator_orders;
begin
  select * into v_order from public.creator_orders where id=p_order_id for update;
  if not found or v_order.provider_fee_amount_minor is not null or p_fee_minor is null or p_fee_minor < 0 then return; end if;
  update public.creator_orders set provider_fee_amount_minor=p_fee_minor where id=p_order_id;
  -- The fee is in the seller's settlement currency, which can differ from the order's.
  if p_fee_minor > 0 then
    insert into public.creator_ledger_entries (creator_user_id, currency, entry_type, amount_minor, order_id, provider_event_id)
      values (v_order.creator_user_id, upper(p_currency), 'payment_fee', -p_fee_minor, v_order.id, p_event_id) on conflict do nothing;
  end if;
end;
$function$;

create function public.commerce_set_order_state(p_order_id uuid, p_status text, p_failure text)
returns text language plpgsql security definer set search_path='' as $function$
declare v_order public.creator_orders;
begin
  select * into v_order from public.creator_orders where id=p_order_id for update;
  if not found then return null; end if;
  -- Only an open order can move to processing, failed, expired or cancelled.
  if p_status not in ('processing','failed','expired','cancelled') then raise exception using errcode='22023', message='invalid_status'; end if;
  if v_order.status not in ('pending','processing') or (v_order.status='processing' and p_status='expired') then return v_order.status; end if;
  update public.creator_orders set status=p_status, failure_code=case when p_failure ~ '^[a-z0-9_]{1,80}$' then p_failure end,
    fulfillment_status=case when p_status='processing' then fulfillment_status when fulfillment_status='pending' then 'not_required' else fulfillment_status end
  where id=p_order_id;
  return p_status;
end;
$function$;

-- A refund as the provider reports it. One ledger entry per refund id, written
-- when it succeeds; a fully refunded order loses its download links.
create function public.commerce_record_refund(p_order_id uuid, p_provider text, p_refund_id text, p_amount_minor bigint, p_currency text,
  p_status text, p_fee_refunded_minor bigint, p_reason text, p_requested_by uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_order public.creator_orders; v_refund public.creator_refunds; v_was text; v_total bigint;
begin
  select * into v_order from public.creator_orders where id=p_order_id for update;
  if not found then raise exception using errcode='P0001', message='order_not_found'; end if;
  if upper(p_currency)<>v_order.currency then raise exception using errcode='P0001', message='refund_mismatch'; end if;
  select status into v_was from public.creator_refunds where provider=p_provider and provider_refund_id=p_refund_id;
  insert into public.creator_refunds as r (order_id, creator_user_id, provider, provider_refund_id, amount_minor, currency, status, platform_fee_refunded_minor, reason, requested_by)
    values (v_order.id, v_order.creator_user_id, p_provider, p_refund_id, p_amount_minor, upper(p_currency), p_status, greatest(coalesce(p_fee_refunded_minor,0),0),
      case when p_reason ~ '^[a-z_]{1,60}$' then p_reason end, p_requested_by)
    on conflict (provider, provider_refund_id) do update set status=excluded.status,
      platform_fee_refunded_minor=greatest(r.platform_fee_refunded_minor, excluded.platform_fee_refunded_minor),
      requested_by=coalesce(r.requested_by, excluded.requested_by)
    returning * into v_refund;
  if p_status='succeeded' and v_was is distinct from 'succeeded' then
    insert into public.creator_ledger_entries (creator_user_id, currency, entry_type, amount_minor, order_id, provider_event_id)
      values (v_order.creator_user_id, v_order.currency, 'refund', -p_amount_minor, v_order.id, p_refund_id) on conflict do nothing;
    if coalesce(p_fee_refunded_minor,0) > 0 then
      insert into public.creator_ledger_entries (creator_user_id, currency, entry_type, amount_minor, order_id, provider_event_id)
        values (v_order.creator_user_id, v_order.currency, 'adjustment', p_fee_refunded_minor, v_order.id, p_refund_id) on conflict do nothing;
    end if;
  end if;
  select coalesce(sum(amount_minor),0) into v_total from public.creator_refunds where order_id=v_order.id and status='succeeded';
  v_total := least(v_total, v_order.gross_amount_minor);
  update public.creator_orders set amount_refunded_minor=v_total,
    status=case when v_order.status in ('disputed','charged_back') then v_order.status
      when v_total>=gross_amount_minor and v_total>0 then 'refunded' when v_total>0 then 'partially_refunded' else status end,
    refunded_at=case when v_total>=gross_amount_minor and v_total>0 then coalesce(refunded_at, pg_catalog.statement_timestamp()) else refunded_at end
  where id=v_order.id returning * into v_order;
  if v_order.status='refunded' then
    update public.creator_download_links set revoked_at=coalesce(revoked_at, pg_catalog.statement_timestamp()) where order_id=v_order.id;
  end if;
  return jsonb_build_object('order_status', v_order.status, 'refund_status', v_refund.status, 'amount_refunded_minor', v_order.amount_refunded_minor);
end;
$function$;

create function public.commerce_record_dispute(p_order_id uuid, p_provider text, p_dispute_id text, p_amount_minor bigint, p_currency text,
  p_status text, p_reason text, p_evidence_due timestamptz)
returns text language plpgsql security definer set search_path='' as $function$
declare v_order public.creator_orders;
begin
  select * into v_order from public.creator_orders where id=p_order_id for update;
  if not found then raise exception using errcode='P0001', message='order_not_found'; end if;
  insert into public.creator_disputes as d (order_id, creator_user_id, provider, provider_dispute_id, amount_minor, currency, status, reason, evidence_due_by)
    values (v_order.id, v_order.creator_user_id, p_provider, p_dispute_id, p_amount_minor, upper(p_currency), p_status,
      case when p_reason ~ '^[a-z_]{1,60}$' then p_reason end, p_evidence_due)
    on conflict (provider, provider_dispute_id) do update set status=excluded.status, evidence_due_by=excluded.evidence_due_by, amount_minor=excluded.amount_minor;
  if p_status in ('needs_response','under_review','warning_needs_response','warning_under_review') then
    update public.creator_orders set status='disputed' where id=v_order.id and status in ('paid','partially_refunded');
  elsif p_status='lost' then
    update public.creator_orders set status='charged_back' where id=v_order.id;
    update public.creator_download_links set revoked_at=coalesce(revoked_at, pg_catalog.statement_timestamp()) where order_id=v_order.id;
    insert into public.creator_ledger_entries (creator_user_id, currency, entry_type, amount_minor, order_id, provider_event_id)
      values (v_order.creator_user_id, v_order.currency, 'chargeback', -p_amount_minor, v_order.id, p_dispute_id) on conflict do nothing;
  elsif p_status in ('won','warning_closed','prevented') then
    update public.creator_orders set status=case when amount_refunded_minor>0 then 'partially_refunded' else 'paid' end where id=v_order.id and status='disputed';
  end if;
  return (select status from public.creator_orders where id=v_order.id);
end;
$function$;

-- A new download link for a delivered order. The token itself is only ever in
-- the buyer's email; the database keeps its SHA-256.
create function public.commerce_issue_download(p_order_id uuid, p_token_hash text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_order public.creator_orders; v_offer public.creator_offers; v_link public.creator_download_links;
begin
  select * into v_order from public.creator_orders where id=p_order_id for update;
  if not found or v_order.offer_type<>'digital' or v_order.status not in ('paid','partially_refunded') then
    raise exception using errcode='P0001', message='order_not_deliverable';
  end if;
  if (select count(*) from public.creator_download_links l where l.order_id=v_order.id) >= 10 then
    raise exception using errcode='P0001', message='too_many_links';
  end if;
  select * into v_offer from public.creator_offers where id=v_order.offer_id;
  insert into public.creator_download_links (order_id, creator_user_id, token_hash, expires_at, max_downloads)
    values (v_order.id, v_order.creator_user_id, p_token_hash,
      case when v_offer.download_days is null then null else pg_catalog.statement_timestamp() + pg_catalog.make_interval(days => v_offer.download_days) end,
      v_offer.download_limit)
    returning * into v_link;
  return jsonb_build_object('link_id', v_link.id, 'expires_at', v_link.expires_at, 'max_downloads', v_link.max_downloads,
    'buyer_email', v_order.buyer_email, 'offer_title', v_order.offer_title, 'delivery_note', v_offer.delivery_note,
    'creator_user_id', v_order.creator_user_id);
end;
$function$;

create function public.commerce_mark_delivery(p_order_id uuid, p_delivered boolean)
returns void language sql security definer set search_path='' as $function$
  update public.creator_orders set delivery_attempts=delivery_attempts+1,
    fulfillment_status=case when p_delivered then 'delivered' when fulfillment_status='delivered' then 'delivered' else 'failed' end,
    delivered_at=case when p_delivered then coalesce(delivered_at, pg_catalog.statement_timestamp()) else delivered_at end
  where id=p_order_id and offer_type='digital'
$function$;

-- What a download link opens: the order's files, while the link is valid.
create function public.commerce_open_download(p_token_hash text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_link public.creator_download_links; v_order public.creator_orders; v_offer public.creator_offers;
begin
  select * into v_link from public.creator_download_links where token_hash=p_token_hash;
  if not found then return jsonb_build_object('state','not_found'); end if;
  select * into v_order from public.creator_orders where id=v_link.order_id;
  select * into v_offer from public.creator_offers where id=v_order.offer_id;
  return jsonb_build_object(
    'state', case when v_link.revoked_at is not null or v_order.status not in ('paid','partially_refunded') then 'revoked'
      when v_link.expires_at is not null and v_link.expires_at<=pg_catalog.statement_timestamp() then 'expired'
      when v_link.download_count>=v_link.max_downloads then 'used_up' else 'ok' end,
    'offer_title', v_order.offer_title, 'delivery_note', v_offer.delivery_note, 'creator_user_id', v_order.creator_user_id,
    'expires_at', v_link.expires_at, 'remaining', greatest(v_link.max_downloads-v_link.download_count,0),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'file_name',f.file_name,'size_bytes',f.size_bytes) order by f.sort_order, f.created_at)
      from public.creator_offer_files f where f.offer_id=v_order.offer_id),'[]'::jsonb));
end;
$function$;

-- Spends one download and returns the object to sign for a few seconds.
create function public.commerce_use_download(p_token_hash text, p_file_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_link public.creator_download_links; v_order public.creator_orders; v_file public.creator_offer_files;
begin
  select * into v_link from public.creator_download_links where token_hash=p_token_hash for update;
  if not found then raise exception using errcode='P0001', message='link_not_found'; end if;
  select * into v_order from public.creator_orders where id=v_link.order_id;
  if v_link.revoked_at is not null or v_order.status not in ('paid','partially_refunded') then raise exception using errcode='P0001', message='link_revoked'; end if;
  if v_link.expires_at is not null and v_link.expires_at<=pg_catalog.statement_timestamp() then raise exception using errcode='P0001', message='link_expired'; end if;
  if v_link.download_count>=v_link.max_downloads then raise exception using errcode='P0001', message='link_used_up'; end if;
  select * into v_file from public.creator_offer_files where id=p_file_id and offer_id=v_order.offer_id;
  if not found then raise exception using errcode='P0001', message='link_not_found'; end if;
  update public.creator_download_links set download_count=download_count+1, last_used_at=pg_catalog.statement_timestamp() where id=v_link.id;
  return jsonb_build_object('storage_path', v_file.storage_path, 'file_name', v_file.file_name, 'content_type', v_file.content_type);
end;
$function$;

create function public.commerce_record_payout(p_provider text, p_account_id text, p_payout_id text, p_amount_minor bigint, p_currency text,
  p_status text, p_arrival timestamptz, p_failure text)
returns void language plpgsql security definer set search_path='' as $function$
declare v_user uuid; v_status text := case p_status when 'in_transit' then 'processing' when 'canceled' then 'cancelled' else p_status end;
begin
  select creator_user_id into v_user from public.creator_payout_accounts where provider=p_provider and provider_account_id=p_account_id;
  if v_user is null or p_amount_minor <= 0 or v_status not in ('pending','processing','paid','failed','cancelled') then return; end if;
  insert into public.creator_payouts as p (creator_user_id, currency, amount_minor, status, provider, provider_payout_id, arrival_date,
      paid_at, failed_at, failure_code)
    values (v_user, upper(p_currency), p_amount_minor, v_status, p_provider, p_payout_id, p_arrival,
      case when v_status='paid' then pg_catalog.statement_timestamp() end, case when v_status='failed' then pg_catalog.statement_timestamp() end,
      case when p_failure ~ '^[a-z0-9_]{1,80}$' then p_failure end)
    on conflict (provider, provider_payout_id) do update set status=excluded.status, arrival_date=excluded.arrival_date,
      paid_at=coalesce(p.paid_at, excluded.paid_at), failed_at=coalesce(p.failed_at, excluded.failed_at), failure_code=excluded.failure_code;
end;
$function$;

create function public.commerce_count_view(p_offer_id uuid)
returns void language sql security definer set search_path='' as $function$
  insert into public.creator_offer_daily_stats as s (offer_id, creator_user_id, day, views)
    select o.id, o.creator_user_id, (pg_catalog.statement_timestamp() at time zone 'utc')::date, 1 from public.creator_offers o where o.id=p_offer_id
  on conflict (offer_id, day) do update set views = s.views + 1
$function$;

-- Retention: IP hashes go after 30 days; unpaid checkouts older than a day close.
create function public.commerce_purge()
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_ips integer; v_closed integer;
begin
  update public.creator_orders set buyer_ip_hash=null where buyer_ip_hash is not null and created_at < pg_catalog.statement_timestamp() - interval '30 days';
  get diagnostics v_ips = row_count;
  update public.creator_orders set status='expired', fulfillment_status=case when fulfillment_status='pending' then 'not_required' else fulfillment_status end
    where status='pending' and expires_at < pg_catalog.statement_timestamp() - interval '1 day';
  get diagnostics v_closed = row_count;
  return jsonb_build_object('ip_hashes_cleared', v_ips, 'stale_checkouts_closed', v_closed);
end;
$function$;

-- Platform-wide figures for the admin console. Creator sales are GMV, never
-- Setuvara revenue; Setuvara's take is the platform fee minus fees refunded.
create function public.admin_commerce_overview(p_from date, p_to date)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object(
    'by_currency', coalesce((select jsonb_agg(jsonb_build_object(
        'currency', t.currency, 'livemode', t.livemode, 'orders', t.orders, 'gmv_minor', t.gmv, 'refunds_minor', t.refunds,
        'platform_fees_minor', t.fees, 'platform_fees_refunded_minor', t.fees_refunded,
        'processing_fees_minor', t.processing, 'chargebacks_minor', t.chargebacks) order by t.livemode desc, t.gmv desc)
      from (select o.currency, o.livemode, count(*) as orders,
          coalesce(sum(o.gross_amount_minor),0) as gmv, coalesce(sum(o.amount_refunded_minor),0) as refunds,
          coalesce(sum(o.platform_fee_amount_minor),0) as fees,
          coalesce((select sum(r.platform_fee_refunded_minor) from public.creator_refunds r join public.creator_orders o2 on o2.id=r.order_id
            where r.status='succeeded' and o2.currency=o.currency and o2.livemode=o.livemode and o2.order_kind='purchase'
              and o2.paid_at::date between p_from and p_to),0) as fees_refunded,
          coalesce(sum(o.provider_fee_amount_minor),0) as processing,
          coalesce(sum(o.gross_amount_minor) filter (where o.status='charged_back'),0) as chargebacks
        from public.creator_orders o where o.order_kind='purchase' and o.paid_at is not null and o.paid_at::date between p_from and p_to
        group by o.currency, o.livemode) t), '[]'::jsonb),
    'free_claims', (select count(*) from public.creator_orders o where o.order_kind='free_claim' and o.created_at::date between p_from and p_to),
    'sellers', (select jsonb_build_object(
        'total', count(*), 'can_sell', count(*) filter (where pa.charges_enabled and pa.disconnected_at is null),
        'payouts_enabled', count(*) filter (where pa.payouts_enabled), 'action_required', count(*) filter (where cardinality(pa.requirements_past_due)>0 or pa.disabled_reason is not null),
        'test_mode', count(*) filter (where not pa.livemode))
      from public.creator_payout_accounts pa),
    'open_disputes', (select count(*) from public.creator_disputes d where d.status in ('needs_response','under_review','warning_needs_response','warning_under_review')),
    'failed_deliveries', (select count(*) from public.creator_orders o where o.fulfillment_status='failed'),
    'failed_events_7d', (select count(*) from public.creator_payment_events e where e.processing_status='failed' and e.received_at > pg_catalog.statement_timestamp() - interval '7 days'),
    'test_orders', (select count(*) from public.creator_orders o where not o.livemode and o.order_kind='purchase' and o.created_at::date between p_from and p_to)
  )
$function$;

do $grants$
declare fn text;
begin
  foreach fn in array array[
    'public.commerce_sync_seller(uuid,text,text,text,text,boolean,boolean,boolean,text,text,text[],text[],text[],jsonb,text,timestamptz,boolean,boolean)',
    'public.commerce_begin_checkout(uuid,uuid,text,text,text,text,text,boolean)',
    'public.commerce_attach_checkout(uuid,text,text,timestamptz)',
    'public.commerce_claim_free(uuid,uuid,text,text,text,text)',
    'public.commerce_receive_event(text,text,text,text,text,boolean,timestamptz)',
    'public.commerce_finish_event(text,text,text,text)',
    'public.commerce_record_payment(uuid,text,text,text,bigint,text,text,bigint,text,text)',
    'public.commerce_record_processing_fee(uuid,bigint,text,text)',
    'public.commerce_set_order_state(uuid,text,text)',
    'public.commerce_record_refund(uuid,text,text,bigint,text,text,bigint,text,uuid)',
    'public.commerce_record_dispute(uuid,text,text,bigint,text,text,text,timestamptz)',
    'public.commerce_issue_download(uuid,text)',
    'public.commerce_mark_delivery(uuid,boolean)',
    'public.commerce_open_download(text)',
    'public.commerce_use_download(text,uuid)',
    'public.commerce_record_payout(text,text,text,bigint,text,text,timestamptz,text)',
    'public.commerce_count_view(uuid)',
    'public.commerce_purge()',
    'public.admin_commerce_overview(date,date)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$grants$;

-- ------------------------------------------------------------------ owner reads

-- The seller's state for the studio, without the provider account id.
create function public.commerce_seller_status()
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object(
    'terms_accepted', exists(select 1 from public.creator_monetization_accounts a where a.user_id=auth.uid() and a.terms_accepted_at is not null),
    'suspended', exists(select 1 from public.creator_monetization_accounts a where a.user_id=auth.uid() and (a.suspended_at is not null or a.application_status in ('suspended','rejected'))),
    'can_sell', private.creator_monetization_enabled_for_user(auth.uid()),
    'plan', private.member_plan(auth.uid()),
    'fees', (select coalesce(jsonb_agg(jsonb_build_object('currency', c.code, 'fee_bps', coalesce(f.fee_bps, 0), 'fixed_fee_minor', coalesce(f.fixed_fee_minor, 0))), '[]'::jsonb)
      from (values ('EUR'),('USD'),('GBP')) c(code) left join lateral private.commerce_fee_policy(auth.uid(), c.code) f on true),
    'account', (select jsonb_build_object('provider', pa.provider, 'status', pa.status, 'charges_enabled', pa.charges_enabled,
        'payouts_enabled', pa.payouts_enabled, 'details_submitted', pa.details_submitted, 'country_code', pa.country_code,
        'default_currency', pa.default_currency, 'card_payments_status', pa.card_payments_status,
        'currently_due', pa.requirements_currently_due, 'past_due', pa.requirements_past_due, 'pending', pa.requirements_pending,
        'errors', pa.requirements_errors, 'disabled_reason', pa.disabled_reason, 'current_deadline', pa.current_deadline,
        'livemode', pa.livemode, 'synced_at', pa.synced_at, 'disconnected_at', pa.disconnected_at)
      from public.creator_payout_accounts pa where pa.creator_user_id=auth.uid() order by pa.updated_at desc limit 1))
$function$;
revoke all on function public.commerce_seller_status() from public, anon;
grant execute on function public.commerce_seller_status() to authenticated;

comment on table public.creator_offer_files is 'Private product files in the creator-commerce bucket. Buyers reach them only through commerce_use_download.';
comment on table public.creator_download_links is 'Download links sent to buyers. Only the SHA-256 of each token is stored.';
comment on table public.creator_refunds is 'Refunds as the payment provider reports them; the ledger gets one refund entry per succeeded refund.';
comment on table public.creator_disputes is 'Card disputes as the payment provider reports them. Evidence is handled in the provider dashboard.';
