/**
 * Connection detail end-to-end check against a LOCAL Setuvara stack.
 *
 * Seeds real Connections through the real Connect RPCs, then proves the page keeps
 * Person / Connection / Encounter / private Memory apart:
 *   profile location is never a meeting place, link shares say how not where,
 *   Event context shows, memory is private to its owner, editing memory never moves
 *   canonical timestamps, identity updates don't rewrite snapshots, guest → claimed
 *   enrichment, repeated encounters stay separate, prefill and corrections persist,
 *   and an unrelated user can read nothing.
 *
 *   E2E_APP_URL=http://127.0.0.1:3014 \
 *   E2E_SUPABASE_URL=http://127.0.0.1:54321 \
 *   E2E_LOCAL_SERVICE_KEY=<local service role key> \
 *   E2E_PUBLISHABLE_KEY=<local publishable key> \
 *   E2E_SCREENSHOTS=./.e2e-connection-detail \
 *   node scripts/e2e-connection-detail.mjs
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const publishableKey = process.env.E2E_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const shots = process.env.E2E_SCREENSHOTS;
const timezoneId = "Europe/Amsterdam";
assert(new URL(appUrl).hostname === "127.0.0.1" && new URL(supabaseUrl).hostname === "127.0.0.1", "Connection detail E2E runs against local Setuvara only");
assert(serviceKey && publishableKey, "E2E_LOCAL_SERVICE_KEY and E2E_PUBLISHABLE_KEY (local stack) are required");
if (shots) mkdirSync(shots, { recursive: true });

const stamp = Date.now().toString(36).slice(-6);
const seededUsers = [];
const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(supabaseUrl, serviceKey, options);
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); };
const pass = (label) => console.log(`PASS ${label}`);

async function seedUser(name, displayName, extra = {}) {
  const username = `cd_${name}_${stamp}`;
  const password = `Detail-${stamp}-${name}-1`;
  const email = extra.email ?? `${username}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, display_name: displayName } });
  assert.ifError(error);
  const id = data.user.id;
  seededUsers.push(id);
  assert.ifError((await admin.from("profiles").update({ is_published: true, display_name: displayName, bio: extra.bio ?? "" }).eq("id", id)).error);
  assert.ifError((await admin.from("profile_modes").update({ is_enabled: true }).eq("profile_id", id)).error);
  for (const [slug, settings] of Object.entries(extra.settings ?? {})) {
    assert.ifError((await admin.from("profile_modes").update({ settings }).eq("profile_id", id).eq("slug", slug)).error);
  }
  const client = createClient(supabaseUrl, publishableKey, options);
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  return { id, username, email, password, name: displayName, client };
}

async function addPhoto(user, slug = "personal") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4a35"/><stop offset="1" stop-color="#1b1210"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><ellipse cx="400" cy="380" rx="150" ry="185" fill="#e2b08f"/><path d="M250 330 Q400 150 550 330 Q520 230 400 215 Q280 230 250 330Z" fill="#1a1110"/><path d="M130 1000 Q160 640 400 620 Q640 640 670 1000Z" fill="#d9d3c7"/></svg>`;
  const body = await sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
  const path = `${user.id}/${randomUUID()}.webp`;
  assert.ifError((await admin.storage.from("profile-media").upload(path, body, { contentType: "image/webp" })).error);
  assert.ifError((await admin.from("profile_modes").update({ image_path: path }).eq("profile_id", user.id).eq("slug", slug)).error);
}

async function connect(actor, target, mode, source, shareBack = "personal") {
  const { data, error } = await actor.client.rpc("connect_registered", {
    p_target_username: target.username, p_target_mode: mode, p_share_back_mode: shareBack,
    p_request_id: randomUUID(), p_source: source, p_pass_token: null,
  });
  assert.ifError(error);
  return data;
}

async function signIn(browser, account, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, timezoneId, locale: "en-GB" });
  const page = await context.newPage();
  await page.goto(`${appUrl}/login`);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/app/);
  return { context, page };
}

async function openConnection(page, id) {
  const response = await page.goto(`${appUrl}/app/connections/${id}`);
  assert.equal(response?.status(), 200, `connection ${id} should open`);
  await page.locator("h1").first().waitFor();
}

async function noHorizontalOverflow(page, label) {
  const size = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    widest: [...document.querySelectorAll("main *")].filter((node) => node.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 3).map((node) => `${node.tagName}.${String(node.className).slice(0, 60)}`),
  }));
  assert(size.scroll <= size.client + 1, `${label} overflows horizontally (${size.scroll} > ${size.client}): ${size.widest.join(" | ")}`);
}

const whereCard = (page) => page.locator("section[aria-labelledby=memory-heading]");
const amsterdamDate = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: timezoneId, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM ?? undefined });
try {
  const michel = await seedUser("michel", "M.L.A", { bio: "CEO" });
  const rayz = await seedUser("rayz", "Rayzenni I", { settings: { personal: { location: "Hoorn", pronouns: "she/her", note: "Ceramics and slow mornings." } } });
  const ana = await seedUser("ana", "Ana Lima", {
    settings: {
      event: { eventName: "Slush", city: "Helsinki", dateLabel: "14–15 Nov", role: "Founder" },
      business: { role: "Founder", company: "Acme", city: "Lisbon", description: "Tools for makers." },
    },
  });
  const visitor = await seedUser("visitor", "Vera Visitor");
  await addPhoto(rayz);

  // The Rayzenni case: Michel opens Rayzenni's Personal Mode from a native share and connects.
  const rayzConnection = await connect(michel, rayz, "personal", "native_share");
  // Ana: first at Slush by QR on her Event Mode, then again through her Business link.
  const anaFirst = await connect(michel, ana, "event", "qr");
  await new Promise((resolve) => setTimeout(resolve, 50));
  const anaAgain = await connect(michel, ana, "business", "link");
  assert.equal(anaFirst.connection_id, anaAgain.connection_id, "repeat Connect keeps one Connection");
  // A guest (no account) connects to Michel's Personal Mode.
  const guestEmail = `cd_sam_${stamp}@example.test`;
  const guestToken = randomBytes(32).toString("base64url");
  const anon = createClient(supabaseUrl, publishableKey, options);
  const { data: guestConnection, error: guestError } = await anon.rpc("create_guest_connection", {
    p_target_username: michel.username, p_target_mode: "personal", p_display_name: "Sam Guest", p_email: guestEmail,
    p_session_token: guestToken, p_request_id: randomUUID(), p_source: "qr", p_pass_token: null,
  });
  assert.ifError(guestError);

  const { data: before } = await admin.from("connections").select("id,created_at").in("id", [rayzConnection.connection_id, anaFirst.connection_id]);
  const { data: encountersBefore } = await admin.from("connection_encounters").select("id,created_at,shared_role,shared_company,shared_display_name").in("connection_id", [rayzConnection.connection_id, anaFirst.connection_id]);

  // ---- 1. Profile location is not a meeting place; a shared link says how, not where.
  const owner = await signIn(browser, michel);
  {
    const { page } = owner;
    await openConnection(page, rayzConnection.connection_id);
    await page.getByRole("heading", { level: 1, name: "Rayzenni I" }).waitFor();
    await page.getByText("Based in Hoorn").waitFor();
    await page.getByRole("heading", { name: "Connected through Personal Mode" }).waitFor();
    await page.getByText("Shared link", { exact: true }).waitFor();
    await page.getByText("You opened a link Rayzenni shared", { exact: true }).waitFor();
    const where = await whereCard(page).innerText();
    assert.match(where, /doesn’t know where you and Rayzenni met/);
    assert.doesNotMatch(where, /Hoorn/, "Hoorn (profile location) must not appear as where you met");
    assert.doesNotMatch(await page.locator("#origin-heading").locator("..").innerText(), /Hoorn/);
    assert.doesNotMatch(await page.locator("section[aria-labelledby=history-heading]").innerText(), /Hoorn/);
    assert.equal(await page.locator("aside img").count(), 1, "registered counterpart shows their photo");
    await noHorizontalOverflow(page, "Rayzenni connection at 390px");
    await shot(page, "mobile-390-link-no-location");
    pass("profile location stays on the person; shared link has no Where you met");

    // Smart editor: date prefilled from the canonical moment; Hoorn is never suggested.
    await page.getByRole("button", { name: /Add where you met/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const encounterAt = encountersBefore.find((row) => row.shared_display_name === "Rayzenni I").created_at;
    assert.equal(await dialog.locator("input[type=date]").inputValue(), amsterdamDate(encounterAt), "date picker prefilled from the encounter");
    assert.equal(await dialog.getByRole("textbox", { name: "City" }).inputValue(), "", "no city is invented");
    assert.doesNotMatch(await dialog.innerText(), /Hoorn/, "profile location is never a suggestion");
    if (shots) await page.screenshot({ path: `${shots}/mobile-390-memory-sheet-empty.png` });
    await dialog.getByRole("textbox", { name: "City" }).fill("Alkmaar");
    await dialog.getByRole("textbox", { name: "Venue" }).fill("Café De Boom");
    const earlier = new Date(Date.parse(encounterAt) - 86_400_000).toISOString();
    await dialog.locator("input[type=date]").fill(amsterdamDate(earlier));
    await dialog.locator("input[type=time]").fill("21:30");
    await dialog.getByRole("button", { name: "Save memory" }).click();
    await dialog.waitFor({ state: "detached" });
    await page.reload();
    await whereCard(page).getByText("Café De Boom, Alkmaar").waitFor();
    await whereCard(page).getByText("Your memory · only you").waitFor();

    // Private note, read-first.
    await page.getByRole("button", { name: /Add a note/ }).click();
    await page.getByLabel("Private note").fill("Ask about the ceramics studio.");
    await page.getByRole("button", { name: "Save note" }).click();
    await page.reload();
    await page.getByText("Ask about the ceramics studio.").waitFor();
    await shot(page, "mobile-390-with-memory");
    pass("memory and note save, persist and read back");
  }

  // ---- 2. Editing memory preserved canonical timestamps.
  {
    const { data: after } = await admin.from("connections").select("id,created_at").in("id", before.map((row) => row.id));
    for (const row of before) assert.equal(after.find((item) => item.id === row.id).created_at, row.created_at, "connections.created_at unchanged");
    const { data: encountersAfter } = await admin.from("connection_encounters").select("id,created_at").in("id", encountersBefore.map((row) => row.id));
    for (const row of encountersBefore) assert.equal(encountersAfter.find((item) => item.id === row.id).created_at, row.created_at, "encounter created_at unchanged");
    const { data: memory } = await admin.from("encounter_context").select("city,venue,met_on,met_time,provenance,user_id").eq("user_id", michel.id).single();
    assert.equal(memory.city, "Alkmaar");
    assert.equal(memory.met_time, "21:30:00");
    assert.equal(memory.provenance, "viewer");
    assert.notEqual(memory.met_on, amsterdamDate(encountersBefore.find((row) => row.shared_display_name === "Rayzenni I").created_at));
    pass("private memory date is stored separately; canonical timestamps untouched");
  }

  // ---- 3. Private memory displays only to its owner.
  {
    const counterpart = await signIn(browser, rayz);
    await openConnection(counterpart.page, rayzConnection.connection_id);
    await counterpart.page.getByRole("heading", { level: 1, name: "M.L.A" }).waitFor();
    const text = await counterpart.page.locator("main").innerText();
    assert.doesNotMatch(text, /Alkmaar|Café De Boom|ceramics studio/, "counterpart never sees the viewer's memory or note");
    assert.match(text, /Rayzenni|You/);
    await counterpart.page.getByText("M.L.A opened a link you shared", { exact: true }).waitFor();
    const { data: theirContext } = await rayz.client.from("encounter_context").select("id").eq("user_id", michel.id);
    const { data: theirNotes } = await rayz.client.from("connection_notes").select("note").eq("connection_id", rayzConnection.connection_id);
    assert.deepEqual(theirContext, []);
    assert.deepEqual(theirNotes, []);
    const forged = await rayz.client.from("encounter_context").insert({ encounter_id: rayzConnection.encounter_id, user_id: michel.id, city: "Forged" });
    assert(forged.error, "nobody can write memory as someone else");
    await counterpart.context.close();
    pass("private memory and note are visible only to their owner");
  }

  // ---- 4. Event context, repeated encounters, prefill and a manual correction.
  {
    const { page } = owner;
    await openConnection(page, anaFirst.connection_id);
    await page.getByRole("heading", { name: "Connected at Slush" }).waitFor();
    const history = page.locator("section[aria-labelledby=history-heading]");
    assert.equal(await history.locator("ol > li").count(), 2, "two encounters, two moments");
    await history.getByText("First connected").waitFor();
    await history.getByText("Connected again").waitFor();
    await history.getByText("Scanned", { exact: false }).count();
    await shot(page, "mobile-390-event-repeated");
    // Open the Slush moment (the story reads oldest first).
    await history.locator("ol > li").first().getByRole("button", { name: /Add where & when/ }).click();
    const dialog = page.getByRole("dialog");
    assert.equal(await dialog.getByRole("textbox", { name: "Event" }).inputValue(), "Slush", "event prefilled from the encounter");
    assert.equal(await dialog.getByRole("textbox", { name: "City" }).inputValue(), "Helsinki", "city prefilled from the encounter");
    if (shots) await page.screenshot({ path: `${shots}/mobile-390-memory-sheet-prefilled.png` });
    await dialog.getByRole("textbox", { name: "City" }).fill("Espoo");
    await dialog.getByRole("button", { name: "Save memory" }).click();
    await dialog.waitFor({ state: "detached" });
    await page.reload();
    const entries = page.locator("section[aria-labelledby=history-heading] ol > li");
    assert.match(await entries.first().innerText(), /Espoo/);
    assert.match(await entries.first().innerText(), /You corrected this/);
    assert.doesNotMatch(await entries.last().innerText(), /Espoo|Slush/, "the later encounter keeps its own context");
    await whereCard(page).getByText("Espoo").waitFor();
    const { data: snap } = await admin.from("connection_encounters").select("city,event_name").eq("id", anaFirst.encounter_id).single();
    assert.deepEqual(snap, { city: "Helsinki", event_name: "Slush" }, "the encounter snapshot is not rewritten");
    pass("event context shows, repeated encounters stay separate, prefill and corrections persist");
  }

  // ---- 5. Registered identity updates without rewriting snapshots.
  {
    assert.ifError((await admin.from("profiles").update({ display_name: "Ana Lima-Costa" }).eq("id", ana.id)).error);
    assert.ifError((await admin.from("profile_modes").update({ settings: { role: "CEO", company: "Acme Labs", city: "Lisbon", description: "Tools for makers." } }).eq("profile_id", ana.id).eq("slug", "business")).error);
    const { page } = owner;
    await openConnection(page, anaFirst.connection_id);
    await page.getByRole("heading", { level: 1, name: "Ana Lima-Costa" }).waitFor();
    await page.locator("aside").getByText("CEO · Acme Labs").waitFor();
    const history = await page.locator("section[aria-labelledby=history-heading]").innerText();
    assert.match(history, /Then: Ana Lima · Founder · Acme/);
    const { data: snapshot } = await admin.from("connection_encounters").select("shared_display_name,shared_role,shared_company").eq("id", anaAgain.encounter_id).single();
    assert.deepEqual(snapshot, { shared_display_name: "Ana Lima", shared_role: "Founder", shared_company: "Acme" });
    pass("current identity updates; the historical snapshot stays");
  }

  // ---- 6. Guest → claimed enrichment.
  {
    const { page } = owner;
    await openConnection(page, guestConnection.connection_id);
    await page.getByRole("heading", { level: 1, name: "Sam Guest" }).waitFor();
    await page.getByText("Guest connection").waitFor();
    await page.getByText("Sam scanned your QR code").first().waitFor();
    assert.equal(await page.locator("aside img").count(), 0, "guests have no photo");
    await shot(page, "mobile-390-guest");
    const sam = await seedUser("sam", "Samuel Green", { email: guestEmail, settings: { personal: { pronouns: "he/him" } } });
    const { data: claimed, error } = await sam.client.rpc("claim_guest_connections", { p_session_token: guestToken });
    assert.ifError(error);
    assert.equal(claimed.claimed_connections, 1);
    await openConnection(page, guestConnection.connection_id);
    await page.getByRole("heading", { level: 1, name: "Samuel Green" }).waitFor();
    await page.getByText("Joined Setuvara after connecting as a guest.").waitFor();
    await page.getByText("Connected as Sam Guest.").waitFor();
    await page.locator("aside").getByText("he/him").waitFor();
    await page.getByRole("link", { name: /View Samuel’s profile/ }).waitFor();
    assert.match(await page.locator("section[aria-labelledby=history-heading]").innerText(), /Sam connected as a guest|Samuel connected as a guest/);
    pass("guest connection enriches after claim, guest history intact");
  }

  // ---- 7. Unrelated users can't access the relationship or its memory.
  {
    const outsider = await signIn(browser, visitor);
    // /app streams behind loading.tsx, so the 404 arrives as the not-found page rather than a status.
    await outsider.page.goto(`${appUrl}/app/connections/${rayzConnection.connection_id}`);
    await outsider.page.waitForLoadState("networkidle");
    const body = await outsider.page.locator("body").innerText();
    assert.match(body, /404|could not be found/i);
    assert.doesNotMatch(body, /Rayzenni|M\.L\.A|Alkmaar|ceramics/);
    const tables = [["connections", "id"], ["connection_encounters", "id"], ["connection_notes", "note"], ["encounter_context", "city"]];
    for (const [table, column] of tables) {
      const { data } = await visitor.client.from(table).select(column);
      assert.deepEqual(data, [], `${table} is empty for an unrelated user`);
    }
    await outsider.context.close();
    pass("unrelated user gets 404 and reads nothing");
  }

  // ---- 8. Visual QA sizes.
  {
    for (const [label, viewport] of [["mobile-360", { width: 360, height: 780 }], ["desktop-1440", { width: 1440, height: 1000 }], ["tablet-820", { width: 820, height: 1180 }]]) {
      const view = await signIn(browser, michel, viewport);
      for (const [name, id] of [["rayz", rayzConnection.connection_id], ["ana", anaFirst.connection_id], ["guest", guestConnection.connection_id]]) {
        await openConnection(view.page, id);
        await noHorizontalOverflow(view.page, `${name} at ${label}`);
        await shot(view.page, `${label}-${name}`);
      }
      if (label === "desktop-1440") {
        await openConnection(view.page, anaFirst.connection_id);
        await view.page.locator("section[aria-labelledby=history-heading] ol > li").first().getByRole("button", { name: /Edit memory/ }).click();
        await view.page.getByRole("dialog").waitFor();
        if (shots) await view.page.screenshot({ path: `${shots}/desktop-1440-memory-sheet.png` });
      }
      await view.context.close();
    }
    pass("no horizontal overflow at 360, 390, 820 and 1440");
  }
  await owner.context.close();
} finally {
  await browser.close();
  for (const id of seededUsers) {
    const { data: files } = await admin.storage.from("profile-media").list(id);
    if (files?.length) await admin.storage.from("profile-media").remove(files.map((file) => `${id}/${file.name}`));
  }
  if (process.env.E2E_KEEP !== "1") {
    await admin.from("connections").delete().in("user_id", seededUsers);
    await admin.from("connections").delete().in("connected_user_id", seededUsers);
    for (const id of seededUsers) await admin.auth.admin.deleteUser(id);
  }
}
