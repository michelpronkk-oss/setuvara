import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
assert.equal(gitRoot.replaceAll("\\", "/").toLowerCase(), process.cwd().replaceAll("\\", "/").toLowerCase(), "E2E must run from the Setuvara Git root");
assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "E2E must use local Setuvara Supabase only");
assert(publishableKey, "Local publishable key is required");
assert(new URL(appUrl).hostname === "127.0.0.1", "E2E app must use loopback only");
assert(new URL(mailpitUrl).hostname === "127.0.0.1", "Email capture must use loopback only");

const suffix = `${Date.now().toString(36).slice(-6)}${randomBytes(3).toString("hex")}`;
const owner = { email: `e2e-owner-${suffix}@example.test`, password: `${randomBytes(32).toString("base64url")}Aa1!`, username: `e2e_owner_${suffix}` };
const other = { email: `e2e-other-${suffix}@example.test`, password: `${randomBytes(32).toString("base64url")}Bb2!`, username: `e2e_other_${suffix}` };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=", "base64");

function localUserClient() {
  return createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function waitForConfirmation(email) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=50`);
    assert.equal(response.status, 200, "Mailpit should be reachable");
    const messages = (await response.json()).messages ?? [];
    const message = messages.find((item) => JSON.stringify(item.To ?? item.to ?? []).toLowerCase().includes(email.toLowerCase()));
    if (message) {
      const detailResponse = await fetch(`${mailpitUrl}/api/v1/message/${encodeURIComponent(message.ID ?? message.id)}`);
      assert.equal(detailResponse.status, 200);
      const detail = await detailResponse.json();
      const body = `${detail.HTML ?? detail.html ?? ""}\n${detail.Text ?? detail.text ?? ""}`;
      const rawLink = body.match(/https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/i)?.[0];
      assert(rawLink, "Confirmation email must link directly to /auth/confirm");
      const url = new URL(rawLink.replaceAll("&amp;", "&"));
      assert.equal(url.origin, appUrl);
      assert.equal(url.pathname, "/auth/confirm");
      assert(url.searchParams.get("token_hash"));
      assert.equal(url.searchParams.get("type"), "email");
      assert.equal(url.searchParams.get("next"), "/app/identity");
      return url.toString();
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Timed out waiting for a local signup confirmation email");
}

async function signUpAndConfirm(browser, account, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  let confirmationRouteSeen = false;
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/auth/confirm") confirmationRouteSeen = true; });
  await page.goto(`${appUrl}/signup`);
  await page.getByLabel("Display name").fill("Setuvara E2E Identity");
  await page.getByLabel("Username").fill(account.username);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Create your identity" }).click();
  await page.getByText(/^Check your email to confirm your account/).waitFor({ timeout: 15_000 });
  const confirmationUrl = await waitForConfirmation(account.email);
  await page.goto(confirmationUrl);
  await page.waitForURL(`${appUrl}/app/identity`, { timeout: 20_000 });
  await page.getByRole("heading", { name: "Make this one yours." }).waitFor();
  assert(confirmationRouteSeen, "/auth/confirm must be hit in the signup context");
  const cookies = await context.cookies(appUrl);
  assert(cookies.some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")), "Email verification must create the SSR auth cookie");
  return { context, page };
}

async function expectNoHorizontalOverflow(page, label) {
  const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(size.scroll <= size.client + 1, `${label} overflows horizontally (${size.scroll} > ${size.client})`);
}

async function openSection(page, title) {
  await page.getByRole("button", { name: title, exact: true }).first().click();
}

async function waitSaved(page) {
  await page.locator('div[aria-live="polite"]').filter({ hasText: /^Saved$/ }).waitFor();
}

async function waitEditorMessage(page, message) {
  const escaped = message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.locator('div[aria-live="polite"]').filter({ hasText: new RegExp(`^${escaped}$`) }).waitFor();
}

async function addLink(page, title, value, type = "url") {
  await openSection(page, "Links");
  await page.getByRole("textbox", { name: "Link label" }).fill(title);
  await page.getByRole("textbox", { name: "Link URL" }).fill(value);
  await page.getByLabel("Link type").selectOption(type);
  await page.getByRole("button", { name: "Add link", exact: true }).click();
  await page.getByRole("button", { name: `Hide ${title}`, exact: true }).waitFor();
}

async function setMode(page, mode) {
  await page.getByRole("tab", { name: mode, exact: true }).click();
}

async function testResponsiveAuth(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  for (const route of ["/signup", "/login"]) {
    const response = await page.goto(`${appUrl}${route}`);
    assert.equal(response?.status(), 200, `${route} must render at ${width}px`);
    await expectNoHorizontalOverflow(page, `${route} ${width}x${height}`);
    const fonts = await page.locator("input").evaluateAll((elements) => elements.map((input) => Number.parseFloat(getComputedStyle(input).fontSize)));
    assert(fonts.every((font) => font >= 16), `${route} inputs should be mobile-safe`);
  }
  await context.close();
}

async function authenticatedClient(account) {
  const client = localUserClient();
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  assert.ifError(error);
  assert(data.user && data.session, "Normal password sign-in must produce a session");
  return { client, user: data.user };
}

async function testIsolation(ownerAccount, otherAccount, ownerId, modeIds, linkIds, imagePath) {
  const ownerAuth = await authenticatedClient(ownerAccount);
  const otherAuth = await authenticatedClient(otherAccount);
  const otherClient = otherAuth.client;

  const profileUpdate = await otherClient.from("profiles").update({ username: otherAccount.username, display_name: "Unauthorized", is_published: false }).eq("id", ownerId).select("id");
  assert.ifError(profileUpdate.error);
  assert.equal(profileUpdate.data.length, 0, "Account 2 must not update account 1 profile, username, or publish status");
  const modeUpdate = await otherClient.from("profile_modes").update({ label: "Unauthorized" }).eq("id", modeIds[0]).select("id");
  assert.ifError(modeUpdate.error);
  assert.equal(modeUpdate.data.length, 0, "Account 2 must not update account 1 Mode");
  const modeDelete = await otherClient.from("profile_modes").delete().eq("id", modeIds[0]).select("id");
  assert.ifError(modeDelete.error);
  assert.equal(modeDelete.data.length, 0, "Account 2 must not delete account 1 Mode");
  const modeInsert = await otherClient.from("profile_modes").insert({ profile_id: ownerId, slug: "event", label: "Unauthorized" });
  assert(modeInsert.error, "Account 2 must not create a Mode on account 1 profile");
  const linkInsert = await otherClient.from("profile_links").insert({ profile_id: ownerId, mode_id: modeIds[0], title: "Unauthorized", url: "https://example.test/unauthorized" });
  assert(linkInsert.error, "Account 2 must not insert a link on account 1 profile");
  const linkUpdate = await otherClient.from("profile_links").update({ title: "Unauthorized" }).eq("id", linkIds[0]).select("id");
  assert.ifError(linkUpdate.error);
  assert.equal(linkUpdate.data.length, 0, "Account 2 must not update account 1 link");
  const linkDelete = await otherClient.from("profile_links").delete().eq("id", linkIds[0]).select("id");
  assert.ifError(linkDelete.error);
  assert.equal(linkDelete.data.length, 0, "Account 2 must not delete account 1 link");
  const forbiddenUpload = await otherClient.storage.from("profile-media").upload(imagePath, png, { contentType: "image/png" });
  assert(forbiddenUpload.error, "Account 2 must not upload into account 1 media path");
  await otherClient.storage.from("profile-media").remove([imagePath]);
  const ownerImage = await ownerAuth.client.storage.from("profile-media").download(imagePath);
  assert.ifError(ownerImage.error);

  const ownerProfile = await ownerAuth.client.from("profiles").select("username, display_name, bio, is_published").eq("id", ownerId).single();
  assert.ifError(ownerProfile.error);
  assert.deepEqual(ownerProfile.data, { username: ownerAccount.username, display_name: "Aanya Rao", bio: "One person, three thoughtful contexts.", is_published: true });
  const ownerModes = await ownerAuth.client.from("profile_modes").select("slug, label").eq("profile_id", ownerId).order("sort_order");
  assert.ifError(ownerModes.error);
  assert.deepEqual(ownerModes.data.map(({ slug }) => slug), ["personal", "event", "business"]);
  const ownerLinks = await ownerAuth.client.from("profile_links").select("title, link_type, is_visible, sort_order").eq("profile_id", ownerId).order("sort_order");
  assert.ifError(ownerLinks.error);
  assert(ownerLinks.data.every((link) => link.title !== "Unauthorized"));
  await ownerAuth.client.auth.signOut();
  await otherClient.auth.signOut();
}

const browser = await chromium.launch({ headless: true });
let ownerBrowser;
let otherBrowser;
let ownerId;
let modeIds = [];
let linkIds = [];
let imagePath = "";
try {
  ownerBrowser = await signUpAndConfirm(browser, owner);
  const page = ownerBrowser.page;
  await page.getByRole("tab", { name: "personal", exact: true }).waitFor();
  await page.getByRole("tab", { name: "event", exact: true }).waitFor();
  await page.getByRole("tab", { name: "business", exact: true }).waitFor();
  console.log("PASS local signup → captured confirmation → /auth/confirm → authenticated editor");

  await page.getByLabel("Username").fill(owner.username);
  await page.getByLabel("Display name").fill("Aanya Rao");
  await page.getByLabel("Personal bio").fill("One person, three thoughtful contexts.");
  await page.getByRole("button", { name: "Save identity details" }).click();
  await waitSaved(page);

  await page.getByRole("button", { name: "Add a photo" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "profile.png", mimeType: "image/png", buffer: png });
  await page.getByRole("dialog", { name: "Crop profile image" }).waitFor();
  await page.getByRole("button", { name: "Use photo" }).click();
  await waitEditorMessage(page, "Photo saved");
  console.log("PASS Personal profile details and cropped private profile media saved");

  await addLink(page, "Portfolio", "https://example.test/portfolio");
  await addLink(page, "Contact", "https://example.test/contact");
  await addLink(page, "Email me", "hello@example.test", "email");
  const personalSort = await authenticatedClient(owner);
  const beforeOrder = await personalSort.client.from("profile_links").select("id, title, sort_order, mode_id").eq("profile_id", personalSort.user.id).order("sort_order");
  assert.ifError(beforeOrder.error);
  assert.equal(beforeOrder.data.length, 3);
  const initialOrder = beforeOrder.data.map((row) => row.id);
  await page.getByRole("button", { name: "Move Portfolio down" }).click();
  await page.waitForTimeout(500);
  const afterOrder = await personalSort.client.from("profile_links").select("id, title, sort_order, mode_id").eq("profile_id", personalSort.user.id).order("sort_order");
  assert.ifError(afterOrder.error);
  assert.equal(afterOrder.data.length, 3);
  assert.notDeepEqual(afterOrder.data.map((row) => row.id), initialOrder, "Dragging should change and persist the order");
  await page.getByRole("button", { name: "Edit Portfolio" }).click();
  await page.getByRole("textbox", { name: "Edit link label" }).fill("Portfolio work");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Hide Portfolio work" }).waitFor();
  await personalSort.client.auth.signOut();
  console.log("PASS Personal link create, email type, edit, and persisted drag order");

  await setMode(page, "event");
  await openSection(page, "Mode settings");
  await page.getByLabel("Event name").fill("Slush");
  await page.getByLabel("City").fill("Helsinki");
  await page.getByLabel("Dates").fill("20–21 Nov 2026");
  await page.getByLabel("Your role / project").fill("Founder · Northlight");
  await page.getByLabel("Here to meet").fill("Product designers and early-stage operators.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await waitSaved(page);
  await openSection(page, "Appearance");
  await page.getByRole("button", { name: "dark", exact: true }).click();
  await page.getByRole("button", { name: "Event Poster" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await waitSaved(page);
  await addLink(page, "Slush connections", "https://example.test/slush");
  console.log("PASS Event Mode settings, appearance, and links");

  await setMode(page, "business");
  await openSection(page, "Mode settings");
  await page.getByLabel("Role").fill("Head of Sales");
  await page.getByLabel("Company").fill("Lumen Labs");
  await page.getByLabel("City").fill("Berlin");
  await page.getByLabel("What you do").fill("We help teams build durable customer relationships.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await waitSaved(page);
  await openSection(page, "Appearance");
  await page.getByRole("button", { name: "Editorial Business" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await waitSaved(page);
  await addLink(page, "Book an intro", "https://example.test/booking", "calendar");
  console.log("PASS Business Mode settings, appearance, and links");

  await openSection(page, "Share");
  await page.getByRole("img", { name: "Business Mode QR code" }).waitFor();
  await page.getByText(`${owner.username}?mode=business`, { exact: false }).waitFor();
  await page.getByRole("button", { name: "Copy link" }).click();
  await page.getByRole("button", { name: "Copied", exact: true }).waitFor();
  await page.getByRole("button", { name: "Full-screen QR" }).click();
  await page.getByRole("img", { name: "Business Mode share code" }).waitFor();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  console.log("PASS mode-aware share URL, QR, copy, native-share fallback, and full-screen QR");

  await setMode(page, "personal");
  await openSection(page, "Profile");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await waitEditorMessage(page, "Your profile is live");
  const anonContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const anonPage = await anonContext.newPage();
  const rootResponse = await anonPage.goto(`${appUrl}/${owner.username}`);
  assert.equal(rootResponse?.status(), 200, "Personal root profile must load for anonymous visitors");
  await anonPage.getByRole("heading", { name: "Aanya Rao" }).waitFor();
  await anonPage.getByRole("link", { name: "Portfolio work" }).waitFor();
  await anonPage.getByRole("img", { name: "Aanya Rao" }).waitFor();
  await anonPage.getByRole("link", { name: "Slush connections" }).waitFor({ state: "detached" });
  const eventResponse = await anonPage.goto(`${appUrl}/${owner.username}?mode=event`);
  assert.equal(eventResponse?.status(), 200);
  await anonPage.getByText("Slush", { exact: true }).waitFor();
  await anonPage.getByText("Product designers and early-stage operators.", { exact: true }).waitFor();
  await anonPage.getByRole("link", { name: "Slush connections" }).waitFor();
  await anonPage.getByRole("link", { name: "Portfolio work" }).waitFor({ state: "detached" });
  const businessResponse = await anonPage.goto(`${appUrl}/${owner.username}?mode=business`);
  assert.equal(businessResponse?.status(), 200);
  await anonPage.getByText("Head of Sales", { exact: true }).waitFor();
  await anonPage.getByText("Lumen Labs", { exact: true }).waitFor();
  await anonPage.getByRole("link", { name: "Book an intro" }).waitFor();
  const modeAccess = await authenticatedClient(owner);
  const eventMode = (await modeAccess.client.from("profile_modes").select("id").eq("profile_id", modeAccess.user.id).eq("slug", "event").single()).data;
  assert(eventMode);
  assert.ifError((await modeAccess.client.from("profile_modes").update({ is_enabled: false }).eq("id", eventMode.id)).error);
  assert.equal((await anonPage.goto(`${appUrl}/${owner.username}?mode=event`))?.status(), 404, "Disabled Mode must be inaccessible to visitors");
  assert.ifError((await modeAccess.client.from("profile_modes").update({ is_enabled: true }).eq("id", eventMode.id)).error);
  await modeAccess.client.auth.signOut();
  console.log("PASS published Personal/Event/Business root profiles show only their Mode data and links");

  await setMode(page, "personal");
  await openSection(page, "Links");
  await page.getByRole("button", { name: "Hide Portfolio work" }).click();
  await waitEditorMessage(page, "Link hidden");
  await anonPage.goto(`${appUrl}/${owner.username}?mode=personal`);
  await anonPage.getByRole("link", { name: "Portfolio work" }).waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Show Portfolio work" }).waitFor();
  await page.getByRole("button", { name: "Show Portfolio work" }).click();
  await waitEditorMessage(page, "Link visible");
  await anonPage.reload();
  await anonPage.getByRole("link", { name: "Portfolio work" }).waitFor();
  console.log("PASS link visibility is persisted and respected by anonymous public reads");

  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await waitEditorMessage(page, "Your profile is private");
  const unpublished = await anonPage.goto(`${appUrl}/${owner.username}`);
  assert.equal(unpublished?.status(), 404, "Unpublished profile must be hidden");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await waitEditorMessage(page, "Your profile is live");
  assert.equal((await anonPage.goto(`${appUrl}/${owner.username}`))?.status(), 200);
  const legacy = await anonContext.request.get(`${appUrl}/u/${owner.username}?mode=event`, { maxRedirects: 0 });
  assert.equal(legacy.status(), 308);
  assert.equal(legacy.headers().location, `/${owner.username}?mode=event`);
  console.log("PASS publish → unpublished 404 → republish and permanent legacy redirect");

  await page.locator("input[type=checkbox]").count().then((count) => assert.equal(count, 0));
  const { client: ownerClient, user: ownerUser } = await authenticatedClient(owner);
  ownerId = ownerUser.id;
  const modesResult = await ownerClient.from("profile_modes").select("id, slug").eq("profile_id", ownerId).order("sort_order");
  const linksResult = await ownerClient.from("profile_links").select("id, title, mode_id").eq("profile_id", ownerId).order("sort_order");
  assert.ifError(modesResult.error); assert.ifError(linksResult.error);
  assert.deepEqual(modesResult.data.map((mode) => mode.slug), ["personal", "event", "business"]);
  assert.equal(linksResult.data.length, 5);
  modeIds = modesResult.data.map((mode) => mode.id);
  linkIds = linksResult.data.map((link) => link.id);
  imagePath = (await ownerClient.from("profile_modes").select("image_path").eq("profile_id", ownerId).eq("slug", "personal").single()).data.image_path;
  assert(imagePath);
  await ownerClient.auth.signOut();

  await page.locator("footer").getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(`${appUrl}/login`);
  assert([307, 308].includes((await ownerBrowser.context.request.get(`${appUrl}/app`, { maxRedirects: 0 })).status()));
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Password").fill(owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${appUrl}/app/identity`);
  await page.getByRole("tab", { name: "event", exact: true }).click();
  await openSection(page, "Mode settings");
  await page.getByLabel("Event name").waitFor();
  await page.getByLabel("Event name").inputValue().then((value) => assert.equal(value, "Slush"));
  await page.getByRole("tab", { name: "business", exact: true }).click();
  await page.getByLabel("Company").waitFor();
  await page.getByLabel("Company").inputValue().then((value) => assert.equal(value, "Lumen Labs"));
  console.log("PASS logout, protected app redirect, login, and persisted Mode data");

  otherBrowser = await signUpAndConfirm(browser, other);
  await testIsolation(owner, other, ownerId, modeIds, linkIds, imagePath);
  console.log("PASS account 2 cannot change account 1 profile, Modes, links, or media");

  for (const route of ["/", "/login", "/signup"]) assert.equal((await anonContext.request.get(`${appUrl}${route}`)).status(), 200, `${route} must remain a static app route`);
  assert.equal((await anonContext.request.get(`${appUrl}/api/health/supabase`)).status(), 200, "Supabase health API should remain available");
  const confirmationWithoutToken = await anonContext.request.get(`${appUrl}/auth/confirm`, { maxRedirects: 0 });
  assert([307, 308].includes(confirmationWithoutToken.status()));
  assert(confirmationWithoutToken.headers().location?.includes("/login?error=confirmation_failed"));
  const rootDefault = await anonPage.goto(`${appUrl}/${owner.username}`); assert.equal(rootDefault?.status(), 200);
  const rootPersonal = await anonPage.goto(`${appUrl}/${owner.username}?mode=personal`); assert.equal(rootPersonal?.status(), 200);
  const legacyDefault = await anonContext.request.get(`${appUrl}/u/${owner.username}`, { maxRedirects: 0 }); assert.equal(legacyDefault.status(), 308);
  for (const bad of ["not_a_real_setuvara_user", "bad%25name"]) assert.equal((await anonContext.request.get(`${appUrl}/${bad}`)).status(), 404);
  console.log("PASS static routes, /auth/confirm error, health API, root profile, invalid username, and legacy redirect");

  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
    await testResponsiveAuth(browser, width, height);
    await page.setViewportSize({ width, height });
    await page.goto(`${appUrl}/app/identity?mode=personal&section=profile`);
    await expectNoHorizontalOverflow(page, `Identity editor ${width}x${height}`);
    await page.getByRole("button", { name: "Preview as visitor" }).waitFor();
    await page.getByRole("button", { name: "Preview as visitor" }).click();
    await expectNoHorizontalOverflow(page, `Editor preview ${width}x${height}`);
    await page.getByRole("button", { name: "Close preview" }).click();
    const response = await anonPage.setViewportSize({ width, height }).then(() => anonPage.goto(`${appUrl}/${owner.username}?mode=personal`));
    assert.equal(response?.status(), 200);
    await expectNoHorizontalOverflow(anonPage, `Public profile ${width}x${height}`);
  }
  console.log("PASS signup/login, editor, preview, and public profile at phone/tablet/desktop sizes");

  await ownerBrowser.context.close(); await otherBrowser.context.close(); await anonContext.close();
  console.log("E2E_LOCAL_RESULT=PASS");
} catch (error) {
  console.error(`E2E_LOCAL_RESULT=FAIL (${error instanceof Error ? error.message : "unknown error"})`);
  process.exitCode = 1;
} finally {
  await ownerBrowser?.context.close().catch(() => {});
  await otherBrowser?.context.close().catch(() => {});
  await browser.close().catch(() => {});
  const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
  if (!serviceKey) {
    console.warn("Local E2E test-account cleanup needs attention.");
  } else {
    const cleanup = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    try {
      const { data, error } = await cleanup.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      for (const user of (data.users ?? []).filter((candidate) => [owner.email, other.email].includes(candidate.email ?? ""))) {
        const { data: objects, error: listError } = await cleanup.storage.from("profile-media").list(user.id, { limit: 1000 });
        if (listError) throw listError;
        if (objects?.length) {
          const { error: removeError } = await cleanup.storage.from("profile-media").remove(objects.map((object) => `${user.id}/${object.name}`));
          if (removeError) throw removeError;
        }
        const { error: deleteError } = await cleanup.auth.admin.deleteUser(user.id);
        if (deleteError) throw deleteError;
      }
    } catch {
      console.warn("Local E2E test-account cleanup needs attention.");
    }
  }
}
