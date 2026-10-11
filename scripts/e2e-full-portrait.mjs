/** Run with E2E_LOCAL_SCRIPT=scripts/e2e-full-portrait.mjs and an image fixture path inside this repository. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import sharp from "sharp";

const root = process.cwd();
assert.equal(resolve(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim()), resolve(root));
const fixture = resolve(root, process.env.E2E_PORTRAIT_FIXTURE ?? "");
assert(!isAbsolute(relative(root, fixture)) && !relative(root, fixture).startsWith("..") && fixture !== root, "Image fixture must be inside Setuvara");
const photo = readFileSync(fixture);
assert(photo.length > 20_000, "Use a representative portrait photo fixture");
const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const localAdminKey = process.env.E2E_LOCAL_SERVICE_KEY;
assert(new URL(appUrl).hostname === "127.0.0.1" && new URL(mailpitUrl).hostname === "127.0.0.1" && new URL(supabaseUrl).hostname === "127.0.0.1");
assert(publishableKey && localAdminKey);
const suffix = `${Date.now().toString(36).slice(-6)}${randomBytes(3).toString("hex")}`;
const owner = { email: `e2e-portrait-${suffix}@example.test`, password: `${randomBytes(32).toString("base64url")}Aa1!`, username: `e2e_por_${suffix}` };
const other = { email: `e2e-portrait-other-${suffix}@example.test`, password: `${randomBytes(32).toString("base64url")}Bb2!`, username: `e2e_other_${suffix}` };
const admin = createClient(supabaseUrl, localAdminKey, { auth: { autoRefreshToken: false, persistSession: false } });
const userClient = () => createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
const sql = (query) => {
  const output = execFileSync(process.execPath, [resolve(root, "node_modules/supabase/dist/supabase.js"), "db", "query", "--local", "--output-format", "json", query], { encoding: "utf8" });
  return JSON.parse(output.slice(output.indexOf("{"))).rows;
};
const out = resolve(root, ".next/full-portrait");
mkdirSync(out, { recursive: true });

async function confirmationUrl(email) {
  for (let i = 0; i < 100; i++) {
    const messages = (await (await fetch(`${mailpitUrl}/api/v1/messages?limit=100`)).json()).messages ?? [];
    const message = messages.find((item) => JSON.stringify(item.To ?? item.to ?? []).toLowerCase().includes(email));
    if (message) {
      const detail = await (await fetch(`${mailpitUrl}/api/v1/message/${encodeURIComponent(message.ID ?? message.id)}`)).json();
      const body = `${detail.HTML ?? detail.html ?? ""}\n${detail.Text ?? detail.text ?? ""}`;
      const raw = body.match(/https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/i)?.[0];
      assert(raw, "Local confirmation email must link to /auth/confirm");
      const url = new URL(raw.replaceAll("&amp;", "&"));
      assert.equal(url.origin, appUrl);
      assert.equal(url.pathname, "/auth/confirm");
      return url.toString();
    }
    await new Promise((done) => setTimeout(done, 300));
  }
  throw new Error("Local confirmation email did not arrive");
}

async function signup(browser, account) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${appUrl}/signup`);
  await page.getByLabel("Username").fill(account.username);
  await page.getByText("Available. It’s yours if you want it.").waitFor();
  await page.getByRole("button", { name: `Claim @${account.username}` }).click();
  await page.getByLabel("Your name").fill("Aanya Rao");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Create my Setuvara" }).click();
  await page.getByRole("heading", { name: "Check your inbox." }).waitFor();
  await page.goto(await confirmationUrl(account.email));
  await page.waitForURL(`${appUrl}/app/identity`);
  const cookies = await context.cookies(appUrl);
  assert(cookies.some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")));
  const client = userClient();
  const { data, error } = await client.auth.signInWithPassword(account);
  assert.ifError(error);
  return { page, context, client, id: data.user.id };
}

async function noOverflow(page, label) {
  const result = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(result.scroll <= result.width + 1, `${label}: horizontal overflow ${result.scroll} > ${result.width}`);
}

async function openAppearance(page, language = "en") {
  await page.goto(`${appUrl}/app/identity?mode=personal&section=appearance`);
  if (page.viewportSize().width < 1024) await page.getByRole("tab", { name: language === "nl" ? "Indeling" : "Layout", exact: true }).click();
}

const activePreview = (page) => page.locator(page.viewportSize().width < 1024 ? '[data-appearance-editor="mobile"] [role="region"]' : '[data-preview-phone]');

async function publicPage(page, username, slug, status = 200) {
  const url = `${appUrl}/${username}${slug === "personal" ? "" : `?mode=${slug}`}`;
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), status, `${slug} public status`);
  if (status === 200) {
    await page.locator('[data-profile-layout="full-portrait"]').waitFor();
    if (await page.locator('img[data-photo-focus]').count()) await page.locator('img[data-photo-focus]').first().evaluate((image) => image.decode());
    assert.equal(await page.locator('[data-profile-layout="full-portrait"]').count(), 1);
    await page.getByRole("link", { name: `Portrait ${slug} link`, exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: `Hidden ${slug} link`, exact: true }).count(), 0);
  }
}

let browser;
let first;
let second;
let firstId;
let secondId;
const uploadedPaths = [];
try {
  browser = await chromium.launch({ headless: true });
  first = await signup(browser, owner);
  firstId = first.id;
  const { page, client } = first;
  const subscriptionId = `sub_portrait${suffix}`;
  sql(`insert into public.billing_subscriptions(dodo_subscription_id,user_id,dodo_customer_id,dodo_product_id,plan_code,billing_interval,provider_status,current_period_end,last_provider_event_id,last_provider_event_at,last_sync_started_at) values ('${subscriptionId}','${firstId}'::uuid,'cus_portrait${suffix}','pdt_portraitlocal','plus','monthly','active',now()+interval '30 days','portrait-e2e-${suffix}',now(),now()) returning plan_code;`);
  const { data: modes, error: modeError } = await client.from("profile_modes").select("id,slug,appearance,settings").eq("profile_id", firstId);
  assert.ifError(modeError);
  assert.equal(modes.length, 3);
  const imagePath = `${firstId}/${randomUUID()}.webp`;
  uploadedPaths.push(imagePath);
  assert.ifError((await client.storage.from("profile-media").upload(imagePath, photo, { contentType: "image/webp" })).error);
  assert.ifError((await client.from("profiles").update({ display_name: "Aanya Rao", bio: "Designer and builder", is_published: true }).eq("id", firstId)).error);
  for (const mode of modes) {
    const appearance = { ...mode.appearance, layout: "full-portrait", portraitZoom: 100, portraitNameSize: "standard", portraitShowUsername: true };
    const settings = mode.slug === "event" ? { ...mode.settings, eventName: "Slush", city: "Helsinki", dateLabel: "20–21 Nov 2026", role: "Founder", hereToMeet: "Product designers and founders" }
      : mode.slug === "business" ? { ...mode.settings, role: "Founder", company: "Northlight", city: "Berlin", description: "Building thoughtful products" }
        : { ...mode.settings, location: "Amsterdam" };
    assert.ifError((await client.from("profile_modes").update({ appearance, settings, image_path: imagePath, image_focus_x: 50, image_focus_y: 25, is_enabled: true }).eq("id", mode.id).eq("profile_id", firstId)).error);
    assert.ifError((await client.from("profile_links").insert([
      { profile_id: firstId, mode_id: mode.id, title: `Portrait ${mode.slug} link`, url: "https://example.test/portrait", link_type: "url", is_visible: true, sort_order: 0 },
      { profile_id: firstId, mode_id: mode.id, title: `Hidden ${mode.slug} link`, url: "https://example.test/private", link_type: "url", is_visible: false, sort_order: 1 },
    ])).error);
  }
  const personalMode = modes.find((mode) => mode.slug === "personal");
  for (const invalid of [{ portraitZoom: 150 }, { portraitNameSize: "giant" }, { portraitShowUsername: "false" }, { unexpected: true }]) {
    const result = await client.from("profile_modes").update({ appearance: { ...personalMode.appearance, layout: "full-portrait", ...invalid } }).eq("id", personalMode.id);
    assert.equal(result.error?.code, "23514", "database rejects invalid Full Portrait configuration");
  }
  const anon = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const visitor = await anon.newPage();

  await openAppearance(page);
  await page.getByRole("button", { name: /Full Portrait/ }).click();
  assert.equal(await activePreview(page).locator('[data-profile-layout="full-portrait"]').count(), 1, "editor uses shared renderer");
  await page.getByRole("button", { name: "Adjust crop and focus" }).click();
  await page.getByRole("dialog", { name: "Crop photo" }).waitFor();
  await page.getByRole("dialog", { name: "Crop photo" }).getByRole("button", { name: "Cancel" }).first().click();
  await page.screenshot({ path: resolve(out, "390-editor.png"), fullPage: true });
  await noOverflow(page, "390 editor");
  await page.getByRole("button", { name: "Save appearance", exact: true }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).first().click();
  await page.getByRole("dialog", { name: "Full-screen preview" }).waitFor();
  await page.screenshot({ path: resolve(out, "390-editor-preview.png"), fullPage: false });
  await page.getByRole("button", { name: "Close preview" }).click();
  await openAppearance(page);
  await publicPage(visitor, owner.username, "personal");
  await visitor.screenshot({ path: resolve(out, "390-default-visible.png"), fullPage: true });
  await noOverflow(visitor, "390 default");
  await page.getByRole("button", { name: "130%" }).click();
  await page.getByRole("button", { name: "Statement" }).click();
  await page.getByRole("switch", { name: "Show username" }).click();
  await page.waitForTimeout(950);
  await page.reload();
  if (page.viewportSize().width < 1024) await page.getByRole("tab", { name: "Layout", exact: true }).click();
  await page.getByRole("button", { name: "130%" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "130%" }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByRole("switch", { name: "Show username" }).getAttribute("aria-checked"), "false");
  await publicPage(visitor, owner.username, "personal");
  assert.equal(await visitor.locator('[data-portrait-zoom="130"]').count(), 1);
  assert.equal(await visitor.getByText(`@${owner.username}`).count(), 0);
  await visitor.screenshot({ path: resolve(out, "390-zoom-statement-hidden.png"), fullPage: true });
  await page.getByRole("switch", { name: "Show username" }).click();
  await page.waitForTimeout(950);
  await publicPage(visitor, owner.username, "personal");
  assert.equal(await visitor.getByText(`@${owner.username}`).count(), 1);
  await visitor.screenshot({ path: resolve(out, "390-zoom-visible.png"), fullPage: true });

  for (const [width, height] of [[320, 700], [430, 932], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]]) {
    await visitor.setViewportSize({ width, height });
    await publicPage(visitor, owner.username, "personal");
    await noOverflow(visitor, `${width} public`);
    await visitor.screenshot({ path: resolve(out, `${width}-public.png`), fullPage: true });
  }
  for (const [width, height] of [[768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await openAppearance(page);
    await page.getByRole("button", { name: /Full Portrait/ }).waitFor();
    await noOverflow(page, `${width} editor`);
    await page.screenshot({ path: resolve(out, `${width}-editor.png`), fullPage: true });
  }
  await visitor.setViewportSize({ width: 390, height: 844 });
  await publicPage(visitor, owner.username, "personal");
  for (const [label, amount] of [["bright", 1.75], ["dark", 0.55]]) {
    await visitor.locator('img[data-photo-focus]').evaluateAll((images, brightness) => images.forEach((image) => { image.style.filter = `${image.className.includes("blur") ? "blur(16px) " : ""}brightness(${brightness})`; }), amount);
    await visitor.screenshot({ path: resolve(out, `390-${label}-photo.png`), fullPage: true });
  }
  for (const [shape, width, height] of [["wide", 1200, 500], ["tall", 500, 1200]]) {
    const variantPath = `${firstId}/${randomUUID()}.webp`;
    const variant = await sharp(photo).resize(width, height, { fit: "cover", position: shape === "wide" ? "north" : "centre" }).webp({ quality: 82 }).toBuffer();
    assert.ifError((await client.storage.from("profile-media").upload(variantPath, variant, { contentType: "image/webp" })).error);
    uploadedPaths.push(variantPath);
    assert.ifError((await client.from("profile_modes").update({ image_path: variantPath }).eq("id", personalMode.id)).error);
    await publicPage(visitor, owner.username, "personal");
    await noOverflow(visitor, `${shape} photo`);
    await visitor.screenshot({ path: resolve(out, `390-${shape}-photo.png`), fullPage: true });
  }
  assert.ifError((await client.from("profile_modes").update({ image_path: imagePath }).eq("id", personalMode.id)).error);
  assert.ifError((await client.from("profile_modes").update({ settings: { ...personalMode.settings, location: "" } }).eq("id", personalMode.id)).error);
  await publicPage(visitor, owner.username, "personal");
  await noOverflow(visitor, "no location");
  await visitor.screenshot({ path: resolve(out, "390-no-location.png"), fullPage: true });
  assert.ifError((await client.from("profile_modes").update({ settings: { ...personalMode.settings, location: "Amsterdam" } }).eq("id", personalMode.id)).error);
  for (const slug of ["event", "business"]) {
    await publicPage(visitor, owner.username, slug);
    await visitor.screenshot({ path: resolve(out, `390-${slug}.png`), fullPage: true });
    await noOverflow(visitor, `${slug} portrait`);
  }
  const businessMode = modes.find((mode) => mode.slug === "business");
  assert.ifError((await client.from("profile_modes").update({ settings: { ...businessMode.settings, role: "Head of international product design and partnerships" } }).eq("id", businessMode.id)).error);
  await publicPage(visitor, owner.username, "business");
  await noOverflow(visitor, "long business role");
  await visitor.screenshot({ path: resolve(out, "390-long-role.png"), fullPage: true });
  assert.ifError((await client.from("profile_modes").update({ image_path: null }).eq("profile_id", firstId).eq("slug", "event")).error);
  await publicPage(visitor, owner.username, "event");
  assert.equal(await visitor.locator('[data-profile-photo="none"]').count(), 1);
  await visitor.screenshot({ path: resolve(out, "390-no-image.png"), fullPage: true });

  sql(`update public.billing_subscriptions set provider_status='expired' where dodo_subscription_id='${subscriptionId}' returning provider_status;`);
  const { data: savedOnFree, error: readOnFree } = await client.from("profile_modes").select("appearance").eq("id", personalMode.id).single();
  assert.ifError(readOnFree);
  assert.ifError((await client.from("profile_modes").update({ appearance: savedOnFree.appearance }).eq("id", personalMode.id)).error);
  const denied = await client.from("profile_modes").update({ appearance: { ...savedOnFree.appearance, portraitZoom: 140 } }).eq("id", personalMode.id);
  assert.equal(denied.error?.code, "P0001", "Free cannot introduce new premium controls");
  const freeResponse = await visitor.goto(`${appUrl}/${owner.username}`);
  assert.equal(freeResponse?.status(), 200);
  assert.equal(await visitor.locator('[data-profile-layout="full-portrait"]').count(), 0, "Free cannot publish Full Portrait after downgrade");
  await openAppearance(page);
  assert.equal(await activePreview(page).locator('[data-profile-layout="full-portrait"]').count(), 0, "downgrade renders the Free fallback in editor too");
  await page.getByRole("button", { name: /Full Portrait/ }).click();
  assert.equal(await activePreview(page).locator('[data-profile-layout="full-portrait"]').count(), 1, "Free can preview the saved premium selection");
  await page.getByRole("button", { name: "Apply with Plus" }).last().click();
  await page.getByRole("dialog").waitFor();
  assert.equal(await page.getByRole("dialog").getByRole("heading", { name: "Make your identity feel like yours." }).count(), 1);
  sql(`update public.billing_subscriptions set provider_status='active' where dodo_subscription_id='${subscriptionId}' returning provider_status;`);
  await publicPage(visitor, owner.username, "personal");
  assert.equal(await visitor.locator('[data-portrait-zoom="130"]').count(), 1, "re-upgrade restores saved zoom");

  assert.ifError((await client.from("profiles").update({ display_name: "A very long name that still belongs to one person" }).eq("id", firstId)).error);
  await visitor.setViewportSize({ width: 320, height: 700 });
  await publicPage(visitor, owner.username, "personal");
  await noOverflow(visitor, "long portrait name");
  await visitor.screenshot({ path: resolve(out, "320-long-name.png"), fullPage: true });
  assert.ifError((await client.from("profiles").update({ display_name: "Anaïs 山田 ✨" }).eq("id", firstId)).error);
  await visitor.setViewportSize({ width: 390, height: 844 });
  await publicPage(visitor, owner.username, "personal");
  await noOverflow(visitor, "Unicode portrait name");
  await visitor.screenshot({ path: resolve(out, "390-unicode-name.png"), fullPage: true });
  await first.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: appUrl });
  for (const slug of ["personal", "event", "business"]) {
    await page.goto(`${appUrl}/app/identity?mode=${slug}&section=share`);
    const qr = page.locator("svg[data-qr-value]");
    await qr.waitFor();
    const qrUrl = new URL(await qr.getAttribute("data-qr-value"));
    assert.equal(qrUrl.origin, appUrl);
    assert.equal(qrUrl.pathname, `/${owner.username}`);
    assert.equal(qrUrl.searchParams.get("mode") ?? "personal", slug);
    assert.equal(qrUrl.searchParams.get("source"), "qr");
    await page.getByRole("button", { name: "Copy link", exact: true }).click();
    await page.getByRole("button", { name: "Copied ✓", exact: true }).waitFor();
    const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    assert.equal(copied.pathname, qrUrl.pathname);
    assert.equal(copied.searchParams.get("mode") ?? "personal", slug);
    assert.equal((await visitor.goto(qrUrl.toString()))?.status(), 200);
    await visitor.locator(`[data-profile-mode="${slug}"][data-profile-layout="full-portrait"]`).waitFor();
  }
  await page.goto(`${appUrl}/app/settings/language`);
  await page.getByRole("button", { name: "Nederlands" }).click();
  await page.getByRole("heading", { name: "Taal", level: 1 }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await openAppearance(page, "nl");
  await page.getByRole("button", { name: /Volledig portret/ }).waitFor();
  await page.locator('[data-appearance-editor="mobile"]').getByText("Fotopositie", { exact: true }).waitFor();
  await page.getByRole("switch", { name: "Gebruikersnaam tonen" }).waitFor();
  await page.screenshot({ path: resolve(out, "390-editor-nl.png"), fullPage: true });

  second = await signup(browser, other);
  secondId = second.id;
  const otherUpdate = await second.client.from("profile_modes").update({ appearance: { ...modes[0].appearance, layout: "full-portrait" } }).eq("id", modes[0].id).select("id");
  assert.ifError(otherUpdate.error);
  assert.equal(otherUpdate.data.length, 0, "account 2 cannot edit account 1 appearance");
  console.log("PASS Full Portrait local browser E2E: editor/public, modes, controls, persistence, Free fallback, Plus restore, RLS, responsive captures");
  console.log(`Screenshots: ${out}`);
} finally {
  await browser?.close();
  if (firstId && uploadedPaths.length) await admin.storage.from("profile-media").remove(uploadedPaths);
  if (firstId) sql(`delete from public.billing_subscriptions where user_id='${firstId}'::uuid returning user_id;`);
  for (const id of [firstId, secondId].filter(Boolean)) {
    const deleted = await admin.auth.admin.deleteUser(id);
    if (deleted.error) console.warn("Local test user cleanup needs attention");
  }
}
