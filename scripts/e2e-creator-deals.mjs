import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

// Creator Mode slice 1 against local Setuvara Supabase and a running app: Collab requests on Creator
// Mode arrive as deals, the creator moves one New → Talking → Booked → Paid, records the agreed fee
// (totals per currency), adds a note on Plus, another member sees nothing, and the page fits.
const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const dbUrl = process.env.E2E_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/postgres";
const shots = process.env.E2E_SCREENSHOT_DIR ?? null;
assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "Deals E2E requires local Setuvara Supabase");
assert(new URL(dbUrl).hostname === "127.0.0.1", "Deals E2E only touches the local database");
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
  const username = `cd_${role}_${suffix}`;
  const email = `${username}@example.test`;
  const password = `${randomBytes(18).toString("base64url")}Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, display_name: `${role[0].toUpperCase()}${role.slice(1)} Creator` } });
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
  const creator = await member("luna");
  const other = await member("sol");
  psql(`insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at, current_period_end)
    values ('sub_Cd${suffix}', '${creator.id}', 'cus_Cd${suffix}', 'pdt_CdPlus', 'plus', 'monthly', 'active', 'cd-${suffix}', now(), now(), now() + interval '30 days')`);
  const mode = psql(`select id from public.profile_modes where profile_id = '${creator.id}' and slug = 'creator'`);
  const collab = psql(`insert into public.profile_actions (profile_id, mode_id, kind, title, status) values ('${creator.id}', '${mode}', 'collab', 'Work with Luna', 'published') returning id`).split("\n")[0];
  await inquire(collab, "Lena Brand", `lena_${suffix}@oat.test`, { message: "Spring campaign, 3 reels?", collabType: "campaign", budget: "5k_10k", company: "Oat Co" }, "oat-1");
  await inquire(collab, "Max", `max_${suffix}@kite.test`, { message: "UGC for our app", collabType: "ugc", company: "Kite" }, "kite-1");
  assert.equal(psql(`select count(*) from public.creator_deals where creator_user_id = '${creator.id}'`), "2"); check("two Collab requests become two deals");

  const phone = await browser.newContext(phoneSize);
  await consent(phone);
  const page = await phone.newPage();
  await signIn(page, creator);
  await page.goto(`${appUrl}/app/identity/creator/actions`);
  await page.getByRole("link", { name: "Deals" }).first().click();
  await page.waitForURL(/creator\/collabs/);
  assert.equal(await page.locator("[data-deal]").count(), 2); check("Deals opens from Actions and lists both open deals");
  await noSideScroll(page, "the Deals page on a phone");
  await shot(page, "c1-deals-390");

  await page.getByRole("button", { name: /Oat Co/ }).click();
  await page.locator("[data-deal-sheet]").waitFor();
  await page.getByText("Spring campaign, 3 reels?").waitFor(); check("a deal shows the brand's request");
  for (const stage of ["Talking", "Booked"]) {
    await page.getByRole("radio", { name: stage }).click();
    await page.locator(`[data-deal-sheet="${stage.toLowerCase()}"]`).waitFor();
  }
  check("the creator moves a deal New → Talking → Booked");
  await page.getByLabel("Agreed fee").fill("4,500");
  await page.getByRole("button", { name: "Save" }).click();
  await page.locator('[data-activity="amount"]').waitFor();
  assert.equal(psql(`select agreed_amount_cents || ' ' || currency from public.creator_deals where brand = 'Oat Co' and creator_user_id = '${creator.id}'`), "450000 EUR"); check("the agreed fee is saved as the creator typed it");
  await page.getByLabel("Note").fill("3 reels, usage 6 months.");
  await page.getByRole("button", { name: "Add note" }).click();
  await page.locator('[data-activity="note"]').waitFor(); check("a note lands in the history");
  await page.getByRole("radio", { name: "Paid" }).click();
  await page.locator('[data-deal-sheet="paid"]').waitFor();
  await shot(page, "c2-deal-sheet-390");
  await page.keyboard.press("Escape");
  await page.getByText("Paid · EUR").waitFor();
  assert.match(await page.locator("dl").first().innerText(), /€4,500/); check("Paid totals show the creator's fee, per currency");
  await phone.close();

  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await consent(desk);
  const deskPage = await desk.newPage();
  await signIn(deskPage, creator);
  await deskPage.goto(`${appUrl}/app/identity/creator/collabs`);
  await deskPage.locator("[data-deal]").first().waitFor();
  await shot(deskPage, "c3-deals-1440");
  await desk.close();

  const intruder = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await consent(intruder);
  const sol = await intruder.newPage();
  await signIn(sol, other);
  await sol.goto(`${appUrl}/app/identity/creator/collabs`);
  await sol.getByText("No deals yet.").waitFor();
  assert.equal(await sol.getByText("Oat Co").count(), 0); check("another member sees only their own, empty Deals");
  await intruder.close();
  console.log(`\n${checks} checks passed`);
} finally {
  await browser.close();
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
}
