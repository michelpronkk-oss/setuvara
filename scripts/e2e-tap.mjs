/**
 * Local-only Tap infrastructure E2E.
 *
 * The runner provides local Supabase, Mailpit, and the Setuvara app. Accounts
 * are created through the browser signup and token_hash confirmation flow;
 * the local service key is used only for observations and cleanup.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const root = resolve(process.cwd());
const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
assert.equal(gitRoot.replaceAll("\\", "/").toLowerCase(), root.replaceAll("\\", "/").toLowerCase(), "Tap E2E must run from the Setuvara Git root");
const config = execFileSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8" }).trim();
assert.match(config, /^https:\/\/github\.com\/michelpronkk-oss\/setuvara\.git$/i, "Tap E2E requires the Setuvara repository remote");
assert.match(await import("node:fs/promises").then(({ readFile }) => readFile(resolve(root, "supabase/config.toml"), "utf8")), /^project_id = "setuvara"$/m);

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
assert.equal(new URL(appUrl).origin, "http://127.0.0.1:3014", "Tap E2E must use the Setuvara loopback app");
assert.equal(new URL(mailpitUrl).origin, "http://127.0.0.1:54324", "Tap E2E must use local Mailpit");
assert(supabaseUrl, "Local Setuvara Supabase URL is required");
assert.equal(new URL(supabaseUrl).origin, "http://127.0.0.1:54321", "Tap E2E must use local Supabase only");
assert(publishableKey, "Local Setuvara publishable key is required");
assert(serviceKey, "Local service key is required only for observations and cleanup");

const suffix = `${Date.now().toString(36).slice(-6)}${randomBytes(3).toString("hex")}`;
const makeAccount = (role) => ({
  email: `e2e-tap-${role}-${suffix}@example.test`,
  password: `${randomBytes(32).toString("base64url")}Aa1!`,
  username: `tap_${role}_${suffix}`,
  displayName: role === "owner" ? "Tap Owner E2E" : "Tap Other E2E",
});
const ownerAccount = makeAccount("owner");
const otherAccount = makeAccount("other");
const guestEmail = `e2e-tap-guest-${suffix}@example.test`;
const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const createdUserIds = [];
let claimFixtureId = null;

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

function hashHex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function localSql(sql) {
  const cli = resolve(root, "node_modules/supabase/dist/supabase.js");
  const output = execFileSync(process.execPath, [cli, "db", "query", "--local", "--output-format", "json", sql], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
  const jsonStart = output.indexOf("{");
  // Supabase CLI prints a command tag (for example, DELETE 0) for successful
  // mutations that do not use RETURNING. Treat that as an empty result set.
  if (jsonStart < 0) return [];
  return JSON.parse(output.slice(jsonStart)).rows;
}

async function createDevice(page, label) {
  const { status, payload: data } = await callOwnerApi(page, "POST", "/api/tap/devices", { label, kind: "card" });
  assert.equal(status, 201, `Authenticated owner can self-provision a Tap device through the app API (${data?.error ?? "unexpected response"})`);
  assert.match(data.device?.id ?? "", /^[0-9a-f-]{36}$/i);
  const tapUrl = new URL(data.tapUrl);
  assert.equal(tapUrl.origin, appUrl);
  assert(/^\/t\/[A-Za-z0-9_-]{43}$/.test(tapUrl.pathname), "Tap URL must contain a 256-bit token path");
  assert.equal(Object.hasOwn(data.device, "token"), false, "Device JSON must not separately expose the raw token");
  return { id: data.device.id, url: data.tapUrl, token: tapUrl.pathname.split("/").at(-1) };
}

async function callOwnerApi(page, method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      ...(body === undefined ? {} : {
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
    return {
      status: response.status,
      payload: await response.json().catch(() => null),
    };
  }, {
    method,
    path,
    body,
  });
}

async function directTapResponse(context, tapUrl) {
  const page = await context.newPage();
  try {
    const response = await page.request.get(tapUrl, { maxRedirects: 0 });
    const location = response.headers().location ?? "";
    assert.equal(response.status(), 303, "A Tap token resolves through a private, uncached internal redirect");
    assert(!location.includes(new URL(tapUrl).pathname.split("/").at(-1)), "Raw Tap token must not appear in its redirect destination");
    assert.equal(response.headers()["cache-control"], "private, no-store");
    assert.equal(response.headers()["referrer-policy"], "no-referrer");
    return { location, headers: response.headers() };
  } finally {
    await page.close();
  }
}

async function openTap(browser, tapUrl, expectedUsername, expectedMode, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const initial = await directTapResponse(context, tapUrl);
  const location = new URL(initial.location, appUrl);
  assert.equal(location.origin, appUrl);
  assert.equal(location.pathname, `/${expectedUsername}`, "Tap redirects only to the canonical public identity URL");
  assert.equal(location.searchParams.get("mode"), expectedMode, "The currently equipped Mode drives this stable Tap URL");
  assert.equal(location.searchParams.get("source"), "tap", "Tap attribution remains a source context value");
  assert(!location.href.includes(new URL(tapUrl).pathname.split("/").at(-1)), "Redirect URL never repeats the bearer token");
  const response = await page.goto(tapUrl);
  assert.equal(response?.status(), 200, "An active Tap opens a published public profile");
  await page.locator("article[data-profile-mode]").waitFor();
  assert.equal(await page.locator("article[data-profile-mode]").getAttribute("data-profile-mode"), expectedMode);
  const html = await response.text();
  assert(!html.includes(new URL(tapUrl).pathname.split("/").at(-1)), "Raw Tap token must not render in profile HTML");
  await expectNoHorizontalOverflow(page, `Public profile ${expectedMode} at ${viewport.width}px`);
  return { context, page, location };
}

async function expectUnavailable(context, tapUrl, reason) {
  const page = await context.newPage();
  try {
    const response = await page.request.get(tapUrl, { maxRedirects: 0 });
    assert.equal(response.status(), 303, `${reason} redirects to neutral unavailable state`);
    assert.equal(new URL(response.headers().location, appUrl).pathname, "/t/unavailable");
    const final = await page.goto(tapUrl);
    assert.equal(final?.status(), 200, `${reason} renders the neutral Tap unavailable page`);
    assert.match(await page.locator("body").innerText(), /unavailable|not available|couldn.t open/i);
  } finally {
    await page.close();
  }
}

async function setEquipped(account, mode, intent) {
  const { data, error } = await account.client.rpc("set_equipped_share_state", { p_mode: mode, p_intent: intent });
  assert.ifError(error);
  assert.equal(data?.mode, mode);
  assert.equal(data?.intent, intent);
}

async function getEquipped(account) {
  const { data, error } = await account.client.rpc("get_equipped_share_state");
  assert.ifError(error);
  return data;
}

async function setMode(account, mode, values) {
  const { data, error } = await account.client.from("profile_modes").update(values)
    .eq("profile_id", account.id).eq("slug", mode).select("id,slug,is_enabled,connect_policy").single();
  assert.ifError(error);
  assert(data?.id, `${mode} Mode update should be scoped to its authenticated owner`);
  return data;
}

async function setupProfile(account) {
  const { error: profileError } = await account.client.from("profiles").update({ is_published: true }).eq("id", account.id);
  assert.ifError(profileError);
  for (const mode of ["personal", "event", "business"]) {
    await setMode(account, mode, { is_enabled: true, connect_policy: "anyone" });
  }
}

async function grantCount(ownerId, tapDeviceId) {
  const { count, error } = await admin.from("connection_share_grants").select("id", { count: "exact", head: true })
    .eq("profile_id", ownerId).eq("tap_device_id", tapDeviceId).is("revoked_at", null);
  assert.ifError(error);
  return count ?? 0;
}

async function expectNoHorizontalOverflow(page, label) {
  const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(size.scroll <= size.client + 1, `${label} has horizontal overflow (${size.scroll} > ${size.client})`);
}

async function assertConnection(policy, expectedSource = "tap") {
  const { data, error } = await admin.from("connection_encounters")
    .select("source,authorization_method,shared_mode_slug,created_by_guest_id")
    .eq("shared_by_user_id", policy.ownerId)
    .eq("shared_mode_slug", policy.mode)
    .eq("source", expectedSource)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assert.ifError(error);
  assert(data, "Guest Connect through Tap should create a local encounter");
  assert.equal(data.source, "tap", "The initiating context is preserved exactly as tap");
  assert.equal(data.authorization_method, "connection_pass", "Authorization is separately recorded as a Connection Pass");
  assert.equal(data.shared_mode_slug, policy.mode);
  assert(data.created_by_guest_id);
}

async function makeGuestConnect(page, username) {
  const button = page.getByRole("button", { name: /^Connect(?: at .+)?$/ });
  await button.waitFor();
  await button.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Tap Guest E2E");
  await dialog.getByLabel("Email").fill(guestEmail);
  await dialog.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByText("You’re connected.").waitFor({ timeout: 10_000 });
  assert.equal(new URL(page.url()).pathname, `/${username}`);
}

async function testAccountIsolation(browser, owner, other, ownerDevice) {
  const crossOrigin = await owner.page.request.post(`${appUrl}/api/tap/devices`, {
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    data: { label: "Forged from another origin", kind: "card" },
  });
  assert.equal(crossOrigin.status(), 400, "Owner mutations require the canonical Setuvara browser Origin");
  assert.equal((await crossOrigin.json()).error, "invalid_request");

  const { data: privateMode, error: modeError } = await owner.client.from("profile_modes")
    .select("id").eq("profile_id", owner.id).eq("slug", "personal").single();
  assert.ifError(modeError);
  const { data: link, error: linkError } = await owner.client.from("profile_links").insert({
    profile_id: owner.id, mode_id: privateMode.id, title: "Tap private E2E link", url: "https://example.test/private", sort_order: 90, is_visible: false,
  }).select("id").single();
  assert.ifError(linkError);

  const { data: hidden, error: hiddenError } = await other.client.from("profile_links").select("id").eq("id", link.id);
  assert.ifError(hiddenError);
  assert.equal(hidden.length, 0, "Another authenticated account cannot read an owner's hidden link");

  const mutations = await Promise.all([
    other.client.from("profiles").update({ username: `changed_${suffix}` }).eq("id", owner.id).select("id"),
    other.client.from("profiles").update({ is_published: false }).eq("id", owner.id).select("id"),
    other.client.from("profile_modes").update({ connect_policy: "nobody" }).eq("profile_id", owner.id).eq("id", privateMode.id).select("id"),
    other.client.from("profile_links").update({ title: "Compromised" }).eq("id", link.id).select("id"),
    other.client.from("profile_links").delete().eq("id", link.id).select("id"),
  ]);
  for (const result of mutations) {
    assert.ifError(result.error);
    assert.equal(result.data.length, 0, "Cross-account RLS denies mutation without leaking the row");
  }
  const foreignInsert = await other.client.from("profile_links").insert({
    profile_id: owner.id, mode_id: privateMode.id, title: "Cross-account insert", url: "https://example.test/forbidden", sort_order: 91, is_visible: false,
  }).select("id");
  assert(foreignInsert.error || foreignInsert.data?.length === 0, "Another account cannot add a link to the owner's Mode");

  await setMode(owner, "event", { is_enabled: false });
  const hiddenModeRead = await other.client.from("profile_modes").select("id").eq("profile_id", owner.id).eq("slug", "event");
  assert.ifError(hiddenModeRead.error);
  assert.equal(hiddenModeRead.data.length, 0, "Another account cannot read a disabled private Mode");
  await setMode(owner, "event", { is_enabled: true });

  const before = await getEquipped(owner);
  await setEquipped(other, "event", "view_profile");
  assert.deepEqual(await getEquipped(owner), before, "Second account's equipped-state changes remain isolated to that account");

  assert.equal((await callOwnerApi(other.page, "GET", "/api/tap/devices")).status, 200);
  const otherList = await callOwnerApi(other.page, "GET", "/api/tap/devices");
  assert.deepEqual(otherList.payload.devices, [], "Another account's Tap device list is owner-scoped");
  assert.equal((await callOwnerApi(other.page, "PATCH", `/api/tap/devices/${ownerDevice.id}`, { label: "Intruder", kind: "other" })).status, 404);
  assert.equal((await callOwnerApi(other.page, "PATCH", `/api/tap/devices/${ownerDevice.id}/status`, { status: "disabled" })).status, 404);
  assert.equal((await callOwnerApi(other.page, "POST", `/api/tap/devices/${ownerDevice.id}/rotate`, {})).status, 404);
  const afterCrossDeviceCalls = await admin.from("tap_devices").select("label,status").eq("id", ownerDevice.id).single();
  assert.ifError(afterCrossDeviceCalls.error);
  assert.equal(afterCrossDeviceCalls.data.label, "Tap owner primary");
  assert.equal(afterCrossDeviceCalls.data.status, "active");

  const anon = userClient();
  const { data: anonRows, error: anonTableError } = await anon.from("tap_devices").select("id");
  assert(anonTableError && !anonRows?.length, "Anonymous callers cannot directly enumerate Tap devices");
  const { error: otherTableError } = await other.client.from("tap_devices").select("id");
  assert(otherTableError, "Authenticated users cannot bypass owner APIs through direct Tap table access");
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  try {
    await anonPage.goto(`${appUrl}/login`);
    assert.equal((await callOwnerApi(anonPage, "GET", "/api/tap/devices")).status, 401, "Anonymous callers cannot list devices");
    assert.equal((await callOwnerApi(anonPage, "POST", "/api/tap/devices", { label: "Anonymous", kind: "card" })).status, 401, "Anonymous callers cannot self-provision devices");
    assert.equal((await callOwnerApi(anonPage, "POST", "/api/tap/claim", { claimSecret: randomBytes(32).toString("base64url") })).status, 401, "Anonymous callers cannot claim a device");
  } finally {
    await anonContext.close();
  }
  await anon.auth.signOut({ scope: "local" });
  console.log("PASS second-account RLS/API isolation and anonymous Tap management denial");
}

async function testClaimRace(browser, owner, other) {
  const rawToken = randomBytes(32).toString("base64url");
  const claimSecret = randomBytes(32).toString("base64url");
  const tokenHash = hashHex(rawToken);
  const claimHash = hashHex(claimSecret);
  const { id } = JSON.parse(localSql(`
    insert into public.tap_devices (
      owner_profile_id, token_hash, claim_secret_hash, label, kind, status, claim_expires_at, claimed_at
    ) values (
      null, decode('${tokenHash}', 'hex'), decode('${claimHash}', 'hex'),
      'Synthetic local claim fixture', 'card', 'unclaimed', now() + interval '7 days', null
    ) returning json_build_object('id', id)::text as result
  `)[0].result);
  claimFixtureId = id;

  const attempts = await Promise.all([
    callOwnerApi(owner.page, "POST", "/api/tap/claim", { claimSecret }),
    callOwnerApi(other.page, "POST", "/api/tap/claim", { claimSecret }),
  ]);
  assert.equal(attempts.filter((result) => result.status === 200 && result.payload?.claimed === true).length, 1, "Exactly one concurrent authenticated claim may win");
  assert.equal(attempts.filter((result) => result.status === 404).length, 1, "The losing claim receives a neutral unavailable result");
  const { data: fixture, error } = await admin.from("tap_devices").select("owner_profile_id,status,claim_secret_hash,claim_expires_at")
    .eq("id", claimFixtureId).single();
  assert.ifError(error);
  assert([owner.id, other.id].includes(fixture.owner_profile_id));
  assert.equal(fixture.status, "active");
  assert.equal(fixture.claim_secret_hash, null, "Claim consumes and clears the one-time claim hash");
  assert.equal(fixture.claim_expires_at, null);

  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  try {
    await anonPage.goto(`${appUrl}/login`);
    const anonymous = await callOwnerApi(anonPage, "POST", "/api/tap/claim", { claimSecret: randomBytes(32).toString("base64url") });
    assert.equal(anonymous.status, 401, "Anonymous claim attempts are rejected");
  } finally {
    await anonPage.close();
    await anonContext.close();
  }
  console.log("PASS local-only synthetic claim fixture: one-time secret and exactly-one winner under concurrent claim");
}

const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM ?? undefined });
let owner;
let other;
try {
  owner = await signUpAndConfirm(browser, ownerAccount);
  other = await signUpAndConfirm(browser, otherAccount);
  await setupProfile(owner);
  await setupProfile(other);

  // A stable Tap URL follows the identity-wide equipped state across Modes/intents.
  await setEquipped(owner, "personal", "view_profile");
  const device = await createDevice(owner.page, "Tap owner primary");
  const list = await callOwnerApi(owner.page, "GET", "/api/tap/devices");
  assert.equal(list.status, 200);
  assert(list.payload.devices.some((item) => item.id === device.id), "Owner can list their self-provisioned device");

  const personal = await openTap(browser, device.url, ownerAccount.username, "personal");
  await personal.context.close();
  await setEquipped(owner, "event", "view_profile");
  const event = await openTap(browser, device.url, ownerAccount.username, "event");
  await event.context.close();
  assert.equal((await grantCount(owner.id, device.id)), 0, "View-only and Anyone profile taps do not mint unnecessary Connection Passes");
  console.log("PASS stable Tap URL resolves current Personal then Event profile and preserves source metadata");

  await setEquipped(owner, "personal", "connect_in_person");
  await setMode(owner, "personal", { connect_policy: "anyone" });
  const anyoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const anyonePass = await directTapResponse(anyoneContext, device.url);
  assert.equal(new URL(anyonePass.location, appUrl).searchParams.get("mode"), "personal");
  assert.equal((await anyoneContext.cookies(appUrl)).some((cookie) => cookie.name.startsWith("sv-pass-")), false, "Anyone policy does not issue a redundant Connection Pass");
  assert.equal(await grantCount(owner.id, device.id), 0);
  const anyonePage = await anyoneContext.newPage();
  await anyonePage.goto(device.url);
  assert.equal(await anyonePage.getByRole("button", { name: /^Connect(?: at .+)?$/ }).count(), 1, "Anyone allows the public profile Connect action without a Tap pass");
  await anyoneContext.close();
  console.log("PASS Connect intent under Anyone: profile Connect is available and no pass is minted");

  await setMode(owner, "personal", { connect_policy: "direct_only" });
  await setEquipped(owner, "personal", "view_profile");
  const viewOnly = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const viewTap = await directTapResponse(viewOnly, device.url);
  assert.equal(new URL(viewTap.location, appUrl).pathname, `/${ownerAccount.username}`);
  assert.equal((await viewOnly.cookies(appUrl)).some((cookie) => cookie.name.startsWith("sv-pass-")), false);
  const viewPage = await viewOnly.newPage();
  await viewPage.goto(device.url);
  assert.equal(await viewPage.getByRole("button", { name: /^Connect(?: at .+)?$/ }).count(), 0, "View intent stays view-only for Direct share only");
  await viewOnly.close();
  assert.equal(await grantCount(owner.id, device.id), 0);

  await setEquipped(owner, "personal", "connect_in_person");
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guestPage = await guest.newPage();
  const firstTap = await directTapResponse(guest, device.url);
  const passName = `sv-pass-${ownerAccount.username}-personal`;
  const firstCookie = (await guest.cookies(appUrl)).find((cookie) => cookie.name === passName);
  assert(firstCookie?.httpOnly && firstCookie.sameSite === "Lax", "Direct-only in-person Tap stores the existing pass in an HttpOnly SameSite=Lax cookie");
  const firstPassValue = firstCookie.value;
  assert.equal(new URL(firstTap.location, appUrl).searchParams.get("source"), "tap");
  const secondTap = await directTapResponse(guest, device.url);
  assert.equal(new URL(secondTap.location, appUrl).searchParams.get("source"), "tap");
  const secondCookie = (await guest.cookies(appUrl)).find((cookie) => cookie.name === passName);
  assert.equal(secondCookie?.value, firstPassValue, "Repeat taps reuse the live device-scoped Connection Pass");
  assert.equal(await grantCount(owner.id, device.id), 1, "Repeat taps do not mint redundant pass rows");
  await guestPage.goto(device.url);
  assert.equal(await guestPage.evaluate(() => document.cookie.includes("sv-pass-")), false, "Tap pass token is unreadable to page JavaScript");
  await makeGuestConnect(guestPage, ownerAccount.username);
  await assertConnection({ ownerId: owner.id, mode: "personal" });
  await guest.close();
  console.log("PASS Direct-only in-person Tap: HttpOnly pass, repeat-tap reuse, guest Connect, source=tap, authorization_method=connection_pass");

  // Second account cannot operate or inspect the private Tap tables or owner resources.
  await testAccountIsolation(browser, owner, other, device);

  // Lifecycle safety: profile and mode availability are checked on every resolution.
  const observer = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await setEquipped(owner, "event", "view_profile");
  await setMode(owner, "event", { is_enabled: false });
  await expectUnavailable(observer, device.url, "disabled equipped Mode");
  await setMode(owner, "event", { is_enabled: true });
  await setEquipped(owner, "personal", "view_profile");
  const { error: unpublishError } = await owner.client.from("profiles").update({ is_published: false }).eq("id", owner.id);
  assert.ifError(unpublishError);
  await expectUnavailable(observer, device.url, "unpublished profile");
  const { error: republishError } = await owner.client.from("profiles").update({ is_published: true }).eq("id", owner.id);
  assert.ifError(republishError);

  // Each resolver/admin race must linearize to a valid state before or after
  // the owner update, and every subsequent resolution must observe the update.
  await setEquipped(owner, "personal", "view_profile");
  const [, tapDuringEquip] = await Promise.all([
    setEquipped(owner, "event", "view_profile"),
    directTapResponse(observer, device.url),
  ]);
  const modeDuringEquip = new URL(tapDuringEquip.location, appUrl).searchParams.get("mode");
  assert(["personal", "event"].includes(modeDuringEquip), "Concurrent Equipped update and Tap resolve to one complete current Mode");
  await directTapResponse(observer, device.url).then(({ location }) => {
    assert.equal(new URL(location, appUrl).searchParams.get("mode"), "event", "A post-update Tap sees the new Equipped Mode");
  });
  await setEquipped(owner, "personal", "view_profile");
  console.log("PASS concurrent Equipped update/Tap resolution linearizes to the new identity-wide Mode");

  // Disable/re-enable, token rotation, lost and retired states all fail closed.
  const [disableResult, tapDuringDisable] = await Promise.all([
    callOwnerApi(owner.page, "PATCH", `/api/tap/devices/${device.id}/status`, { status: "disabled" }),
    directTapResponse(observer, device.url),
  ]);
  assert.equal(disableResult.status, 200);
  const disableRacePath = new URL(tapDuringDisable.location, appUrl).pathname;
  assert([`/${ownerAccount.username}`, "/t/unavailable"].includes(disableRacePath), "Concurrent disable/Tap resolves before or after the status transition");
  await expectUnavailable(observer, device.url, "disabled device");
  assert.equal((await callOwnerApi(owner.page, "PATCH", `/api/tap/devices/${device.id}/status`, { status: "active" })).status, 200, "Disabled device may be safely re-enabled");
  await openTap(browser, device.url, ownerAccount.username, "personal").then(({ context }) => context.close());

  const oldUrl = device.url;
  const [rotated, tapDuringRotate] = await Promise.all([
    callOwnerApi(owner.page, "POST", `/api/tap/devices/${device.id}/rotate`, {}),
    directTapResponse(observer, oldUrl),
  ]);
  assert.equal(rotated.status, 200, "Owner may rotate an active Tap credential");
  const rotateRacePath = new URL(tapDuringRotate.location, appUrl).pathname;
  assert([`/${ownerAccount.username}`, "/t/unavailable"].includes(rotateRacePath), "Concurrent rotation/Tap resolves before or after token replacement");
  const newTapUrl = rotated.payload.tapUrl;
  assert(/^http:\/\/127\.0\.0\.1:3014\/t\/[A-Za-z0-9_-]{43}$/.test(newTapUrl), "Rotation returns a new local Tap URL");
  await expectUnavailable(observer, oldUrl, "rotated old token");
  await openTap(browser, newTapUrl, ownerAccount.username, "personal").then(({ context }) => context.close());

  assert.equal((await callOwnerApi(owner.page, "PATCH", `/api/tap/devices/${device.id}/status`, { status: "lost" })).status, 200);
  await expectUnavailable(observer, newTapUrl, "lost device");
  assert.equal((await callOwnerApi(owner.page, "PATCH", `/api/tap/devices/${device.id}/status`, { status: "active" })).status, 404, "Lost device cannot be reactivated without rotation");

  const recovered = await callOwnerApi(owner.page, "POST", `/api/tap/devices/${device.id}/rotate`, {});
  assert.equal(recovered.status, 200, "Owner can rotate a lost device to recover it");
  const recoveredUrl = recovered.payload.tapUrl;
  await expectUnavailable(observer, newTapUrl, "pre-recovery token");
  await openTap(browser, recoveredUrl, ownerAccount.username, "personal").then(({ context }) => context.close());
  assert.equal((await callOwnerApi(owner.page, "PATCH", `/api/tap/devices/${device.id}/status`, { status: "retired" })).status, 200);
  await expectUnavailable(observer, recoveredUrl, "retired device");
  assert.equal((await callOwnerApi(owner.page, "POST", `/api/tap/devices/${device.id}/rotate`, {})).status, 404, "Retired device cannot be brought back by token rotation");
  await observer.close();
  console.log("PASS publish/Mode/device lifecycle: fail-closed resolution, disable recovery, loss recovery, retirement, and rotation");

  await testClaimRace(browser, owner, other);

  // Responsive public profile + authenticated editor at the requested sizes.
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await owner.page.setViewportSize(viewport);
    await owner.page.goto(`${appUrl}/app/identity`);
    await owner.page.getByRole("heading", { name: "Personal Mode", exact: true }).waitFor();
    await expectNoHorizontalOverflow(owner.page, `Authenticated Identity editor ${viewport.width}x${viewport.height}`);
    const profile = await browser.newContext({ viewport });
    const profilePage = await profile.newPage();
    const response = await profilePage.goto(`${appUrl}/${ownerAccount.username}`);
    assert.equal(response?.status(), 200);
    await profilePage.locator("article[data-profile-mode='personal']").waitFor();
    await expectNoHorizontalOverflow(profilePage, `Public profile ${viewport.width}x${viewport.height}`);
    await profile.close();
  }
  console.log("PASS Identity editor and public profile at 390x844, 768x1024, and 1440x900 without horizontal overflow");

  // Assert key public API paths are still local and do not expose credential strings.
  const signupPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const route of ["/login", "/signup", "/app/identity", "/api/health/supabase"]) {
    const response = await signupPage.goto(`${appUrl}${route}`);
    assert(response && response.status() < 500, `${route} should remain reachable in the local app`);
    const content = await signupPage.locator("body").innerText().catch(() => "");
    assert(!content.includes(ownerAccount.password) && !content.includes(otherAccount.password), `${route} must not expose test passwords`);
  }
  await signupPage.close();
  console.log("PASS static/auth/API routes remain reachable locally; no test credential rendered");
} finally {
  await browser.close();
  if (claimFixtureId) {
    // This is the one synthetic unclaimed fixture inserted by this script.
    localSql(`delete from public.tap_devices where id = '${claimFixtureId}'::uuid and label = 'Synthetic local claim fixture'`);
  }
  for (const account of [owner, other]) {
    if (account?.client) await account.client.auth.signOut({ scope: "local" }).catch(() => {});
  }
  // Look up only the freshly generated local E2E addresses to also clean up a
  // signup that succeeded before a later browser confirmation assertion failed.
  const exactEmails = [ownerAccount.email, otherAccount.email].map((email) => `'${email}'`).join(", ");
  const localUsers = localSql(`select id::text from auth.users where email in (${exactEmails})`);
  const userIds = new Set([...createdUserIds, ...localUsers.map((row) => row.id)]);
  for (const id of userIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.warn("Local Tap E2E cleanup could not delete one generated account; inspect only local Setuvara test data.");
  }
  // Guest identities have no auth user. Remove only the unique local fixture address.
  const quotedGuest = guestEmail.replaceAll("'", "''");
  localSql(`delete from public.guest_identities where normalized_email = '${quotedGuest}' and claimed_user_id is null`);
}

console.log("Local Tap E2E completed successfully.");
