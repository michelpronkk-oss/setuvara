import type { Product } from "dodopayments/resources/products/products";

import { getPublicPlan, type BillingInterval, type PlanCode } from "./catalog";

export function productMatchesSetuvaraPrice(
  product: Product,
  plan: Exclude<PlanCode, "free">,
  interval: BillingInterval,
): boolean {
  const expected = getPublicPlan(plan);
  const expectedAmount = interval === "monthly"
    ? expected.monthlyPriceMinor
    : expected.yearlyPriceMinor;
  const expectedPeriod = interval === "monthly" ? "Month" : "Year";
  const price = product.price;

  return product.product_id.length > 0 &&
    product.is_recurring &&
    price.type === "recurring_price" &&
    price.currency === expected.currency &&
    price.price === expectedAmount &&
    price.payment_frequency_count === 1 &&
    price.payment_frequency_interval === expectedPeriod &&
    // Dodo models the maximum subscription lifetime separately from the charge
    // cadence. Ongoing products use a long 20-year period while payment_frequency
    // remains monthly or yearly.
    price.subscription_period_count >= 20 &&
    price.subscription_period_interval === "Year" &&
    (!price.trial_period_days || price.trial_period_days === 0);
}

export function mapConfiguredProduct(
  productId: string,
  configured: Readonly<Record<"plus" | "pro", Readonly<Record<BillingInterval, string | null>>>>,
): { plan: "plus" | "pro"; interval: BillingInterval } | null {
  for (const plan of ["plus", "pro"] as const) {
    for (const interval of ["monthly", "yearly"] as const) {
      if (configured[plan][interval] === productId) return { plan, interval };
    }
  }
  return null;
}
