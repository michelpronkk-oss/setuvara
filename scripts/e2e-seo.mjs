// Checks what search engines and link previews read from every public route: status, title,
// description, robots, canonical, Open Graph, structured data, one h1, robots.txt and the sitemap.
//
//   node scripts/e2e-seo.mjs                       (against http://localhost:3014)
//   SEO_PROFILE=aanya SEO_SHARE_TOKEN=Ab12Cd34 node scripts/e2e-seo.mjs
//
// SEO_PROFILE is a published username; SEO_SHARE_TOKEN an Event or Business /s/ token.
import assert from "node:assert/strict";

const appUrl = process.env.E2E_APP_URL ?? "http://localhost:3014";
const ORIGIN = "https://setuvara.com";

const indexable = [
  { path: "/", title: "Setuvara | Your identity for real life", jsonLd: ["Organization", "WebSite"] },
  { path: "/modes", title: "Modes: Personal, Event, Business and Creator | Setuvara" },
  { path: "/teams", title: "Setuvara for Teams" },
  { path: "/pricing", title: "Pricing | Setuvara", jsonLd: ["WebApplication"] },
  { path: "/roadmap", title: "Roadmap | Setuvara" },
  { path: "/contact", title: "Contact | Setuvara" },
  { path: "/privacy", title: "Privacy | Setuvara" },
  { path: "/terms", title: "Terms | Setuvara" },
  { path: "/cookies", title: "Cookies | Setuvara" },
  { path: "/refunds", title: "Refunds | Setuvara" },
  { path: "/data-deletion", title: "Data deletion | Setuvara" },
];

const noindex = [
  { path: "/login", title: "Log in | Setuvara" },
  { path: "/signup", title: "Claim your name | Setuvara", ogImage: true },
  { path: "/q/unavailable" },
  { path: "/t/unavailable" },
];

async function load(path) {
  const response = await fetch(new URL(path, appUrl), { redirect: "manual" });
  return { response, html: response.status >= 300 && response.status < 400 ? "" : await response.text() };
}

const decode = (value) => value?.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, "\"");
const head = (html) => html.slice(0, html.indexOf("</head>"));
const meta = (html, key) => decode([...head(html).matchAll(/<meta ([^>]+)>/g)].map((match) => match[1]).find((attrs) => attrs.includes(`name="${key}"`) || attrs.includes(`property="${key}"`))?.match(/content="([^"]*)"/)?.[1]);
const title = (html) => decode(head(html).match(/<title>([^<]*)<\/title>/)?.[1]);
const canonical = (html) => head(html).match(/<link rel="canonical" href="([^"]+)"/)?.[1];
const h1s = (html) => (html.match(/<h1[\s>]/g) ?? []).length;
const jsonLdTypes = (html) => [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)]
  .flatMap((match) => [JSON.parse(match[1])].flat().map((item) => item["@type"]));

