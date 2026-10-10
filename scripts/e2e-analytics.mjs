import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

// Analytics + member badge acceptance against local Setuvara Supabase only.
const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const screenshots = resolve(process.env.E2E_ANALYTICS_SCREENSHOTS ?? ".next/e2e-analytics");
const root = resolve(process.cwd());
const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
assert.equal(gitRoot.replaceAll("\\", "/").toLowerCase(), root.replaceAll("\\", "/").toLowerCase());
assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "Analytics E2E requires local Setuvara Supabase");
assert(publishableKey && serviceKey, "Local E2E keys must be supplied in process memory");
assert(new URL(appUrl).hostname === "127.0.0.1" && new URL(mailpitUrl).hostname === "127.0.0.1");
mkdirSync(screenshots, { recursive: true });

const suffix = `${Date.now().toString(36).slice(-3)}${randomBytes(3).toString("hex")}`;
const account = (role) => ({ role, email: `e2e-analytics-${role}-${suffix}@example.test`, password: `${randomBytes(24).toString("base64url")}Aa1!`, username: `an_${role}_${suffix}` });
const accounts = { free: account("free"), plus: account("plus"), pro: account("pro") };
const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const browser = await chromium.launch({ headless: true });
const contexts = [];
const userIds = [];

function localSql(sql) {
  const cli = resolve(process.cwd(), "node_modules/supabase/dist/supabase.js");
  const output = execFileSync(process.execPath, [cli, "db", "query", "--local", "--output-format", "json", sql], { encoding: "utf8" });
  const jsonStart = output.indexOf("{");
  assert(jsonStart >= 0, "Local Setuvara SQL query should return JSON");
  return JSON.parse(output.slice(jsonStart)).rows;
}

async function readConfirmationUrl(email) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const messages = (await (await fetch(`${mailpitUrl}/api/v1/messages?limit=50`)).json()).messages ?? [];
    const found = messages.find((message) => JSON.stringify(message.To ?? message.to ?? []).toLowerCase().includes(email.toLowerCase()));
    if (found) {
      const detail = await (await fetch(`${mailpitUrl}/api/v1/message/${encodeURIComponent(found.ID ?? found.id)}`)).json();
      const raw = `${detail.HTML ?? ""}\n${detail.Text ?? ""}`.match(/https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/i)?.[0];
      assert(raw, "Local signup email must use the Setuvara /auth/confirm route");
      return raw.replaceAll("&amp;", "&");
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error("Local signup confirmation email was not captured");
}

async function createAccount(item) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => { throw new Error(`Runtime error on ${page.url()}: ${error.message}`); });
  await page.goto(`${appUrl}/signup`);
  await page.getByLabel("Username").fill(item.username);
  await page.getByText("Available. It’s yours if you want it.").waitFor();
  await page.getByRole("button", { name: `Claim @${item.username}` }).click();
  await page.getByLabel("Your name").fill(`Analytics ${item.role}`);
  await page.getByLabel("Email").fill(item.email);
  await page.getByLabel("Password", { exact: true }).fill(item.password);
  await page.getByRole("button", { name: "Create my Setuvara" }).click();
  await page.getByRole("heading", { name: "Check your inbox." }).waitFor({ timeout: 15_000 });
  await page.goto(await readConfirmationUrl(item.email));
  await page.waitForURL(/\/app\/identity/, { timeout: 20_000 });
  const client = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email: item.email, password: item.password });
  assert.ifError(signIn.error);
  const id = signIn.data.user.id;
  userIds.push(id);
  assert.ifError((await client.from("profiles").update({ is_published: true }).eq("id", id)).error);
  assert.ifError((await client.from("profile_modes").update({ is_enabled: true }).eq("profile_id", id).eq("slug", "personal")).error);
  return { ...item, id, context, page };
}

function setPlan(user, plan, status = "active") {
  const subscriptionId = `sub_analytics${user.id.replaceAll("-", "").slice(0, 16)}`;
  if (!plan) {
    localSql(`update public.billing_subscriptions set provider_status='expired' where dodo_subscription_id='${subscriptionId}' returning plan_code;`);
    return;
  }
  localSql(`insert into public.billing_subscriptions(dodo_subscription_id,user_id,dodo_customer_id,dodo_product_id,plan_code,billing_interval,provider_status,current_period_end,last_provider_event_id,last_provider_event_at,last_sync_started_at)
    values ('${subscriptionId}','${user.id}','cus_analyticslocal','pdt_analyticslocal','${plan}','monthly','${status}',now() + interval '30 days','analyticsfixture',now(),now())
    on conflict (dodo_subscription_id) do update set plan_code=excluded.plan_code, provider_status=excluded.provider_status returning plan_code;`);
}

