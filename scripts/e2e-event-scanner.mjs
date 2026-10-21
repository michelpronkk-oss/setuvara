import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

// The organizer's door scanner and deleting events, against local Setuvara Supabase and a running
// app (EVENTS_ENABLED=true). Chromium's fake camera plays a still of each QR, so the real scanner
// reads a real pass: a guest's pass from their own page checks them in once and says "already
// checked in" on the replay; two phones scanning one pass at once let them in once; a waitlisted
// guest, a forged pass, a pass for another event and a profile QR are each refused; another member
// cannot open the scanner; cancelled, past and empty events can be deleted, a coming one with guests
// cannot.
const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const dbUrl = process.env.E2E_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/postgres";
const secret = process.env.EVENT_TOKEN_SECRET ?? "local-event-secret";
const shots = process.env.E2E_SCREENSHOT_DIR ?? null;
assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "Scanner E2E requires local Setuvara Supabase");
assert(new URL(dbUrl).hostname === "127.0.0.1", "Scanner E2E only touches the local database");
assert(publishableKey && serviceKey, "Local keys must be supplied in process memory");

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(supabaseUrl, serviceKey, options);
const suffix = `${Date.now().toString(36).slice(-4)}${randomBytes(2).toString("hex")}`;
const work = mkdtempSync(join(tmpdir(), "sv-scan-"));
const userIds = [];
const psql = (sql) => execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-Atc", sql], { encoding: "utf8" }).trim();
let checks = 0;
const check = (label) => { checks += 1; console.log(`ok ${checks} - ${label}`); };
const shot = async (page, name) => { if (shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: `${shots}/${name}.png` }); } };
const phoneSize = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const sign = (purpose, id, version = 1) => `${id}.${version}.${createHmac("sha256", secret).update(`setuvara-event-${purpose}-v1:${id}:${version}`).digest("base64url").slice(0, 32)}`;
const passUrl = (id, version = 1) => `${appUrl}/app/identity/events/check-in/${sign("pass", id, version)}`;

async function member(role) {
  const username = `sc_${role}_${suffix}`;
  const email = `${username}@example.test`;
  const password = `${randomBytes(18).toString("base64url")}Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, display_name: `${role[0].toUpperCase()}${role.slice(1)} Host` } });
  assert.ifError(created.error);
  const id = created.data.user.id;
  userIds.push(id);
  psql(`update public.profiles set is_published = true where id = '${id}'`);
  psql(`update public.profile_modes set is_enabled = true where profile_id = '${id}'`);
  const client = createClient(supabaseUrl, publishableKey, options);
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  const { data: mode } = await client.from("profile_modes").select("id").eq("profile_id", id).eq("slug", "event").single();
  return { id, username, email, password, client, modeId: mode.id };
}
async function newEvent(who, title, startsInHours, extra = {}) {
  const start = Date.now() + startsInHours * 36e5;
  const { data, error } = await who.client.from("events").insert({
    profile_id: who.id, mode_id: who.modeId, title, status: "published", timezone: "Europe/Amsterdam",
    starts_at: new Date(start).toISOString(), ends_at: new Date(start + 3 * 36e5).toISOString(), ...extra,
  }).select("id").single();
  assert.ifError(error);
  return data.id;
}
async function register(eventId, name) {
  const { data, error } = await admin.rpc("register_for_event", { p_event_id: eventId, p_attendee: null, p_name: name, p_email: `${name.toLowerCase()}_${suffix}@example.test`, p_idempotency_key: randomBytes(12).toString("hex"), p_ip_hash: null });
  assert.ifError(error);
  return data;
}
async function signIn(page, who) {
  await page.goto(`${appUrl}/login`);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/app/);
}
/** A camera that sees this QR (a PNG, padded on white), as Chromium's fake capture file. */
function camera(name, png) {
  const y4m = join(work, `${name}.y4m`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-loop", "1", "-i", png, "-vf", "scale=360:360:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2:white", "-t", "1", "-r", "10", "-pix_fmt", "yuv420p", y4m]);
  return y4m;
}
async function qrPng(browser, name, value) {
  const page = await browser.newPage({ viewport: { width: 420, height: 420 } });
  await page.setContent(`<body style="margin:0;background:#fff;display:grid;place-items:center;height:100vh">${renderToStaticMarkup(createElement(QRCodeSVG, { value, size: 300, level: "M", marginSize: 4 }))}</body>`);
  const path = join(work, `${name}.png`);
  await page.screenshot({ path });
  await page.close();
  return path;
}
/** One scanner launch: a browser whose camera shows `video`, signed in as the organizer. */
async function scanWith(video, state, run) {
  const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH || undefined, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${video}`] });
  try {
    const context = await browser.newContext({ ...phoneSize, storageState: state, permissions: ["camera"] });
    return await run(context);
  } finally { await browser.close(); }
}
const firstResult = async (page) => {
  const result = page.locator("[data-scan-result]");
  try { await result.waitFor({ timeout: 20_000 }); } catch (error) {
    await page.screenshot({ path: join(work, "..", "sv-scan-failure.png") }).catch(() => null);
    throw new Error(`no scan result; camera ${await page.locator("[data-scanner]").getAttribute("data-scanner").catch(() => "?")}`, { cause: error });
  }
  return result.getAttribute("data-scan-result");
};