let failures = 0;
async function check(name, run) {
  try {
    await run();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}\n     ${error.message}`);
  }
}

for (const route of indexable) {
  await check(`${route.path} is indexable with complete metadata`, async () => {
    const { response, html } = await load(route.path);
    assert.equal(response.status, 200);
    assert.equal(title(html), route.title);
    const description = meta(html, "description");
    assert(description && description.length >= 50 && description.length <= 170, `description length ${description?.length}`);
    assert.equal(meta(html, "robots")?.startsWith("index, follow"), true, `robots ${meta(html, "robots")}`);
    assert.equal(canonical(html), route.path === "/" ? ORIGIN : `${ORIGIN}${route.path}`);
    assert.equal(meta(html, "og:url"), canonical(html));
    assert.equal(meta(html, "og:title"), route.title);
    assert.equal(meta(html, "og:description"), description);
    assert.match(meta(html, "og:image") ?? "", /^https:\/\/setuvara\.com\//);
    assert.equal(meta(html, "twitter:card"), "summary_large_image");
    assert.equal(h1s(html), 1, "exactly one h1");
    assert.match(html, /<html lang="en"/);
    for (const type of route.jsonLd ?? []) assert(jsonLdTypes(html).includes(type), `JSON-LD ${type}`);
  });
}

await check("titles and descriptions are unique across indexable pages", async () => {
  const pages = await Promise.all(indexable.map((route) => load(route.path)));
  const titles = pages.map(({ html }) => title(html));
  const descriptions = pages.map(({ html }) => meta(html, "description"));
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(new Set(descriptions).size, descriptions.length);
});

await check("/pricing offers match the billing catalog", async () => {
  const { html } = await load("/pricing");
  const app = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map((match) => JSON.parse(match[1])).find((item) => item["@type"] === "WebApplication");
  const prices = Object.fromEntries(app.offers.map((offer) => [offer.name, offer.price]));
  assert.deepEqual(prices, {
    "Setuvara Free": "0",
    "Setuvara Plus (monthly)": "6.99",
    "Setuvara Plus (yearly)": "69.00",
    "Setuvara Pro (monthly)": "12.99",
    "Setuvara Pro (yearly)": "129.00",
  });
});

for (const route of noindex) {
  await check(`${route.path} stays out of search`, async () => {
    const { response, html } = await load(route.path);
    assert.equal(response.status, 200);
    assert.match(meta(html, "robots") ?? "", /noindex/);
    if (route.title) assert.equal(title(html), route.title);
    if (route.ogImage) assert.match(meta(html, "og:image") ?? "", /^https:\/\/setuvara\.com\//);
  });
}

for (const path of ["/app", "/app/identity", "/internal/analytics"]) {
  await check(`${path} is private (noindex header, no 200 for visitors)`, async () => {
    const { response } = await load(path);
    assert.notEqual(response.status, 200);
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  });
}

await check("unknown usernames and share tokens are real 404s", async () => {
  for (const path of ["/no-such-person-here", "/s/Zz9Zz9Zz"]) {
    const { response, html } = await load(path);
    assert.equal(response.status, 404, path);
    assert.match(html, /noindex/, path);
  }
});

await check("/u/<username> permanently redirects to the canonical URL", async () => {
  const { response } = await load("/u/someone");
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "/someone");
});

await check("robots.txt allows public pages and blocks private areas", async () => {
  const { response, html } = await load("/robots.txt");
  assert.equal(response.status, 200);
  for (const line of ["Allow: /", "Disallow: /app/", "Disallow: /api/", "Disallow: /auth/", "Disallow: /internal/", `Sitemap: ${ORIGIN}/sitemap.xml`]) assert(html.includes(line), line);
  // Share pages must stay crawlable so search engines can read their noindex.
  assert(!/Disallow: \/s\//.test(html), "do not block /s/");
});

await check("sitemap lists every indexable page and nothing private", async () => {
  const { response, html } = await load("/sitemap.xml");
  assert.equal(response.status, 200);
  const locs = [...html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  for (const route of indexable) assert(locs.includes(route.path === "/" ? `${ORIGIN}/` : `${ORIGIN}${route.path}`), route.path);
  for (const loc of locs) {
    assert(loc.startsWith(`${ORIGIN}/`), loc);
    assert(!/\/(app|s|q|t|connect|connections|login|signup|internal)(\/|$)/.test(new URL(loc).pathname), loc);
  }
});

if (process.env.SEO_PROFILE) {
  const path = `/${process.env.SEO_PROFILE}`;
  await check(`${path} (published Personal) is indexable as a ProfilePage`, async () => {
    const { response, html } = await load(path);
    assert.equal(response.status, 200);
    assert.match(meta(html, "robots") ?? "", /^index, follow/);
    assert.equal(canonical(html), `${ORIGIN}${path}`);
    assert.equal(meta(html, "og:type"), "profile");
    assert.match(meta(html, "og:image") ?? "", new RegExp(`^${ORIGIN}/og/profile/`));
    assert(!/ Mode on Setuvara/.test(meta(html, "og:image:alt") ?? ""), "card alt never names the Mode");
    assert(jsonLdTypes(html).includes("ProfilePage"), "ProfilePage JSON-LD");
  });
  await check(`${path}?source=qr points its canonical at the clean URL`, async () => {
    const { html } = await load(`${path}?source=qr`);
    assert.equal(canonical(html), `${ORIGIN}${path}`);
  });
}

if (process.env.SEO_SHARE_TOKEN) {
  const path = `/s/${process.env.SEO_SHARE_TOKEN}`;
  await check(`${path} (Event/Business share link) is private`, async () => {
    const { response, html } = await load(path);
    assert.equal(response.status, 200);
    assert.match(meta(html, "robots") ?? "", /^noindex, nofollow/);
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
    assert.equal(canonical(html), undefined, "no canonical on a private link");
    assert.equal(jsonLdTypes(html).length, 0, "no structured data on a private link");
    assert.equal(meta(html, "og:url"), `${ORIGIN}${path}`);
  });
  await check(`/og${path} card image is kept out of image search`, async () => {
    const response = await fetch(new URL(`/og${path}`, appUrl), { method: "HEAD" });
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  });
}

if (failures) {
  console.error(`\n${failures} SEO check(s) failed`);
  process.exit(1);
}
console.log("\nAll SEO checks passed");
