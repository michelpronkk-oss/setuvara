import assert from "node:assert/strict";
import { chromium } from "playwright";

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3014";
assert.equal(new URL(appUrl).hostname, "127.0.0.1", "Marketing E2E must use the local Setuvara app");

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const routes = [
    { path: "/", heading: "One identity. Every version of you.", title: "Setuvara | One identity. Every version of you." },
    { path: "/pricing", heading: "Keep the network open.", title: "Setuvara plans" },
    { path: "/events", heading: "Bring the right context into the room.", title: "Setuvara for Events" },
    { path: "/teams", heading: "A better introduction starts with people.", title: "Setuvara for Teams" },
    { path: "/roadmap", heading: "Built around the moments that matter.", title: "Setuvara roadmap" },
  ];

  for (const route of routes) {
    const response = await page.goto(new URL(route.path, appUrl).toString());
    assert.equal(response?.status(), 200, `${route.path} should return 200`);
    await page.getByRole("heading", { name: route.heading, exact: true }).waitFor();
    const canonical = new URL(await page.locator('link[rel="canonical"]').getAttribute("href"));
    assert.equal(canonical.origin, "https://setuvara.com", `${route.path} canonical should use the Setuvara domain`);
    assert.equal(canonical.pathname, route.path, `${route.path} canonical path should be correct`);
    assert.equal(await page.locator('meta[property="og:title"]').getAttribute("content"), route.title, `${route.path} should have Open Graph title`);
    assert(await page.locator('meta[property="og:image"]').getAttribute("content"), `${route.path} should have a share image`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(overflow, false, `${route.path} should not overflow at phone width`);
  }

  await page.goto(new URL("/pricing", appUrl).toString());
  const planCards = page.locator("article");
  assert.equal(await planCards.count(), 3, "Pricing shows Free, Plus, and Pro");
  assert((await planCards.nth(0).innerText()).includes("$0"));
  assert((await planCards.nth(1).innerText()).includes("$6.99"));
  assert((await planCards.nth(2).innerText()).includes("$12.99"));
  const freePricing = await planCards.nth(0).innerText();
  const plusPricing = await planCards.nth(1).innerText();
  const proPricing = await planCards.nth(2).innerText();
  assert(freePricing.includes("QR, Quick QR, and Setuvara Tap"), "Free includes standard sharing");
  assert(freePricing.includes("Connections, private memories, and Passport"), "Free includes the network loop");
  assert(!freePricing.includes("Editorial theme"), "Free does not advertise premium presentation");
  assert(plusPricing.includes("Editorial theme, accent-frame QR, Passport finish, and soundtrack presentation"), "Plus lists the shipped presentation finish");
  assert(plusPricing.includes("Setuvara Plus member badge"));
  assert(!plusPricing.includes("Custom analytics ranges up to 730 days"));
  assert(proPricing.includes("Editorial theme, accent-frame QR, Passport finish, and soundtrack presentation"), "Pro inherits Plus presentation");
  assert(proPricing.includes("Setuvara Pro member badge"));
  assert(!proPricing.includes("Setuvara Plus member badge"), "Pro receives only the Pro badge");
  assert(proPricing.includes("Custom analytics ranges up to 730 days"));
  assert(!proPricing.includes("Wallet"), "prelaunch Wallet benefits are not advertised");
  assert((await planCards.nth(1).innerText()).includes("30- and 90-day analytics history"));
  assert((await planCards.nth(2).innerText()).includes("Download analytics as CSV"));
  await page.getByRole("button", { name: "Yearly", exact: true }).click();
  assert((await planCards.nth(1).innerText()).includes("$69"));
  assert((await planCards.nth(2).innerText()).includes("$129"));
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  assert.equal(await page.getByRole("link", { name: "Create your identity", exact: true }).getAttribute("href"), "/signup?next=/app");

  await page.goto(new URL("/", appUrl).toString());
  for (const id of ["product", "modes", "share", "how", "remember", "connections", "passport", "events", "teams"]) {
    assert.equal(await page.locator(`#${id}`).count(), 1, `Homepage should include the #${id} section`);
  }
  const modeSwitcher = page.getByRole("group", { name: "Aanya’s Modes" });
  await modeSwitcher.getByRole("button", { name: "Business" }).click();
  assert.equal(await modeSwitcher.getByRole("button", { name: "Business" }).getAttribute("aria-pressed"), "true", "Hero Mode switcher should select Business");
  await page.locator("#hero-claim").fill("future_name");
  await page.locator("#hero-claim").press("Enter");
  await page.waitForURL("**/signup?username=future_name");
  assert.equal(await page.getByLabel("Username").inputValue(), "future_name", "Claim form should prefill the signup username");
  await page.goto(new URL("/", appUrl).toString());

  const menuButton = page.getByRole("button", { name: "Open navigation menu" });
  assert((await menuButton.boundingBox())?.height >= 44, "Mobile menu button should be a usable tap target");
  await menuButton.click();
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" });
  await mobileNavigation.getByRole("link", { name: "Events" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open navigation menu" }).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Open navigation menu", "Escape should return focus to the menu button");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Pricing" }).click();
  await page.waitForURL("**/pricing");
  for (const card of await planCards.all()) {
    const action = card.getByRole("link").last();
    assert((await action.boundingBox())?.height >= 44, "Plan signup action should meet a usable tap target");
  }

  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (const path of ["/", "/pricing", "/events", "/teams", "/roadmap"]) {
      await page.goto(new URL(path, appUrl).toString());
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      assert.equal(overflow, false, `${path} should not overflow at ${viewport.width}px`);
      const desktopNav = page.getByRole("navigation", { name: "Main navigation" });
      assert.equal(await desktopNav.isVisible(), viewport.width >= 768, `Navigation layout should match ${viewport.width}px breakpoint`);
    }
  }

  await context.close();
  console.log("PASS marketing routes, metadata, mobile navigation, and responsive overflow at phone/tablet/desktop sizes");
} finally {
  await browser.close();
}
