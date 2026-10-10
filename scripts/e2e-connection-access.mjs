/**
 * Mode-level Connection Access end-to-end check against a LOCAL Setuvara stack.
 *
 * Covers the three policies per Mode, the Connection Pass entry route, the
 * Share profile / Connect in person intents, guest and registered Connect,
 * Mode isolation, outbound independence and existing Connections.
 *
 *   E2E_APP_URL=http://127.0.0.1:3014 \
 *   E2E_SUPABASE_URL=http://127.0.0.1:54321 \
 *   E2E_LOCAL_SERVICE_KEY=<local service role key> \
 *   E2E_SCREENSHOTS=./.e2e-connection-access \
 *   node scripts/e2e-connection-access.mjs
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const shots = process.env.E2E_SCREENSHOTS;
assert(new URL(appUrl).hostname === "127.0.0.1" && new URL(supabaseUrl).hostname === "127.0.0.1", "Connection Access E2E runs against local Setuvara only");
assert(serviceKey, "E2E_LOCAL_SERVICE_KEY (local stack) is required to seed and inspect test data");
if (shots) mkdirSync(shots, { recursive: true });

const stamp = Date.now().toString(36).slice(-6);
const seededUsers = [];
const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const connectButton = (page) => page.getByRole("button", { name: /^(Connect(?: at .+)?|Connect again)$/ });
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); };

async function seedUser(name) {
  const username = `ca_${name}_${stamp}`;
  const password = `Access-${stamp}-${name}-1`;
  const { data, error } = await admin.auth.admin.createUser({ email: `${username}@example.test`, password, email_confirm: true, user_metadata: { username, display_name: name[0].toUpperCase() + name.slice(1) } });
  assert.ifError(error);
  const id = data.user.id;
  seededUsers.push(id);
  assert.ifError((await admin.from("profiles").update({ is_published: true }).eq("id", id)).error);
  assert.ifError((await admin.from("profile_modes").update({ is_enabled: true }).eq("profile_id", id)).error);
  const { data: personal } = await admin.from("profile_modes").select("id").eq("profile_id", id).eq("slug", "personal").single();
  assert.ifError((await admin.from("profile_links").insert({ profile_id: id, mode_id: personal.id, title: `${name} journal`, url: "https://example.com/journal", sort_order: 0, is_visible: true })).error);
  return { id, username, email: `${username}@example.test`, password, name };
}

async function signIn(browser, account, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  await page.goto(`${appUrl}/login`);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/app/);
  return { context, page };
}

async function connectCount(page, url) {
  const response = await page.goto(`${appUrl}${url}`);
  assert.equal(response?.status(), 200, `${url} should open`);
  await page.locator("article").first().waitFor();
  return connectButton(page).count();
}

async function noHorizontalOverflow(page, label) {
  const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(size.scroll <= size.client + 1, `${label} overflows horizontally (${size.scroll} > ${size.client})`);
}

async function activeGrants(profileId) {
  const { data, error } = await admin.from("connection_share_grants").select("id,mode_id,expires_at,revoked_at").eq("profile_id", profileId).is("revoked_at", null);
  assert.ifError(error);
  return data;
}

async function encountersFor(targetId) {
  const { data, error } = await admin.from("connection_encounters").select("source,shared_mode_slug,created_by_user_id,created_by_guest_id").eq("shared_by_user_id", targetId).order("created_at");
  assert.ifError(error);
  return data;
}

async function choosePolicy(page, mode, label) {
  await page.goto(`${appUrl}/app/identity?mode=${mode}&section=settings`);
  const group = page.getByRole("radiogroup", { name: "Connections" }).filter({ visible: true }).first();
  await group.waitFor();
  await group.getByRole("radio", { name: new RegExp(`^${label}`) }).click();
  await group.getByRole("radio", { name: new RegExp(`^${label}`), checked: true }).waitFor();
}

async function waitForPolicy(profileId, mode, policy) {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    const { data } = await admin.from("profile_modes").select("connect_policy").eq("profile_id", profileId).eq("slug", mode).single();
    if (data?.connect_policy === policy) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.fail(`${mode} should save connect_policy=${policy}`);
}

const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM ?? undefined });
try {
  const michel = await seedUser("michel");
  const rayz = await seedUser("rayz");
  const visitor = await seedUser("visitor");

  // ---- Migration default: every Mode starts at Anyone, so current behavior is unchanged.
  {
    const { data } = await admin.from("profile_modes").select("connect_policy").in("profile_id", [michel.id, rayz.id, visitor.id]);
    assert.equal(data.length, 9);
    assert(data.every((row) => row.connect_policy === "anyone"), "New and existing Modes default to anyone");
    const anon = await browser.newPage({ viewport: { width: 390, height: 844 } });
    assert.equal(await connectCount(anon, `/${michel.username}`), 1, "Anyone: canonical Personal shows Connect");
    await anon.close();
    console.log("PASS default policy is Anyone and Connect stays public");
  }

  // ---- Owner sets policies from Mode Settings (mobile editor).
  const owner = await signIn(browser, michel);
  {
    await choosePolicy(owner.page, "personal", "Direct share only");
    await waitForPolicy(michel.id, "personal", "direct_only");
    await owner.page.getByText("Your public profile stays view-only. Connect appears when you share directly.").first().waitFor();
    await noHorizontalOverflow(owner.page, "Mode Settings at 390px");
    await shot(owner.page, "01-settings-direct-only-390");
    await choosePolicy(owner.page, "business", "Nobody");
    await waitForPolicy(michel.id, "business", "nobody");
    const { data } = await admin.from("profile_modes").select("slug,connect_policy").eq("profile_id", michel.id).order("sort_order");
    assert.deepEqual(data.map((row) => `${row.slug}:${row.connect_policy}`), ["personal:direct_only", "event:anyone", "business:nobody"], "Policies are saved independently per Mode");
    await owner.page.setViewportSize({ width: 360, height: 780 });
    await owner.page.goto(`${appUrl}/app/identity?mode=personal&section=settings`);
    await owner.page.getByRole("radiogroup", { name: "Connections" }).filter({ visible: true }).first().waitFor();
    await noHorizontalOverflow(owner.page, "Mode Settings at 360px");
    await shot(owner.page, "02-settings-360");
    await owner.page.setViewportSize({ width: 390, height: 844 });
    console.log("PASS Mode Settings saves Anyone / Direct share only / Nobody per Mode");
  }

  // ---- Bio use case: canonical URL is view-only; Mode switch has no leakage.
  {
    const anon = await browser.newPage({ viewport: { width: 390, height: 844 } });
    assert.equal(await connectCount(anon, `/${michel.username}`), 0, "Direct share only: canonical Personal has no Connect");
    await anon.getByRole("link", { name: /michel journal/i }).waitFor();
    await shot(anon, "03-direct-only-public-view-only");
    assert.equal(await connectCount(anon, `/${michel.username}?mode=event`), 1, "Event Anyone shows Connect");
    assert.equal(await connectCount(anon, `/${michel.username}?mode=business`), 0, "Business Nobody shows no Connect");
    for (const tampered of ["?connect=1", "?source=qr", "?connect=true&source=share", "?mode=personal&connect=1"]) {
      assert.equal(await connectCount(anon, `/${michel.username}${tampered}`), 0, `URL tampering (${tampered}) cannot authorize Connect`);
    }
    await anon.context().addCookies([{ name: `sv-pass-${michel.username}-personal`, value: "A".repeat(43), url: appUrl }]);
    assert.equal(await connectCount(anon, `/${michel.username}`), 0, "A forged pass cookie cannot authorize Connect");
    assert.equal(await anon.locator("text=locked").count(), 0);
    await anon.close();
    console.log("PASS canonical Direct share only profile is view-only, URL and cookie tampering fail");
  }

  // ---- Share sheet: Share profile vs Connect in person, pass reuse.
  let passUrl = "";
  {
    const page = owner.page;
    await page.goto(`${appUrl}/app?mode=personal`);
    await page.getByRole("button", { name: "Share Personal Mode" }).click();
    const sheet = page.getByRole("dialog");
    const intents = sheet.getByRole("radiogroup", { name: "What you are sharing" });
    await intents.waitFor();
    const profileQr = await sheet.locator("[data-share-intent]").getAttribute("data-qr-value");
    assert.equal(profileQr, `${appUrl}/${michel.username}?source=qr`, "Share profile QR encodes the canonical view-only URL");
    await sheet.getByText("View only. Your profile opens without Connect.").waitFor();
    await intents.getByRole("radio", { name: "Connect in person" }).click();
    await sheet.locator('[data-share-intent="in_person"]').waitFor();
    passUrl = await sheet.locator('[data-share-intent="in_person"]').getAttribute("data-qr-value");
    assert.match(passUrl, new RegExp(`^${appUrl.replaceAll(".", "\\.")}/connect/[A-Za-z0-9_-]{43}$`), "Connect in person QR encodes the Connection Pass entry route");
    assert(!passUrl.includes("connect=") && !passUrl.includes("source="), "The pass QR has no spoofable query flag");
    await noHorizontalOverflow(page, "Share sheet at 390px");
    await shot(page, "04-share-connect-in-person-390");
    await sheet.getByRole("button", { name: "Copy link" }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), passUrl, "Copy link copies the pass link in Connect in person");
    // Switching Mode in the sheet: Event is Anyone, so no intent choice; Business is Nobody, so no Connect in person.
    await sheet.getByRole("radiogroup", { name: "Mode to share" }).getByRole("radio", { name: "Event" }).click();
    assert.equal(await sheet.getByRole("radiogroup", { name: "What you are sharing" }).count(), 0, "Anyone Modes keep the normal share flow");
    await sheet.getByRole("radiogroup", { name: "Mode to share" }).getByRole("radio", { name: "Business" }).click();
    assert.equal(await sheet.getByRole("radio", { name: "Connect in person" }).count(), 0, "Nobody Modes never offer Connect in person");
    assert.equal(await sheet.locator("[data-share-intent]").getAttribute("data-qr-value"), `${appUrl}/${michel.username}?mode=business&source=qr`);
    await sheet.getByRole("button", { name: "Close" }).click();

    // Reopen at 360px: the same pass comes back instead of a new grant.
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(`${appUrl}/app?mode=personal`);
    await page.getByRole("button", { name: "Share Personal Mode" }).click();
    await page.getByRole("dialog").getByRole("radio", { name: "Connect in person" }).click();
    await page.locator('[data-share-intent="in_person"]').waitFor();
    assert.equal(await page.locator('[data-share-intent="in_person"]').getAttribute("data-qr-value"), passUrl, "Reopening Connect in person reuses the valid pass");
    await noHorizontalOverflow(page, "Share sheet at 360px");
    await shot(page, "05-share-connect-in-person-360");
    await page.setViewportSize({ width: 390, height: 844 });

    // Editor Share section, same Mode: same pass, full-screen QR copy.
    await page.goto(`${appUrl}/app/identity?mode=personal&section=share&intent=in_person`);
    await page.locator('[data-share-intent="in_person"]').waitFor();
    assert.equal(await page.locator('[data-share-intent="in_person"]').getAttribute("data-qr-value"), passUrl, "Editor Share reuses the same pass");
    await noHorizontalOverflow(page, "Editor Share at 390px");
    await shot(page, "06-editor-share-in-person");
    const grants = await activeGrants(michel.id);
    assert.equal(grants.length, 1, "Rerenders and reopenings never mint extra grants");
    const hours = (new Date(grants[0].expires_at).getTime() - Date.now()) / 36e5;
    assert(hours > 23 && hours <= 24, "Connection Passes last 24 hours");
    console.log("PASS Share profile vs Connect in person, QR/copy, Mode-aware intents and pass reuse");
  }

  // ---- Guest scans the pass: clean URL, Connect visible, guest Connect, Mode isolation.
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  {
    const page = await guest.newPage();
    const response = await page.goto(passUrl);
    assert.equal(response?.status(), 200);
    assert.equal(page.url(), `${appUrl}/${michel.username}`, "The pass redirects to the clean canonical profile URL");
    const cookie = (await guest.cookies(appUrl)).find((item) => item.name === `sv-pass-${michel.username}-personal`);
    assert(cookie?.httpOnly && cookie.sameSite === "Lax", "The pass is kept in an HttpOnly SameSite=Lax cookie");
    assert.equal(await page.evaluate(() => document.cookie.includes("sv-pass")), false, "Page JavaScript cannot read the pass");
    assert.equal(await connectButton(page).count(), 1, "Valid Connection Pass: Connect visible");
    await shot(page, "07-guest-pass-connect-visible");
    await connectButton(page).click();
    await page.getByLabel("Name").fill("Guest Lena");
    await page.getByLabel("Email").fill(`guest-lena-${stamp}@example.test`);
    await page.getByRole("dialog").getByRole("button", { name: "Connect", exact: true }).click();
    await page.getByText("You’re connected.").waitFor();
    await page.getByRole("button", { name: "Done" }).click();
    const guestEncounter = (await encountersFor(michel.id)).find((row) => row.created_by_guest_id);
    assert.equal(guestEncounter?.source, "direct_share", "Pass-authorized guest Connect is recorded as direct_share");
    assert.equal(guestEncounter?.shared_mode_slug, "personal");

    assert.equal(await connectCount(page, `/${michel.username}?mode=event`), 1, "With a Personal pass, Event stays Connect because Anyone");
    assert.equal(await connectCount(page, `/${michel.username}?mode=business`), 0, "With a Personal pass, Business stays closed");
    assert.equal(await connectCount(page, `/${rayz.username}`), 1, "Another profile follows its own policy");
    const blocked = await page.request.post(`${appUrl}/api/connections`, { headers: { "content-type": "application/json", "x-setuvara-request": "same-origin", origin: appUrl }, data: { username: michel.username, mode: "business", source: "qr", requestId: crypto.randomUUID() } });
    assert.equal(blocked.status(), 403, "The Connect API refuses a Nobody Mode even with a Personal pass cookie");
    // A Personal pass copied into the Business cookie slot still fails server-side.
    await guest.addCookies([{ name: `sv-pass-${michel.username}-business`, value: passUrl.split("/").at(-1), url: appUrl }]);
    assert.equal(await connectCount(page, `/${michel.username}?mode=business`), 0, "A pass is bound to its own Mode in the database");
    console.log("PASS guest Connect through a pass, clean URL, HttpOnly scope and Mode isolation");
  }

  // ---- Registered visitor through the same pass.
  const registered = await signIn(browser, visitor);
  let existingConnectionId = "";
  {
    const page = registered.page;
    await page.goto(passUrl);
    assert.equal(page.url(), `${appUrl}/${michel.username}`);
    await connectButton(page).click();
    await page.getByRole("dialog").getByRole("button", { name: "Connect", exact: true }).click();
    await page.getByText("You’re connected.").waitFor();
    const href = await page.getByRole("link", { name: "View connection" }).getAttribute("href");
    existingConnectionId = href.split("/").at(-1);
    const registeredEncounter = (await encountersFor(michel.id)).find((row) => row.created_by_user_id === visitor.id);
    assert.equal(registeredEncounter?.source, "direct_share", "Pass-authorized registered Connect is recorded as direct_share");
    console.log("PASS registered Connect through a pass");
  }

  // ---- Expired, revoked and unknown passes fail closed but still land on the profile.
  {
    const { data: grant } = await admin.from("connection_share_grants").select("id").eq("profile_id", michel.id).is("revoked_at", null).single();
    const expiresAt = Date.now() - 60 * 60_000;
    const createdAt = expiresAt - 23 * 60 * 60_000;
    assert.ifError((await admin.from("connection_share_grants").update({ created_at: new Date(createdAt).toISOString(), expires_at: new Date(expiresAt).toISOString() }).eq("id", grant.id)).error);
    const late = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await late.newPage();
    const response = await page.goto(passUrl);
    assert.equal(response?.status(), 200, "An expired pass is not an error page");
    assert.equal(page.url(), `${appUrl}/${michel.username}`, "An expired pass lands on the live profile");
    assert.equal(await connectButton(page).count(), 0, "An expired pass cannot authorize Connect");
    assert.equal((await late.cookies(appUrl)).some((item) => item.name.startsWith("sv-pass-")), false, "An expired pass sets no cookie");
    await page.getByRole("link", { name: /michel journal/i }).waitFor();
    await shot(page, "08-expired-pass-view-only");
    // The guest who entered earlier is now also outside the window.
    const guestPage = await guest.newPage();
    assert.equal(await connectCount(guestPage, `/${michel.username}`), 0, "Expiry takes effect for existing cookies immediately");
    await guestPage.goto(`${appUrl}/connect/${"x".repeat(43)}`);
    assert.equal(new URL(guestPage.url()).pathname, "/", "An unknown pass goes nowhere private");
    await guestPage.close();
    await late.close();
    console.log("PASS expired and unknown passes fail closed and fall back to the profile");
  }

  // ---- New pass after expiry, then Direct only -> Nobody revokes it immediately.
  {
    const page = owner.page;
    await page.goto(`${appUrl}/app/identity?mode=personal&section=share&intent=in_person`);
    await page.locator('[data-share-intent="in_person"]').waitFor();
    const fresh = await page.locator('[data-share-intent="in_person"]').getAttribute("data-qr-value");
    assert.notEqual(fresh, passUrl, "An expired pass is replaced, not reused");
    const holder = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const holderPage = await holder.newPage();
    await holderPage.goto(fresh);
    assert.equal(await connectButton(holderPage).count(), 1);
    await choosePolicy(page, "personal", "Nobody");
    await waitForPolicy(michel.id, "personal", "nobody");
    assert.equal(await connectCount(holderPage, `/${michel.username}`), 0, "Nobody wins over a pass that was valid a moment ago");
    const refused = await holderPage.request.post(`${appUrl}/api/connections`, { headers: { "content-type": "application/json", "x-setuvara-request": "same-origin", origin: appUrl }, data: { username: michel.username, mode: "personal", source: "qr", requestId: crypto.randomUUID(), displayName: "Late Guest", email: `late-${stamp}@example.test` } });
    assert.equal(refused.status(), 403, "The Connect API refuses Nobody even with a pass cookie");
    await page.goto(`${appUrl}/app?mode=personal`);
    await page.getByRole("button", { name: "Share Personal Mode" }).click();
    assert.equal(await page.getByRole("dialog").getByRole("radio", { name: "Connect in person" }).count(), 0, "Nobody never offers Connect in person");
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await holder.close();
    console.log("PASS policy change to Nobody takes effect immediately and hides Connect in person");
  }

  // ---- Existing Connection is preserved when the target goes to Nobody.
  {
    const page = registered.page;
    assert.equal(await connectCount(page, `/${michel.username}`), 0, "No new Connect for an already-connected visitor on Nobody");
    await page.getByText("Connected").first().waitFor();
    await page.getByRole("link", { name: "View connection" }).waitFor();
    const detail = await page.goto(`${appUrl}/app/connections/${existingConnectionId}`);
    assert.equal(detail?.status(), 200, "Connection detail still opens");
    const { data: edge } = await admin.from("connections").select("id").eq("id", existingConnectionId).single();
    assert(edge, "The Connection edge is not deleted");
    assert.equal((await encountersFor(michel.id)).length, 2, "Connection history is preserved");
    console.log("PASS existing Connection and history survive Anyone/Direct -> Nobody");
  }

  // ---- Outbound independence: Michel's Personal is Nobody, he still connects to Rayz.
  {
    const page = owner.page;
    assert.equal(await connectCount(page, `/${rayz.username}`), 1, "Rayz allows Connect");
    await connectButton(page).click();
    await page.getByRole("dialog").getByRole("button", { name: "Connect", exact: true }).click();
    await page.getByText("You’re connected.").waitFor();
    const outbound = (await encountersFor(rayz.id)).find((row) => row.created_by_user_id === michel.id);
    assert.equal(outbound?.shared_mode_slug, "personal", "Michel's outbound Connect is saved");
    console.log("PASS outbound Connect is independent of the actor's own inbound policy");
  }

  // ---- Editor preview: Visitor preview never fakes a pass.
  {
    const page = owner.page;
    await page.setViewportSize({ width: 1440, height: 960 });
    await choosePolicy(page, "personal", "Direct share only");
    await page.getByRole("radiogroup", { name: "Preview as" }).getByRole("radio", { name: "Visitor" }).click();
    await page.getByText("Seen from your public link: view-only.").waitFor();
    assert.equal(await page.getByRole("button", { name: /^Connect$/ }).count(), 0, "Visitor preview hides Connect for Direct share only");
    await shot(page, "09-editor-preview-direct-only");
    console.log("PASS editor Visitor preview reflects policy");
  }
} finally {
  await browser.close();
  for (const id of seededUsers) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.warn(`Local Connection Access E2E cleanup needs attention for a generated user: ${error.message}`);
  }
}
console.log("Connection Access E2E completed.");
