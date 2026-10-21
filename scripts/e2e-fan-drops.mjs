import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

// Creator Mode slice 3 (Fan Drops) against local Setuvara Supabase and a running app: the creator
// makes one Work piece followers-only and gives another an early-access drop in the studio; a
// visitor sees locked cards and never the pieces; a follower sees both; the pages fit a phone.
const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const dbUrl = process.env.E2E_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/postgres";
const shots = process.env.E2E_SCREENSHOT_DIR ?? null;
assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "Fan Drops E2E requires local Setuvara Supabase");
assert(new URL(dbUrl).hostname === "127.0.0.1", "Fan Drops E2E only touches the local database");
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
  const username = `fd_${role}_${suffix}`;
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
const local = (date) => { const pad = (n) => String(n).padStart(2, "0"); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; };

const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH || undefined });
try {
  const creator = await member("iris");
  const fan = await member("fan");
  const stranger = await member("walker");
  const mode = psql(`select id from public.profile_modes where profile_id = '${creator.id}' and slug = 'creator'`);
  for (const [index, title] of ["Studio session", "New print"].entries()) {
    psql(`insert into public.profile_blocks (profile_id, mode_id, kind, data, is_visible, sort_order) values ('${creator.id}', '${mode}', 'video', '{"source":"provider","url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","title":"${title}"}', true, ${index})`);
  }

  const studio = await browser.newContext(phoneSize);
  await consent(studio);
  const page = await studio.newPage();
  await signIn(page, creator);
  await page.goto(`${appUrl}/app/identity/creator/work`);
  await page.locator("[data-work-card]", { hasText: "Studio session" }).click();
  await page.getByRole("radio", { name: "Followers" }).click();
  await page.getByLabel("Locked card line").fill("The full session, for followers");
  await page.getByRole("button", { name: "Save" }).click();
  await page.locator("[data-work-badge=access]").first().waitFor();
  assert.equal(psql(`select access_level from public.creator_content_rules where creator_user_id = '${creator.id}'`), "followers"); check("the creator makes a piece followers-only");

  await page.locator("[data-work-card]", { hasText: "New print" }).click();
  await page.getByLabel("Release").fill(local(new Date(Date.now() + 2 * 86400000)));
  await page.getByLabel("Early access from").fill(local(new Date(Date.now() - 3600000)));
  await page.getByRole("radiogroup", { name: "Early access for" }).getByRole("radio", { name: "Followers" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.locator("[data-work-badge=drop]").waitFor();
  assert.equal(psql(`select status || ':' || early_access_level || ':' || (early_access_starts_at < now() and starts_at > now()) from public.creator_drops where creator_user_id = '${creator.id}'`), "scheduled:followers:true"); check("the creator schedules a drop with early access for followers");
  await shot(page, "f1-work-access-390");
  const shareUrl = await page.locator('a[href*="/s/"]').first().getAttribute("href").catch(() => null);
  await studio.close();
  const creatorPage = shareUrl ?? `${appUrl}/${creator.username}`;

  const visitor = await browser.newContext(phoneSize);
  await consent(visitor);
  const v = await visitor.newPage();
  await signIn(v, stranger);
  await v.goto(creatorPage);
  await v.locator("[data-locked-piece]").first().waitFor();
  assert.equal(await v.locator("[data-locked-piece]").count(), 2); check("a visitor sees two locked cards");
  await v.getByText("The full session, for followers").waitFor();
  await v.getByText(/Early access for followers/).waitFor(); check("each says what it is and how to get in");
  assert.equal(await v.getByText("Studio session").count(), 0); check("and never the pieces themselves");
  await noSideScroll(v, "the Creator page with locked work");
  await shot(v, "f2-locked-390");
  await visitor.close();

  psql(`insert into public.creator_follows (creator_user_id, follower_user_id) values ('${creator.id}', '${fan.id}')`);
  const fanContext = await browser.newContext(phoneSize);
  await consent(fanContext);
  const f = await fanContext.newPage();
  await signIn(f, fan);
  await f.goto(creatorPage);
  await f.getByText("Studio session").first().waitFor();
  await f.getByText("New print").first().waitFor();
  assert.equal(await f.locator("[data-locked-piece]").count(), 0); check("a follower sees both pieces, early");
  await shot(f, "f3-follower-390");
  await fanContext.close();
  console.log(`\n${checks} checks passed`);
} finally {
  await browser.close();
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
}
