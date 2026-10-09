/**
 * Profile soundtrack end-to-end check against a LOCAL Setuvara stack.
 *
 * Music providers are replaced by small fakes that follow each provider's
 * player API and the browser rule that sound needs a visitor's tap, so the
 * whole visitor flow can be exercised without network access.
 *
 *   E2E_APP_URL=http://127.0.0.1:3014 \
 *   E2E_SUPABASE_URL=http://127.0.0.1:54321 \
 *   E2E_LOCAL_SERVICE_KEY=<local service role key> \
 *   E2E_SCREENSHOTS=./.e2e-soundtrack \
 *   node scripts/e2e-soundtrack.mjs
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const shots = process.env.E2E_SCREENSHOTS;
assert(new URL(appUrl).hostname === "127.0.0.1" && new URL(supabaseUrl).hostname === "127.0.0.1", "Soundtrack E2E runs against local Setuvara only");
assert(serviceKey, "E2E_LOCAL_SERVICE_KEY (local stack) is required to seed test profiles");
if (shots) mkdirSync(shots, { recursive: true });

const stamp = Date.now().toString(36);
const admin = (path, init = {}) => fetch(`${supabaseUrl}${path}`, { ...init, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers } }).then(async (response) => {
  const body = await response.text();
  assert(response.ok, `${init.method ?? "GET"} ${path}: ${response.status} ${body}`);
  return body ? JSON.parse(body) : null;
});

/** A generated portrait, so Personal renders its Full Bleed photo layout. */
async function seedPhoto(browser, userId) {
  const page = await browser.newPage({ viewport: { width: 640, height: 800 } });
  await page.setContent("<body style='margin:0;height:800px;background:radial-gradient(circle at 50% 38%,#e9b38f 0 18%,#4b2e2a 19% 24%,transparent 25%),linear-gradient(160deg,#1d3557,#e76f51 55%,#2a1a1f)'></body>");
  const png = await page.screenshot();
  await page.close();
  const path = `${userId}/${crypto.randomUUID()}.png`;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/profile-media/${path}`, { method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "image/png" }, body: png });
  assert(response.ok, `photo upload: ${response.status} ${await response.text()}`);
  await admin(`/rest/v1/profile_modes?profile_id=eq.${userId}&slug=eq.personal`, { method: "PATCH", body: JSON.stringify({ image_path: path, appearance: { theme: "dark", accent: "#FF5A4F", layout: "full-bleed", imageTreatment: "full-bleed" } }) });
}

async function seedUser(name, modes) {
  const username = `${name}${stamp}`.slice(0, 30);
  const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email: `${username}@example.test`, password: "Soundtrack-test-1", email_confirm: true, user_metadata: { username, display_name: name[0].toUpperCase() + name.slice(1) } }) });
  await admin(`/rest/v1/profiles?id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ is_published: true }) });
  const rows = await admin(`/rest/v1/profile_modes?profile_id=eq.${user.id}&select=id,slug`);
  for (const [slug, blocks] of Object.entries(modes)) {
    const mode = rows.find((row) => row.slug === slug);
    await admin(`/rest/v1/profile_modes?id=eq.${mode.id}`, { method: "PATCH", body: JSON.stringify({ is_enabled: true }) });
    for (const [index, block] of blocks.entries()) {
      await admin("/rest/v1/profile_blocks", { method: "POST", body: JSON.stringify({ profile_id: user.id, mode_id: mode.id, sort_order: index, is_visible: true, ...block }) });
    }
  }
  return { id: user.id, username, email: `${username}@example.test`, password: "Soundtrack-test-1" };
}

