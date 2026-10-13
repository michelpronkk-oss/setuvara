import { isBillingInterval, isPaidPlanCode, type BillingInterval } from "./catalog";

export type PlanIntent = { plan: "plus" | "pro"; interval: BillingInterval };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** A paid plan someone picked before signing in. Unknown values are dropped, never guessed. */
export function readPlanIntent(plan: string | string[] | undefined, interval: string | string[] | undefined, fallback: BillingInterval = "yearly"): PlanIntent | null {
  const planValue = first(plan);
  const intervalValue = first(interval) ?? fallback;
  return isPaidPlanCode(planValue) && isBillingInterval(intervalValue) ? { plan: planValue, interval: intervalValue } : null;
}

/**
 * Path-only landing for a picked plan. Email confirmation keeps only the path of `next`,
 * so the choice lives in the path and /app/upgrade/[choice] turns it into a Billing link.
 */
export function upgradePath(plan: string | string[] | undefined, interval: string | string[] | undefined): string | null {
  const intent = readPlanIntent(plan, interval);
  return intent ? `/app/upgrade/${intent.plan}-${intent.interval}` : null;
}

export function parseUpgradeChoice(choice: string): PlanIntent | null {
  const [plan, interval] = choice.split("-");
  return readPlanIntent(plan, interval);
}
