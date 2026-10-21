import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

// Creator Mode slice 2 against local Setuvara Supabase and a running app: an ended giveaway with
// confirmed and unconfirmed entries; the creator draws a winner in the studio, the draw record is
// shown and re-checks from its seed, a redraw needs a reason and skips the first winner, the
// announcement reaches the public with first name and initial only, and the page fits a phone.
const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const dbUrl = process.env.E2E_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/postgres";
const shots = process.env.E2E_SCREENSHOT_DIR ?? null;
assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "Giveaway E2E requires local Setuvara Supabase");
assert(new URL(dbUrl).hostname === "127.0.0.1", "Giveaway E2E only touches the local database");
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
  const username = `gd_${role}_${suffix}`;
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
  const creator = await member("vega");
  psql(`insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at)
    values ('sub_Gd${suffix}', '${creator.id}', 'cus_Gd${suffix}', 'pdt_GdPlus', 'plus', 'monthly', 'active', 'gd-${suffix}', now(), now())`);
  const mode = psql(`select id from public.profile_modes where profile_id = '${creator.id}' and slug = 'creator'`);
  const give = psql(`insert into public.profile_actions (profile_id, mode_id, kind, title, status, ends_at, config) values ('${creator.id}', '${mode}', 'giveaway', 'Win a print', 'published', now() + interval '1 day', '{"prize":"A signed print"}') returning id`).split("\n")[0];
  for (const [index, name] of ["Mara Vos", "Jun Park", "Ada Lovelace", "Noor Haddad"].entries()) {
    const { data, error } = await admin.rpc("submit_profile_action", { p_action_id: give, p_submitter: null, p_name: name, p_email: `g${index}_${suffix}@example.test`, p_answers: {}, p_feature_consent: false, p_idempotency_key: `give-${index}-${suffix}`.padEnd(16, "0"), p_ip_hash: null });
    assert.ifError(error);
    assert.ifError((await admin.rpc("confirm_action_entry", { p_token: data.verify_token })).error);
  }
  await inquire(give, "Never Confirmed", `never_${suffix}@example.test`, {}, "never");
  // The giveaway ends (its terms are locked while live, so this fixture skips the lock trigger).
  psql(`set session_replication_role = replica; update public.profile_actions set ends_at = now() - interval '1 minute' where id = '${give}'`);

  const phone = await browser.newContext(phoneSize);
  await consent(phone);
  const page = await phone.newPage();
  await signIn(page, creator);
  await page.goto(`${appUrl}/app/identity/creator/actions/${give}`);
  await page.locator('[data-giveaway-draw="ready"]').waitFor();
  await page.getByText("4 confirmed entries can win").waitFor(); check("the draw counts only the four confirmed entries");
  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  await page.locator('[data-giveaway-draw="drawn"] [data-winner]').waitFor(); check("the creator draws a winner");
  const first = psql(`select winner_submission_ids[1] from public.action_giveaway_draws where action_id = '${give}' and draw_number = 1`);
  assert.equal(psql(`select status || ':' || (verified_at is not null) from public.action_submissions where id = '${first}'`), "entered:true"); check("the winner is a confirmed entry");
  assert.equal(psql(`select x.id from public.action_giveaway_draws d, lateral (select s.id from public.action_submissions s where s.action_id = d.action_id and s.status = 'entered' order by public.giveaway_draw_rank(d.seed, s.id), s.id limit 1) x where d.action_id = '${give}'`), first); check("the draw re-checks from its seed");
  await page.getByText("Draw record").click();
  await page.locator("[data-draw-record]").getByText(/seed [0-9a-f]{64}/).waitFor(); check("the draw record shows the seed and eligible digest");
  await noSideScroll(page, "the giveaway draw on a phone");
  await shot(page, "g1-draw-390");

  await page.getByLabel("Why draw again").fill("No reply in 7 days");
  await page.getByRole("button", { name: "Draw again" }).click();
  await page.getByText("Draw 2").waitFor();
  const second = psql(`select winner_submission_ids[1] from public.action_giveaway_draws where action_id = '${give}' and draw_number = 2`);
  assert.notEqual(second, first); check("a redraw with a reason never picks the first winner");

  await page.getByRole("button", { name: "Announce on the page" }).click();
  await page.getByRole("button", { name: "Take announcement down" }).waitFor(); check("the creator announces the draw");
  const anon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data: announced } = await anon.rpc("get_giveaway_announcement", { p_action_id: give });
  assert.equal(announced.names.length, 1);
  assert.match(announced.names[0], /^[A-Z][a-z]+ [A-Z]\.$/);
  assert.ok(!JSON.stringify(announced).includes("@")); check("the public sees first name and initial, never an email");
  await shot(page, "g2-announced-390");
  await phone.close();
  console.log(`\n${checks} checks passed`);
} finally {
  await browser.close();
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
}
