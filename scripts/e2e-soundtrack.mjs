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
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const supabaseUrl = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const shots = process.env.E2E_SCREENSHOTS;
assert(new URL(appUrl).hostname === "127.0.0.1" && new URL(supabaseUrl).hostname === "127.0.0.1", "Soundtrack E2E runs against local Setuvara only");
assert(publishableKey, "The local Setuvara publishable key is required for owner-scoped profile setup");
assert(serviceKey, "E2E_LOCAL_SERVICE_KEY (local stack) is required to seed test profiles");
if (shots) mkdirSync(shots, { recursive: true });

const stamp = Date.now().toString(36);
const seededUsers = [];
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

async function seedUploadedVideo(browser, userId) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(appUrl);
  const bytes = Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context || !MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) throw new Error("Local browser cannot create the uploaded-video soundtrack fixture");
    let frame = 0;
    const paint = () => {
      context.fillStyle = frame++ % 2 ? "#ff5a4f" : "#afcbff";
      context.fillRect(0, 0, 64, 64);
      context.fillStyle = "#0d0d0d";
      context.fillRect(frame % 48, 16, 16, 32);
    };
    paint();
    const stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
    const chunks = [];
    recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
    const stopped = new Promise((resolve) => recorder.addEventListener("stop", resolve, { once: true }));
    const animation = setInterval(paint, 80);
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 3200));
    recorder.stop();
    await stopped;
    clearInterval(animation);
    stream.getTracks().forEach((track) => track.stop());
    return [...new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer())];
  }));
  await page.close();
  assert(bytes.length > 100 && bytes.subarray(0, 4).toString("hex") === "1a45dfa3", "Soundtrack fixture should be a real WebM video");
  const path = `${userId}/${crypto.randomUUID()}.webm`;
  const upload = await fetch(`${supabaseUrl}/storage/v1/object/profile-media/${path}`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "video/webm" },
    body: bytes,
  });
  assert(upload.ok, `video upload: ${upload.status} ${await upload.text()}`);
  const [mode] = await admin(`/rest/v1/profile_modes?profile_id=eq.${userId}&slug=eq.personal&select=id`);
  await admin("/rest/v1/profile_blocks", { method: "POST", body: JSON.stringify({ profile_id: userId, mode_id: mode.id, kind: "video", sort_order: 4, is_visible: true, data: { source: "upload", video_path: path, video_mime_type: "video/webm", title: "Uploaded soundtrack video", caption: "A local native player" } }) });
  return path;
}

async function seedSecondUploadedVideo(userId) {
  const [block] = await admin(`/rest/v1/profile_blocks?profile_id=eq.${userId}&kind=eq.video&select=profile_id,mode_id,data&order=sort_order.asc&limit=1`);
  assert(block, "A first uploaded video exists for the multi-media fixture");
  await admin("/rest/v1/profile_blocks", { method: "POST", body: JSON.stringify({ profile_id: userId, mode_id: block.mode_id, kind: "video", sort_order: 5, is_visible: true, data: { ...block.data, title: "Second uploaded soundtrack video" } }) });
}

async function seedUser(name, modes) {
  const username = `${name}${stamp}`.slice(0, 30);
  const email = `${username}@example.test`;
  const password = `Soundtrack-${crypto.randomUUID()}aA1!`;
  const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username, display_name: name[0].toUpperCase() + name.slice(1) } }) });
  const owner = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signedIn = await owner.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  assert.equal(signedIn.data.user.id, user.id, "Fixture must use the authenticated owner to publish their own profile");
  assert.ifError((await owner.from("profiles").update({ is_published: true }).eq("id", user.id)).error);
  await owner.auth.signOut({ scope: "local" });
  const rows = await admin(`/rest/v1/profile_modes?profile_id=eq.${user.id}&select=id,slug`);
  for (const [slug, blocks] of Object.entries(modes)) {
    const mode = rows.find((row) => row.slug === slug);
    await admin(`/rest/v1/profile_modes?id=eq.${mode.id}`, { method: "PATCH", body: JSON.stringify({ is_enabled: true }) });
    for (const [index, block] of blocks.entries()) {
      await admin("/rest/v1/profile_blocks", { method: "POST", body: JSON.stringify({ profile_id: user.id, mode_id: mode.id, sort_order: index, is_visible: true, ...block }) });
    }
  }
  const seeded = { id: user.id, username, email, password };
  seededUsers.push(seeded);
  return seeded;
}

