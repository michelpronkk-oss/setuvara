/**
 * Visual end-to-end check of the ten Appearances against a LOCAL Setuvara stack.
 *
 * Seeds Plus members with generated portraits (faces high, low and to one side), real links,
 * image blocks and a Live Context, then opens every Appearance at 390, 768 and 1440 wide and
 * checks: no horizontal overflow, one visible Connect, face-safe decisions, Live Context, the
 * floating Connect after the hero, the picker showing exactly ten, and Free plan fallbacks.
 *
 *   E2E_APP_URL=http://127.0.0.1:3014 \
 *   E2E_SUPABASE_URL=http://127.0.0.1:54321 \
 *   E2E_LOCAL_SERVICE_KEY=<local service role key> \
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key> \
 *   E2E_SCREENSHOTS=./.e2e-appearance \
 *   node scripts/e2e-appearance.mjs
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const shots = process.env.E2E_SCREENSHOTS;
assert(new URL(appUrl).hostname === "127.0.0.1" && new URL(supabaseUrl).hostname === "127.0.0.1", "Appearance E2E runs against local Setuvara only");
assert(publishableKey, "The local Setuvara publishable key is required");
assert(serviceKey, "E2E_LOCAL_SERVICE_KEY (local stack) is required to seed test profiles");
if (shots) mkdirSync(shots, { recursive: true });

const APPEARANCES = ["immersive", "motion", "aura", "clean", "glow", "scene", "frame", "stack", "social", "film"];
const WIDTHS = [[390, 844], [768, 1024], [1440, 900]];
const stamp = Date.now().toString(36);
const seededUsers = [];
const admin = (path, init = {}) => fetch(`${supabaseUrl}${path}`, { ...init, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers } }).then(async (response) => {
  const body = await response.text();
  assert(response.ok, `${init.method ?? "GET"} ${path}: ${response.status} ${body}`);
  return body ? JSON.parse(body) : null;
});
function localSql(sql) {
  const cli = resolve(process.cwd(), "node_modules/supabase/dist/supabase.js");
  execFileSync(process.execPath, [cli, "db", "query", "--local", "--output-format", "json", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}
const shot = async (page, name, fullPage = false) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage }); };

/** A generated head-and-shoulders portrait (4:5) with the face centred at (fx, fy) percent. */
async function portrait(browser, fx, fy, palette = ["#2b3a55", "#c97b5a", "#1a1414"]) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const [bg, skin, hair] = palette;
  const x = (fx / 100) * 1080;
  const y = (fy / 100) * 1350;
  await page.setContent(`<body style="margin:0;width:1080px;height:1350px;overflow:hidden;background:linear-gradient(170deg,${bg},#0e1220 70%);position:relative">
    <div style="position:absolute;left:${x - 330}px;top:${y + 230}px;width:660px;height:900px;border-radius:330px 330px 0 0;background:linear-gradient(#3a3f4a,#16181d)"></div>
    <div style="position:absolute;left:${x - 70}px;top:${y + 120}px;width:140px;height:170px;background:${skin};filter:brightness(.82)"></div>
    <div style="position:absolute;left:${x - 175}px;top:${y - 245}px;width:350px;height:330px;border-radius:50%;background:${hair}"></div>
    <div style="position:absolute;left:${x - 150}px;top:${y - 190}px;width:300px;height:380px;border-radius:48% 48% 46% 46%;background:radial-gradient(circle at 45% 40%,#e9b896,${skin})"></div>
    <div style="position:absolute;left:${x - 80}px;top:${y - 40}px;width:34px;height:16px;border-radius:50%;background:#2a1b17"></div>
    <div style="position:absolute;left:${x + 46}px;top:${y - 40}px;width:34px;height:16px;border-radius:50%;background:#2a1b17"></div>
    <div style="position:absolute;left:${x - 48}px;top:${y + 92}px;width:96px;height:22px;border-radius:0 0 48px 48px;background:#8c3b3b"></div>
  </body>`);
  const png = await page.screenshot({ type: "jpeg", quality: 88 });
  await page.close();
  return png;
}

