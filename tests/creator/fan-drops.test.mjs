// Fan Drops: locked cards come only from what the database said this viewer can't open.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-fan-"));
let fan;
before(async () => {
  await build({ entryPoints: [join(root, "src/lib/creator/fan-drops.ts")], bundle: true, format: "cjs", platform: "node", outfile: join(out, "fan.cjs"), logLevel: "silent" });
  fan = createRequire(import.meta.url)(join(out, "fan.cjs"));
});
after(() => rmSync(out, { recursive: true, force: true }));

test("open pieces never become locked cards", () => {
  assert.deepEqual(fan.lockedPieces({ locked_content: [{ profile_block_id: "a", access_level: "followers", teaser_title: "x", is_accessible: true }] }, "Iris"), []);
});
test("an exclusive says who it is for", () => {
  assert.deepEqual(fan.lockedPieces({ locked_content: [{ profile_block_id: "a", access_level: "followers", teaser_title: null, is_accessible: false }] }, "Iris"), [{ id: "a", title: "Exclusive", hint: "Follow Iris to unlock" }]);
});
test("an early drop says who is in early and when it is out", () => {
  const [piece] = fan.lockedPieces({ drops: [{ profile_block_id: "b", title: "New print", status: "early", starts_at: "2026-11-04T10:00:00Z", early_access_level: "subscribers", is_accessible: false }] }, "Iris");
  assert.equal(piece.title, "New print");
  assert.match(piece.hint, /^Early access for subscribers · out 4 Nov$/);
});
test("a live drop or a missing summary adds nothing", () => {
  assert.deepEqual(fan.lockedPieces({ drops: [{ profile_block_id: "b", title: "x", status: "live", starts_at: null, early_access_level: null, is_accessible: false }] }, "Iris"), []);
  assert.deepEqual(fan.lockedPieces(null, "Iris"), []);
});
test("one card per piece, the drop winning over its rule", () => {
  const pieces = fan.lockedPieces({ locked_content: [{ profile_block_id: "a", access_level: "members", teaser_title: "M", is_accessible: false }], drops: [{ profile_block_id: "a", title: "D", status: "early", starts_at: "2026-11-04T10:00:00Z", early_access_level: "followers", is_accessible: false }] }, "Iris");
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].title, "D");
});
