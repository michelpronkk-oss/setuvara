import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

// In-app feedback acceptance against local Setuvara Supabase only:
// RLS on product_feedback, the private screenshot bucket, and the sheet in the app shell.
const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const screenshots = resolve(process.env.E2E_FEEDBACK_SCREENSHOTS ?? ".next/e2e-feedback");
assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "Feedback E2E requires local Setuvara Supabase");
assert(publishableKey && serviceKey, "Local E2E keys must be supplied in process memory");
assert(new URL(appUrl).hostname === "127.0.0.1");
mkdirSync(screenshots, { recursive: true });

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(supabaseUrl, serviceKey, options);
const suffix = `${Date.now().toString(36).slice(-3)}${randomBytes(3).toString("hex")}`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const userIds = [];

async function member(role) {
  const email = `e2e-feedback-${role}-${suffix}@example.test`;
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `fb_${role}_${suffix}`, display_name: `Feedback ${role}` } });
  assert.ifError(created.error);
  userIds.push(created.data.user.id);
  const client = createClient(supabaseUrl, publishableKey, options);
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  return { id: created.data.user.id, email, password, client };
}

const browser = await chromium.launch({ headless: true });
try {
  const alice = await member("a");
  const bob = await member("b");
  const anon = createClient(supabaseUrl, publishableKey, options);

  // Database: members add and read only their own notes; status is admin-only.
  const own = await alice.client.from("product_feedback").insert({ kind: "idea", message: "Direct insert" }).select("id, status, user_id").single();
  assert.ifError(own.error);
  assert.equal(own.data.status, "open");
  assert.equal(own.data.user_id, alice.id);
  assert((await alice.client.from("product_feedback").insert({ kind: "bug", message: "x", status: "done" })).error, "members cannot set status");
  assert((await alice.client.from("product_feedback").insert({ kind: "bug", message: "x", user_id: bob.id })).error, "members cannot write as someone else");
  assert((await alice.client.from("product_feedback").insert({ kind: "rating", message: "5 stars" })).error, "only the four kinds are accepted");
  assert((await alice.client.from("product_feedback").insert({ kind: "bug", message: "   " })).error, "blank messages are refused");
  const update = await alice.client.from("product_feedback").update({ status: "done" }).eq("id", own.data.id).select();
  assert(update.error || update.data.length === 0, "members cannot change status");
  const remove = await alice.client.from("product_feedback").delete().eq("id", own.data.id).select();
  assert(remove.error || remove.data.length === 0, "members cannot delete feedback");
  assert.equal((await bob.client.from("product_feedback").select("id")).data.length, 0, "other members see nothing");
  assert((await anon.from("product_feedback").insert({ kind: "bug", message: "anon" })).error, "visitors cannot send feedback");
  assert.equal((await anon.from("product_feedback").select("id")).data?.length ?? 0, 0, "visitors read nothing");
  assert.ifError((await admin.from("product_feedback").update({ status: "reviewing" }).eq("id", own.data.id)).error);

  // Storage: own folder only, nobody reads back through the API.
  const path = `${alice.id}/${crypto.randomUUID()}.png`;
  assert.ifError((await alice.client.storage.from("product-feedback").upload(path, png, { contentType: "image/png" })).error);
  assert((await bob.client.storage.from("product-feedback").upload(`${alice.id}/${crypto.randomUUID()}.png`, png, { contentType: "image/png" })).error, "no uploads into another member's folder");
  assert((await bob.client.storage.from("product-feedback").download(path)).error, "other members cannot read screenshots");
  assert((await anon.storage.from("product-feedback").download(path)).error, "visitors cannot read screenshots");
  assert((await alice.client.storage.from("product-feedback").upload(`${alice.id}/${crypto.randomUUID()}.svg`, Buffer.from("<svg/>"), { contentType: "image/svg+xml" })).error, "only PNG, JPEG and WebP are stored");

  // API: same-origin only, signed-in only.
  assert.equal((await fetch(`${appUrl}/api/feedback`, { method: "POST", body: new FormData() })).status, 403);
  assert.equal((await fetch(`${appUrl}/api/feedback`, { method: "POST", headers: { "x-setuvara-request": "same-origin" }, body: new FormData() })).status, 401);

  // Sheet: Bob sends a bug with a screenshot from the app shell.
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on("pageerror", (error) => { throw new Error(`Runtime error on ${page.url()}: ${error.message}`); });
    await page.goto(`${appUrl}/login`);
    await page.getByLabel("Email").fill(bob.email);
    await page.getByLabel("Password", { exact: true }).fill(bob.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/app/, { timeout: 20_000 });
    await page.goto(`${appUrl}/app/connections?mode=business`);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Send feedback" }).click();
    const sheet = page.getByRole("dialog", { name: "Send feedback" });
    await sheet.waitFor();
    assert.equal(await sheet.getByRole("button", { name: "Send" }).isDisabled(), true, "Send waits for a type and a message");
    await page.screenshot({ path: resolve(screenshots, `sheet-empty-${viewport.width}.png`) });
    await sheet.getByRole("button", { name: "Bug", exact: true }).click();
    await sheet.getByLabel("Message").fill(`The share sheet closed by itself (${viewport.width})`);
    await sheet.locator('input[type="file"]').setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: png });
    await sheet.getByRole("img", { name: "Screenshot preview" }).waitFor();
    await page.screenshot({ path: resolve(screenshots, `sheet-filled-${viewport.width}.png`) });
    await sheet.getByRole("button", { name: "Send" }).click();
    await page.getByRole("heading", { name: "Thank you." }).waitFor();
    await page.screenshot({ path: resolve(screenshots, `sheet-sent-${viewport.width}.png`) });
    await page.getByRole("button", { name: "Done" }).click();
    await sheet.waitFor({ state: "detached" });
    await context.close();
  }

  const rows = await admin.from("product_feedback").select("*").eq("user_id", bob.id).order("created_at");
  assert.ifError(rows.error);
  assert.equal(rows.data.length, 2);
  for (const row of rows.data) {
    assert.equal(row.kind, "bug");
    assert.equal(row.status, "open");
    assert.equal(row.route, "/app/connections");
    assert.equal(row.mode, "business");
    assert.equal(row.plan, "free");
    assert.match(row.user_agent, /Chrome/);
    assert.match(row.viewport, /^(390x844|1440x900)@1$/);
    assert.match(row.screenshot_path, new RegExp(`^${bob.id}/[0-9a-f-]{36}\\.png$`));
    assert.ifError((await admin.storage.from("product-feedback").download(row.screenshot_path)).error);
  }

  // Rate limit: ten notes in ten minutes per member.
  let limited = null;
  for (let index = 0; index < 12 && !limited; index += 1) {
    limited = (await alice.client.from("product_feedback").insert({ kind: "other", message: `burst ${index}` })).error;
  }
  assert.match(limited?.message ?? "", /feedback_rate_limited/);
  console.log("Feedback E2E passed.");
} finally {
  await browser.close();
  for (const id of userIds) {
    const { data } = await admin.storage.from("product-feedback").list(id);
    if (data?.length) await admin.storage.from("product-feedback").remove(data.map((file) => `${id}/${file.name}`));
    await admin.auth.admin.deleteUser(id);
  }
}
