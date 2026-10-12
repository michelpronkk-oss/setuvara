/**
 * Mode share URLs: the username URL is Personal only, Event and Business are opaque.
 *
 *   npm run test:mode-share
 *
 * Bundles the pure URL helpers with esbuild; no database or browser needed.
 * The live wiring (database resolution, ?mode= tampering, Tap/QR/Pass landings)
 * is covered by scripts/e2e-mode-share.mjs.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-mode-share-"));
let urls;
let share;
let relationship;

before(async () => {
  const stub = join(out, "server-only.js");
  writeFileSync(stub, "");
  const bundle = async (entry, name) => {
    await build({
      entryPoints: [join(root, entry)],
      bundle: true,
      format: "cjs",
      platform: "node",
      alias: { "@": join(root, "src"), "server-only": stub },
      outfile: join(out, `${name}.cjs`),
      logLevel: "silent",
    });
    return createRequire(import.meta.url)(join(out, `${name}.cjs`));
  };
  [urls, share, relationship] = await Promise.all([
    bundle("src/lib/share/public-mode-url.ts", "public-mode-url"),
    bundle("src/lib/share/mode-share.ts", "mode-share"),
    bundle("src/lib/connections/relationship.ts", "relationship"),
  ]);
});
after(() => rmSync(out, { recursive: true, force: true }));

const shareUrls = { event: "https://setuvara.com/s/K7mP2xQa", business: "https://setuvara.com/s/b9Rt4Lw2" };

describe("owner share URLs", () => {
  test("Personal is the canonical username URL", () => {
    assert.equal(urls.publicModeUrl({ origin: "https://setuvara.com", username: "michel", shareUrls, mode: "personal" }), "https://setuvara.com/michel");
    assert.equal(urls.publicModeUrl({ origin: "https://setuvara.com", username: "michel", shareUrls, mode: "personal", source: "qr" }), "https://setuvara.com/michel?source=qr");
  });
  test("Event and Business use the opaque share URL, never ?mode=", () => {
    for (const mode of ["event", "business"]) {
      for (const source of [undefined, "qr", "link", "native_share"]) {
        const url = urls.publicModeUrl({ origin: "https://setuvara.com", username: "michel", shareUrls, mode, source });
        assert.match(url, /^https:\/\/setuvara\.com\/s\/[0-9A-Za-z]{8}(\?source=[a-z_]+)?$/);
        assert.doesNotMatch(url, /[?&]mode=/);
        assert.doesNotMatch(url, /michel/, "the opaque URL does not name the person");
      }
    }
  });
  test("a missing share URL never falls back to a predictable Mode URL", () => {
    assert.equal(urls.publicModeUrl({ origin: "https://setuvara.com", username: "michel", shareUrls: {}, mode: "event" }), "");
    assert.equal(urls.publicModeUrl({ origin: "https://setuvara.com", username: "michel", shareUrls: { business: null }, mode: "business", source: "qr" }), "");
  });
});

describe("share ids", () => {
  test("short ids are 8 Base62 characters", () => {
    for (const id of ["K7mP2xQa", "00000000", "zzzzzzzz", "aZ09bY18"]) {
      assert.match(id, share.modeShortIdPattern);
      assert.match(id, share.modeShareTokenPattern);
    }
  });
  test("legacy 43-character tokens still route", () => {
    assert.match("E".repeat(43), share.modeShareTokenPattern);
    assert.match(`${"a-_".repeat(14)}Z`, share.modeShareTokenPattern);
    assert.doesNotMatch("E".repeat(43), share.modeShortIdPattern);
  });
  test("anything else is rejected before the database", () => {
    for (const bad of ["", "K7mP2xQ", "K7mP2xQab", "K7mP2xQ-", "K7mP_xQa", "K7mP2xQ=", "michel", "../event", "K7mP2xQa?mode=event", "E".repeat(42), "E".repeat(44), "é".repeat(8)]) {
      assert.doesNotMatch(bad, share.modeShareTokenPattern, bad);
    }
  });
  test("resolution results are validated", () => {
    assert.deepEqual(share.parseResolvedModeShare({ username: "michel", mode: "event" }), { username: "michel", mode: "event" });
    for (const bad of [null, [], { username: "michel" }, { username: "michel", mode: "secret" }, { username: "../x", mode: "event" }]) {
      assert.equal(share.parseResolvedModeShare(bad), null);
    }
  });
});

describe("connection detail links", () => {
  const MICHEL = "44444444-4444-4444-8444-444444444444";
  const RAYZ = "55555555-5555-4555-8555-555555555555";
  test("an Event connection never links to ?mode=event", () => {
    const model = relationship.buildRelationship({
      viewerId: MICHEL,
      connection: { id: "c1", user_id: RAYZ, connected_user_id: MICHEL, user_display_name_snapshot: "Rayzenni I", connected_display_name_snapshot: "M.L.A", guest_display_name: null, created_at: "2026-10-10T01:15:15Z" },
      encounters: [{ id: "e1", connection_id: "c1", created_by_user_id: MICHEL, shared_by_user_id: RAYZ, shared_mode_slug: "event", share_back_mode_slug: "personal", shared_display_name: "Rayzenni I", shared_role: null, shared_company: null, share_back_display_name: "M.L.A", share_back_role: null, share_back_company: null, event_name: null, city: null, date_label: null, source: "qr", created_at: "2026-10-10T01:15:15Z" }],
      counterpart: { id: RAYZ, username: "rayzenni", display_name: "Rayzenni I", bio: "" },
      counterpartModes: { event: { settings: { eventName: "Slush" }, image_path: null } },
      note: null, memories: [], viewerHistory: [], passport: [],
    });
    assert.equal(model.person.profileMode, "event");
    assert.doesNotMatch(model.person.profileHref ?? "", /mode=/);
  });
});

describe("no public ?mode= URLs in the app", () => {
  // Internal app routes (/app?mode=, /app/identity?mode=) and the owner analytics
  // API are signed-in surfaces, not public profile URLs.
  const allowed = /\/app(\/identity)?\?mode=|\/api\/analytics/;
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name)) files.push(path);
    }
  };
  walk(join(root, "src"));
  test("no source file builds a public profile URL with a Mode query", () => {
    const offenders = [];
    for (const file of files) {
      readFileSync(file, "utf8").split("\n").forEach((rawLine, index) => {
        // Comments may describe the old contract; only code counts.
        const line = /^\s*(\/\/|\*|\/\*)/.test(rawLine) ? "" : rawLine.replace(/\s\/\/\s.*$/, "");
        if ((/\?mode=/.test(line) || /searchParams\.set\("mode"/.test(line) || /query\.set\("mode"/.test(line)) && !allowed.test(line)) {
          offenders.push(`${relative(root, file)}:${index + 1}`);
        }
      });
    }
    assert.deepEqual(offenders, []);
  });
});
