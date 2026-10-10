import assert from "node:assert/strict";

import { MEMBER_BADGE_COPY, memberTierForPlan } from "../../src/lib/billing/member-badge.ts";
import { resolveBillingSnapshot } from "../../src/lib/billing/state.ts";

const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();
const subscription = (plan, overrides = {}) => ({
  plan_code: plan, billing_interval: "monthly", provider_status: "active", current_period_end: future,
  cancel_at_next_billing_date: false, past_due_ends_at: null, ...overrides,
});
const tierFor = (records) => memberTierForPlan(resolveBillingSnapshot(records).plan);

Deno.test("Free has no paid member badge; Plus and Pro each have exactly one", () => {
  assert.equal(memberTierForPlan("free"), null);
  assert.equal(memberTierForPlan("plus"), "plus");
  assert.equal(memberTierForPlan("pro"), "pro", "Pro shows the Pro badge, never a stacked Plus badge");
});

Deno.test("badge copy is membership, never verification", () => {
  assert.deepEqual(MEMBER_BADGE_COPY.plus.label, "Setuvara Plus member");
  assert.deepEqual(MEMBER_BADGE_COPY.pro.label, "Setuvara Pro member");
  assert.equal(/verif|kyc|identity/i.test(JSON.stringify(MEMBER_BADGE_COPY)), false);
});

Deno.test("upgrades follow canonical billing state", () => {
  assert.equal(tierFor([]), null);
  assert.equal(tierFor([subscription("plus")]), "plus", "Free → Plus shows the Plus badge");
  assert.equal(tierFor([subscription("plus", { provider_status: "cancelled" }), subscription("pro")]), "pro", "Plus → Pro replaces the badge");
});

Deno.test("downgrades follow canonical billing state", () => {
  assert.equal(tierFor([subscription("pro", { provider_status: "cancelled" }), subscription("plus")]), "plus", "Pro → Plus");
  assert.equal(tierFor([subscription("plus", { provider_status: "expired" })]), null, "Plus → Free");
  assert.equal(tierFor([subscription("pro", { cancel_at_next_billing_date: true, current_period_end: past })]), null, "Pro → Free after the paid period ends");
  assert.equal(tierFor([subscription("pro", { cancel_at_next_billing_date: true })]), "pro", "a cancelled Pro keeps its badge until the period ends");
});
