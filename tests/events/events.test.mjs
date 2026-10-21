/**
 * Events: guest link tokens, the lifecycle and time-zone rules, calendar files and guest emails.
 *
 *   npm run test:events
 *
 * Bundles the pure helpers with esbuild; no database or network. Capacity, waitlist, RLS and
 * cancellation are in supabase/tests/event_foundation_security.sql; concurrency in
 * tests/events/concurrency.integration.mjs.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-events-"));
let token, model, mail;

before(async () => {
  const stub = join(out, "server-only.js");
  writeFileSync(stub, "");
  const bundle = async (entry, name) => {
    await build({ entryPoints: [join(root, entry)], bundle: true, format: "cjs", platform: "node", alias: { "@": join(root, "src"), "server-only": stub }, outfile: join(out, `${name}.cjs`), logLevel: "silent" });
    return createRequire(import.meta.url)(join(out, `${name}.cjs`));
  };
  process.env.EVENT_TOKEN_SECRET = "test-secret-for-event-links";
  [token, model, mail] = await Promise.all([bundle("src/lib/events/token.ts", "token"), bundle("src/lib/events/model.ts", "model"), bundle("src/lib/events/mail.ts", "mail")]);
});
after(() => rmSync(out, { recursive: true, force: true }));

const id = "0b6f5f8e-3c55-4a8f-9a40-5d2e1f8c7a11";

describe("guest link token", () => {
  test("round-trips with its version", () => assert.deepEqual(token.readGuestToken(token.signGuestToken(id, 3)), { id, version: 3 }));
  test("another registration's id with this signature is refused", () => {
    const [, version, signature] = token.signGuestToken(id, 1).split(".");
    assert.equal(token.readGuestToken(`1b6f5f8e-3c55-4a8f-9a40-5d2e1f8c7a11.${version}.${signature}`), null);
  });
  test("a bumped version cannot be forged from an old link", () => {
    const [, , signature] = token.signGuestToken(id, 1).split(".");
    assert.equal(token.readGuestToken(`${id}.2.${signature}`), null);
  });
  test("a flipped signature character is refused", () => {
    const signed = token.signGuestToken(id, 1);
    const last = signed.at(-1) === "A" ? "B" : "A";
    assert.equal(token.readGuestToken(signed.slice(0, -1) + last), null);
  });
  test("a token signed with another secret is refused", () => {
    const signed = token.signGuestToken(id, 1);
    process.env.EVENT_TOKEN_SECRET = "another-secret";
    try { assert.equal(token.readGuestToken(signed), null); } finally { process.env.EVENT_TOKEN_SECRET = "test-secret-for-event-links"; }
  });
  test("malformed tokens are refused", () => {
    for (const bad of [null, "", "x", `${id}`, `${id}.1`, `${id}.0.abc`, `${id}.1.abc.extra`, `${id.toUpperCase()}.1.abc`, "a".repeat(200)]) assert.equal(token.readGuestToken(bad), null);
  });
});

describe("door pass token", () => {
  test("round-trips with its version", () => assert.deepEqual(token.readPassToken(token.signPassToken(id, 2)), { id, version: 2 }));
  test("a guest link is never accepted as a door pass, or the other way round", () => {
    assert.equal(token.readPassToken(token.signGuestToken(id, 1)), null);
    assert.equal(token.readGuestToken(token.signPassToken(id, 1)), null);
  });
});

describe("lifecycle", () => {
  const base = { status: "published", starts_at: "2026-11-04T18:00:00Z", ends_at: "2026-11-04T21:00:00Z", registration_opens_at: null, registration_closes_at: null };
  const at = (iso) => new Date(iso).getTime();
  test("phases follow the clock", () => {
    assert.equal(model.eventPhase(base, at("2026-11-04T17:59:00Z")), "upcoming");
    assert.equal(model.eventPhase(base, at("2026-11-04T18:00:00Z")), "live");
    assert.equal(model.eventPhase(base, at("2026-11-04T21:00:00Z")), "ended");
    assert.equal(model.eventPhase({ ...base, status: "cancelled" }, at("2026-11-01T00:00:00Z")), "cancelled");
    assert.equal(model.eventPhase({ ...base, status: "draft" }, at("2026-11-01T00:00:00Z")), "draft");
  });
  test("check-in runs from 12 hours before the start to 12 hours after the end", () => {
    assert.equal(model.checkInWindow(base, at("2026-11-04T05:59:00Z")), "soon");
    assert.equal(model.checkInWindow(base, at("2026-11-04T06:00:00Z")), "open");
    assert.equal(model.checkInWindow(base, at("2026-11-05T09:00:00Z")), "open");
    assert.equal(model.checkInWindow(base, at("2026-11-05T09:01:00Z")), "closed");
    assert.equal(model.checkInWindow({ ...base, status: "cancelled" }, at("2026-11-04T19:00:00Z")), "closed");
    assert.equal(model.checkInWindow({ ...base, status: "draft" }, at("2026-11-04T19:00:00Z")), "closed");
  });
  test("the door scanner only takes door pass links, never a profile QR", () => {
    const token = "0b7c2a52-8c35-4d6e-9f41-1d6f1c1e2a3b.1.AbCdEfGhIjKlMnOpQrStUvWxYz012345";
    assert.equal(model.passTokenFromScan(`https://setuvara.com/app/identity/events/check-in/${token}`), token);
    assert.equal(model.passTokenFromScan(` http://localhost:3000/app/identity/events/check-in/${token}/ `), token);
    assert.equal(model.passTokenFromScan("https://setuvara.com/aanya"), null);
    assert.equal(model.passTokenFromScan("https://setuvara.com/s/Ab12Cd34"), null);
    assert.equal(model.passTokenFromScan(token), null);
    assert.equal(model.passTokenFromScan(`https://setuvara.com/app/identity/events/check-in/${token}/extra`), null);
    assert.equal(model.passTokenFromScan(`https://setuvara.com/app/identity/events/check-in/a<b>c${token}`), null);
    assert.equal(model.passTokenFromScan(`https://x.test/app/identity/events/check-in/${"a".repeat(500)}`), null);
  });
  test("RSVPs close at the start by default, or when the organizer chose, never after the end", () => {
    assert.equal(model.registrationWindow(base, at("2026-11-04T17:59:00Z")), "open");
    assert.equal(model.registrationWindow(base, at("2026-11-04T18:00:00Z")), "closed");
    assert.equal(model.registrationWindow({ ...base, registration_closes_at: base.ends_at }, at("2026-11-04T19:00:00Z")), "open");
    assert.equal(model.registrationWindow({ ...base, registration_opens_at: "2026-11-02T00:00:00Z" }, at("2026-11-01T00:00:00Z")), "soon");
  });
  test("availability: seats, then waitlist, then full", () => {
    assert.equal(model.availability({ capacity: null, confirmed_count: 900, waitlist_enabled: false }), "seats");
    assert.equal(model.availability({ capacity: 2, confirmed_count: 2, waitlist_enabled: true }), "waitlist");
    assert.equal(model.availability({ capacity: 2, confirmed_count: 2, waitlist_enabled: false }), "full");
  });
  test("spots left shows only near the end", () => {
    assert.equal(model.spotsLeftNote({ capacity: 100, confirmed_count: 10 }), null);
    assert.equal(model.spotsLeftNote({ capacity: 100, confirmed_count: 85 }), "15 spots left");
    assert.equal(model.spotsLeftNote({ capacity: 5, confirmed_count: 4 }), "1 spot left");
  });
});

describe("time zones", () => {
  test("wall-clock times convert in the event's zone, across daylight saving", () => {
    assert.equal(model.zonedToUtc("2026-07-01", "19:30", "Europe/Amsterdam"), "2026-07-01T17:30:00.000Z");
    assert.equal(model.zonedToUtc("2026-12-01", "19:30", "Europe/Amsterdam"), "2026-12-01T18:30:00.000Z");
    assert.equal(model.zonedToUtc("2026-11-04", "09:00", "America/New_York"), "2026-11-04T14:00:00.000Z");
    assert.equal(model.zonedToUtc("2026-11-04", "09:00", "Asia/Kolkata"), "2026-11-04T03:30:00.000Z");
  });
  test("a time skipped by spring-forward still lands on a real instant", () => {
    const iso = model.zonedToUtc("2026-03-29", "02:30", "Europe/Amsterdam");
    assert.ok(iso === "2026-03-29T01:30:00.000Z" || iso === "2026-03-29T00:30:00.000Z", iso);
  });
  test("utcToZoned is the inverse", () => assert.deepEqual(model.utcToZoned("2026-07-01T17:30:00Z", "Europe/Amsterdam"), { date: "2026-07-01", time: "19:30" }));
  test("guests see the event's own zone", () => {
    const when = model.eventWhen({ starts_at: "2026-11-04T18:00:00Z", ends_at: "2026-11-04T21:00:00Z", timezone: "Europe/Amsterdam" });
    assert.match(when.time, /^19:00 – 22:00 /);
  });
  test("unknown zones are refused", () => {
    assert.equal(model.isTimeZone("Europe/Amsterdam"), true);
    assert.equal(model.isTimeZone("Mars/Olympus"), false);
  });
});

describe("pages, calendar files and emails", () => {
  test("slugs are plain and short", () => {
    assert.equal(model.slugify("Slush 2026 — Afterparty!"), "slush-2026-afterparty");
    assert.equal(model.slugify("Café Été"), "cafe-ete");
    assert.equal(model.slugify("###"), "");
    assert.ok(model.slugify("a ".repeat(80)).length <= 60);
    assert.equal(model.eventPath({ short_id: "Xa7k2Pq9", slug: "" }), "/e/Xa7k2Pq9");
  });
  test("calendar files escape text and use UTC", () => {
    const ics = model.eventIcs({ id, title: "Dinner, drinks; more", summary: "Line one\nLine two", starts_at: "2026-11-04T18:00:00Z", ends_at: "2026-11-04T21:00:00Z", venue_name: "Hotel", address: "", city: "Amsterdam", online_url: null, updated_at: "2026-10-21T00:00:00Z" }, "https://setuvara.com/e/Xa7k2Pq9");
    assert.ok(ics.includes("SUMMARY:Dinner\\, drinks\\; more"));
    assert.ok(ics.includes("DTSTART:20261104T180000Z"));
    assert.ok(ics.split("\r\n").every((line) => line.length <= 75));
  });
  test("guest emails escape organizer text and carry the private link", () => {
    const email = mail.renderGuestEmail({ kind: "confirmed", event: { title: "<b>Party</b>", starts_at: "2026-11-04T18:00:00Z", ends_at: "2026-11-04T21:00:00Z", timezone: "UTC", venue_name: "<script>", address: "", city: "", online_url: null }, organizer: "Eve\r\nBcc: x", manageUrl: "https://setuvara.com/e/r/abc", eventUrl: "https://setuvara.com/e/Xa7k2Pq9" });
    assert.ok(!email.html.includes("<b>Party</b>"));
    assert.ok(!email.html.includes("<script>"));
    assert.ok(!/[\r\n]/.test(email.subject));
    assert.ok(email.text.includes("https://setuvara.com/e/r/abc"));
  });
});
