import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

// Business and Creator handles against local Setuvara Supabase and a running app: claiming never
// publishes, live and search listing are separate switches, collisions and concurrent claims, old
// handles, QR and Tap following the live handle, /s/ links and Creator sub-pages unchanged,
// cross-account writes refused, and the Share screen's "Your public link" in a real browser.
const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const dbUrl = process.env.E2E_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/postgres";
const shots = process.env.E2E_SCREENSHOT_DIR ?? null;
assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "Mode handles E2E requires local Setuvara Supabase");
assert(new URL(dbUrl).hostname === "127.0.0.1", "Mode handles E2E only touches the local database");
assert(publishableKey && serviceKey, "Local keys must be supplied in process memory");

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(supabaseUrl, serviceKey, options);
const anon = createClient(supabaseUrl, publishableKey, options);
const suffix = `${Date.now().toString(36).slice(-4)}${randomBytes(2).toString("hex")}`;
const userIds = [];
const psql = (sql) => execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-Atc", sql], { encoding: "utf8" }).trim();
let checks = 0;
const check = (label) => { checks += 1; console.log(`ok ${checks} - ${label}`); };
const get = (path) => fetch(`${appUrl}${path}`, { redirect: "manual" });
const where = (response) => response.headers.get("location") && new URL(response.headers.get("location"), appUrl);
const meta = (html, pattern) => html.match(pattern)?.[1] ?? null;

