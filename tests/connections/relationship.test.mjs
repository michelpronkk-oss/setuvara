/**
 * Connection semantics: Person / Connection / Encounter / Memory stay separate.
 *
 *   npm run test:connections
 *
 * Bundles the pure relationship resolver with esbuild; no database or browser needed.
 * The live wiring (RLS, saving, the page itself) is covered by scripts/e2e-connection-detail.mjs.
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
const out = mkdtempSync(join(cache, "setuvara-connections-"));
let lib;

before(async () => {
  await build({
    entryPoints: [join(root, "src/lib/connections/relationship.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    alias: { "@": join(root, "src") },
    outfile: join(out, "relationship.cjs"),
    logLevel: "silent",
  });
  lib = createRequire(import.meta.url)(join(out, "relationship.cjs"));
});
after(() => rmSync(out, { recursive: true, force: true }));

const MICHEL = "11111111-1111-4111-8111-111111111111";
const RAYZ = "22222222-2222-4222-8222-222222222222";

const connection = (extra = {}) => ({
  id: "c1", user_id: RAYZ, connected_user_id: MICHEL,
  user_display_name_snapshot: "Rayzenni I", connected_display_name_snapshot: "M.L.A",
  guest_display_name: null, created_at: "2026-10-10T01:15:15Z", ...extra,
});
const encounter = (extra = {}) => ({
  id: "e1", connection_id: "c1", created_by_user_id: MICHEL, shared_by_user_id: RAYZ,
  shared_mode_slug: "personal", share_back_mode_slug: "personal",
  shared_display_name: "Rayzenni I", shared_role: null, shared_company: null,
  share_back_display_name: "M.L.A", share_back_role: null, share_back_company: null,
  event_name: null, city: null, date_label: null, source: "native_share", created_at: "2026-10-10T01:15:15Z", ...extra,
});
const rayzProfile = { id: RAYZ, username: "rayzenni", display_name: "Rayzenni I", bio: "" };
const base = (extra = {}) => ({
  viewerId: MICHEL,
  connection: connection(),
  encounters: [encounter()],
  counterpart: rayzProfile,
  counterpartModes: { personal: { settings: { location: "Hoorn" }, image_path: `${RAYZ}/photo.webp` } },
  note: null, memories: [], viewerHistory: [], passport: [], viewerEventMode: null,
  now: new Date("2026-10-10T08:00:00Z"),
  ...extra,
});
const everyText = (model) => JSON.stringify({ origin: model.origin, encounters: model.encounters.map(({ known, memory, suggestions, prefill, headline }) => ({ known, memory, suggestions, prefill, headline })) });

describe("profile location is not a meeting place", () => {
  test("Rayzenni's Hoorn describes her, never where you met", () => {
    const model = lib.buildRelationship(base());
    assert.equal(model.person.basedIn, "Hoorn");
    assert.equal(model.hasWhere, false);
    assert.equal(model.encounters[0].known, null);
    assert.equal(model.encounters[0].memory, null);
    assert.doesNotMatch(everyText(model), /Hoorn/, "Hoorn must not leak into origin, encounters, prefill or suggestions");
  });

  test("a shared link with no context says how, not where", () => {
    const model = lib.buildRelationship(base());
    assert.equal(model.origin.headline, "Connected through Personal Mode");
    assert.equal(model.origin.sourceLabel, "Shared link");
    assert.equal(model.origin.sourceDetail, "You opened a link Rayzenni shared");
    assert.equal(model.origin.viewerSharedFirst, false);
    assert.equal(model.origin.viewerSharedBackLabel, "Personal Mode");
    assert.equal(model.origin.createdAt, "2026-10-10T01:15:15Z");
    assert.equal(model.encounters[0].kindLabel, "First connected");
  });

  test("Business city and bio stay on the person too", () => {
    const model = lib.buildRelationship(base({
      encounters: [encounter({ shared_mode_slug: "business", shared_role: "Founder", shared_company: "Acme" })],
      counterpartModes: { business: { settings: { role: "CEO", company: "Acme", city: "Rotterdam", description: "Bio" }, image_path: null } },
    }));
    assert.equal(model.person.basedIn, "Rotterdam");
    assert.doesNotMatch(everyText(model), /Rotterdam/);
  });
});

describe("sources in human language", () => {
  for (const [source, label] of [["qr", "Scanned QR code"], ["link", "Shared link"], ["share", "Shared link"], ["native_share", "Shared link"], ["direct_share", "Connection Pass"], ["tap", "Setuvara Tap"], ["profile", "Profile visit"], ["direct", "Profile visit"]]) {
    test(`${source} → ${label}`, () => assert.equal(lib.describeSource(source, false, "Rayzenni I").label, label));
  }
  test("perspective follows who shared", () => {
    assert.equal(lib.describeSource("qr", false, "Rayzenni I").detail, "You scanned Rayzenni’s QR code");
    assert.equal(lib.describeSource("qr", true, "Rayzenni I").detail, "Rayzenni scanned your QR code");
  });
  test("no raw values or claims of a physical meeting", () => {
    for (const source of ["qr", "link", "share", "native_share", "direct_share", "tap", "profile", "direct"]) {
      const { label, detail } = lib.describeSource(source, false, "Ana");
      assert.doesNotMatch(`${label} ${detail}`, /native_share|direct_share|_|met in person|you met/i);
    }
  });
});

describe("event context", () => {
  const slush = encounter({ shared_mode_slug: "event", event_name: "Slush", city: "Helsinki", date_label: "14–15 Nov", source: "qr", created_at: "2026-11-14T10:00:00Z" });
  test("event snapshot leads the origin and prefills memory", () => {
    const model = lib.buildRelationship(base({ encounters: [slush], connection: connection({ created_at: slush.created_at }) }));
    assert.equal(model.origin.headline, "Connected at Slush");
    assert.equal(model.origin.eventCity, "Helsinki");
    assert.equal(model.hasWhere, true);
    assert.deepEqual(model.encounters[0].prefill, { event: "Slush", city: "Helsinki" });
    assert.equal(model.encounters[0].suggestions.city[0].value, "Helsinki");
    assert.match(model.encounters[0].known.from, /Rayzenni’s Event Mode at the time/);
  });
  test("viewer's own Event Mode is a suggestion; prefilled only for a fresh encounter", () => {
    const fresh = encounter({ share_back_mode_slug: "event", created_at: "2026-10-10T07:30:00Z" });
    const old = encounter({ id: "e0", share_back_mode_slug: "event", created_at: "2026-09-01T07:30:00Z" });
    const viewerEventMode = { eventName: "Web Summit", city: "Lisbon" };
    const fm = lib.buildRelationship(base({ encounters: [fresh], viewerEventMode }));
    assert.deepEqual(fm.encounters[0].prefill, { event: "Web Summit", city: "Lisbon" });
    const om = lib.buildRelationship(base({ encounters: [old], viewerEventMode }));
    assert.deepEqual(om.encounters[0].prefill, { event: null, city: null });
    assert.equal(om.encounters[0].suggestions.event[0].value, "Web Summit");
  });
});

describe("snapshots versus current identity", () => {
  test("current identity updates; historical snapshot stays", () => {
    const model = lib.buildRelationship(base({
      encounters: [encounter({ shared_mode_slug: "business", shared_role: "Designer", shared_company: "Old Co", shared_display_name: "Ray I" })],
      counterpart: { ...rayzProfile, display_name: "Rayzenni Ito" },
      counterpartModes: { business: { settings: { role: "Head of Design", company: "New Co" }, image_path: null } },
    }));
    assert.equal(model.person.name, "Rayzenni Ito");
    assert.equal(model.person.role, "Head of Design");
    assert.equal(model.person.company, "New Co");
    assert.deepEqual(model.encounters[0].snapshot, { name: "Ray I", role: "Designer", company: "Old Co", asGuest: false });
    assert.equal(model.person.connectedAsName, "Ray I");
  });
  test("unpublished counterpart falls back to the last snapshot, labelled as such", () => {
    const model = lib.buildRelationship(base({ counterpart: null, counterpartModes: {}, encounters: [encounter({ shared_role: "PM" })] }));
    assert.equal(model.person.kind, "unavailable");
    assert.equal(model.person.factsFrom, "snapshot");
    assert.equal(model.person.role, "PM");
    assert.equal(model.person.profileHref, null);
    assert.equal(model.person.basedIn, null);
  });
});

describe("guests", () => {
  const guestEdge = connection({ user_id: MICHEL, connected_user_id: null, guest_display_name: "Sam Guest", connected_display_name_snapshot: "Sam Guest", user_display_name_snapshot: "M.L.A" });
  const guestEncounter = encounter({ created_by_user_id: null, shared_by_user_id: MICHEL, share_back_mode_slug: null, share_back_display_name: null, shared_display_name: "M.L.A", source: "qr" });
  test("guest counterpart gets a premium fallback without profile data", () => {
    const model = lib.buildRelationship(base({ connection: guestEdge, encounters: [guestEncounter], counterpart: null, counterpartModes: {} }));
    assert.equal(model.person.kind, "guest");
    assert.equal(model.person.name, "Sam Guest");
    assert.equal(model.person.initials, "SG");
    assert.equal(model.person.username, null);
    assert.equal(model.person.photoPath, null);
    assert.equal(model.origin.viewerSharedFirst, true);
    assert.equal(model.encounters[0].snapshot.asGuest, true);
    assert.equal(model.encounters[0].sourceDetail, "Sam scanned your QR code");
  });
  test("a claimed guest enriches with current identity and keeps the guest history", () => {
    const SAM = "33333333-3333-4333-8333-333333333333";
    const model = lib.buildRelationship(base({
      connection: { ...guestEdge, connected_user_id: SAM, guest_display_name: null },
      encounters: [guestEncounter],
      counterpart: { id: SAM, username: "samuel", display_name: "Samuel Green", bio: "" },
      counterpartModes: { personal: { settings: { pronouns: "he/him" }, image_path: `${SAM}/p.webp` } },
    }));
    assert.equal(model.person.kind, "registered");
    assert.equal(model.person.name, "Samuel Green");
    assert.equal(model.person.username, "samuel");
    assert.equal(model.person.profileHref, "/samuel");
    assert.equal(model.person.photoPath, `${SAM}/p.webp`);
    assert.equal(model.person.claimedFromGuest, true);
    assert.equal(model.person.mode, "personal", "a claimed guest is described through their Personal Mode");
    assert.equal(model.person.pronouns, "he/him");
    assert.equal(model.person.connectedAsName, "Sam Guest");
    assert.equal(model.encounters[0].snapshot.name, "Sam Guest");
    assert.equal(model.origin.createdAt, guestEdge.created_at);
  });
});

describe("repeated encounters and memory", () => {
  const first = encounter({ id: "e1", shared_mode_slug: "event", event_name: "Slush", city: "Helsinki", created_at: "2026-11-14T10:00:00Z" });
  const again = encounter({ id: "e2", source: "qr", created_at: "2026-12-03T18:00:00Z" });
  const memories = [{ encounter_id: "e2", city: "Amsterdam", venue: "The Hoxton", event_label: null, met_on: "2026-12-02", met_time: "21:30:00", provenance: "viewer", updated_at: "2026-12-04T00:00:00Z" }];
  test("encounters stay separate and ordered", () => {
    const model = lib.buildRelationship(base({ encounters: [again, first], memories }));
    assert.deepEqual(model.encounters.map((item) => item.id), ["e1", "e2"]);
    assert.deepEqual(model.encounters.map((item) => item.kindLabel), ["First connected", "Met again"]);
    assert.equal(model.encounters[0].memory, null, "memory on the second encounter never bleeds into the first");
    assert.equal(model.encounters[1].known, null, "the event snapshot of the first encounter stays on the first");
    assert.deepEqual(model.encounters[1].memory, { event: null, city: "Amsterdam", venue: "The Hoxton", metOn: "2026-12-02", metTime: "21:30", provenance: "viewer", updatedAt: "2026-12-04T00:00:00Z" });
    assert.equal(model.encounters[1].at, "2026-12-03T18:00:00Z", "memory date never replaces the canonical timestamp");
  });
  test("other encounters feed suggestions, labelled", () => {
    const model = lib.buildRelationship(base({ encounters: [first, again], memories }));
    assert.equal(model.encounters[1].suggestions.city[0].value, "Helsinki");
    assert.equal(model.encounters[1].suggestions.city[0].reason, "Another time you connected");
    assert.equal(model.encounters[0].suggestions.venue[0].value, "The Hoxton");
    assert.equal(model.encounters[0].suggestions.venue[0].city, "Amsterdam");
  });
  test("viewer history and Passport are suggestions, deduplicated", () => {
    const model = lib.buildRelationship(base({
      viewerHistory: [{ city: "Berlin", venue: "Soho House", event_label: "Tech Open Air", updated_at: "x" }, { city: "berlin", venue: null, event_label: null, updated_at: "y" }],
      passport: [{ stamp_type: "city", title: "Berlin" }, { stamp_type: "city", title: "Paris" }, { stamp_type: "event", title: "Slush" }],
    }));
    const { city, venue, event } = model.encounters[0].suggestions;
    assert.deepEqual(city.map((item) => item.value), ["Berlin", "Paris"]);
    assert.equal(city[1].reason, "In your Passport");
    assert.deepEqual(venue.map((item) => [item.value, item.city]), [["Soho House", "Berlin"]]);
    assert.deepEqual(event.map((item) => item.value), ["Tech Open Air", "Slush"]);
    assert.deepEqual(model.encounters[0].prefill, { event: null, city: null }, "history is never prefilled");
  });
  test("provenance: viewer, confirmed, corrected", () => {
    assert.equal(lib.memoryProvenance(null, { event: "Dinner", city: "Hoorn" }), "viewer");
    assert.equal(lib.memoryProvenance({ event: "Slush", city: "Helsinki" }, { event: "slush", city: "Helsinki" }), "confirmed");
    assert.equal(lib.memoryProvenance({ event: "Slush", city: "Helsinki" }, { event: "Slush", city: "Espoo" }), "corrected");
  });
  test("the private note is only the viewer's note", () => {
    const model = lib.buildRelationship(base({ note: { note: "Ask about the Hoorn studio", updated_at: "t" } }));
    assert.deepEqual(model.note, { text: "Ask about the Hoorn studio", updatedAt: "t" });
    assert.equal(lib.buildRelationship(base({ note: { note: "   ", updated_at: "t" } })).note, null);
  });
});
