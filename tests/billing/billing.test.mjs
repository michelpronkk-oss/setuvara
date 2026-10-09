import assert from "node:assert/strict";

import { ENTITLEMENTS, PUBLIC_PLAN_CATALOG, PLAN_ENTITLEMENTS } from "../../src/lib/billing/catalog.ts";
import { entitlementFlags, getPlanEntitlements } from "../../src/lib/billing/entitlements.ts";
import { mapConfiguredProduct, productMatchesSetuvaraPrice } from "../../src/lib/billing/products.ts";
import { resolveBillingSnapshot, subscriptionHasAccess } from "../../src/lib/billing/state.ts";
import { isDodoEnvironmentAllowed } from "../../src/lib/billing/environment.ts";

Deno.test("billing catalog contains the configured USD plan prices", () => {
  assert.deepEqual(PUBLIC_PLAN_CATALOG.map((plan) => [plan.code, plan.monthlyPriceMinor, plan.yearlyPriceMinor]), [
    ["free", 0, 0],
    ["plus", 699, 6900],
    ["pro", 1299, 12900],
  ]);
});

Deno.test("Pro inherits all Plus entitlements and adds only its own", () => {
  assert(PLAN_ENTITLEMENTS.plus.every((item) => PLAN_ENTITLEMENTS.pro.includes(item)));
  assert.equal(PLAN_ENTITLEMENTS.pro.length - PLAN_ENTITLEMENTS.plus.length, 6);
  assert.deepEqual(getPlanEntitlements("free"), []);
  assert.equal(Object.keys(entitlementFlags("pro")).length, ENTITLEMENTS.length);
});

Deno.test("subscription access follows verified provider status and grace windows", () => {
  const active = {
    plan_code: "plus",
    billing_interval: "monthly",
    provider_status: "active",
    current_period_end: "2027-01-01T00:00:00.000Z",
    cancel_at_next_billing_date: false,
    past_due_ends_at: null,
  };
  assert(subscriptionHasAccess(active, Date.parse("2026-10-09T00:00:00.000Z")));
  assert(!subscriptionHasAccess({ ...active, provider_status: "on_hold" }));
  assert(!subscriptionHasAccess({ ...active, provider_status: "failed" }));
  assert(!subscriptionHasAccess({ ...active, provider_status: "cancelled" }));
  assert(!subscriptionHasAccess({ ...active, cancel_at_next_billing_date: true, current_period_end: null }));
  assert(!subscriptionHasAccess({ ...active, cancel_at_next_billing_date: true }, Date.parse("2027-01-02T00:00:00.000Z")));
  assert(subscriptionHasAccess({ ...active, provider_status: "past_due", past_due_ends_at: "2026-10-10T00:00:00.000Z" }, Date.parse("2026-10-09T00:00:00.000Z")));
  assert(!subscriptionHasAccess({ ...active, provider_status: "past_due", past_due_ends_at: "2026-10-08T00:00:00.000Z" }, Date.parse("2026-10-09T00:00:00.000Z")));
});

Deno.test("billing snapshot selects highest eligible plan and defaults safely to Free", () => {
  const base = {
    plan_code: "plus",
    billing_interval: "monthly",
    provider_status: "active",
    current_period_end: "2027-01-01T00:00:00.000Z",
    cancel_at_next_billing_date: false,
    past_due_ends_at: null,
  };
  assert.equal(resolveBillingSnapshot([
    base,
    { ...base, plan_code: "pro", billing_interval: "yearly" },
  ]).plan, "pro");
  assert.equal(resolveBillingSnapshot([{ ...base, provider_status: "on_hold" }]).plan, "free");
});

Deno.test("product validation checks USD price cadence and ongoing subscription term", () => {
  const product = {
    product_id: "pdt_test123",
    is_recurring: true,
    price: {
      type: "recurring_price",
      currency: "USD",
      price: 699,
      payment_frequency_count: 1,
      payment_frequency_interval: "Month",
      subscription_period_count: 20,
      subscription_period_interval: "Year",
      trial_period_days: 0,
    },
  };
  assert(productMatchesSetuvaraPrice(product, "plus", "monthly"));
  assert(!productMatchesSetuvaraPrice({ ...product, price: { ...product.price, price: 599 } }, "plus", "monthly"));
  assert(!productMatchesSetuvaraPrice({ ...product, price: { ...product.price, payment_frequency_interval: "Year" } }, "plus", "monthly"));
  assert(!productMatchesSetuvaraPrice({ ...product, price: { ...product.price, trial_period_days: 7 } }, "plus", "monthly"));
});

Deno.test("configured products map only to their canonical plan and billing interval", () => {
  const products = {
    plus: { monthly: "pdt_plus_monthly", yearly: "pdt_plus_yearly" },
    pro: { monthly: "pdt_pro_monthly", yearly: "pdt_pro_yearly" },
  };
  assert.deepEqual(mapConfiguredProduct("pdt_plus_monthly", products), { plan: "plus", interval: "monthly" });
  assert.deepEqual(mapConfiguredProduct("pdt_plus_yearly", products), { plan: "plus", interval: "yearly" });
  assert.deepEqual(mapConfiguredProduct("pdt_pro_monthly", products), { plan: "pro", interval: "monthly" });
  assert.deepEqual(mapConfiguredProduct("pdt_pro_yearly", products), { plan: "pro", interval: "yearly" });
  assert.equal(mapConfiguredProduct("pdt_unknown", products), null);
});

Deno.test("Dodo mode fails closed unless explicitly aligned with runtime", () => {
  assert(isDodoEnvironmentAllowed("live_mode", "production"));
  assert(!isDodoEnvironmentAllowed("test_mode", "production"));
  assert(!isDodoEnvironmentAllowed(undefined, "production"));
  assert(!isDodoEnvironmentAllowed("malformed", "production"));
  assert(isDodoEnvironmentAllowed("test_mode", "development"));
  assert(!isDodoEnvironmentAllowed("live_mode", "development"));
});
