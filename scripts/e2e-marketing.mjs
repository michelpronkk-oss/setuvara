import assert from "node:assert/strict";
import { chromium } from "playwright";

const appUrl = process.env.E2E_APP_URL ?? "http://localhost:3014";
assert(["localhost", "127.0.0.1"].includes(new URL(appUrl).hostname), "Marketing E2E must use the local Setuvara app");

const browser = await chromium.launch({ headless: true });
const robotsContent = (page) => page.locator('meta[name="robots"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("content") ?? "").join(", "));
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const routes = [
    { path: "/", heading: "One identity. Every version of you.", title: "Setuvara | Your identity for real life" },
    { path: "/pricing", heading: "Keep the network open.", title: "Pricing | Setuvara" },
    { path: "/events", heading: "Bring the right context into the room.", title: "Setuvara for Events" },
    { path: "/teams", heading: "A better introduction starts with people.", title: "Setuvara for Teams" },
    { path: "/roadmap", heading: "Built around the moments that matter.", title: "Roadmap | Setuvara" },
  ];

  for (const route of routes) {
    const response = await page.goto(new URL(route.path, appUrl).toString());
    assert.equal(response?.status(), 200, `${route.path} should return 200`);
    assert.equal(await page.locator("html").getAttribute("lang"), "en", `${route.path} should set the document language to English`);
    await page.getByRole("heading", { name: route.heading, exact: true }).waitFor();
    const canonical = new URL(await page.locator('link[rel="canonical"]').getAttribute("href"));
    assert.equal(canonical.origin, "https://setuvara.com", `${route.path} canonical should use the Setuvara domain`);
    assert.equal(canonical.pathname, route.path, `${route.path} canonical path should be correct`);
    assert.equal(await page.locator('meta[property="og:title"]').getAttribute("content"), route.title, `${route.path} should have Open Graph title`);
    const image = await page.locator('meta[property="og:image"]').getAttribute("content");
    assert(image, `${route.path} should have a share image`);
    assert.equal(new URL(image).origin, "https://setuvara.com", `${route.path} social image should use the canonical host`);
    assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute("content"), "summary_large_image", `${route.path} should use a large Twitter/X card`);
    const twitterImage = await page.locator('meta[name="twitter:image"]').getAttribute("content");
    assert(twitterImage, `${route.path} should have a Twitter/X share image`);
    assert.equal(new URL(twitterImage).origin, "https://setuvara.com", `${route.path} Twitter/X image should use the canonical host`);
    for (const [kind, imageUrl] of [["Open Graph", image], ["Twitter/X", twitterImage]]) {
      const imageResponse = await page.request.get(new URL(new URL(imageUrl).pathname, appUrl).toString());
      assert.equal(imageResponse.status(), 200, `${route.path} ${kind} image should be served`);
      assert.match(imageResponse.headers()["content-type"] ?? "", /image\/png/, `${route.path} ${kind} image should be PNG`);
    }
    assert.match(await robotsContent(page), /(^|,\s*)index(\s|,|$)/i, `${route.path} should remain indexable`);
    assert(await page.locator('meta[name="description"]').getAttribute("content"), `${route.path} should have a concise description`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(overflow, false, `${route.path} should not overflow at phone width`);
  }

  for (const [legacyPath, canonicalPath] of [["/nl", "/"], ["/nl/pricing", "/pricing"]]) {
    const legacyLocale = await page.request.get(new URL(`${legacyPath}?source=legacy`, appUrl).toString(), { maxRedirects: 0 });
    assert.equal(legacyLocale.status(), 308, `${legacyPath} should permanently redirect`);
    const destination = new URL(legacyLocale.headers().location, appUrl);
    assert.equal(`${destination.pathname}${destination.search}`, `${canonicalPath}?source=legacy`, `${legacyPath} should preserve its path suffix and query`);
  }

  const englishOnlyContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { "accept-language": "nl-NL,nl;q=0.9,en;q=0.8" },
  });
  const englishOnlyPage = await englishOnlyContext.newPage();
  await englishOnlyContext.addCookies([{ name: "sv-locale", value: "nl", url: appUrl, httpOnly: true, sameSite: "Lax" }]);
  for (const path of ["/", "/pricing", "/roadmap"]) {
    await englishOnlyPage.goto(new URL(path, appUrl).toString());
    assert.equal(await englishOnlyPage.locator("html").getAttribute("lang"), "en", `${path} must ignore Dutch browser and saved cookie preferences`);
    assert.equal(await englishOnlyPage.locator('link[hreflang]').count(), 0, `${path} must not advertise removed locale alternates`);
    assert.doesNotMatch(await englishOnlyPage.locator("body").innerText(), /Eén identiteit|Prijzen|Inloggen|Nederlands/u, `${path} must render English interface copy`);
    if (path === "/") {
      const canonical = new URL(await englishOnlyPage.locator('link[rel="canonical"]').getAttribute("href"));
      assert.equal(canonical.origin, "https://setuvara.com", "browser locale must not change the English home canonical origin");
      assert.equal(canonical.pathname, "/", "browser locale must not change the English home canonical path");
    }
  }
  await englishOnlyContext.close();

  const iconLinks = await page.locator('link[rel="icon"]').evaluateAll((nodes) => nodes.map((node) => ({ href: node.getAttribute("href"), type: node.getAttribute("type") })));
  assert(iconLinks.some((icon) => icon.href?.includes("setuvara-icon.png") && icon.type === "image/png"), "a correctly typed Setuvara PNG app icon should be linked");
  assert(await page.locator('link[rel="apple-touch-icon"]').count(), "Apple touch icon should be linked");
  const conventionalFavicon = await page.request.get(new URL("/favicon.ico", appUrl).toString(), { maxRedirects: 0 });
  assert.equal(conventionalFavicon.status(), 308, "the conventional favicon URL should permanently resolve to the existing Setuvara icon");
  assert.equal(conventionalFavicon.headers().location, "/icons/setuvara-icon.png", "favicon fallback should use the existing public Setuvara mark");
  const appIcon = await page.request.get(new URL("/icons/setuvara-icon.png", appUrl).toString());
  assert.equal(appIcon.status(), 200, "Setuvara app icon should be served");
  assert.match(appIcon.headers()["content-type"] ?? "", /image\/png/, "Setuvara app icon should be a PNG");
  const appleIcon = await page.request.get(new URL("/apple-touch-icon.png", appUrl).toString());
  assert.equal(appleIcon.status(), 200, "Apple touch icon should be served");
  assert.match(appleIcon.headers()["content-type"] ?? "", /image\/png/, "Apple touch icon should be a PNG");

  const robots = await page.request.get(new URL("/robots.txt", appUrl).toString());
  assert.equal(robots.status(), 200, "robots.txt should be served");
  const robotsText = await robots.text();
  for (const path of ["/app/", "/auth/", "/api/", "/internal/"]) assert(robotsText.includes(`Disallow: ${path}`), `robots.txt should disallow ${path}`);
  assert(robotsText.includes("Sitemap: https://setuvara.com/sitemap.xml"), "robots.txt should point to the canonical sitemap");

  const sitemapResponse = await page.request.get(new URL("/sitemap.xml", appUrl).toString());
  assert.equal(sitemapResponse.status(), 200, "sitemap.xml should be served");
  const sitemapText = await sitemapResponse.text();
  for (const path of ["https://setuvara.com/", "https://setuvara.com/pricing", "https://setuvara.com/events", "https://setuvara.com/teams", "https://setuvara.com/roadmap"]) assert(sitemapText.includes(path), `sitemap should include ${path}`);
  assert(!sitemapText.includes("https://setuvara.com/nl"), "sitemap must not include removed Dutch URLs");
  assert(!/https:\/\/setuvara\.com\/(app|auth|api|u)\//i.test(sitemapText), "sitemap should exclude private and legacy routes");
  assert(!/[?&]mode=|utm_/i.test(sitemapText), "sitemap should not include query variants");

  for (const path of ["/login", "/signup"]) {
    const response = await page.goto(new URL(path, appUrl).toString());
    assert.equal(response?.status(), 200, `${path} should remain reachable`);
    assert.match(await robotsContent(page), /noindex/i, `${path} should be noindex`);
    assert.match(await robotsContent(page), /nofollow/i, `${path} should be nofollow`);
  }

  const missingProfilePath = "/seo_missing_1011";
  const missingProfile = await page.goto(new URL(missingProfilePath, appUrl).toString());
  assert.equal(missingProfile?.status(), 404, "nonexistent root username should remain a 404");
  assert.match(await robotsContent(page), /noindex/i, "404 metadata should be noindex");
  const missingProfileOgImages = await page.locator('meta[property="og:image"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("content") ?? ""));
  assert(!missingProfileOgImages.some((image) => image.includes("/og/profile/")), "a missing username must not receive public profile OG metadata");

  const legacyResponse = await page.request.get(new URL("/u/seo_missing_1011?mode=event", appUrl).toString(), { maxRedirects: 0 });
  assert.equal(legacyResponse.status(), 308, "legacy profile URLs should permanently redirect");
  assert.equal(legacyResponse.headers().location, "/seo_missing_1011", "legacy redirect should drop the Mode query and use the root namespace");

  const confirmationRoute = await page.request.get(new URL("/auth/confirm", appUrl).toString(), { maxRedirects: 0 });
  assert.match(confirmationRoute.headers()["x-robots-tag"] ?? "", /noindex/i, "auth confirmation utility route should emit a noindex header");
  const healthRoute = await page.request.get(new URL("/api/health/supabase", appUrl).toString());
  assert.match(healthRoute.headers()["x-robots-tag"] ?? "", /noindex/i, "API responses should emit a noindex header");

  const marketingPaths = new Set(["/", "/pricing", "/events", "/teams", "/roadmap"]);
  const profileUrls = [...sitemapText.matchAll(/<loc>(https:\/\/setuvara\.com\/[^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .filter((url) => {
      const pathname = new URL(url).pathname;
      return pathname.split("/").filter(Boolean).length === 1 && !marketingPaths.has(pathname);
    });
  if (profileUrls.length) {
    const profileUrl = new URL(profileUrls[0]);
    const localizedDuplicate = await page.request.get(new URL(`/nl${profileUrl.pathname}`, appUrl).toString(), { maxRedirects: 0 });
    assert.equal(localizedDuplicate.status(), 308, "legacy locale-prefixed identity URLs should redirect permanently");
    assert.equal(new URL(localizedDuplicate.headers().location, appUrl).pathname, profileUrl.pathname, "legacy locale prefixes should preserve the root username route");
    const publicProfile = await page.goto(new URL(profileUrl.pathname, appUrl).toString());
    assert.equal(publicProfile?.status(), 200, "a sitemap-listed published profile should load publicly");
    const profileCanonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    assert.equal(profileCanonical, `https://setuvara.com${profileUrl.pathname}`, "profile metadata should canonicalize to the root identity URL");
    assert.match(await robotsContent(page), /(^|,\s*)index(\s|,|$)/i, "published profile should be indexable");
    const profileImageUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
    assert(profileImageUrl?.includes(`/og/profile/${profileUrl.pathname.slice(1)}/personal`), "profile preview should use the selected Mode's dynamic Setuvara image");
    const profileImage = await page.request.get(new URL(profileImageUrl).toString());
    assert.equal(profileImage.status(), 200, "published profile OG image should render");
    assert.match(profileImage.headers()["content-type"] ?? "", /image\/png/, "profile OG image should be PNG");
    assert.match(profileImage.headers()["x-robots-tag"] ?? "", /noindex/i, "profile OG image endpoint should remain out of search results");

    const personalVariant = await page.goto(new URL(`${profileUrl.pathname}?mode=personal&utm_source=seo-test`, appUrl).toString());
    assert.equal(personalVariant?.status(), 200, "Personal share URL should remain functional");
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), `https://setuvara.com${profileUrl.pathname}`, "Mode and tracking query metadata should canonicalize to one identity");
    for (const mode of ["event", "business"]) {
      const modeResponse = await page.goto(new URL(`${profileUrl.pathname}?mode=${mode}`, appUrl).toString());
      assert.equal(modeResponse?.status(), 200, `?mode=${mode} must fall back to the default Mode`);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), `https://setuvara.com${profileUrl.pathname}`, `${mode} query should keep the identity canonical`);
      const modeImageUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
      assert(modeImageUrl?.endsWith("/personal"), `?mode=${mode} must never select another Mode's preview`);
      assert.equal(await page.locator(`[data-profile-mode="${mode}"]`).count(), 0, `?mode=${mode} must never render that Mode`);
    }
    const legacyProfile = await page.request.get(new URL(`/u${profileUrl.pathname}?mode=business`, appUrl).toString(), { maxRedirects: 0 });
    assert.equal(legacyProfile.status(), 308, "a real profile's legacy URL should permanently redirect");
    assert.equal(legacyProfile.headers().location, profileUrl.pathname, "legacy redirect must not carry a Mode query");
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
  assert(plusPricing.includes("Premium themes and layouts, QR presentation, Passport finish, and soundtrack presentation"), "Plus lists the shipped presentation finish");
  assert(plusPricing.includes("Setuvara Plus member badge"));
  assert(!plusPricing.includes("Custom analytics ranges up to 730 days"));
  assert(proPricing.includes("Premium themes and layouts, QR presentation, Passport finish, and soundtrack presentation"), "Pro inherits Plus presentation");
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