async function scene(browser, colours, label) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.setContent(`<body style="margin:0;width:1200px;height:900px;background:linear-gradient(135deg,${colours[0]},${colours[1]});display:grid;place-items:center;font:700 120px system-ui;color:#ffffff22">${label}</body>`);
  const png = await page.screenshot({ type: "jpeg", quality: 85 });
  await page.close();
  return png;
}

async function upload(userId, bytes, extension = "jpg") {
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/profile-media/${path}`, { method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": extension === "png" ? "image/png" : "image/jpeg" }, body: bytes });
  assert(response.ok, `upload: ${response.status} ${await response.text()}`);
  return path;
}

const LINKS = [
  ["instagram", "Instagram", "https://instagram.com/aanya.rao"],
  ["linkedin", "LinkedIn", "https://www.linkedin.com/in/aanyarao"],
  ["spotify", "Spotify", "https://open.spotify.com/artist/1"],
  ["website", "Portfolio", "https://aanya.studio"],
  ["x", "X", "https://x.com/aanyarao"],
  ["website", "Studio journal", "https://aanya.studio/journal"],
  ["website", "Talk: Calm tools", "https://aanya.studio/talks/calm-tools"],
  ["website", "Reading list", "https://aanya.studio/reading"],
];

async function seedUser(name, displayName, { plan = "plus", face = [50, 30], bio = "Product designer in Lisbon. Building calm tools for loud rooms.", live = true } = {}) {
  const username = `${name}${stamp}`.slice(0, 30);
  const email = `${username}@example.test`;
  const password = `Appearance-${crypto.randomUUID()}aA1!`;
  const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username, display_name: displayName } }) });
  const owner = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  assert.ifError((await owner.auth.signInWithPassword({ email, password })).error);
  assert.ifError((await owner.from("profiles").update({ is_published: true, bio }).eq("id", user.id)).error);
  await owner.auth.signOut({ scope: "local" });
  if (plan !== "free") {
    localSql(`insert into public.billing_subscriptions(dodo_subscription_id,user_id,dodo_customer_id,dodo_product_id,plan_code,billing_interval,provider_status,current_period_end,last_provider_event_id,last_provider_event_at,last_sync_started_at)
      values ('sub_appearance${user.id.replaceAll("-", "").slice(0, 16)}','${user.id}','cus_appearancelocal','pdt_appearancelocal','${plan}','monthly','active',now() + interval '30 days','appearancefixture',now(),now())`);
  }
  if (live) {
    localSql(`insert into public.live_contexts(owner_user_id, context_type, label, expires_at) values ('${user.id}', 'event', 'Web Summit Lisbon', now() + interval '3 hours')`);
  }
  const seeded = { id: user.id, username, email, password, plan, face };
  seededUsers.push(seeded);
  return seeded;
}

async function dressModes(browser, user, { images = 3 } = {}) {
  const rows = await admin(`/rest/v1/profile_modes?profile_id=eq.${user.id}&select=id,slug`);
  const photo = await upload(user.id, await portrait(browser, user.face[0], user.face[1]));
  const pictures = [];
  for (let index = 0; index < images; index += 1) pictures.push(await upload(user.id, await scene(browser, [["#ff5a4f", "#3d1f8c"], ["#1d3557", "#a8dadc"], ["#264653", "#e9c46a"]][index % 3], ["Studio", "Lisbon", "Talk"][index % 3])));
  for (const row of rows) {
    await admin(`/rest/v1/profile_modes?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ is_enabled: true, image_path: photo, image_focus_x: user.face[0], image_focus_y: user.face[1], appearance: { theme: "immersive", accent: "#FF5A4F" }, settings: row.slug === "event" ? { eventName: "Web Summit", city: "Lisbon", dateLabel: "Nov 2026", role: "Founder", hereToMeet: "Designers" } : row.slug === "business" ? { role: "Founder", company: "Setuvara", city: "Amsterdam", description: "Identity, in person." } : { location: "Lisbon" } }) });
    for (const [index, [type, title, url]] of LINKS.entries()) {
      await admin("/rest/v1/profile_links", { method: "POST", body: JSON.stringify({ profile_id: user.id, mode_id: row.id, link_type: type, title, url, is_visible: true, sort_order: index }) });
    }
    for (const [index, path] of pictures.entries()) {
      await admin("/rest/v1/profile_blocks", { method: "POST", body: JSON.stringify({ profile_id: user.id, mode_id: row.id, kind: "image", sort_order: index, is_visible: true, data: { image_path: path, alt: `Work ${index + 1}`, caption: "" } }) });
    }
  }
  return rows;
}

