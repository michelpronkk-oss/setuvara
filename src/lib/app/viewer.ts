import "server-only";

import { cache } from "react";

import type { PlanCode } from "@/lib/billing/catalog";
import { getUserBillingState } from "@/lib/billing/service";

/**
 * Plan for the signed-in viewer, shared by the /app layout and Home in one request.
 * Billing is secondary on these surfaces: if it fails we show Free and never block /app.
 */
export const getViewerPlan = cache(async (userId: string): Promise<{ plan: PlanCode; canManageBilling: boolean }> => {
  try {
    const state = await getUserBillingState(userId);
    return { plan: state.plan, canManageBilling: state.canManageBilling };
  } catch {
    return { plan: "free", canManageBilling: false };
  }
});

export async function getPublicOrigin(requestHeaders: Headers) {
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "setuvara.com";
  return /^(localhost|127\.0\.0\.1):(?:3000|3014)$/.test(host) ? `http://${host}` : "https://setuvara.com";
}
