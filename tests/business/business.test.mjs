// Business Mode leads model: stage filters, search and the funnel's honest steps.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-business-"));
let model;
before(async () => {
  await build({ entryPoints: [join(root, "src/lib/business/model.ts")], bundle: true, format: "cjs", platform: "node", outfile: join(out, "model.cjs"), logLevel: "silent" });
  model = createRequire(import.meta.url)(join(out, "model.cjs"));
});
after(() => rmSync(out, { recursive: true, force: true }));

const lead = (id, stage, name, email, at) => ({ id, stage, name, email, last_activity_at: at, inquiries: 1 });
const leads = [
  lead("a", "new", "Mara Vos", "mara@example.test", "2026-10-20T10:00:00Z"),
  lead("b", "qualified", "Jun Park", "jun@example.test", "2026-10-21T10:00:00Z"),
  lead("c", "won", "Ada Host", "ada@example.test", "2026-10-19T10:00:00Z"),
  lead("d", "lost", "", null, "2026-10-18T10:00:00Z"),
];

describe("lead filters", () => {
  test("Open is New, Contacted and Qualified, newest activity first", () => assert.deepEqual(model.filterLeads(leads, "open", "").map((l) => l.id), ["b", "a"]));
  test("a stage filter shows that stage only", () => assert.deepEqual(model.filterLeads(leads, "won", "").map((l) => l.id), ["c"]));
  test("search matches name or email, any case", () => {
    assert.deepEqual(model.filterLeads(leads, "all", "MARA").map((l) => l.id), ["a"]);
    assert.deepEqual(model.filterLeads(leads, "all", "jun@").map((l) => l.id), ["b"]);
  });
  test("a lead without email still lists and never breaks search", () => assert.deepEqual(model.filterLeads(leads, "all", "zzz").map((l) => l.id), []));
});

describe("funnel", () => {
  const base = { days: 30, plan_days: 90, since: "2026-09-22", visits: 120, action_views: 300, action_opens: 40, responses: 10, leads: 8, bookings: 4, bookings_accepted: 2, won: 1, lost: 2, open_by_stage: { new: 3, contacted: 1, qualified: 1 } };
  test("steps keep the recorded numbers as they are", () => assert.deepEqual(model.funnelSteps(base).map((s) => s.value), [120, 40, 10, 8, 4, 1]));
  test("a share is shown only where one step follows another", () => {
    const steps = model.funnelSteps(base);
    assert.equal(steps.find((s) => s.key === "responses").note, "25% of 40");
    assert.equal(steps.find((s) => s.key === "visits").note, null);
  });
  test("more inquiries than opens shows no share at all", () => assert.equal(model.funnelSteps({ ...base, action_opens: 2, responses: 3 }).find((s) => s.key === "responses").note, null));
  test("no division by zero and no invented numbers", () => {
    const empty = model.funnelSteps({ ...base, visits: 0, action_views: 0, action_opens: 0, responses: 0, leads: 0, bookings: 0, bookings_accepted: 0, won: 0, lost: 0 });
    assert.ok(empty.every((s) => s.value === 0 && s.note === null));
    assert.ok(!JSON.stringify(model.funnelSteps(base)).match(/€|\$|revenue/i));
  });
});
