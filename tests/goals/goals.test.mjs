/**
 * Action Templates (goals): every goal builds drafts the database accepts, answers are validated,
 * and copy never mentions features Setuvara doesn't have.
 *
 *   npm run test:goals
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
const out = mkdtempSync(join(cache, "setuvara-goals-"));
let goals;
before(async () => {
  await build({ entryPoints: [join(root, "src/lib/goals/templates.ts")], bundle: true, format: "cjs", platform: "node", alias: { "@": join(root, "src") }, outfile: join(out, "goals.cjs"), logLevel: "silent" });
  goals = createRequire(import.meta.url)(join(out, "goals.cjs"));
});
after(() => rmSync(out, { recursive: true, force: true }));

const ctx = { firstName: "Mila", now: Date.parse("2026-11-01T10:00:00Z"), timezone: "Europe/Amsterdam" };
// The same rules as private.action_config_ok, kept small: allowed keys per kind and question shape.
const KEYS = { collab: ["questions", "types", "askBudget", "askTimeline", "askWebsite", "availability", "thanks"], giveaway: ["questions", "prize", "eligibility", "rules", "sponsor", "minAge", "thanks"], booking: ["questions", "offering", "details", "priceNote", "askDates", "thanks"], submission: ["questions", "prompt", "allowAnonymous", "askFeatureConsent", "emailRequired", "thanks"], newsletter: ["promise", "frequency", "sender", "askName", "thanks"], form: ["questions", "emailRequired", "askName", "thanks"] };
const filled = (goal) => Object.fromEntries(goal.fields.map((field) => [field.id, field.type === "choice" ? field.options[0].value : field.type === "number" ? String(field.min + 1) : field.type === "money" ? "24" : field.type === "datetime" ? "2026-12-12T19:00" : "Test value"]));

describe("every goal", () => {
  test("twelve goals, three per Mode, one free starter per Mode", () => {
    assert.equal(goals.GOAL_IDS.length, 12);
    for (const [mode, ids] of Object.entries(goals.MODE_GOALS)) {
      assert.equal(ids.length, 3, mode);
      assert.equal(ids.filter((id) => goals.GOALS[id].free).length, 1, `${mode} starter`);
      for (const id of ids) assert.equal(goals.GOALS[id].mode, mode);
    }
  });
  test("asks at most four questions", () => { for (const id of goals.GOAL_IDS) assert.ok(goals.GOALS[id].fields.length <= 4, id); });
  test("builds drafts the database accepts, with defaults and with every answer filled", () => {
    for (const id of goals.GOAL_IDS) {
      const goal = goals.GOALS[id];
      for (const answers of [goal.defaults(ctx), filled(goal)]) {
        const plan = JSON.parse(JSON.stringify(goal.build(answers, ctx)));
        assert.ok(plan.actions.length || plan.event || plan.offer, `${id} creates something`);
        assert.ok(plan.actions.length <= 3, id);
        for (const action of plan.actions) {
          assert.ok(action.title.trim().length >= 1 && action.title.length <= 100, `${id} title`);
          assert.ok(action.intro.length <= 600 && (action.cta_label ?? "").length <= 40, `${id} lengths`);
          assert.deepEqual(Object.keys(action.config).filter((key) => !KEYS[action.kind].includes(key)), [], `${id} config keys`);
          for (const question of action.config.questions ?? []) {
            assert.match(question.id, /^q[0-9]{1,2}$/);
            assert.ok(["short", "long", "choice"].includes(question.type));
            assert.equal(question.type === "choice", Array.isArray(question.options));
          }
          assert.ok((action.config.questions ?? []).length <= (goal.free ? 3 : 6), `${id} fits the plan's question limit`);
          if (action.kind === "giveaway") assert.ok(Date.parse(action.ends_at) > ctx.now, "giveaways end in the future");
          assert.ok(action.thanks_heading.length <= 60);
        }
        if (plan.event) {
          assert.ok(Date.parse(plan.event.ends_at) > Date.parse(plan.event.starts_at));
          assert.ok(plan.event.capacity === null || (plan.event.capacity >= 1 && plan.event.capacity <= 10000));
        }
        if (plan.offer) assert.ok(plan.offer.unit_amount_minor >= 50 && ["EUR", "USD", "GBP"].includes(plan.offer.currency));
      }
    }
  });
  test("copy promises only what exists", () => {
    const text = JSON.stringify(goals.GOAL_IDS.map((id) => { const g = goals.GOALS[id]; return [g.promise, g.next, g.creates(filled(g)), g.build(filled(g), ctx)]; }));
    for (const word of ["reminder", "routing", "smart booking", "automatic follow", "auto-reply", "sms"]) assert.ok(!text.toLowerCase().includes(word), word);
  });
});

describe("answers", () => {
  test("required, length, choice, number, date and price are checked", () => {
    const clients = goals.GOALS.get_more_clients;
    assert.match(goals.validateAnswers(clients, { service: "", budget: "yes", timeline: "yes" }), /Add/);
    assert.match(goals.validateAnswers(clients, { service: "x".repeat(81), budget: "yes", timeline: "yes" }), /too long/);
    assert.match(goals.validateAnswers(clients, { service: "Design", budget: "maybe", timeline: "yes" }), /Choose/);
    assert.equal(goals.validateAnswers(clients, { service: "Design", budget: "yes", timeline: "no" }), null);
    assert.match(goals.validateAnswers(goals.GOALS.host_event, { title: "Supper", starts: "tomorrow", city: "", capacity: "" }), /Check/);
    assert.match(goals.validateAnswers(goals.GOALS.host_event, { title: "Supper", starts: "", city: "", capacity: "0" }), /between/);
    assert.match(goals.validateAnswers(goals.GOALS.launch_product, { product: "Presets", kind: "digital", price: "0.10", currency: "EUR" }), /lowest/);
  });
  test("only known fields survive cleaning", () => {
    const clean = goals.cleanAnswers(goals.GOALS.grow_audience, { about: "  Notes  ", frequency: "Weekly", welcome: "", status: "published", profile_id: "x" });
    assert.deepEqual(clean, { about: "Notes", frequency: "Weekly", welcome: "" });
  });
  test("prices parse to minor units; local times parse as wall time", () => {
    assert.equal(goals.parseMajor("24,50"), 2450);
    assert.equal(goals.parseMajor("abc"), null);
    assert.equal(goals.parseLocal("2026-12-12T19:00"), Date.parse("2026-12-12T19:00:00Z"));
    assert.equal(goals.parseLocal("12/12/2026"), null);
  });
  test("Launch a Product skips the product draft without a price", () => {
    assert.equal(goals.GOALS.launch_product.build({ product: "Presets", kind: "digital", price: "", currency: "EUR" }, ctx).offer, null);
    assert.equal(goals.GOALS.launch_product.build({ product: "Presets", kind: "digital", price: "19", currency: "USD" }, ctx).offer.unit_amount_minor, 1900);
  });
});
