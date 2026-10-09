export const PLAN_CODES = ["free", "plus", "pro"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const ENTITLEMENTS = [
  "verified_badge",
  "remove_setuvara_branding",
  "premium_appearance",
  "premium_profile_treatments",
  "premium_share_qr",
  "premium_passport_cosmetics",
  "custom_domain",
  "advanced_analytics",
  "advanced_actions",
  "lead_capture",
  "exports",
  "integrations",
] as const;
export type Entitlement = (typeof ENTITLEMENTS)[number];

export type PublicPlan = {
  code: PlanCode;
  displayName: string;
  rank: number;
  currency: "USD";
  monthlyPriceMinor: number;
  yearlyPriceMinor: number;
  billingIntervals: readonly BillingInterval[];
  entitlements: readonly Entitlement[];
};

const plusEntitlements = [
  "verified_badge",
  "remove_setuvara_branding",
  "premium_appearance",
  "premium_profile_treatments",
  "premium_share_qr",
  "premium_passport_cosmetics",
] as const satisfies readonly Entitlement[];

const proEntitlements = [
  ...plusEntitlements,
  "custom_domain",
  "advanced_analytics",
  "advanced_actions",
  "lead_capture",
  "exports",
  "integrations",
] as const satisfies readonly Entitlement[];

export const PLAN_ENTITLEMENTS: Readonly<Record<PlanCode, readonly Entitlement[]>> = {
  free: [],
  plus: plusEntitlements,
  pro: proEntitlements,
};

/** Safe canonical catalog. Provider credentials and product IDs stay server-only. */
export const PUBLIC_PLAN_CATALOG: readonly PublicPlan[] = [
  {
    code: "free",
    displayName: "Free",
    rank: 0,
    currency: "USD",
    monthlyPriceMinor: 0,
    yearlyPriceMinor: 0,
    billingIntervals: [],
    entitlements: PLAN_ENTITLEMENTS.free,
  },
  {
    code: "plus",
    displayName: "Plus",
    rank: 1,
    currency: "USD",
    monthlyPriceMinor: 699,
    yearlyPriceMinor: 6900,
    billingIntervals: BILLING_INTERVALS,
    entitlements: PLAN_ENTITLEMENTS.plus,
  },
  {
    code: "pro",
    displayName: "Pro",
    rank: 2,
    currency: "USD",
    monthlyPriceMinor: 1299,
    yearlyPriceMinor: 12900,
    billingIntervals: BILLING_INTERVALS,
    entitlements: PLAN_ENTITLEMENTS.pro,
  },
];

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === "string" && PLAN_CODES.includes(value as PlanCode);
}

export function isPaidPlanCode(value: unknown): value is "plus" | "pro" {
  return value === "plus" || value === "pro";
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return typeof value === "string" && BILLING_INTERVALS.includes(value as BillingInterval);
}

export function getPublicPlan(plan: PlanCode): PublicPlan {
  return PUBLIC_PLAN_CATALOG.find((item) => item.code === plan)!;
}
