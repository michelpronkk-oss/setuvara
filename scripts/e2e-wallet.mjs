import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.E2E_LOCAL_SERVICE_KEY;
const root = resolve(process.cwd());
const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
assert.equal(gitRoot.replaceAll("\\", "/").toLowerCase(), root.replaceAll("\\", "/").toLowerCase());
assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "Wallet E2E requires local Setuvara Supabase");
assert(publishableKey && serviceKey, "Local E2E keys must be supplied in process memory");
assert(new URL(appUrl).hostname === "127.0.0.1" && new URL(mailpitUrl).hostname === "127.0.0.1");

// Keep both prefixed usernames within Setuvara's 24-character claim limit.
const suffix = `${Date.now().toString(36).slice(-3)}${randomBytes(4).toString("hex")}`;
const accounts = [
  { email: `e2e-wallet-owner-${suffix}@example.test`, password: `${randomBytes(32).toString("base64url")}Aa1!`, username: `wallet_owner_${suffix}` },
  { email: `e2e-wallet-other-${suffix}@example.test`, password: `${randomBytes(32).toString("base64url")}Bb2!`, username: `wallet_other_${suffix}` },
];
const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const browser = await chromium.launch({ headless: true });
const contexts = [];

function userClient() {
  return createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function readConfirmationUrl(email) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=50`);
    assert.equal(response.status, 200, "Local Mailpit must be available");
    const messages = (await response.json()).messages ?? [];
    const found = messages.find((message) => JSON.stringify(message.To ?? message.to ?? []).toLowerCase().includes(email.toLowerCase()));
    if (found) {
      const detailResponse = await fetch(`${mailpitUrl}/api/v1/message/${encodeURIComponent(found.ID ?? found.id)}`);
      assert.equal(detailResponse.status, 200);
      const detail = await detailResponse.json();
      const body = `${detail.HTML ?? detail.html ?? ""}\n${detail.Text ?? detail.text ?? ""}`;
      const raw = body.match(/https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/i)?.[0];
      assert(raw, "Local signup email must use the Setuvara /auth/confirm route");
      const url = new URL(raw.replaceAll("&amp;", "&"));
      assert.equal(url.origin, appUrl);
      assert.equal(url.pathname, "/auth/confirm");
      assert(url.searchParams.has("token_hash"));
      assert.equal(url.searchParams.get("type"), "email");
      assert.equal(url.searchParams.get("next"), "/app/identity");
      return url.toString();
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error("Local signup confirmation email was not captured");
}

async function createConfirmedAccount(account) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  contexts.push(context);
  const page = await context.newPage();
  let confirmSeen = false;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/auth/confirm") confirmSeen = true;
  });
  await page.goto(`${appUrl}/signup`);
  await page.getByLabel("Username").fill(account.username);
  await page.getByText("Available. It’s yours if you want it.").waitFor();
  await page.getByRole("button", { name: `Claim @${account.username}` }).click();
  await page.getByLabel("Your name").fill("Setuvara Wallet Test");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Create my Setuvara" }).click();
  await page.getByRole("heading", { name: "Check your inbox." }).waitFor({ timeout: 15_000 });
  const confirmationUrl = await readConfirmationUrl(account.email);
  await page.goto(confirmationUrl);
  await page.waitForURL(`${appUrl}/app/identity`, { timeout: 20_000 });
  assert(confirmSeen, "Signup must verify token_hash in the same browser context");
  const cookies = await context.cookies(appUrl);
  assert(cookies.some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")), "Confirmation must establish a Supabase SSR session");
  return { context, page };
}

async function assertNoOverflow(page, width, height) {
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(dimensions.scroll <= dimensions.client + 1, `Wallet ${width}x${height} overflows horizontally`);
}

let ownerUserId = null;
try {
  const owner = await createConfirmedAccount(accounts[0]);
  const ownerClient = userClient();
  const signIn = await ownerClient.auth.signInWithPassword({ email: accounts[0].email, password: accounts[0].password });
  assert.ifError(signIn.error);
  ownerUserId = signIn.data.user.id;
  const ownerResponse = await owner.page.request.get(`${appUrl}/api/wallet`);
  const initial = await ownerResponse.json();
  if (ownerResponse.status() !== 200) {
    const [equipped, modes] = await Promise.all([
      admin.from("equipped_share_states").select("mode_id").eq("profile_id", ownerUserId).maybeSingle(),
      admin.from("profile_modes").select("id,slug,is_enabled").eq("profile_id", ownerUserId).order("sort_order"),
    ]);
    console.error("Wallet readiness diagnostic", JSON.stringify({
      equippedError: equipped.error?.code ?? null,
      equippedModeExists: Boolean(equipped.data?.mode_id),
      modesError: modes.error?.code ?? null,
      modes: modes.data?.map(({ slug, is_enabled }) => ({ slug, is_enabled })) ?? null,
    }));
  }
  assert.equal(ownerResponse.status(), 200, `A confirmed Free owner can read Wallet readiness (${initial.error ?? ownerResponse.status()})`);
  assert.equal(initial.walletPubliclyLaunched, false, "Wallet product launch is deliberately off while providers remain inactive");
  assert.equal(initial.profile.username, accounts[0].username);
  assert.equal(Object.hasOwn(initial, "providers"), false, "Inactive provider readiness is not exposed through the consumer Wallet API");
  assert.equal(Object.hasOwn(initial, "pass"), false, "No pass internals are returned before the product launch");
  assert.equal(Object.hasOwn(initial, "canUseWallet"), false, "Consumer Wallet API does not expose entitlement internals before launch");
  assert.doesNotMatch(JSON.stringify(initial), /secret|private.?key|service.?role|credential/i);

  const passFixture = await admin.from("wallet_passes").insert({ profile_id: ownerUserId }).select("profile_id").single();
  assert.ifError(passFixture.error);

  const ownerApple = await owner.page.request.get(`${appUrl}/api/wallet/apple`);
  assert.equal(ownerApple.status(), 503, "Apple pass creation must fail closed until Apple configuration exists");
  const ownerGoogle = await owner.page.request.post(`${appUrl}/api/wallet/google`, {
    headers: { Origin: appUrl, "content-type": "application/json" },
    data: {},
  });
  assert.equal(ownerGoogle.status(), 503, "Google Save-to-Wallet must fail closed until issuer configuration exists");

  await owner.page.goto(`${appUrl}/app/wallet`);
  await owner.page.getByRole("heading", { name: "Your identity, ready when you are." }).waitFor();
  await owner.page.getByText("Apple Wallet + Google Wallet", { exact: true }).waitFor();
  await owner.page.getByText("Coming soon", { exact: true }).waitFor();
  await owner.page.getByText("Carry your Setuvara identity with you.").waitFor();
  await owner.page.getByText("Quick QR remains ready today.").waitFor();
  const walletPageText = await owner.page.locator("main").innerText();
  assert.doesNotMatch(walletPageText, /issuer|certificate|PassKit|signing|service account|setup required|APNs|Google Cloud|provider/i, "Consumer Wallet page does not expose setup details");
  assert.equal(await owner.page.locator('nav[aria-label="Main navigation"] a[href="/app/wallet"]').count(), 0, "Wallet is absent from primary app navigation while not launched");
  assert.equal(await owner.page.getByRole("link", { name: "Add pass" }).count(), 0);
  assert.equal(await owner.page.getByRole("button", { name: "Add pass" }).count(), 0);

  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
    await owner.page.setViewportSize({ width, height });
    await assertNoOverflow(owner.page, width, height);
    const modeLink = owner.page.getByRole("link", { name: /Change Equipped Mode/ });
    const modeBounds = await modeLink.boundingBox();
    assert(modeBounds && modeBounds.height >= 44 && modeBounds.width > 0, `Equipped Mode control is reachable at ${width}px`);
    const qrLink = owner.page.getByRole("link", { name: "Use Quick QR" });
    const qrBounds = await qrLink.boundingBox();
    assert(qrBounds && qrBounds.height >= 44 && qrBounds.width > 0, `Quick QR action is reachable at ${width}px`);
    assert(await owner.page.getByRole("heading", { name: "Your identity, ready when you are." }).isVisible());
  }

  const other = await createConfirmedAccount(accounts[1]);
  const otherClient = userClient();
  const otherSignIn = await otherClient.auth.signInWithPassword({ email: accounts[1].email, password: accounts[1].password });
  assert.ifError(otherSignIn.error);

  const walletRead = await otherClient.from("wallet_passes").select("profile_id").eq("profile_id", ownerUserId);
  assert(walletRead.error, "A second authenticated account cannot read the owner’s Wallet provider state");
  const walletUpdate = await otherClient.from("wallet_passes").update({ appearance_preset: "editorial" }).eq("profile_id", ownerUserId).select("profile_id");
  assert(walletUpdate.error || walletUpdate.data?.length === 0, "A second authenticated account cannot change the owner’s Wallet pass");
  const unchanged = await admin.from("wallet_passes").select("appearance_preset").eq("profile_id", ownerUserId).single();
  assert.ifError(unchanged.error);
  assert.equal(unchanged.data.appearance_preset, "classic");

  const privateResponse = await other.page.request.get(`${appUrl}/api/wallet`);
  assert.equal(privateResponse.status(), 200, "Account 2 gets only its own Wallet state");
  const otherState = await privateResponse.json();
  assert.equal(otherState.profile.username, accounts[1].username);
  assert.equal(Object.hasOwn(otherState, "pass"), false, "Account 2 cannot see pass internals through the pre-launch application API");
  const anonymousPage = await browser.newPage();
  assert.equal((await anonymousPage.request.get(`${appUrl}/api/wallet`)).status(), 401, "Unauthenticated Wallet API access remains blocked");
  const roadmapResponse = await anonymousPage.goto(`${appUrl}/roadmap`);
  assert.equal(roadmapResponse?.status(), 200, "Public roadmap loads without authentication");
  await anonymousPage.getByRole("heading", { name: "Built around the moments that matter." }).waitFor();
  for (const item of ["Identity", "Personal, Event & Business", "Quick QR", "Setuvara Tap", "Connections", "Passport", "Analytics", "Apple & Google Wallet", "Product refinement", "Identity expression", "Physical Setuvara"]) {
    assert(await anonymousPage.getByText(item, { exact: true }).count(), `Roadmap includes ${item}`);
  }
  const footerRoadmap = anonymousPage.getByRole("navigation", { name: "Footer navigation" }).getByRole("link", { name: "Roadmap", exact: true });
  assert.equal(await footerRoadmap.getAttribute("href"), "/roadmap", "Footer Roadmap link points to the public route");
  assert.equal(await anonymousPage.locator('link[rel="canonical"]').getAttribute("href"), "https://setuvara.com/roadmap");
  const roadmapText = await anonymousPage.locator("body").innerText();
  assert.doesNotMatch(roadmapText, /issuer|certificate|PassKit|service account|environment variables|APNs|Google Cloud|setup required|provider architecture/i, "Public roadmap contains no Wallet setup details");
  await anonymousPage.goto(`${appUrl}/`);
  await anonymousPage.getByRole("navigation", { name: "Footer navigation" }).getByRole("link", { name: "Roadmap", exact: true }).click();
  await anonymousPage.waitForURL(`${appUrl}/roadmap`);
  assert.equal(new URL(anonymousPage.url()).pathname, "/roadmap", "Footer Roadmap link opens the expected public route");
  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
    await anonymousPage.setViewportSize({ width, height });
    await assertNoOverflow(anonymousPage, width, height);
    assert(await anonymousPage.getByRole("heading", { name: "Built around the moments that matter." }).isVisible(), `Roadmap hero is visible at ${width}px`);
  }
  await anonymousPage.close();
  const anonymousWalletRoute = await browser.newPage();
  await anonymousWalletRoute.goto(`${appUrl}/app/wallet`);
  await anonymousWalletRoute.waitForURL((url) => url.pathname === "/login", { timeout: 10_000 });
  await anonymousWalletRoute.close();

  const publicContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  contexts.push(publicContext);
  const publicResponse = await publicContext.request.get(`${appUrl}/${accounts[0].username}`);
  assert.equal(publicResponse.status(), 404, "A private profile remains absent from logged-out public access");
  console.log("PASS local confirmed signup, consumer Wallet launch gate, hidden provider readiness, Wallet API isolation, public roadmap, and responsive surfaces");
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close().catch(() => {});
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => ({ data: null, error: true }));
  if (!listed.error) {
    for (const user of listed.data.users.filter((candidate) => accounts.some((account) => candidate.email === account.email))) {
      await admin.auth.admin.deleteUser(user.id).catch(() => {});
    }
  }
}
