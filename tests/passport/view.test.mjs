/**
 * Passport presentation helpers: covers, milestone line, collection, journey and labels.
 *
 *   npm run test:passport
 *
 * Bundles the pure view helpers with esbuild; no database or browser needed.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-passport-"));
let lib;

before(async () => {
  await build({
    entryPoints: [join(root, "src/lib/passport/view.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    alias: { "@": join(root, "src") },
    outfile: join(out, "view.cjs"),
    logLevel: "silent",
  });
  lib = createRequire(import.meta.url)(join(out, "view.cjs"));
});
after(() => rmSync(out, { recursive: true, force: true }));

const stamp = (extra) => ({ id: extra.title, subtitle: null, countryCode: "NL", earnedAt: "2026-10-04T12:00:00Z", ...extra });

describe("covers", () => {
  test("are earned at 0, 5, 100 and 1000; unknown ids fall back to Standard", () => {
    assert.deepEqual(lib.COVERS.map((cover) => cover.at), [0, 5, 100, 1000]);
    assert.equal(lib.coverFor("century_cover").look, "century");
    assert.equal(lib.coverFor("nope").id, "standard");
    assert.equal(lib.coverFor(null).id, "standard");
  });
});

describe("milestones", () => {
  test("tiers: ring, perforated, ink disc, gold only at 1000", () => {
    assert.deepEqual([5, 10, 25, 50, 100, 250, 500, 1000].map(lib.milestoneTier), [1, 1, 1, 2, 2, 3, 3, 4]);
  });
  test("ordinal and names follow the ladder", () => {
    assert.equal(lib.ordinalOf(100), "05 OF 08");
    assert.equal(lib.milestoneName(250), "Connector");
    assert.equal(lib.nextMilestone(87).threshold, 100);
    assert.equal(lib.nextMilestone(1000), null);
  });
  test("ruler uses ordinal spacing and interpolates inside the active segment", () => {
    const ruler = lib.milestoneRuler(75);
    assert.deepEqual(ruler.markers.map((marker) => Math.round(marker.x)), [0, 14, 29, 43, 57, 71, 86, 100]);
    assert.equal(ruler.markers[3].state, "earned");
    assert.equal(ruler.markers[4].state, "next");
    assert.equal(ruler.markers[5].state, "future");
    assert.ok(Math.abs(ruler.fill - (3.5 / 7) * 100) < 1e-9);
    assert.equal(lib.milestoneRuler(0).fill, 0);
    assert.equal(lib.milestoneRuler(5000).fill, 100);
  });
  test("threshold comes from key, title or subtitle", () => {
    assert.equal(lib.stampThreshold({ type: "milestone", key: "50", title: "x", subtitle: null }), 50);
    assert.equal(lib.stampThreshold({ type: "milestone", title: "Century", subtitle: null }), 100);
    assert.equal(lib.stampThreshold({ type: "milestone", title: "?", subtitle: "250 Connections" }), 250);
    assert.equal(lib.stampThreshold({ type: "city", title: "Amsterdam", subtitle: null }), null);
  });
});

describe("collection", () => {
  const stamps = [
    stamp({ type: "milestone", key: "50", title: "Signal 50" }),
    stamp({ type: "city", title: "Amsterdam" }),
    stamp({ type: "event", title: "Founders Night" }),
    stamp({ type: "country", title: "NL" }),
  ];
  test("all shows earned, then progress and one locked milestone, no further", () => {
    const items = lib.collectionItems(stamps, 87, "all");
    assert.equal(items.length, 6);
    assert.deepEqual(items.slice(4), [{ kind: "ahead", threshold: 100, state: "progress" }, { kind: "ahead", threshold: 250, state: "locked" }]);
  });
  test("place filters show only earned stamps of that family", () => {
    assert.deepEqual(lib.collectionItems(stamps, 87, "city").map((item) => item.stamp.title), ["Amsterdam"]);
    assert.equal(lib.collectionItems(stamps, 1200, "milestone").length, 1);
  });
  test("filter counts", () => {
    assert.deepEqual(lib.filterCounts(stamps, 11), { all: 11, milestone: 1, city: 1, event: 1, country: 1 });
  });
  test("new means unseen milestone, or a place earned in the last seven days", () => {
    const now = Date.parse("2026-10-10T00:00:00Z");
    const milestone = stamps[0];
    assert.equal(lib.isNewStamp(milestone, [{ threshold: 50, unlockedAt: "", seenAt: null }], now), true);
    assert.equal(lib.isNewStamp(milestone, [{ threshold: 50, unlockedAt: "", seenAt: "2026-10-05T00:00:00Z" }], now), false);
    assert.equal(lib.isNewStamp(stamps[1], [], now), true);
    assert.equal(lib.isNewStamp({ ...stamps[1], earnedAt: "2026-09-01T00:00:00Z" }, [], now), false);
  });
});

describe("journey", () => {
  test("groups by UTC month, newest first, ending at the issue month", () => {
    const months = lib.journeyMonths([
      stamp({ type: "city", title: "Utrecht", earnedAt: "2026-06-30T23:30:00Z" }),
      stamp({ type: "milestone", key: "50", title: "Signal 50", earnedAt: "2026-10-02T00:00:00Z" }),
      stamp({ type: "event", title: "Founders Night", earnedAt: "2026-10-03T00:00:00Z" }),
      stamp({ type: "city", title: "Amsterdam", earnedAt: "2026-10-01T00:00:00Z" }),
      stamp({ type: "country", title: "NL", earnedAt: "2026-10-01T00:00:00Z" }),
    ], "2025-03-12T00:00:00Z");
    assert.deepEqual(months.map((month) => month.month), ["OCT 2026", "JUN 2026", "MAR 2025"]);
    assert.equal(months[0].head, "Amsterdam · Founders Night");
    assert.equal(months[0].line, "Signal 50 earned · Netherlands");
    assert.equal(months[1].line, "1 stamp");
    assert.equal(months[2].head, "Passport issued");
  });
  test("caps place headlines at three", () => {
    const months = lib.journeyMonths(["A", "B", "C", "D", "E"].map((title) => stamp({ type: "city", title })), null);
    assert.equal(months[0].head, "A · B · C +2");
    assert.equal(months.length, 1);
  });
});

describe("copy", () => {
  test("summary sentence skips empty families and pluralises", () => {
    assert.equal(lib.summarySentence({ milestones: 4, cities: 1, events: 0, countries: 2, since: "2025-03-01T00:00:00Z" }), "4 milestones, 1 city and 2 countries in your Passport since March 2025.");
    assert.equal(lib.summarySentence({ milestones: 0, cities: 0, events: 0, countries: 0, since: null }), "Your Passport, kept.");
  });
  test("country labels use the ISO code", () => {
    assert.equal(lib.stampLabel({ type: "country", title: "PT", countryCode: "PT" }), "Portugal");
  });
  test("serial is stable and visual only", () => {
    assert.match(lib.coverSerial("michel"), /^Nº \d{4} \d{4}$/);
    assert.equal(lib.coverSerial("michel"), lib.coverSerial("michel"));
  });
  test("rotation stays within −8° … +6°", () => {
    for (const key of ["a", "Amsterdam", "東京", "50", ""]) {
      const value = lib.stampRotation(key);
      assert.ok(value >= -8 && value <= 6, `${key}: ${value}`);
    }
  });
});
