/** One page order per Mode: defaults, saved orders and the kinds each Mode allows.  npm run test:page-order */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-order-"));
let m;
before(async () => {
  await build({ entryPoints: [join(root, "src/lib/profile/page-order.ts")], bundle: true, format: "cjs", platform: "node", outfile: join(out, "m.cjs"), logLevel: "silent" });
  m = createRequire(join(root, "package.json"))(join(out, "m.cjs"));
});
after(() => rmSync(out, { recursive: true, force: true }));

const id = (n) => `00000000-0000-4000-8000-00000000000${n}`;
const have = { blocks: [id(1)], links: [id(2), id(3)], actions: [id(4)], projects: [id(5)], sections: ["testimonials", "creator", "audience"] };

test("defaults keep today's order and each Mode's kinds", () => {
  assert.deepEqual(m.defaultOrder("personal", have), [`block:${id(1)}`, `link:${id(2)}`, `link:${id(3)}`, `action:${id(4)}`]);
  assert.deepEqual(m.defaultOrder("business", have), [`block:${id(1)}`, `link:${id(2)}`, `link:${id(3)}`, `action:${id(4)}`, `project:${id(5)}`, "section:testimonials"]);
  assert.deepEqual(m.defaultOrder("creator", have), [`block:${id(1)}`, `link:${id(2)}`, `link:${id(3)}`, "section:audience", "section:creator", `project:${id(5)}`]);
});

test("a saved order wins; gone and disallowed items drop; new ones join their kind", () => {
  const saved = [`action:${id(4)}`, `link:${id(3)}`, `project:${id(5)}`, `block:${id(9)}`, `block:${id(1)}`];
  assert.deepEqual(m.resolveOrder("personal", saved, have), [`action:${id(4)}`, `link:${id(3)}`, `link:${id(2)}`, `block:${id(1)}`]);
});

test("runs group neighbours of one kind; sections stand alone", () => {
  assert.deepEqual(m.pageRuns([`link:${id(2)}`, `link:${id(3)}`, `action:${id(4)}`, "section:creator", "section:audience"]).map((r) => [r.kind, r.ids.length]), [["link", 2], ["action", 1], ["section", 1], ["section", 1]]);
});

test("keys parse and the stored pattern rejects junk", () => {
  assert.deepEqual(m.parseKey(`project:${id(5)}`), { kind: "project", id: id(5) });
  assert.equal(m.parseKey("nope"), null);
  assert.equal(m.PAGE_ORDER_PATTERN.test("section:creator"), true);
  assert.equal(m.PAGE_ORDER_PATTERN.test("section:drop table"), false);
});

test("tile sizes: sized entries stand alone, wide entries still join", () => {
  const order = [`block:${id(1)}`, `block:${id(2)}`, `block:${id(3)}`, `link:${id(4)}`, `link:${id(5)}`];
  const runs = m.pageRuns(order, { [`block:${id(2)}`]: "small", [`link:${id(5)}`]: "small" });
  assert.deepEqual(runs.map((r) => [r.kind, r.ids.length, r.size]), [["block", 1, "wide"], ["block", 1, "small"], ["block", 1, "wide"], ["link", 1, "wide"], ["link", 1, "small"]]);
  assert.deepEqual(m.pageRuns(order).map((r) => r.ids.length), [3, 2]);
});

test("tile sizes: only well-formed sizes for this page are kept, and each kind has its own options", () => {
  const order = [`block:${id(1)}`, `link:${id(2)}`];
  assert.deepEqual(m.readSizes({ [`block:${id(1)}`]: "hero", [`link:${id(2)}`]: "giant", [`link:${id(9)}`]: "small", junk: "small" }, order), { [`block:${id(1)}`]: "hero" });
  assert.deepEqual(m.readSizes(null), {});
  assert.deepEqual(m.allowedSizes("block", "image"), ["small", "wide", "hero"]);
  assert.deepEqual(m.allowedSizes("block", "services"), ["small", "wide"]);
  assert.deepEqual(m.allowedSizes("project"), ["wide"]);
});
