import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-creator-"));
let domain;

before(async () => {
  await build({
    stdin: { contents: `export * from "@/lib/creator/state"; export * from "@/lib/creator/money"; export { MODE_LAYOUTS, resolveAppearance } from "@/components/profile/appearance";`, resolveDir: root, loader: "ts" },
    bundle: true, format: "cjs", platform: "node", alias: { "@": join(root, "src") },
    outfile: join(out, "creator.cjs"), logLevel: "silent",
  });
  domain = createRequire(import.meta.url)(join(out, "creator.cjs"));
});

after(() => rmSync(out, { recursive: true, force: true }));

test("monetization requires approval, verified KYC, enabled payout, accepted terms, and no suspension", () => {
  const account = { application_status: "approved", kyc_status: "verified", payout_status: "enabled", terms_version: "v1", terms_accepted_at: "2026-10-12T00:00:00Z", suspended_at: null };
  const payoutAccount = { status: "enabled", payouts_enabled: true, details_submitted: true };
  assert.equal(domain.canMonetize(account, payoutAccount), true);
  for (const patch of [
    { application_status: "applied" }, { kyc_status: "pending" }, { payout_status: "pending" },
    { terms_version: null }, { terms_accepted_at: null }, { suspended_at: "2026-10-12T00:00:00Z" },
  ]) assert.equal(domain.canMonetize({ ...account, ...patch }, payoutAccount), false);
  assert.equal(domain.canMonetize(account, { ...payoutAccount, payouts_enabled: false }), false);
  assert.equal(domain.canMonetize(account, null), false);
  assert.equal(domain.canMonetize(null, payoutAccount), false);
});

test("Creator is a fourth Mode with independent shared Appearance storage", () => {
  assert.deepEqual(domain.MODE_LAYOUTS.creator.slice(0, 2), ["full-bleed", "portrait-editorial"]);
  const creator = domain.resolveAppearance({ slug: "creator", appearance: { theme: "light", layout: "portrait-editorial", imageTreatment: "portrait", accent: "#FF5A4F" } }, "free");
  const personal = domain.resolveAppearance({ slug: "personal", appearance: { theme: "light", layout: "portrait-editorial", imageTreatment: "portrait", accent: "#FF5A4F" } }, "free");
  assert.equal(creator.slug, "creator");
  assert.equal(creator.layout, personal.layout);
  assert.equal(creator.family, personal.family);
});

test("review, KYC, and payout transitions reject client-like promotion shortcuts", () => {
  assert.equal(domain.canTransitionApplication("not_applied", "approved"), false);
  assert.equal(domain.canTransitionApplication("applied", "under_review"), true);
  assert.equal(domain.canTransitionApplication("under_review", "approved"), true);
  assert.equal(domain.canTransitionKyc("not_started", "verified"), false);
  assert.equal(domain.canTransitionKyc("pending", "verified"), true);
  assert.equal(domain.canTransitionPayout("not_connected", "enabled"), false);
  assert.equal(domain.canTransitionPayout("pending", "enabled"), true);
});

test("Creator content access keeps follows, memberships, purchases, and drops independent", () => {
  const decide = (values) => domain.creatorBlockAccessDecision({ isFollower: false, hasActiveMembership: false, hasPurchaseGrant: false, ...values });
  assert.equal(decide({}).toString(), "public");
  assert.equal(decide({ accessLevel: "followers" }), "denied");
  assert.equal(decide({ accessLevel: "followers", isFollower: true }), "follower");
  assert.equal(decide({ accessLevel: "members", isFollower: true }), "denied");
  assert.equal(decide({ accessLevel: "members", hasActiveMembership: true }), "member");
  assert.equal(decide({ accessLevel: "purchase", hasActiveMembership: true }), "denied");
  assert.equal(decide({ accessLevel: "purchase", hasPurchaseGrant: true }), "purchase");
  assert.equal(decide({ accessLevel: "public", isDropAvailable: false }), "denied");
});

test("creator amounts use integer minor units, basis points, and deterministic signed ledger sums", () => {
  assert.equal(domain.isIsoCurrency("USD"), true);
  assert.equal(domain.isIsoCurrency("usd"), false);
  assert.equal(domain.calculatePlatformFee(999, 800), 79);
  assert.equal(domain.creatorNetAmount(999, 800, 30), 890);
  assert.throws(() => domain.calculatePlatformFee(1.25, 800), RangeError);
  assert.throws(() => domain.calculatePlatformFee(100, 10001), RangeError);
  assert.deepEqual([...domain.sumLedgerBalance([
    { currency: "USD", amount_minor: 1000 }, { currency: "USD", amount_minor: -200 },
    { currency: "EUR", amount_minor: 400 },
  ])], [["USD", 800], ["EUR", 400]]);
});
