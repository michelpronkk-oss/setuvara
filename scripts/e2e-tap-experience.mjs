/** Browser E2E for Setuvara's Equipped, Quick QR, and physical Tap owner experience. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const root = resolve(process.cwd());
const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
assert.equal(resolve(gitRoot), root, "Tap experience E2E must run from the Setuvara Git root");
assert.match(readFileSync(resolve(root, "supabase/config.toml"), "utf8"), /^project_id = "setuvara"$/m);

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
assert.equal(new URL(appUrl).origin, "http://127.0.0.1:3014");
assert.equal(new URL(mailpitUrl).origin, "http://127.0.0.1:54324");
assert(supabaseUrl, "Local Setuvara Supabase URL is required");
assert.equal(new URL(supabaseUrl).origin, "http://127.0.0.1:54321", "Tap experience E2E may use local Supabase only");
assert(publishableKey && serviceKey, "Local Setuvara E2E keys are required");
assert.match(process.env.QUICK_SHARE_TOKEN_KEY ?? "", /^[A-Za-z0-9_-]{43}$/, "Runner must supply an ephemeral Quick Share key");

const suffix = `${Date.now().toString(36).slice(-6)}${randomBytes(3).toString("hex")}`;
const account = {
  email: `e2e-tap-experience-${suffix}@example.test`,
  username: `tapux_${suffix}`,
  password: `${randomBytes(32).toString("base64url")}Aa1!`,
};
const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const user = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
let userId = null;

async function confirmationLink() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=100`);
    assert.equal(response.status, 200, "Local Mailpit must be reachable");
    const messages = (await response.json()).messages ?? [];
    const message = messages.find((item) => JSON.stringify(item.To ?? item.to ?? []).toLowerCase().includes(account.email));
    if (message) {
      const detailResponse = await fetch(`${mailpitUrl}/api/v1/message/${encodeURIComponent(message.ID ?? message.id)}`);
      assert.equal(detailResponse.status, 200);
      const detail = await detailResponse.json();
      const body = `${detail.HTML ?? detail.html ?? ""}\n${detail.Text ?? detail.text ?? ""}`;
      const rawLink = body.match(/https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/i)?.[0];
      assert(rawLink, "Signup email must contain the Setuvara confirmation link");
      const url = new URL(rawLink.replaceAll("&amp;", "&"));
      assert.equal(url.origin, appUrl);
      assert.equal(url.pathname, "/auth/confirm");
      assert.equal(url.searchParams.get("type"), "email");
      assert.match(url.searchParams.get("token_hash") ?? "", /^[A-Za-z0-9_-]{32,128}$/);
      return url.toString();
    }
    await new Promise((done) => setTimeout(done, 300));
  }
  throw new Error("Local signup confirmation email did not arrive");
}

async function signUp(context, page) {
  let confirmSeen = false;
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/auth/confirm") confirmSeen = true; });
  await page.goto(`${appUrl}/signup`);
  await page.getByLabel("Username").fill(account.username);
  await page.getByText("Available. It’s yours if you want it.").waitFor();
  await page.getByRole("button", { name: `Claim @${account.username}` }).click();
  await page.getByLabel("Your name").fill("Tap Experience E2E");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Create my Setuvara" }).click();
  await page.getByRole("heading", { name: "Check your inbox." }).waitFor({ timeout: 15_000 });
  const link = await confirmationLink();
  try {
    await page.goto(link);
    await page.waitForURL(`${appUrl}/app/identity`, { timeout: 20_000 });
  } catch {
    throw new Error("Local Tap E2E confirmation did not establish an editor session (token redacted)");
  }
  assert(confirmSeen, "The browser must visit /auth/confirm");
  assert((await context.cookies(appUrl)).some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")), "Confirmation must create an SSR session cookie");
  const { data, error } = await user.auth.signInWithPassword({ email: account.email, password: account.password });
  assert.ifError(error);
  userId = data.user?.id;
  assert(userId, "Confirmed E2E account must have a user ID");
}

async function setupPublishedIdentity() {
  const published = await user.from("profiles").update({ is_published: true }).eq("id", userId);
  assert.ifError(published.error);
  for (const slug of ["personal", "event", "business"]) {
    const updated = await user.from("profile_modes").update({ is_enabled: true, connect_policy: "anyone" }).eq("profile_id", userId).eq("slug", slug);
    assert.ifError(updated.error);
  }
}

async function setPolicy(mode, policy) {
  const result = await user.from("profile_modes").update({ connect_policy: policy }).eq("profile_id", userId).eq("slug", mode);
  assert.ifError(result.error);
}

function modeButton(page, mode) {
  return page.locator("fieldset").filter({ has: page.locator("legend", { hasText: "CHOOSE A MODE" }) }).getByRole("button", { name: new RegExp(`^${mode}\\b`, "i") });
}

async function quickLink(page) {
  const link = page.getByRole("link", { name: /Open your Quick link/ });
  await link.waitFor();
  const url = new URL(await link.getAttribute("href"), appUrl);
  assert.equal(url.origin, appUrl);
  assert.match(url.pathname, /^\/q\/[A-Za-z0-9_-]{43}$/);
  assert.equal(url.search, "");
  return url.toString();
}

async function expectRedirect(context, url, expectedPath, expectedMode) {
  const response = await context.request.get(url, { maxRedirects: 0 });
  assert.equal(response.status(), 303, "Share locator must use a private internal redirect");
  assert.equal(response.headers()["cache-control"], "private, no-store");
  assert.equal(response.headers()["referrer-policy"], "no-referrer");
  assert.equal(await response.body().then((body) => body.length), 0, "Share redirect must have no token-bearing body");
  const target = new URL(response.headers().location, appUrl);
  assert.equal(target.origin, appUrl);
  assert.equal(target.pathname, expectedPath);
  if (expectedMode) assert.equal(target.searchParams.get("mode"), expectedMode);
  assert(!target.href.includes(new URL(url).pathname.split("/").at(-1)), "Redirect must not repeat the share token");
  return target;
}

async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(size.scroll <= size.client + 1, `${label} has horizontal overflow (${size.scroll} > ${size.client})`);
}

const browser = await chromium.launch({ headless: true });
const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await ownerContext.newPage();
try {
  await signUp(ownerContext, page);
  await setupPublishedIdentity();
  await page.goto(`${appUrl}/app/tap`);
  await page.getByRole("heading", { name: "Your Tap." }).waitFor();
  const firstUrl = await quickLink(page);
  const firstQr = await page.locator('svg[aria-label="Setuvara Quick QR"]').evaluate((svg) => svg.outerHTML);
  const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await expectRedirect(visitor, firstUrl, `/${account.username}`, "personal");

  await modeButton(page, "Event").click();
  await page.getByText("Event is now equipped for viewing.").waitFor();
  assert.equal(await quickLink(page), firstUrl, "Changing Equipped Mode must keep the Quick QR URL stable");
  assert.equal(await page.locator('svg[aria-label="Setuvara Quick QR"]').evaluate((svg) => svg.outerHTML), firstQr, "Changing Equipped Mode must keep QR modules stable");
  const eventTarget = await expectRedirect(visitor, firstUrl, `/${account.username}`, "event");
  assert.equal(eventTarget.searchParams.get("source"), "quick_qr");
  await page.reload();
  await quickLink(page);
  assert.equal(await modeButton(page, "Event").getAttribute("aria-pressed"), "true", "Equipped Mode persists after refresh");
  assert.equal(await quickLink(page), firstUrl);
  console.log("PASS Equipped Mode persistence and stable Quick QR that follows the selected Mode");

  await setPolicy("event", "direct_only");
  await page.reload();
  await quickLink(page);
  await page.getByRole("button", { name: /View profile Open the equipped Mode/ }).click();
  const viewVisitor = await browser.newContext();
  await expectRedirect(viewVisitor, firstUrl, `/${account.username}`, "event");
  assert.equal((await viewVisitor.cookies(appUrl)).some((cookie) => cookie.name.startsWith("sv-pass-")), false, "View intent must not issue a Connection Pass");
  const viewPage = await viewVisitor.newPage();
  const viewResponse = await viewPage.goto(firstUrl);
  assert.equal(viewResponse?.status(), 200);
  assert(!(await viewResponse.text()).includes(new URL(firstUrl).pathname.split("/").at(-1)), "Public profile HTML must not serialize the Quick QR token");
  assert.equal(await viewPage.getByRole("button", { name: /^Connect(?: at .+)?$/ }).count(), 0, "Direct-only Mode remains view-only through Quick QR view intent");
  await viewVisitor.close();

  await page.getByRole("button", { name: /Connect in person Give a nearby visitor/ }).click();
  await page.getByText("Event is now equipped for meeting in person.").waitFor();
  await page.reload();
  await quickLink(page);
  assert.equal(await quickLink(page), firstUrl, "Changing intent must not rotate the Quick QR URL");
  const directVisitor = await browser.newContext();
  await expectRedirect(directVisitor, firstUrl, `/${account.username}`, "event");
  assert((await directVisitor.cookies(appUrl)).some((cookie) => cookie.name === `sv-pass-${account.username}-event` && cookie.httpOnly), "Direct-only in-person scan issues an HttpOnly, Mode-scoped pass");
  const directPage = await directVisitor.newPage();
  await directPage.goto(firstUrl);
  await directPage.getByRole("button", { name: /^Connect(?: at .+)?$/ }).waitFor();
  await directVisitor.close();
  console.log("PASS Quick QR distinguishes view intent from a Direct-only in-person pass");

  await setPolicy("event", "nobody");
  await page.reload();
  await quickLink(page);
  assert.equal(await page.getByRole("button", { name: /Connect in person Turn on Connect/ }).isDisabled(), true, "Nobody policy disables the in-person choice");
  const nobodyVisitor = await browser.newContext();
  await expectRedirect(nobodyVisitor, firstUrl, `/${account.username}`, "event");
  assert.equal((await nobodyVisitor.cookies(appUrl)).some((cookie) => cookie.name.startsWith("sv-pass-")), false, "Nobody policy cannot issue a Connection Pass");
  const nobodyPage = await nobodyVisitor.newPage();
  await nobodyPage.goto(firstUrl);
  assert.equal(await nobodyPage.getByRole("button", { name: /^Connect(?: at .+)?$/ }).count(), 0);
  await nobodyVisitor.close();
  console.log("PASS Nobody policy keeps Quick QR view-only and grants no pass");

  await page.getByLabel("Name your Tap").fill("Tap experience card");
  await page.getByRole("button", { name: "Create Tap URL" }).click();
  const oneTime = page.getByRole("dialog", { name: "Tap experience card is ready." });
  await oneTime.waitFor();
  await page.screenshot({ path: resolve(root, ".next", "tap-one-time-390.png") });
  const physicalUrl = new URL((await oneTime.locator("p").filter({ hasText: /\/t\// }).innerText()).trim());
  assert.equal(physicalUrl.origin, appUrl);
  assert.match(physicalUrl.pathname, /^\/t\/[A-Za-z0-9_-]{43}$/);
  await oneTime.getByRole("button", { name: "Done" }).click();
  await page.reload();
  await quickLink(page);
  assert.equal((await page.content()).includes(physicalUrl.pathname), false, "Physical Tap URL must not reappear after its one-time display closes");
  const deviceList = await page.evaluate(async () => (await fetch("/api/tap/devices", { credentials: "same-origin" })).json());
  assert(!JSON.stringify(deviceList).includes(physicalUrl.pathname.split("/").at(-1)), "Device list API must not reveal the Tap token");
  assert(!JSON.stringify(deviceList).includes("token_hash"), "Device list API must not reveal token hashes");
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "Tap experience card" }) });
  await card.getByRole("button", { name: "Pause" }).click();
  await page.getByText("Tap paused.").waitFor();
  await expectRedirect(visitor, physicalUrl.toString(), "/t/unavailable");
  await card.getByRole("button", { name: "Turn on" }).click();
  await page.getByText("Tap is active again.").waitFor();
  await expectRedirect(visitor, physicalUrl.toString(), `/${account.username}`, "event");
  await card.getByRole("button", { name: "Mark lost" }).click();
  await card.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Tap marked lost.").waitFor();
  await expectRedirect(visitor, physicalUrl.toString(), "/t/unavailable");
  await card.getByRole("button", { name: "Recover with new URL" }).click();
  await card.getByRole("button", { name: "Continue" }).click();
  const recovered = page.getByRole("dialog", { name: "Tap experience card is ready." });
  await recovered.waitFor();
  const replacementUrl = new URL((await recovered.locator("p").filter({ hasText: /\/t\// }).innerText()).trim());
  assert.notEqual(replacementUrl.toString(), physicalUrl.toString());
  await expectRedirect(visitor, physicalUrl.toString(), "/t/unavailable");
  await expectRedirect(visitor, replacementUrl.toString(), `/${account.username}`, "event");
  await recovered.getByRole("button", { name: "Done" }).click();
  console.log("PASS owner creates, pauses, resumes, marks lost, and rotates a physical Tap URL without redisplaying the secret");

  await page.goto(`${appUrl}/app/identity?mode=business&section=share`);
  const modeQr = page.locator('svg[data-share-intent="profile"][data-qr-value]');
  await modeQr.waitFor();
  const modeUrl = new URL(await modeQr.getAttribute("data-qr-value"));
  assert.equal(modeUrl.origin, appUrl);
  assert.equal(modeUrl.pathname, `/${account.username}`);
  assert.equal(modeUrl.searchParams.get("mode"), "business");
  assert(!modeUrl.pathname.startsWith("/q/"), "Mode-specific Share retains its own canonical QR URL");
  console.log("PASS existing Mode-specific Share QR remains separate from Quick QR");

  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${appUrl}/app/tap`);
    await quickLink(page);
    await page.getByText(/Now equipped:/).waitFor();
    await page.waitForFunction(() => {
      const legend = [...document.querySelectorAll("legend")].find((item) => item.textContent?.includes("CHOOSE A MODE"));
      return legend?.closest("fieldset")?.disabled === false;
    });
    assert.equal(await modeButton(page, "Event").isEnabled(), true, "An enabled Mode control must be usable after Tap loads");
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll('button[aria-pressed="true"]')]
        .find((item) => item.textContent?.includes("Event"));
      return button && getComputedStyle(button).backgroundColor === "rgb(13, 13, 13)";
    });
    const selectedStyle = await modeButton(page, "Event").evaluate((button) => ({
      pressed: button.getAttribute("aria-pressed"),
      background: getComputedStyle(button).backgroundColor,
      opacity: getComputedStyle(button).opacity,
    }));
    assert.deepEqual(selectedStyle, { pressed: "true", background: "rgb(13, 13, 13)", opacity: "1" }, "Selected Equipped Mode needs the intended high-contrast ink treatment");
    await noOverflow(page, `/app/tap ${viewport.width}x${viewport.height}`);
    await page.screenshot({ path: resolve(root, ".next", `tap-experience-${viewport.width}.png`), fullPage: true });
    assert.equal(await page.getByRole("button", { name: "Copy Quick link" }).isVisible(), true);
    assert.equal(await page.getByLabel("Name your Tap").isVisible(), true);
    const publicPage = await visitor.newPage();
    await publicPage.setViewportSize(viewport);
    const response = await publicPage.goto(`${appUrl}/${account.username}?mode=business`);
    assert.equal(response?.status(), 200);
    await publicPage.locator('article[data-profile-mode="business"]').waitFor();
    await noOverflow(publicPage, `public Business profile ${viewport.width}x${viewport.height}`);
    await publicPage.close();
  }
  await page.getByRole("button", { name: "Copy Quick link" }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), firstUrl, "Copy Quick link should copy the stable URL");
  console.log("PASS Tap and public profile at 390x844, 768x1024, 1440x900; clipboard copy works");

  await page.getByRole("button", { name: "Replace QR" }).click();
  await page.getByRole("button", { name: "Replace it" }).click();
  await page.getByText("Your previous Quick QR no longer opens. Use this new one.").waitFor();
  const replacementQuickUrl = await quickLink(page);
  assert.notEqual(replacementQuickUrl, firstUrl, "Explicit replacement must rotate the Quick QR token");
  await expectRedirect(visitor, firstUrl, "/q/unavailable");
  await expectRedirect(visitor, replacementQuickUrl, `/${account.username}`, "event");
  await page.reload();
  assert.equal(await quickLink(page), replacementQuickUrl, "Replacement Quick QR persists after refresh");
  console.log("PASS explicit Quick QR replacement invalidates the previous URL and persists");
  await visitor.close();
} finally {
  await browser.close();
  await user.auth.signOut({ scope: "local" }).catch(() => {});
  if (!userId) {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = listed.data?.users?.find((item) => item.email === account.email)?.id ?? null;
  }
  if (userId) {
    const removed = await admin.auth.admin.deleteUser(userId);
    assert.ifError(removed.error);
  }
}

console.log("Local Tap experience E2E completed successfully.");
