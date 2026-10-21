import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

// Event Mode slices 1 and 2 against local Setuvara Supabase and a running app (EVENTS_ENABLED=true):
// an organizer creates and publishes an event on a phone, visitors RSVP until it fills and the
// waitlist takes over, a guest cancels from their private link and the waitlist is promoted, an
// altered link is refused, a member RSVPs asking to connect, shows their door pass and is checked
// in and connected, another guest is checked in from the list, another member sees nothing, and
// the desktop pages render.
const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const dbUrl = process.env.E2E_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/postgres";
const shots = process.env.E2E_SCREENSHOT_DIR ?? null;
assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "Events E2E requires local Setuvara Supabase");
assert(new URL(dbUrl).hostname === "127.0.0.1", "Events E2E only touches the local database");
assert(publishableKey && serviceKey, "Local keys must be supplied in process memory");

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(supabaseUrl, serviceKey, options);
const suffix = `${Date.now().toString(36).slice(-4)}${randomBytes(2).toString("hex")}`;
const userIds = [];
const psql = (sql) => execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-Atc", sql], { encoding: "utf8" }).trim();
let checks = 0;
const check = (label) => { checks += 1; console.log(`ok ${checks} - ${label}`); };
const shot = async (page, name) => { if (shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); } };
const noSideScroll = async (page, label) => { const width = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]); assert.ok(width[0] === 390 && width[1] <= 390, `${label}: ${width}`); check(`${label} fits a 390px phone without sideways scroll`); };
const consent = (context) => context.addCookies([{ name: "sv-consent", value: "essential", url: appUrl }]);

