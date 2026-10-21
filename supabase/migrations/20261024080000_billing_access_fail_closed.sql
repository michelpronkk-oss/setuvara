-- One rule for paid access, in the app and the database.
--
-- The app (subscriptionHasAccess in src/lib/billing/state.ts) fails closed: an active subscription
-- grants its plan only while its period end is a real future date, so incomplete or stale provider
-- state never grants paid access indefinitely. The database granted any active, non-cancelling
-- row regardless of its period end, so the two could disagree: the studio said Free while database
-- limits said Plus. This makes the database follow the app's rule. Rows written by the Dodo
-- webhook always carry a future period end, so current members are unaffected.

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
    when p_status = 'active' then coalesce(p_period_end > pg_catalog.statement_timestamp(), false)
    when p_status = 'past_due' then coalesce(p_past_due_ends_at > pg_catalog.statement_timestamp(), false)
    else false
  end
$$;
