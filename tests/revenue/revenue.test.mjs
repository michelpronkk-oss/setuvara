/** Verified Revenue maths, the Stripe adapter's subscription normalisation and the RevenueCat adapter.  npm run test:revenue */
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
let m, s, rc;
before(async () => {
  writeFileSync(join(out, "empty.js"), "");
  const opts = { bundle: true, format: "cjs", platform: "node", logLevel: "silent", external: ["stripe"], alias: { "server-only": join(out, "empty.js") } };
  await build({ ...opts, entryPoints: [join(root, "src/lib/revenue/metrics.ts")], outfile: join(out, "m.cjs") });
  await build({ ...opts, entryPoints: [join(root, "src/lib/revenue/stripe.ts")], outfile: join(out, "s.cjs") });
  await build({ ...opts, entryPoints: [join(root, "src/lib/revenue/revenuecat.ts")], outfile: join(out, "rc.cjs") });
  const require = createRequire(join(root, "package.json"));
  m = require(join(out, "m.cjs"));
  s = require(join(out, "s.cjs"));
  rc = require(join(out, "rc.cjs"));
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

const KEY = "sk_" + "AbCdEfGhIjKlMnOpQrStUv12";
const overview = (mrr = 1234.56, active = 42) => ({ object: "overview_metrics", currency: "USD", metrics: [
  { object: "overview_metric", id: "active_trials", unit: "#", period: "P0D", value: 7 },
  { object: "overview_metric", id: "active_subscriptions", unit: "#", period: "P0D", value: active },
  { object: "overview_metric", id: "mrr", unit: "$", period: "P28D", value: mrr },
  { object: "overview_metric", id: "revenue", unit: "$", period: "P28D", value: 1500 },
] });
/** Answers RevenueCat calls by method and path suffix, recording each request. */
function stubFetch(routes) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url: String(url), method, auth: init.headers?.authorization });
    const hit = routes.find(([m, suffix]) => m === method && new URL(url).pathname.endsWith(suffix));
    const [, , status, body] = hit ?? [null, null, 404, { object: "error" }];
    return new Response(JSON.stringify(body ?? {}), { status, headers: { "content-type": "application/json" } });
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test("RevenueCat: overview metrics become one row in the reported currency", () => {
  assert.deepEqual(rc.revenuecatRows(overview()), [{ currency: "usd", mrr_minor: 123456, paying_customers: 42, active_subscriptions: 42 }]);
  assert.deepEqual(rc.revenuecatRows(overview(0, 0)), []);
  assert.throws(() => rc.revenuecatRows({ metrics: [{ id: "mrr", value: 10 }] }), /active_subscriptions/);
  assert.throws(() => rc.revenuecatRows({ metrics: [{ id: "mrr", value: -1 }, { id: "active_subscriptions", value: 1 }] }), /mrr/);
  assert.throws(() => rc.revenuecatRows({}), /no metrics/);
});

test("RevenueCat: the credential needs a project ID and a v2 secret key", () => {
  assert.deepEqual(rc.revenuecatCredential(`proj1a2b3c4d:${KEY}`), { projectId: "proj1a2b3c4d", key: KEY });
  assert.throws(() => rc.revenuecatCredential(KEY), /project ID/);
  assert.throws(() => rc.revenuecatCredential("proj1a2b3c4d:appl_" + "x".repeat(24)), /secret key/);
});

test("RevenueCat verify accepts a metrics-only key", async () => {
  const stub = stubFetch([["GET", "/projects/proj1/metrics/overview", 200, overview()], ["DELETE", "/customers/setuvara_permission_probe", 403, { type: "authorization_error" }]]);
  try {
    const verified = await rc.revenuecatRevenue.verify(`proj1:${KEY}`);
    assert.deepEqual(verified, { environment: "live", accountRef: "proj1", keyHint: "sk_A…Uv12" });
    assert.ok(stub.calls.every((c) => c.url.startsWith("https://api.revenuecat.com/v2/") && c.auth === `Bearer ${KEY}`));
  } finally { stub.restore(); }
});

test("RevenueCat verify refuses keys that can write or can't read metrics", async () => {
  let stub = stubFetch([["GET", "/metrics/overview", 200, overview()], ["DELETE", "/setuvara_permission_probe", 404, { type: "resource_missing" }]]);
  try { await assert.rejects(rc.revenuecatRevenue.verify(`proj1:${KEY}`), /can write/); } finally { stub.restore(); }
  stub = stubFetch([["GET", "/metrics/overview", 403, { type: "authorization_error" }]]);
  try { await assert.rejects(rc.revenuecatRevenue.verify(`proj1:${KEY}`), /Charts & metrics/); } finally { stub.restore(); }
  stub = stubFetch([["GET", "/metrics/overview", 401, {}]]);
  try { await assert.rejects(rc.revenuecatRevenue.verify(`proj1:${KEY}`), /didn't accept/); } finally { stub.restore(); }
  stub = stubFetch([]);
  try { await assert.rejects(rc.revenuecatRevenue.verify(`proj1:${KEY}`), /project ID/); } finally { stub.restore(); }
});

test("RevenueCat sync reads the USD overview and labels the method", async () => {
  const stub = stubFetch([["GET", "/metrics/overview", 200, overview(99.5, 3)]]);
  try {
    assert.deepEqual(await rc.revenuecatRevenue.sync(`proj1:${KEY}`), { rows: [{ currency: "usd", mrr_minor: 9950, paying_customers: 3, active_subscriptions: 3 }], method: "revenuecat_overview_v2" });
    assert.match(stub.calls[0].url, /currency=USD$/);
  } finally { stub.restore(); }
  const refused = stubFetch([["GET", "/metrics/overview", 403, {}]]);
  try { await assert.rejects(rc.revenuecatRevenue.sync(`proj1:${KEY}`), /permission/); } finally { refused.restore(); }
});
