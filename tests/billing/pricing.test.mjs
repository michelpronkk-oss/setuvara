import assert from "node:assert/strict";

import { CAPABILITY_REGISTRY, hasCapability } from "../../src/lib/billing/capabilities.ts";
import { parseUpgradeChoice, readPlanIntent, upgradePath } from "../../src/lib/billing/intent.ts";
import { classifyPlanChange } from "../../src/lib/billing/plan-change.ts";
import { COMING_TO_PRO, formatPrice, monthlyNote, PLAN_COUNTS, PLAN_HIGHLIGHTS, yearlyNote } from "../../src/lib/billing/plan-copy.ts";
import { selectEffectiveSubscription } from "../../src/lib/billing/state.ts";

Deno.test("plan changes: higher plan upgrades now, lower plan or monthly waits for renewal", () => {
  assert.equal(classifyPlanChange({ plan: "plus", interval: "monthly" }, { plan: "pro", interval: "monthly" }), "upgrade");
  assert.equal(classifyPlanChange({ plan: "plus", interval: "yearly" }, { plan: "pro", interval: "monthly" }), "upgrade");
  assert.equal(classifyPlanChange({ plan: "pro", interval: "monthly" }, { plan: "plus", interval: "yearly" }), "downgrade");
  assert.equal(classifyPlanChange({ plan: "plus", interval: "monthly" }, { plan: "plus", interval: "yearly" }), "upgrade");
  assert.equal(classifyPlanChange({ plan: "pro", interval: "yearly" }, { plan: "pro", interval: "monthly" }), "downgrade");
  assert.equal(classifyPlanChange({ plan: "pro", interval: "yearly" }, { plan: "pro", interval: "yearly" }), "same");
});

Deno.test("a picked plan survives signup only as a known plan and interval in the path", () => {
  assert.equal(upgradePath("plus", "monthly"), "/app/upgrade/plus-monthly");
  assert.equal(upgradePath("pro", undefined), "/app/upgrade/pro-yearly");
  assert.equal(upgradePath("free", "yearly"), null);
  assert.equal(upgradePath("enterprise", "yearly"), null);
  assert.equal(upgradePath("plus", "weekly"), null);
  assert.deepEqual(parseUpgradeChoice("pro-monthly"), { plan: "pro", interval: "monthly" });
  assert.equal(parseUpgradeChoice("pro-monthly/../x"), null);
  assert.deepEqual(readPlanIntent(["plus", "pro"], undefined, "monthly"), { plan: "plus", interval: "monthly" });
});

Deno.test("plan change acts on the same subscription that grants the plan", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const row = (id, plan_code) => ({ id, plan_code, billing_interval: "monthly", provider_status: "active", current_period_end: future, cancel_at_next_billing_date: false, past_due_ends_at: null });
  assert.equal(selectEffectiveSubscription([row("a", "plus"), row("b", "pro")])?.id, "b");
  assert.equal(selectEffectiveSubscription([{ ...row("c", "pro"), provider_status: "cancelled" }]), null);
});

Deno.test("pricing copy only sells live capabilities and real counts", () => {
  assert.equal(CAPABILITY_REGISTRY["identity.remove_attribution"].availability, "live");
  assert(!hasCapability("free", "identity.remove_attribution"));
  assert(hasCapability("plus", "identity.remove_attribution") && hasCapability("pro", "identity.remove_attribution"));
  for (const key of ["domain.custom", "webhooks.access", "integrations.access"]) {
    assert.equal(CAPABILITY_REGISTRY[key].availability, "future", `${key} is still future, so it may only appear under Coming to Pro`);
  }
  // Actions and Leads shipped on every plan (limits in the database), so pricing may sell them.
  for (const key of ["actions.advanced", "leads.capture"]) assert(hasCapability("free", key), `${key} is live on Free`);
  const sold = Object.values(PLAN_HIGHLIGHTS).flat().map((item) => item.text.toLowerCase()).join(" | ");
  for (const word of ["domain", "webhook", "integration"]) assert(!sold.includes(word), `${word} must not be listed as included`);
  assert.equal(COMING_TO_PRO.length, 2);
  assert.deepEqual([PLAN_COUNTS.appearances, PLAN_COUNTS.freeAppearances, PLAN_COUNTS.plusSlides, PLAN_COUNTS.proSlides, PLAN_COUNTS.qrStyles], [10, 2, 2, 4, 5]);
});

Deno.test("pricing notes come from catalog prices", () => {
  assert.equal(formatPrice(6900), "$69");
  assert.equal(formatPrice(699), "$6.99");
  assert.equal(yearlyNote("plus"), "$5.75/mo billed yearly · save $14.88");
  assert.equal(yearlyNote("pro"), "$10.75/mo billed yearly · save $26.88");
  assert.equal(monthlyNote("pro"), "Or $129/yr · 2 months free");
});
