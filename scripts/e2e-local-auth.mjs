import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { validateFreshHome, validateHomeWithData } from "./e2e-app-home.mjs";

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
const guestClaim = { email: `e2e-guest-${suffix}@example.test`, password: `${randomBytes(32).toString("base64url")}Cc3!`, username: `e2e_guest_${suffix}` };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=", "base64");
const progressionGuestEmails = [];
let storageFailure = null;
let imageSaved = false;
let contentImageBlockId = "";
let contentImagePath = "";
let featureBlockId = "";
let featureImagePath = "";
let featureFallbackUrl = "";

function localUserClient() {
  return createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function localSql(sql) {
  const cli = resolve(process.cwd(), "node_modules/supabase/dist/supabase.js");
  const output = execFileSync(process.execPath, [cli, "db", "query", "--local", "--output-format", "json", sql], { encoding: "utf8" });
  const jsonStart = output.indexOf("{");
  assert(jsonStart >= 0, "Local Setuvara SQL query should return JSON");
  return JSON.parse(output.slice(jsonStart)).rows;
}

async function validateEmailNotifications(page, ownerAccount, otherAccount, ownerId) {
  const adminKey = process.env.E2E_LOCAL_SERVICE_KEY;
  assert(adminKey, "Local service key is required only to inspect and clean local notification jobs");
  const admin = createClient(supabaseUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });

  await page.goto(`${appUrl}/app/settings/notifications`);
  await page.getByRole("heading", { name: "Email preferences" }).waitFor();
  const productUpdates = page.getByLabel("Product updates");
  assert.equal(await productUpdates.isChecked(), false, "Product updates must default off");
  await productUpdates.check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.getByRole("status").filter({ hasText: "Preferences saved." }).waitFor();
  const ownerAuth = await authenticatedClient(ownerAccount);
  const savedPreferences = await ownerAuth.client.from("notification_preferences").select("product_updates").eq("user_id", ownerId).single();
  assert.ifError(savedPreferences.error);
  assert.equal(savedPreferences.data.product_updates, true, "Owner preference changes should persist");

  const otherAuth = await authenticatedClient(otherAccount);
  const otherRead = await otherAuth.client.from("notification_preferences").select("user_id").eq("user_id", ownerId);
  assert.ifError(otherRead.error);
  assert.equal(otherRead.data.length, 0, "Another account cannot read notification preferences");
  const otherUpdate = await otherAuth.client.from("notification_preferences").update({ product_updates: true }).eq("user_id", ownerId).select("user_id");
  assert.ifError(otherUpdate.error);
  assert.equal(otherUpdate.data.length, 0, "Another account cannot modify notification preferences");
  await otherAuth.client.auth.signOut();

  await productUpdates.uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.getByRole("status").filter({ hasText: "Preferences saved." }).waitFor();
  const unsubToken = randomBytes(32).toString("base64url");
  const unsubHash = createHash("sha256").update(unsubToken).digest("hex");
  const stored = await admin.rpc("record_email_unsubscribe_token", {
    p_user_id: ownerId,
    p_category: "product_updates",
    p_hash_hex: unsubHash,
  });
  assert.ifError(stored.error);
  assert.equal(stored.data, true, "Server-side unsubscribe token should be stored as a hash");
  const unsubscribed = await page.request.post(`${appUrl}/api/email/unsubscribe?token=${unsubToken}`, {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: "List-Unsubscribe=One-Click",
  });
  assert.equal(unsubscribed.status(), 200, "One-click unsubscribe endpoint should accept an RFC 8058 POST");
  assert.match(await unsubscribed.text(), /You’re unsubscribed/);
  const reused = await page.request.post(`${appUrl}/api/email/unsubscribe?token=${unsubToken}`, {
    headers: { "content-type": "application/x-www-form-urlencoded" }, data: "List-Unsubscribe=One-Click",
  });
  assert.equal(reused.status(), 400, "One-click unsubscribe tokens must be single use");
  const persistedUnsubscribe = await ownerAuth.client.from("notification_preferences").select("product_updates").eq("user_id", ownerId).single();
  assert.ifError(persistedUnsubscribe.error);
  assert.equal(persistedUnsubscribe.data.product_updates, false, "Unsubscribe must persist only the scoped email category");

  const queueCounts = localSql(`
    select template_key, count(*)::integer as count
    from private.email_deliveries
    where recipient_user_id = '${ownerId}'::uuid
    group by template_key
  `);
  const counts = Object.fromEntries(queueCounts.map((row) => [row.template_key, Number(row.count)]));
  for (const key of ["welcome", "new_connection", "connection_recap", "guest_claimed", "passport_milestone", "passport_stamp"]) {
    assert((counts[key] ?? 0) > 0, `The local notification outbox should include ${key}`);
  }
  const emailColumns = localSql(`
    select count(*)::integer as count
    from information_schema.columns
    where table_schema = 'private'
      and table_name in ('email_deliveries', 'notification_events')
      and column_name in ('email', 'recipient_email', 'email_address')
  `);
  assert.equal(Number(emailColumns[0].count), 0, "The durable outbox must not snapshot a recipient email address");
  const eventDuplicates = localSql(`select count(*)::integer as count, count(distinct event_key)::integer as unique_count from private.notification_events`);
  assert.equal(Number(eventDuplicates[0].count), Number(eventDuplicates[0].unique_count), "Notification source events must be idempotent");

  const claimed = await admin.rpc("claim_email_deliveries", { p_limit: 50 });
  assert.ifError(claimed.error);
  assert(claimed.data.length > 0, "The local dispatcher claim RPC should lease due outbox rows");
  const welcome = claimed.data.find((delivery) => delivery.recipient_user_id === ownerId && delivery.template_key === "welcome");
  assert(welcome, "The verified owner welcome message should be ready for dispatch");
  const context = await admin.rpc("get_email_delivery_context", { p_delivery_id: welcome.id });
  assert.ifError(context.error);
  assert.equal(context.data.recipient.email, ownerAccount.email, "Recipient address should resolve from the current confirmed Auth user at send time");
  assert.equal(context.data.recipient.confirmed, true);
  assert.equal(context.data.profile.username, ownerAccount.username);

  for (const delivery of claimed.data) {
    const suppressed = await admin.rpc("suppress_email_delivery", { p_delivery_id: delivery.id });
    assert.ifError(suppressed.error);
    assert.equal(suppressed.data, true, "Local test claims should be safely closed without sending external email");
  }
  await ownerAuth.client.auth.signOut();
  console.log("PASS notification preferences RLS, one-click unsubscribe, deduplicated outbox events, recap grouping, current recipient resolution, and safe local queue claims");
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

async function signUpAndConfirm(browser, account, viewport = { width: 390, height: 844 }, existingContext = null, claimGuest = false) {
  const context = existingContext ?? await browser.newContext({ viewport, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  let confirmationRouteSeen = false;
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/auth/confirm") confirmationRouteSeen = true; });
  await page.goto(`${appUrl}/signup${claimGuest ? "?claim=1" : ""}`);
  await page.getByLabel("Username").fill(account.username);
  await page.getByText("Available. It’s yours if you want it.").waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: `Claim @${account.username}` }).click();
  await page.getByLabel("Your name").fill("Setuvara E2E Identity");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Create my Setuvara" }).click();
  await page.getByRole("heading", { name: "Check your inbox." }).waitFor({ timeout: 15_000 });
  await page.getByText(/Check your email to confirm your account/).waitFor();
  const confirmationUrl = await waitForConfirmation(account.email);
  await page.goto(confirmationUrl);
  await page.waitForURL(`${appUrl}/app/identity`, { timeout: 20_000 });
  await page.getByRole("heading", { name: "Personal Mode", exact: true }).filter({ visible: true }).waitFor();
  assert(confirmationRouteSeen, "/auth/confirm must be hit in the signup context");
  const cookies = await context.cookies(appUrl);
  assert(cookies.some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")), "Email verification must create the SSR auth cookie");
  return { context, page };
}

async function expectNoHorizontalOverflow(page, label) {
  const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(size.scroll <= size.client + 1, `${label} overflows horizontally (${size.scroll} > ${size.client})`);
}

async function waitForConnected(page, label) {
  try {
    await page.getByText("You’re connected.").waitFor({ timeout: 8_000 });
  } catch (error) {
    console.error(`E2E ${label} failed to render success state: ${(await page.locator("body").innerText()).slice(-1600)}`);
    throw error;
  }
}

async function openSection(page, title) {
  const labels = { "Links": "Content", "Mode settings": "Mode Settings" };
  const actual = labels[title] ?? title;
  const section = { Profile: "profile", Links: "links", Appearance: "appearance", "Mode settings": "settings", Share: "share" }[title];
  const control = page.getByRole("button", { name: actual, exact: true }).filter({ visible: true }).first();
  if (await control.count()) await control.click();
  else {
    const target = new URL(page.url()); target.searchParams.set("section", section);
    await page.goto(target.toString());
  }
  await page.getByRole("heading", { name: actual, exact: true }).filter({ visible: true }).waitFor();
}

async function waitSaved(page) {
  await page.locator('span[aria-live="polite"]').filter({ hasText: /Saved$/ }).waitFor({ state: "attached" });
}

async function waitEditorMessage(page, message) {
  message = ({ "Photo saved": "Photo updated in Personal Mode", "Your profile is live": "Published. Every share surface is up to date.", "Your profile is private": "Your Setuvara is private. Links and QR codes stop working." })[message] ?? message;
  const escaped = message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    await page.locator('div[aria-live="polite"]').filter({ hasText: new RegExp(`^${escaped}$`) }).waitFor();
  } catch (error) {
    console.error(`Expected editor message "${message}"; current page text: ${(await page.locator("body").innerText()).slice(-1200)}`);
    if (message === "Photo saved") console.error(`Local profile media response: ${JSON.stringify(storageFailure)}`);
    throw error;
  }
}

async function chooseLinkProvider(page, provider) {
  const pickerTrigger = page.getByRole("button", { name: "Choose a provider" });
  await pickerTrigger.click();
  const picker = page.getByRole("dialog", { name: "Choose a link" });
  await picker.getByRole("textbox", { name: "Search links" }).fill(provider);
  await picker.getByRole("button", { name: new RegExp(provider, "i") }).first().click();
}
async function openAddLink(page) {
  await openSection(page, "Links");
  await page.getByRole("button", { name: /^(Add|Add content.*)$/ }).filter({ visible: true }).click();

}
async function addLink(page, title, value, provider = "Custom Link") {
  await openAddLink(page);
  await chooseLinkProvider(page, provider);
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Label", { exact: true }).fill(title);
  await sheet.locator("#new-link-value").fill(value);
  await sheet.getByRole("button", { name: "Add link", exact: true }).click();
  await sheet.waitFor({ state: "detached" });
  await page.getByRole("switch", { name: `Hide ${title}`, exact: true }).waitFor();
}
async function setMode(page, mode) {
  await page.getByRole("tab", { name: new RegExp(`^${mode}`, "i") }).filter({ visible: true }).click();
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

async function verifyProfileMediaRules(client, userId, imageFormats) {
  const bucket = client.storage.from("profile-media");
  const uploadedPaths = [];
  const files = [
    { extension: "png", contentType: "image/png", body: png },
    { extension: "jpg", contentType: "image/jpeg", body: imageFormats.jpeg },
    { extension: "webp", contentType: "image/webp", body: imageFormats.webp },
  ];
  for (const file of files) {
    const path = `${userId}/media-policy-${crypto.randomUUID()}.${file.extension}`;
    const result = await bucket.upload(path, file.body, { contentType: file.contentType, upsert: false });
    assert.ifError(result.error, `${file.contentType} must be allowed by the private profile-media bucket`);
    uploadedPaths.push(path);
  }

  const invalidMimePath = `${userId}/media-policy-${crypto.randomUUID()}.txt`;
  const invalidMime = await bucket.upload(invalidMimePath, Buffer.from("not an image"), { contentType: "text/plain", upsert: false });
  if (!invalidMime.error) await bucket.remove([invalidMimePath]);
  assert(invalidMime.error, "profile-media must reject unsupported MIME types");

  const oversizedPath = `${userId}/media-policy-${crypto.randomUUID()}.png`;
  const oversized = await bucket.upload(oversizedPath, Buffer.alloc(5 * 1024 * 1024 + 1), { contentType: "image/png", upsert: false });
  if (!oversized.error) await bucket.remove([oversizedPath]);
  assert(oversized.error, "profile-media must reject files larger than 5 MiB");

  const cleanup = await bucket.remove(uploadedPaths);
  assert.ifError(cleanup.error, "Owner must be able to remove temporary MIME-policy test objects");
}

async function testIsolation(ownerAccount, otherAccount, ownerId, modeIds, linkIds, imagePath, blockIds = [], blockImagePath = "") {
  const ownerAuth = await authenticatedClient(ownerAccount);
  const otherAuth = await authenticatedClient(otherAccount);
  const otherClient = otherAuth.client;

  const imageWithoutPath = await ownerAuth.client.from("profile_blocks").insert({ profile_id: ownerId, mode_id: modeIds[0], kind: "image", data: { alt: "Missing storage path" } });
  assert(imageWithoutPath.error, "Database must reject Image blocks without an owner-scoped image path");

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
  for (const blockId of blockIds) {
    const blockUpdate = await otherClient.from("profile_blocks").update({ data: { alt: "Unauthorized" } }).eq("id", blockId).select("id");
    assert.ifError(blockUpdate.error);
    assert.equal(blockUpdate.data.length, 0, "Account 2 must not update account 1 content blocks");
    const blockDelete = await otherClient.from("profile_blocks").delete().eq("id", blockId).select("id");
    assert.ifError(blockDelete.error);
    assert.equal(blockDelete.data.length, 0, "Account 2 must not delete account 1 content blocks");
  }
  if (blockImagePath) {
    const forbiddenBlockPath = `${ownerId}/${crypto.randomUUID()}.png`;
    const forbiddenBlockUpload = await otherClient.storage.from("profile-media").upload(forbiddenBlockPath, png, { contentType: "image/png", upsert: false });
    assert(forbiddenBlockUpload.error, "Account 2 must not upload into account 1 content media folder");
    const forbiddenBlockDelete = await otherClient.storage.from("profile-media").remove([blockImagePath]);
    assert.ifError(forbiddenBlockDelete.error);
    const blockImage = await ownerAuth.client.storage.from("profile-media").download(blockImagePath);
    assert.ifError(blockImage.error, "Account 2 must not delete account 1 content image");
  }
  if (imagePath) {
    const forbiddenPath = `${ownerId}/unauthorized-${crypto.randomUUID()}.webp`;
    const forbiddenUpload = await otherClient.storage.from("profile-media").upload(forbiddenPath, png, { contentType: "image/png" });
    if (!forbiddenUpload.error) await ownerAuth.client.storage.from("profile-media").remove([forbiddenPath]);
    assert(forbiddenUpload.error, "Account 2 must not upload into account 1 media path");
    const forbiddenReplace = await otherClient.storage.from("profile-media").upload(imagePath, png, { contentType: "image/png", upsert: true });
    assert(forbiddenReplace.error, "Account 2 must not replace account 1 media");
    const forbiddenDelete = await otherClient.storage.from("profile-media").remove([imagePath]);
    assert.ifError(forbiddenDelete.error);
    const ownerImage = await ownerAuth.client.storage.from("profile-media").download(imagePath);
    assert.ifError(ownerImage.error);
  }

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
  page.on("response", async (response) => {
    if (response.url().includes("/storage/v1/object/profile-media/") && !response.ok()) {
      storageFailure = { status: response.status(), body: (await response.text()).slice(0, 500) };
    }
  });
  await validateFreshHome(page, appUrl);
  await expectNoHorizontalOverflow(page, "Setuvara Home");
  await page.goto(`${appUrl}/app/identity`);
  await page.getByRole("tab", { name: /^Personal/ }).filter({ visible: true }).waitFor();
  await page.getByRole("tab", { name: /^Event/ }).filter({ visible: true }).waitFor();
  await page.getByRole("tab", { name: /^Business/ }).filter({ visible: true }).waitFor();
  console.log("PASS local signup → captured confirmation → /auth/confirm → authenticated editor and Setuvara Home shell");

  await openSection(page, "Profile");
  await page.getByLabel("Username").fill(owner.username);
  await page.getByLabel("Display name").fill("Aanya Rao");
  await page.getByLabel("Personal line").fill("A draft that saves itself while I make it mine.");
  await waitSaved(page);
  await page.reload();
  assert.equal(await page.getByLabel("Personal line").inputValue(), "A draft that saves itself while I make it mine.", "Valid profile edits should autosave and survive refresh");
  await page.getByLabel("Personal line").fill("One person, three thoughtful contexts.");
  await page.keyboard.press("Control+s");
  await waitSaved(page);

  await page.getByRole("button", { name: "Upload a photo" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "profile.png", mimeType: "image/png", buffer: png });
  await page.getByRole("dialog", { name: "Crop photo" }).waitFor();
  await page.getByRole("button", { name: /^Save( photo)?$/ }).click();
  await Promise.race([
    waitEditorMessage(page, "Photo saved"),
    page.getByText(/This image could not be uploaded/).first().waitFor({ timeout: 20_000 }),
  ]);
  const mediaUnavailable = Boolean(await page.getByText(/This image could not be uploaded/).count());
  assert(!mediaUnavailable, `Profile media upload failed: ${JSON.stringify(storageFailure)}`);
  imageSaved = true;

  const mediaAuth = await authenticatedClient(owner);
  ownerId = mediaAuth.user.id;
  const firstImage = await mediaAuth.client.from("profile_modes").select("image_path").eq("profile_id", ownerId).eq("slug", "personal").single();
  assert.ifError(firstImage.error);
  assert(firstImage.data.image_path, "Cropped profile media must be persisted to the Personal Mode");
  const originalImagePath = firstImage.data.image_path;

  const imageFormats = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    canvas.getContext("2d")?.drawImage(image, 0, 0, 32, 32);
    return { jpeg: canvas.toDataURL("image/jpeg", 0.9), webp: canvas.toDataURL("image/webp", 0.9) };
  }, png.toString("base64"));
  const mediaFormats = {
    jpeg: Buffer.from(imageFormats.jpeg.split(",")[1], "base64"),
    webp: Buffer.from(imageFormats.webp.split(",")[1], "base64"),
  };
  await verifyProfileMediaRules(mediaAuth.client, ownerId, mediaFormats);

  await page.getByRole("button", { name: "Replace" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "replacement.jpg", mimeType: "image/jpeg", buffer: mediaFormats.jpeg });
  await page.getByRole("dialog", { name: "Crop photo" }).waitFor();
  const replacementUpload = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    response.url().includes(`/storage/v1/object/profile-media/${ownerId}/`) &&
    response.ok(), { timeout: 20_000 });
  const removePreviousImage = page.waitForResponse((response) =>
    response.request().method() === "DELETE" &&
    response.url().includes("/storage/v1/object/profile-media") &&
    response.ok(), { timeout: 20_000 });
  await page.getByRole("button", { name: /^Save( photo)?$/ }).click();
  await replacementUpload;
  await removePreviousImage;
  await waitEditorMessage(page, "Photo saved");
  const replacement = await mediaAuth.client.from("profile_modes").select("image_path").eq("profile_id", ownerId).eq("slug", "personal").single();
  assert.ifError(replacement.error);
  assert(replacement.data.image_path && replacement.data.image_path !== originalImagePath, "Replacing a photo must persist a new private Storage path");
  imagePath = replacement.data.image_path;
  const removedOriginal = await mediaAuth.client.storage.from("profile-media").download(originalImagePath);
  assert(removedOriginal.error, "Replacing a photo must remove the previous owner-scoped object");
  const ownerImage = await mediaAuth.client.storage.from("profile-media").download(imagePath);
  assert.ifError(ownerImage.error, "Owner must be able to read the replacement photo");
  await mediaAuth.client.auth.signOut();
  console.log("PASS cropped upload, JPEG/PNG/WebP MIME allowlist, size/MIME rejection, replacement, old-object removal, and owner access");

  // Content images use the same owner-scoped private bucket and renderer as the public profile.
  await page.route("https://images.example.test/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: png }));
  await openAddLink(page);
  await page.getByRole("button", { name: /^Image/ }).click();
  let imageDialog = page.getByRole("dialog").last();
  await imageDialog.getByLabel("Upload profile image").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
  await imageDialog.getByRole("alert").filter({ hasText: /Choose a JPEG, PNG or WebP/ }).waitFor();
  await imageDialog.getByLabel("Upload profile image").setInputFiles({ name: "too-large.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await imageDialog.getByRole("alert").filter({ hasText: /smaller than 5 MB/ }).waitFor();
  await imageDialog.getByLabel("Upload profile image").setInputFiles({ name: "content-photo.png", mimeType: "image/png", buffer: png });
  await imageDialog.getByText("Image ready").waitFor();
  await imageDialog.getByLabel("Describe the image").fill("A candid Setuvara E2E image");
  await imageDialog.getByLabel("Caption").fill("A candid image block");
  await imageDialog.getByRole("button", { name: "Add image", exact: true }).click();
  await imageDialog.waitFor({ state: "detached" });

  const contentAuth = await authenticatedClient(owner);
  const contentImage = await contentAuth.client.from("profile_blocks").select("id, data, mode_id, is_visible").eq("profile_id", ownerId).eq("kind", "image").single();
  assert.ifError(contentImage.error);
  contentImageBlockId = contentImage.data.id;
  contentImagePath = contentImage.data.data.image_path;
  assert.match(contentImagePath, new RegExp(`^${ownerId}/[0-9a-f-]{36}\\.png$`, "i"), "Image block must persist an owner-scoped random Storage path");
  assert.equal(contentImage.data.mode_id, (await contentAuth.client.from("profile_modes").select("id").eq("profile_id", ownerId).eq("slug", "personal").single()).data.id, "Image content must stay inside the selected Mode");

  featureFallbackUrl = "https://images.example.test/setuvara-link-preview.jpg";
  const featureUrl = "https://example.com/setuvara-feature";
  await page.route("**/api/link-preview?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ url: featureUrl, title: "Setuvara E2E Feature", description: "A local preview fixture.", image: featureFallbackUrl, siteName: "Example" }),
  }));
  await openAddLink(page);
  await page.locator("#smart-paste").fill(featureUrl);
  await page.getByRole("button", { name: /Feature it as a card/ }).click();
  let featureDialog = page.getByRole("dialog").last();
  await page.waitForFunction(() => document.querySelector("#block-title")?.value === "Setuvara E2E Feature");
  assert.equal(await featureDialog.locator("img").last().getAttribute("src"), featureFallbackUrl, "Link metadata image should be the initial Featured Link image");
  await featureDialog.getByLabel("Upload featured link image").setInputFiles({ name: "featured-custom.png", mimeType: "image/png", buffer: png });
  await featureDialog.getByText("Image ready").waitFor();
  assert.match(await featureDialog.locator("img").last().getAttribute("src"), /storage\/v1\/object\/sign\/profile-media\//, "Custom upload must override link preview in the editor renderer");
  await featureDialog.getByRole("button", { name: "Add featured link", exact: true }).click();
  await featureDialog.waitFor({ state: "detached" });
  await page.unroute("**/api/link-preview?*");
  const featureRow = await contentAuth.client.from("profile_blocks").select("id, data, mode_id").eq("profile_id", ownerId).eq("kind", "feature").single();
  assert.ifError(featureRow.error);
  featureBlockId = featureRow.data.id;
  featureImagePath = featureRow.data.data.image_path;
  assert.equal(featureRow.data.data.image, featureFallbackUrl, "Custom upload must not replace or erase the fetched link preview image");
  assert.match(featureImagePath, new RegExp(`^${ownerId}/[0-9a-f-]{36}\\.png$`, "i"));
  await contentAuth.client.auth.signOut();
  console.log("PASS Image block upload, Mode scoping, Featured Link metadata image, and custom-image priority");

  await addLink(page, "Portfolio", "https://example.test/portfolio", "Portfolio");
  await addLink(page, "Contact", "https://example.test/contact", "Contact Form");
  await addLink(page, "Email me", "hello@example.test", "Email");
  const personalSort = await authenticatedClient(owner);
  const beforeOrder = await personalSort.client.from("profile_links").select("id, title, sort_order, mode_id").eq("profile_id", personalSort.user.id).order("sort_order");
  assert.ifError(beforeOrder.error);
  assert.equal(beforeOrder.data.length, 3);
  const initialOrder = beforeOrder.data.map((row) => row.id);
  const portfolioRow = page.locator("li").filter({ has: page.getByRole("switch", { name: "Hide Portfolio", exact: true }) });
  const drag = portfolioRow.getByRole("button", { name: "Drag to reorder" });
  await drag.scrollIntoViewIfNeeded();
  const dragBox = await drag.boundingBox();
  assert(dragBox);
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2 + 8, { steps: 3 });
  await page.waitForTimeout(200);
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2 + 90, { steps: 12 });
  await page.waitForTimeout(200); await page.mouse.up();
  await page.waitForTimeout(500);
  const afterOrder = await personalSort.client.from("profile_links").select("id, title, sort_order, mode_id").eq("profile_id", personalSort.user.id).order("sort_order");
  assert.ifError(afterOrder.error);
  assert.equal(afterOrder.data.length, 3);
  assert.notDeepEqual(afterOrder.data.map((row) => row.id), initialOrder, "Dragging should change and persist the order");
  await portfolioRow.getByRole("button").filter({ hasText: "Portfolio" }).click();
  await page.getByRole("textbox", { name: "Label" }).fill("Portfolio work");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("switch", { name: "Hide Portfolio work" }).waitFor();
  // Current editor's Undo restores deleted links; profile fields use native editing/autosave.
  const contactRow = page.locator("li").filter({ has: page.getByRole("switch", { name: "Hide Contact", exact: true }) });
  await contactRow.getByRole("button").filter({ hasText: "Contact" }).click();
  await contactRow.getByRole("button", { name: "Delete", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("switch", { name: "Hide Contact", exact: true }).waitFor();
  assert.equal((await personalSort.client.from("profile_links").select("id", { count: "exact", head: true })).count, 3, "Undo must restore the deleted link to Supabase");
  await personalSort.client.auth.signOut();
  console.log("PASS Personal link create, email type, edit, persisted drag order, delete and Undo");

  await addLink(page, "Instagram", "@meyvor", "Instagram");
  await addLink(page, "TikTok", "https://www.tiktok.com/@meyvor", "TikTok");
  await addLink(page, "WhatsApp", "+31 6 12345678", "WhatsApp");
  await addLink(page, "Spotify", "https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb", "Spotify");
  await addLink(page, "YouTube", "@setuvara", "YouTube");
  await addLink(page, "My site", "example.com", "Website");
  const normalizedPersonal = await authenticatedClient(owner);
  const personalRows = await normalizedPersonal.client.from("profile_links").select("title,url,link_type").eq("profile_id", normalizedPersonal.user.id).eq("mode_id", (await normalizedPersonal.client.from("profile_modes").select("id").eq("profile_id", normalizedPersonal.user.id).eq("slug", "personal").single()).data.id);
  assert.ifError(personalRows.error);
  const personalByTitle = new Map(personalRows.data.map((link) => [link.title, link]));
  assert.equal(personalByTitle.get("Instagram")?.url, "https://instagram.com/meyvor");
  assert.equal(personalByTitle.get("TikTok")?.url, "https://tiktok.com/@meyvor");
  assert.equal(personalByTitle.get("WhatsApp")?.url, "https://wa.me/31612345678");
  assert.equal(personalByTitle.get("Spotify")?.url, "https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb");
  assert.equal(personalByTitle.get("YouTube")?.url, "https://youtube.com/@setuvara");
  assert.equal(personalByTitle.get("My site")?.url, "https://example.com/");
  await normalizedPersonal.client.auth.signOut();

  const rejectAuth = await authenticatedClient(owner);
  const linkCountBeforeRejects = (await rejectAuth.client.from("profile_links").select("id", { count: "exact", head: true })).count;
  for (const [provider, unsafe] of [["Custom Link", "javascript:alert(1)"], ["Custom Link", "data:text/html,hello"], ["Custom Link", "file:///private/file"], ["Custom Link", "https://not a domain/path"], ["WhatsApp", "1234"], ["Email", "mailto:broken"]]) {
    await openAddLink(page); await chooseLinkProvider(page, provider);
    const sheet = page.getByRole("dialog");
    await sheet.locator("#new-link-value").fill(unsafe);
    await sheet.getByRole("button", { name: "Add link", exact: true }).click();
    await sheet.getByRole("alert").waitFor();
    await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  const postRejectCount = (await rejectAuth.client.from("profile_links").select("id", { count: "exact", head: true })).count;
  assert.equal(postRejectCount, linkCountBeforeRejects, "Unsafe/malformed provider inputs must not be persisted");
  await rejectAuth.client.auth.signOut();
  console.log("PASS provider normalization and rejection for unsafe protocols, malformed URLs, email, and international phone data");

  await setMode(page, "event");
  await openSection(page, "Profile");
  await page.getByLabel("Event name").fill("Slush");
  await page.getByLabel("City").fill("Helsinki");

  await page.getByLabel("Dates").fill("20–21 Nov 2026");
  await page.getByLabel("Role, project or company").fill("Founder · Northlight");
  await page.getByLabel("Here to meet").fill("Product designers and early-stage operators.");
  await page.keyboard.press("Control+s");
  await waitSaved(page);
  await openSection(page, "Appearance");
  await page.getByRole("button", { name: /Dark/ }).click();
  await page.getByRole("button", { name: /Event Poster/ }).click();
  await page.keyboard.press("Control+s");
  await waitSaved(page);
  await addLink(page, "Slush connections", "https://slush.org", "Event Page");
  await addLink(page, "LinkedIn", "https://www.linkedin.com/in/michel-pronk", "LinkedIn");
  await addLink(page, "Event X", "@slushdotorg", "X");
  await addLink(page, "Schedule", "https://slush.org/schedule", "Schedule");
  const eventReload = await page.reload();
  assert.equal(eventReload?.status(), 200);
  await page.getByRole("switch", { name: "Hide LinkedIn" }).waitFor();
  console.log("PASS Event Mode settings, appearance, and links");

  await setMode(page, "business");
  await openSection(page, "Profile");
  await page.getByLabel("Role").fill("Head of Sales");
  await page.getByLabel("Company").fill("Lumen Labs");
  await page.getByLabel("City").fill("Berlin");
  await page.getByLabel("Professional description").fill("We help teams build durable customer relationships.");
  await page.keyboard.press("Control+s");
  await waitSaved(page);
  await openSection(page, "Appearance");
  await page.getByRole("button", { name: /Editorial Business/ }).click();
  await page.keyboard.press("Control+s");
  await waitSaved(page);
  await addLink(page, "Book an intro", "michel", "Calendly");
  await addLink(page, "LinkedIn", "https://www.linkedin.com/company/northlight", "LinkedIn");
  await addLink(page, "Company site", "northlight.example", "Company Website");
  await addLink(page, "Email sales", "sales@northlight.example", "Email");
  await addLink(page, "Call sales", "+49 30 12345678", "Phone");
  await addLink(page, "GitHub", "octocat", "GitHub");
  await addLink(page, "Work", "https://portfolio.example/work", "Portfolio");
  await addLink(page, "Pitch deck", "https://northlight.example/deck", "Pitch Deck");
  await page.reload();
  await page.getByRole("switch", { name: "Hide Book an intro" }).waitFor();
  const businessAuth = await authenticatedClient(owner);
  const businessLinks = await businessAuth.client.from("profile_links").select("title,url,link_type").eq("profile_id", businessAuth.user.id).order("sort_order");
  assert.ifError(businessLinks.error);
  const bookLink = businessLinks.data.find((link) => link.title === "Book an intro");
  const phoneLink = businessLinks.data.find((link) => link.title === "Call sales");
  assert.equal(bookLink?.url, "https://calendly.com/michel");
  assert.equal(phoneLink?.url, "tel:+493012345678");
  await businessAuth.client.auth.signOut();
  console.log("PASS Business Mode settings, appearance, and links");

  await openSection(page, "Share");
  await page.locator("svg title").filter({ hasText: "Business Mode QR code" }).waitFor({ state: "attached" });
  await page.getByText(`${owner.username}?mode=business`, { exact: false }).filter({ visible: true }).first().waitFor();
  await page.getByRole("button", { name: "Copy link" }).click();
  await page.getByRole("button", { name: /Copied/ }).waitFor();
  await page.getByRole("button", { name: "Full-screen QR" }).click();
  await page.getByRole("dialog", { name: "QR code", exact: true }).waitFor();
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
  for (const [label, href] of [
    ["Instagram", "https://instagram.com/meyvor"],
    ["TikTok", "https://tiktok.com/@meyvor"],
    ["WhatsApp", "https://wa.me/31612345678"],
    ["Spotify", "https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb"],
    ["YouTube", "https://youtube.com/@setuvara"],
    ["My site", "https://example.com/"],
  ]) assert.equal(await anonPage.getByRole("link", { name: new RegExp(label) }).getAttribute("href"), href, `${label} public destination must be normalized and safe`);
  if (imageSaved) {
    const publicImage = anonPage.getByRole("img", { name: "Aanya Rao" });
    await publicImage.waitFor();
    await publicImage.evaluate((img) => new Promise((resolve) => {
      if (img.complete) return resolve(img.naturalWidth > 0);
      img.addEventListener("load", () => resolve(img.naturalWidth > 0), { once: true });
      img.addEventListener("error", () => resolve(false), { once: true });
    })).then((loaded) => assert.equal(loaded, true, "Published renderer must load the signed profile image"));
    const mediaClient = (await authenticatedClient(owner)).client;
    const publicUrl = mediaClient.storage.from("profile-media").getPublicUrl(imagePath).data.publicUrl;
    const directPublicRead = await anonContext.request.get(publicUrl);
    assert(!directPublicRead.ok(), "Private profile-media must not be available through the public object URL");
    await mediaClient.auth.signOut();
  }
  await anonPage.route("https://images.example.test/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: png }));
  const publicContentImage = anonPage.locator('img[alt="A candid Setuvara E2E image"]');
  await publicContentImage.waitFor();
  assert.match(await publicContentImage.getAttribute("src"), /storage\/v1\/object\/sign\/profile-media\//, "Published public Image block must receive an authorized signed image URL");
  const publicFeature = anonPage.locator(`a[href="https://example.com/setuvara-feature"]`);
  await publicFeature.locator("img").waitFor();
  assert.match(await publicFeature.locator("img").getAttribute("src"), /storage\/v1\/object\/sign\/profile-media\//, "Custom Featured Link image must render ahead of its metadata image publicly");

  await openSection(page, "Links");
  let featureEditorRow = page.locator("li").filter({ hasText: "Setuvara E2E Feature" });
  await featureEditorRow.getByRole("button").nth(1).click();
  let featureEditDialog = page.getByRole("dialog").last();
  await featureEditDialog.getByRole("button", { name: "Replace image", exact: true }).click();
  await featureEditDialog.getByLabel("Upload featured link image").setInputFiles({ name: "featured-replacement.jpg", mimeType: "image/jpeg", buffer: mediaFormats.jpeg });
  await featureEditDialog.getByText("Image ready").waitFor();
  await featureEditDialog.getByRole("button", { name: "Save", exact: true }).click();
  await featureEditDialog.waitFor({ state: "detached" });
  await waitSaved(page);
  const featureOwner = await authenticatedClient(owner);
  const replacedFeature = await featureOwner.client.from("profile_blocks").select("data").eq("id", featureBlockId).single();
  assert.ifError(replacedFeature.error);
  const replacementFeatureImagePath = replacedFeature.data.data.image_path;
  assert(replacementFeatureImagePath && replacementFeatureImagePath !== featureImagePath, "Featured Link replacement must save a fresh object path");
  const removedFeatureUpload = await featureOwner.client.storage.from("profile-media").download(featureImagePath);
  assert(removedFeatureUpload.error, "Replacing a Featured Link image must remove the unreferenced previous upload");
  await featureOwner.client.auth.signOut();
  await anonPage.reload();
  await anonPage.locator(`a[href="https://example.com/setuvara-feature"] img`).waitFor();
  assert.match(await anonPage.locator(`a[href="https://example.com/setuvara-feature"] img`).getAttribute("src"), /storage\/v1\/object\/sign\/profile-media\//, "Replacement Featured Link image should be public");

  featureEditorRow = page.locator("li").filter({ hasText: "Setuvara E2E Feature" });
  await featureEditorRow.getByRole("button").nth(1).click();
  featureEditDialog = page.getByRole("dialog").last();
  await featureEditDialog.getByRole("button", { name: "Remove uploaded image", exact: true }).click();
  assert.equal(await featureEditDialog.locator("img").last().getAttribute("src"), featureFallbackUrl, "Removing a custom image must reveal the retained link-preview image in the editor");
  await featureEditDialog.getByRole("button", { name: "Save", exact: true }).click();
  await featureEditDialog.waitFor({ state: "detached" });
  await waitSaved(page);
  const fallbackOwner = await authenticatedClient(owner);
  const fallbackFeature = await fallbackOwner.client.from("profile_blocks").select("data").eq("id", featureBlockId).single();
  assert.ifError(fallbackFeature.error);
  assert.equal(fallbackFeature.data.data.image_path, null, "Removing custom media should clear only its object path");
  assert.equal(fallbackFeature.data.data.image, featureFallbackUrl, "Removing custom media must preserve the fetched preview image");
  const removedReplacement = await fallbackOwner.client.storage.from("profile-media").download(replacementFeatureImagePath);
  assert(removedReplacement.error, "Removing custom Featured Link media must clean the unreferenced upload");
  await fallbackOwner.client.auth.signOut();
  await anonPage.reload();
  const fallbackPublicImage = anonPage.locator(`a[href="https://example.com/setuvara-feature"] img`);
  await fallbackPublicImage.waitFor();
  assert.equal(await fallbackPublicImage.getAttribute("src"), featureFallbackUrl, "Public Feature should fall back to the retained link-preview image");

  await page.getByRole("switch", { name: "Hide Image", exact: true }).click();
  await waitSaved(page);
  await anonPage.reload();
  assert.equal(await anonPage.locator('img[alt="A candid Setuvara E2E image"]').count(), 0, "Hidden Image blocks must not render publicly");
  const anonymousStorage = localUserClient();
  const hiddenImageSigning = await anonymousStorage.storage.from("profile-media").createSignedUrl(contentImagePath, 60);
  assert(hiddenImageSigning.error, "Anonymous visitors must not sign hidden Image block storage paths");
  await page.getByRole("switch", { name: "Show Image", exact: true }).click();
  await waitSaved(page);
  await anonPage.reload();
  await anonPage.locator('img[alt="A candid Setuvara E2E image"]').waitFor();
  console.log("PASS public Image/Featured Link rendering, custom-image priority, replace/remove cleanup, metadata fallback, and block visibility");
  await anonPage.getByRole("link", { name: "Slush connections" }).waitFor({ state: "detached" });
  const eventResponse = await anonPage.goto(`${appUrl}/${owner.username}?mode=event`);
  assert.equal(eventResponse?.status(), 200);
  assert.equal(await anonPage.locator('img[alt="A candid Setuvara E2E image"]').count(), 0, "Personal Mode content images must not appear in Event Mode");
  await anonPage.getByText("Slush", { exact: true }).waitFor();
  await anonPage.getByText("Product designers and early-stage operators.", { exact: true }).waitFor();
  await anonPage.getByRole("link", { name: "Slush connections" }).waitFor();
  assert.equal(await anonPage.getByRole("link", { name: /LinkedIn/ }).getAttribute("href"), "https://linkedin.com/in/michel-pronk");
  assert.equal(await anonPage.getByRole("link", { name: /Event X/ }).getAttribute("href"), "https://x.com/slushdotorg");
  assert.equal(await anonPage.getByRole("link", { name: /Schedule/ }).getAttribute("href"), "https://slush.org/schedule");
  await anonPage.getByRole("link", { name: "Portfolio work" }).waitFor({ state: "detached" });
  const businessResponse = await anonPage.goto(`${appUrl}/${owner.username}?mode=business`);
  assert.equal(businessResponse?.status(), 200);
  await anonPage.getByText("Head of Sales · Lumen Labs · Berlin", { exact: true }).waitFor();
  await anonPage.getByRole("link", { name: "Book an intro" }).waitFor();
  assert.equal(await anonPage.getByRole("link", { name: /Book an intro/ }).getAttribute("href"), "https://calendly.com/michel");
  assert.equal(await anonPage.getByRole("link", { name: /GitHub/ }).getAttribute("href"), "https://github.com/octocat");
  assert.equal(await anonPage.locator('a[href="mailto:sales@northlight.example"]').count(), 1, "Public Business Mode should render a validated mailto action");
  assert.equal(await anonPage.locator('a[href="tel:+493012345678"]').count(), 1, "Public Business Mode should render a validated phone action");
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
  await page.getByRole("switch", { name: "Hide Portfolio work" }).click();
  await waitSaved(page);
  await anonPage.goto(`${appUrl}/${owner.username}?mode=personal`);
  await anonPage.getByRole("link", { name: "Portfolio work" }).waitFor({ state: "detached" });
  await page.getByRole("switch", { name: "Show Portfolio work" }).waitFor();
  await page.getByRole("switch", { name: "Show Portfolio work" }).click();
  await waitSaved(page);
  await anonPage.reload();
  await anonPage.getByRole("link", { name: "Portfolio work" }).waitFor();
  console.log("PASS link visibility is persisted and respected by anonymous public reads");

  await openSection(page, "Mode settings");
  await page.getByRole("switch", { name: "Setuvara public", exact: true }).click();
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
  assert.equal(linksResult.data.length, 21, "All Personal/Event/Business provider links must persist");
  modeIds = modesResult.data.map((mode) => mode.id);
  linkIds = linksResult.data.map((link) => link.id);
  imagePath = (await ownerClient.from("profile_modes").select("image_path").eq("profile_id", ownerId).eq("slug", "personal").single()).data.image_path;
  await ownerClient.auth.signOut();

  await page.goto(`${appUrl}/app`);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(`${appUrl}/login`);
  assert([307, 308].includes((await ownerBrowser.context.request.get(`${appUrl}/app`, { maxRedirects: 0 })).status()));
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(`${appUrl}/app/identity`);
  await page.getByRole("tab", { name: /^Event/ }).filter({ visible: true }).click();
  await openSection(page, "Profile");
  await page.getByLabel("Event name").waitFor();
  await page.getByLabel("Event name").inputValue().then((value) => assert.equal(value, "Slush"));
  await page.getByRole("tab", { name: /^Business/ }).filter({ visible: true }).click();
  await page.getByLabel("Company").waitFor();
  await page.getByLabel("Company").inputValue().then((value) => assert.equal(value, "Lumen Labs"));
  const countryFixture = await authenticatedClient(owner);
  const countryMode = await countryFixture.client.from("profile_modes").select("id,settings").eq("profile_id", countryFixture.user.id).eq("slug", "event").single();
  assert.ifError((await countryFixture.client.from("profile_modes").update({ settings: { ...countryMode.data.settings, countryCode: "FI" } }).eq("id", countryMode.data.id)).error);
  await countryFixture.client.auth.signOut();
  console.log("PASS logout, protected app redirect, login, and persisted Mode data");

  otherBrowser = await signUpAndConfirm(browser, other);
  await testIsolation(owner, other, ownerId, modeIds, linkIds, imagePath, [contentImageBlockId, featureBlockId], contentImagePath);
  const ownerAuth = await authenticatedClient(owner);
  const otherPage = otherBrowser.page;
  await setMode(otherPage, "business");
  await openSection(otherPage, "Profile");
  await otherPage.getByLabel("Role").fill("Product Designer");
  await otherPage.getByLabel("Company").fill("Lumen Labs");
  await otherPage.getByLabel("City").fill("Berlin");
  await otherPage.keyboard.press("Control+s");
  await waitSaved(otherPage);
  await otherPage.getByRole("button", { name: "Publish", exact: true }).click();
  await waitEditorMessage(otherPage, "Your profile is live");
  const otherAuth = await authenticatedClient(other);
  const otherId = otherAuth.user.id;
  const otherPhotoPath = `${otherId}/${crypto.randomUUID()}.png`;
  const otherPhotoUpload = await otherAuth.client.storage.from("profile-media").upload(otherPhotoPath, png, { contentType: "image/png", upsert: false });
  assert.ifError(otherPhotoUpload.error, "Account 2 can upload its own connection-photo fixture");
  const otherPersonalMode = await otherAuth.client.from("profile_modes").update({ image_path: otherPhotoPath }).eq("profile_id", otherId).eq("slug", "personal").select("id").single();
  assert.ifError(otherPersonalMode.error, "Account 2 can attach its own photo to Personal Mode");

  // A registered visitor connects with their own selected share-back Mode.
  await otherPage.goto(`${appUrl}/${owner.username}?mode=event&source=qr`);
  await otherPage.getByRole("button", { name: /^Connect(?: at .+)?$/ }).click();
  await otherPage.getByRole("button", { name: "Business", exact: true }).click();
  await otherPage.getByRole("button", { name: "Connect", exact: true }).last().click();
  await waitForConnected(otherPage, "registered account 2 to account 1");
  const registeredDetailHref = await otherPage.getByRole("link", { name: "View connection" }).getAttribute("href");
  assert.match(registeredDetailHref ?? "", /^\/app\/connections\/[0-9a-f-]+$/i);
  await otherPage.goto(`${appUrl}/app/connections`);
  await otherPage.getByRole("link", { name: /Aanya Rao/ }).waitFor();
  const otherConnection = (await otherAuth.client.from("connections").select("id").eq("id", registeredDetailHref?.split("/").at(-1) ?? "").single()).data;
  assert(otherConnection, "Account 2 should see the registered relationship it created");
  const ownerConnectionId = registeredDetailHref?.split("/").at(-1) ?? "";
  const ownerConnectionRow = otherPage.locator(`a[href="/app/connections/${ownerConnectionId}"]`);
  const ownerConnectionPhoto = ownerConnectionRow.locator("img");
  await ownerConnectionPhoto.waitFor();
  assert.equal(await ownerConnectionPhoto.evaluate((img) => img.complete && img.naturalWidth > 0), true, "Connections list should show the registered counterpart's published profile photo");
  assert((await ownerConnectionPhoto.getAttribute("src"))?.includes(`/profile-media/${ownerId}/`), "Connection avatar must resolve the counterpart's image, not the viewer's image");
  await otherPage.goto(`${appUrl}/app`);
  const homeConnectionRow = otherPage.locator(`a[href="/app/connections/${ownerConnectionId}"]`);
  await homeConnectionRow.waitFor();
  const homeConnectionPhoto = homeConnectionRow.locator("img");
  await homeConnectionPhoto.waitFor({ state: "attached" });
  await homeConnectionPhoto.scrollIntoViewIfNeeded();
  await homeConnectionPhoto.evaluate((img) => img.decode());
  assert.equal(await homeConnectionPhoto.evaluate((img) => img.complete && img.naturalWidth > 0), true, "Home People avatar should load the counterpart's published profile photo");
  assert((await homeConnectionPhoto.getAttribute("src"))?.includes(`/profile-media/${ownerId}/`), "Home People avatar must resolve the registered counterpart's image");
  await otherPage.goto(`${appUrl}${registeredDetailHref}`);
  await otherPage.getByRole("heading", { name: "Aanya Rao", exact: true }).waitFor();
  await otherPage.getByText("Founder · Northlight", { exact: true }).waitFor();
  await otherPage.getByText("Helsinki", { exact: true }).first().waitFor();
  assert.equal(await otherPage.getByText("Helsinki", { exact: true }).count(), 2, "Current Event location and historical meeting city should both remain visible");
  await otherPage.getByText("Product designers and early-stage operators.", { exact: true }).waitFor();
  await otherPage.getByRole("link", { name: `@${owner.username}`, exact: true }).waitFor();
  const eventModePhoto = otherPage.locator('img[alt="Aanya Rao · Event Mode"]');
  await eventModePhoto.waitFor();
  assert.equal(await eventModePhoto.evaluate((img) => img.complete && img.naturalWidth > 0), true, "Event identity should fall back to the published Personal Mode photo");
  assert((await eventModePhoto.getAttribute("src"))?.includes(`/${imagePath}`), "Event Mode without its own image should use the counterpart's Personal photo");
  const ownerEventPhotoPath = `${ownerId}/${crypto.randomUUID()}.png`;
  assert.ifError((await ownerAuth.client.storage.from("profile-media").upload(ownerEventPhotoPath, png, { contentType: "image/png", upsert: false })).error);
  assert.ifError((await ownerAuth.client.from("profile_modes").update({ image_path: ownerEventPhotoPath }).eq("profile_id", ownerId).eq("slug", "event")).error);
  await otherPage.reload();
  const eventSpecificPhoto = otherPage.locator('img[alt="Aanya Rao · Event Mode"]');
  await eventSpecificPhoto.waitFor();
  assert((await eventSpecificPhoto.getAttribute("src"))?.includes(`/${ownerEventPhotoPath}`), "Event Mode's own image should take precedence over Personal fallback");
  await mkdir(".next/home-qa", { recursive: true });
  await otherPage.screenshot({ path: ".next/home-qa/connection-detail-event-photo.png", fullPage: true });

  const historicalName = await ownerAuth.client.from("connections").select("user_display_name_snapshot").eq("id", ownerConnectionId).single();
  assert.ifError(historicalName.error);
  assert.equal(historicalName.data.user_display_name_snapshot, "Aanya Rao");
  const temporaryUsername = `e2e_${suffix.slice(-10)}`;
  const rename = await ownerAuth.client.from("profiles").update({ display_name: "Aanya Rao Current", username: temporaryUsername }).eq("id", ownerId).select("id").single();
  assert.ifError(rename.error);
  await otherPage.goto(`${appUrl}/app/connections/${ownerConnectionId}`);
  await otherPage.getByRole("heading", { name: "Aanya Rao Current", exact: true }).waitFor();
  await otherPage.getByRole("link", { name: `@${temporaryUsername}`, exact: true }).waitFor();
  await otherPage.getByText("Slush", { exact: true }).waitFor();
  await otherPage.getByText("Founder · Northlight", { exact: true }).waitFor();
  const restoredName = await ownerAuth.client.from("profiles").update({ display_name: "Aanya Rao", username: owner.username }).eq("id", ownerId).select("id").single();
  assert.ifError(restoredName.error);

  await page.goto(`${appUrl}/app/connections/${ownerConnectionId}`);
  await page.getByText("Product Designer · Lumen Labs", { exact: true }).waitFor();
  await page.getByText("Berlin", { exact: true }).waitFor();
  const otherCounterpartPhoto = page.locator("section img");
  await otherCounterpartPhoto.waitFor();
  assert.equal(await otherCounterpartPhoto.evaluate((img) => img.complete && img.naturalWidth > 0), true, "Connection detail should show the registered counterpart's published Personal photo when the shared Business Mode has none");
  assert((await otherCounterpartPhoto.getAttribute("src"))?.includes(`/${otherPhotoPath}`), "Connection detail must fall back to the counterpart's Personal image, not the viewer's image");
  const otherBusinessPhotoPath = `${otherId}/${crypto.randomUUID()}.png`;
  assert.ifError((await otherAuth.client.storage.from("profile-media").upload(otherBusinessPhotoPath, png, { contentType: "image/png", upsert: false })).error);
  assert.ifError((await otherAuth.client.from("profile_modes").update({ image_path: otherBusinessPhotoPath }).eq("profile_id", otherId).eq("slug", "business")).error);
  await page.reload();
  const businessSpecificPhoto = page.locator("section img");
  await businessSpecificPhoto.waitFor();
  assert((await businessSpecificPhoto.getAttribute("src"))?.includes(`/${otherBusinessPhotoPath}`), "Business Mode's own image should take precedence over Personal fallback");

  // The reverse direction must reuse the same symmetric edge and append an encounter.
  await page.goto(`${appUrl}/${other.username}?mode=personal&source=link`);
  await page.getByRole("button", { name: "Connect again", exact: true }).click();
  await page.getByRole("button", { name: "Personal", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).last().click();
  await waitForConnected(page, "registered account 1 to account 2");
  await otherPage.goto(`${appUrl}/app/connections/${ownerConnectionId}`);
  await otherPage.getByRole("heading", { name: "Aanya Rao", exact: true }).waitFor();
  await otherPage.getByText("One person, three thoughtful contexts.", { exact: true }).waitFor();
  await otherPage.locator('img[alt="Aanya Rao · Personal Mode"]').waitFor();
  await otherPage.goto(`${appUrl}/${owner.username}?mode=business&source=profile`);
  await otherPage.getByRole("button", { name: "Connect again", exact: true }).click();
  await otherPage.getByRole("button", { name: "Business", exact: true }).click();
  await otherPage.getByRole("button", { name: "Connect", exact: true }).last().click();
  await waitForConnected(otherPage, "registered account 2 sharing Business Mode");
  await otherPage.goto(`${appUrl}/app/connections/${ownerConnectionId}`);
  await otherPage.getByText("Head of Sales · Lumen Labs", { exact: true }).waitFor();
  await otherPage.getByText("Berlin", { exact: true }).waitFor();
  await otherPage.getByText("We help teams build durable customer relationships.", { exact: true }).waitFor();
  const disabledBusiness = await ownerAuth.client.from("profile_modes").update({ is_enabled: false }).eq("profile_id", ownerId).eq("slug", "business");
  assert.ifError(disabledBusiness.error);
  await otherPage.goto(`${appUrl}/app/connections/${ownerConnectionId}`);
  await otherPage.getByRole("heading", { name: "Aanya Rao", exact: true }).waitFor();
  await otherPage.getByText("Head of Sales · Lumen Labs", { exact: true }).waitFor();
  await otherPage.getByText("Slush", { exact: true }).waitFor();
  const enabledBusiness = await ownerAuth.client.from("profile_modes").update({ is_enabled: true }).eq("profile_id", ownerId).eq("slug", "business");
  assert.ifError(enabledBusiness.error);
  const { data: symmetricConnections, error: symmetricError } = await ownerAuth.client.from("connections").select("id")
    .or(`and(user_id.eq.${ownerId},connected_user_id.eq.${otherId}),and(user_id.eq.${otherId},connected_user_id.eq.${ownerId})`);
  assert.ifError(symmetricError);
  assert.equal(symmetricConnections?.length, 1, "The registered pair must have exactly one symmetric Connection");
  assert.equal(symmetricConnections?.[0].id, ownerConnectionId);
  const { data: registeredEncounters, error: registeredEncounterError } = await ownerAuth.client.from("connection_encounters").select("id,shared_mode_slug,event_name,city")
    .eq("connection_id", ownerConnectionId).order("created_at");
  assert.ifError(registeredEncounterError);
  assert.equal(registeredEncounters?.length, 3, "Repeated connects should append Encounters to the existing Connection");
  assert.equal(registeredEncounters?.[0].event_name, "Slush", "Encounter keeps the originally shared Event snapshot");
  assert.deepEqual(registeredEncounters?.map((item) => item.shared_mode_slug), ["event", "personal", "business"], "Connection history must preserve each shared Mode");

  const ownerNote = await ownerAuth.client.from("connection_notes").upsert({ connection_id: ownerConnectionId, user_id: ownerId, note: "Private Setuvara E2E note" }, { onConflict: "connection_id,user_id" });
  assert.ifError(ownerNote.error);
  const otherCannotReadNote = await otherAuth.client.from("connection_notes").select("note").eq("connection_id", ownerConnectionId).eq("user_id", ownerId);
  assert.ifError(otherCannotReadNote.error);
  assert.equal(otherCannotReadNote.data?.length, 0, "The other participant cannot read a private note");
  const otherCannotDeleteEdge = await otherAuth.client.from("connections").delete().eq("id", ownerConnectionId).select("id");
  assert(otherCannotDeleteEdge.error || otherCannotDeleteEdge.data?.length === 0, "A participant cannot delete a Connection through Data API");
  const otherCannotEditEdge = await otherAuth.client.from("connections").update({ user_display_name_snapshot: "Unauthorized" }).eq("id", ownerConnectionId).select("id");
  assert(otherCannotEditEdge.error || otherCannotEditEdge.data?.length === 0, "A participant cannot rewrite Connection snapshots through Data API");
  const otherCannotEditEncounter = await otherAuth.client.from("connection_encounters").update({ event_name: "Unauthorized" }).eq("id", registeredEncounters[0].id).select("id");
  assert(otherCannotEditEncounter.error || otherCannotEditEncounter.data?.length === 0, "A participant cannot rewrite Encounter snapshots through Data API");
  assert.ifError((await ownerAuth.client.from("encounter_context").upsert({ encounter_id: registeredEncounters[0].id, user_id: ownerId, city: "Helsinki", venue: "Messukeskus", event_label: "Slush" }, { onConflict: "encounter_id,user_id" })).error);
  const otherCannotReadContext = await otherAuth.client.from("encounter_context").select("city,venue,event_label").eq("encounter_id", registeredEncounters[0].id).eq("user_id", ownerId);
  assert.ifError(otherCannotReadContext.error);
  assert.equal(otherCannotReadContext.data?.length, 0, "Where You Met context is private to its author");
  await otherPage.goto(`${appUrl}/app/connections/${ownerConnectionId}`);
  await otherPage.getByLabel("A thought to remember").waitFor();
  assert.equal(await otherPage.getByLabel("A thought to remember").inputValue(), "", "Another participant must not see the owner's private note");
  assert.equal((await otherPage.locator("body").innerText()).includes("Messukeskus"), false, "Another participant must not see the owner's private Where You Met override");
  await page.goto(`${appUrl}/app/connections/${ownerConnectionId}`);
  await page.getByText(/Messukeskus/).waitFor();
  await page.goto(`${appUrl}/app/connections`);
  const search = page.getByRole("searchbox", { name: "Search connections" });
  for (const term of ["Slush", "Helsinki", "Messukeskus", "Lumen Labs"]) {
    await search.fill(term);
    await page.locator(`a[href="/app/connections/${ownerConnectionId}"]`).waitFor();
    assert.equal(await page.locator(`a[href="/app/connections/${ownerConnectionId}"]`).count(), 1, `Search should include the connection by ${term}`);
  }
  await search.fill("");
  const anonymous = localUserClient();
  const anonymousConnections = await anonymous.from("connections").select("id");
  assert(anonymousConnections.error, "Anonymous clients cannot read Connections directly");
  const anonymousNotes = await anonymous.from("connection_notes").select("note");
  assert(anonymousNotes.error, "Anonymous clients cannot read private notes");
  console.log("PASS registered connects, symmetric edge reuse, Encounter snapshots, private notes/context, and Data API isolation");

  // Guest identity uses a random HttpOnly cookie; the email is never returned by guest RPCs.
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guestPage = await guestContext.newPage();
  await guestPage.goto(`${appUrl}/${owner.username}?mode=event&source=qr`);
  await guestPage.getByRole("button", { name: /^Connect(?: at .+)?$/ }).click();
  await guestPage.getByLabel("Name").fill("E2E Guest");
  await guestPage.getByLabel("Email").fill(guestClaim.email);
  await guestPage.getByRole("button", { name: "Connect", exact: true }).last().click();
  await waitForConnected(guestPage, "guest to account 1");
  const guestDetailHref = await guestPage.getByRole("link", { name: "View connection" }).getAttribute("href");
  assert.match(guestDetailHref ?? "", /^\/connections\/[0-9a-f-]+$/i);
  const guestToken = (await guestContext.cookies(appUrl)).find((cookie) => cookie.name === "sv-guest-session");
  assert(guestToken && guestToken.httpOnly, "Guest session must be opaque and HttpOnly");
  const guestStatus = await anonymous.rpc("get_guest_session_status", { p_session_token: guestToken.value });
  assert.ifError(guestStatus.error);
  assert.deepEqual(guestStatus.data, { display_name: "E2E Guest" }, "Guest status must not return the private email");
  await guestPage.goto(`${appUrl}${guestDetailHref}`);
  await guestPage.getByText("Connected with Aanya Rao").waitFor();
  assert((await guestPage.locator("body").innerText()).includes("Claim your Setuvara"));
  await guestPage.goto(`${appUrl}/${other.username}?mode=business`);
  await guestPage.getByRole("button", { name: /^Connect(?: at .+)?$/ }).click();
  await guestPage.getByText("Continue as E2E Guest").waitFor();
  await guestPage.getByRole("button", { name: "Connect", exact: true }).last().click();
  await waitForConnected(guestPage, "guest to account 2");
  const guestConnections = await anonymous.rpc("get_guest_session_status", { p_session_token: guestToken.value });
  assert.ifError(guestConnections.error);
  assert.deepEqual(guestConnections.data, { display_name: "E2E Guest" }, "Guest identity remains stable across profiles");
  await guestPage.goto(`${appUrl}${guestDetailHref}`);
  await guestPage.getByRole("link", { name: "Claim your Setuvara" }).click();
  const guestClaimBrowser = await signUpAndConfirm(browser, guestClaim, { width: 390, height: 844 }, guestContext, true);
  const guestClaimAuth = await authenticatedClient(guestClaim);
  const { data: claimedEdge, error: claimEdgeError } = await ownerAuth.client.from("connections").select("id,connected_user_id")
    .eq("user_id", ownerId).eq("connected_user_id", guestClaimAuth.user.id).maybeSingle();
  assert.ifError(claimEdgeError);
  assert(claimedEdge, "Verified signup should claim the guest edge as a registered relationship");
  await page.goto(`${appUrl}/app/connections/${claimedEdge.id}`);
  await page.getByRole("heading", { name: "E2E Guest", exact: true }).waitFor();
  await page.getByText("Slush", { exact: true }).waitFor();
  assert.equal(await page.locator("section img").count(), 0, "Claimed but unpublished guest identity should use its saved name without exposing a photo");
  const claimedEncounters = await ownerAuth.client.from("connection_encounters").select("id,shared_mode_slug,event_name")
    .eq("connection_id", claimedEdge.id).order("created_at");
  assert.ifError(claimedEncounters.error);
  assert.equal(claimedEncounters.data?.length, 1, "Guest claim must preserve the encounter with account 1");
  assert.equal(claimedEncounters.data?.find((encounter) => encounter.event_name)?.event_name, "Slush");
  const claimedOtherEdge = await otherAuth.client.from("connections").select("id,connected_user_id")
    .eq("user_id", otherId).eq("connected_user_id", guestClaimAuth.user.id).maybeSingle();
  assert.ifError(claimedOtherEdge.error);
  assert(claimedOtherEdge.data, "The guest session must claim its connection with the second profile too");
  const claimedOtherEncounters = await otherAuth.client.from("connection_encounters").select("id")
    .eq("connection_id", claimedOtherEdge.data.id);
  assert.ifError(claimedOtherEncounters.error);
  assert.equal(claimedOtherEncounters.data?.length, 1, "Guest claim must preserve the encounter with account 2");
  const thirdAccountCannotReadUnrelated = await guestClaimAuth.client.from("connections").select("id").eq("id", ownerConnectionId);
  assert.ifError(thirdAccountCannotReadUnrelated.error);
  assert.equal(thirdAccountCannotReadUnrelated.data?.length, 0, "Claimed guest account cannot read unrelated account 1–2 connection");
  await guestClaimBrowser.page.goto(`${appUrl}/app/connections/${ownerConnectionId}`);
  assert.equal(await guestClaimBrowser.page.getByLabel("A thought to remember").count(), 0, "An unrelated authenticated account cannot render another Connection's private controls");
  const unrelatedPageText = await guestClaimBrowser.page.locator("body").innerText();
  assert.equal(unrelatedPageText.includes("Aanya Rao"), false, "An unrelated authenticated account cannot render counterpart identity for another Connection");
  assert.equal(unrelatedPageText.includes("Private Setuvara E2E note"), false, "An unrelated authenticated account cannot render another user's private note");
  assert.equal((await guestPage.request.get(`${appUrl}${guestDetailHref}`)).status(), 404, "Revoked guest sessions cannot continue reading guest details");
  await guestClaimBrowser.page.goto(`${appUrl}/app/connections`);
  await guestClaimBrowser.page.getByRole("link", { name: /Aanya Rao/ }).waitFor();
  assert.equal(await guestClaimBrowser.page.locator('a[href^="/app/connections/"]').count(), 2, "Claimed guest should retain both profile Connections");
  const otherCannotClaim = await otherAuth.client.rpc("claim_guest_connections", { p_session_token: guestToken.value });
  assert(otherCannotClaim.error || otherCannotClaim.data?.claimed_connections === 0, "Another user cannot claim an unrelated guest session");
  await ownerAuth.client.auth.signOut();
  await otherAuth.client.auth.signOut();
  await guestClaimAuth.client.auth.signOut();
  await guestContext.close();
  console.log("PASS guest Connect, private email, HttpOnly session, confirmation claim, and Encounter preservation");
  console.log("PASS account 2 cannot change account 1 profile, Modes, links, media, notes, or Where You Met context");

  const progressionOwner = await authenticatedClient(owner);
  const otherPassport = await authenticatedClient(other);
  const otherPassportRead = await otherPassport.client.from("passport_milestones").select("threshold").eq("user_id", ownerId);
  assert.ifError(otherPassportRead.error);
  assert.equal(otherPassportRead.data.length, 0, "Account 2 cannot read account 1 milestone history");
  const otherStampRead = await otherPassport.client.from("passport_stamps").select("id").eq("user_id", ownerId);
  assert.ifError(otherStampRead.error);
  assert.equal(otherStampRead.data.length, 0, "Account 2 cannot read account 1 stamps");
  const otherRewardAttempt = await otherPassport.client.rpc("set_passport_reward", { p_category: "profile_treatment", p_reward_id: "editorial_profile" });
  assert(otherRewardAttempt.error, "Account 2 cannot claim account 1's reward");
  const otherPreferenceUpdate = await otherPassport.client.from("passport_preferences").update({ reward_id: "thousand_cover" }).eq("user_id", ownerId);
  assert(otherPreferenceUpdate.error, "Account 2 cannot change account 1's selected cosmetics");
  const anonPassportRead = await anonymous.from("passport_stamps").select("id");
  assert(anonPassportRead.error, "Anonymous visitors cannot enumerate Passport stamps");
  const lockedRewardAttempt = await progressionOwner.client.rpc("set_passport_reward", { p_category: "profile_treatment", p_reward_id: "editorial_profile" });
  assert(lockedRewardAttempt.error, "Locked rewards cannot be selected before the milestone");
  const directGrantAttempt = await progressionOwner.client.from("passport_entitlements").insert({ user_id: ownerId, reward_id: "thousand_mark" });
  assert(directGrantAttempt.error, "Normal clients cannot grant themselves rewards through Data API");

  async function addProgressionGuest(index) {
    const email = `e2e-progress-${suffix}-${index}@example.test`;
    progressionGuestEmails.push(email);
    const response = await fetch(`${appUrl}/api/connections`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: appUrl, "x-setuvara-request": "same-origin" },
      body: JSON.stringify({ username: owner.username, mode: "event", source: "qr", requestId: crypto.randomUUID(), displayName: `E2E Person ${index}`, email }),
    });
    assert.equal(response.status, 201, `Guest connection ${index} should be created through the normal Setuvara endpoint`);
    return response.json();
  }

  const initialPassport = (await progressionOwner.client.rpc("get_passport_overview")).data;
  let progressionCount = Number(initialPassport.connectionCount);
  assert(progressionCount < 25, "Fresh local owner should be below the 25 connection milestone");
  const createdProgressionConnections = [];
  for (let index = 1; progressionCount < 25; index += 1) {
    createdProgressionConnections.push(await addProgressionGuest(index));
    const current = (await progressionOwner.client.rpc("get_passport_overview")).data;
    progressionCount = Number(current.connectionCount);
  }
  assert.equal(progressionCount, 25, "Progression should count persistent unique Connections");
  const normalizedContexts = [
    { city: "Helsinki", event_label: "Slush" },
    { city: "helsinki", event_label: " slush " },
    { city: " HELSINKI ", event_label: "SLUSH" },
  ];
  for (const [index, context] of normalizedContexts.entries()) {
    const { error: contextError } = await progressionOwner.client.from("encounter_context").upsert({
      encounter_id: createdProgressionConnections[index].encounterId,
      user_id: ownerId,
      city: context.city,
      event_label: context.event_label,
      country_code: "FI",
    }, { onConflict: "encounter_id,user_id" });
    assert.ifError(contextError);
  }
  const passportAt25 = (await progressionOwner.client.rpc("get_passport_overview")).data;
  assert.deepEqual(passportAt25.milestones.map((item) => item.threshold), [5, 10, 25]);
  const expectedAt25 = ["first_circle_stamp", "paper_passport_cover", "signal_accent", "signal_share", "editorial_profile"];
  assert.deepEqual(passportAt25.rewards.map((item) => item.id).sort(), expectedAt25.sort(), "Milestone rewards compound at 5, 10, and 25");
  assert.equal(passportAt25.events, 1, "Repeated Slush encounters award one normalized Event stamp");
  assert.equal(passportAt25.cities, 1, "Repeated Helsinki encounters award one normalized City stamp");
  assert.equal(passportAt25.countries, 1, "Structured Finland country snapshot appears once");
  const slushStamps = await progressionOwner.client.from("passport_stamps").select("id").eq("user_id", ownerId).eq("stamp_type", "event").eq("context_key", "slush");
  const helsinkiStamps = await progressionOwner.client.from("passport_stamps").select("id").eq("user_id", ownerId).eq("stamp_type", "city").eq("context_key", "helsinki");
  assert.ifError(slushStamps.error); assert.ifError(helsinkiStamps.error);
  assert.equal(slushStamps.data.length, 1); assert.equal(helsinkiStamps.data.length, 1);
  assert.ifError((await progressionOwner.client.rpc("set_passport_reward", { p_category: "profile_treatment", p_reward_id: "editorial_profile" })).error);
  assert.ifError((await progressionOwner.client.rpc("set_passport_reward", { p_category: "share_treatment", p_reward_id: "signal_share" })).error);
  assert.ifError((await progressionOwner.client.rpc("set_passport_reward", { p_category: "passport_cover", p_reward_id: "paper_passport_cover" })).error);
  const lockedCentury = await progressionOwner.client.rpc("set_passport_reward", { p_category: "profile_treatment", p_reward_id: "century_profile" });
  assert(lockedCentury.error, "Higher milestone rewards remain locked");
  console.log("PASS unique connection milestones 5/10/25, compounding rewards, normalized Slush/Helsinki/Finland stamps, and entitlement checks");

  const countBeforeRepeats = (await progressionOwner.client.rpc("get_passport_overview")).data.connectionCount;
  for (let repeat = 0; repeat < 4; repeat += 1) {
    const { error: repeatError } = await progressionOwner.client.rpc("connect_registered", {
      p_target_username: other.username, p_target_mode: "event", p_share_back_mode: "personal",
      p_request_id: crypto.randomUUID(), p_source: "direct",
    });
    assert.ifError(repeatError);
  }
  assert.equal((await progressionOwner.client.rpc("get_passport_overview")).data.connectionCount, countBeforeRepeats, "Repeat encounters must not increase unique connection progress");

  for (let index = createdProgressionConnections.length + 1; progressionCount < 50; index += 1) {
    createdProgressionConnections.push(await addProgressionGuest(index));
    const current = (await progressionOwner.client.rpc("get_passport_overview")).data;
    progressionCount = Number(current.connectionCount);
  }
  const passportAt50 = (await progressionOwner.client.rpc("get_passport_overview")).data;
  assert.deepEqual(passportAt50.milestones.map((item) => item.threshold), [5, 10, 25, 50]);
  assert.ifError((await progressionOwner.client.rpc("set_passport_reward", { p_category: "qr_frame", p_reward_id: "coral_qr_frame" })).error);
  assert.ifError((await progressionOwner.client.rpc("set_passport_reward", { p_category: "profile_mark", p_reward_id: "signal_50_mark" })).error);
  const ownerPreferences = await progressionOwner.client.from("passport_preferences").select("category,reward_id").eq("user_id", ownerId);
  assert.ifError(ownerPreferences.error);
  const anonPreferences = await anonymous.from("passport_preferences").select("category,reward_id").eq("user_id", ownerId);
  assert.ifError(anonPreferences.error);
  assert(anonPreferences.data.every((item) => ["profile_treatment", "accent", "profile_mark"].includes(item.category)), "Anonymous reads expose only the explicitly selected public cosmetics");
  assert.equal(anonPreferences.data.find((item) => item.category === "profile_mark")?.reward_id, "signal_50_mark");
  await progressionOwner.client.auth.signOut();
  await otherPassport.client.auth.signOut();

  await page.goto(`${appUrl}/app/identity?mode=personal&section=appearance`);
  for (const threshold of [50, 25, 10, 5]) {
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await dialog.getByRole("heading", { name: `${threshold} connections.` }).waitFor();
    await dialog.getByRole("button", { name: "Keep going" }).click();
    await dialog.waitFor({ state: "detached" });
    await page.reload();
  }
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.getByRole("link", { name: "Passport", exact: true }).click();
  await page.getByRole("heading", { name: "Every connection stays in the story." }).waitFor();
  assert.equal(await page.getByText("50", { exact: true }).count() > 0, true);
  assert((await page.locator("main section").first().getAttribute("class"))?.includes("bg-[#e8e2d4]"), "Equipped Passport cover must change the Passport surface");
  await expectNoHorizontalOverflow(page, "Passport overview");
  await page.goto(`${appUrl}/app/identity?mode=personal&section=appearance`);
  await page.getByText("Equipped", { exact: true }).first().waitFor();
  await page.getByRole("tab", { name: /^Personal/ }).filter({ visible: true }).waitFor();
  await openSection(page, "Share");
  await page.getByLabel("QR frame").selectOption("coral_qr_frame");
  await page.locator("svg title").filter({ hasText: "Personal Mode QR code" }).waitFor({ state: "attached" });
  assert(await page.locator("svg").filter({ has: page.locator("title", { hasText: "Personal Mode QR code" }) }).evaluate((node) => node.parentElement?.className.toLowerCase().includes("outline-[#ff5a4f]") ?? false), "Earned QR frame must surround the scannable QR");
  await anonPage.goto(`${appUrl}/${owner.username}`);
  await anonPage.getByText("Signal 50", { exact: true }).waitFor();
  console.log("PASS 50 milestone unlock, repeat encounter idempotency, reward-equipped Identity/Share/QR, private Passport, and one-time celebration");

  for (const route of ["/", "/login", "/signup"]) assert.equal((await anonContext.request.get(`${appUrl}${route}`)).status(), 200, `${route} must remain a static app route`);
  assert.equal((await anonContext.request.get(`${appUrl}/api/health/supabase`)).status(), 200, "Supabase health API should remain available");
  const crossOriginConnect = await anonContext.request.post(`${appUrl}/api/connections`, {
    headers: { "content-type": "application/json", origin: "https://attacker.invalid", "x-setuvara-request": "same-origin" },
    data: {},
  });
  assert.equal(crossOriginConnect.status(), 403, "Connection API must reject a cross-origin request");
  const confirmationWithoutToken = await anonContext.request.get(`${appUrl}/auth/confirm`, { maxRedirects: 0 });
  assert([307, 308].includes(confirmationWithoutToken.status()));
  assert(confirmationWithoutToken.headers().location?.includes("/login?error=confirmation_failed"));
  const confirmationWithBadCode = await anonContext.request.get(`${appUrl}/auth/confirm?code=not-a-real-code&next=/app/identity`, { maxRedirects: 0 });
  assert([307, 308].includes(confirmationWithBadCode.status()), "An invalid PKCE confirmation code should redirect");
  assert(confirmationWithBadCode.headers().location?.includes("/login?error=confirmation_failed"), "An invalid PKCE confirmation code should show the confirmation error");
  const rootDefault = await anonPage.goto(`${appUrl}/${owner.username}`); assert.equal(rootDefault?.status(), 200);
  const rootPersonal = await anonPage.goto(`${appUrl}/${owner.username}?mode=personal`); assert.equal(rootPersonal?.status(), 200);
  const legacyDefault = await anonContext.request.get(`${appUrl}/u/${owner.username}`, { maxRedirects: 0 }); assert.equal(legacyDefault.status(), 308);
  for (const bad of ["not_a_real_setuvara_user", "bad%25name"]) assert.equal((await anonContext.request.get(`${appUrl}/${bad}`)).status(), 404);
  console.log("PASS static routes, /auth/confirm error, health API, root profile, invalid username, and legacy redirect");

  await mkdir(".next/home-qa", { recursive: true });
  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
    await testResponsiveAuth(browser, width, height);
    await page.setViewportSize({ width, height });
    await page.goto(`${appUrl}/app`);
    await page.getByRole("heading", { name: "Your Setuvara", exact: true }).waitFor();
    await expectNoHorizontalOverflow(page, `Setuvara Home ${width}x${height}`);
    await page.getByRole("link", { name: width < 768 ? "People" : "Connections", exact: true }).waitFor();
    await page.getByRole("link", { name: "Passport", exact: true }).waitFor();
    await page.goto(`${appUrl}/app/identity?mode=personal&section=profile`);
    await expectNoHorizontalOverflow(page, `Identity editor ${width}x${height}`);
    await openSection(page, "Links");
    const imageBlockRow = page.locator("li").filter({ hasText: "A candid image block" });
    await imageBlockRow.getByRole("button").nth(1).click();
    const imageBlockDialog = page.getByRole("dialog").last();
    const replaceImageButton = imageBlockDialog.getByRole("button", { name: "Replace image", exact: true });
    assert((await replaceImageButton.boundingBox())?.height >= 44, `Image upload control must be a usable tap target at ${width}px`);
    await imageBlockDialog.getByLabel("Upload profile image").waitFor();
    await expectNoHorizontalOverflow(page, `Image block editor ${width}x${height}`);
    await imageBlockDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await imageBlockDialog.waitFor({ state: "detached" });
    await openAddLink(page);
    const providerTrigger = page.getByRole("button", { name: "Choose a provider" });
    assert((await providerTrigger.boundingBox())?.height >= 44, `Provider picker trigger must be a usable tap target at ${width}px`);
    await providerTrigger.click();
    const providerDialog = page.getByRole("dialog", { name: "Choose a link" });
    const dialogBounds = await providerDialog.boundingBox();
    assert(dialogBounds && dialogBounds.width <= width, `Provider picker must fit the viewport at ${width}px`);
    await providerDialog.getByRole("textbox", { name: "Search links" }).fill("booking");
    await providerDialog.getByRole("button", { name: /Calendly/ }).waitFor();
    await expectNoHorizontalOverflow(page, `Provider picker ${width}x${height}`);
    await page.keyboard.press("Escape");
    await providerDialog.waitFor({ state: "detached" });
    // Escape can dismiss the containing Add sheet as well as its provider picker.
    const remainingSheet = page.getByRole("dialog");
    if (await remainingSheet.count()) await remainingSheet.getByRole("button", { name: "Close", exact: true }).click();
    await remainingSheet.waitFor({ state: "detached" });
    await openSection(page, "Profile");
    await page.getByRole("button", { name: /^(Preview|Full preview)$/ }).filter({ visible: true }).waitFor();
    await page.getByRole("button", { name: /^(Preview|Full preview)$/ }).filter({ visible: true }).click();
    await page.getByRole("dialog", { name: "Full-screen preview" }).getByRole("radio", { name: "Visitor", exact: true }).click();
    await expectNoHorizontalOverflow(page, `Editor preview ${width}x${height}`);
    await page.getByRole("button", { name: "Close preview" }).click();
    await page.screenshot({ path: `.next/home-qa/identity-${width}.png`, fullPage: true });
    const response = await anonPage.setViewportSize({ width, height }).then(() => anonPage.goto(`${appUrl}/${owner.username}?mode=personal`));
    assert.equal(response?.status(), 200);
    await expectNoHorizontalOverflow(anonPage, `Public profile ${width}x${height}`);
    await anonPage.screenshot({ path: `.next/home-qa/public-${width}.png`, fullPage: true });
    const connectButton = anonPage.getByRole("button", { name: "Connect", exact: true });
    const connectHeight = await connectButton.evaluate((element) => element.getBoundingClientRect().height);
    assert(connectHeight >= 44, `Public Connect control should be a usable tap target at ${width}px`);
    await connectButton.click();
    await expectNoHorizontalOverflow(anonPage, `Public Connect flow ${width}x${height}`);
    const publicInputFonts = await anonPage.locator('input[type="text"], input[type="email"]').evaluateAll((elements) => elements.map((input) => Number.parseFloat(getComputedStyle(input).fontSize)));
    assert(publicInputFonts.every((font) => font >= 16), `Connect form inputs should be mobile-safe at ${width}px`);
    await anonPage.getByRole("button", { name: "Close" }).click();
    await page.goto(`${appUrl}/app/connections`);
    await expectNoHorizontalOverflow(page, `Connections list ${width}x${height}`);
    await page.getByRole("searchbox", { name: "Search connections" }).fill("Setuvara E2E Identity");
    await page.getByRole("link", { name: /Setuvara E2E Identity/ }).waitFor();
    await page.screenshot({ path: `.next/home-qa/connections-${width}.png`, fullPage: true });
    await page.goto(`${appUrl}/app/connections/${ownerConnectionId}`);
    await expectNoHorizontalOverflow(page, `Connection detail ${width}x${height}`);
    await page.getByLabel("A thought to remember").waitFor();
    await page.screenshot({ path: `.next/home-qa/connection-detail-${width}.png`, fullPage: true });
    await otherPage.setViewportSize({ width, height });
    await otherPage.goto(`${appUrl}/app/connections/${ownerConnectionId}`);
    await otherPage.getByRole("heading", { name: "Aanya Rao", exact: true }).waitFor();
    await expectNoHorizontalOverflow(otherPage, `Connection counterpart detail ${width}x${height}`);
    await otherPage.screenshot({ path: `.next/home-qa/connection-counterpart-${width}.png`, fullPage: true });
    await page.goto(`${appUrl}/app/passport`);
    await page.getByRole("heading", { name: "Every connection stays in the story." }).waitFor();
    await page.getByRole("progressbar").waitFor();
    await expectNoHorizontalOverflow(page, `Passport ${width}x${height}`);
    await page.screenshot({ path: `.next/home-qa/passport-${width}.png`, fullPage: true });
  }
  console.log("PASS signup/login, editor, preview, Connections list/detail, public profile, and Connect flow at phone/tablet/desktop sizes");

  await validateHomeWithData({ page, browser, appUrl, owner, ownerId, authenticatedClient, localSql });
  await validateEmailNotifications(page, owner, other, ownerId);

  await page.goto(`${appUrl}/app/identity?mode=personal&section=links`);
  const imageBlockRow = page.locator("li").filter({ hasText: "A candid image block" });
  await imageBlockRow.getByRole("button").nth(1).click();
  const imageBlockDialog = page.getByRole("dialog").last();
  await imageBlockDialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByText("Image deleted", { exact: true }).waitFor();
  const imageCleanupClient = await authenticatedClient(owner);
  const deletedImageBlock = await imageCleanupClient.client.from("profile_blocks").select("id").eq("id", contentImageBlockId);
  assert.ifError(deletedImageBlock.error);
  assert.equal(deletedImageBlock.data.length, 0, "Deleting an Image block must remove its database row");
  const deletedImageAsset = await imageCleanupClient.client.storage.from("profile-media").download(contentImagePath);
  assert(deletedImageAsset.error, "Deleting an unreferenced Image block must remove its Storage object");
  await imageCleanupClient.client.auth.signOut();
  console.log("PASS deleted Image block cleanup and authenticated editor image controls at phone/tablet/desktop sizes");

  await ownerBrowser.context.close(); await otherBrowser.context.close(); await anonContext.close();
  console.log("E2E_LOCAL_RESULT=PASS");
} catch (error) {
  await ownerBrowser?.page.screenshot({ path: ".next/local-e2e-failure.png", fullPage: true }).catch(() => {});
  console.error(`E2E_LOCAL_RESULT=FAIL (${error instanceof Error ? error.stack ?? error.message : "unknown error"})`);
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
      const testUsers = (data.users ?? []).filter((candidate) => /^e2e-(owner|other|guest)-[a-z0-9]+@example\.test$/i.test(candidate.email ?? ""));
      const guestUsers = testUsers.filter((candidate) => candidate.email?.startsWith("e2e-guest-"));
      const guestEmails = [...guestUsers.map((candidate) => candidate.email).filter((email) => typeof email === "string"), ...progressionGuestEmails];
      const guestIdentities = guestUsers.length
        ? await cleanup.from("guest_identities").select("id").in("claimed_user_id", guestUsers.map((candidate) => candidate.id))
        : { data: [], error: null };
      const unclaimedGuests = guestEmails.length
        ? await cleanup.from("guest_identities").select("id").in("normalized_email", guestEmails).is("claimed_user_id", null)
        : { data: [], error: null };
      if (guestIdentities.error) throw guestIdentities.error;
      if (unclaimedGuests.error) throw unclaimedGuests.error;
      for (const user of testUsers) {
        const { data: objects, error: listError } = await cleanup.storage.from("profile-media").list(user.id, { limit: 1000 });
        if (listError) throw listError;
        if (objects?.length) {
          const { error: removeError } = await cleanup.storage.from("profile-media").remove(objects.map((object) => `${user.id}/${object.name}`));
          if (removeError) throw removeError;
        }
        const { error: deleteError } = await cleanup.auth.admin.deleteUser(user.id);
        if (deleteError) throw deleteError;
      }
      const guestIdentityIds = [...new Set([...(guestIdentities.data ?? []), ...(unclaimedGuests.data ?? [])].map((guest) => guest.id))];
      if (guestIdentityIds.length) {
        const { error: guestDeleteError } = await cleanup.from("guest_identities").delete().in("id", guestIdentityIds);
        if (guestDeleteError) throw guestDeleteError;
      }
    } catch (error) {
      console.warn(`Local E2E test-account cleanup needs attention: ${error instanceof Error ? error.message : "unknown cleanup error"}`);
    }
  }
}
