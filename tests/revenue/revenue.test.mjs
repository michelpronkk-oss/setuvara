/** Verified Revenue maths and the Stripe adapter's subscription normalisation.  npm run test:revenue */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-revenue-"));
let m, s;
before(async () => {
  writeFileSync(join(out, "empty.js"), "");
  const opts = { bundle: true, format: "cjs", platform: "node", logLevel: "silent", external: ["stripe"], alias: { "server-only": join(out, "empty.js") } };
  await build({ ...opts, entryPoints: [join(root, "src/lib/revenue/metrics.ts")], outfile: join(out, "m.cjs") });
  await build({ ...opts, entryPoints: [join(root, "src/lib/revenue/stripe.ts")], outfile: join(out, "s.cjs") });
  const require = createRequire(join(root, "package.json"));
  m = require(join(out, "m.cjs"));
  s = require(join(out, "s.cjs"));
});
after(() => rmSync(out, { recursive: true, force: true }));

const sub = (over = {}) => ({ status: "active", customer: "cus_1", currency: "eur", discounts: [],
  items: { data: [{ quantity: 1, price: { unit_amount: 1200, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } } }] }, ...over });

test("intervals normalise to a month", () => {
  assert.equal(m.monthly({ amountMinor: 12000, interval: "year", intervalCount: 1 }), 1000);
  assert.equal(m.monthly({ amountMinor: 3000, interval: "month", intervalCount: 3 }), 1000);
  assert.equal(Math.round(m.monthly({ amountMinor: 100, interval: "week", intervalCount: 1 })), 433);
});

test("discounts: percentages then amounts, never negative", () => {
  assert.equal(m.discounted(1000, [{ percentOff: 50 }, { amountOffMinor: 100 }]), 400);
  assert.equal(m.discounted(1000, [{ amountOffMinor: 5000 }]), 0);
});

test("snapshot groups by currency and counts paying customers once", () => {
  const rows = m.snapshot([
    { customer: "a", currency: "EUR", amountMinor: 1000, interval: "month", intervalCount: 1 },
    { customer: "a", currency: "eur", amountMinor: 500, interval: "month", intervalCount: 1 },
    { customer: "b", currency: "usd", amountMinor: 12000, interval: "year", intervalCount: 1 },
  ], { eur: 1, usd: 1 });
  assert.deepEqual(rows, [
    { currency: "eur", mrr_minor: 1500, paying_customers: 1, active_subscriptions: 1 },
    { currency: "usd", mrr_minor: 1000, paying_customers: 1, active_subscriptions: 1 },
  ]);
});

test("Stripe: only active and past_due count", () => {
  assert.equal(s.stripeLines(sub()).length, 1);
  assert.equal(s.stripeLines(sub({ status: "past_due" })).length, 1);
  for (const status of ["trialing", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) assert.equal(s.stripeLines(sub({ status })).length, 0, status);
});

test("Stripe: quantity, metered prices and ongoing discounts", () => {
  const metered = { quantity: 1, price: { unit_amount: 9999, recurring: { interval: "month", interval_count: 1, usage_type: "metered" } } };
  const base = sub({ items: { data: [{ ...sub().items.data[0], quantity: 3 }, metered] } });
  assert.deepEqual(s.stripeLines(base).map((l) => l.amountMinor), [3600]);
  const forever = { source: { coupon: { percent_off: 25, duration: "forever" } } };
  const once = { coupon: { amount_off: 1000, currency: "eur", duration: "once" } };
  assert.deepEqual(s.stripeLines({ ...base, discounts: [forever, once] }).map((l) => l.amountMinor), [2700]);
  const otherCurrency = { source: { coupon: { amount_off: 500, currency: "usd", duration: "forever" } } };
  assert.deepEqual(s.stripeLines({ ...base, discounts: [otherCurrency] }).map((l) => l.amountMinor), [3600]);
});

test("Stripe: a fixed coupon is shared across items", () => {
  const two = sub({ items: { data: [sub().items.data[0], sub().items.data[0]] }, discounts: [{ source: { coupon: { amount_off: 600, currency: "eur", duration: "repeating" } } }] });
  assert.deepEqual(s.stripeLines(two).map((l) => l.amountMinor), [900, 900]);
});

test("Stripe verify refuses secret keys before calling Stripe", async () => {
  await assert.rejects(s.stripeRevenue.verify("sk_live_" + "x".repeat(30)), /restricted key/);
});

test("key hints never carry the secret", () => {
  assert.equal(m.keyHint("rk_" + "live_" + "51AbCdEfGh0000"), "rk_live_…0000");
});