async function member(role) {
  const username = `ev_${role}_${suffix}`;
  const email = `${username}@example.test`;
  const password = `${randomBytes(18).toString("base64url")}Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, display_name: `${role[0].toUpperCase()}${role.slice(1)} Host` } });
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
async function rsvp(browser, url, name, email) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await consent(context);
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForTimeout(1600); // the form refuses instant submissions
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /I'm going|Join the waitlist/ }).click();
  const done = page.locator("[data-rsvp-done]");
  await done.waitFor();
  const status = await done.getAttribute("data-rsvp-done");
  return { context, page, status };
}

const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH || undefined });
try {
  const host = await member("ada");
  const other = await member("ben");

  // The organizer creates an event on a phone: Event Mode overview → Events → New event.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await consent(phone);
  const org = await phone.newPage();
  await signIn(org, host);
  await org.goto(`${appUrl}/app/identity?mode=event`);
  await org.getByRole("link", { name: /Events.*RSVPs/ }).click();
  await org.waitForURL(/\/app\/identity\/events$/);
  await org.getByText("Host something.").waitFor(); check("a new organizer sees the empty Events page");
  await shot(org, "1-events-empty-390");
  await org.getByRole("link", { name: "Create your first event" }).click();
  await org.getByLabel("Event name").fill("Founders Dinner");
  await org.getByLabel("Venue").fill("Hotel V");
  await org.getByLabel("City").fill("Amsterdam");
  await org.locator("#ev-zone").selectOption("Europe/Amsterdam");
  await org.getByRole("switch", { name: "Limit spots" }).click();
  await org.getByLabel("Spots", { exact: true }).fill("2");
  await noSideScroll(org, "the new event form");
  await shot(org, "2-new-event-390");
  await org.getByRole("button", { name: "Publish event" }).click();
  await org.waitForURL(/\/app\/identity\/events\/[0-9a-f-]{36}$/);
  const eventId = org.url().split("/").at(-1);
  const shortId = psql(`select short_id from public.events where id = '${eventId}'`);
  assert.match(shortId, /^[0-9A-Za-z]{8}$/); check("publishing gives the event its own short id");
  assert.equal(psql(`select timezone || ' ' || to_char(starts_at at time zone timezone, 'HH24:MI') from public.events where id = '${eventId}'`), "Europe/Amsterdam 19:00"); check("the start is stored at 19:00 in the event's own zone");
  await shot(org, "3-event-detail-empty-390");

  // The public page: the short id alone redirects to the canonical name.
  const bare = await fetch(`${appUrl}/e/${shortId}`, { redirect: "manual" });
  assert.equal(new URL(bare.headers.get("location"), appUrl).pathname, `/e/${shortId}/founders-dinner`); check("/e/<id> redirects to /e/<id>/<name>");
  const eventUrl = `${appUrl}/e/${shortId}/founders-dinner`;
  const html = await (await fetch(eventUrl)).text();
  assert.ok(!html.includes(host.username)); check("the event page never prints the organizer's username");
  assert.equal((await fetch(`${appUrl}/e/AAAAAAAA`)).status, 404); check("an unknown event id is a 404");
  const ics = await fetch(`${appUrl}/e/${shortId}/calendar.ics`);
  assert.match(ics.headers.get("content-type"), /text\/calendar/); assert.match(await ics.text(), /DTSTART:\d{8}T1[78]0000Z/); check("Add to calendar gives a UTC calendar file");

  // Visitors RSVP: two seats, then the waitlist.
  const first = await rsvp(browser, eventUrl, "Cleo Guest", `cleo_${suffix}@example.test`);
  assert.equal(first.status, "confirmed"); check("the first guest is going");
  await noSideScroll(first.page, "the public event page");
  await shot(first.page, "4-rsvp-going-390");
  const second = await rsvp(browser, eventUrl, "Dan Guest", `dan_${suffix}@example.test`);
  assert.equal(second.status, "confirmed"); check("the second guest takes the last spot");
  const third = await rsvp(browser, eventUrl, "Eve Guest", `eve_${suffix}@example.test`);
  assert.equal(third.status, "waitlisted"); check("the third guest joins the waitlist");
  await shot(third.page, "5-rsvp-waitlist-390");
  const fullPage = await third.context.newPage();
  await fullPage.goto(eventUrl);
  await fullPage.getByRole("heading", { name: "Join the waitlist" }).waitFor(); check("a full event offers the waitlist before anyone presses");
  await shot(fullPage, "6-event-full-390");
  for (const guest of [first, second, third]) await guest.context.close();

  // A guest's private link: view, cancel, and the waitlist moves up.
  const cleoId = psql(`select id from public.event_registrations where email = 'cleo_${suffix}@example.test'`);
  const { createHmac } = await import("node:crypto");
  const secret = process.env.EVENT_TOKEN_SECRET ?? "local-event-secret";
  const signAs = (purpose) => (id, version) => `${id}.${version}.${createHmac("sha256", secret).update(`setuvara-event-${purpose}-v1:${id}:${version}`).digest("base64url").slice(0, 32)}`;
  const sign = signAs("guest");
  const signPass = signAs("pass");
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await consent(guestContext);
  const guest = await guestContext.newPage();
  await guest.goto(`${appUrl}/e/r/${sign(cleoId, 2)}`);
  await guest.getByRole("heading", { name: "This link doesn't work." }).waitFor(); check("a link with a forged version is refused");
  const token = sign(cleoId, 1);
  await guest.goto(`${appUrl}/e/r/${token.slice(0, -1)}${token.at(-1) === "A" ? "B" : "A"}`);
  await guest.getByRole("heading", { name: "This link doesn't work." }).waitFor(); check("an altered link is refused");
  await guest.goto(`${appUrl}/e/r/${token}`);
  await guest.locator('[data-guest-status="confirmed"]').waitFor(); check("the private link shows the guest's own registration");
  await shot(guest, "7-guest-link-390");
  await guest.getByRole("button", { name: "I can't make it" }).click();
  await guest.getByRole("button", { name: "Yes, cancel" }).click();
  await guest.locator('[data-guest-status="cancelled"]').waitFor(); check("the guest cancels in two presses");
  assert.equal(psql(`select status || ':' || (promoted_at is not null) from public.event_registrations where email = 'eve_${suffix}@example.test'`), "confirmed:true"); check("the freed spot goes to the waitlist at once");
  assert.equal(psql(`select confirmed_count || '/' || waitlist_count from public.events where id = '${eventId}'`), "2/0"); check("the counters follow");
  const forged = await fetch(`${appUrl}/api/events/registration`, { method: "POST", headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" }, body: JSON.stringify({ token: sign(psql(`select id from public.event_registrations where email = 'dan_${suffix}@example.test'`), 1).replace(/.$/, "x"), intent: "cancel" }) });
  assert.equal(forged.status, 404); check("the cancel API refuses a forged token");
  const crossSite = await fetch(`${appUrl}/api/events/${eventId}/register`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body: "{}" });
  assert.equal(crossSite.status, 403); check("cross-site registration is refused");
  await guestContext.close();

  // The organizer's guest list and numbers.
  await org.reload();
  await org.locator('[data-guest="confirmed"]').first().waitFor();
  assert.equal(await org.locator('[data-guest="confirmed"]').count(), 2); check("the organizer sees two guests going");
  await org.getByRole("button", { name: /^Cancelled/ }).click();
  assert.equal(await org.locator('[data-guest="cancelled"]').count(), 1); check("cancelled guests stay on the record");
  await org.getByRole("button", { name: /^All/ }).click();
  await org.getByPlaceholder("Name or email").fill("eve");
  assert.equal(await org.locator("[data-guest]").count(), 1); check("search finds a guest by name");
  await org.getByPlaceholder("Name or email").fill("");
  await noSideScroll(org, "the event screen with guests");
  await shot(org, "8-event-detail-guests-390");

  // Slice 2: check-in opens 12 hours before the start, so the event moves to tonight.
  psql(`update public.events set capacity = 3, starts_at = now() + interval '1 hour', ends_at = now() + interval '4 hours' where id = '${eventId}'`);
  const benPhone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await consent(benPhone);
  const benPage = await benPhone.newPage();
  await signIn(benPage, other);
  await benPage.goto(eventUrl);
  await benPage.waitForTimeout(1600);
  const connectBox = benPage.getByLabel(/Connect with Ada when I check in/);
  assert.equal(await connectBox.isChecked(), false); check("a member is offered to connect, off until they choose");
  await connectBox.check();
  await benPage.getByLabel("Email").fill(other.email);
  await benPage.getByRole("button", { name: "I'm going" }).click();
  await benPage.locator('[data-rsvp-done="confirmed"]').waitFor();
  const benReg = psql(`select id from public.event_registrations where event_id = '${eventId}' and attendee_user_id = '${other.id}'`);
  assert.equal(psql(`select connect_on_check_in from public.event_registrations where id = '${benReg}'`), "t"); check("the member's choice to connect is saved with their RSVP");
  await benPage.goto(`${appUrl}/e/r/${sign(benReg, 1)}`);
  await benPage.locator('[data-door-pass="ready"]').waitFor(); check("a confirmed guest's private page shows their door pass");
  assert.equal(await benPage.getByRole("switch", { name: /Connect with Ada at check-in/ }).getAttribute("aria-checked"), "true"); check("and their connect choice, which they can change");
  await noSideScroll(benPage, "the guest page with a door pass");
  await shot(benPage, "8a-door-pass-390");

  // The organizer scans the pass: one press checks Ben in and connects them, the event as where they met.
  await org.goto(`${appUrl}/app/identity/events/check-in/${signPass(benReg, 1)}`);
  await org.getByRole("button", { name: "Check in Ben" }).click();
  await org.locator('[data-check-in="in"]').getByText(/You're connected now/).waitFor(); check("checking in a member who asked connects them");
  await shot(org, "8b-check-in-390");
  assert.equal(psql(`select count(*) from public.connections where user_id = '${host.id}' and connected_user_id = '${other.id}'`), "1"); check("the organizer and the guest are connected");
  assert.equal(psql(`select source || ':' || live_context_label_snapshot from public.connection_encounters where event_id = '${eventId}'`), "event_check_in:Founders Dinner"); check("the event is saved as where they met");
  await org.goto(`${appUrl}/app/identity/events/check-in/${signPass(benReg, 1).replace(/.$/, "x")}`);
  await org.getByText("Nothing to check in.").waitFor(); check("an altered pass checks nobody in");

  // From the guest list: one tap checks Dan in.
  await org.goto(`${appUrl}/app/identity/events/${eventId}`);
  await org.getByRole("button", { name: "Check in Dan Guest" }).click();
  await org.locator('[data-check-in="in"]').nth(1).waitFor();
  assert.equal(psql(`select checked_in_at is not null from public.event_registrations where email = 'dan_${suffix}@example.test'`), "t"); check("the organizer checks a guest in from the list");
  await org.getByRole("button", { name: /^Checked in/ }).click();
  assert.equal(await org.locator("[data-guest]").count(), 2); check("the Checked in filter shows who is in");
  await org.getByRole("button", { name: /^All/ }).click();
  await noSideScroll(org, "the guest list at the door");
  await shot(org, "8c-guest-list-check-in-390");

  // Another member's pass is not theirs to use, and Ben's page now says they're connected.
  const danReg = psql(`select id from public.event_registrations where email = 'dan_${suffix}@example.test'`);
  await benPage.goto(`${appUrl}/app/identity/events/check-in/${signPass(danReg, 1)}`);
  await benPage.getByText("Nothing to check in.").waitFor();
  assert.equal(await benPage.getByText("Dan Guest").count(), 0); check("a pass opened by another member shows nothing about the guest");
  await benPage.goto(`${appUrl}/e/r/${sign(benReg, 1)}`);
  await benPage.getByText("You're connected with Ada").waitFor(); check("the guest's page says they're connected");
  await benPage.locator('[data-door-pass="used"]').waitFor(); check("and the door pass shows it was used");
  await benPhone.close();

  // Another member sees nothing.
  const intruder = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await consent(intruder);
  const ben = await intruder.newPage();
  await signIn(ben, other);
  // The app shell streams behind a loading screen, so the miss shows as the not-found page.
  await ben.goto(`${appUrl}/app/identity/events/${eventId}`);
  await ben.getByRole("heading", { name: /This page isn.t here/ }).waitFor();
  assert.equal(await ben.getByText("Founders Dinner").count(), 0); check("another member cannot open the event in the app");
  await intruder.close();

  // Desktop.
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await consent(desk);
  const deskPage = await desk.newPage();
  await signIn(deskPage, host);
  await deskPage.goto(`${appUrl}/app/identity/events`);
  await deskPage.locator('[data-event-row="upcoming"]').waitFor(); check("desktop Events lists the event as coming up");
  await shot(deskPage, "9-events-1440");
  await deskPage.goto(`${appUrl}/app/identity/events/${eventId}`);
  await deskPage.locator('[data-guest="confirmed"]').first().waitFor();
  await shot(deskPage, "10-event-detail-1440");
  await deskPage.goto(eventUrl);
  await deskPage.getByText("This is your event.").waitFor(); check("the organizer's own page links to the guest list instead of a form");
  await desk.close();
  const visitorDesk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await consent(visitorDesk);
  const visitor = await visitorDesk.newPage();
  await visitor.goto(eventUrl);
  await visitor.getByRole("heading", { name: "Join the waitlist" }).waitFor();
  await shot(visitor, "11-event-page-1440");
  await visitorDesk.close();

  // Cancelling the event closes it for everyone.
  org.on("dialog", (dialog) => void dialog.accept());
  await org.getByRole("button", { name: "Cancel event" }).click();
  await org.waitForTimeout(1200);
  assert.equal(psql(`select status from public.events where id = '${eventId}'`), "cancelled"); check("the organizer can cancel the event");
  const after = await phone.newPage();
  await after.goto(eventUrl);
  await after.getByText("This event was cancelled.").waitFor(); check("the page says it was cancelled");
  await shot(after, "12-event-cancelled-390");
  console.log(`\n${checks} checks passed`);
} finally {
  await browser.close();
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
}
