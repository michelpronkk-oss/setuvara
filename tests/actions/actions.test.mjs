/**
 * Creator Actions and platform sign-in: CSV safety, email keys, counts, token sealing, OAuth
 * state and each platform's response parsing.
 *
 *   npm run test:actions
 *
 * Bundles the pure helpers with esbuild; no database, network or browser needed. Database rules
 * (RLS, plan limits, duplicate entries, closed giveaways) are in supabase/tests/creator_actions_security.sql.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-actions-"));
let model, csv, social, crypto, providers;

before(async () => {
  const stub = join(out, "server-only.js");
  writeFileSync(stub, "");
  const bundle = async (entry, name) => {
    await build({ entryPoints: [join(root, entry)], bundle: true, format: "cjs", platform: "node", alias: { "@": join(root, "src"), "server-only": stub }, outfile: join(out, `${name}.cjs`), logLevel: "silent" });
    return createRequire(import.meta.url)(join(out, `${name}.cjs`));
  };
  [model, csv, social, crypto, providers] = await Promise.all([
    bundle("src/lib/actions/model.ts", "model"),
    bundle("src/lib/actions/csv.ts", "csv"),
    bundle("src/lib/social/model.ts", "social"),
    bundle("src/lib/social/crypto.ts", "crypto"),
    bundle("src/lib/social/providers.ts", "providers"),
  ]);
});
after(() => rmSync(out, { recursive: true, force: true }));

describe("CSV export", () => {
  test("formula-looking cells can't run in a spreadsheet", () => {
    for (const evil of ["=HYPERLINK(\"x\")", "+1+1", "-2", "@SUM(A1)", "\tcmd", "\rcmd"]) assert.ok(csv.csvCell(evil).replace(/^"/, "").startsWith("'"), evil);
  });
  test("quotes, commas and newlines are escaped", () => {
    assert.equal(csv.csvCell('Say "hi", ok'), '"Say ""hi"", ok"');
    assert.equal(csv.csvCell("two\nlines"), '"two\nlines"');
    assert.equal(csv.toCsv(["a", "b"], [[1, null]]), "a,b\r\n1,\r\n");
  });
});

describe("Action model", () => {
  test("email key matches the database rule for duplicate entries", () => {
    assert.equal(model.normalizeEmail(" Aanya.Rao+win@GMail.com "), "aanyarao@gmail.com");
    assert.equal(model.normalizeEmail("aanya.rao@googlemail.com"), "aanyarao@gmail.com");
    assert.equal(model.normalizeEmail("lucas.meyer+x@example.com"), "lucas.meyer@example.com");
  });
  test("open, upcoming and ended come from the dates", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    assert.equal(model.actionWindow({ starts_at: null, ends_at: null }, now), "open");
    assert.equal(model.actionWindow({ starts_at: "2026-10-21T00:00:00Z", ends_at: null }, now), "upcoming");
    assert.equal(model.actionWindow({ starts_at: null, ends_at: "2026-10-20T12:00:00Z" }, now), "ended");
  });
  test("plan refusals read as plain copy", () => {
    assert.match(model.actionErrorMessage('new row violates: plan_giveaway_limit'), /Plus/);
    assert.match(model.actionErrorMessage("giveaway_terms_locked"), /entered/);
    assert.equal(model.actionErrorMessage("something else"), "That didn't save. Try again.");
  });
  test("defaults mirror the migration's plan table", () => {
    assert.deepEqual([model.DEFAULT_LIMITS.free.published_actions, model.DEFAULT_LIMITS.free.open_giveaways, model.DEFAULT_LIMITS.plus.open_giveaways, model.DEFAULT_LIMITS.pro.open_giveaways], [2, 0, 1, 5]);
  });
});

describe("audience counts", () => {
  test("never round up", () => {
    assert.equal(social.formatAudience(999), "999");
    assert.equal(social.formatAudience(61_499), "61.4K");
    assert.equal(social.formatAudience(284_000), "284K");
    assert.equal(social.formatAudience(1_999_999), "1.9M");
  });
  test("the combined number is a sum of known, visible counts only", () => {
    const base = { status: "connected", audience_hidden: false };
    assert.equal(social.combinedAudience([{ ...base, audience_count: 10 }]), null);
    assert.deepEqual(social.combinedAudience([{ ...base, audience_count: 10 }, { ...base, audience_count: 5 }, { ...base, audience_count: 7, audience_hidden: true }, { ...base, audience_count: null }, { status: "error", audience_hidden: false, audience_count: 9 }]), { total: 15, platforms: 2 });
  });
  test("old syncs read as outdated, refused tokens as sign in again", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    assert.equal(social.accountState({ status: "connected", last_synced_at: "2026-10-20T06:00:00Z" }, now), "synced");
    assert.equal(social.accountState({ status: "connected", last_synced_at: "2026-10-17T06:00:00Z" }, now), "outdated");
    assert.equal(social.accountState({ status: "needs_reauth", last_synced_at: "2026-10-20T06:00:00Z" }, now), "needs_reauth");
  });
});

describe("token sealing and OAuth state", () => {
  const key = randomBytes(32);
  test("a sealed token opens only for its own account", () => {
    const sealed = crypto.sealToken("ya29.secret", "social:youtube:a", key);
    assert.doesNotMatch(sealed, /secret/);
    assert.equal(crypto.openToken(sealed, "social:youtube:a", key), "ya29.secret");
    assert.throws(() => crypto.openToken(sealed, "social:youtube:b", key));
    assert.throws(() => crypto.openToken(sealed, "social:youtube:a", randomBytes(32)));
  });
  test("the key must be 32 bytes", () => {
    assert.throws(() => crypto.tokenKey("short"));
    assert.equal(crypto.tokenKey("a".repeat(64)).length, 32);
    assert.equal(crypto.tokenKey(randomBytes(32).toString("base64")).length, 32);
  });
  test("state is signed and expires", () => {
    const value = { provider: "twitch", state: "abc", user: "u1", exp: Date.now() + 60_000 };
    const cookie = crypto.signState(value, key);
    assert.deepEqual(crypto.readState(cookie, key), value);
    const [body, mac] = cookie.split(".");
    const forged = Buffer.from(JSON.stringify({ ...value, user: "u2" })).toString("base64url");
    assert.equal(crypto.readState(`${forged}.${mac}`, key), null);
    assert.equal(crypto.readState(`${body}.${mac}`, randomBytes(32)), null);
    assert.equal(crypto.readState(crypto.signState({ ...value, exp: Date.now() - 1 }, key), key), null);
  });
  test("PKCE challenge is the S256 of the verifier", async () => {
    const { verifier, challenge } = crypto.pkcePair();
    const { createHash } = await import("node:crypto");
    assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
    assert.ok(verifier.length >= 43 && verifier.length <= 128);
  });
});

describe("platform responses", () => {
  const creds = { clientId: "client", clientSecret: "secret" };
  test("authorize URLs carry state and the narrow scopes", () => {
    const yt = new URL(providers.PROVIDERS.youtube.authorizeUrl({ creds, redirectUri: "https://setuvara.com/api/social/youtube/callback", state: "s1", challenge: "c1" }));
    assert.equal(yt.searchParams.get("scope"), "https://www.googleapis.com/auth/youtube.readonly");
    assert.equal(yt.searchParams.get("code_challenge_method"), "S256");
    assert.equal(yt.searchParams.get("state"), "s1");
    const tt = new URL(providers.PROVIDERS.tiktok.authorizeUrl({ creds, redirectUri: "https://setuvara.com/cb", state: "s2" }));
    assert.equal(tt.searchParams.get("client_key"), "client");
    assert.equal(tt.searchParams.get("scope"), "user.info.basic,user.info.profile,user.info.stats");
    const ig = new URL(providers.PROVIDERS.instagram.authorizeUrl({ creds, redirectUri: "https://setuvara.com/cb", state: "s3" }));
    assert.equal(ig.searchParams.get("scope"), "instagram_business_basic");
    const tw = new URL(providers.PROVIDERS.twitch.authorizeUrl({ creds, redirectUri: "https://setuvara.com/cb", state: "s4" }));
    assert.equal(tw.searchParams.get("scope"), "moderator:read:followers");
  });
  test("YouTube: handle, rounded count, hidden count", () => {
    const channel = { items: [{ id: "UC1", snippet: { title: "Aanya Rao", customUrl: "@aanyarao", thumbnails: { default: { url: "https://yt3.ggpht.com/a" } } }, statistics: { subscriberCount: "61400", hiddenSubscriberCount: false } }] };
    assert.deepEqual(providers.parseYouTubeChannel(channel), { accountId: "UC1", username: "@aanyarao", displayName: "Aanya Rao", profileUrl: "https://www.youtube.com/@aanyarao", avatarUrl: "https://yt3.ggpht.com/a", audience: 61400, audienceHidden: false });
    const hidden = providers.parseYouTubeChannel({ items: [{ ...channel.items[0], statistics: { hiddenSubscriberCount: true } }] });
    assert.equal(hidden.audience, null);
    assert.equal(hidden.audienceHidden, true);
    assert.throws(() => providers.parseYouTubeChannel({ items: [] }), (error) => error.code === "no_account");
  });
  test("TikTok: errors map to sign-in again", () => {
    const user = providers.parseTikTokUser({ data: { user: { open_id: "o1", username: "aanya", display_name: "Aanya", follower_count: 133000, avatar_url: "https://p16.tiktokcdn.com/x" } }, error: { code: "ok" } });
    assert.equal(user.profileUrl, "https://www.tiktok.com/@aanya");
    assert.equal(user.audience, 133000);
    assert.throws(() => providers.parseTikTokUser({ error: { code: "access_token_invalid" } }), (error) => error.code === "unauthorized");
  });
  test("Instagram: professional accounts only, wrapped short tokens", () => {
    assert.equal(providers.parseInstagramMe({ user_id: "17841", username: "aanya", account_type: "MEDIA_CREATOR", followers_count: 284000 }).audience, 284000);
    assert.throws(() => providers.parseInstagramMe({ user_id: "1", username: "x", account_type: "PERSONAL" }), (error) => error.code === "not_professional");
    assert.equal(providers.parseInstagramShortToken({ data: [{ access_token: "IG1", user_id: 1, permissions: "instagram_business_basic" }] }).accessToken, "IG1");
  });
  test("Twitch: user and token rotation", () => {
    assert.equal(providers.parseTwitchUser({ data: [{ id: "141", login: "lucasmeyer", display_name: "LucasMeyer", profile_image_url: "https://static-cdn.jtvnw.net/x" }] }).login, "lucasmeyer");
    const previous = { accessToken: "a", refreshToken: "r1", expiresAt: null, refreshExpiresAt: null, scopes: "x" };
    assert.equal(providers.parseTokenResponse({ access_token: "b", refresh_token: "r2", expires_in: 3600, scope: ["moderator:read:followers"] }, previous).refreshToken, "r2");
    assert.equal(providers.parseTokenResponse({ access_token: "b", expires_in: 3600 }, previous).refreshToken, "r1");
    assert.throws(() => providers.parseTokenResponse({}), (error) => error.code === "bad_response");
  });
  test("untrusted avatar URLs are dropped", () => {
    assert.equal(providers.parseTwitchUser({ data: [{ id: "1", login: "x", profile_image_url: "javascript:alert(1)" }] }).avatarUrl, null);
  });
});
