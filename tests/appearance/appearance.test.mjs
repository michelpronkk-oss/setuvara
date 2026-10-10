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
        export * from "@/components/profile/photo-focus";
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
const render = (m, plan = "free", sound = "off") => lib.renderToStaticMarkup(lib.createElement(lib.ProfileRenderer, { profile, mode: m, plan, viewerState: "visitor_unconnected", sound }));
const attr = (html, name) => html.match(new RegExp(`${name}="([^"]*)"`))?.[1];

describe("resolveAppearance", () => {
  test("keeps each Mode's own saved values", () => {
    const saved = {
      personal: { theme: "dark", accent: "#546742", layout: "full-bleed", imageTreatment: "full-bleed" },
      event: { theme: "editorial", accent: "#FFFFFF", layout: "conference-card", imageTreatment: "full-bleed" },
      business: { theme: "light", accent: "#FFA600", layout: "editorial-business", imageTreatment: "compact" },
    };
    for (const [slug, appearance] of Object.entries(saved)) {
      assert.deepEqual(lib.resolveAppearance({ slug, appearance }, "plus"), { slug, ...appearance });
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

  test("Plus presentation choices stay saved but fall back safely on Free", () => {
    const saved = { theme: "editorial", accent: "#FF5A4F", layout: "full-bleed", imageTreatment: "portrait", qrStyle: "accent-frame" };
    assert.equal(lib.resolveAppearance({ slug: "personal", appearance: saved }, "free").theme, "dark");
    assert.equal(lib.resolveAppearance({ slug: "personal", appearance: saved }, "plus").theme, "editorial");
    assert.equal(lib.resolveQrStyle({ appearance: saved }, "free"), "standard");
    assert.equal(lib.resolveQrStyle({ appearance: saved }, "plus"), "accent-frame");
    assert.equal(lib.resolveQrStyle({ appearance: saved }, "pro"), "accent-frame");
    assert.equal(lib.isValidAppearance("personal", saved), true, "saved presentation choices remain valid through a downgrade");
  });

  test("the shared renderer shows the Editorial finish only for Plus and Pro", () => {
    const m = mode("personal", { theme: "editorial", layout: "portrait-editorial", imageTreatment: "portrait" });
    assert.equal(lib.profileTone(m, "free").bg, "#0D0D0D");
    assert.equal(lib.profileTone(m, "plus").bg, "#F5F4EF");
    assert.equal(lib.profileTone(m, "pro").bg, "#F5F4EF");
    assert.equal(attr(render(m, "plus"), "data-profile-layout"), "portrait-editorial");
  });

  test("soundtrack remains available to Free while Plus styling is only a presentation finish", () => {
    const soundtrack = { id: "track", kind: "music", data: { url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", title: "Private editor title" }, is_visible: true, is_soundtrack: true, sort_order: 0 };
    const m = mode("personal", { theme: "dark", layout: "portrait-editorial", imageTreatment: "portrait" }, { blocks: [soundtrack] });
    const freeHtml = render(m, "free", "live");
    const plusHtml = render(m, "plus", "live");
    assert.match(freeHtml, /data-soundtrack-player/);
    assert.match(freeHtml, /data-sound-ui/);
    assert.doesNotMatch(freeHtml, /spotify\.com|Private editor title/, "the public HTML keeps soundtrack metadata out of its rendered payload");
    assert.doesNotMatch(freeHtml, /data-premium-sound="true"/);
    assert.match(plusHtml, /data-premium-sound="true"/);
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

describe("Photo focus", () => {
  const frames = [4 / 5, 1, 4 / 3, 16 / 9, 3, 0.5];
  const points = [0, 10, 15, 30, 50, 85, 100];

  test("the focus point is inside every frame, at any aspect", () => {
    for (const aspect of frames) for (const x of points) for (const y of points) {
      const view = lib.visibleWindow({ x, y }, aspect);
      assert.ok(view.x - 1e-9 <= x / 100 && x / 100 <= view.x + view.width + 1e-9, `x ${x} in ${aspect}`);
      assert.ok(view.y - 1e-9 <= y / 100 && y / 100 <= view.y + view.height + 1e-9, `y ${y} in ${aspect}`);
      assert.ok(Math.abs(view.width / view.height * lib.PHOTO_ASPECT - aspect) < 1e-9, "window keeps the frame's shape");
    }
  });

  test("a face near the top stays in a wide band instead of being cut off", () => {
    // The reported photo: a couple shot full length, faces about 15% down a 4:5 crop.
    const view = lib.visibleWindow({ x: 50, y: 15 }, 16 / 9);
    assert.equal(view.y, 0);
    assert.equal(lib.focusPosition({ x: 50, y: 15 }, 16 / 9), "50% 0%");
    // Centred when the photo allows it.
    const middle = lib.visibleWindow({ x: 50, y: 50 }, 4 / 3);
    assert.ok(Math.abs(middle.y + middle.height / 2 - 0.5) < 1e-9);
  });

  test("unknown frames fall back to the focus itself; missing values use the default", () => {
    assert.equal(lib.focusPosition({ x: 40, y: 20 }), "40% 20%");
    assert.deepEqual(lib.readFocus(null, undefined), lib.DEFAULT_FOCUS);
    assert.deepEqual(lib.readFocus(120, -3), lib.DEFAULT_FOCUS);
    assert.deepEqual(lib.modeFocus({ image_focus_x: 30, image_focus_y: 12 }), { x: 30, y: 12 });
  });

  test("every Mode and layout frames its photo on the saved focus", () => {
    const focus = { image_focus_x: 50, image_focus_y: 15 };
    const cases = [
      [mode("personal", { layout: "full-bleed", imageTreatment: "compact" }, focus), 4 / 3],
      [mode("event", { layout: "event-poster", imageTreatment: "full-bleed" }, focus), 4 / 3],
      [mode("event", { layout: "conference-card", imageTreatment: "full-bleed" }, focus), 16 / 9],
      [mode("business", { layout: "structured", imageTreatment: "full-bleed" }, focus), 16 / 9],
      [mode("business", { layout: "editorial-business", imageTreatment: "full-bleed" }, focus), 4 / 3],
    ];
    for (const [item, aspect] of cases) {
      const html = render(item);
      assert.match(html, /data-photo-focus="50 15"/, `${item.slug} ${item.appearance.layout}`);
      assert.ok(html.includes(`object-position:${lib.focusPosition({ x: 50, y: 15 }, aspect)}`), `${item.slug} ${item.appearance.layout} uses its frame`);
    }
  });
});
