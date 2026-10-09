import "server-only";

import type { Entitlement } from "./catalog";
import { createBillingAdminClient } from "./admin";
import { createBillingPublicClient } from "./public-client";
import { entitlementFlags, publicProfileEntitlements, hasEntitlement } from "./entitlements";
import { resolveBillingSnapshot, type BillingSnapshot, type ProviderSubscriptionRecord } from "./state";

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

export async function getUserEntitlements(userId: string) {
  const state = await getUserBillingState(userId);
  return { plan: state.plan, entitlements: entitlementFlags(state.plan) };
}

export async function userHasEntitlement(userId: string, entitlement: Entitlement): Promise<boolean> {
  const state = await getUserBillingState(userId);
  return hasEntitlement(state.plan, entitlement);
}

export async function requireEntitlement(userId: string, entitlement: Entitlement): Promise<void> {
  if (!(await userHasEntitlement(userId, entitlement))) {
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
    verifiedBadge: row.verified_badge === true,
    removeSetuvaraBranding: row.remove_setuvara_branding === true,
  } as const;
}

export { publicProfileEntitlements };
