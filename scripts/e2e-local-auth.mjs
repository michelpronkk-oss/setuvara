import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

assert(supabaseUrl && new URL(supabaseUrl).hostname === "127.0.0.1", "E2E must use local Supabase only");
assert(publishableKey, "Local Supabase publishable key is required");
assert(new URL(appUrl).hostname === "127.0.0.1", "E2E app must use localhost only");
assert(new URL(mailpitUrl).hostname === "127.0.0.1", "E2E mail capture must use localhost only");

const suffix = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const owner = {
  email: `e2e-owner-${suffix}@example.test`,
  password: `${randomBytes(32).toString("base64url")}Aa1!`,
  username: `e2e_owner_${suffix}`,
};
const other = {
  email: `e2e-other-${suffix}@example.test`,
  password: `${randomBytes(32).toString("base64url")}Aa1!`,
  username: `e2e_other_${suffix}`,
};

function localUserClient() {
  return createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function waitForConfirmation(email) {
  const deadline = Date.now() + 25_000;

  while (Date.now() < deadline) {
    const listResponse = await fetch(`${mailpitUrl}/api/v1/messages?limit=50`);
    assert.equal(listResponse.status, 200, "Mailpit message list must be reachable");
    const list = await listResponse.json();
    const messages = list.messages ?? list.Messages ?? [];
    const message = messages.find((entry) =>
      JSON.stringify(entry.To ?? entry.to ?? []).toLowerCase().includes(email.toLowerCase()),
    );

    if (message) {
      const id = message.ID ?? message.id;
      const detailResponse = await fetch(`${mailpitUrl}/api/v1/message/${encodeURIComponent(id)}`);
      assert.equal(detailResponse.status, 200, "Mailpit confirmation message must be readable");
      const detail = await detailResponse.json();
      const body = `${detail.HTML ?? detail.html ?? ""}\n${detail.Text ?? detail.text ?? ""}`;
      const rawLink = body.match(/https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/i)?.[0];
      assert(rawLink, "Confirmation email must contain a direct /auth/confirm link");

      const confirmationUrl = new URL(rawLink.replaceAll("&amp;", "&"));
      assert.equal(confirmationUrl.origin, appUrl, "Confirmation link must stay on the local Setuvara origin");
      assert.equal(confirmationUrl.pathname, "/auth/confirm");
      assert(confirmationUrl.searchParams.get("token_hash"), "Confirmation link must carry token_hash");
      assert.equal(confirmationUrl.searchParams.get("type"), "email");
      assert.equal(confirmationUrl.searchParams.get("next"), "/app/identity");
      return confirmationUrl.toString();
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error("Timed out waiting for the local signup confirmation email");
}

async function signUpAndConfirm(browser, account) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let confirmationRouteSeen = false;
  const browserErrors = [];
  const apiRequests = [];
  const failedRequests = [];
  const consoleErrors = [];
  const authResponses = [];

  page.on("pageerror", (error) => browserErrors.push(`${error.name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 240));
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    failedRequests.push(`${url.hostname}${url.pathname}: ${request.failure()?.errorText ?? "failed"}`);
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.endsWith(".js") && response.status() >= 400) {
      failedRequests.push(`script ${url.pathname}: HTTP ${response.status()}`);
    }
    if (["/auth/confirm", "/app/identity", "/login"].includes(url.pathname)) {
      authResponses.push({
        origin: url.origin,
        path: url.pathname,
        status: response.status(),
        location: response.headers()["location"] ?? "",
      });
    }
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.port === "54321") apiRequests.push(`${request.method()} ${url.pathname}`);
  });

  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/auth/confirm") confirmationRouteSeen = true;
  });

  await page.goto(`${appUrl}/signup`);
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    const propsKey = form && Object.keys(form).find((key) => key.startsWith("__reactProps$"));
    return Boolean(propsKey && typeof form[propsKey].onSubmit === "function");
  }, { timeout: 20_000 });
  await page.getByLabel("Display name").fill("Setuvara E2E Identity");
  await page.getByLabel("Username").fill(account.username);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  try {
    await page.getByRole("button", { name: "Create your identity" }).click({ timeout: 8_000 });
  } catch (error) {
    const visibleText = (await page.locator("body").innerText()).slice(0, 600);
    const pageAddress = new URL(page.url());
    throw new Error(`Signup button did not complete. Current page: ${pageAddress.origin}${pageAddress.pathname}. Visible page: ${visibleText}. Auth responses: ${JSON.stringify(authResponses)}. API requests: ${apiRequests.join(", ")}. Failed requests: ${failedRequests.join("; ")}. Console errors: ${consoleErrors.join("; ")}. Browser errors: ${browserErrors.join("; ")}. Cause: ${error instanceof Error ? error.message.split("\n")[0] : "unknown"}`);
  }
  const statusMessage = page.locator('[aria-live="polite"]');
  try {
    await statusMessage.waitFor({ timeout: 15_000 });
  } catch {
    const visibleText = (await page.locator("body").innerText()).slice(0, 600);
    const runtime = await page.evaluate(() => ({
      scripts: document.scripts.length,
      readyState: document.readyState,
      nextData: Boolean(document.getElementById("__next-build-watcher")),
    }));
    throw new Error(`Signup produced no status message. Visible page: ${visibleText}. Runtime: ${JSON.stringify(runtime)}. API requests: ${apiRequests.join(", ")}. Failed requests: ${failedRequests.join("; ")}. Console errors: ${consoleErrors.join("; ")}. Browser errors: ${browserErrors.join("; ")}`);
  }
  const signupMessage = await statusMessage.innerText();
  assert(
    signupMessage.includes("Check your email to confirm your account"),
    `Signup did not succeed: ${signupMessage || "no status message was shown"}`,
  );

  const confirmationUrl = await waitForConfirmation(account.email);
  await page.goto(confirmationUrl);
  try {
    await page.waitForURL(`${appUrl}/app/identity`, { timeout: 20_000 });
  } catch {
    const cookies = (await context.cookies()).map(({ name, domain }) => ({ name, domain }));
    throw new Error(`Confirmation did not land on Identity. Current URL: ${new URL(page.url()).origin}${new URL(page.url()).pathname}. Auth responses: ${JSON.stringify(authResponses)}. Cookie names: ${JSON.stringify(cookies)}. Browser errors: ${browserErrors.join("; ")}`);
  }
  try {
    await page.getByText("Identity editor", { exact: true }).waitFor({ timeout: 10_000 });
  } catch {
    const visibleText = (await page.locator("body").innerText()).slice(0, 800);
    const cookies = (await context.cookies()).map(({ name, domain }) => ({ name, domain }));
    throw new Error(`Confirmation reached ${new URL(page.url()).pathname} but the editor did not load. Visible page: ${visibleText}. Cookies: ${JSON.stringify(cookies)}. Auth responses: ${JSON.stringify(authResponses)}`);
  }

  assert(confirmationRouteSeen, "/auth/confirm must be requested in the signup browser context");
  const cookies = await context.cookies(appUrl);
  assert(
    cookies.some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")),
    "Confirmation must establish a Supabase SSR auth cookie",
  );

  return { context, page };
}

async function addLink(page, modeLabel, title, url) {
  const titleInput = page.getByRole("textbox", { name: `${modeLabel} link title` });
  const form = page.locator("form").filter({ has: titleInput });
  await titleInput.fill(title);
  await form.getByRole("textbox", { name: `${modeLabel} link URL` }).fill(url);
  await form.getByRole("button", { name: "Add link" }).click();
  await page.getByText("Link added.", { exact: true }).waitFor();
  try {
    await page.getByRole("link", { name: title, exact: true }).waitFor({ timeout: 8_000 });
  } catch {
    const visibleText = (await page.locator("body").innerText()).slice(0, 800);
    throw new Error(`${modeLabel} link ${title} was accepted but not visible in the editor. Page text: ${visibleText}`);
  }
}

async function saveIdentity(page) {
  await page.getByLabel("Display name").fill("Setuvara E2E Owner");
  await page.getByLabel("Bio").fill("Local-only identity persistence check.");
  await page.getByRole("button", { name: "Save identity" }).click();
  await page.getByText("Identity saved.", { exact: true }).waitFor();
}

async function publish(page, isPublished) {
  const checkbox = page.getByRole("checkbox", { name: "Public profile" });
  if (isPublished) await checkbox.check();
  else await checkbox.uncheck();
  await page.getByRole("button", { name: "Save publishing status" }).click();
  await page.getByText(isPublished ? "Your public profile is live." : "Your public profile is now private.", { exact: true }).waitFor();
}

function createAuthenticatedClient(email, password) {
  const client = localUserClient();
  return client.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
    assert.ifError(error);
    assert(data.session && data.user, "Normal password sign-in must establish an authenticated user session");
    return { client, user: data.user };
  });
}

async function expectNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(
    dimensions.scrollWidth <= dimensions.clientWidth + 1,
    `${label} has horizontal overflow (${dimensions.scrollWidth}px > ${dimensions.clientWidth}px)`,
  );
}

async function checkResponsiveAuth(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();

  for (const route of ["/signup", "/login"]) {
    const response = await page.goto(`${appUrl}${route}`);
    assert.equal(response?.status(), 200, `${route} should render at ${width}px`);
    await expectNoHorizontalOverflow(page, `${route} at ${width}px`);
    const inputSizes = await page.locator("input").evaluateAll((inputs) =>
      inputs.map((input) => Number.parseFloat(getComputedStyle(input).fontSize)),
    );
    assert(inputSizes.every((size) => size >= 16), `${route} inputs must use mobile-safe typography`);
    const submit = page.locator('button[type="submit"]');
    const box = await submit.boundingBox();
    assert(box && box.height >= 44 && box.width >= 44, `${route} submit target must be usable at ${width}px`);
  }

  await context.close();
}

async function checkIsolation(ownerCredentials, otherCredentials, ownerId, ownerModeIds, ownerLinkIds) {
  const { client: ownerClient } = await createAuthenticatedClient(ownerCredentials.email, ownerCredentials.password);
  const { client: otherClient } = await createAuthenticatedClient(otherCredentials.email, otherCredentials.password);

  for (const candidate of ["LOGIN", "APP", "AUTH", "API"]) {
    const { data, error } = await otherClient.rpc("is_username_available", {
      candidate_username: candidate,
    });
    assert.ifError(error);
    assert.equal(data, false, `Reserved username ${candidate} must be unavailable`);
  }

  for (const candidate of ["loginx", "appdev", "authentic", "apiv2"]) {
    const { data, error } = await otherClient.rpc("is_username_available", {
      candidate_username: candidate,
    });
    assert.ifError(error);
    assert.equal(data, true, `Valid similar username ${candidate} must remain available`);
  }

  const attemptedUsername = `other_${suffix}`;
  const profileUpdate = await otherClient
    .from("profiles")
    .update({ username: attemptedUsername, display_name: "Unauthorized change", is_published: false })
    .eq("id", ownerId)
    .select("id");
  assert.ifError(profileUpdate.error);
  assert.equal(profileUpdate.data.length, 0, "Second user must not change owner profile, username, or publish state");

  const modeUpdate = await otherClient
    .from("profile_modes")
    .update({ label: "Unauthorized mode" })
    .eq("id", ownerModeIds[0])
    .select("id");
  assert.ifError(modeUpdate.error);
  assert.equal(modeUpdate.data.length, 0, "Second user must not update owner modes");

  const modeInsert = await otherClient
    .from("profile_modes")
    .insert({ profile_id: ownerId, slug: "social", label: "Unauthorized mode" });
  assert(modeInsert.error, "Second user must not add an owner mode");

  const modeDelete = await otherClient
    .from("profile_modes")
    .delete()
    .eq("id", ownerModeIds[0])
    .select("id");
  assert.ifError(modeDelete.error);
  assert.equal(modeDelete.data.length, 0, "Second user must not delete owner modes");

  const linkInsert = await otherClient
    .from("profile_links")
    .insert({
      profile_id: ownerId,
      mode_id: ownerModeIds[0],
      title: "Unauthorized link",
      url: "https://example.test/unauthorized",
    });
  assert(linkInsert.error, "Second user must not add an owner link");

  const linkUpdate = await otherClient
    .from("profile_links")
    .update({ title: "Unauthorized link edit" })
    .eq("id", ownerLinkIds[0])
    .select("id");
  assert.ifError(linkUpdate.error);
  assert.equal(linkUpdate.data.length, 0, "Second user must not update owner links");

  const linkDelete = await otherClient
    .from("profile_links")
    .delete()
    .eq("id", ownerLinkIds[0])
    .select("id");
  assert.ifError(linkDelete.error);
  assert.equal(linkDelete.data.length, 0, "Second user must not delete owner links");

  const ownerProfile = await ownerClient
    .from("profiles")
    .select("username, display_name, is_published")
    .eq("id", ownerId)
    .single();
  assert.ifError(ownerProfile.error);
  assert.equal(ownerProfile.data.username, ownerCredentials.username);
  assert.equal(ownerProfile.data.display_name, "Setuvara E2E Owner");
  assert.equal(ownerProfile.data.is_published, true);

  const ownerModes = await ownerClient
    .from("profile_modes")
    .select("id, slug, label")
    .eq("profile_id", ownerId)
    .order("sort_order");
  assert.ifError(ownerModes.error);
  assert.deepEqual(ownerModes.data.map((mode) => mode.slug), ["social", "business"]);
  assert.deepEqual(ownerModes.data.map((mode) => mode.label), ["Social", "Business"]);

  const ownerLinks = await ownerClient
    .from("profile_links")
    .select("id, title, is_visible")
    .eq("profile_id", ownerId)
    .order("sort_order");
  assert.ifError(ownerLinks.error);
  assert.deepEqual(ownerLinks.data.map((link) => link.title), ["Portfolio", "Contact"]);

  await ownerClient.auth.signOut();
  await otherClient.auth.signOut();
}

const browser = await chromium.launch({ headless: true });
let ownerBrowser;
let otherBrowser;
let ownerId;
let ownerModeIds;
let ownerLinkIds;

try {
  ownerBrowser = await signUpAndConfirm(browser, owner);
  console.log("PASS local owner signup → captured email → /auth/confirm → authenticated /app/identity");

  await ownerBrowser.page.getByText("Social", { exact: true }).first().waitFor();
  await ownerBrowser.page.getByText("Business", { exact: true }).first().waitFor();
  await saveIdentity(ownerBrowser.page);
  await addLink(ownerBrowser.page, "Social", "Portfolio", "https://example.test/portfolio");
  await addLink(ownerBrowser.page, "Business", "Contact", "https://example.test/contact");
  await ownerBrowser.page.reload();
  await ownerBrowser.page.getByRole("link", { name: "Portfolio" }).waitFor();
  await ownerBrowser.page.getByRole("link", { name: "Contact" }).waitFor();
  console.log("PASS Identity editor, default modes, profile persistence, and multiple links");

  await publish(ownerBrowser.page, true);
  const ownerProfileUrl = `${appUrl}/${owner.username}`;
  const anonContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const anonPage = await anonContext.newPage();
  let publicResponse = await anonPage.goto(ownerProfileUrl);
  assert.equal(publicResponse?.status(), 200, "Published root username profile must return 200 to a logged-out visitor");
  await anonPage.getByRole("heading", { name: "Setuvara E2E Owner" }).waitFor();
  await anonPage.getByRole("link", { name: "Portfolio" }).waitFor();

  const hiddenToggle = ownerBrowser.page.getByRole("button", { name: "Hide Portfolio" });
  await hiddenToggle.click();
  await ownerBrowser.page.getByText("Link visibility updated.", { exact: true }).waitFor();
  await ownerBrowser.page.getByText("Hidden", { exact: true }).waitFor();
  await anonPage.reload();
  await anonPage.getByText("Portfolio", { exact: true }).waitFor({ state: "detached" });
  await ownerBrowser.page.getByRole("button", { name: "Show Portfolio" }).waitFor();
  await ownerBrowser.page.getByRole("button", { name: "Show Portfolio" }).click();
  await ownerBrowser.page.getByText("Link visibility updated.", { exact: true }).waitFor();
  await anonPage.reload();
  await anonPage.getByRole("link", { name: "Portfolio" }).waitFor();
  console.log("PASS RLS-backed visible → hidden → visible public link behavior");

  await publish(ownerBrowser.page, false);
  publicResponse = await anonPage.goto(ownerProfileUrl);
  assert.equal(publicResponse?.status(), 404, "Unpublished root profile must return 404 to logged-out visitors");
  await publish(ownerBrowser.page, true);
  publicResponse = await anonPage.goto(ownerProfileUrl);
  assert.equal(publicResponse?.status(), 200, "Republished root profile must return 200");

  const legacyResponse = await anonContext.request.get(`${appUrl}/u/${owner.username}?mode=business`, {
    maxRedirects: 0,
  });
  assert.equal(legacyResponse.status(), 308, "Legacy /u/ route must permanently redirect");
  assert.equal(legacyResponse.headers().location, `/${owner.username}?mode=business`);
  console.log("PASS publish → unpublish 404 → republish 200 and /u permanent redirect");

  const loggedOutContext = ownerBrowser.context;
  await ownerBrowser.page.getByRole("button", { name: "Sign out" }).click();
  await ownerBrowser.page.waitForURL(`${appUrl}/login`);
  const protectedResponse = await loggedOutContext.request.get(`${appUrl}/app`, { maxRedirects: 0 });
  assert([307, 308].includes(protectedResponse.status()), "/app must redirect unauthenticated visitors");
  await ownerBrowser.page.getByLabel("Email").fill(owner.email);
  await ownerBrowser.page.getByLabel("Password").fill(owner.password);
  await ownerBrowser.page.getByRole("button", { name: "Sign in" }).click();
  await ownerBrowser.page.waitForURL(`${appUrl}/app/identity`);
  await ownerBrowser.page.getByRole("link", { name: "Portfolio" }).waitFor();
  await ownerBrowser.page.getByRole("link", { name: "Contact" }).waitFor();
  await ownerBrowser.page.getByRole("button", { name: "Hide Portfolio" }).waitFor();
  await ownerBrowser.page.getByRole("checkbox", { name: "Public profile" }).waitFor({ state: "visible" });
  await ownerBrowser.page.getByRole("checkbox", { name: "Public profile" }).isChecked().then((checked) =>
    assert.equal(checked, true, "Publish state must persist after login"),
  );
  console.log("PASS logout, protected /app redirect, login, and persisted profile/modes/links/visibility/publish state");

  const ownerAuth = await createAuthenticatedClient(owner.email, owner.password);
  ownerId = ownerAuth.user.id;
  const modesResult = await ownerAuth.client.from("profile_modes").select("id, slug").eq("profile_id", ownerId);
  const linksResult = await ownerAuth.client.from("profile_links").select("id, title").eq("profile_id", ownerId);
  assert.ifError(modesResult.error);
  assert.ifError(linksResult.error);
  ownerModeIds = modesResult.data.map((mode) => mode.id);
  ownerLinkIds = linksResult.data.map((link) => link.id);
  await ownerAuth.client.auth.signOut();

  otherBrowser = await signUpAndConfirm(browser, other);
  await checkIsolation(owner, other, ownerId, ownerModeIds, ownerLinkIds);
  console.log("PASS second-account profile/mode/link/username/publish isolation using normal authenticated clients");

  const staticRoutes = ["/", "/login", "/signup"];
  for (const route of staticRoutes) {
    const response = await anonContext.request.get(`${appUrl}${route}`);
    assert.equal(response.status(), 200, `${route} must remain an application route`);
  }

  const confirmationError = await anonContext.request.get(`${appUrl}/auth/confirm`, { maxRedirects: 0 });
  assert([307, 308].includes(confirmationError.status()), "/auth/confirm without token must return a safe error redirect");
  assert(confirmationError.headers().location?.includes("/login?error=confirmation_failed"));

  const healthResponse = await anonContext.request.get(`${appUrl}/api/health/supabase`);
  assert.equal(healthResponse.status(), 200, "Local Supabase health route must return success");
  assert.deepEqual(await healthResponse.json(), { status: "connected" });

  for (const path of ["/nonexistent_e2e_profile", "/bad%25name"]) {
    const response = await anonContext.request.get(`${appUrl}${path}`);
    assert.equal(response.status(), 404, `${path} must return 404`);
  }

  const urlMaliciousNext = new URL(`${appUrl}/auth/confirm`);
  urlMaliciousNext.searchParams.set("next", "https://example.org/");
  const safeNextResponse = await anonContext.request.get(urlMaliciousNext.toString(), { maxRedirects: 0 });
  assert([307, 308].includes(safeNextResponse.status()));
  assert.equal(safeNextResponse.headers().location, "/login?error=confirmation_failed");

  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
    await checkResponsiveAuth(browser, width, height);
    await ownerBrowser.page.setViewportSize({ width, height });
    await ownerBrowser.page.goto(`${appUrl}/app/identity`);
    await ownerBrowser.page.getByText("Identity editor", { exact: true }).waitFor();
    await expectNoHorizontalOverflow(ownerBrowser.page, `Identity editor at ${width}px`);
    const saveButton = await ownerBrowser.page.getByRole("button", { name: "Save identity" }).boundingBox();
    assert(saveButton && saveButton.height >= 44, `Identity save target must be usable at ${width}px`);
    await anonPage.setViewportSize({ width, height });
    const profileResponse = await anonPage.goto(ownerProfileUrl);
    assert.equal(profileResponse?.status(), 200);
    await expectNoHorizontalOverflow(anonPage, `Public profile at ${width}px`);
    const publicLink = await anonPage.getByRole("link", { name: "Portfolio" }).boundingBox();
    assert(publicLink && publicLink.height >= 44, `Public profile link target must be usable at ${width}px`);
  }
  console.log("PASS responsive signup/login/editor/public profile at 390×844, 768×1024, and 1440×900");

  for (const context of [ownerBrowser.context, otherBrowser.context, anonContext]) await context.close();
  await ownerAuth.client.auth.signOut();
  console.log("PASS static/auth/API/public routing regression checks");
  console.log("E2E_LOCAL_RESULT=PASS");
} catch (error) {
  console.error(`E2E_LOCAL_RESULT=FAIL (${error instanceof Error ? error.message : "unknown error"})`);
  process.exitCode = 1;
} finally {
  if (ownerBrowser?.context) await ownerBrowser.context.close().catch(() => {});
  if (otherBrowser?.context) await otherBrowser.context.close().catch(() => {});
  await browser.close().catch(() => {});
}
