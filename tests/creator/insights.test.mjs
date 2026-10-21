// Creator Insights: audience growth, brand deal outcomes and store money over one range.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-insights-"));
let insights;
before(async () => {
  await build({ entryPoints: [join(root, "src/lib/creator/insights.ts")], bundle: true, format: "cjs", platform: "node", alias: { "@": join(root, "src") }, outfile: join(out, "insights.cjs"), logLevel: "silent" });
  insights = createRequire(import.meta.url)(join(out, "insights.cjs"));
});
after(() => rmSync(out, { recursive: true, force: true }));

const now = new Date("2026-10-21T12:00:00Z");

describe("range", () => {
  test("7 days runs from midnight UTC six days ago through today", () => {
    assert.equal(insights.rangeSince(7, now), "2026-10-15T00:00:00.000Z");
    assert.deepEqual(insights.rangeDays(3, now), ["2026-10-19", "2026-10-20", "2026-10-21"]);
  });
});

describe("audience", () => {
  const sub = (email, status, verified_at, unsubscribed_at = null) => ({ email, status, verified_at, unsubscribed_at });
  const rows = [
    sub("A@x.com", "subscribed", "2026-10-20T08:00:00Z"),
    sub("a@x.com", "subscribed", "2026-10-01T08:00:00Z"),
    sub("b@x.com", "unsubscribed", "2026-10-02T08:00:00Z", "2026-10-19T09:00:00Z"),
    sub("c@x.com", "pending_verification", null),
  ];
  test("one email on two lists is one person; pending people aren't counted", () => assert.equal(insights.audienceInsight(rows, 7, now).subscribed, 1));
  test("joined and left count only the range, and net is their difference", () => {
    const result = insights.audienceInsight(rows, 7, now);
    assert.deepEqual([result.joined, result.left, result.net], [1, 1, 0]);
    assert.equal(result.daily.find((row) => row.day === "2026-10-20").joined, 1);
    assert.equal(result.daily.find((row) => row.day === "2026-10-19").left, 1);
  });
});

describe("collaborations", () => {
  const deal = (id, stage, created_at, cents = null, currency = null, stage_changed_at = created_at) => ({ id, stage, created_at, stage_changed_at, agreed_amount_cents: cents, currency });
  const deals = [
    deal("a", "paid", "2026-10-16T10:00:00Z", 100000, "EUR", "2026-10-20T10:00:00Z"),
    deal("b", "declined", "2026-10-17T10:00:00Z"),
    deal("c", "booked", "2026-10-18T10:00:00Z", 50000, "USD"),
    deal("d", "new", "2026-10-20T10:00:00Z"),
    deal("old", "paid", "2026-09-01T10:00:00Z", 999900, "EUR", "2026-09-10T10:00:00Z"),
  ];
  const moves = [
    { deal_id: "a", kind: "stage", from_stage: "new", created_at: "2026-10-16T12:00:00Z" },
    { deal_id: "a", kind: "stage", from_stage: "talking", created_at: "2026-10-17T12:00:00Z" },
    { deal_id: "b", kind: "stage", from_stage: "new", created_at: "2026-10-17T16:00:00Z" },
    { deal_id: "c", kind: "stage", from_stage: "new", created_at: "2026-10-18T20:00:00Z" },
  ];
  const result = () => insights.dealInsight(deals, moves, 7, now);
  test("inquiries, wins and declines are this range's deals", () => assert.deepEqual([result().inquiries, result().won, result().declined], [4, 2, 1]));
  test("win rate only counts decided deals", () => assert.equal(result().winRate, 2 / 3));
  test("first reply is the median wait out of New", () => assert.equal(result().medianReplyHours, 6));
  test("paid counts deals marked Paid in range; currencies stay apart", () => {
    assert.deepEqual(result().paid, [{ currency: "EUR", amount: 100000 }]);
    assert.deepEqual(result().pipeline, [{ currency: "USD", amount: 50000 }]);
  });
  test("nothing decided yet is null, not zero", () => assert.equal(insights.dealInsight([deal("x", "new", "2026-10-20T10:00:00Z")], [], 7, now).winRate, null));
});

describe("store", () => {
  const order = (id, over = {}) => ({ id, offer_id: "o1", order_kind: "purchase", status: "paid", currency: "EUR", gross_amount_minor: 1000, platform_fee_amount_minor: 0, provider_fee_amount_minor: 50, amount_refunded_minor: 0, buyer_email: "x@y.com", livemode: true, paid_at: "2026-10-20T10:00:00Z", ...over });
  test("money is kept per currency for purchases paid in range, refunds off", () => {
    const orders = [order("1"), order("2", { status: "partially_refunded", amount_refunded_minor: 400 }), order("3", { paid_at: "2026-09-01T00:00:00Z" }), order("4", { currency: "USD", buyer_email: "z@y.com" })];
    const result = insights.storeInsight(orders, [], [{ offer_id: "o1", day: "2026-10-19", views: 30, checkout_starts: 4 }], 7, now);
    assert.equal(result.purchases, 3);
    assert.deepEqual(result.totals.map((row) => [row.currency, row.net]), [["EUR", 1000 + 600 - 100], ["USD", 950]]);
    assert.equal(result.buyers, 2);
    assert.equal(result.returning, 1);
    assert.equal(result.conversion, 3 / 30);
  });
  test("free claims are counted apart and never as purchases", () => {
    const result = insights.storeInsight([order("1", { order_kind: "free_claim", gross_amount_minor: 0 })], [], [], 7, now);
    assert.deepEqual([result.purchases, result.freeClaims, result.conversion], [0, 1, null]);
  });
  test("test payments never mix with live ones", () => {
    const mixed = insights.storeInsight([order("1"), order("2", { livemode: false })], [], [], 7, now);
    assert.deepEqual([mixed.purchases, mixed.test], [1, false]);
    const testOnly = insights.storeInsight([order("2", { livemode: false })], [], [], 7, now);
    assert.deepEqual([testOnly.purchases, testOnly.test], [1, true]);
  });
  test("unpaid and failed orders never count", () => {
    const result = insights.storeInsight([order("1", { status: "pending", paid_at: null }), order("2", { status: "failed", paid_at: null })], [], [], 7, now);
    assert.equal(result.purchases, 0);
  });
});
