/** Builder Showcase model: link names, stack parsing, roadmap grouping and safe links.  npm run test:builder */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-builder-"));
let m;
before(async () => {
  await build({ entryPoints: [join(root, "src/lib/builder/model.ts")], bundle: true, format: "cjs", platform: "node", outfile: join(out, "m.cjs"), logLevel: "silent" });
  m = createRequire(import.meta.url)(join(out, "m.cjs"));
});
after(() => rmSync(out, { recursive: true, force: true }));

test("project link names", () => {
  assert.equal(m.projectSlug("My SaaS!"), "my-saas");
  assert.equal(m.projectSlug("Café  Über -- App"), "cafe-uber-app");
  assert.equal(m.projectSlug("!!!"), "project");
  assert.ok(m.projectSlug("x".repeat(80)).length <= 48);
});
test("stack: trimmed, de-duplicated, at most 12, each at most 30 characters", () => {
  assert.deepEqual(m.parseStack(" Next.js, postgres ,Postgres,, Stripe"), ["Next.js", "postgres", "Stripe"]);
  assert.equal(m.parseStack(Array.from({ length: 20 }, (_, i) => `t${i}`).join(",")).length, 12);
  assert.equal(m.parseStack("x".repeat(50))[0].length, 30);
});
test("roadmap groups by stage; the changelog is newest first", () => {
  const groups = m.byStage([
    { id: "a", stage: "shipped", shipped_at: "2026-01-01T00:00:00Z" },
    { id: "b", stage: "planned" },
    { id: "c", stage: "shipped", shipped_at: "2026-03-01T00:00:00Z" },
    { id: "d", stage: "in_progress" },
  ]);
  assert.deepEqual(groups.shipped.map((i) => i.id), ["c", "a"]);
  assert.deepEqual([groups.planned.length, groups.in_progress.length], [1, 1]);
});
test("only https links are shown", () => {
  assert.equal(m.safeHttps("https://mysaas.com"), "https://mysaas.com");
  assert.equal(m.safeHttps("javascript:alert(1)"), null);
  assert.equal(m.safeHttps("http://mysaas.com"), null);
});
test("database refusals read as plain sentences", () => {
  assert.match(m.builderError("new row violates: plan_project_limit"), /public projects/);
  assert.match(m.builderError("weird"), /didn't save/);
});