const setAppearance = (user, slug, appearance) => admin(`/rest/v1/profile_modes?profile_id=eq.${user.id}&slug=eq.${slug}`, { method: "PATCH", body: JSON.stringify({ appearance: { accent: "#FF5A4F", ...appearance } }) });

async function inspect(page, label, { connect = true } = {}) {
  const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(size.scroll <= size.client + 1, `${label}: horizontal overflow (${size.scroll} > ${size.client})`);
  const visibleConnect = await page.getByRole("button", { name: /^Connect(?: at .+)?$/ }).count();
  if (connect) assert.equal(visibleConnect, 1, `${label}: exactly one visible Connect`);
  assert.equal(await page.getByText(/Save contact/i).count(), 0, `${label}: never Save contact`);
  assert.equal(await page.locator('a[href*="vcard"], a[href$=".vcf"]').count(), 0, `${label}: no vCard`);
  assert.equal(await page.getByRole("dialog").count(), 0, `${label}: nothing opens on load`);
}

const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM ?? undefined });
try {
  // E2E_ONLY=content runs just the content and branding checks (quick visual loop).
  const only = process.env.E2E_ONLY;
  const aanya = await seedUser("aanya", "Aanya Rao", { face: [50, 30] });
  const low = only ? null : await seedUser("lowface", "Maximiliana Wolkenstein", { face: [50, 58] });
  const side = only ? null : await seedUser("sideface", "Theo Lind", { face: [28, 34], live: false });
  const free = await seedUser("freeaanya", "Free Aanya", { plan: "free", face: [50, 30], live: false });
  for (const user of [aanya, low, side, free].filter(Boolean)) await dressModes(browser, user);

  // ---- Content under the Appearances: a single picture, a link preview and a video read as
  // refined cards (never a wall of image), the hero dissolves into the page without a cut, and
  // only Free profiles carry the setuvara mark.
  {
    const mla = await seedUser("mla", "M.L.A", { face: [50, 34], bio: "CEO", live: false });
    const [row] = await admin(`/rest/v1/profile_modes?profile_id=eq.${mla.id}&slug=eq.personal&select=id`);
    const photo = await upload(mla.id, await portrait(browser, 50, 34, ["#3a2a20", "#b97a5a", "#120d0b"]));
    const poster = await upload(mla.id, await scene(browser, ["#0b1a3a", "#1e90ff"], "Production"));
    await admin(`/rest/v1/profile_modes?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ is_enabled: true, image_path: photo, image_focus_x: 50, image_focus_y: 34, appearance: { theme: "immersive", accent: "#FF5A4F" }, settings: { location: "Amsterdam" } }) });
    for (const [index, [type, title, url]] of [["instagram", "Instagram", "https://instagram.com/mla"], ["tiktok", "TikTok", "https://www.tiktok.com/@milentonio"]].entries()) {
      await admin("/rest/v1/profile_links", { method: "POST", body: JSON.stringify({ profile_id: mla.id, mode_id: row.id, link_type: type, title, url, is_visible: true, sort_order: index }) });
    }
    const blocks = [
      { kind: "image", data: { image_path: poster, alt: "Verify what's live in production", caption: "" } },
      { kind: "feature", data: { url: "https://auterim.com", title: "Auterim", description: "Verify what's live in production.", image: null, image_path: poster, siteName: "auterim.com", cta: "Visit" } },
      { kind: "video", data: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Launch film", caption: "" } },
    ];
    for (const [index, block] of blocks.entries()) await admin("/rest/v1/profile_blocks", { method: "POST", body: JSON.stringify({ profile_id: mla.id, mode_id: row.id, sort_order: index, is_visible: true, ...block }) });
    for (const id of ["immersive", "clean", "glow", "film"]) {
      await setAppearance(mla, "personal", { theme: id });
      for (const [width, height] of [[390, 844], [1440, 900]]) {
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
        const page = await context.newPage();
        await page.goto(`${appUrl}/${mla.username}`);
        await page.locator(`article[data-appearance="${id}"]`).waitFor();
        await page.waitForLoadState("networkidle");
        await inspect(page, `content ${id} @${width}`);
        // Scroll the hero's end to mid-screen: it must dissolve into the page, not cut.
        await page.evaluate(() => {
          const box = [...document.querySelectorAll("[data-hero], [data-wide-hero]")].map((node) => node.getBoundingClientRect()).find((rect) => rect.height > 0);
          if (box) window.scrollTo(0, window.scrollY + box.bottom - window.innerHeight / 2);
        });
        await page.waitForTimeout(250);
        await shot(page, `content-${id}-${width}-seam`);
        await page.evaluate(() => window.scrollTo(0, document.querySelector("[data-appearance-content]")?.getBoundingClientRect().top + window.scrollY - 40));
        await page.waitForTimeout(250);
        await shot(page, `content-${id}-${width}-content`);
        // A picture is framed, never taller than the column is wide.
        const media = await page.locator("[data-featured-media]").boundingBox();
        assert(media && media.height <= Math.min(media.width, 420) + 1, `${id} @${width}: picture stays in proportion (${JSON.stringify(media)})`);
        assert.equal(await page.locator("[data-attribution]").count(), 0, `${id}: Plus profiles carry no setuvara branding`);
        // Each platform shows once: under the name by default, never again in the link rows.
        for (const url of ["https://instagram.com/mla", "https://www.tiktok.com/@milentonio"]) {
          assert.equal(await page.locator(`a[href$="${url.replace(/^https:\/\/(www\.)?/, "")}"]:visible`).count(), 1, `${id} @${width}: ${url} shows once`);
          assert.equal(await page.locator(`[data-profile-links] a[href$="${url.replace(/^https:\/\/(www\.)?/, "")}"]`).count(), 0, `${id} @${width}: not repeated in the rows`);
        }
        await context.close();
      }
    }
    // "In links": the icons leave the name and live only in the rows.
    await setAppearance(mla, "personal", { theme: "immersive", socialStyle: "hidden" });
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto(`${appUrl}/${mla.username}`);
      await page.locator('article[data-appearance="immersive"]').waitFor();
      for (const url of ["https://instagram.com/mla", "https://www.tiktok.com/@milentonio"]) {
        assert.equal(await page.locator(`a[href$="${url.replace(/^https:\/\/(www\.)?/, "")}"]:visible`).count(), 1, `in links: ${url} shows once`);
        assert.equal(await page.locator(`[data-profile-links] a[href$="${url.replace(/^https:\/\/(www\.)?/, "")}"]`).count(), 1, `in links: ${url} is a row`);
      }
      assert.equal(await page.locator("[data-social-style]").count(), 0, "in links: nothing under the name");
      await page.evaluate(() => window.scrollTo(0, document.querySelector("[data-profile-links]")?.getBoundingClientRect().top + window.scrollY - 360));
      await page.waitForTimeout(250);
      await shot(page, "socials-in-links");
      await context.close();
    }
    // Free carries the refined setuvara mark at the end of the profile; it links to Make yours.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${appUrl}/${free.username}`);
    const mark = page.locator("[data-attribution]");
    await mark.waitFor();
    assert.match(await page.getByRole("link", { name: /Make yours on Setuvara/ }).first().getAttribute("href"), /^\/signup\?appearance=immersive$/);
    await mark.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await shot(page, "content-free-branding");
    await context.close();
    console.log("PASS content is refined, the hero dissolves, branding is Free only, socials show once");
  }

  if (!only) {
  // ---- Every Appearance at every width, as a visitor.
  for (const id of APPEARANCES) {
    await setAppearance(aanya, "personal", { theme: id });
    for (const [width, height] of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto(`${appUrl}/${aanya.username}`);
      await page.locator(`article[data-appearance="${id}"]`).waitFor();
      await page.waitForLoadState("networkidle");
      await inspect(page, `${id} @${width}`);
      assert.equal(await page.locator("[data-live-context]:visible").count(), 1, `${id} @${width}: Live Context visible`);
      assert.match(await page.locator("[data-live-context]:visible").innerText(), /Live · Web Summit Lisbon · until \d\d:\d\d/);
      await shot(page, `${id}-${width}`);
      if (width === 390) {
        await shot(page, `${id}-${width}-full`, true);
        // One floating Connect appears once the hero's Connect has scrolled away.
        await page.evaluate(() => window.scrollTo(0, Math.min(window.innerHeight * 1.4, document.documentElement.scrollHeight - window.innerHeight)));
        await page.waitForFunction(() => document.querySelector("[data-floating-connect]")?.getAttribute("data-visible") === "true");
        await page.waitForTimeout(400);
        await shot(page, `${id}-${width}-scrolled`);
        const onScreen = await page.evaluate(() => [...document.querySelectorAll("[data-connect-trigger], [data-floating-connect]")].map((node) => {
          const box = node.getBoundingClientRect();
          return { floating: node.hasAttribute("data-floating-connect"), shown: node.offsetParent !== null && box.width > 0 && box.bottom > 0 && box.top < window.innerHeight && getComputedStyle(node.parentElement).opacity !== "0", top: Math.round(box.top), parent: Boolean(node.offsetParent) };
        }));
        assert.equal(onScreen.filter((item) => item.shown).length, 1, `${id}: exactly one Connect on screen while scrolled ${JSON.stringify(onScreen)}`);
      }
      await context.close();
    }
    console.log(`PASS ${id} at 390 / 768 / 1440`);
  }

  // ---- Face-safe matrix: high, low and side faces; Top and Bottom name positions; zoom; long names.
  const faces = [[aanya, "high"], [low, "low"], [side, "side"]];
  for (const [user, label] of faces) {
    for (const extra of [{}, { namePosition: "top" }, { namePosition: "bottom" }, { portraitZoom: 140 }, { portraitNameSize: "statement" }]) {
      await setAppearance(user, "personal", { theme: "immersive", ...extra });
      for (const [width, height] of [[390, 844], [360, 640]]) {
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
        const page = await context.newPage();
        await page.goto(`${appUrl}/${user.username}`);
        const hero = page.locator("[data-profile-hero-mobile] [data-face-strategy]");
        await hero.waitFor();
        await page.waitForLoadState("networkidle");
        const strategy = await hero.getAttribute("data-face-strategy");
        assert(["bottom", "top", "split"].includes(strategy), `${label}: strategy`);
        if (extra.namePosition === "bottom") assert.equal(strategy, "bottom", `${label}: Bottom keeps the name low`);
        await inspect(page, `face ${label} ${JSON.stringify(extra)} @${width}`);
        const tag = Object.entries(extra).map(([key, value]) => `${key}-${value}`).join("_") || "auto";
        await shot(page, `face-${label}-${tag}-${width}x${height}`);
        await context.close();
      }
    }
  }
  console.log("PASS face-safe matrix");

  // ---- Every Mode wears its own Appearance; Business defaults to Clean.
  await setAppearance(aanya, "personal", { theme: "glow" });
  await setAppearance(aanya, "event", { theme: "motion" });
  await setAppearance(aanya, "business", { theme: "clean" });
  for (const [slug, expected] of [["personal", "glow"], ["event", "motion"], ["business", "clean"]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${appUrl}/${aanya.username}?mode=${slug}`);
    await page.locator(`article[data-appearance="${expected}"][data-profile-mode="${slug}"]`).waitFor();
    await inspect(page, `mode ${slug}`);
    await shot(page, `mode-${slug}-${expected}`);
    await context.close();
  }
  console.log("PASS each Mode wears its own Appearance");

  // ---- Free member with a saved Plus look renders the Free equivalent; config is untouched.
  {
    localSql(`update public.profile_modes set appearance = '{"theme":"film","accent":"#6B4EFF","motion":"full"}'::jsonb where profile_id = '${free.id}' and slug = 'personal'`);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${appUrl}/${free.username}`);
    await page.locator('article[data-appearance="immersive"]').waitFor();
    await inspect(page, "free fallback");
    await page.locator('[data-attribution="setuvara"]').waitFor();
    assert.match(await page.getByRole("link", { name: /Make yours on Setuvara/ }).first().getAttribute("href"), /^\/signup\?appearance=immersive$/);
    await shot(page, "free-film-renders-immersive", true);
    const [row] = await admin(`/rest/v1/profile_modes?profile_id=eq.${free.id}&slug=eq.personal&select=appearance`);
    assert.equal(row.appearance.theme, "film", "Downgrade never deletes the saved look");
    // ?source=tap and ?appearance= never open or grant anything.
    for (const query of ["?source=tap", "?source=quick_qr", "?appearance=film"]) {
      await page.goto(`${appUrl}/${free.username}${query}`);
      await page.locator('article[data-appearance="immersive"]').waitFor();
      await inspect(page, `query ${query}`);
    }
    await context.close();
    console.log("PASS Free fallback keeps config; URL hints grant nothing");
  }

  // ---- Editor: the picker shows exactly ten; Free can preview a Plus look; Apply opens the paywall.
  for (const [user, width, height] of [[free, 1440, 960], [free, 390, 844], [aanya, 1440, 960]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${appUrl}/login`);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL(/\/app/);
    await page.goto(`${appUrl}/app/identity?mode=personal&section=appearance`);
    const picker = page.locator("[data-appearance-picker]:visible").first();
    await picker.waitFor();
    assert.equal(await picker.locator("[data-direction]").count(), 10, `${user.plan} @${width}: the picker shows exactly ten`);
    assert.deepEqual(await picker.locator("[data-direction]").evaluateAll((items) => items.map((item) => item.getAttribute("data-direction"))), APPEARANCES);
    await page.waitForLoadState("networkidle");
    await shot(page, `editor-${user.plan}-${width}`);
    if (user.plan === "free") {
      await picker.locator('[data-direction="glow"] button').click();
      const apply = page.getByRole("button", { name: /^Apply/ }).first();
      await apply.waitFor();
      await shot(page, `editor-${user.plan}-${width}-previewing-glow`);
      await apply.click();
      const sheet = page.locator("[data-appearance-plus-sheet]");
      await sheet.waitFor();
      await sheet.getByText("Wear Glow on Personal.").waitFor();
      await shot(page, `editor-${user.plan}-${width}-paywall`);
      await sheet.getByRole("button", { name: "Keep previewing" }).click();
      const [row] = await admin(`/rest/v1/profile_modes?profile_id=eq.${user.id}&slug=eq.personal&select=appearance`);
      assert.equal(row.appearance.theme, "film", "Previewing never saves a Plus look for Free");
    } else {
      await picker.locator('[data-direction="frame"] button').click();
      await page.waitForFunction(async () => true);
      await shot(page, `editor-plus-${width}-frame`);
      // Social icons: Under name or In links; the choice is saved on the Mode.
      const personalize = page.getByRole("tab", { name: "Personalize" }).first();
      if (await personalize.count()) await personalize.click();
      const control = page.locator("[data-social-control]:visible").first();
      await control.waitFor();
      await control.getByRole("radio", { name: "In links" }).click();
      const saved = async () => (await admin(`/rest/v1/profile_modes?profile_id=eq.${user.id}&slug=eq.personal&select=appearance`))[0].appearance.socialStyle;
      for (let i = 0; i < 40 && (await saved()) !== "hidden"; i++) await page.waitForTimeout(250);
      assert.equal(await saved(), "hidden", "In links is saved");
      await control.scrollIntoViewIfNeeded();
      await shot(page, `editor-plus-${width}-socials-in-links`);
      await control.getByRole("radio", { name: "Under name" }).click();
      for (let i = 0; i < 40 && (await saved()) === "hidden"; i++) await page.waitForTimeout(250);
      assert.equal(await saved(), "rail", "Under name restores the look's own style");
    }
    await context.close();
  }
  console.log("PASS editor picker shows ten; Free previews and meets the paywall on Apply");
  }
} finally {
  await browser.close();
  const cleanup = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  for (const user of seededUsers) {
    try {
      const { data: objects } = await cleanup.storage.from("profile-media").list(user.id, { limit: 1000 });
      if (objects?.length) await cleanup.storage.from("profile-media").remove(objects.map((object) => `${user.id}/${object.name}`));
      localSql(`delete from public.billing_subscriptions where user_id = '${user.id}'`);
      await cleanup.auth.admin.deleteUser(user.id);
    } catch (error) {
      console.warn(`Local appearance E2E cleanup needs attention: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
}