/** Deterministic history: rising views, mixed sources/Modes/devices, some Connections, Quick QR, Tap and shares. */
function seedEvents(user, days, previousDays = 0) {
  localSql(`insert into private.product_analytics_events(idempotency_key, owner_profile_id, event_name, occurred_at, source, mode_slug, device_class)
    select gen_random_uuid(), '${user.id}'::uuid, 'profile_viewed', ((current_date - d) + time '06:00') at time zone 'UTC',
      (array['quick_qr','link','tap','qr','native_share','direct','quick_qr','link'])[1 + (d * 7 + n) % 8],
      (array['personal','personal','business','event','personal'])[1 + (d + n) % 5],
      (array['mobile','mobile','mobile','desktop','tablet','mobile'])[1 + (d * 3 + n) % 6]
    from generate_series(0, ${days - 1}) d, generate_series(0, 2 + ((${days} - d) % 5)) n
    union all
    select gen_random_uuid(), '${user.id}'::uuid, 'profile_viewed', ((current_date - d) + time '06:00') at time zone 'UTC', 'direct', 'personal', 'mobile'
    from generate_series(${days}, ${days + previousDays - 1}) d
    union all
    select gen_random_uuid(), '${user.id}'::uuid, 'connection_created', ((current_date - d) + time '07:00') at time zone 'UTC', null, 'personal', 'unknown'
    from generate_series(0, ${days - 1}) d, generate_series(0, d % 2) n where d % 4 = 1
    union all
    select gen_random_uuid(), '${user.id}'::uuid, 'quick_qr_scanned', ((current_date - d) + time '05:00') at time zone 'UTC', 'quick_qr', 'personal', 'mobile'
    from generate_series(0, ${days - 1}) d where d % 2 = 0
    union all
    select gen_random_uuid(), '${user.id}'::uuid, 'tap_scanned', ((current_date - d) + time '05:30') at time zone 'UTC', 'tap', 'business', 'mobile'
    from generate_series(0, ${days - 1}) d where d % 3 = 0
    union all
    select gen_random_uuid(), '${user.id}'::uuid, 'profile_shared', ((current_date - d) + time '04:00') at time zone 'UTC', 'link', 'personal', 'unknown'
    from generate_series(0, ${days - 1}) d where d % 5 = 0
    returning event_name;`);
}

const isoDay = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(size.scroll <= size.client + 1, `${label} overflows horizontally (${size.scroll} > ${size.client})`);
}

async function openAnalytics(page) {
  await page.goto(`${appUrl}/app/analytics`);
  await page.locator("main [aria-label='Date range']").waitFor();
  await page.waitForFunction(() => !document.querySelector("[aria-busy='true']"), null, { timeout: 15_000 });
}