const SPOTIFY = { kind: "music", data: { url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", title: "Golden Hour · JVKE" }, is_soundtrack: true };
const SOUNDCLOUD = { kind: "music", data: { url: "https://soundcloud.com/odesza/a-moment-apart", title: "A Moment Apart" } };
const VIDEO = { kind: "video", data: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Studio session" } };
const QUOTE = { kind: "testimonial", data: { quote: "The person you call when the night needs a plan and a playlist.", author: "Maya Chen", role: "Friend since Lisboa" } };
const YT_MUSIC = { kind: "music", data: { url: "https://music.youtube.com/watch?v=lYBUbBu4W08", title: "Nightcall · Kavinsky, a very long track title that keeps going well past the edge of a phone screen" }, is_soundtrack: true };

const fakes = String.raw`
(() => {
  window.__fake = [];
  const activated = () => navigator.userActivation.hasBeenActive;
  // Spotify iFrame API
  window.__spotify = { createController(el, opts, cb) {
    const iframe = document.createElement("iframe"); iframe.src = "about:blank"; iframe.style.height = opts.height + "px"; iframe.style.width = "100%"; iframe.dataset.fake = "spotify";
    el.replaceWith(iframe);
    const listeners = {}; const emit = (name, data) => (listeners[name] || []).forEach((fn) => fn({ data }));
    const state = { kind: "spotify", uri: opts.uri, paused: true, plays: 0 }; window.__fake.push(state);
    const update = (paused) => { state.paused = paused; emit("playback_update", { isPaused: paused, isBuffering: false, position: paused ? 1000 : 0, duration: 30000 }); };
    state.userPlay = () => update(false); state.userPause = () => update(true);
    cb({ addListener(name, fn) { (listeners[name] ||= []).push(fn); }, play() { state.plays++; if (activated()) setTimeout(() => update(false), 40); }, resume() { this.play(); }, pause() { setTimeout(() => update(true), 30); }, seek() {}, destroy() { state.destroyed = true; iframe.remove(); } });
    setTimeout(() => emit("ready", {}), 30);
  } };
  // YouTube iFrame API
  window.__yt = { Player: class {
    constructor(el, opts) {
      const existing = el.tagName === "IFRAME";
      const iframe = existing ? el : document.createElement("iframe"); if (!existing) { iframe.src = "about:blank"; el.replaceWith(iframe); }
      this.opts = opts; const state = this.state = { kind: "youtube", videoId: opts.videoId || iframe.src, paused: true, plays: 0, attached: existing }; window.__fake.push(state);
      const change = (data) => { state.paused = data !== 1; opts.events?.onStateChange?.({ data }); };
      this.change = change; state.userPlay = () => change(1); state.userPause = () => change(2); state.end = () => change(0); state.fail = () => opts.events?.onError?.({ data: 150 });
      setTimeout(() => { opts.events?.onReady?.({ target: this }); if (existing && /autoplay=1/.test(iframe.src)) change(1); }, 30);
    }
    playVideo() { this.state.plays++; if (activated()) setTimeout(() => this.change(1), 40); }
    pauseVideo() { setTimeout(() => this.change(2), 30); }
    seekTo() {} setVolume() {} destroy() { this.state.destroyed = true; }
  } };
  // SoundCloud Widget API
  const Events = { READY: "ready", PLAY: "play", PAUSE: "pause", FINISH: "finish", ERROR: "error" };
  window.__sc = { Widget: Object.assign((iframe) => {
    const binds = {}; const fire = (name) => (binds[name] || []).forEach((fn) => fn());
    const state = { kind: "soundcloud", src: iframe.src, paused: true, plays: 0 }; window.__fake.push(state);
    state.userPlay = () => { state.paused = false; fire("play"); }; state.userPause = () => { state.paused = true; fire("pause"); };
    setTimeout(() => fire("ready"), 30);
    return { bind(name, fn) { (binds[name] ||= []).push(fn); }, unbind(name) { delete binds[name]; state.destroyed = true; }, play() { state.plays++; if (activated()) setTimeout(() => state.userPlay(), 40); }, pause() { setTimeout(() => state.userPause(), 30); }, seekTo() {}, setVolume() {} };
  }, { Events }) };
})();`;

const scripts = {
  "https://open.spotify.com/embed/iframe-api/v1": "setTimeout(() => window.onSpotifyIframeApiReady && window.onSpotifyIframeApiReady(window.__spotify), 10);",
  "https://www.youtube.com/iframe_api": "window.YT = window.__yt; setTimeout(() => window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(), 10);",
  "https://w.soundcloud.com/player/api.js": "window.SC = window.__sc;",
};

const TONE = "data:audio/wav;base64," + Buffer.from(new Uint8Array(await (await import("node:fs/promises")).readFile(process.env.E2E_TONE ?? "/dev/null"))).toString("base64");

async function newVisitor(browser, { mobile = true, preference = null, unavailable = false } = {}) {
  const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } });
  await context.addInitScript(fakes);
  if (preference) await context.addInitScript((value) => localStorage.setItem("setuvara:sound", value), preference);
  await context.route((url) => !["127.0.0.1", "localhost"].includes(url.hostname), (route) => {
    const url = route.request().url();
    if (scripts[url]) return route.fulfill({ contentType: "text/javascript", body: unavailable && url.includes("youtube") ? "window.YT = { Player: class { constructor(el, opts) { setTimeout(() => opts.events.onError({ data: 150 }), 20); } } }; setTimeout(() => window.onYouTubeIframeAPIReady(), 10);" : scripts[url] });
    if (route.request().resourceType() === "image") return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: "text/html", body: "<body style='margin:0;background:#1c1c1c;color:#eee;font:12px sans-serif;display:grid;place-items:center;height:100vh'>provider embed</body>" });
  });
  await context.route("**/api/soundtrack?**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ src: TONE, title: "Preview clip · Test Artist", artwork: null }) }));
  const page = await context.newPage();
  page.on("pageerror", (error) => { throw error; });
  return { context, page };
}