const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH || undefined });
try {
  const host = await member("ada");
  const stranger = await member("ben");

  const tonight = await newEvent(host, "Door night", 1, { capacity: 2, waitlist_enabled: true });
  const later = await newEvent(host, "Next week", 24 * 7);
  const ana = await register(tonight, "Ana");
  const bo = await register(tonight, "Bo");
  const cy = await register(tonight, "Cy");
  const dee = await register(later, "Dee");
  assert.deepEqual([ana.status, bo.status, cy.status], ["confirmed", "confirmed", "waitlisted"]);

  // The organizer signs in once on a phone; every scanner launch reuses the session.
  const phone = await browser.newContext(phoneSize);
  await phone.addCookies([{ name: "sv-consent", value: "essential", url: appUrl }]);
  const org = await phone.newPage();
  await signIn(org, host);
  await org.goto(`${appUrl}/app/identity/events/${tonight}`);
  await org.locator("[data-open-scanner]").waitFor(); check("an event with check-in open shows Scan passes");
  await org.goto(`${appUrl}/app/identity/events/${later}`);
  await org.getByRole("heading", { name: "Next week" }).waitFor();
  assert.equal(await org.locator("[data-open-scanner]").count(), 0); check("an event days away has no scanner yet");
  await org.goto(`${appUrl}/app/identity/events/${later}/scan`);
  await org.getByRole("heading", { name: "The door isn't open." }).waitFor(); check("its scan page says when the door opens");
  const state = await phone.storageState();

  // Ana's own pass, from her private page.
  const guestContext = await browser.newContext(phoneSize);
  await guestContext.addCookies([{ name: "sv-consent", value: "essential", url: appUrl }]);
  const guest = await guestContext.newPage();
  await guest.goto(`${appUrl}/e/r/${sign("guest", ana.id)}`);
  const pass = guest.locator('[data-door-pass="ready"] svg');
  await pass.waitFor(); check("Ana's private page shows her door pass");
  const anaPng = join(work, "ana.png");
  await pass.screenshot({ path: anaPng });

  // 1. A valid pass checks Ana in; the same pass held up again says it was used.
  await scanWith(camera("ana", anaPng), state, async (context) => {
    const page = await context.newPage();
    await page.goto(`${appUrl}/app/identity/events/${tonight}/scan`);
    assert.equal(await firstResult(page), "checked_in"); check("the scanner reads Ana's pass and checks her in");
    await page.locator('[data-checked-in="1"]').waitFor(); check("the door count goes up");
    const width = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
    assert.ok(width[1] <= 390, `scanner width ${width}`); check("the scanner fits a 390px phone without sideways scroll");
    await shot(page, "scanner-1-valid-390");
    await page.locator('[data-scan-result="already_checked_in"]').waitFor({ timeout: 20_000 }); check("the same pass a second time says already checked in");
    await shot(page, "scanner-2-already-390");
  });
  assert.equal(psql(`select count(*) from public.event_scans where registration_id = '${ana.id}' and result = 'checked_in'`), "1"); check("Ana was let in exactly once");

  // 2. Two phones scan Bo's pass at the same moment: one lets him in, the other says used.
  await scanWith(camera("bo", await qrPng(browser, "bo", passUrl(bo.id))), state, async (context) => {
    const [one, two] = await Promise.all([context.newPage(), context.newPage()]);
    await Promise.all([one.goto(`${appUrl}/app/identity/events/${tonight}/scan`), two.goto(`${appUrl}/app/identity/events/${tonight}/scan`)]);
    const results = (await Promise.all([firstResult(one), firstResult(two)])).sort();
    assert.deepEqual(results, ["already_checked_in", "checked_in"], results.join()); check("two phones scanning one pass at once let the guest in once");
  });
  assert.equal(psql(`select count(*) from public.event_scans where registration_id = '${bo.id}' and result = 'checked_in'`), "1");

  // 3. What the door turns away.
  const refused = [
    ["cy", passUrl(cy.id), "not_going", "a waitlisted guest's pass is not let in"],
    ["forged", `${passUrl(cy.id).slice(0, -6)}AAAAAA`, "invalid", "a pass with a forged signature is invalid"],
    ["old", passUrl(ana.id, 2), "invalid", "a pass with a version the database never issued is invalid"],
    ["dee", passUrl(dee.id), "other_event", "a pass for another of your events says which event it is for"],
    ["profile", `${appUrl}/${host.username}`, "not_a_pass", "a profile QR is not mistaken for a door pass"],
  ];
  for (const [name, value, expected, label] of refused) {
    await scanWith(camera(name, await qrPng(browser, name, value)), state, async (context) => {
      const page = await context.newPage();
      await page.goto(`${appUrl}/app/identity/events/${tonight}/scan`);
      assert.equal(await firstResult(page), expected, label); check(label);
      if (name === "dee") { await page.getByText("This pass is for Next week.").waitFor(); await shot(page, "scanner-3-other-event-390"); }
      if (name === "forged") await shot(page, "scanner-4-invalid-390");
    });
  }
  assert.equal(psql(`select count(*) from public.event_registrations where id in ('${cy.id}', '${dee.id}') and checked_in_at is not null`), "0"); check("nobody turned away was checked in");

  // 4. Another member cannot open someone else's door.
  const strangerPage = await browser.newPage(phoneSize);
  await signIn(strangerPage, stranger);
  await strangerPage.goto(`${appUrl}/app/identity/events/${tonight}/scan`);
  await strangerPage.getByRole("heading", { name: /This page isn.t here/ }).waitFor(); check("another member gets a not-found page, not the scanner");
  const { error: forbidden } = await stranger.client.rpc("owner_scan_event_pass", { p_event_id: tonight, p_registration_id: cy.id, p_token_version: 1 });
  assert.match(forbidden?.message ?? "", /event_not_found/); check("and the scan function refuses them directly");

  // 5. Deleting. A coming event with guests keeps; cancelled, past and empty ones go.
  org.on("dialog", (dialog) => void dialog.accept());
  await org.goto(`${appUrl}/app/identity/events/${later}`);
  await org.getByRole("button", { name: "Cancel event" }).waitFor();
  assert.equal(await org.locator("[data-delete-event]").count(), 0); check("a coming event with guests has no Delete, only Cancel");
  await org.getByRole("button", { name: "Cancel event" }).click();
  await org.locator("[data-delete-event]").waitFor(); check("once cancelled, it can be deleted");
  await shot(org, "delete-1-cancelled-390");
  await org.locator("[data-delete-event]").click();
  await org.waitForURL(`${appUrl}/app/identity/events`);
  assert.equal(psql(`select count(*) from public.events where id = '${later}'`), "0");
  assert.equal(psql(`select count(*) from public.event_registrations where event_id = '${later}'`), "0"); check("deleting it removes the event and its guest list");

  psql(`alter table public.events disable trigger events_validate; update public.events set starts_at = now() - interval '3 days', ends_at = now() - interval '3 days' + interval '3 hours' where id = '${tonight}'; alter table public.events enable trigger events_validate;`);
  await org.goto(`${appUrl}/app/identity/events/${tonight}`);
  await org.locator("[data-delete-event]").waitFor();
  assert.equal(await org.getByRole("button", { name: "Cancel event" }).count(), 0); check("a past event offers Delete, not Cancel");
  await org.locator("[data-delete-event]").click();
  await org.waitForURL(`${appUrl}/app/identity/events`);
  assert.equal(psql(`select count(*) from public.events where id = '${tonight}'`), "0"); check("a past event with guests and check-ins can be deleted");

  const empty = await newEvent(host, "Quiet one", 48);
  await org.goto(`${appUrl}/app/identity/events/${empty}`);
  await org.locator("[data-delete-event]").click();
  await org.waitForURL(`${appUrl}/app/identity/events`);
  assert.equal(psql(`select count(*) from public.events where id = '${empty}'`), "0"); check("a coming event nobody joined can be deleted");

  // The database has the last word: a delete the page allowed by mistake changes nothing.
  const guarded = await newEvent(host, "Guarded", 48);
  await register(guarded, "Eve");
  const { data: gone } = await host.client.from("events").delete().eq("id", guarded).select("id");
  assert.equal(gone.length, 0); check("a direct delete of a coming event with guests is refused");
  console.log(`\n${checks} checks passed`);
} finally {
  await browser.close();
  for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => null);
  rmSync(work, { recursive: true, force: true });
}
