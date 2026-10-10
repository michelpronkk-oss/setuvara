import { isBillingInterval, isPaidPlanCode, type BillingInterval, type PlanCode } from "./catalog";

export type ProviderSubscriptionRecord = {
  plan_code: string | null;
  billing_interval: string | null;
  provider_status: string;
  current_period_end: string | null;
  cancel_at_next_billing_date: boolean;
  past_due_ends_at: string | null;
};

export type EffectiveSubscription = Omit<ProviderSubscriptionRecord, "plan_code" | "billing_interval"> & {
  plan_code: "plus" | "pro";
  billing_interval: BillingInterval;
};

export type BillingSnapshot = {
  plan: PlanCode;
  interval: BillingInterval | null;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;
};

export function subscriptionHasAccess(
  subscription: ProviderSubscriptionRecord,
  now = Date.now(),
): subscription is EffectiveSubscription {
  if (
    !isPaidPlanCode(subscription.plan_code) ||
    !isBillingInterval(subscription.billing_interval) ||
    typeof subscription.cancel_at_next_billing_date !== "boolean"
  ) return false;

  const hasFutureDate = (value: string | null) => {
    if (typeof value !== "string") return false;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp > now;
  };

  if (subscription.provider_status === "active") {
    // Active rows without a valid future period end are malformed or stale. Failing closed
    // here avoids granting paid access indefinitely when provider state is incomplete.
    return hasFutureDate(subscription.current_period_end);
  }

  return subscription.provider_status === "past_due" &&
    hasFutureDate(subscription.past_due_ends_at);
}

export function resolveBillingSnapshot(
  subscriptions: readonly ProviderSubscriptionRecord[],
  now = Date.now(),
): BillingSnapshot {
  const active = subscriptions
    .filter((subscription) => subscriptionHasAccess(subscription, now))
    .sort((left, right) => {
      const rank = (right.plan_code === "pro" ? 2 : 1) - (left.plan_code === "pro" ? 2 : 1);
      if (rank !== 0) return rank;
      return Date.parse(right.current_period_end ?? "") - Date.parse(left.current_period_end ?? "");
    });

  const selected = active[0];
  if (!selected || !isPaidPlanCode(selected.plan_code)) {
    return {
      plan: "free",
      interval: null,
      status: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canManageBilling: subscriptions.length > 0,
    };
  }

  return {
    plan: selected.plan_code,
    interval: selected.billing_interval,
    status: selected.provider_status,
    currentPeriodEnd: selected.current_period_end,
    cancelAtPeriodEnd: selected.cancel_at_next_billing_date,
    canManageBilling: true,
  };
}
