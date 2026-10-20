/**
 * Privacy and Meta callbacks: signed_request verification, confirmation codes and the Instagram
 * second id used to match callbacks.
 *
 *   npm run test:privacy
 *
 * Bundles the pure helpers with esbuild; no database or network. The route handlers against a real
 * local database are in scripts/e2e-privacy.mjs; table rules in supabase/tests/privacy_requests_security.sql.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-privacy-"));
let signed, model, providers;

before(async () => {
  const stub = join(out, "server-only.js");
  writeFileSync(stub, "");
  const bundle = async (entry, name) => {
    await build({ entryPoints: [join(root, entry)], bundle: true, format: "cjs", platform: "node", alias: { "@": join(root, "src"), "server-only": stub }, outfile: join(out, `${name}.cjs`), logLevel: "silent" });
    return createRequire(import.meta.url)(join(out, `${name}.cjs`));
  };
  [signed, model, providers] = await Promise.all([
    bundle("src/lib/privacy/signed-request.ts", "signed"),
    bundle("src/lib/privacy/model.ts", "model"),
    bundle("src/lib/social/providers.ts", "providers"),
  ]);
});
after(() => rmSync(out, { recursive: true, force: true }));

const SECRET = "instagram-app-secret-for-tests";
const now = Date.UTC(2026, 9, 20, 18, 0, 0);
const payload = (extra = {}) => ({ algorithm: "HMAC-SHA256", expires: now / 1000 + 3600, issued_at: now / 1000, user_id: "17841400000000001", ...extra });

/** Exactly the PHP sample's construction: base64url(HMAC-SHA256(payload, secret)) . base64url(json). */
function metaStyle(body, secret) {
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sig = createHmac("sha256", secret).update(encoded).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${sig}.${encoded}`;
}

describe("signed_request", () => {
  test("accepts a genuine request signed like Meta's sample", () => {
    const result = signed.verifySignedRequest(metaStyle(payload(), SECRET), [SECRET], now);
    assert.equal(result.ok, true);
    assert.equal(result.value.userId, "17841400000000001");
    assert.equal(result.value.issuedAt.getTime(), now);
  });
  test("signRequest builds the same format", () => {
    assert.equal(signed.signRequest(payload(), SECRET), metaStyle(payload(), SECRET));
  });
  test("accepts either configured secret (Instagram app or Meta app)", () => {
    assert.equal(signed.verifySignedRequest(metaStyle(payload(), "meta-secret"), [SECRET, "meta-secret"], now).ok, true);
  });
  test("numeric user_id is read as a string", () => {
    const result = signed.verifySignedRequest(metaStyle(payload({ user_id: 218471 }), SECRET), [SECRET], now);
    assert.equal(result.ok && result.value.userId, "218471");
  });
  test("rejects a wrong secret", () => {
    assert.deepEqual(signed.verifySignedRequest(metaStyle(payload(), "attacker"), [SECRET], now), { ok: false, error: "bad_signature" });
  });
  test("rejects a payload edited after signing", () => {
    const genuine = metaStyle(payload(), SECRET);
    const [sig] = genuine.split(".");
    const forged = `${sig}.${Buffer.from(JSON.stringify(payload({ user_id: "someone-else" }))).toString("base64url")}`;
    assert.deepEqual(signed.verifySignedRequest(forged, [SECRET], now), { ok: false, error: "bad_signature" });
  });
  test("rejects with no secrets configured", () => {
    assert.equal(signed.verifySignedRequest(metaStyle(payload(), SECRET), [], now).ok, false);
    assert.equal(signed.verifySignedRequest(metaStyle(payload(), ""), [""], now).ok, false);
  });
  test("rejects malformed input", () => {
    for (const raw of [undefined, null, 42, "", "nodot", ".", "abc.", ".abc", "a b.c", `${"a".repeat(5000)}.b`]) {
      assert.deepEqual(signed.verifySignedRequest(raw, [SECRET], now), { ok: false, error: "malformed" }, String(raw).slice(0, 20));
    }
  });
  test("rejects a signed body that is not a JSON object", () => {
    const body = Buffer.from("[1,2]").toString("base64url");
    const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
    assert.deepEqual(signed.verifySignedRequest(`${sig}.${body}`, [SECRET], now), { ok: false, error: "malformed" });
  });
  test("rejects another algorithm", () => {
    assert.deepEqual(signed.verifySignedRequest(metaStyle(payload({ algorithm: "none" }), SECRET), [SECRET], now), { ok: false, error: "bad_algorithm" });
  });
  test("rejects a missing or unsafe user_id", () => {
    for (const user_id of [undefined, "", "a,b", "x.eq.1", "1)or(1", "a".repeat(201)]) {
      assert.deepEqual(signed.verifySignedRequest(metaStyle(payload({ user_id }), SECRET), [SECRET], now), { ok: false, error: "no_user" }, String(user_id));
    }
  });
  test("rejects issued_at in the future or missing, keeps old signals for retries", () => {
    assert.deepEqual(signed.verifySignedRequest(metaStyle(payload({ issued_at: now / 1000 + 3600 }), SECRET), [SECRET], now), { ok: false, error: "bad_time" });
    assert.deepEqual(signed.verifySignedRequest(metaStyle(payload({ issued_at: undefined }), SECRET), [SECRET], now), { ok: false, error: "bad_time" });
    assert.equal(signed.verifySignedRequest(metaStyle(payload({ issued_at: now / 1000 - 86400 * 3 }), SECRET), [SECRET], now).ok, true);
  });
});

describe("confirmation codes", () => {
  test("normalizes typed codes and rejects others", () => {
    assert.equal(model.normalizeConfirmationCode(" abcd-efgh-jkmn-pqrs-tuv2 "), "ABCDEFGHJKMNPQRSTUV2");
    for (const value of ["", "short", "ABCDEFGHJKMNPQRSTUV2X", "ABCD EFGH JKMN PQRS TUV!", null, 7]) assert.equal(model.normalizeConfirmationCode(value), null);
  });
  test("formats in groups of four", () => {
    assert.equal(model.formatConfirmationCode("ABCDEFGHJKMNPQRSTUV2"), "ABCD-EFGH-JKMN-PQRS-TUV2");
  });
  test("every status has wording that never claims deletion for a failure", () => {
    for (const kind of Object.keys(model.KIND_LABEL)) {
      for (const status of Object.keys(model.STATUS_LABEL)) {
        const text = model.statusExplanation(kind, status);
        assert.ok(text.length > 20);
        if (status === "failed" || status === "received" || status === "processing" || status === "cancelled") assert.doesNotMatch(text, /\bWe deleted\b|have been deleted/);
      }
    }
  });
});

describe("Instagram ids", () => {
  test("keeps the app-scoped id beside the professional account id", () => {
    const snapshot = providers.parseInstagramMe({ user_id: "17841400000000001", id: "9876543210", username: "studio.aanya", name: "Aanya", account_type: "MEDIA_CREATOR", followers_count: 1200 });
    assert.equal(snapshot.accountId, "17841400000000001");
    assert.equal(snapshot.scopedId, "9876543210");
  });
  test("no second id when only one is given", () => {
    assert.equal(providers.parseInstagramMe({ id: "9876543210", username: "a", account_type: "BUSINESS" }).scopedId, null);
  });
});
