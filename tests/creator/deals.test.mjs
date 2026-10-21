// Creator deals model: filters, typed amounts and per-currency totals of the creator's own entries.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-deals-"));
let deals;
before(async () => {
  await build({ entryPoints: [join(root, "src/lib/creator/deals.ts")], bundle: true, format: "cjs", platform: "node", outfile: join(out, "deals.cjs"), logLevel: "silent" });
  deals = createRequire(import.meta.url)(join(out, "deals.cjs"));
});
after(() => rmSync(out, { recursive: true, force: true }));

const deal = (id, stage, brand, cents, currency, at = "2026-10-20T10:00:00Z") => ({ id, stage, brand, contact_name: "", contact_email: null, agreed_amount_cents: cents, currency, last_activity_at: at });

describe("deal filters", () => {
  const list = [deal("a", "new", "Oat Co", null, null, "2026-10-20T00:00:00Z"), deal("b", "booked", "Loom", 450000, "EUR", "2026-10-21T00:00:00Z"), deal("c", "paid", "Kite", 100000, "EUR"), deal("d", "declined", "Nope", null, null)];
  test("Open is New, Talking, Booked and Completed, newest first", () => assert.deepEqual(deals.filterDeals(list, "open", "").map((d) => d.id), ["b", "a"]));
  test("search finds a brand", () => assert.deepEqual(deals.filterDeals(list, "all", "oat").map((d) => d.id), ["a"]));
});

describe("amounts", () => {
  test("typed amounts become minor units", () => {
    assert.equal(deals.parseAmount("4,500"), 450000);
    assert.equal(deals.parseAmount("4500.5"), 450050);
    assert.equal(deals.parseAmount(" 12 "), 1200);
  });
  test("anything else is refused", () => { for (const bad of ["", "-5", "1.234", "abc", "1e5", "9999999999"]) assert.equal(deals.parseAmount(bad), null, bad); });
  test("totals stay per currency and count only recorded fees", () => {
    const list = [deal("a", "booked", "A", 450000, "EUR"), deal("b", "completed", "B", 50000, "EUR"), deal("c", "paid", "C", 100000, "EUR"), deal("d", "paid", "D", 20000, "USD"), deal("e", "new", "E", 999999, "EUR"), deal("f", "booked", "F", null, null)];
    assert.deepEqual(deals.dealTotals(list), [{ currency: "EUR", booked: 500000, paid: 100000 }, { currency: "USD", booked: 0, paid: 20000 }]);
  });
});
