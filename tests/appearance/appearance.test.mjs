/**
 * Mode-specific appearance: resolution and rendering.
 *
 *   npm run test:appearance
 *
 * Bundles the real profile renderer with esbuild and renders it to HTML, so it needs no
 * database, browser or dev server.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache"); // gitignored, like other build caches
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-appearance-"));
let lib;

before(async () => {
  await build({
    stdin: {
      contents: `
        export * from "@/components/profile/appearance";
        export { ProfileRenderer, isFullBleed, profileTone } from "@/components/profile/profile-renderer";
        export { LAYOUTS } from "@/app/app/identity/editor-types";
        export { createElement } from "react";
        export { renderToStaticMarkup } from "react-dom/server";
      `,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    alias: { "@": join(root, "src") },
    define: { "process.env.NODE_ENV": '"test"' },
    outfile: join(out, "appearance.cjs"),
    logLevel: "silent",
  });
  lib = createRequire(import.meta.url)(join(out, "appearance.cjs"));
});

after(() => rmSync(out, { recursive: true, force: true }));

const PHOTO = "https://media.example.test/photo.png";
const links = [
  { id: "ig", title: "Instagram", url: "https://instagram.com/aanya", link_type: "instagram", is_visible: true, sort_order: 0 },
  { id: "site", title: "Portfolio", url: "https://example.com", link_type: "website", is_visible: true, sort_order: 1 },
];
const profile = { id: "p", username: "aanya", display_name: "Aanya Rao", bio: "Designer", is_published: true };
const settings = {
  personal: { location: "Lisboa" },
  event: { eventName: "Slush", city: "Helsinki", dateLabel: "Nov 2026", role: "Founder", hereToMeet: "Investors" },
  business: { role: "Founder", company: "Setuvara", city: "Amsterdam", description: "Identity, in person." },
};
const mode = (slug, appearance, extra = {}) => ({ id: slug, slug, label: slug, is_enabled: true, settings: settings[slug], appearance: { theme: "light", accent: "#FF5A4F", ...appearance }, image_path: "x", image_url: PHOTO, links, blocks: [], ...extra });
const render = (m) => lib.renderToStaticMarkup(lib.createElement(lib.ProfileRenderer, { profile, mode: m, viewerState: "visitor_unconnected", sound: "off" }));
const attr = (html, name) => html.match(new RegExp(`${name}="([^"]*)"`))?.[1];

describe("resolveAppearance", () => {
  test("keeps each Mode's own saved values", () => {
    const saved = {
      personal: { theme: "dark", accent: "#546742", layout: "full-bleed", imageTreatment: "full-bleed" },
      event: { theme: "editorial", accent: "#FFFFFF", layout: "conference-card", imageTreatment: "full-bleed" },
      business: { theme: "light", accent: "#FFA600", layout: "editorial-business", imageTreatment: "compact" },
    };
    for (const [slug, appearance] of Object.entries(saved)) {
      assert.deepEqual(lib.resolveAppearance({ slug, appearance }), { slug, ...appearance });
    }
  });

  test("never falls back to Personal for Event or Business", () => {
    // Personal's own layout saved on another Mode is not that Mode's: it resolves to its own default.
    assert.equal(lib.resolveAppearance({ slug: "event", appearance: { layout: "full-bleed" } }).layout, "event-poster");
    assert.equal(lib.resolveAppearance({ slug: "business", appearance: { layout: "full-bleed" } }).layout, "structured");
    assert.equal(lib.resolveAppearance({ slug: "event", appearance: {} }).theme, "light");
    assert.equal(lib.resolveAppearance({ slug: "business", appearance: {} }).theme, "light");
    assert.equal(lib.resolveAppearance({ slug: "personal", appearance: {} }).theme, "dark");
    assert.throws(() => lib.resolveAppearance({ slug: "unknown", appearance: {} }));
  });

  test("validates layouts per Mode, like the database constraint", () => {
    const look = { theme: "light", accent: "#FF5A4F", imageTreatment: "full-bleed" };
    assert.equal(lib.isValidAppearance("personal", { ...look, layout: "full-bleed" }), true);
    assert.equal(lib.isValidAppearance("event", { ...look, layout: "full-bleed" }), false);
    assert.equal(lib.isValidAppearance("business", { ...look, layout: "event-poster" }), false);
    assert.equal(lib.isValidAppearance("event", { ...look, layout: "conference-card" }), true);
  });

  test("editor layout choices are exactly each Mode's renderable layouts", () => {
    for (const slug of ["personal", "event", "business"]) {
      assert.deepEqual(lib.LAYOUTS[slug].map((layout) => layout.value), [...lib.MODE_LAYOUTS[slug]]);
    }
  });
});

describe("ProfileRenderer", () => {
  test("Personal Full Bleed keeps the edge-to-edge Personal design", () => {
    const m = mode("personal", { theme: "dark", layout: "full-bleed", imageTreatment: "full-bleed" });
    const html = render(m);
    assert.equal(attr(html, "data-profile-mode"), "personal");
    assert.equal(attr(html, "data-profile-layout"), "full-bleed");
    assert.match(html, /aspect-\[4\/5\]/);
    assert.match(html, />PERSONAL</);
    assert.match(html, /aria-label="Links"/, "round icon row");
    assert.equal(lib.isFullBleed(m), true);
  });

  for (const layout of ["event-poster", "conference-card"]) {
    test(`Event full bleed (${layout}) renders as Event Mode, not Personal`, () => {
      const m = mode("event", { layout, imageTreatment: "full-bleed" });
      const html = render(m);
      assert.equal(attr(html, "data-profile-mode"), "event");
      assert.equal(attr(html, "data-profile-layout"), layout);
      assert.equal(attr(html, "data-image-treatment"), "full-bleed");
      assert.match(html, /Event Mode/);
      assert.match(html, />Slush</);
      assert.match(html, /Here to meet/);
      assert.match(html, /data-profile-photo="full-bleed"/);
      assert.match(html, layout === "event-poster" ? /aspect-\[4\/3\]/ : /aspect-\[16\/9\]/);
      assert.doesNotMatch(html, />PERSONAL</);
      assert.doesNotMatch(html, /aria-label="Links"/);
      assert.equal(lib.isFullBleed(m), false, "the public page keeps Event's card frame");
    });
  }

  for (const layout of ["structured", "editorial-business"]) {
    test(`Business full bleed (${layout}) renders as Business Mode, not Personal`, () => {
      const m = mode("business", { layout, imageTreatment: "full-bleed" });
      const html = render(m);
      assert.equal(attr(html, "data-profile-mode"), "business");
      assert.equal(attr(html, "data-profile-layout"), layout);
      assert.match(html, /data-profile-photo="full-bleed"/);
      assert.match(html, /Save contact/);
      if (layout === "structured") assert.match(html, /<dt[^>]*>Role<\/dt>.*<dt[^>]*>Company<\/dt>.*<dt[^>]*>City<\/dt>/s);
      else assert.match(html, /Founder · Setuvara · Amsterdam/);
      assert.doesNotMatch(html, />PERSONAL</);
      assert.doesNotMatch(html, /aria-label="Links"/);
      assert.equal(lib.isFullBleed(m), false);
    });
  }

  test("Event and Business layouts and treatments each change the render", () => {
    for (const [slug, layouts] of [["event", ["event-poster", "conference-card"]], ["business", ["structured", "editorial-business"]]]) {
      const renders = new Set(layouts.flatMap((layout) => ["full-bleed", "portrait", "compact"].map((imageTreatment) => render(mode(slug, { layout, imageTreatment })))));
      assert.equal(renders.size, 6, `${slug}: every layout × image treatment renders differently`);
    }
  });

  test("Portrait and Compact keep Event and Business thumbnails", () => {
    assert.match(render(mode("event", { layout: "event-poster", imageTreatment: "portrait" })), /width:96px;height:120px/);
    assert.match(render(mode("event", { layout: "event-poster", imageTreatment: "compact" })), /width:72px;height:72px/);
    assert.match(render(mode("business", { layout: "structured", imageTreatment: "portrait" })), /width:104px;height:130px/);
    assert.match(render(mode("business", { layout: "structured", imageTreatment: "compact" })), /width:64px;height:64px/);
  });

  test("each Mode renders its own settings when all three are set independently", () => {
    const modes = {
      personal: mode("personal", { theme: "dark", layout: "full-bleed", imageTreatment: "full-bleed" }),
      event: mode("event", { theme: "editorial", layout: "conference-card", imageTreatment: "compact" }),
      business: mode("business", { theme: "light", layout: "editorial-business", imageTreatment: "portrait" }),
    };
    for (const [slug, m] of Object.entries(modes)) {
      const html = render(m);
      assert.equal(attr(html, "data-profile-mode"), slug);
      assert.equal(attr(html, "data-profile-layout"), m.appearance.layout);
      assert.equal(attr(html, "data-image-treatment"), m.appearance.imageTreatment);
    }
  });
});