const SPOTIFY = { kind: "music", data: { url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", title: "Golden Hour · JVKE" }, is_soundtrack: true };
const SOUNDCLOUD = { kind: "music", data: { url: "https://soundcloud.com/odesza/a-moment-apart", title: "A Moment Apart" } };
const VIDEO = { kind: "video", data: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Studio session" } };
const QUOTE = { kind: "testimonial", data: { quote: "The person you call when the night needs a plan and a playlist.", author: "Maya Chen", role: "Friend since Lisboa" } };
const YT_MUSIC = { kind: "music", data: { url: "https://music.youtube.com/watch?v=lYBUbBu4W08", title: "Nightcall · Kavinsky, a very long track title that keeps going well past the edge of a phone screen" }, is_soundtrack: true };

const fakes = String.raw`
(() => {
  window.__fake = [];
  window.__soundtest = { allowAutoplay: false, requireGesture: false, gestureAllowed: false, deferNextPlay: false, nextPlayError: null, visibilityEvents: 0, stalePauseEvents: 0, firstPauseEvent: false, unavailableFired: false };
  document.addEventListener("visibilitychange", () => window.__soundtest.visibilityEvents++, { capture: true });
  const activated = () => window.__soundtest.allowAutoplay || (window.__soundtest.requireGesture ? window.__soundtest.gestureAllowed : navigator.userActivation.hasBeenActive);
  // Audio previews use the browser Audio API rather than a provider iframe.
  window.Audio = class {
    constructor() {
      this.listeners = {};
      this.volume = 1;
      this.currentTime = 0;
      this.paused = true;
      this.state = { kind: "audio", paused: true, plays: 0, playCalls: 0, overlaps: 0, playPending: false, src: "", destroyed: false };
      this.state.emitStalePause = () => { window.__soundtest.stalePauseEvents++; this.emit("pause"); };
      window.__fake.push(this.state);
    }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    emit(name) { (this.listeners[name] || []).forEach((fn) => fn()); }
    set src(value) { this.state.src = value; }
    get src() { return this.state.src; }
    resolvePlayback() {
      this.paused = false; this.state.paused = false; this.state.plays++;
      this.state.playPending = false;
      setTimeout(() => {
        this.emit("playing");
        if (!this.paused && [...document.querySelectorAll("video")].some((video) => !video.paused)) this.state.overlaps++;
      }, 0);
    }
    play() {
      this.state.playCalls++;
      const forcedError = window.__soundtest.nextPlayError;
      window.__soundtest.nextPlayError = null;
      if (forcedError) return Promise.reject(new DOMException("Simulated player transition", forcedError));
      if (!activated()) return Promise.reject(new DOMException("User activation required", "NotAllowedError"));
      if (window.__soundtest.deferNextPlay) {
        window.__soundtest.deferNextPlay = false;
        this.state.playPending = true;
        return new Promise((resolve, reject) => {
          this.state.resolvePlay = () => { this.resolvePlayback(); resolve(); };
          this.state.rejectPlay = (name = "AbortError") => { this.state.playPending = false; reject(new DOMException("Simulated player transition", name)); };
        });
      }
      this.resolvePlayback();
      return Promise.resolve();
    }
    pause() {
      if (this.paused) return;
      this.paused = true; this.state.paused = true;
      setTimeout(() => this.emit("pause"), 20);
    }
    removeAttribute(name) {
      if (this.state.playPending) this.state.rejectPlay?.("AbortError");
      if (name === "src") this.src = "";
      this.state.destroyed = true;
      try { sessionStorage.setItem("__setuvara_soundtrack_destroyed", "yes"); } catch {}
    }
    load() {}
  };
  // Spotify iFrame API
  window.__spotify = { createController(el, opts, cb) {
    const iframe = document.createElement("iframe"); iframe.src = "about:blank"; iframe.style.height = opts.height + "px"; iframe.style.width = "100%"; iframe.dataset.fake = "spotify";
    el.replaceWith(iframe);
    const listeners = {}; const emit = (name, data) => (listeners[name] || []).forEach((fn) => fn({ data }));
    const state = { kind: "spotify", uri: opts.uri, paused: true, plays: 0, blockedAttempts: 0 }; window.__fake.push(state);
    const update = (paused) => { state.paused = paused; emit("playback_update", { isPaused: paused, isBuffering: false, position: paused ? 1000 : 0, duration: 30000 }); };
    state.userPlay = () => update(false); state.userPause = () => update(true);
    cb({ addListener(name, fn) { (listeners[name] ||= []).push(fn); }, play() { state.plays++; if (activated()) setTimeout(() => update(false), 40); else state.blockedAttempts++; }, resume() { this.play(); }, pause() { setTimeout(() => update(true), 30); }, seek() {}, destroy() { state.destroyed = true; iframe.remove(); } });
    setTimeout(() => emit("ready", {}), 30);
  } };
  // YouTube iFrame API
  window.__yt = { Player: class {
    constructor(el, opts) {
      const existing = el.tagName === "IFRAME";
      const iframe = existing ? el : document.createElement("iframe"); if (!existing) { iframe.src = "about:blank"; el.replaceWith(iframe); }
      this.opts = opts; const state = this.state = { kind: "youtube", videoId: opts.videoId || iframe.src, paused: true, plays: 0, blockedAttempts: 0, attached: existing }; window.__fake.push(state);
      const change = (data) => { state.paused = data !== 1; opts.events?.onStateChange?.({ data }); };
      this.change = change; state.userPlay = () => change(1); state.userPause = () => change(2); state.end = () => change(0); state.fail = () => opts.events?.onError?.({ data: 150 });
      setTimeout(() => { opts.events?.onReady?.({ target: this }); if (existing && /autoplay=1/.test(iframe.src)) change(1); }, 30);
    }
    playVideo() { this.state.plays++; if (activated()) setTimeout(() => this.change(1), 40); else this.state.blockedAttempts++; }
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

async function newVisitor(browser, { mobile = true, preference = null, unavailable = false, autoplay = false, requireGesture = false } = {}) {
  const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  const init = autoplay ? fakes.replace("allowAutoplay: false", "allowAutoplay: true") : fakes;
  await context.addInitScript(`${init}${requireGesture ? '\nwindow.__soundtest.requireGesture = true; document.addEventListener("pointerdown", () => { window.__soundtest.gestureAllowed = true; }, { capture: true, once: true });' : ""}`);
  if (preference) await context.addInitScript((value) => localStorage.setItem("setuvara:sound", value), preference);
  await context.route((url) => !["127.0.0.1", "localhost"].includes(url.hostname), (route) => {
    const url = route.request().url();
    if (scripts[url]) return route.fulfill({ contentType: "text/javascript", body: unavailable && url.includes("youtube") ? "window.YT = { Player: class { constructor(el, opts) { setTimeout(() => { window.__soundtest.unavailableFired = true; opts.events.onError({ data: 150 }); }, 20); } } }; setTimeout(() => window.onYouTubeIframeAPIReady(), 10);" : scripts[url] });
    if (route.request().resourceType() === "image") return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: "text/html", body: "<body style='margin:0;background:#1c1c1c;color:#eee;font:12px sans-serif;display:grid;place-items:center;height:100vh'>provider embed</body>" });
  });
  await context.route("**/api/soundtrack?**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ src: "https://preview.test/audio.mp3" }) }));
  const page = await context.newPage();
  page.on("pageerror", (error) => { throw error; });
  return { context, page };
}

const fake = (page, kind) => page.evaluate((k) => window.__fake.filter((item) => item.kind === k && !item.destroyed).map(({ paused, plays, blockedAttempts, playCalls, overlaps, playPending, uri, videoId, src, attached }) => ({ paused, plays, blockedAttempts, playCalls, overlaps, playPending, uri, videoId, src, attached })), kind);
const waitForFake = (page, kind, condition, index = 0) => page.waitForFunction(({ kind, condition, index }) => {
  const items = window.__fake.filter((item) => item.kind === kind && !item.destroyed);
  const matches = (item) => Object.entries(condition).every(([key, expected]) => {
    if (key === "any") return true;
    if (key === "playing") return !item.paused === expected;
    if (key === "minPlays") return item.plays >= expected;
    if (key === "exactPlays") return item.plays === expected;
    if (key === "minBlockedAttempts") return (item.blockedAttempts ?? 0) >= expected;
    return item[key] === expected;
  });
  return condition.any ? items.some(matches) : Boolean(items[index]) && matches(items[index]);
}, { kind, condition, index });
const call = (page, kind, index, method) => page.evaluate(([k, i, m]) => window.__fake.filter((item) => item.kind === k && !item.destroyed)[i][m](), [kind, index, method]);
const soundUi = (page) => page.locator("[data-sound-ui]").count();
async function assertNoSoundtrackCard(page, titles) {
  assert.equal(await page.getByText("Profile soundtrack", { exact: true }).count(), 0, "No soundtrack metadata label appears publicly");
  const [text, html] = await Promise.all([page.locator("body").innerText(), page.content()]);
  for (const title of titles) {
    assert.equal(text.includes(title), false, `Soundtrack title is hidden: ${title}`);
    assert.equal(html.includes(title), false, `Soundtrack title is absent from the public page payload: ${title}`);
  }
}
async function assertSourceMetadataAbsent(page, titles) {
  const composition = page.locator("article").first();
  const text = await composition.innerText();
  for (const title of titles) assert.equal(text.includes(title), false, `Soundtrack title is hidden from the profile composition: ${title}`);
}
const shot = async (page, name, fullPage = false) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage }); };
const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM ?? undefined, args: ["--autoplay-policy=user-gesture-required"] });
try {
  const silent = await seedUser("silent", { personal: [SOUNDCLOUD, VIDEO] });
  const owner = await seedUser("aanya", { personal: [SPOTIFY, VIDEO, SOUNDCLOUD, QUOTE], event: [YT_MUSIC, VIDEO], business: [VIDEO] });
  await seedPhoto(browser, owner.id);
  await seedUploadedVideo(browser, owner.id);
  const clips = await seedUser("clips", {
    personal: [{ kind: "music", data: { url: "https://music.apple.com/us/album/blinding-lights/1499378108?i=1499378615", title: "Blinding Lights" }, is_soundtrack: true }],
    event: [{ kind: "music", data: { url: "https://soundcloud.com/odesza/a-moment-apart", title: "A Moment Apart" }, is_soundtrack: true }],
    business: [{ kind: "music", data: { url: "https://www.deezer.com/en/track/3135556", title: "Harder, Better, Faster, Stronger" }, is_soundtrack: true }],
  });
  await seedUploadedVideo(browser, clips.id);
  await seedSecondUploadedVideo(clips.id);

  // ---- No soundtrack: no sound UI at all, no player scripts.
  {
    const { context, page } = await newVisitor(browser, { preference: "on" });
    for (const url of [`/${silent.username}`, `/${owner.username}?mode=business`]) {
      await page.goto(appUrl + url);
      await page.locator('main[data-public-profile-surface="true"]').waitFor();
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
  await assertNoSoundtrackCard(page, ["Golden Hour · JVKE", "Spotify track", "Profile soundtrack"]);
  await page.locator('iframe[title="A Moment Apart"]').waitFor();
  assert.equal((await fake(page, "spotify"))[0].paused, true, "Nothing plays before the visitor chooses");
  await shot(page, "02-first-visit-mobile");
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `No horizontal overflow at ${width}px`);
    for (const label of ["Enter with sound", "Continue muted"]) {
      const bounds = await page.getByRole("button", { name: label }).boundingBox();
      assert(bounds && bounds.height >= 44, `${label} remains an accessible tap target at ${width}px`);
    }
    if (width === 360) await shot(page, "02b-first-visit-360");
    if (width === 430) await shot(page, "02c-first-visit-430");
  }
  await enter.click();
  await waitForFake(page, "spotify", { paused: false });
  assert.equal(await page.evaluate(() => localStorage.getItem("setuvara:sound")), "on");
  await assertNoSoundtrackCard(page, ["Golden Hour · JVKE"]);
  assert.equal(await page.getByRole("button", { name: "Enter with sound" }).count(), 0, "The entry choice disappears after Sound on");
  await page.getByRole("button", { name: "Sound on. Mute." }).waitFor();
  await shot(page, "03-sound-on-mobile");
  console.log("PASS first visit choice + Spotify soundtrack");

  // ---- Video pauses the soundtrack; closing it brings the soundtrack back.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-sound-ui] button[aria-pressed]');
    return button instanceof HTMLElement && getComputedStyle(button.parentElement).opacity === "1" && button.getBoundingClientRect().bottom <= window.innerHeight;
  });
  await shot(page, "04-pill-scrolled");
  const pill = page.locator("[data-sound-ui] button[aria-pressed]").last();
  assert.equal(await pill.evaluate((element) => getComputedStyle(element.parentElement).opacity === "1" && element.getBoundingClientRect().bottom <= window.innerHeight), true, "Sound control follows the visitor down the page");
  await page.getByRole("button", { name: "Play Studio session" }).click();
  await waitForFake(page, "spotify", { paused: true });
  await waitForFake(page, "youtube", { any: true, attached: true, playing: true });
  await page.evaluate(() => {
    window.__soundtest.visibilityEvents = 0;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() => window.__soundtest.visibilityEvents === 2);
  assert.equal((await fake(page, "spotify"))[0].paused, true, "Returning to a visible tab does not resume while the video still blocks");
  await page.getByRole("button", { name: "Close video" }).click();
  await waitForFake(page, "spotify", { paused: false });
  console.log("PASS video pauses and resumes the soundtrack");

  // Native uploaded video shares the same audio-focus handoff as provider video.
  const uploadedVideo = page.locator('video[aria-label="Uploaded soundtrack video"]');
  await uploadedVideo.waitFor();
  assert(await uploadedVideo.getAttribute("controls") !== null, "Uploaded public video has native controls");
  assert(await uploadedVideo.getAttribute("playsinline") !== null, "Uploaded public video stays inline on phones");
  await uploadedVideo.evaluate((video) => video.play());
  await waitForFake(page, "spotify", { paused: true });
  await page.waitForFunction(() => {
    const video = document.querySelector('video[aria-label="Uploaded soundtrack video"]');
    return video instanceof HTMLVideoElement && video.currentTime > 0.1;
  });
  await uploadedVideo.evaluate((video) => video.pause());
  await waitForFake(page, "spotify", { paused: false });
  const beforeNativeEnd = (await fake(page, "spotify"))[0].plays;
  await uploadedVideo.evaluate((video) => video.play());
  await waitForFake(page, "spotify", { paused: true });
  await page.waitForFunction(() => {
    const video = document.querySelector('video[aria-label="Uploaded soundtrack video"]');
    return video instanceof HTMLVideoElement && video.ended;
  }, null, { timeout: 10_000 });
  await waitForFake(page, "spotify", { paused: false });
  assert.equal((await fake(page, "spotify"))[0].plays, beforeNativeEnd + 1, "The pause + ended pair requests one soundtrack resume");
  console.log("PASS native uploaded video pauses/resumes the soundtrack on pause and end");

  // Video ended through the player also hands back.
  await page.getByRole("button", { name: "Play Studio session" }).click();
  await waitForFake(page, "spotify", { paused: true });
  await page.evaluate(() => window.__fake.filter((item) => item.kind === "youtube" && item.attached && !item.destroyed).at(-1).end());
  await waitForFake(page, "spotify", { paused: false });
  await page.getByRole("button", { name: "Close video" }).click();

  // ---- Another music block pauses the soundtrack.
  await call(page, "soundcloud", 0, "userPlay");
  await waitForFake(page, "spotify", { paused: true });
  await call(page, "soundcloud", 0, "userPause");
  await waitForFake(page, "spotify", { paused: false });
  console.log("PASS manual music pauses and resumes the soundtrack");

  // ---- Visibility handling: headless Chromium cannot change page visibility,
  // so exercise the real visibilitychange listener with a deterministic event.
  const visibilityCount = await page.evaluate(() => window.__soundtest.visibilityEvents);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction((count) => window.__soundtest.visibilityEvents === count + 1 && document.visibilityState === "hidden", visibilityCount);
  await waitForFake(page, "spotify", { paused: true });
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction((count) => window.__soundtest.visibilityEvents === count + 1 && document.visibilityState === "visible", visibilityCount + 1);
  await waitForFake(page, "spotify", { paused: false });
  console.log("PASS visibilitychange pauses and resumes the soundtrack (headless browser simulation)");

  // ---- Mute from the control, remembered across profiles and visits.
  await page.getByRole("button", { name: "Sound on. Mute." }).click();
  await waitForFake(page, "spotify", { paused: true });
  assert.equal(await page.evaluate(() => localStorage.getItem("setuvara:sound")), "off");
  await page.reload();
  await page.getByRole("button", { name: "Muted. Turn sound on." }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Enter with sound" }).count(), 0, "No prompt for a visitor who already chose");
  await waitForFake(page, "spotify", { exactPlays: 0 });
  assert.equal((await fake(page, "spotify"))[0].plays, 0, "Sound off is remembered: nothing starts");
  await shot(page, "05-returning-muted");
  await page.getByRole("button", { name: "Muted. Turn sound on." }).click();
  await waitForFake(page, "spotify", { paused: false });
  console.log("PASS mute/unmute and Sound off remembered");

  // ---- Sound on remembered: one genuine tap recovers a blocked reload.
  const returningOn = await newVisitor(browser, { preference: "on", requireGesture: true });
  const returningPage = returningOn.page;
  await returningPage.goto(`${appUrl}/${owner.username}`);
  await waitForFake(returningPage, "spotify", { minBlockedAttempts: 1 });
  await returningPage.getByRole("button", { name: "Tap to play sound" }).waitFor();
  assert.equal(await returningPage.getByRole("button", { name: "Enter with sound" }).count(), 0, "Remembered Sound on does not ask for the first-visit choice again");
  await shot(returningPage, "06-returning-sound-on-needs-tap");
  await returningPage.locator("h1").first().click();
  await waitForFake(returningPage, "spotify", { playing: true });
  await returningPage.reload();
  await waitForFake(returningPage, "spotify", { minBlockedAttempts: 1 });
  await returningPage.getByRole("button", { name: "Tap to play sound" }).waitFor();
  await returningPage.locator("h1").first().click();
  await waitForFake(returningPage, "spotify", { playing: true });
  await returningOn.context.close();
  await page.goto(`${appUrl}/${silent.username}`);
  console.log("PASS remembered Sound on recovers on the first tap after reload");

  // ---- Event Mode with remembered sound retries an unacknowledged play on the first real gesture.
  const eventVisit = await newVisitor(browser, { preference: "on", requireGesture: true });
  const eventPage = eventVisit.page;
  await eventPage.goto(`${appUrl}/${owner.username}?mode=event`);
  await waitForFake(eventPage, "youtube", { any: true, attached: false, minBlockedAttempts: 1 });
  await assertNoSoundtrackCard(eventPage, ["Nightcall · Kavinsky", "YouTube Music"]);
  const [eventPlayerBeforeTap] = await fake(eventPage, "youtube");
  await eventPage.locator("h1").first().click();
  await waitForFake(eventPage, "youtube", { any: true, attached: false, playing: true });
  assert.equal((await fake(eventPage, "youtube"))[0].plays, eventPlayerBeforeTap.plays + 1, "An early page gesture retries an unacknowledged iframe play");
  await shot(eventPage, "07-event-youtube-music");
  await eventVisit.context.close();
  await page.goto(`${appUrl}/${silent.username}`);
  console.log("PASS Event Mode + early gesture retry");

  // ---- Desktop.
  const desktop = await newVisitor(browser, { mobile: false });
  await desktop.page.goto(`${appUrl}/${owner.username}`);
  assert.equal(await desktop.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "No horizontal overflow at 1440x900");
  await desktop.page.getByRole("button", { name: "Enter with sound" }).waitFor();
  await shot(desktop.page, "08-desktop-first-visit");
  await desktop.page.getByRole("button", { name: "Continue muted" }).click();
  assert.equal(await desktop.page.evaluate(() => localStorage.getItem("setuvara:sound")), "off");
  await desktop.page.getByRole("button", { name: "Muted. Turn sound on." }).waitFor();
  await shot(desktop.page, "09-desktop-muted");
  await desktop.context.close();
  console.log("PASS desktop first visit + Continue muted");

  // ---- Apple Music, SoundCloud and Deezer soundtracks.
  await page.evaluate(() => localStorage.removeItem("setuvara:sound"));
  await page.goto(`${appUrl}/${clips.username}`);
  await assertNoSoundtrackCard(page, ["Blinding Lights"]);
  await page.getByRole("button", { name: "Enter with sound" }).click();
  await page.getByRole("button", { name: /Sound on\. Mute\.|Tap to play sound/ }).waitFor();
  await waitForFake(page, "audio", { any: true, paused: false });
  await page.evaluate(() => localStorage.removeItem("setuvara:sound"));
  await page.goto(`${appUrl}/${clips.username}?mode=event`);
  await assertNoSoundtrackCard(page, ["A Moment Apart"]);
  await page.getByRole("button", { name: "Enter with sound" }).click();
  await page.getByRole("button", { name: /Sound on\. Mute\.|Tap to play sound/ }).waitFor();
  await waitForFake(page, "soundcloud", { any: true, paused: false });
  await page.evaluate(() => localStorage.removeItem("setuvara:sound"));
  await page.goto(`${appUrl}/${clips.username}?mode=business`);
  await assertNoSoundtrackCard(page, ["Harder, Better, Faster, Stronger"]);
  await page.getByRole("button", { name: "Enter with sound" }).click();
  await page.getByRole("button", { name: /Sound on\. Mute\.|Tap to play sound/ }).waitFor();
  await waitForFake(page, "audio", { any: true, paused: false });
  await shot(page, "10-deezer-business");
  console.log("PASS Apple Music, SoundCloud and Deezer soundtracks");

  // ---- Remembered sound succeeds on an autoplay-permitted reload.
  {
    const auto = await newVisitor(browser, { preference: "on", autoplay: true });
    await auto.page.goto(`${appUrl}/${clips.username}`);
    await waitForFake(auto.page, "audio", { any: true, paused: false });
    await auto.page.reload();
    await waitForFake(auto.page, "audio", { any: true, paused: false });
    await auto.context.close();
    console.log("PASS remembered sound on an autoplay-permitted reload");
  }

  // ---- Client-side route change unmounts the old pending soundtrack player.
  {
    const switching = await newVisitor(browser);
    const sp = switching.page;
    await sp.goto(`${appUrl}/login`);
    await sp.getByLabel("Email").fill(clips.email);
    await sp.getByLabel("Password", { exact: true }).fill(clips.password);
    await sp.getByRole("button", { name: /log in|sign in/i }).click();
    await sp.waitForURL(/\/app/);
    await sp.goto(`${appUrl}/${clips.username}`);
    await sp.evaluate(() => { window.__soundtest.deferNextPlay = true; sessionStorage.removeItem("__setuvara_soundtrack_destroyed"); });
    await sp.getByRole("button", { name: "Enter with sound" }).click();
    await sp.waitForFunction(() => window.__fake.some((item) => item.kind === "audio" && item.playPending));
    await sp.getByRole("link", { name: "Edit profile" }).click();
    await sp.waitForURL(/\/app\/identity/);
    await sp.waitForFunction(() => sessionStorage.getItem("__setuvara_soundtrack_destroyed") === "yes");
    assert.equal(await sp.evaluate(() => sessionStorage.getItem("__setuvara_soundtrack_destroyed")), "yes", "Client navigation destroys the pending public soundtrack player");
    await switching.context.close();
    console.log("PASS client navigation invalidates a pending public soundtrack player");
  }

  // ---- Pending native play, overlapping blockers, late resolution, and AbortError.
  {
    const arbitration = await newVisitor(browser);
    const ap = arbitration.page;
    await ap.goto(`${appUrl}/${clips.username}`);
    await ap.evaluate(() => { window.__soundtest.deferNextPlay = true; });
    await ap.getByRole("button", { name: "Enter with sound" }).click();
    await ap.waitForFunction(() => window.__fake.some((item) => item.kind === "audio" && item.playPending));

    const first = ap.locator('video[aria-label="Uploaded soundtrack video"]');
    const second = ap.locator('video[aria-label="Second uploaded soundtrack video"]');
    await first.evaluate((video) => video.play());
    await ap.waitForFunction(() => {
      const video = document.querySelector('video[aria-label="Uploaded soundtrack video"]');
      return video instanceof HTMLVideoElement && !video.paused;
    });
    await ap.evaluate(() => window.__fake.find((item) => item.kind === "audio" && item.playPending).resolvePlay());
    await waitForFake(ap, "audio", { paused: true, exactPlays: 1 });
    assert.equal((await fake(ap, "audio"))[0].overlaps, 0, "A late soundtrack start is suppressed before it overlaps active video");

    await second.evaluate((video) => video.play());
    await ap.waitForFunction(() => {
      const video = document.querySelector('video[aria-label="Second uploaded soundtrack video"]');
      return video instanceof HTMLVideoElement && !video.paused;
    });
    await first.evaluate((video) => {
      window.__soundtest.firstPauseEvent = false;
      video.addEventListener("pause", () => { window.__soundtest.firstPauseEvent = true; }, { once: true });
      video.pause();
    });
    await ap.waitForFunction(() => window.__soundtest.firstPauseEvent);
    assert.equal((await fake(ap, "audio"))[0].paused, true, "Stopping one video does not resume under the second active video");
    assert.equal((await fake(ap, "audio"))[0].playCalls, 1, "The coordinator does not issue an intermediate resume");
    await second.evaluate((video) => video.pause());
    await waitForFake(ap, "audio", { paused: false });
    assert.equal((await fake(ap, "audio"))[0].playCalls, 2, "The last blocker causes exactly one resume request");
    assert.equal((await fake(ap, "audio"))[0].overlaps, 0, "Two simultaneous media blockers never overlap the soundtrack");
    const soundPill = ap.locator('[data-sound-ui] button[aria-pressed]').last();
    await ap.evaluate(() => window.__fake.find((item) => item.kind === "audio" && !item.destroyed).emitStalePause());
    await ap.waitForFunction(() => window.__soundtest.stalePauseEvents === 1);
    await ap.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    assert.equal(await soundPill.getAttribute("aria-pressed"), "true", "A queued pause event cannot turn off sound after playback resumed");

    await ap.getByRole("button", { name: "Sound on. Mute." }).click();
    await waitForFake(ap, "audio", { paused: true });
    await ap.evaluate(() => { window.__soundtest.deferNextPlay = true; });
    await ap.getByRole("button", { name: "Muted. Turn sound on." }).click();
    await ap.waitForFunction(() => window.__fake.some((item) => item.kind === "audio" && item.playPending));
    await first.evaluate((video) => video.play());
    await ap.waitForFunction(() => {
      const video = document.querySelector('video[aria-label="Uploaded soundtrack video"]');
      return video instanceof HTMLVideoElement && !video.paused;
    });
    await ap.evaluate(async () => {
      window.__fake.find((item) => item.kind === "audio" && item.playPending).rejectPlay("AbortError");
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.equal((await fake(ap, "audio"))[0].paused, true, "AbortError during a blocked play does not restart under video");
    await first.evaluate((video) => video.pause());
    await waitForFake(ap, "audio", { paused: false });
    assert.equal((await fake(ap, "audio"))[0].overlaps, 0, "Abort recovery keeps media audio exclusive");
    await arbitration.context.close();
    console.log("PASS stale play, multi-media arbitration, and AbortError recovery");
  }

  await context.close();

  // ---- Unavailable track: no stuck UI, profile intact.
  {
    const broken = await newVisitor(browser, { unavailable: true });
    await broken.page.goto(`${appUrl}/${owner.username}?mode=event`);
    await broken.page.waitForFunction(() => window.__soundtest.unavailableFired);
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
    await ep.getByRole("button", { name: "Enter with sound" }).waitFor();
    assert.equal((await fake(ep, "spotify")).every((item) => item.plays === 0), true, "Editor preview never starts the soundtrack on its own");
    await assertSourceMetadataAbsent(ep, ["Golden Hour · JVKE"]);
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
    await after.page.locator('main[data-public-profile-surface="true"]').waitFor();
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
  const cleanup = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  for (const user of seededUsers) {
    try {
      const { data: objects, error: listError } = await cleanup.storage.from("profile-media").list(user.id, { limit: 1000 });
      if (listError) throw listError;
      if (objects?.length) {
        const { error: removeError } = await cleanup.storage.from("profile-media").remove(objects.map((object) => `${user.id}/${object.name}`));
        if (removeError) throw removeError;
      }
      const { error: deleteError } = await cleanup.auth.admin.deleteUser(user.id);
      if (deleteError) throw deleteError;
    } catch (error) {
      console.warn(`Local soundtrack E2E cleanup needs attention for a generated user: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
}
