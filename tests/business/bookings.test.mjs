// Smart Bookings model: weekly hours validation, grouping open times by the visitor's day, held times, .ics.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-bookings-"));
let model;
before(async () => {
  await build({ entryPoints: [join(root, "src/lib/business/bookings.ts")], bundle: true, format: "cjs", platform: "node", outfile: join(out, "bookings.cjs"), logLevel: "silent" });
  model = createRequire(import.meta.url)(join(out, "bookings.cjs"));
});
after(() => rmSync(out, { recursive: true, force: true }));

describe("weekly hours", () => {
  test("the default is weekdays nine to five", () => {
    const start = model.defaultAvailability("a", "Europe/Amsterdam");
    assert.deepEqual(Object.keys(start.weekly), ["1", "2", "3", "4", "5"]);
    assert.equal(model.weeklyProblem(start.weekly), null);
    assert.equal(model.openDays(start.weekly), 5);
  });
  test("ranges must end after they start, in order, three at most", () => {
    assert.match(model.weeklyProblem({ 1: [["17:00", "09:00"]] }), /end after/);
    assert.match(model.weeklyProblem({ 2: [["09:00", "13:00"], ["12:00", "17:00"]] }), /overlap/);
    assert.match(model.weeklyProblem({ 3: [["08:00", "09:00"], ["10:00", "11:00"], ["12:00", "13:00"], ["14:00", "15:00"]] }), /three/);
    assert.match(model.weeklyProblem({ 8: [["09:00", "17:00"]] }), /three|Up to/);
    assert.equal(model.weeklyProblem({ 6: [["20:00", "24:00"]] }), null);
  });
});

describe("open times", () => {
  const slots = ["2026-10-26T08:00:00Z", "2026-10-25T23:30:00Z", "2026-10-26T08:45:00Z"];
  test("grouped by the visitor's own day, earliest first", () => {
    const amsterdam = model.groupSlots(slots, "Europe/Amsterdam");
    assert.deepEqual(amsterdam.map((day) => day.key), ["2026-10-26"]);
    assert.deepEqual(amsterdam[0].slots.map((slot) => slot.time), ["00:30", "09:00", "09:45"]);
    const newYork = model.groupSlots(slots, "America/New_York");
    assert.deepEqual(newYork.map((day) => day.key), ["2026-10-25", "2026-10-26"]);
    assert.equal(newYork[0].slots[0].time, "19:30");
  });
  test("a zone reads as its city", () => assert.equal(model.zoneName("America/New_York"), "New York"));
});

describe("held times", () => {
  const at = (id, status, starts, ends) => ({ id, status, starts_at: starts, ends_at: ends, action_id: "a", submission_id: id, timezone: "UTC" });
  test("upcoming leaves out cancelled and past times", () => {
    const now = Date.parse("2026-10-26T12:00:00Z");
    const list = [at("b", "confirmed", "2026-10-27T09:00:00Z", "2026-10-27T10:00:00Z"), at("c", "cancelled", "2026-10-27T08:00:00Z", "2026-10-27T09:00:00Z"),
      at("d", "requested", "2026-10-26T11:00:00Z", "2026-10-26T11:30:00Z"), at("e", "requested", "2026-10-26T13:00:00Z", "2026-10-26T14:00:00Z")];
    assert.deepEqual(model.upcoming(list, now).map((item) => item.id), ["e", "b"]);
  });
  test(".ics escapes text and keeps UTC times", () => {
    const ics = model.bookingIcs({ id: "x", startsAt: "2026-10-27T09:00:00Z", endsAt: "2026-10-27T10:00:00Z", title: "Consult", attendee: "Mara; Vos, Co", note: "line one\nline two", stamp: new Date("2026-10-21T00:00:00Z") });
    assert.match(ics, /DTSTART:20261027T090000Z\r\n/);
    assert.ok(ics.includes("SUMMARY:Consult · Mara\\; Vos\\, Co\r\n"));
    assert.ok(ics.includes("DESCRIPTION:line one\\nline two\r\n"));
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
  });
});

describe("slot labels", () => {
  test("read the same everywhere, in the zone asked", () => {
    assert.equal(model.formatSlot("2026-10-27T09:00:00Z", "Europe/Amsterdam"), "Tue 27 Oct, 10:00");
    assert.equal(model.formatSlot("2026-10-27T09:00:00Z", "America/New_York"), "Tue 27 Oct, 05:00");
  });
});