const fake = (page, kind) => page.evaluate((k) => window.__fake.filter((item) => item.kind === k && !item.destroyed).map(({ paused, plays, uri, videoId, src, attached }) => ({ paused, plays, uri, videoId, src, attached })), kind);
const call = (page, kind, index, method) => page.evaluate(([k, i, m]) => window.__fake.filter((item) => item.kind === k && !item.destroyed)[i][m](), [kind, index, method]);
const soundUi = (page) => page.locator("[data-sound-ui]").count();
const shot = async (page, name, fullPage = false) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage }); };
async function until(check, message, timeout = 4000) {
  const end = Date.now() + timeout;
  for (;;) {
    try { if (await check()) return; } catch { /* retry */ }
    if (Date.now() > end) assert.fail(message);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM ?? undefined, args: ["--autoplay-policy=user-gesture-required"] });
try {
  const silent = await seedUser("silent", { personal: [SOUNDCLOUD, VIDEO] });
  const owner = await seedUser("aanya", { personal: [SPOTIFY, VIDEO, SOUNDCLOUD, QUOTE], event: [YT_MUSIC, VIDEO], business: [VIDEO] });
  await seedPhoto(browser, owner.id);
  const clips = await seedUser("clips", {
    personal: [{ kind: "music", data: { url: "https://music.apple.com/us/album/blinding-lights/1499378108?i=1499378615", title: "Blinding Lights" }, is_soundtrack: true }],
    event: [{ kind: "music", data: { url: "https://soundcloud.com/odesza/a-moment-apart", title: "A Moment Apart" }, is_soundtrack: true }],
    business: [{ kind: "music", data: { url: "https://www.deezer.com/en/track/3135556", title: "Harder, Better, Faster, Stronger" }, is_soundtrack: true }],
  });

  // ---- No soundtrack: no sound UI at all, no player scripts.
  {
    const { context, page } = await newVisitor(browser, { preference: "on" });
    for (const url of [`/${silent.username}`, `/${owner.username}?mode=business`]) {
      await page.goto(appUrl + url);
      await page.waitForTimeout(800);
      assert.equal(await soundUi(page), 0, `${url}: a Mode without a soundtrack shows no sound UI`);
      assert.equal(await page.getByText(/Enter with sound|Sound on|Sound off/).count(), 0, `${url}: no sound copy`);
      assert.equal(await page.evaluate(() => [...document.scripts].some((script) => /spotify|soundcloud|youtube/.test(script.src))), false, `${url}: no player APIs load`);
    }
    // A normal video still plays on click and has no close-and-resume chrome.
    await page.goto(`${appUrl}/${silent.username}`);
    await page.getByRole("button", { name: "Play Studio session" }).click();
    assert.equal(await page.getByRole("button", { name: "Close video" }).count(), 0);
    await shot(page, "01-no-soundtrack");
    await context.close();
    console.log("PASS Mode without soundtrack shows no sound UI");
  }

  // ---- First visit: the choice, then Sound on with Spotify.
  const { context, page } = await newVisitor(browser);
  await page.goto(`${appUrl}/${owner.username}`);
  const enter = page.getByRole("button", { name: "Enter with sound" });
  await enter.waitFor();
  assert.equal(await page.getByRole("button", { name: "Continue muted" }).count(), 1);
  assert.equal((await fake(page, "spotify"))[0].paused, true, "Nothing plays before the visitor chooses");
  await shot(page, "02-first-visit-mobile");
  await page.setViewportSize({ width: 360, height: 760 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "No horizontal overflow at 360px");
  await shot(page, "02b-first-visit-360");
  await page.setViewportSize({ width: 390, height: 844 });
  await enter.click();
  await until(async () => !(await fake(page, "spotify"))[0].paused, "Enter with sound starts the Spotify soundtrack");
  assert.equal(await page.evaluate(() => localStorage.getItem("setuvara:sound")), "on");
  await page.getByRole("button", { name: /Sound off: pause Golden Hour/ }).first().waitFor();
  await shot(page, "03-sound-on-mobile");
  console.log("PASS first visit choice + Spotify soundtrack");

  // ---- Video pauses the soundtrack; closing it brings the soundtrack back.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await shot(page, "04-pill-scrolled");
  const pill = page.locator("[data-sound-ui] button[aria-pressed]").last();
  assert.equal(await pill.evaluate((element) => getComputedStyle(element.parentElement).opacity === "1" && element.getBoundingClientRect().bottom <= window.innerHeight), true, "Sound control follows the visitor down the page");
  await page.getByRole("button", { name: "Play Studio session" }).click();
  await until(async () => (await fake(page, "spotify"))[0].paused, "Starting a video pauses the soundtrack");
  await until(async () => (await fake(page, "youtube")).some((item) => item.attached && !item.paused), "The video plays after its click");
  await page.getByRole("button", { name: "Close video" }).click();
  await until(async () => !(await fake(page, "spotify"))[0].paused, "Closing the video resumes the soundtrack", 3000);
  console.log("PASS video pauses and resumes the soundtrack");

  // Video ended through the player also hands back.
  await page.getByRole("button", { name: "Play Studio session" }).click();
  await until(async () => (await fake(page, "spotify"))[0].paused, "Video pauses soundtrack again");
  await page.evaluate(() => window.__fake.filter((item) => item.kind === "youtube" && item.attached && !item.destroyed).at(-1).end());
  await until(async () => !(await fake(page, "spotify"))[0].paused, "Video end resumes the soundtrack", 3000);
  await page.getByRole("button", { name: "Close video" }).click();

  // ---- Another music block pauses the soundtrack.
  await call(page, "soundcloud", 0, "userPlay");
  await until(async () => (await fake(page, "spotify"))[0].paused, "Manual music pauses the soundtrack");
  await call(page, "soundcloud", 0, "userPause");
  await until(async () => !(await fake(page, "spotify"))[0].paused, "Soundtrack resumes after manual music stops", 3000);
  console.log("PASS manual music pauses and resumes the soundtrack");

  // ---- Hidden tab pauses; visible again resumes.
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await until(async () => (await fake(page, "spotify"))[0].paused, "A hidden tab pauses the soundtrack");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await until(async () => !(await fake(page, "spotify"))[0].paused, "Returning resumes the soundtrack");
  console.log("PASS hidden tab pauses the soundtrack");

  // ---- Mute from the control, remembered across profiles and visits.
  await page.getByRole("button", { name: /Sound off: pause Golden Hour/ }).last().click();
  await until(async () => (await fake(page, "spotify"))[0].paused, "Sound off pauses");
  assert.equal(await page.evaluate(() => localStorage.getItem("setuvara:sound")), "off");
  await page.reload();
  await page.getByRole("button", { name: /Sound on: play Golden Hour/ }).first().waitFor();
  assert.equal(await page.getByRole("button", { name: "Enter with sound" }).count(), 0, "No prompt for a visitor who already chose");
  await page.waitForTimeout(600);
  assert.equal((await fake(page, "spotify"))[0].plays, 0, "Sound off is remembered: nothing starts");
  await shot(page, "05-returning-muted");
  await page.getByRole("button", { name: /Sound on: play Golden Hour/ }).first().click();
  await until(async () => !(await fake(page, "spotify"))[0].paused, "Sound on from the cue plays");
  console.log("PASS mute/unmute and Sound off remembered");

  // ---- Sound on remembered: plays on the first tap the browser allows.
  await page.reload();
  await page.waitForTimeout(4200);
  await page.getByRole("button", { name: /Tap to play soundtrack/ }).first().waitFor();
  await shot(page, "06-returning-sound-on-needs-tap");
  await page.locator("h1").first().click();
  await until(async () => !(await fake(page, "spotify"))[0].paused, "First tap on the page starts a remembered Sound on");
  console.log("PASS Sound on remembered");

  // ---- Mode switch: Personal → Event stops the Spotify soundtrack; YouTube Music takes over.
  await page.goto(`${appUrl}/${owner.username}?mode=event`);
  await page.waitForTimeout(300);
  assert.equal((await fake(page, "spotify")).length, 0, "Previous Mode soundtrack is gone");
  await page.getByRole("button", { name: /Nightcall/ }).first().waitFor();
  await page.locator("h1").first().click();
  await until(async () => (await fake(page, "youtube")).some((item) => !item.attached && !item.paused), "YouTube Music soundtrack plays with Sound on");
  await page.getByText("Profile soundtrack", { exact: true }).scrollIntoViewIfNeeded();
  await shot(page, "07-event-youtube-music");
  console.log("PASS Mode switch + YouTube Music soundtrack");

  // ---- Desktop.
  const desktop = await newVisitor(browser, { mobile: false });
  await desktop.page.goto(`${appUrl}/${owner.username}`);
  await desktop.page.getByRole("button", { name: "Enter with sound" }).waitFor();
  await shot(desktop.page, "08-desktop-first-visit");
  await desktop.page.getByRole("button", { name: "Continue muted" }).click();
  assert.equal(await desktop.page.evaluate(() => localStorage.getItem("setuvara:sound")), "off");
  await desktop.page.getByRole("button", { name: /Sound on: play Golden Hour/ }).first().waitFor();
  await shot(desktop.page, "09-desktop-muted");
  await desktop.context.close();
  console.log("PASS desktop first visit + Continue muted");

  // ---- Apple Music, SoundCloud and Deezer soundtracks.
  await page.goto(`${appUrl}/${clips.username}`);
  await page.getByRole("button", { name: /Blinding Lights/ }).first().click();
  await until(async () => (await page.getByRole("button", { name: /Sound off: pause Blinding Lights/ }).count()) > 0, "Apple Music soundtrack plays its preview");
  await page.goto(`${appUrl}/${clips.username}?mode=event`);
  await page.getByRole("button", { name: /A Moment Apart/ }).first().click();
  await until(async () => (await fake(page, "soundcloud")).some((item) => !item.paused), "SoundCloud soundtrack plays");
  await page.goto(`${appUrl}/${clips.username}?mode=business`);
  await page.getByRole("button", { name: /Harder, Better/ }).first().click();
  await until(async () => (await page.getByRole("button", { name: /Sound off: pause Harder/ }).count()) > 0, "Deezer soundtrack plays its preview");
  await shot(page, "10-deezer-business");
  console.log("PASS Apple Music, SoundCloud and Deezer soundtracks");
  await context.close();

  // ---- Unavailable track: no stuck UI, profile intact.
  {
    const broken = await newVisitor(browser, { unavailable: true });
    await broken.page.goto(`${appUrl}/${owner.username}?mode=event`);
    await broken.page.waitForTimeout(1500);
    assert.equal(await broken.page.getByRole("button", { name: /Enter with sound|Sound on|Tap to play/ }).count(), 0, "An unavailable soundtrack shows no sound UI");
    await broken.page.getByRole("button", { name: "Play Studio session" }).waitFor();
    await shot(broken.page, "11-unavailable", true);
    await broken.context.close();
    console.log("PASS unavailable soundtrack falls back quietly");
  }

  // ---- Editor: preview is silent, toggle replaces the soundtrack, removing it removes the sound UI.
  {
    const editor = await newVisitor(browser, { preference: "on", mobile: false });
    const ep = editor.page;
    await ep.setViewportSize({ width: 1440, height: 960 });
    await ep.goto(`${appUrl}/login`);
    await ep.getByLabel("Email").fill(owner.email);
    await ep.getByLabel("Password", { exact: true }).fill(owner.password);
    await ep.getByRole("button", { name: /log in|sign in/i }).click();
    await ep.waitForURL(/\/app/);
    await ep.goto(`${appUrl}/app/identity?mode=personal&section=links`);
    await ep.getByText("PROFILE SOUNDTRACK").first().waitFor();
    await ep.waitForTimeout(4000);
    assert.equal((await fake(ep, "spotify")).every((item) => item.plays === 0), true, "Editor preview never starts the soundtrack on its own");
    await shot(ep, "12-editor-desktop");
    // Make the SoundCloud block the soundtrack instead.
    await ep.getByRole("button", { name: /A Moment Apart/ }).first().click();
    await ep.getByRole("switch", { name: "Use as profile soundtrack" }).click();
    await ep.getByText(/Replaces “Golden Hour · JVKE”/).waitFor();
    await shot(ep, "13-editor-sheet-replace");
    await ep.getByRole("button", { name: "Save", exact: true }).click();
    await ep.getByText(/Soundtrack set for Personal Mode/).first().waitFor();
    const rows = await admin(`/rest/v1/profile_blocks?profile_id=eq.${owner.id}&is_soundtrack=is.true&select=data`);
    assert.equal(rows.filter((row) => row.data.url.includes("soundcloud")).length, 1, "SoundCloud is now the Personal soundtrack");
    assert.equal(rows.filter((row) => row.data.url.includes("spotify")).length, 0, "Spotify stopped being the soundtrack");
    // Turn it off: the Mode returns to normal.
    await ep.getByRole("button", { name: /A Moment Apart/ }).first().click();
    await ep.getByRole("switch", { name: "Use as profile soundtrack" }).click();
    await ep.getByRole("button", { name: "Save", exact: true }).click();
    await ep.getByText(/Personal Mode has no soundtrack now/).first().waitFor();
    await editor.context.close();

    const after = await newVisitor(browser, { preference: "on" });
    await after.page.goto(`${appUrl}/${owner.username}`);
    await after.page.waitForTimeout(800);
    assert.equal(await soundUi(after.page), 0, "Removing the soundtrack removes all sound UI");
    await after.context.close();
    console.log("PASS editor preview silent, replace soundtrack, remove soundtrack");
  }

  // ---- Mobile editor.
  {
    const mobileEditor = await newVisitor(browser);
    const mp = mobileEditor.page;
    await mp.goto(`${appUrl}/login`);
    await mp.getByLabel("Email").fill(owner.email);
    await mp.getByLabel("Password", { exact: true }).fill(owner.password);
    await mp.getByRole("button", { name: /log in|sign in/i }).click();
    await mp.waitForURL(/\/app/);
    await mp.goto(`${appUrl}/app/identity?mode=event&section=links`);
    await mp.getByText("SOUNDTRACK").first().waitFor();
    await shot(mp, "14-editor-mobile");
    await mp.getByRole("button", { name: /Nightcall/ }).first().click();
    await mp.getByRole("switch", { name: "Use as profile soundtrack" }).waitFor();
    await shot(mp, "15-editor-mobile-sheet");
    assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "No horizontal overflow on mobile");
    await mobileEditor.context.close();
    console.log("PASS mobile editor");
  }
} finally {
  await browser.close();
}
