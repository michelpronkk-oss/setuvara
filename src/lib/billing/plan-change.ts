import type { BillingInterval, PlanCode } from "./catalog";

export type PlanChangeKind = "same" | "upgrade" | "downgrade";

const PLAN_RANK: Readonly<Record<PlanCode, number>> = { free: 0, plus: 1, pro: 2 };

/**
 * A higher plan is an upgrade whatever the interval. On the same plan, monthly to yearly is
 * an upgrade (billed now, prorated) and yearly to monthly a downgrade (from the next renewal).
 */
export function classifyPlanChange(
  current: { plan: PlanCode; interval: BillingInterval | null },
  next: { plan: PlanCode; interval: BillingInterval },
): PlanChangeKind {
  if (PLAN_RANK[next.plan] !== PLAN_RANK[current.plan]) {
    return PLAN_RANK[next.plan] > PLAN_RANK[current.plan] ? "upgrade" : "downgrade";
  }
  if (current.interval === next.interval) return "same";
  return next.interval === "yearly" ? "upgrade" : "downgrade";
}
