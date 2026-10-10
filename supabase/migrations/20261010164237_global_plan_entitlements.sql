-- Branding removal is not a shipped plan capability. Keep the legacy result
-- column for API compatibility, but never grant it based on paid membership.
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
    false as remove_setuvara_branding
  from public.profiles p
  left join public.billing_subscriptions s on s.user_id = p.id
  where p.username = pg_catalog.lower(pg_catalog.btrim(p_username))
    and p.is_published = true
  group by p.id
$$;

revoke all on function public.get_public_profile_billing_entitlements(text) from public;
grant execute on function public.get_public_profile_billing_entitlements(text) to anon, authenticated;

comment on function public.get_public_profile_billing_entitlements(text) is
  'Intentional SECURITY DEFINER: exposes only active paid-member badge and a compatibility false for attribution removal on published profiles. No billing rows, identifiers, or dates are returned.';
