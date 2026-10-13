import "server-only";

import type { CapabilityKey } from "./capabilities";
import { createBillingAdminClient } from "./admin";
import { createBillingPublicClient } from "./public-client";
import { publicProfileEntitlements } from "./entitlements";
import { hasCapability, resolveClientCapabilities } from "./capabilities";
import { readDodoConfiguration } from "./config";
import { mapConfiguredProduct } from "./products";
import { getDodoApiClient } from "./provider";
import { resolveBillingSnapshot, selectEffectiveSubscription, type BillingSnapshot, type ProviderSubscriptionRecord } from "./state";
import type { BillingInterval } from "./catalog";

export async function getUserBillingState(userId: string): Promise<BillingSnapshot> {
  const admin = createBillingAdminClient();
  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("plan_code,billing_interval,provider_status,current_period_end,cancel_at_next_billing_date,past_due_ends_at")
    .eq("user_id", userId);

  if (error) throw new Error("billing_state_unavailable");
  const records = (data ?? []) as ProviderSubscriptionRecord[];
  return resolveBillingSnapshot(records);
}

export type ScheduledPlanChange = { plan: "plus" | "pro"; interval: BillingInterval; effectiveAt: string };

/**
 * A downgrade waiting for the next renewal lives only at Dodo until it applies, so Billing
 * asks for it directly. Best effort: any failure just hides the line.
 */
export async function getScheduledPlanChange(userId: string): Promise<ScheduledPlanChange | null> {
  const config = readDodoConfiguration();
  if (!config) return null;
  try {
    const { data, error } = await createBillingAdminClient()
      .from("billing_subscriptions")
      .select("dodo_subscription_id,plan_code,billing_interval,provider_status,current_period_end,cancel_at_next_billing_date,past_due_ends_at")
      .eq("user_id", userId);
    if (error) return null;
    const current = selectEffectiveSubscription((data ?? []) as (ProviderSubscriptionRecord & { dodo_subscription_id: string })[]);
    if (!current) return null;
    const live = await getDodoApiClient().subscriptions.retrieve(current.dodo_subscription_id);
    const scheduled = live.scheduled_change;
    const target = scheduled ? mapConfiguredProduct(scheduled.product_id, config.products) : null;
    return scheduled && target ? { ...target, effectiveAt: scheduled.effective_at } : null;
  } catch {
    return null;
  }
}

export async function getUserEntitlements(userId: string, knownState?: BillingSnapshot) {
  const state = knownState ?? await getUserBillingState(userId);
  return resolveClientCapabilities(state.plan);
}

export async function userHasCapability(userId: string, capability: CapabilityKey): Promise<boolean> {
  const state = await getUserBillingState(userId);
  return hasCapability(state.plan, capability);
}

export async function requireCapability(userId: string, capability: CapabilityKey): Promise<void> {
  if (!(await userHasCapability(userId, capability))) {
    throw new Error("billing_entitlement_required");
  }
}

export async function getPublicProfileEntitlements(username: string) {
  const publicClient = createBillingPublicClient();
  const { data, error } = await publicClient.rpc("get_public_profile_billing_entitlements", {
    p_username: username,
  });
  if (error) throw new Error("public_entitlements_unavailable");

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    memberBadge: row.verified_badge === true,
    // verified_badge is true for any active paid plan, and every paid plan drops the
    // "Made with Setuvara" footer (identity.remove_attribution). The legacy DB branding
    // boolean is still ignored.
    removeSetuvaraBranding: row.verified_badge === true,
  } as const;
}

export { publicProfileEntitlements };
