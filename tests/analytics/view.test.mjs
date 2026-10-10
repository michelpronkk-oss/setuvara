import assert from "node:assert/strict";

import { normalizeAnalytics } from "../../src/lib/analytics/normalize.ts";
import {
  barReadout, chartBars, chartSummary, deltaView, deviceLead, deviceRows, filledDots, growthTitle, isDayOne, loopSteps,
  modeLead, modeRows, pageTitle, rateLabel, rateLine, scanMethods, scanTotal, sourceLead, sourceRows,
} from "../../src/lib/analytics/view.ts";

const fmt = (value) => new Intl.NumberFormat("en-US").format(value);
const summary = (overrides = {}) => ({ profile_views: 0, qr_scans: 0, quick_qr_scans: 0, tap_scans: 0, connections: 0, ...overrides });
const response = (overrides = {}) => ({
  plan: "free",
  range: { kind: "7d", start: "2026-10-04", end: "2026-10-10" },
  summary: { profileViews: 0, qrScans: 0, quickQrScans: 0, tapScans: 0, connections: 0, conversionRate: 0 },
  daily: [], sources: [], modes: [], deviceClasses: [], funnel: [],
  comparison: { profileViewsDelta: null, connectionsDelta: null },
  capabilities: { historyDays: 7, availableRanges: ["7d"] },
  ...overrides,
});
const NO_NAN = (value) => assert.equal(/NaN|Infinity|undefined/.test(JSON.stringify(value)), false, JSON.stringify(value));

Deno.test("a 200 with all zeros normalizes to Day One, never to an error", () => {
  for (const plan of ["free", "plus", "pro"]) {
    const data = normalizeAnalytics(response({ plan }));
    assert(data, `${plan} zero payload must be valid`);
    assert.equal(isDayOne(data.summary), true);
    assert.equal(pageTitle(data), "Your story starts the first time you share.");
    assert.deepEqual([data.daily, data.modes, data.sources, data.deviceClasses, data.funnel], [[], [], [], [], []]);
  }
});

Deno.test("broken payloads are errors, not zeros", () => {
  assert.equal(normalizeAnalytics(null), null);
  assert.equal(normalizeAnalytics({ error: "analytics_unavailable" }), null);
  assert.equal(normalizeAnalytics({ plan: "free" }), null);
  assert.equal(normalizeAnalytics({ plan: "gold", summary: summary() }), null, "client plan spoofing is rejected");
  assert.equal(normalizeAnalytics({ plan: "free", summary: summary({ profile_views: -1 }) }), null);
  assert.equal(normalizeAnalytics({ plan: "free", summary: summary({ profile_views: Number.NaN }) }), null);
  assert.equal(normalizeAnalytics({ plan: "free", summary: { profile_views: 3 } }), null);
});

Deno.test("breakdown rows with bad counts are dropped instead of producing NaN", () => {
  const data = normalizeAnalytics(response({
    plan: "pro",
    sources: [{ source: "qr", count: 3 }, { source: "tap", count: "7" }, { source: "link", count: -2 }, { count: 4 }],
    modes: [{ mode: "event", count: 2 }, { mode: "event", count: Number.POSITIVE_INFINITY }],
    deviceClasses: [{ device_class: "mobile", count: 5 }],
    funnel: [{ step: "shares", count: 1 }, { step: "profile_views", count: null }],
    daily: [{ date: "2026-10-10", profile_views: 2, connections: 0 }, { date: "bad", profile_views: 1, connections: 0 }],
  }));
  assert.deepEqual(data.sources, [{ source: "qr", count: 3 }]);
  assert.deepEqual(data.modes, [{ mode: "event", count: 2 }]);
  assert.deepEqual(data.deviceClasses, [{ device: "mobile", count: 5 }]);
  assert.deepEqual(data.funnel, [{ step: "shares", count: 1 }]);
  assert.equal(data.daily.length, 1);
});

