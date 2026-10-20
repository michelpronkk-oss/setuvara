import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

// Privacy and Meta callbacks against local Setuvara Supabase and a running app:
// signed_request checks, deletion scope, idempotency, replay, a failed delete and its retry,
// the public pages, and the member's account deletion request in Settings.
const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const secret = process.env.INSTAGRAM_APP_SECRET;
const dbUrl = process.env.E2E_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/postgres";
const screenshots = resolve(process.env.E2E_PRIVACY_SCREENSHOTS ?? ".next/e2e-privacy");
assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "Privacy E2E requires local Setuvara Supabase");
assert(new URL(dbUrl).hostname === "127.0.0.1", "Privacy E2E only touches the local database");
assert(publishableKey && serviceKey && secret, "Local keys and the test Instagram secret must be supplied in process memory");
mkdirSync(screenshots, { recursive: true });

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(supabaseUrl, serviceKey, options);
const suffix = `${Date.now().toString(36).slice(-3)}${randomBytes(3).toString("hex")}`;
const userIds = [];
const psql = (sql) => execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-Atc", sql], { encoding: "utf8" });
let checks = 0;
const check = (label) => { checks += 1; console.log(`ok ${checks} - ${label}`); };

function signed(payload, key = secret) {
  const body = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", ...payload })).toString("base64url");
  return `${createHmac("sha256", key).update(body).digest("base64url")}.${body}`;
}
const post = (path, signedRequest, type = "application/x-www-form-urlencoded") => fetch(`${appUrl}${path}`, {
  method: "POST",
  headers: { "Content-Type": type },
  body: type.includes("json") ? JSON.stringify({ signed_request: signedRequest }) : new URLSearchParams(signedRequest === undefined ? {} : { signed_request: signedRequest }).toString(),
});
const DELETION = "/api/social/instagram/data-deletion";
const DEAUTH = "/api/social/instagram/deauthorize";
const now = () => Math.floor(Date.now() / 1000);

