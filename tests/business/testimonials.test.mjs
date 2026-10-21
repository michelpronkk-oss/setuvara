// Testimonials model: link states, the client's form checks, bylines and the invite email.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-testimonials-"));
let model;
before(async () => {
  await build({ entryPoints: [join(root, "src/lib/business/testimonials.ts")], bundle: true, format: "cjs", platform: "node", outfile: join(out, "t.cjs"), logLevel: "silent" });
  model = createRequire(import.meta.url)(join(out, "t.cjs"));
});
after(() => rmSync(out, { recursive: true, force: true }));

describe("testimonials", () => {
  const request = (extra) => ({ id: "r", lead_id: null, name: "", expires_at: "2026-11-20T00:00:00Z", used_at: null, revoked_at: null, created_at: "2026-10-21T00:00:00Z", ...extra });
  const now = Date.parse("2026-10-25T00:00:00Z");
  test("a link is open until used, revoked or expired", () => {
    assert.equal(model.requestState(request(), now), "open");
    assert.equal(model.requestState(request({ used_at: "x" }), now), "used");
    assert.equal(model.requestState(request({ revoked_at: "x" }), now), "revoked");
    assert.equal(model.requestState(request({ expires_at: "2026-10-24T00:00:00Z" }), now), "expired");
  });
  test("the form asks for real words, a name and consent", () => {
    assert.deepEqual(Object.keys(model.testimonialProblems({ body: "short", name: "", consent: false })), ["body", "name", "consent"]);
    assert.deepEqual(model.testimonialProblems({ body: "Twenty characters or more here.", name: "Mara", consent: true }), {});
    assert.ok(model.testimonialProblems({ body: "x".repeat(601), name: "Mara", consent: true }).body);
  });
  test("tokens match what the database makes", () => {
    assert.ok(model.TOKEN.test("A".repeat(32)));
    assert.ok(!model.TOKEN.test("A".repeat(31)));
    assert.ok(!model.TOKEN.test(`${"A".repeat(31)}=`));
  });
  test("bylines join what is there", () => {
    assert.equal(model.byline({ author_role: "Founder", author_company: "Vos & Co" }), "Founder, Vos & Co");
    assert.equal(model.byline({ author_role: " ", author_company: "Vos & Co" }), "Vos & Co");
  });
  test("the invite email carries the link and the owner's name", () => {
    const mail = decodeURIComponent(model.inviteMail({ to: "mara@example.test", name: "Mara Vos", owner: "Lucas Meyer", url: "https://setuvara.com/s/testimonial/abc" }));
    assert.ok(mail.startsWith("mailto:mara@example.test?subject=A quick favour from Lucas Meyer"));
    assert.ok(mail.includes("Hi Mara,") && mail.includes("https://setuvara.com/s/testimonial/abc"));
  });
});