Deno.test("scans are the sum of QR, Quick QR and Tap without double counting", () => {
  const data = normalizeAnalytics(response({ summary: { profileViews: 10, qrScans: 2, quickQrScans: 5, tapScans: 1, connections: 0 } }));
  assert.equal(scanTotal(data.summary), 8);
  assert.deepEqual(scanMethods(data.summary).map((item) => [item.label, item.count]), [["Quick QR", 5], ["QR code", 2], ["Setuvara Tap", 1]]);
  assert.equal(isDayOne(data.summary), false);
});

Deno.test("partial data: views without Connections and Connections without scans", () => {
  assert.equal(rateLine(0, 40), "No views turned into Connections in this period yet.");
  assert.equal(rateLabel(0), "0.0%");
  assert.equal(filledDots(0), 0);
  const connectedOnly = normalizeAnalytics(response({ summary: { profileViews: 0, qrScans: 0, quickQrScans: 0, tapScans: 0, connections: 2, conversionRate: 0 } }));
  assert.equal(isDayOne(connectedOnly.summary), false);
  assert.match(rateLine(connectedOnly.summary.conversionRate, 0), /Once people open your Setuvara/);
});

Deno.test("conversion copy talks about views, not unique people, and dots never exceed 100", () => {
  assert.equal(rateLabel(8.97), "9.0%");
  assert.equal(rateLine(9, 312), "For every 100 views, about 9 people connect with you.");
  assert.equal(rateLine(1.2, 100), "For every 100 views, about 1 person connects with you.");
  assert.equal(rateLine(0.3, 1000), "For every 100 views, fewer than one person connects with you.");
  assert.equal(filledDots(0.3), 1, "any rate above zero fills one dot");
  assert.equal(filledDots(250), 100);
  assert.match(rateLine(250, 2), /More Connections than views/);
});

Deno.test("deltas: positive, negative, level, and null", () => {
  assert.deepEqual(deltaView(12, "previous 7 days"), { text: "▲ 12% vs previous 7 days", tone: "up" });
  assert.deepEqual(deltaView(-6.5, "previous 30 days"), { text: "▼ 6.5% vs previous 30 days", tone: "down" });
  assert.equal(deltaView(0, "previous 7 days").tone, "flat");
  assert.deepEqual(deltaView(null, "previous 7 days"), { text: "First period, nothing to compare yet.", tone: "none" });
  assert.equal(growthTitle("30d", 18), "Busier than last month.");
  assert.equal(growthTitle("30d", -3), "A quieter stretch.");
  assert.equal(growthTitle("custom", null), "Your first stretch.");
});

Deno.test("headlines derive from real data, never sample copy", () => {
  const base = { plan: "plus", summary: { profileViews: 5, qrScans: 0, quickQrScans: 0, tapScans: 0, connections: 0 } };
  assert.equal(pageTitle({ ...base, range: { kind: "7d", start: "2026-10-04", end: "2026-10-10" }, comparison: { profileViewsDelta: 4, connectionsDelta: null } }), "A good week for being found.");
  assert.equal(pageTitle({ ...base, range: { kind: "30d", start: "2026-09-11", end: "2026-10-10" }, comparison: { profileViewsDelta: 4, connectionsDelta: null } }), "Your world grew this month.");
  assert.equal(pageTitle({ ...base, range: { kind: "30d", start: "2026-09-11", end: "2026-10-10" }, comparison: { profileViewsDelta: null, connectionsDelta: null } }), "People are starting to find you.");
  assert.equal(pageTitle({ ...base, range: { kind: "custom", start: "2026-07-13", end: "2026-10-10" } }, new Date("2026-10-10T12:00:00Z")), "Your signals since July.");
  assert.equal(pageTitle({ ...base, range: { kind: "custom", start: "2025-07-13", end: "2026-10-10" } }, new Date("2026-10-10T12:00:00Z")), "Your signals since July 2025.");
  assert.equal(pageTitle(null), "Your signals");
});

