import "server-only";

import type { CapabilityKey } from "./capabilities";
import { createBillingAdminClient } from "./admin";
import { createBillingPublicClient } from "./public-client";
import { publicProfileEntitlements } from "./entitlements";
import { hasCapability, resolveClientCapabilities } from "./capabilities";
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
    // Attribution removal is not shipped yet. Do not expose the legacy DB
    // boolean as an entitlement until the feature is implemented.
    removeSetuvaraBranding: false,
  } as const;
}

export { publicProfileEntitlements };