async function shoot(page, name, sizes = [[390, 844], [768, 1024], [1440, 900]]) {
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    await noOverflow(page, `${name} ${width}x${height}`);
    await page.screenshot({ path: `${screenshots}/${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

async function expectPaywall(page, chip, target, title) {
  const trigger = page.locator("main [aria-label='Date range'] button").filter({ hasText: chip }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("heading", { name: title }).waitFor();
  assert.equal(await page.locator(`[data-analytics-paywall='${target}'] [data-member-badge='${target}']`).count(), 1, "The sheet shows the target member badge");
  assert.match(await dialog.innerText(), /Not now/);
  assert.doesNotMatch(await dialog.innerText(), /unavailable on your plan|upgrade required|—/i);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(await trigger.evaluate((node) => node === document.activeElement), true, "Focus returns to the chip that opened the sheet");
}

async function publicBadge(username) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${appUrl}/${username}`);
  await page.locator("h1").first().waitFor();
  const tiers = await page.locator("[data-member-badge]").evaluateAll((nodes) => nodes.map((node) => [node.getAttribute("data-member-badge"), node.getAttribute("aria-label")]));
  const verified = await page.getByText(/verified/i).count();
  await context.close();
  assert.equal(verified, 0, "Member status is never described as verification");
  return tiers;
}

try {
  const [free, plus, pro] = [await createAccount(accounts.free), await createAccount(accounts.plus), await createAccount(accounts.pro)];
  setPlan(plus, "plus");
  setPlan(pro, "pro");

  // ---------- API enforcement ----------
  const anon = await browser.newContext();
  assert.equal((await anon.request.get(`${appUrl}/api/analytics?range=7d`)).status(), 401);
  assert.equal((await anon.request.get(`${appUrl}/api/analytics/export?range=7d`)).status(), 401);
  await anon.close();
  const status = async (user, path) => (await user.page.request.get(`${appUrl}${path}`)).status();
  const custom = `range=custom&from=${isoDay(-29)}&to=${isoDay(0)}`;
  for (const path of ["/api/analytics?range=30d", "/api/analytics?range=90d", `/api/analytics?${custom}`, `/api/analytics?range=7d&from=${isoDay(-6)}&to=${isoDay(0)}`, "/api/analytics?range=7d&mode=event", "/api/analytics?range=7d&source=qr", "/api/analytics?range=30d&plan=pro", "/api/analytics/export?range=7d"]) {
    assert.equal(await status(free, path), 403, `Free cannot reach ${path}`);
  }
  for (const path of [`/api/analytics?${custom}`, `/api/analytics/export?range=30d`, `/api/analytics?${custom}&plan=pro`]) {
    assert.equal(await status(plus, path), 403, `Plus cannot reach ${path}`);
  }
  assert.equal(await status(pro, `/api/analytics?range=custom&from=${isoDay(-730)}&to=${isoDay(0)}`), 403, "Pro is capped at 730 days");
  assert.equal(await status(pro, "/api/analytics?range=7d&device=mobile"), 400);
  console.log("PASS server enforcement: Free/Plus/Pro ranges, filters, export and spoofed plan params");

  // ---------- Zero data for every plan: 200, Day One, no NaN ----------
  for (const user of [free, plus, pro]) {
    const body = await (await user.page.request.get(`${appUrl}/api/analytics?range=7d`)).json();
    assert.equal(body.summary.profileViews + body.summary.connections + body.summary.qrScans + body.summary.quickQrScans + body.summary.tapScans, 0);
    await openAnalytics(user.page);
    await user.page.getByText("Share once, and this page starts telling your story.").waitFor();
    await user.page.getByRole("heading", { level: 1, name: "Your story starts the first time you share." }).waitFor();
    const text = await user.page.locator("main").innerText();
    assert.doesNotMatch(text, /NaN|Infinity|undefined|couldn.t load/);
    assert.equal(await user.page.locator("main [role='alert']").count(), 0, `${user.role} zero data is not an error`);
  }
  assert.deepEqual((await (await pro.page.request.get(`${appUrl}/api/analytics?range=7d`)).json()).funnel.map((step) => step.count), [0, 0, 0]);
  const emptyCsv = await pro.page.request.get(`${appUrl}/api/analytics/export?range=7d`);
  assert.equal(emptyCsv.status(), 200);
  assert.match(await emptyCsv.text(), /date","profile_views/);
  await shoot(free.page, "free-day-one");
  await free.page.getByRole("button", { name: "Copy your link" }).click();
  await free.page.getByRole("button", { name: "Link copied" }).waitFor();
  assert.equal(await free.page.evaluate(() => navigator.clipboard.readText()), `${appUrl}/${free.username}?source=link`);
  assert.equal(await free.page.getByRole("link", { name: "Show Quick QR" }).getAttribute("href"), "/app/tap");
  console.log("PASS zero data: Free, Plus and Pro show Day One on 200, never the error card");

  // ---------- Free ----------
  await free.page.getByLabel("Your plan: Free plan").filter({ visible: true }).waitFor();
  assert.equal(await free.page.locator("main [data-member-badge]").count(), 0, "Free has no paid member badge");
  let checkoutBody = null;
  await free.page.route("**/api/billing/checkout", async (route) => { checkoutBody = route.request().postDataJSON(); await route.fulfill({ status: 503, contentType: "application/json", body: "{}" }); });
  await expectPaywall(free.page, "30D", "plus", "See what brings people to you.");
  await expectPaywall(free.page, "90D", "plus", "See what brings people to you.");
  await expectPaywall(free.page, "Custom", "pro", "Go deeper into how your identity performs over time.");
  await free.page.locator("main [aria-label='Date range'] button").filter({ hasText: "30D" }).click();
  await shoot(free.page, "free-plus-sheet", [[390, 844], [1440, 900]]);
  await free.page.getByRole("button", { name: /\/ year/ }).click();
  await free.page.getByRole("button", { name: "Unlock with Plus" }).click();
  await free.page.getByText("Billing could not open right now. Your plan is unchanged.").waitFor();
  assert.deepEqual(checkoutBody, { plan: "plus", interval: "yearly" }, "Plus sheet uses the canonical checkout for Plus");
  await free.page.getByRole("button", { name: "Not now" }).click();
  await free.page.locator("main [aria-label='Date range'] button").filter({ hasText: "Custom" }).click();
  await shoot(free.page, "free-pro-sheet", [[390, 844], [1440, 900]]);
  await free.page.getByRole("button", { name: "Explore Pro" }).click();
  await free.page.getByText("Billing could not open right now. Your plan is unchanged.").waitFor();
  assert.deepEqual(checkoutBody, { plan: "pro", interval: "monthly" }, "Pro sheet uses the canonical checkout for Pro");
  await free.page.keyboard.press("Escape");
  await free.page.unroute("**/api/billing/checkout");
  seedEvents(free, 7, 7);
  await openAnalytics(free.page);
  await free.page.getByText("How you were scanned").waitFor();
  await free.page.getByRole("heading", { name: "See what brings people to you." }).waitFor();
  assert.equal(await free.page.getByText("Over time", { exact: true }).count(), 0, "Free gets no chart");
  assert.equal(await free.page.getByText("Your Modes", { exact: true }).count(), 0);
  const freeData = await (await free.page.request.get(`${appUrl}/api/analytics?range=7d`)).json();
  const views = await free.page.locator("[data-metric='profile-views']").innerText();
  assert.equal(views.replace(/\D/g, ""), String(freeData.summary.profileViews), "Hero shows the real profile view count");
  assert.deepEqual([freeData.daily, freeData.modes, freeData.sources], [[], [], []], "Free payload carries no daily series or breakdowns");
  await shoot(free.page, "free-data", [[390, 844], [768, 1024], [1440, 900], [320, 700], [430, 932]]);
  await free.page.getByRole("button", { name: "Unlock deeper analytics" }).click();
  await free.page.getByRole("dialog").getByRole("heading", { name: "See what brings people to you." }).waitFor();
  await free.page.keyboard.press("Escape");
  assert.deepEqual(await publicBadge(free.username), [], "Free public profile has no member badge");
  console.log("PASS Free: 7D works, 30D/90D open Plus sheet, Custom opens Pro sheet, CTAs use canonical checkout");

  // ---------- Plus ----------
  seedEvents(plus, 90, 30);
  await openAnalytics(plus.page);
  await plus.page.getByLabel("Your plan: Setuvara Plus member").filter({ visible: true }).waitFor();
  assert.equal(await plus.page.locator("main [data-plan-pill] [data-member-badge='plus']").count(), 2, "Plus pill (mobile + desktop instance) uses the Plus badge");
  assert.equal(await plus.page.locator("main [data-member-badge='pro']").count(), 1, "Only the Pro hint shows the Pro artwork");
  for (const range of ["30D", "90D", "7D"]) {
    await Promise.all([
      plus.page.waitForResponse((response) => response.url().includes(`range=${range.toLowerCase()}`) && response.status() === 200),
      plus.page.locator("main [aria-label='Date range'] button").filter({ hasText: range }).click(),
    ]);
    await plus.page.locator(`main [aria-label='Date range'] button[aria-pressed='true']`).filter({ hasText: range }).waitFor();
  }
  await plus.page.locator("main [aria-label='Date range'] button").filter({ hasText: "30D" }).click();
  await plus.page.getByText("YOUR SIGNALS · LAST 30 DAYS").waitFor();
  await plus.page.getByText("Your Modes", { exact: true }).waitFor();
  await plus.page.getByText("How people reach you").waitFor();
  await plus.page.getByText("ARRIVES LATER").waitFor();
  await plus.page.getByText(/For every 100 views, about \d+ (people connect|person connects) with you\./).waitFor();
  await plus.page.getByRole("button", { name: "Explore Pro" }).waitFor();
  assert.equal(await plus.page.getByText("Download CSV").count(), 0, "CSV stays Pro-only");
  assert.equal(await plus.page.getByText("Your loop", { exact: true }).count(), 0);
  const plusBody = await (await plus.page.request.get(`${appUrl}/api/analytics?range=30d`)).json();
  assert.equal(plusBody.daily.length, 30);
  assert.equal(plusBody.deviceClasses.length, 0, "Plus payload has no device insights");
  assert.equal(plusBody.funnel.length, 0, "Plus payload has no funnel");
  const chart = plus.page.getByRole("group", { name: /Profile views over time/ });
  await chart.focus();
  await plus.page.keyboard.press("End");
  assert.match(await plus.page.locator("[data-chart-readout]").innerText(), / · \d+ views? · \d+ Connections?/);
  await shoot(plus.page, "plus-30d", [[390, 844], [768, 1024], [1440, 900], [320, 700], [430, 932], [1024, 768], [1920, 1080]]);
  let portalCalled = false;
  await plus.page.route("**/api/billing/portal", async (route) => { portalCalled = true; await route.fulfill({ status: 503, contentType: "application/json", body: "{}" }); });
  await plus.page.route("**/api/billing/checkout", () => { throw new Error("Plus must not start a second checkout"); });
  await expectPaywall(plus.page, "Custom", "pro", "Go deeper into how your identity performs over time.");
  await plus.page.locator("main [aria-label='Date range'] button").filter({ hasText: "Custom" }).click();
  await plus.page.getByRole("dialog").getByRole("button", { name: "Explore Pro" }).click();
  await plus.page.getByText("Billing could not open right now. Your plan is unchanged.").waitFor();
  assert(portalCalled, "Plus → Pro uses the canonical billing portal");
  await plus.page.keyboard.press("Escape");
  await plus.page.unroute("**/api/billing/portal");
  await plus.page.unroute("**/api/billing/checkout");
  assert.deepEqual(await publicBadge(plus.username), [["plus", "Setuvara Plus member"]]);
  console.log("PASS Plus: 7D/30D/90D, Modes, sources, conversion, Wallet placeholder, Custom → Pro portal, public Plus badge");

  // ---------- Pro ----------
  seedEvents(pro, 200, 0);
  await openAnalytics(pro.page);
  await pro.page.getByLabel("Your plan: Setuvara Pro member").filter({ visible: true }).waitFor();
  assert.equal(await pro.page.locator("main [data-locked]").count(), 0, "Pro has no locked chips");
  assert.equal(await pro.page.getByText(/Unlock|Explore Pro/).count(), 0, "No upsell inside Pro");
  await pro.page.locator("main [aria-label='Date range'] button").filter({ hasText: "Custom" }).click();
  await pro.page.getByLabel("From", { exact: true }).fill(isoDay(-199));
  await pro.page.getByLabel("To", { exact: true }).fill(isoDay(0));
  await Promise.all([
    pro.page.waitForResponse((response) => response.url().includes("range=custom") && response.status() === 200),
    pro.page.getByRole("button", { name: "Show range" }).click(),
  ]);
  await pro.page.getByText("YOUR SIGNALS · CUSTOM RANGE").waitFor();
  await pro.page.getByText("200 DAYS").waitFor();
  await pro.page.getByText("Every share keeps it moving.").waitFor();
  await pro.page.getByText("Where they open you").waitFor();
  const csvHref = await pro.page.getByRole("link", { name: "Download CSV" }).getAttribute("href");
  assert.equal(csvHref, `/api/analytics/export?range=custom&from=${isoDay(-199)}&to=${isoDay(0)}`);
  const csv = await pro.page.request.get(`${appUrl}${csvHref}`);
  assert.equal(csv.status(), 200);
  assert.equal((await csv.text()).trim().split(/\r?\n/).length, 201, "CSV has a header plus one row per day");
  const chartLabel = await pro.page.getByRole("group", { name: /Profile views over time/ }).getAttribute("aria-label");
  assert.match(chartLabel, /each week/, "Ranges above 90 days are drawn as weeks");
  const loopText = await pro.page.locator("section[aria-labelledby='loop-title']").innerText();
  assert.doesNotMatch(loopText, /%/, "The loop shows no rates between different event types");
  await shoot(pro.page, "pro-custom", [[390, 844], [768, 1024], [1440, 900], [1024, 768], [1920, 1080]]);
  assert.deepEqual(await publicBadge(pro.username), [["pro", "Setuvara Pro member"]], "Pro shows one Pro badge, no Plus badge");

  // Partial data, rendered from real-shaped payloads through the client normalizer.
  const partials = [
    { name: "views-no-connections", summary: { profileViews: 12, qrScans: 0, quickQrScans: 0, tapScans: 0, connections: 0, conversionRate: 0 }, sources: [{ source: "link", count: 12 }], modes: [], daily: [{ date: isoDay(0), profileViews: 12, connections: 0 }], comparison: null, expect: "No Mode views in this period yet." },
    { name: "connections-no-scans", summary: { profileViews: 4, qrScans: 0, quickQrScans: 0, tapScans: 0, connections: 2, conversionRate: 50 }, sources: [], modes: [{ mode: "event", count: 4 }], daily: [], comparison: { profileViewsDelta: -20, connectionsDelta: null }, expect: "No source activity in this period yet." },
  ];
  for (const partial of partials) {
    await pro.page.route(/\/api\/analytics\?/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      plan: "pro", range: { kind: "7d", start: isoDay(-6), end: isoDay(0) }, summary: partial.summary, daily: partial.daily, sources: partial.sources, modes: partial.modes,
      deviceClasses: [], funnel: [], comparison: partial.comparison,
      capabilities: { historyDays: 730, availableRanges: ["7d", "30d", "90d", "custom"], sourceBreakdown: true, modeBreakdown: true, deviceInsights: true, conversion: true, funnels: true, customRange: true, exports: true },
    }) }));
    await openAnalytics(pro.page);
    await pro.page.getByText(partial.expect).waitFor();
    await pro.page.getByText("No device data in this period yet.").waitFor();
    assert.doesNotMatch(await pro.page.locator("main").innerText(), /NaN|Infinity|undefined/);
    await pro.page.unroute(/\/api\/analytics\?/);
  }

  // Real error: calm card, no zeros, retry refetches the same range.
  let failNext = true;
  const requested = [];
  await pro.page.route(/\/api\/analytics\?/, async (route) => {
    requested.push(new URL(route.request().url()).search);
    if (failNext) await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"analytics_unavailable"}' });
    else await route.continue();
  });
  await pro.page.goto(`${appUrl}/app/analytics`);
  await pro.page.getByRole("heading", { name: "We couldn't load your signals right now." }).waitFor();
  assert.equal(await pro.page.locator("[data-metric='profile-views']").count(), 0, "The error state never renders numbers");
  await shoot(pro.page, "error", [[390, 844]]);
  failNext = false;
  await pro.page.getByRole("button", { name: "Try again" }).click();
  await pro.page.locator("[data-metric='profile-views']").waitFor();
  assert.equal(requested.at(-1), requested.at(-2), "Try again refetches the same range");
  await pro.page.unroute(/\/api\/analytics\?/);

  // Loading skeleton.
  await pro.page.route(/\/api\/analytics\?/, async (route) => { await new Promise((done) => setTimeout(done, 1500)); await route.continue(); });
  await pro.page.goto(`${appUrl}/app/analytics`);
  await pro.page.locator("main").getByText("LOADING YOUR SIGNALS…").waitFor();
  await pro.page.screenshot({ path: `${screenshots}/loading-390.png` });
  await pro.page.locator("[data-metric='profile-views']").waitFor();
  await pro.page.unroute(/\/api\/analytics\?/);
  console.log("PASS Pro: custom 200 days as weeks, loop, devices, CSV, partial data, error retry, loading");

  // ---------- Badge downgrade / upgrade through canonical billing state ----------
  setPlan(pro, "plus");
  assert.deepEqual(await publicBadge(pro.username), [["plus", "Setuvara Plus member"]], "Pro → Plus shows the Plus badge");
  setPlan(plus, null);
  assert.deepEqual(await publicBadge(plus.username), [], "Plus → Free removes the badge");
  await openAnalytics(plus.page);
  await plus.page.getByLabel("Your plan: Free plan").filter({ visible: true }).waitFor();
  assert.equal((await plus.page.request.get(`${appUrl}/api/analytics?range=30d`)).status(), 403, "Downgraded Plus loses 30D server-side");
  setPlan(free, "plus");
  assert.deepEqual(await publicBadge(free.username), [["plus", "Setuvara Plus member"]], "Free → Plus adds the Plus badge");
  setPlan(free, "pro");
  assert.deepEqual(await publicBadge(free.username), [["pro", "Setuvara Pro member"]], "Plus → Pro replaces it with the Pro badge");
  setPlan(free, null);
  assert.deepEqual(await publicBadge(free.username), [], "Pro → Free removes the badge");
  const profileStillThere = localSql(`select display_name from public.profiles where id='${free.id}';`);
  assert.equal(profileStillThere[0]?.display_name, "Analytics free", "Downgrades delete no identity data");
  console.log("PASS member badges: upgrade and downgrade follow the canonical billing state");
  console.log(`Screenshots: ${screenshots}`);
} finally {
  for (const context of contexts) await context.close().catch(() => undefined);
  await browser.close();
  for (const id of userIds) {
    localSql(`delete from public.billing_subscriptions where user_id='${id}' returning user_id;`);
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
}
