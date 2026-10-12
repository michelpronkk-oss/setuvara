/**
 * Local-only E2E for opaque Mode share URLs.
 *
 * Contract:
 *   - /<username> only ever shows the default (Personal) Mode; ?mode= is ignored.
 *   - Event and Business open only through /s/<short id> (8 Base62 chars),
 *     resolved server-side; legacy 43-character tokens keep resolving.
 *   - Regenerating a Mode link retires every older link to it.
 *   - Owner surfaces (Share, Live at, View live profile), Quick QR and
 *     Connection Pass landings use the opaque URL, never ?mode=.
 *   - Connection Access is unchanged: a share locator is a pointer, never a pass.
 *
 * Run through the local runner:  E2E_LOCAL_SCRIPT=scripts/e2e-mode-share.mjs npm run e2e:local
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

import { landedMode, mintLegacyModeToken } from "./lib/mode-share-url.mjs";

const root = resolve(process.cwd());
const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
assert.equal(gitRoot.replaceAll("\\", "/").toLowerCase(), root.replaceAll("\\", "/").toLowerCase(), "Mode share E2E must run from the Setuvara Git root");

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
assert.equal(new URL(appUrl).origin, "http://127.0.0.1:3014", "Mode share E2E must use the Setuvara loopback app");
assert.equal(new URL(supabaseUrl).origin, "http://127.0.0.1:54321", "Mode share E2E must use local Supabase only");
assert(publishableKey && serviceKey);

const suffix = `${Date.now().toString(36).slice(-6)}${randomBytes(3).toString("hex")}`;
const ownerAccount = {
  email: `e2e-share-owner-${suffix}@example.test`,
  password: `${randomBytes(32).toString("base64url")}Aa1!`,
  username: `share_${suffix}`,
  displayName: "Share Owner E2E",
};
const SECRET_EVENT = `Secret Summit ${suffix}`;
const SECRET_BUSINESS = `Hidden Holdings ${suffix}`;
const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const createdUserIds = [];

function userClient() {
  return createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function signUpAndConfirm(browser, account) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let confirmationRouteSeen = false;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/auth/confirm") confirmationRouteSeen = true;
  });
  await page.goto(`${appUrl}/signup`);
  await page.getByLabel("Username").fill(account.username);
  await page.getByText("Available. It’s yours if you want it.").waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: `Claim @${account.username}` }).click();
  await page.getByLabel("Your name").fill(account.displayName);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Create my Setuvara" }).click();
  await page.getByRole("heading", { name: "Check your inbox." }).waitFor({ timeout: 15_000 });

  const confirmationUrl = await waitForConfirmation(account.email);
  assert(!confirmationUrl.includes(account.password), "Confirmation URL must not contain test credentials");
  try {
    await page.goto(confirmationUrl);
    await page.waitForURL((url) => url.origin === appUrl && url.pathname === "/app/identity", { timeout: 20_000 });
    await page.getByRole("heading", { name: "Personal Mode", exact: true }).waitFor();
  } catch {
    throw new Error("Setuvara signup confirmation failed to create a session and reach /app/identity (confirmation URL redacted)");
  }
  assert(confirmationRouteSeen, "Normal signup must visit /auth/confirm in the same browser context");
  assert((await context.cookies(appUrl)).some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")), "Confirmation must establish a Supabase SSR session cookie");

  const client = userClient();
  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  assert.ifError(signInError);
  assert(signIn.user?.id && signIn.session?.access_token, "Freshly confirmed account must support normal authenticated client permissions");
  createdUserIds.push(signIn.user.id);
  return { context, page, client, id: signIn.user.id, account };
}

async function waitForConfirmation(email) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=100`);
    assert.equal(response.status, 200, "Local Mailpit should be reachable");
    const messages = (await response.json()).messages ?? [];
    const message = messages.find((item) => JSON.stringify(item.To ?? item.to ?? []).toLowerCase().includes(email.toLowerCase()));
    if (message) {
      const detailResponse = await fetch(`${mailpitUrl}/api/v1/message/${encodeURIComponent(message.ID ?? message.id)}`);
      assert.equal(detailResponse.status, 200, "Mailpit should return the local confirmation message");
      const detail = await detailResponse.json();
      const body = `${detail.HTML ?? detail.html ?? ""}\n${detail.Text ?? detail.text ?? ""}`;
      const rawLink = body.match(/https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/i)?.[0];
      assert(rawLink, "Signup confirmation must use Setuvara /auth/confirm");
      const url = new URL(rawLink.replaceAll("&amp;", "&"));
      assert.equal(url.origin, appUrl);
      assert.equal(url.pathname, "/auth/confirm");
      assert(/^[A-Za-z0-9_-]{32,128}$/.test(url.searchParams.get("token_hash") ?? ""), "Confirmation must use an opaque token_hash");
      assert.equal(url.searchParams.get("type"), "email");
      assert.equal(url.searchParams.get("next"), "/app/identity");
      return url.toString();
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
  }
  throw new Error("Timed out waiting for a local signup confirmation email");
}

async function setMode(account, mode, patch) {
  const { error } = await account.client.from("profile_modes").update(patch).eq("profile_id", account.id).eq("slug", mode);
  assert.ifError(error);
}

async function publicMode(page, path) {
  const response = await page.goto(new URL(path, appUrl).toString());
  const status = response?.status() ?? 0;
  if (status !== 200) return { status, mode: null, html: "" };
  await page.locator("article[data-profile-mode]").first().waitFor();
  return {
    status,
    mode: await page.locator("article[data-profile-mode]").first().getAttribute("data-profile-mode"),
    html: await page.content(),
  };
}

async function expectPersonalOnly(page, path, label) {
  const result = await publicMode(page, path);
  assert.equal(result.status, 200, `${label}: the username URL still opens`);
  assert.equal(result.mode, "personal", `${label}: must show the default Mode only`);
  assert(!result.html.includes(SECRET_EVENT), `${label}: Event content must not leak`);
  assert(!result.html.includes(SECRET_BUSINESS), `${label}: Business content must not leak`);
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
  assert(ogImage?.endsWith("/personal"), `${label}: preview image must be Personal`);
}

const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM ?? undefined });
try {
  const owner = await signUpAndConfirm(browser, ownerAccount);
  const { error: publishError } = await owner.client.from("profiles").update({ is_published: true }).eq("id", owner.id);
  assert.ifError(publishError);
  await setMode(owner, "event", { is_enabled: true, connect_policy: "anyone", settings: { eventName: SECRET_EVENT, city: "Lisbon" } });
  await setMode(owner, "business", { is_enabled: true, connect_policy: "nobody", settings: { company: SECRET_BUSINESS, role: "Founder" } });

  const anon = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const visitor = await anon.newPage();

  // 1. The canonical username URL never selects or reveals another Mode.
  const username = ownerAccount.username;
  for (const query of ["", "?mode=event", "?mode=business", "?mode=EVENT", "?mode=event&mode=business", "?mode[]=event", "?mode=business&source=qr", "?mode=personal"]) {
    await expectPersonalOnly(visitor, `/${username}${query}`, `/${username}${query}`);
  }
  const legacy = await anon.request.get(`${appUrl}/u/${username}?mode=event`, { maxRedirects: 0 });
  assert.equal(legacy.status(), 308);
  assert.equal(legacy.headers().location, `/${username}`, "Legacy /u/ redirect must drop ?mode=");
  for (const mode of ["event", "business"]) {
    assert.equal((await anon.request.get(`${appUrl}/og/profile/${username}/${mode}`)).status(), 404, `Predictable ${mode} preview image must not exist`);
  }
  assert.equal((await anon.request.get(`${appUrl}/og/profile/${username}/personal`)).status(), 200);
  console.log("PASS username URL ignores ?mode= and exposes only Personal");

  // 2. Owner surfaces show opaque links.
  const shareLinks = {};
  for (const mode of ["event", "business"]) {
    await owner.page.goto(`${appUrl}/app/identity?mode=${mode}&section=share`);
    const qr = owner.page.locator("[data-share-intent]").first();
    await qr.waitFor();
    const qrUrl = new URL(await qr.getAttribute("data-qr-value"));
    assert.match(qrUrl.pathname, /^\/s\/[0-9A-Za-z]{8}$/, `${mode} Share QR uses an 8-character short id`);
    assert.equal(qrUrl.searchParams.get("mode"), null);
    assert.equal(qrUrl.searchParams.get("source"), "qr");
    assert(!qrUrl.href.includes(username), "The opaque link does not name the person");
    shareLinks[mode] = qrUrl.pathname;
    const live = owner.page.getByRole("link", { name: /View live profile/ });
    if (await live.count()) assert.equal(new URL(await live.first().getAttribute("href")).pathname, qrUrl.pathname, `${mode} View live profile uses the opaque URL`);
    await owner.page.reload();
    await owner.page.locator("[data-share-intent]").first().waitFor();
    assert.equal(new URL(await owner.page.locator("[data-share-intent]").first().getAttribute("data-qr-value")).pathname, qrUrl.pathname, `${mode} link is stable across reloads`);
  }
  assert.notEqual(shareLinks.event, shareLinks.business, "Each Mode has its own locator");
  await owner.page.goto(`${appUrl}/app/identity?mode=personal&section=share`);
  await owner.page.locator("[data-share-intent]").first().waitFor();
  assert.equal(new URL(await owner.page.locator("[data-share-intent]").first().getAttribute("data-qr-value")).pathname, `/${username}`, "Personal stays the username URL");
  console.log("PASS owner Share, Live at and View live profile use opaque Mode links");

  // 3. Opaque links open the right Mode with the same profile experience.
  const event = await publicMode(visitor, shareLinks.event);
  assert.equal(event.status, 200);
  assert.equal(event.mode, "event");
  assert(event.html.includes(SECRET_EVENT));
  assert.match(await visitor.locator('meta[name="robots"]').getAttribute("content"), /noindex/i, "Mode share pages stay out of search");
  const eventOg = await visitor.locator('meta[property="og:image"]').getAttribute("content");
  assert.equal(new URL(eventOg).pathname, `/og${shareLinks.event}`, "Event preview image is served from the opaque path");
  assert.equal((await anon.request.get(`${appUrl}/og${shareLinks.event}`)).status(), 200);
  assert.equal(await visitor.getByRole("button", { name: /connect/i }).count() > 0, true, "Event Anyone keeps Connect");
  const tampered = await publicMode(visitor, `${shareLinks.event}?mode=business`);
  assert.equal(tampered.mode, "event", "A query on the opaque URL cannot switch Modes");
  const business = await publicMode(visitor, shareLinks.business);
  assert.equal(business.mode, "business");
  assert(business.html.includes(SECRET_BUSINESS));
  assert.equal(await visitor.getByRole("button", { name: /^connect/i }).count(), 0, "Business Nobody still has no Connect behind its share link");
  const flipped = shareLinks.event.slice(0, -1) + (shareLinks.event.endsWith("A") ? "B" : "A");
  for (const bad of [flipped, shareLinks.event.toLowerCase() === shareLinks.event ? shareLinks.event.toUpperCase() : shareLinks.event.toLowerCase(), `${shareLinks.event}x`, shareLinks.event.slice(0, -1), "/s/short", `/s/${"A".repeat(43)}`, "/s/..%2Fadmin", "/s/K7mP_xQa"]) {
    assert.equal((await anon.request.get(`${appUrl}${bad}`)).status(), 404, `${bad} must not resolve`);
  }
  console.log("PASS opaque links resolve to exactly one Mode; tampering 404s");

  // 4. A share locator is only a pointer: disabled Modes and drafts close it.
  await setMode(owner, "event", { is_enabled: false });
  assert.equal((await anon.request.get(`${appUrl}${shareLinks.event}`)).status(), 404, "Disabled Mode closes its share link");
  await setMode(owner, "event", { is_enabled: true });
  assert.equal((await publicMode(visitor, shareLinks.event)).mode, "event", "Re-enabled Mode reopens the same link");
  await owner.client.from("profiles").update({ is_published: false }).eq("id", owner.id);
  assert.equal((await anon.request.get(`${appUrl}${shareLinks.event}`)).status(), 404, "Draft identity closes share links");
  await owner.client.from("profiles").update({ is_published: true }).eq("id", owner.id);
  console.log("PASS share links follow publish and Mode on/off");

  // 5. Quick QR and Connection Pass land on the opaque link, never ?mode=.
  const { error: equipError } = await owner.client.rpc("set_equipped_share_state", { p_mode: "event", p_intent: "view_profile" });
  assert.ifError(equipError);
  const quick = await owner.page.evaluate(async () => {
    const response = await fetch("/api/tap/quick-share", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" });
    return { status: response.status, payload: await response.json().catch(() => null) };
  });
  assert.equal(quick.status, 200, "Owner can read their Quick QR");
  const quickRedirect = await anon.request.get(quick.payload.url, { maxRedirects: 0 });
  assert.equal(quickRedirect.status(), 303);
  const quickLocation = new URL(quickRedirect.headers().location, appUrl);
  assert.equal(quickLocation.pathname, shareLinks.event, "Quick QR lands on the Event share link");
  assert.equal(quickLocation.searchParams.get("source"), "quick_qr");
  assert.equal(await landedMode(quickLocation.href), "event");

  await setMode(owner, "event", { connect_policy: "direct_only" });
  const { data: pass, error: passError } = await owner.client.rpc("issue_connection_pass", { p_mode: "event" });
  assert.ifError(passError);
  const passRedirect = await anon.request.get(`${appUrl}/connect/${pass.token}`, { maxRedirects: 0 });
  assert.equal(new URL(passRedirect.headers().location, appUrl).pathname, shareLinks.event, "Connection Pass lands on the Event share link");
  const passContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const passPage = await passContext.newPage();
  await passPage.goto(`${appUrl}/connect/${pass.token}`);
  await passPage.locator('article[data-profile-mode="event"]').waitFor();
  assert(await passPage.getByRole("button", { name: /connect/i }).count() > 0, "A valid pass still unlocks Connect on the opaque Event link");
  // anon.request shares cookies with the anon context, which now holds the pass.
  const noPassContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const noPass = await noPassContext.newPage();
  await noPass.goto(`${appUrl}${shareLinks.event}`);
  await noPass.locator('article[data-profile-mode="event"]').waitFor();
  assert.equal(await noPass.getByRole("button", { name: /^connect/i }).count(), 0, "Direct only: the share link alone never grants Connect");
  await passContext.close();
  await noPassContext.close();
  console.log("PASS Quick QR and Connection Pass land on opaque links");

  // 6. Browsers can never read the locator table directly.
  const { data: leaked, error: leakError } = await owner.client.from("mode_share_locators").select("*");
  assert(leakError || (leaked ?? []).length === 0, "Signed-in owners cannot read locator rows");
  const { data: anonLeak, error: anonLeakError } = await userClient().from("mode_share_locators").select("*");
  assert(anonLeakError || (anonLeak ?? []).length === 0, "Anonymous visitors cannot read locator rows");
  console.log("PASS locator table is server-only");

  // 7. Short ids are uniform Base62 from the database CSPRNG.
  const samples = [];
  for (let i = 0; i < 400; i += 1) {
    const { data, error } = await admin.rpc("mode_share_short_id");
    assert.ifError(error);
    assert.match(data, /^[0-9A-Za-z]{8}$/);
    samples.push(data);
  }
  assert.equal(new Set(samples).size, samples.length, "No repeats across 400 short ids");
  const counts = new Map();
  for (const char of samples.join("")) counts.set(char, (counts.get(char) ?? 0) + 1);
  assert.equal(counts.size, 62, "Every Base62 character appears");
  // 3200 characters over 62 symbols: about 52 each; a biased mapping would skew far wider.
  assert(Math.min(...counts.values()) > 20 && Math.max(...counts.values()) < 95, `Character spread looks uniform (${Math.min(...counts.values())}..${Math.max(...counts.values())})`);
  for (const role of [owner.client, userClient()]) {
    const { error } = await role.rpc("mode_share_short_id");
    assert(error, "Browsers cannot call the id generator");
  }
  console.log("PASS short ids are 8 uniform Base62 characters");

  // 8. Links shared before short ids keep working, until the owner regenerates.
  const legacyToken = await mintLegacyModeToken(username, "event");
  assert.match(legacyToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal((await publicMode(visitor, `/s/${legacyToken}`)).mode, "event", "A legacy long Event link still opens");
  assert.equal((await publicMode(visitor, shareLinks.event)).mode, "event", "The short id opens the same Mode");
  assert.equal((await anon.request.get(`${appUrl}/og/s/${legacyToken}`)).status(), 200, "Legacy preview image still renders");
  assert.equal(await landedMode(`/s/${legacyToken}`), "event");
  console.log("PASS legacy long links keep resolving next to short ids");

  // 9. Regenerate: only the owner, only against the link they see; every older link closes.
  const oldEventId = shareLinks.event.slice(3);
  const anonRotate = await anon.request.post(`${appUrl}/api/share/mode-link`, { data: { mode: "event", current: oldEventId }, headers: { origin: appUrl } });
  assert.equal(anonRotate.status(), 401, "Signed-out visitors cannot regenerate");
  const { data: directRotate } = await userClient().rpc("rotate_mode_share_locator", { p_mode: "event", p_expected_short_id: oldEventId });
  assert.equal(directRotate ?? null, null, "Anonymous RPC rotation does nothing");
  for (const body of [{ mode: "personal", current: oldEventId }, { mode: "event", current: "short" }, { mode: "event", current: oldEventId, extra: 1 }]) {
    const status = await owner.page.evaluate(async (payload) => (await fetch("/api/share/mode-link", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })).status, body);
    assert.equal(status, 400, `Invalid rotation ${JSON.stringify(body)} is rejected`);
  }

  await owner.page.goto(`${appUrl}/app/identity?mode=event&section=share`);
  await owner.page.locator("[data-share-intent]").first().waitFor();
  await owner.page.getByRole("button", { name: "New link", exact: true }).click();
  await owner.page.getByText("Older links and printed QR codes for this Mode stop working.").waitFor();
  await owner.page.getByRole("button", { name: "Make new link" }).click();
  await owner.page.getByText("New link ready. Older links to this Mode no longer open.").waitFor();
  const rotatedUrl = new URL(await owner.page.locator("[data-share-intent]").first().getAttribute("data-qr-value"));
  assert.match(rotatedUrl.pathname, /^\/s\/[0-9A-Za-z]{8}$/);
  assert.notEqual(rotatedUrl.pathname, shareLinks.event, "Regenerate gives a new short id");
  assert.equal((await anon.request.get(`${appUrl}${shareLinks.event}`)).status(), 404, "The old short id stops working");
  assert.equal((await anon.request.get(`${appUrl}/s/${legacyToken}`)).status(), 404, "The old long link stops working");
  assert.equal((await anon.request.get(`${appUrl}/og${shareLinks.event}`)).status(), 404, "The old preview image is gone");
  const rotated = await publicMode(visitor, rotatedUrl.pathname);
  assert.equal(rotated.mode, "event", "The new link opens Event");
  assert(rotated.html.includes(SECRET_EVENT));
  await owner.page.reload();
  await owner.page.locator("[data-share-intent]").first().waitFor();
  assert.equal(new URL(await owner.page.locator("[data-share-intent]").first().getAttribute("data-qr-value")).pathname, rotatedUrl.pathname, "The new link is the stable one after reload");
  const stale = await owner.page.evaluate(async (current) => (await fetch("/api/share/mode-link", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "event", current }) })).status, oldEventId);
  assert.equal(stale, 409, "A stale tab cannot replace the newer link");
  assert.equal((await publicMode(visitor, rotatedUrl.pathname)).mode, "event", "The stale attempt left the new link working");
  assert.equal((await publicMode(visitor, shareLinks.business)).mode, "business", "Regenerating Event leaves Business alone");
  await owner.page.goto(`${appUrl}/app/identity?mode=personal&section=share`);
  await owner.page.locator("[data-share-intent]").first().waitFor();
  assert.equal(await owner.page.getByRole("button", { name: "New link", exact: true }).count(), 0, "Personal has no New link action");
  const quickAfter = await anon.request.get(quick.payload.url, { maxRedirects: 0 });
  assert.equal(new URL(quickAfter.headers().location, appUrl).pathname, rotatedUrl.pathname, "Quick QR follows the new Event link");
  console.log("PASS regenerate retires every older link and keeps the new one stable");

  await anon.close();
  await owner.context.close();
} finally {
  await browser.close();
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id).catch(() => undefined);
}
