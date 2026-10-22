-- Verified Revenue: Paddle Billing joins Stripe, RevenueCat and Dodo Payments as a provider.
set lock_timeout = '5s';

alter table public.revenue_connections drop constraint revenue_connections_provider_check;
alter table public.revenue_connections
  add constraint revenue_connections_provider_check check (provider in ('stripe','revenuecat','dodo','paddle'));