async function member(role) {
  const email = `e2e-privacy-${role}-${suffix}@example.test`;
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const username = `pv_${role}_${suffix}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, display_name: `Privacy ${role}` } });
  assert.ifError(created.error);
  userIds.push(created.data.user.id);
  return { id: created.data.user.id, email, password, username };
}

async function connect(profileId, provider, accountId, scopedId = null, connectedAt = new Date()) {
  const { data, error } = await admin.from("social_accounts").insert({
    profile_id: profileId, provider, provider_account_id: accountId, provider_scoped_id: scopedId, username: `${provider}_${suffix}`,
    display_name: "Test", audience_count: 1200, last_synced_at: new Date().toISOString(), connected_at: connectedAt.toISOString(),
  }).select("id").single();
  assert.ifError(error);
  assert.ifError((await admin.from("social_account_secrets").insert({ account_id: data.id, access_token_enc: "v1.test-ciphertext" })).error);
  return data.id;
}
const exists = async (id) => ((await admin.from("social_accounts").select("id").eq("id", id)).data ?? []).length === 1;
const secretExists = async (id) => ((await admin.from("social_account_secrets").select("account_id").eq("account_id", id)).data ?? []).length === 1;
const statusOf = async (code) => (await admin.from("privacy_requests").select("status, accounts_removed, attempts, subject_hash, profile_id").eq("confirmation_code", code).single()).data;

const browser = await chromium.launch({ headless: true, ...(process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {}) });
try {
  const alice = await member("a");
  const bob = await member("b");
  const aliceIg = `1784${randomBytes(6).readUIntBE(0, 6)}`;
  const bobIg = `1785${randomBytes(6).readUIntBE(0, 6)}`;
  const bobScoped = `9${randomBytes(5).readUIntBE(0, 5)}`;
  const aliceAccount = await connect(alice.id, "instagram", aliceIg, null, new Date(Date.now() - 3600_000));
  const bobAccount = await connect(bob.id, "instagram", bobIg, bobScoped, new Date(Date.now() - 3600_000));
  const bobTikTok = await connect(bob.id, "tiktok", aliceIg, null, new Date(Date.now() - 3600_000));

  // Rejections: nothing is touched.
  assert.equal((await fetch(`${appUrl}${DELETION}`)).status, 405); check("GET is not accepted");
  assert.equal((await post(DELETION, undefined)).status, 400); check("missing signed_request is rejected");
  assert.equal((await post(DELETION, signed({ user_id: aliceIg, issued_at: now() }, "forged-secret"))).status, 400); check("forged signature is rejected");
  const genuine = signed({ user_id: aliceIg, issued_at: now() });
  const [sig] = genuine.split(".");
  const swapped = `${sig}.${Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: bobIg, issued_at: now() })).toString("base64url")}`;
  assert.equal((await post(DELETION, swapped)).status, 400); check("a genuine signature over another payload is rejected");
  assert.equal((await post(DELETION, signed({ user_id: aliceIg, issued_at: now() + 7200 }))).status, 400); check("future issued_at is rejected");
  assert.equal((await post("/api/social/tiktok/data-deletion", genuine)).status, 404); check("only Instagram has Meta callbacks");
  assert.equal((await post("/api/social/nothing/deauthorize", genuine)).status, 404); check("unknown provider is 404");
  assert.ok(await exists(aliceAccount) && await exists(bobAccount) && await exists(bobTikTok)); check("rejected callbacks deleted nothing");

  // Genuine data deletion for Alice.
  const first = await post(DELETION, genuine);
  assert.equal(first.status, 200);
  const body = await first.json();
  assert.match(body.confirmation_code, /^[A-Z0-9]{20}$/);
  assert.equal(body.url, `${appUrl}/data-deletion/status?code=${body.confirmation_code}`);
  check("data deletion answers { url, confirmation_code }");
  assert.equal(await exists(aliceAccount), false); assert.equal(await secretExists(aliceAccount), false); check("Alice's Instagram account and tokens are deleted");
  assert.ok(await exists(bobAccount) && await exists(bobTikTok)); check("Bob's accounts are untouched, including a TikTok id equal to Alice's Instagram id");
  const row = await statusOf(body.confirmation_code);
  assert.equal(row.status, "completed"); assert.equal(row.accounts_removed, 1); assert.equal(row.profile_id, alice.id);
  assert.match(row.subject_hash, /^[0-9a-f]{64}$/); assert.notEqual(row.subject_hash, aliceIg);
  assert.equal(psql(`select count(*) from public.privacy_requests where subject_hash like '%${aliceIg}%' or confirmation_code like '%${aliceIg}%'`).trim(), "0");
  check("request recorded as completed with a hash, never the raw id");

  // Retry of the same signal: same code, no second row. JSON bodies are read too.
  const retry = await post(DELETION, genuine, "application/json");
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).confirmation_code, body.confirmation_code);
  assert.equal(psql(`select count(*) from public.privacy_requests where subject_hash='${row.subject_hash}'`).trim(), "1");
  check("a retried signal returns the same confirmation code");

  // Replay protection: Alice reconnects; an older signal can't remove the new connection.
  const aliceAgain = await connect(alice.id, "instagram", aliceIg);
  const older = await post(DELETION, genuine);
  assert.equal(older.status, 200); assert.ok(await exists(aliceAgain)); check("replaying the old signal keeps a later reconnection");
  const olderNew = await post(DELETION, signed({ user_id: aliceIg, issued_at: now() - 7200 }));
  const olderBody = await olderNew.json();
  assert.equal((await statusOf(olderBody.confirmation_code)).status, "no_data"); assert.ok(await exists(aliceAgain));
  check("a signal issued before the reconnection deletes nothing and says so");

  // Unknown user.
  const unknown = await (await post(DELETION, signed({ user_id: "1000000000001", issued_at: now() }))).json();
  assert.equal((await statusOf(unknown.confirmation_code)).status, "no_data"); check("unknown user is answered with a code and no_data");

  // Deauthorize by Bob's app-scoped id: Instagram only, TikTok stays.
  const deauth = await post(DEAUTH, signed({ user_id: bobScoped, issued_at: now() }));
  assert.equal(deauth.status, 200); assert.deepEqual(await deauth.json(), { success: true });
  assert.equal(await exists(bobAccount), false); assert.ok(await exists(bobTikTok)); check("deauthorize by app-scoped id removes only Bob's Instagram");
  assert.equal((await post(DEAUTH, signed({ user_id: bobScoped, issued_at: now() }, "nope"))).status, 400); check("forged deauthorize is rejected");

  // A failed delete is not reported as done, and the retry finishes it.
  psql("revoke delete on public.social_accounts from service_role");
  let failing;
  try {
    failing = signed({ user_id: aliceIg, issued_at: now() + 2 });
    const failed = await post(DELETION, failing);
    assert.equal(failed.status, 500);
    assert.ok(await exists(aliceAgain));
    const failedRow = (await admin.from("privacy_requests").select("status, error_code, confirmation_code").eq("kind", "platform_data_deletion").order("created_at", { ascending: false }).limit(1).single()).data;
    assert.equal(failedRow.status, "failed"); assert.equal(failedRow.error_code, "delete_failed");
    check("a database failure answers 500 and records failed, not completed");
  } finally {
    psql("grant delete on public.social_accounts to service_role");
  }
  const recovered = await post(DELETION, failing);
  assert.equal(recovered.status, 200);
  const recoveredBody = await recovered.json();
  const recoveredRow = await statusOf(recoveredBody.confirmation_code);
  assert.equal(recoveredRow.status, "completed"); assert.equal(recoveredRow.attempts, 2); assert.equal(await exists(aliceAgain), false);
  check("Meta's retry of the failed signal completes it under the same code");

  // Public pages.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => { throw new Error(`Runtime error on ${page.url()}: ${error.message}`); });
  await page.goto(`${appUrl}/data-deletion`);
  assert.equal(await page.title(), "Data deletion | Setuvara");
  for (const heading of ["Disconnect a platform", "What happens to sign-in tokens", "Delete your Setuvara account", "What we may keep", "How you get confirmation"]) await page.getByRole("heading", { name: heading }).waitFor();
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://setuvara.com/data-deletion");
  await page.screenshot({ path: resolve(screenshots, "data-deletion-390.png"), fullPage: true });
  check("public /data-deletion renders without login");
  await page.goto(body.url.replace("https://setuvara.com", appUrl));
  await page.getByText("Completed", { exact: true }).waitFor();
  assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /noindex/);
  assert.equal((await page.content()).includes(aliceIg), false);
  await page.screenshot({ path: resolve(screenshots, "status-completed-390.png"), fullPage: true });
  check("status page shows the result, is noindex and never shows the platform id");
  await page.goto(`${appUrl}/data-deletion/status?code=ZZZZZZZZZZZZZZZZZZZZ`);
  await page.getByText("We couldn't find a request with that code.").waitFor();
  await page.goto(`${appUrl}/data-deletion/status?code=%27%3Bselect`);
  await page.getByText("We couldn't find a request with that code.").waitFor();
  check("unknown and malformed codes show a plain not-found");
  await context.close();

  // Account deletion request in Settings.
  assert.equal((await fetch(`${appUrl}/api/privacy/account-deletion`, { method: "POST" })).status, 403);
  assert.equal((await fetch(`${appUrl}/api/privacy/account-deletion`, { method: "POST", headers: { "x-setuvara-request": "same-origin" } })).status, 401);
  check("account deletion API needs same-origin and a session");
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const ctx = await browser.newContext({ viewport });
    const p = await ctx.newPage();
    p.on("pageerror", (error) => { throw new Error(`Runtime error on ${p.url()}: ${error.message}`); });
    await p.goto(`${appUrl}/login`);
    await p.getByLabel("Email").fill(bob.email);
    await p.getByLabel("Password", { exact: true }).fill(bob.password);
    await p.locator('button[type="submit"]').click();
    await p.waitForURL(/\/app/, { timeout: 20_000 });
    await p.getByRole("button", { name: "Account menu" }).click();
    await p.getByRole("menuitem", { name: "Privacy & data" }).click();
    await p.waitForURL(/\/app\/settings\/privacy/);
    await p.getByRole("heading", { name: "Privacy & data" }).waitFor();
    await p.getByText("TikTok", { exact: true }).waitFor();
    if (viewport.width === 390) {
      await p.screenshot({ path: resolve(screenshots, "settings-before-390.png"), fullPage: true });
      const submit = p.getByRole("button", { name: "Request account deletion" });
      assert.equal(await submit.isDisabled(), true);
      await p.getByLabel(/to confirm/).fill("someone_else");
      assert.equal(await submit.isDisabled(), true);
      await p.getByLabel(/to confirm/).fill(bob.username);
      await submit.click();
      await p.getByRole("button", { name: "Withdraw request" }).waitFor();
      await p.screenshot({ path: resolve(screenshots, "settings-requested-390.png"), fullPage: true });
      check("member requests deletion by typing their username");
      const open = (await admin.from("privacy_requests").select("status, kind").eq("profile_id", bob.id).eq("kind", "account_deletion")).data;
      assert.equal(open.length, 1); assert.equal(open[0].status, "received");
      assert.ok(await exists(bobTikTok)); check("the request deletes nothing on its own");
      const again = await p.evaluate(async (username) => (await fetch("/api/privacy/account-deletion", { method: "POST", headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" }, body: JSON.stringify({ confirm: username }) })).json(), bob.username);
      assert.equal(again.created, false); check("asking twice returns the open request");
      await p.getByRole("button", { name: "Withdraw request" }).click();
      await p.getByRole("button", { name: "Request account deletion" }).waitFor();
      assert.equal((await admin.from("privacy_requests").select("status").eq("profile_id", bob.id).eq("kind", "account_deletion").single()).data.status, "cancelled");
      check("member can withdraw before it is processed");
    } else {
      await p.screenshot({ path: resolve(screenshots, "settings-1440.png"), fullPage: true });
    }
    await ctx.close();
  }
  // Alice can't see Bob's requests through the API.
  const aliceClient = createClient(supabaseUrl, publishableKey, options);
  assert.ifError((await aliceClient.auth.signInWithPassword({ email: alice.email, password: alice.password })).error);
  const visible = (await aliceClient.from("privacy_requests").select("profile_id:id, kind")).data ?? [];
  assert.equal(visible.some((item) => item.kind === "account_deletion"), false);
  assert.ok((await aliceClient.from("privacy_requests").select("subject_hash")).error, "subject_hash is not readable");
  check("members read only their own requests and never the hash");

  console.log(`Privacy E2E passed (${checks} checks). Screenshots: ${screenshots}`);
} finally {
  await browser.close();
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
}
