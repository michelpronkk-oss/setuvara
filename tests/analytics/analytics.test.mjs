import assert from "node:assert/strict";

import { analyticsCapabilities } from "../../src/lib/analytics/capabilities.ts";
import { resolveAnalyticsQuery } from "../../src/lib/analytics/range.ts";

const today = new Date("2026-10-10T15:30:00.000Z");

Deno.test("analytics capability matrix follows Free, Plus, and Pro", () => {
  const free = analyticsCapabilities("free");
  const plus = analyticsCapabilities("plus");
  const pro = analyticsCapabilities("pro");

  assert.equal(free.maxHistoryDays, 7);
  assert.deepEqual(free.availableRanges, ["7d"]);
  assert.equal(free.sourceBreakdown, false);
  assert.equal(free.modeBreakdown, false);

  assert.equal(plus.maxHistoryDays, 90);
  assert.deepEqual(plus.availableRanges, ["7d", "30d", "90d"]);
  assert.equal(plus.sourceBreakdown, true);
  assert.equal(plus.modeBreakdown, true);
  assert.equal(plus.funnels, false);
  assert.equal(plus.exports, false);

  assert.equal(pro.maxHistoryDays, 730);
  assert.equal(pro.customRange, true);
  assert.equal(pro.funnels, true);
  assert.equal(pro.exports, true);
});

Deno.test("Free range is capped at seven UTC calendar days", () => {
  const result = resolveAnalyticsQuery(new URLSearchParams("range=7d"), analyticsCapabilities("free"), today);
  assert(result.ok);
  assert.deepEqual([result.data.startDate, result.data.endDate], ["2026-10-04", "2026-10-10"]);
  assert.deepEqual(
    resolveAnalyticsQuery(new URLSearchParams("range=30d"), analyticsCapabilities("free"), today),
    { ok: false, reason: "upgrade" },
  );
});

Deno.test("Plus permits curated history and source/mode filters but denies Pro ranges", () => {
  const plus = analyticsCapabilities("plus");
  assert(resolveAnalyticsQuery(new URLSearchParams("range=90d&source=qr&mode=event"), plus, today).ok);
  assert.deepEqual(
    resolveAnalyticsQuery(new URLSearchParams("range=custom&from=2026-10-01&to=2026-10-10"), plus, today),
    { ok: false, reason: "upgrade" },
  );
});

Deno.test("Pro custom ranges are inclusive, valid, and capped at 730 days", () => {
  const pro = analyticsCapabilities("pro");
  const allowed = resolveAnalyticsQuery(new URLSearchParams("range=custom&from=2024-10-12&to=2026-10-10"), pro, today);
  assert(allowed.ok);
  assert.equal(allowed.data.startDate, "2024-10-12");
  const dashboardCustom = resolveAnalyticsQuery(new URLSearchParams("range=90d&from=2024-10-12&to=2026-10-10"), pro, today);
  assert(dashboardCustom.ok);
  assert.equal(dashboardCustom.data.range, "custom");
  assert.deepEqual(
    resolveAnalyticsQuery(new URLSearchParams("range=custom&from=2024-10-10&to=2026-10-10"), pro, today),
    { ok: false, reason: "upgrade" },
  );
  assert.deepEqual(
    resolveAnalyticsQuery(new URLSearchParams("range=custom&from=2026-10-11&to=2026-10-12"), pro, today),
    { ok: false, reason: "invalid" },
  );
  assert.deepEqual(
    resolveAnalyticsQuery(new URLSearchParams("range=custom&from=2026-02-30&to=2026-03-01"), pro, today),
    { ok: false, reason: "invalid" },
  );
});

Deno.test("analytics filters reject unsupported, malformed, and non-entitled dimensions", () => {
  const free = analyticsCapabilities("free");
  const pro = analyticsCapabilities("pro");
  assert.deepEqual(resolveAnalyticsQuery(new URLSearchParams("mode=event"), free, today), { ok: false, reason: "upgrade" });
  assert.deepEqual(resolveAnalyticsQuery(new URLSearchParams("source=not-a-source"), pro, today), { ok: false, reason: "invalid" });
  assert.deepEqual(resolveAnalyticsQuery(new URLSearchParams("device=mobile"), pro, today), { ok: false, reason: "invalid" });
  assert(resolveAnalyticsQuery(new URLSearchParams("source=qr&mode=business"), pro, today).ok);
});
