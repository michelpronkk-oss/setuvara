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

const PROFILE = "11111111-1111-4111-8111-111111111111";
const EVENT_MODE = "22222222-2222-4222-8222-222222222222";
const BUSINESS_MODE = "33333333-3333-4333-8333-333333333333";
const nonce = "ab".repeat(32);
const shareUrls = { event: `https://setuvara.com/s/${"E".repeat(43)}`, business: `https://setuvara.com/s/${"B".repeat(43)}` };

describe("owner share URLs", () => {
  test("Personal is the canonical username URL", () => {
    assert.equal(urls.publicModeUrl({ origin: "https://setuvara.com", username: "michel", shareUrls, mode: "personal" }), "https://setuvara.com/michel");
    assert.equal(urls.publicModeUrl({ origin: "https://setuvara.com", username: "michel", shareUrls, mode: "personal", source: "qr" }), "https://setuvara.com/michel?source=qr");
  });
  test("Event and Business use the opaque share URL, never ?mode=", () => {
    for (const mode of ["event", "business"]) {
      for (const source of [undefined, "qr", "link", "native_share"]) {
        const url = urls.publicModeUrl({ origin: "https://setuvara.com", username: "michel", shareUrls, mode, source });
        assert.match(url, /^https:\/\/setuvara\.com\/s\/[A-Za-z0-9_-]{43}(\?source=[a-z_]+)?$/);
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

describe("opaque tokens", () => {
  before(() => { process.env.QUICK_SHARE_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64url"); });
  test("tokens are 43 url-safe characters and stable for the same locator", () => {
    const token = share.deriveModeShareToken(PROFILE, EVENT_MODE, nonce);
    assert.match(token, share.modeShareTokenPattern);
    assert.equal(share.deriveModeShareToken(PROFILE, EVENT_MODE, nonce), token);
  });
  test("each Mode and each nonce gets an unrelated token", () => {
    const event = share.deriveModeShareToken(PROFILE, EVENT_MODE, nonce);
    assert.notEqual(share.deriveModeShareToken(PROFILE, BUSINESS_MODE, nonce), event);
    assert.notEqual(share.deriveModeShareToken(PROFILE, EVENT_MODE, "cd".repeat(32)), event);
  });
  test("a different server key yields a different token", () => {
    const event = share.deriveModeShareToken(PROFILE, EVENT_MODE, nonce);
    process.env.QUICK_SHARE_TOKEN_KEY = Buffer.alloc(32, 9).toString("base64url");
    assert.notEqual(share.deriveModeShareToken(PROFILE, EVENT_MODE, nonce), event);
  });
  test("a missing server key fails closed", () => {
    delete process.env.QUICK_SHARE_TOKEN_KEY;
    assert.throws(() => share.deriveModeShareToken(PROFILE, EVENT_MODE, nonce));
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
