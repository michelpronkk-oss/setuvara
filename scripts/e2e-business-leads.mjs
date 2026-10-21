import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

// Business Mode slice 1 against local Setuvara Supabase and a running app: Business inquiries
// arrive as leads (a repeat email joins its lead), the funnel shows the recorded counts, the owner
// moves a lead through its stages and adds a note on Plus, filters and search work, another member
// sees nothing, and the pages fit a phone and a desktop.
const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const dbUrl = process.env.E2E_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/postgres";
const shots = process.env.E2E_SCREENSHOT_DIR ?? null;
assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "Business E2E requires local Setuvara Supabase");
assert(new URL(dbUrl).hostname === "127.0.0.1", "Business E2E only touches the local database");
assert(serviceKey, "The local service key must be supplied in process memory");

const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now().toString(36).slice(-4)}${randomBytes(2).toString("hex")}`;
const userIds = [];
const psql = (sql) => execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-Atc", sql], { encoding: "utf8" }).trim();
let checks = 0;
const check = (label) => { checks += 1; console.log(`ok ${checks} - ${label}`); };
const shot = async (page, name) => { if (shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); } };
const noSideScroll = async (page, label) => { const width = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]); assert.ok(width[1] <= width[0], `${label}: ${width}`); check(`${label} has no sideways scroll`); };
const consent = (context) => context.addCookies([{ name: "sv-consent", value: "essential", url: appUrl }]);
const phoneSize = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function member(role) {
  const username = `bz_${role}_${suffix}`;
  const email = `${username}@example.test`;
  const password = `${randomBytes(18).toString("base64url")}Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, display_name: `${role[0].toUpperCase()}${role.slice(1)} Studio` } });
  assert.ifError(created.error);
  const id = created.data.user.id;
  userIds.push(id);
  psql(`update public.profiles set is_published = true where id = '${id}'`);
  psql(`update public.profile_modes set is_enabled = true where profile_id = '${id}'`);
  return { id, username, email, password };
}
async function signIn(page, who) {
  await page.goto(`${appUrl}/login`);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/app/);
}
async function inquire(actionId, name, email, answers, key) {
  const { error } = await admin.rpc("submit_profile_action", { p_action_id: actionId, p_submitter: null, p_name: name, p_email: email, p_answers: answers, p_feature_consent: false, p_idempotency_key: `${key}-${suffix}`.padEnd(16, "0"), p_ip_hash: null });
  assert.ifError(error);
}

const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH || undefined });
try {
  const owner = await member("north");
  const other = await member("south");
  psql(`insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at)
    values ('sub_Bz${suffix}', '${owner.id}', 'cus_Bz${suffix}', 'pdt_BzPlus', 'plus', 'monthly', 'active', 'bz-${suffix}', now(), now())`);
  const mode = psql(`select id from public.profile_modes where profile_id = '${owner.id}' and slug = 'business'`);
  const booking = psql(`insert into public.profile_actions (profile_id, mode_id, kind, title, status) values ('${owner.id}', '${mode}', 'booking', 'Book a studio visit', 'published') returning id`).split("\n")[0];
  const collab = psql(`insert into public.profile_actions (profile_id, mode_id, kind, title, status) values ('${owner.id}', '${mode}', 'collab', 'Work with North', 'published') returning id`).split("\n")[0];
  await admin.rpc("record_action_event", { p_action_ids: [booking, collab], p_kind: "open", p_viewer: null });

  await inquire(booking, "Mara Vos", `mara_${suffix}@example.test`, { message: "Can we visit on Thursday?", company: "Vos & Co", preferredDates: "Thu 30 Oct" }, "mara-1");
  await inquire(collab, "Mara Vos", `mara_${suffix}@example.test`, { message: "And a campaign together?", collabType: "campaign" }, "mara-2");
  await inquire(booking, "Jun Park", `jun_${suffix}@example.test`, { message: "Two people, mornings" }, "jun-1");
  assert.equal(psql(`select count(*) || ':' || max(inquiries) from public.business_leads where profile_id = '${owner.id}'`), "2:2"); check("three Business inquiries become two leads; the repeat email joins its lead");

  const phone = await browser.newContext(phoneSize);
  await consent(phone);
  const page = await phone.newPage();
  await signIn(page, owner);
  await page.goto(`${appUrl}/app/identity/leads`);
  await page.locator('[data-funnel="responses"]').getByText("3", { exact: true }).waitFor(); check("the funnel counts the three inquiries");
  assert.match(await page.locator('[data-funnel="leads"]').innerText(), /\b2\b/); check("and the two new leads");
  assert.match(await page.locator('[data-funnel="bookings"]').innerText(), /\b2\b/); check("and the two booking requests");
  assert.equal(await page.locator("[data-lead]").count(), 2); check("the inbox opens on the two open leads");
  await noSideScroll(page, "the Leads page on a phone");
  await shot(page, "b1-leads-390");

  await page.getByRole("button", { name: /Mara Vos/ }).click();
  await page.locator("[data-lead-sheet]").waitFor();
  await page.getByText("Can we visit on Thursday?").waitFor(); check("a lead's sheet shows what they asked");
  await page.getByText("Another inquiry").waitFor(); check("and the second inquiry in its history");
  await page.getByRole("radio", { name: "Contacted" }).click();
  await page.locator('[data-activity="stage"]').waitFor();
  assert.equal(psql(`select stage from public.business_leads where profile_id = '${owner.id}' and email = 'mara_${suffix}@example.test'`), "contacted"); check("the owner moves a lead to Contacted");
  await page.getByLabel("Note").fill("Called. Sending a quote Friday.");
  await page.getByRole("button", { name: "Add note" }).click();
  await page.locator('[data-activity="note"]').getByText("Sending a quote Friday").waitFor(); check("a note lands in the history");
  await shot(page, "b2-lead-sheet-390");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /^Contacted/ }).click();
  assert.equal(await page.locator("[data-lead]").count(), 1); check("the Contacted filter shows the contacted lead");
  await page.getByRole("button", { name: /^All/ }).click();
  await page.getByPlaceholder("Name or email").fill("jun");
  assert.equal(await page.locator("[data-lead]").count(), 1); check("search finds a lead by name");
  await phone.close();

  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await consent(desk);
  const deskPage = await desk.newPage();
  await signIn(deskPage, owner);
  await deskPage.goto(`${appUrl}/app/identity/leads?days=90`);
  await deskPage.locator("[data-lead]").first().waitFor();
  assert.equal(await deskPage.getByRole("link", { name: "Leads" }).first().getAttribute("aria-current"), "page"); check("Business Mode's sidebar has Leads, open");
  await shot(deskPage, "b3-leads-1440");
  await desk.close();

  const intruder = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await consent(intruder);
  const south = await intruder.newPage();
  await signIn(south, other);
  await south.goto(`${appUrl}/app/identity/leads`);
  await south.getByText("No leads yet.").waitFor();
  assert.equal(await south.getByText("Mara Vos").count(), 0); check("another member sees only their own, empty inbox");
  await intruder.close();
  console.log(`\n${checks} checks passed`);
} finally {
  await browser.close();
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
}