async function member(role) {
  const username = `mh_${role}_${suffix}`;
  const email = `${username}@example.test`;
  const password = `${randomBytes(18).toString("base64url")}Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, display_name: `Handle ${role}` } });
  assert.ifError(created.error);
  const id = created.data.user.id;
  userIds.push(id);
  psql(`update public.profiles set is_published = true where id = '${id}'`);
  psql(`update public.profile_modes set is_enabled = true where profile_id = '${id}'`);
  const client = createClient(supabaseUrl, publishableKey, options);
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  return { id, username, email, password, client };
}
const claim = (who, mode, handle) => who.client.rpc("claim_mode_handle", { p_mode: mode, p_handle: handle });
const visibility = (who, mode, live, indexed) => who.client.rpc("set_mode_handle_visibility", { p_mode: mode, p_live: live, p_indexed: indexed });
const shortId = (who, mode) => psql(`select l.short_id from public.mode_share_locators l join public.profile_modes m on m.id=l.mode_id where m.profile_id='${who.id}' and m.slug='${mode}'`);

const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH || undefined });
try {
  const ana = await member("ana");
  const ben = await member("ben");
  const biz = `mhbiz_${suffix}`;
  const biz2 = `mhbiz2_${suffix}`;
  const cre = `mhcre_${suffix}`;

  // Server-only resolvers stay server-only.
  assert.ok((await anon.rpc("resolve_mode_handle", { p_handle: biz })).error); check("browsers cannot resolve a handle to a username");
  assert.ok((await ana.client.rpc("live_mode_handle", { p_profile: ben.id, p_mode: "business" })).error); check("a member cannot look up someone else's Mode handle");
  assert.ok((await anon.rpc("check_handle", { p_handle: biz })).error); check("visitors cannot probe handles");

  // Claim: the name is Ana's, nothing is public yet.
  assert.equal((await ana.client.rpc("check_handle", { p_handle: biz })).data, "free");
  const claimed = await claim(ana, "business", biz);
  assert.ifError(claimed.error); assert.equal(claimed.data.is_live, false); check("claiming a Business handle does not make it live");
  assert.equal((await get(`/${biz}`)).status, 404); check("a claimed, unlisted handle is a plain 404");
  const bizShort = shortId(ana, "business");
  assert.match(bizShort, /^[0-9A-Za-z]{8}$/); check("claiming mints the Mode's shortlink");
  assert.equal((await get(`/s/${bizShort}`)).status, 200); check("the shortlink still opens Business Mode");

  // Collisions and cross-account writes.
  assert.equal((await claim(ben, "business", biz)).error?.code, "23505"); check("another member cannot claim the same handle");
  assert.equal((await ben.client.from("profiles").update({ username: biz }).eq("id", ben.id)).error?.code, "23505"); check("nor take it as a username");
  assert.equal((await claim(ben, "business", ana.username)).error?.code, "23505"); check("a handle cannot take someone's username");
  assert.ok((await claim(ben, "business", "pricing")).error?.message.includes("handle_reserved")); check("reserved routes cannot be claimed");
  assert.ok((await claim(ben, "event", `mhev_${suffix}`)).error?.message.includes("mode_not_supported")); check("Event Modes keep their shortlink only");
  assert.ok((await ben.client.from("mode_handles").insert({ handle: `mhx_${suffix}`, profile_id: ana.id, mode_id: psql(`select id from public.profile_modes where profile_id='${ana.id}' and slug='creator'`), mode_slug: "creator" })).error); check("members cannot write handle rows directly");
  assert.ok((await visibility(ben, "business", true, true)).error); check("a member cannot switch on a link they don't own");
  assert.equal((await ben.client.from("mode_handles").select("handle")).data?.length ?? 0, 0); check("members cannot see others' handles");

  // Live, not listed.
  assert.ifError((await visibility(ana, "business", true, false)).error);
  let response = await get(`/${biz}?source=link`);
  assert.equal(response.status, 200);
  let html = await response.text();
  assert.match(html, /data-profile-mode="business"/); check("a live handle opens Business Mode");
  assert.equal(meta(html, /<link rel="canonical" href="([^"]+)"/), `https://setuvara.com/${biz}`); check("its canonical is the handle URL");
  assert.match(meta(html, /<meta name="robots" content="([^"]+)"/) ?? "", /noindex/); check("it stays out of search until listing is on");
  assert.equal(meta(html, /<meta property="og:image" content="([^"]+)"/), `https://setuvara.com/og/h/${biz}`); check("its preview image is the handle preview");
  assert.ok(!html.includes("application/ld+json")); check("no structured data while unlisted");
  assert.equal((await get(`/og/h/${biz}`)).headers.get("content-type"), "image/png"); check("the handle preview renders");
  assert.notEqual((await get(`/og/h/mhnobody_${suffix}`)).status, 200); check("a handle that isn't live has no preview");
  response = await get(`/@${biz}`);
  assert.equal(response.status, 308); assert.equal(where(response).pathname, `/${biz}`); check("/@handle is a 308 to the handle");
  html = await (await get(`/s/${bizShort}`)).text();
  assert.equal(meta(html, /<link rel="canonical" href="([^"]+)"/), `https://setuvara.com/${biz}`);
  assert.match(meta(html, /<meta name="robots" content="([^"]+)"/) ?? "", /noindex/); check("the shortlink names the handle as canonical and stays noindex");
  const personal = await (await get(`/${ana.username}`)).text();
  assert.ok(!personal.includes(biz) && !personal.includes(bizShort)); check("the Personal page never reveals the Business handle or shortlink");
  assert.ok(!(await (await get("/sitemap.xml")).text()).includes(`/${biz}<`)); check("an unlisted handle is not in the sitemap");

  // Listed.
  assert.ifError((await visibility(ana, "business", true, true)).error);
  html = await (await get(`/${biz}`)).text();
  assert.match(meta(html, /<meta name="robots" content="([^"]+)"/) ?? "", /^index/); check("listing on lets search engines index it");
  assert.ok(html.includes("application/ld+json") && html.includes(`@${biz}`)); check("structured data names the handle");
  assert.ok((await (await get("/sitemap.xml")).text()).includes(`https://setuvara.com/${biz}<`)); check("a listed handle is in the sitemap");
  const offAgain = await visibility(ana, "business", false, true);
  assert.equal(offAgain.data.search_indexed, false); check("turning the link off also turns listing off");
  assert.equal((await get(`/${biz}`)).status, 404); check("and the handle stops opening");
  assert.ifError((await visibility(ana, "business", true, false)).error);

  // Quick QR and Tap land on the live handle.
  assert.ifError((await ana.client.rpc("set_equipped_share_state", { p_mode: "business", p_intent: "view_profile" })).error);
  const quickToken = randomBytes(32).toString("base64url");
  psql(`insert into public.quick_share_locators (profile_id, nonce, token_hash) values ('${ana.id}', decode('${randomBytes(32).toString("hex")}','hex'), decode('${createHash("sha256").update(quickToken).digest("hex")}','hex'))`);
  const tapToken = randomBytes(32).toString("base64url");
  psql(`insert into public.tap_devices (owner_profile_id, token_hash, label, kind, status, claimed_at) values ('${ana.id}', decode('${createHash("sha256").update(tapToken).digest("hex")}','hex'), 'Card', 'card', 'active', now())`);
  response = await get(`/q/${quickToken}`);
  assert.equal(response.status, 303); assert.equal(where(response).pathname, `/${biz}`); check("Quick QR lands on the live handle");
  response = await get(`/t/${tapToken}`);
  assert.equal(response.status, 303); assert.equal(where(response).pathname, `/${biz}`); check("Tap (NFC) lands on the live handle");
  assert.ifError((await visibility(ana, "business", false, false)).error);
  response = await get(`/q/${quickToken}`);
  assert.equal(where(response).pathname, `/s/${bizShort}`); check("with the link off, QR falls back to the shortlink");
  assert.ifError((await visibility(ana, "business", true, false)).error);

  // Mode off or profile unpublished: nothing opens.
  psql(`update public.profile_modes set is_enabled=false where profile_id='${ana.id}' and slug='business'`);
  assert.equal((await get(`/${biz}`)).status, 404); check("a Mode that is off does not open by handle");
  psql(`update public.profile_modes set is_enabled=true where profile_id='${ana.id}' and slug='business'`);
  psql(`update public.profiles set is_published=false where id='${ana.id}'`);
  assert.equal((await get(`/${biz}`)).status, 404); check("an unpublished profile does not open by handle");
  psql(`update public.profiles set is_published=true where id='${ana.id}'`);

  // Once every 30 days: a change right after the claim is refused and says when it opens.
  assert.ok((await claim(ana, "business", biz2)).error?.message.includes("handle_change_limit")); check("a second change in 30 days is refused");
  assert.ok(new Date((await ana.client.rpc("handle_next_change_at", { p_mode: "business" })).data) > new Date(Date.now() + 29 * 864e5)); check("the owner sees when the next change opens");
  psql(`update private.mode_handle_changes set changed_at = now() - interval '31 days' where profile_id='${ana.id}' and mode_slug='business'`);

  // Change handle: old one stays Ana's and 307s to the new one.
  assert.ifError((await claim(ana, "business", biz2)).error);
  response = await get(`/${biz}?source=qr`);
  assert.equal(response.status, 307); assert.equal(where(response).pathname, `/${biz2}`); assert.equal(where(response).searchParams.get("source"), "qr"); check("an old handle 307s to the new one");
  assert.equal((await ben.client.rpc("check_handle", { p_handle: biz })).data, "taken"); check("and stays Ana's");
  assert.equal((await claim(ben, "creator", biz)).error?.code, "23505"); check("nobody else can claim it");

  // Release: the name stays Ana's, nothing opens, no redirect to the shortlink.
  assert.ifError((await ana.client.rpc("release_mode_handle", { p_mode: "business" })).error);
  assert.equal((await get(`/${biz2}`)).status, 404); assert.equal((await get(`/${biz}`)).status, 404); check("released handles open nothing and never reveal the shortlink");
  assert.equal((await ben.client.rpc("check_handle", { p_handle: biz2 })).data, "taken"); check("a released handle stays blocked for others");

  // Creator: the handle page keeps Creator sub-pages on the shortlink.
  assert.ifError((await claim(ana, "creator", cre)).error);
  assert.ifError((await visibility(ana, "creator", true, false)).error);
  const creShort = shortId(ana, "creator");
  html = await (await get(`/${cre}`)).text();
  assert.match(html, /data-profile-mode="creator"/); check("a live Creator handle opens Creator Mode");
  for (const path of [`/s/${creShort}`, `/s/${creShort}/kit`, `/s/${creShort}/collab`]) {
    assert.notEqual((await get(path)).status, 500, path);
    assert.notEqual((await get(path)).status, 404, path);
  }
  check("Creator shortlink, media kit and collab form still open");

  // Concurrent claims: exactly one of two members wins, every round.
  for (let round = 0; round < 5; round += 1) {
    const name = `mhrace${round}_${suffix}`;
    const [a, b] = await Promise.all([claim(ana, "business", name), claim(ben, "business", name)]);
    assert.equal([a, b].filter((result) => !result.error).length, 1, `round ${round}`);
    assert.equal(psql(`select count(*) from public.mode_handles where handle='${name}'`), "1");
    psql(`delete from private.mode_handle_changes where profile_id in ('${ana.id}','${ben.id}')`);
  }
  check("two members claiming one name at once: exactly one wins (5 rounds)");
  const raceName = `mhrname_${suffix}`;
  const [handleClaim, usernameClaim] = await Promise.all([claim(ana, "business", raceName), ben.client.from("profiles").update({ username: raceName }).eq("id", ben.id)]);
  assert.equal([handleClaim, usernameClaim].filter((result) => !result.error).length, 1);
  check("a handle and a username claimed at once: exactly one wins");
  psql(`delete from private.mode_handle_changes where profile_id='${ana.id}'`);
  assert.ifError((await ana.client.rpc("release_mode_handle", { p_mode: "business" })).error);

  // The Share screen: claim, availability, live switch, QR on the handle.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${appUrl}/login`);
  await page.getByLabel("Email").fill(ana.email);
  await page.getByLabel("Password", { exact: true }).fill(ana.password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/app/);
  await page.goto(`${appUrl}/app/identity?mode=business&section=share`);
  const essentials = page.getByRole("button", { name: /Essentials/ });
  if (await essentials.count()) await essentials.first().click();
  const card = page.locator('section[aria-label="Your public link"]');
  await card.waitFor();
  assert.equal(await card.getAttribute("data-public-link"), "none"); check("Share shows Your public link for Business");
  const input = card.getByLabel("Handle");
  await input.fill(ben.username);
  await card.locator('[data-handle-check="taken"]').waitFor(); check("typing a taken name says so");
  const uiName = `mhui_${suffix}`;
  await input.fill(uiName.toUpperCase());
  assert.equal(await input.inputValue(), uiName);
  await card.locator('[data-handle-check="free"]').waitFor(); check("typing a free name says available");
  if (shots) { mkdirSync(shots, { recursive: true }); await card.screenshot({ path: `${shots}/1-claim.png` }); }
  await card.getByRole("button", { name: "Claim link" }).click();
  await page.locator('section[data-public-link="claimed"]').waitFor(); check("Claim link claims it, not public yet");
  assert.equal((await get(`/${uiName}`)).status, 404); check("the claimed name doesn't open until the switch is on");
  await card.getByRole("switch", { name: "Public link" }).click();
  await page.locator('section[data-public-link="live"]').waitFor();
  assert.equal((await get(`/${uiName}`)).status, 200); check("the Public link switch makes it open");
  assert.equal(await card.getByRole("switch", { name: "Show in search engines" }).getAttribute("aria-checked"), "false"); check("search listing stays off until chosen");
  const qrValue = await page.locator("[data-qr-value]").first().getAttribute("data-qr-value");
  assert.equal(new URL(qrValue).pathname, `/${uiName}`); check("the Share QR now encodes the handle");
  const linkCard = page.locator('section[aria-label="Link"]');
  assert.ok(await linkCard.getByText("Shortlink", { exact: true }).count() && await linkCard.getByText(`/s/${shortId(ana, "business")}`).count()); check("the shortlink is shown as still working");
  if (shots) {
    await card.screenshot({ path: `${shots}/2-live.png` });
    await page.screenshot({ path: `${shots}/3-share-phone.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: `${shots}/4-share-desktop.png`, fullPage: true });
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1); check("no sideways scroll");
  await context.close();

  console.log(`Mode handles E2E passed (${checks} checks).`);
} finally {
  await browser.close();
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
}
