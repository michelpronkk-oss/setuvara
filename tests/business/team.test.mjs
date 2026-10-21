// Business Teams model: invite checks, seats, the invite email and the export link for a team.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-team-"));
let team;
let model;
before(async () => {
  await build({ entryPoints: [join(root, "src/lib/business/team.ts")], bundle: true, format: "cjs", platform: "node", outfile: join(out, "team.cjs"), logLevel: "silent" });
  await build({ entryPoints: [join(root, "src/lib/business/model.ts")], bundle: true, format: "cjs", platform: "node", outfile: join(out, "model.cjs"), logLevel: "silent" });
  const require = createRequire(import.meta.url);
  team = require(join(out, "team.cjs"));
  model = require(join(out, "model.cjs"));
});
after(() => rmSync(out, { recursive: true, force: true }));

describe("invites", () => {
  test("an invite needs a real email that isn't the owner's", () => {
    assert.equal(team.inviteProblem("mara@vos.studio"), null);
    assert.equal(team.inviteProblem("  Mara@Vos.Studio ", "owner@example.com"), null);
    assert.match(team.inviteProblem("mara"), /email/);
    assert.match(team.inviteProblem("Owner@Example.com", "owner@example.com"), /own email/);
  });

  test("seats count members and live invites", () => {
    const member = (status) => ({ id: status, email: "a@b.co", role: "member", status, expires_at: null, created_at: "", accepted_at: null, display_name: null, username: null });
    assert.deepEqual(team.seatCount({ seats: 5, members: [member("active"), member("invited")] }), { used: 2, left: 3 });
    assert.deepEqual(team.seatCount({ seats: 0, members: [] }), { used: 0, left: 0 });
  });

  test("the invite link and email name the address that can accept", () => {
    const token = "a".repeat(32);
    assert.equal(team.invitePath(token), `/s/team-invite/${token}`);
    assert.ok(team.TOKEN.test(token));
    assert.equal(team.TOKEN.test("short"), false);
    const mail = decodeURIComponent(team.teamInviteMail({ to: "mara@vos.studio", owner: "Lucas Meyer", business: "Meyer Studio", role: "manager", url: "https://setuvara.com/s/team-invite/x" }));
    assert.ok(mail.startsWith("mailto:mara@vos.studio?subject=Join Meyer Studio on Setuvara"));
    assert.ok(mail.includes("as a manager of Meyer Studio"));
    assert.ok(mail.includes("Sign in or create an account with mara@vos.studio"));
  });

  test("a member's name falls back to the invited email", () => {
    assert.equal(team.memberName({ display_name: "Mara Vos", email: "mara@vos.studio" }), "Mara Vos");
    assert.equal(team.memberName({ display_name: null, email: "mara@vos.studio" }), "mara@vos.studio");
  });
});

describe("team export", () => {
  test("a teammate's export names the business", () => {
    const business = "11111111-2222-3333-4444-555555555555";
    assert.equal(model.leadExportHref("open", "vos", business), `/api/business/leads/export?filter=open&q=vos&business=${business}`);
    assert.equal(model.leadExportHref("all", ""), "/api/business/leads/export?filter=all");
  });
});
