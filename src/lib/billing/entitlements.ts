/** Compatibility exports backed by the single product capability registry. */
export {
  capabilityFlags as entitlementFlags,
  getCapabilityAccess,
  hasCapability as hasEntitlement,
  listAvailableCapabilities as getPlanEntitlements,
  resolveClientCapabilities,
} from "./capabilities";
export type { CapabilityKey as Entitlement } from "./capabilities";

import { hasCapability } from "./capabilities";
import type { PlanCode } from "./catalog";

/** Legacy public-profile projection; the badge means paid membership, not identity verification. */
export function publicProfileEntitlements(plan: PlanCode) {
  return {
    memberBadge: hasCapability(plan, "identity.plus_badge") || hasCapability(plan, "identity.pro_badge"),
    removeSetuvaraBranding: hasCapability(plan, "identity.remove_attribution"),
  } as const;
}
