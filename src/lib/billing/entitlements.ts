import {
  ENTITLEMENTS,
  PLAN_ENTITLEMENTS,
  type Entitlement,
  type PlanCode,
} from "./catalog";

export function getPlanEntitlements(plan: PlanCode): readonly Entitlement[] {
  return PLAN_ENTITLEMENTS[plan];
}

export function hasEntitlement(plan: PlanCode, entitlement: Entitlement): boolean {
  return PLAN_ENTITLEMENTS[plan].includes(entitlement);
}

export function entitlementFlags(plan: PlanCode): Record<Entitlement, boolean> {
  return Object.fromEntries(
    ENTITLEMENTS.map((entitlement) => [entitlement, hasEntitlement(plan, entitlement)]),
  ) as Record<Entitlement, boolean>;
}

export function publicProfileEntitlements(plan: PlanCode) {
  return {
    verifiedBadge: hasEntitlement(plan, "verified_badge"),
    removeSetuvaraBranding: hasEntitlement(plan, "remove_setuvara_branding"),
  } as const;
}
