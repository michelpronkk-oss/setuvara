/** Verified Revenue maths, the Stripe adapter's subscription normalisation, the RevenueCat, Dodo Payments and Paddle adapters.  npm run test:revenue */
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
let m, s, rc, dodo, paddle;
before(async () => {
  writeFileSync(join(out, "empty.js"), "");
  const opts = { bundle: true, format: "cjs", platform: "node", logLevel: "silent", external: ["stripe", "dodopayments"], alias: { "server-only": join(out, "empty.js") } };
  await build({ ...opts, entryPoints: [join(root, "src/lib/revenue/metrics.ts")], outfile: join(out, "m.cjs") });
  await build({ ...opts, entryPoints: [join(root, "src/lib/revenue/stripe.ts")], outfile: join(out, "s.cjs") });
  await build({ ...opts, entryPoints: [join(root, "src/lib/revenue/revenuecat.ts")], outfile: join(out, "rc.cjs") });
  await build({ ...opts, entryPoints: [join(root, "src/lib/revenue/dodo.ts")], outfile: join(out, "dodo.cjs") });
  await build({ ...opts, entryPoints: [join(root, "src/lib/revenue/paddle.ts")], outfile: join(out, "paddle.cjs") });
  const require = createRequire(join(root, "package.json"));
  m = require(join(out, "m.cjs"));
  s = require(join(out, "s.cjs"));
  rc = require(join(out, "rc.cjs"));
  dodo = require(join(out, "dodo.cjs"));
  paddle = require(join(out, "paddle.cjs"));
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

const T = (iso) => Date.parse(iso) / 1000;
test("Stripe history: month ends are the last day of each past month, oldest first", () => {
  assert.deepEqual(s.monthEnds(3, new Date("2026-10-21T12:00:00Z")).map((e) => e.day), ["2026-07-31", "2026-08-31", "2026-09-30"]);
  assert.equal(s.monthEnds(1, new Date("2026-03-01T00:00:00Z"))[0].at, T("2026-02-28T23:59:59Z"));
});

test("Stripe history: a subscription counts from its start, after its trial, until it ended", () => {
  const ends = s.monthEnds(4, new Date("2026-10-21T00:00:00Z"));
  const subs = [
    sub({ customer: "a", start_date: T("2026-05-10T00:00:00Z") }),
    sub({ customer: "b", start_date: T("2026-07-15T00:00:00Z"), trial_end: T("2026-08-15T00:00:00Z") }),
    sub({ customer: "c", status: "canceled", start_date: T("2026-06-01T00:00:00Z"), ended_at: T("2026-08-10T00:00:00Z") }),
    sub({ customer: "d", status: "incomplete_expired", start_date: T("2026-06-01T00:00:00Z") }),
  ];
  assert.deepEqual(s.stripeHistory(subs, ends), [
    { day: "2026-06-30", currency: "eur", mrr_minor: 2400, paying_customers: 2, active_subscriptions: 2 },
    { day: "2026-07-31", currency: "eur", mrr_minor: 2400, paying_customers: 2, active_subscriptions: 2 },
    { day: "2026-08-31", currency: "eur", mrr_minor: 2400, paying_customers: 2, active_subscriptions: 2 },
    { day: "2026-09-30", currency: "eur", mrr_minor: 2400, paying_customers: 2, active_subscriptions: 2 },
  ]);
  assert.equal(s.paidAt(subs[1], T("2026-07-31T23:59:59Z")), false, "still in trial");
  assert.equal(s.paidAt(subs[2], T("2026-08-31T23:59:59Z")), false, "ended");
});

const NOW = Date.parse("2026-10-22T12:00:00Z");
const dsub = (over = {}) => ({ status: "active", currency: "EUR", customer: { customer_id: "cus_1" }, recurring_pre_tax_amount: 2400,
  payment_frequency_interval: "Month", payment_frequency_count: 1, created_at: "2026-01-01T00:00:00Z", trial_period_days: 0, ...over });

test("Dodo: active and past_due subscriptions count, at their pre-tax recurring amount", () => {
  assert.deepEqual(dodo.dodoLines(dsub(), NOW), [{ customer: "cus_1", currency: "eur", amountMinor: 2400, interval: "month", intervalCount: 1 }]);
  assert.equal(dodo.dodoLines(dsub({ status: "past_due" }), NOW).length, 1);
  for (const status of ["pending", "on_hold", "paused", "cancelled", "failed", "expired"]) assert.equal(dodo.dodoLines(dsub({ status }), NOW).length, 0, status);
});

test("Dodo: trials, free plans and yearly billing", () => {
  assert.equal(dodo.dodoLines(dsub({ created_at: "2026-10-20T00:00:00Z", trial_period_days: 14 }), NOW).length, 0, "in trial");
  assert.equal(dodo.dodoLines(dsub({ created_at: "2026-09-01T00:00:00Z", trial_period_days: 14 }), NOW).length, 1, "trial over");
  assert.equal(dodo.dodoLines(dsub({ recurring_pre_tax_amount: 0 }), NOW).length, 0, "free");
  const [line] = dodo.dodoLines(dsub({ payment_frequency_interval: "Year", recurring_pre_tax_amount: 12000 }), NOW);
  assert.equal(m.monthly(line), 1000);
});

test("Dodo verify refuses keys that are obviously not a key before calling Dodo", async () => {
  await assert.rejects(dodo.dodoRevenue.verify("short"), /whole Dodo Payments API key/);
});

/** Answers Dodo calls by host, method and path, so the real SDK runs against a fake API. */
function stubDodo(answer) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(typeof url === "string" ? url : url.url);
    const method = init.method ?? "GET";
    calls.push(`${method} ${u.host}${u.pathname}`);
    const [status, body] = answer(u.host.startsWith("test.") ? "test" : "live", method, u.pathname);
    return new Response(JSON.stringify(body ?? {}), { status, headers: { "content-type": "application/json" } });
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}
const DODO_KEY = "dodo_" + "x".repeat(32);

test("Dodo verify: the host that accepts the key decides live or test, and write access is refused", async () => {
  let stub = stubDodo((env, method) => env === "live" ? [401] : method === "GET" ? [200, { items: [] }] : [403]);
  try { assert.equal((await dodo.dodoRevenue.verify(DODO_KEY)).environment, "test"); } finally { stub.restore(); }
  stub = stubDodo((env, method) => env === "test" ? [401] : method === "GET" ? [200, { items: [] }] : [403]);
  try { assert.equal((await dodo.dodoRevenue.verify(DODO_KEY)).environment, "live"); } finally { stub.restore(); }
  stub = stubDodo((env, method) => env === "live" ? (method === "GET" ? [200, { items: [] }] : [404]) : [401]);
  try { await assert.rejects(dodo.dodoRevenue.verify(DODO_KEY), /can write/); } finally { stub.restore(); }
  stub = stubDodo(() => [403]);
  try { await assert.rejects(dodo.dodoRevenue.verify(DODO_KEY), /Subscriptions: Read/); } finally { stub.restore(); }
  stub = stubDodo(() => [401]);
  try { await assert.rejects(dodo.dodoRevenue.verify(DODO_KEY), /didn't accept/); } finally { stub.restore(); }
});

test("Dodo sync sums active and past_due subscriptions per currency", async () => {
  const items = { active: [dsub(), dsub({ customer: { customer_id: "cus_2" }, payment_frequency_interval: "Year", recurring_pre_tax_amount: 12000 })], past_due: [dsub({ currency: "USD" })] };
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(typeof url === "string" ? url : url.url);
    if (u.host.startsWith("test.")) return new Response("{}", { status: 401 });
    const status = u.searchParams.get("status");
    const page = Number(u.searchParams.get("page_number") ?? 0);
    return new Response(JSON.stringify({ items: status && page === 0 ? items[status] ?? [] : [] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const { rows, method } = await dodo.dodoRevenue.sync(DODO_KEY);
    assert.equal(method, "dodo_subscriptions_v1");
    assert.deepEqual(rows, [
      { currency: "eur", mrr_minor: 3400, paying_customers: 2, active_subscriptions: 2 },
      { currency: "usd", mrr_minor: 2400, paying_customers: 1, active_subscriptions: 1 },
    ]);
  } finally { globalThis.fetch = original; }
});

const month = { interval: "month", frequency: 1 };
const psub = (over = {}) => ({ status: "active", currency_code: "EUR", customer_id: "ctm_1", billing_cycle: month, discount: null,
  items: [{ status: "active", quantity: 2, recurring: true, price: { unit_price: { amount: "1500", currency_code: "EUR" }, billing_cycle: month } }], ...over });
const PADDLE_KEY = "pdl_sdbx_apikey_" + "a".repeat(26);

test("Paddle: active and past_due count; one-off items, trials and other currencies don't", () => {
  assert.deepEqual(paddle.paddleLines(psub(), NOW), [{ customer: "ctm_1", currency: "eur", amountMinor: 3000, interval: "month", intervalCount: 1 }]);
  assert.equal(paddle.paddleLines(psub({ status: "past_due" }), NOW).length, 1);
  for (const status of ["trialing", "paused", "canceled"]) assert.equal(paddle.paddleLines(psub({ status }), NOW).length, 0, status);
  const oneOff = { status: "active", quantity: 1, recurring: false, price: { unit_price: { amount: "9900", currency_code: "EUR" }, billing_cycle: null } };
  assert.equal(paddle.paddleLines(psub({ items: [...psub().items, oneOff] }), NOW).length, 1);
});

test("Paddle: ongoing discounts apply, expired ones don't", () => {
  assert.equal(paddle.paddleLines(psub({ discount: { type: "percentage", amount: "50", ends_at: null } }), NOW)[0].amountMinor, 1500);
  assert.equal(paddle.paddleLines(psub({ discount: { type: "flat", amount: "1000", ends_at: "2027-01-01T00:00:00Z" } }), NOW)[0].amountMinor, 2000);
  assert.equal(paddle.paddleLines(psub({ discount: { type: "flat_per_seat", amount: "500", ends_at: null } }), NOW)[0].amountMinor, 2000);
  assert.equal(paddle.paddleLines(psub({ discount: { type: "percentage", amount: "50", ends_at: "2026-01-01T00:00:00Z" } }), NOW)[0].amountMinor, 3000);
});

test("Paddle verify: sandbox keys are test, live keys live, writable keys refused", async () => {
  await assert.rejects(paddle.paddleRevenue.verify("pdl_" + "secret_wrong"), /Paddle Billing API key/);
  let stub = stubFetch([["GET", "/subscriptions", 200, { data: [] }], ["PATCH", "/subscriptions/sub_01setuvarapermissionprobe00", 403, { error: { code: "forbidden" } }]]);
  try {
    assert.equal((await paddle.paddleRevenue.verify(PADDLE_KEY)).environment, "test");
    assert.ok(stub.calls.every((c) => c.url.startsWith("https://sandbox-api.paddle.com/")));
  } finally { stub.restore(); }
  stub = stubFetch([["GET", "/subscriptions", 200, { data: [] }], ["PATCH", "/subscriptions/sub_01setuvarapermissionprobe00", 403, {}]]);
  try { assert.equal((await paddle.paddleRevenue.verify(PADDLE_KEY.replace("sdbx", "live"))).environment, "live"); } finally { stub.restore(); }
  stub = stubFetch([["GET", "/subscriptions", 200, { data: [] }], ["PATCH", "/subscriptions/sub_01setuvarapermissionprobe00", 404, {}]]);
  try { await assert.rejects(paddle.paddleRevenue.verify(PADDLE_KEY), /can write/); } finally { stub.restore(); }
  stub = stubFetch([["GET", "/subscriptions", 403, {}]]);
  try { await assert.rejects(paddle.paddleRevenue.verify(PADDLE_KEY), /Subscriptions: Read/); } finally { stub.restore(); }
});

test("Paddle sync follows pagination and sums per currency", async () => {
  const original = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    const second = String(url).includes("after=");
    const body = second ? { data: [psub({ customer_id: "ctm_2", currency_code: "USD", items: [{ ...psub().items[0], quantity: 1, price: { unit_price: { amount: "12000", currency_code: "USD" }, billing_cycle: { interval: "year", frequency: 1 } } }] })], meta: { pagination: { has_more: false } } }
      : { data: [psub()], meta: { pagination: { has_more: true, next: "https://sandbox-api.paddle.com/subscriptions?after=sub_1" } } };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    assert.deepEqual(await paddle.paddleRevenue.sync(PADDLE_KEY), { method: "paddle_subscriptions_v1", rows: [
      { currency: "eur", mrr_minor: 3000, paying_customers: 1, active_subscriptions: 1 },
      { currency: "usd", mrr_minor: 1000, paying_customers: 1, active_subscriptions: 1 },
    ] });
    assert.match(seen[0], /status=active,past_due/);
    assert.equal(seen.length, 2);
  } finally { globalThis.fetch = original; }
});
