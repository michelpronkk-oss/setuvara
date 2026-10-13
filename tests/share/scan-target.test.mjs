/**
 * Home scanner: which QR texts open a Setuvara identity.
 *
 *   npm run test:scan
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
const out = mkdtempSync(join(cache, "setuvara-scan-target-"));
let scanTarget;

before(async () => {
  await build({ entryPoints: [join(root, "src/lib/share/scan-target.ts")], bundle: true, format: "cjs", platform: "node", alias: { "@": join(root, "src") }, outfile: join(out, "scan.cjs"), logLevel: "silent" });
  ({ scanTarget } = createRequire(import.meta.url)(join(out, "scan.cjs")));
});
after(() => rmSync(out, { recursive: true, force: true }));

const token = "a-_".repeat(14) + "Z";

describe("Setuvara QR codes open through the existing resolvers", () => {
  test("Personal profile, with and without the share source", () => {
    assert.deepEqual(scanTarget("https://setuvara.com/aanya"), { path: "/aanya", kind: "profile" });
    assert.deepEqual(scanTarget("https://www.setuvara.com/aanya/?source=qr"), { path: "/aanya?source=qr", kind: "profile" });
    assert.deepEqual(scanTarget("setuvara.com/Aanya"), { path: "/aanya", kind: "profile" });
    assert.deepEqual(scanTarget("https://setuvara.com/u/aanya"), { path: "/aanya", kind: "profile" });
  });
  test("Event and Business share links, short and legacy", () => {
    assert.deepEqual(scanTarget("https://setuvara.com/s/K7mP2xQa?source=qr"), { path: "/s/K7mP2xQa?source=qr", kind: "mode_share" });
    assert.deepEqual(scanTarget(`https://setuvara.com/s/${token}`), { path: `/s/${token}`, kind: "mode_share" });
  });
  test("Quick QR, Tap and Connection Pass", () => {
    assert.deepEqual(scanTarget(`https://setuvara.com/q/${token}`), { path: `/q/${token}`, kind: "quick_qr" });
    assert.deepEqual(scanTarget(`https://setuvara.com/t/${token}`), { path: `/t/${token}`, kind: "tap" });
    assert.deepEqual(scanTarget(`https://setuvara.com/connect/${token}`), { path: `/connect/${token}`, kind: "connect" });
  });
  test("the app's own origin is accepted, so local and preview builds work", () => {
    assert.deepEqual(scanTarget("http://127.0.0.1:3014/s/K7mP2xQa", "http://127.0.0.1:3014"), { path: "/s/K7mP2xQa", kind: "mode_share" });
    assert.equal(scanTarget("http://127.0.0.1:3014/s/K7mP2xQa"), null);
  });
  test("drops anything but the share source", () => {
    assert.equal(scanTarget("https://setuvara.com/aanya?mode=business&source=qr").path, "/aanya?source=qr");
    assert.equal(scanTarget("https://setuvara.com/aanya?source=<x>").path, "/aanya");
  });
});

describe("everything else is not a Setuvara identity", () => {
  for (const text of [
    "", "hello", "WIFI:S:cafe;T:WPA;P:secret;;", "https://example.com/aanya", "https://setuvara.com.evil.io/aanya",
    "http://setuvara.com/aanya", "https://setuvara.com:8443/aanya", "https://user@setuvara.com/aanya", "javascript:alert(1)",
    "https://setuvara.com/", "https://setuvara.com/pricing", "https://setuvara.com/app", "https://setuvara.com/app/identity",
    "https://setuvara.com/s/short", "https://setuvara.com/q/short", "https://setuvara.com/t/../app", "https://setuvara.com/aanya/extra",
    "https://setuvara.com/%E0%A4%A", "https://setuvara.com/ab", `https://setuvara.com/x/${token}`,
  ]) test(JSON.stringify(text), () => assert.equal(scanTarget(text, "https://setuvara.com"), null));
});