Deno.test("Modes: share of views per Mode, one-Mode and empty cases", () => {
  assert.deepEqual(modeRows([]), []);
  const one = modeRows([{ mode: "business", count: 4 }]);
  assert.equal(one[0].share, 1);
  assert.equal(modeLead(one), "Only Business was opened.");
  const many = modeRows([{ mode: "event", count: 46 }, { mode: "personal", count: 164 }, { mode: "business", count: 102 }]);
  assert.deepEqual(many.map((row) => row.label), ["Personal", "Business", "Event"]);
  assert.equal(many[0].color, "#FF5A4F");
  assert.equal(modeLead(many), "Personal is doing most of the work.");
  NO_NAN(modeRows([{ mode: "personal", count: 0 }]));
});

Deno.test("Sources: human labels, top six plus Other, one-source case", () => {
  const rows = sourceRows([
    { source: "quick_qr", count: 98 }, { source: "link", count: 71 }, { source: "tap", count: 52 }, { source: "qr", count: 41 },
    { source: "native_share", count: 28 }, { source: "direct", count: 22 }, { source: "profile", count: 5 }, { source: "other", count: 3 },
  ]);
  assert.deepEqual(rows.map((row) => row.label), ["Quick QR", "Shared link", "Setuvara Tap", "QR code", "Share sheet", "Opened directly", "Other"]);
  assert.equal(rows.at(-1).count, 8);
  assert.equal(sourceLead(rows), "Most people find you through Quick QR.");
  const single = sourceRows([{ source: "direct", count: 1 }]);
  assert.equal(sourceLead(single), "Most people open your Setuvara directly.");
  assert.equal(rows.some((row) => /wallet/i.test(row.label)), false, "no Wallet count is ever emitted");
});

Deno.test("Pro loop keeps share → views → Connections order without rates", () => {
  assert.deepEqual(loopSteps([]), []);
  const steps = loopSteps([{ step: "profile_views", count: 1048 }, { step: "shares", count: 132 }, { step: "connections", count: 87 }]);
  assert.deepEqual(steps.map((step) => step.key), ["shares", "profile_views", "connections"]);
  assert.equal(JSON.stringify(steps).includes("%"), false);
});

Deno.test("Devices map classes to human labels", () => {
  const rows = deviceRows([{ device: "mobile", count: 912 }, { device: "desktop", count: 104 }, { device: "tablet", count: 32 }, { device: "unknown", count: 9 }]);
  assert.deepEqual(rows.map((row) => row.label), ["Phone", "Desktop", "Tablet"]);
  assert.equal(deviceLead(rows), "Mostly in someone's hand.");
  assert.deepEqual(deviceRows([]), []);
});

Deno.test("growth chart: daily bars up to 90 days, weekly buckets beyond, safe when empty", () => {
  assert.deepEqual(chartBars([]), { unit: "day", bars: [] });
  assert.equal(chartSummary([], "day", fmt), "");
  const days = Array.from({ length: 200 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 2, 1) + index * 86_400_000).toISOString().slice(0, 10);
    return { date, profileViews: index % 3, connections: index % 50 === 0 ? 1 : 0 };
  });
  const daily = chartBars(days.slice(0, 90));
  assert.equal(daily.unit, "day");
  assert.equal(daily.bars.length, 90);
  const weekly = chartBars(days);
  assert.equal(weekly.unit, "week");
  assert.equal(weekly.bars.length, Math.ceil(200 / 7));
  assert.equal(weekly.bars.reduce((sum, bar) => sum + bar.views, 0), days.reduce((sum, day) => sum + day.profileViews, 0));
  assert.match(barReadout(weekly.bars[0], "week", fmt), /^WEEK OF MAR 1 · /);
  NO_NAN(chartSummary(weekly.bars, "week", fmt));
  const flat = chartBars([{ date: "2026-10-10", profileViews: 0, connections: 0 }]);
  NO_NAN(chartSummary(flat.bars, "day", fmt));
});
