import { listAvailableCapabilities, type CapabilityKey } from "./capabilities";

export const PLAN_CODES = ["free", "plus", "pro"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export type PublicPlan = {
  code: PlanCode;
  displayName: string;
  rank: number;
  currency: "USD";
  monthlyPriceMinor: number;
  yearlyPriceMinor: number;
  billingIntervals: readonly BillingInterval[];
  capabilities: readonly CapabilityKey[];
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
    capabilities: listAvailableCapabilities("free"),
  },
  {
    code: "plus",
    displayName: "Plus",
    rank: 1,
    currency: "USD",
    monthlyPriceMinor: 699,
    yearlyPriceMinor: 6900,
    billingIntervals: BILLING_INTERVALS,
    capabilities: listAvailableCapabilities("plus"),
  },
  {
    code: "pro",
    displayName: "Pro",
    rank: 2,
    currency: "USD",
    monthlyPriceMinor: 1299,
    yearlyPriceMinor: 12900,
    billingIntervals: BILLING_INTERVALS,
    capabilities: listAvailableCapabilities("pro"),
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
