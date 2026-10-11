/**
 * Appearance: resolution, entitlements, theme tokens, rendering and QR presentation.
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
        export { resolveSkin } from "@/components/profile/profile-skin";
        export { QrFrame } from "@/components/profile/qr-frame";
        export { QRCodeSVG } from "qrcode.react";
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

const plans = ["free", "plus", "pro"];

describe("resolveAppearance", () => {
  test("Full Portrait is shared, dark, validated and protected by Plus", () => {
    for (const slug of ["personal", "event", "business"]) {
      const appearance = { theme: "light", accent: "#FF5A4F", layout: "full-portrait", imageTreatment: "portrait", portraitZoom: 130, portraitNameSize: "statement", portraitShowUsername: false };
      assert.equal(lib.isValidAppearance(slug, appearance), true);
      for (const plan of ["plus", "pro"]) {
        const look = lib.resolveAppearance({ slug, appearance }, plan);
        assert.equal(look.family, "full-portrait");
        assert.equal(look.theme, "dark");
        assert.equal(look.portraitZoom, 130);
        assert.equal(look.portraitShowUsername, false);
        const html = render(mode(slug, appearance), plan);
        assert.match(html, /data-profile-hero="full-portrait"/);
        assert.doesNotMatch(html, /@aanya/);
        assert.match(html, /data-photo-focus/);
      }
      const free = lib.resolveAppearance({ slug, appearance }, "free");
      assert.notEqual(free.family, "full-portrait");
      assert.equal(free.portraitZoom, 100);
      assert.equal(lib.introducedLockedFields({}, appearance, "free").includes("layout"), true);
      assert.deepEqual(lib.introducedLockedFields(appearance, appearance, "free"), []);
      for (const patch of [{ portraitZoom: 150 }, { portraitZoom: "130" }, { portraitNameSize: "giant" }, { portraitShowUsername: "false" }]) assert.equal(lib.isValidAppearance(slug, { ...appearance, ...patch }), false);
    }
  });

  test("keeps each Mode's own saved values", () => {
    const saved = {
      personal: { theme: "dark", accent: "#546742", layout: "full-bleed", imageTreatment: "full-bleed" },
      event: { theme: "editorial", accent: "#FFFFFF", layout: "conference-card", imageTreatment: "full-bleed" },
      business: { theme: "light", accent: "#FFA600", layout: "editorial-business", imageTreatment: "compact" },
    };
    for (const [slug, appearance] of Object.entries(saved)) {
      const look = lib.resolveAppearance({ slug, appearance }, "plus");
      for (const [key, value] of Object.entries(appearance)) assert.equal(look[key], value, `${slug}.${key}`);
      assert.equal(look.slug, slug);
    }
  });

  test("never falls back to Personal for Event or Business", () => {
    assert.equal(lib.resolveAppearance({ slug: "event", appearance: { layout: "full-bleed" } }).layout, "event-poster");
    assert.equal(lib.resolveAppearance({ slug: "business", appearance: { layout: "full-bleed" } }).layout, "structured");
    assert.equal(lib.resolveAppearance({ slug: "event", appearance: {} }).theme, "light");
    assert.equal(lib.resolveAppearance({ slug: "business", appearance: {} }).theme, "light");
    assert.equal(lib.resolveAppearance({ slug: "personal", appearance: {} }).theme, "dark");
    assert.throws(() => lib.resolveAppearance({ slug: "unknown", appearance: {} }));
  });

  test("Cover and Framed map onto each Mode's own stored layouts; Portrait, Poster and Index are shared", () => {
    for (const slug of ["personal", "event", "business"]) {
      for (const family of lib.LAYOUT_FAMILIES) {
        const layout = lib.layoutForFamily(slug, family);
        assert.equal(lib.layoutFamily(slug, layout), family);
        assert.equal(lib.isModeLayout(slug, layout), true);
      }
    }
    assert.equal(lib.layoutForFamily("event", "cover"), "event-poster");
    assert.equal(lib.layoutForFamily("business", "framed"), "structured");
  });

  test("validates appearance like the database constraint: curated ids only, never CSS", () => {
    const look = { theme: "light", accent: "#FF5A4F", imageTreatment: "full-bleed" };
    assert.equal(lib.isValidAppearance("personal", { ...look, layout: "full-bleed" }), true);
    assert.equal(lib.isValidAppearance("event", { ...look, layout: "full-bleed" }), false);
    assert.equal(lib.isValidAppearance("business", { ...look, layout: "event-poster" }), false);
    assert.equal(lib.isValidAppearance("event", { ...look, layout: "conference-card" }), true);
    for (const layout of ["portrait", "poster", "index"]) assert.equal(lib.isValidAppearance("business", { ...look, layout }), true);
    const full = { ...look, layout: "poster", theme: "noir", imageTreatment: "frame", qrStyle: "inverse", intensity: "signal", card: "layered", radius: "subtle", button: "editorial", links: "cards", soundStyle: "disc" };
    assert.equal(lib.isValidAppearance("event", full), true);
    for (const [key, value] of [["theme", "neon"], ["card", "glass"], ["radius", "8px"], ["button", "background:red"], ["links", "grid"], ["soundStyle", "vinyl"], ["qrStyle", "gradient"], ["intensity", "loud"], ["accent", "red"], ["accent", "#FF5A4F; color:red"]]) {
      assert.equal(lib.isValidAppearance("event", { ...full, [key]: value }), false, `${key}=${value}`);
    }
    assert.equal(lib.isValidAppearance("event", { ...full, css: "body{}" }), false, "unknown keys are refused");
  });

  test("entitlements: Free gets Light and Dark with Cover and Framed; Plus and Pro get every look", () => {
    for (const theme of lib.THEMES) {
      for (const plan of plans) {
        const look = lib.resolveAppearance({ slug: "personal", appearance: { theme, accent: "#FF5A4F", layout: "portrait-editorial", imageTreatment: "portrait" } }, plan);
        const expected = plan === "free" && !["light", "dark"].includes(theme) ? { editorial: "light", noir: "dark", signal: "light", studio: "light" }[theme] : theme;
        assert.equal(look.theme, expected, `${theme} on ${plan}`);
      }
    }
    for (const layout of ["portrait", "poster", "index"]) {
      assert.equal(lib.resolveAppearance({ slug: "event", appearance: { theme: "light", accent: "#FF5A4F", layout, imageTreatment: "portrait" } }, "free").family, layout === "index" ? "framed" : "cover");
      assert.equal(lib.resolveAppearance({ slug: "event", appearance: { theme: "light", accent: "#FF5A4F", layout, imageTreatment: "portrait" } }, "plus").family, layout);
      assert.equal(lib.resolveAppearance({ slug: "event", appearance: { theme: "light", accent: "#FF5A4F", layout, imageTreatment: "portrait" } }, "pro").family, layout);
    }
    const premium = { theme: "noir", accent: "#6B4EFF", layout: "full-bleed", imageTreatment: "frame", intensity: "quiet", card: "layered", radius: "sharp", button: "minimal", links: "chips", soundStyle: "strip", qrStyle: "label" };
    const free = lib.resolveAppearance({ slug: "personal", appearance: premium }, "free");
    assert.deepEqual([free.theme, free.imageTreatment, free.intensity, free.card, free.radius, free.button, free.links, free.soundStyle, free.qrStyle], ["dark", "portrait", "balanced", "soft", "soft", "pill", "icons", "core", "standard"]);
    assert.equal(free.accent, "#6B4EFF", "custom accent stays Free");
    for (const plan of ["plus", "pro"]) {
      const paid = lib.resolveAppearance({ slug: "personal", appearance: premium }, plan);
      assert.deepEqual([paid.theme, paid.imageTreatment, paid.intensity, paid.card, paid.radius, paid.button, paid.links, paid.soundStyle, paid.qrStyle], ["noir", "frame", "quiet", "layered", "sharp", "minimal", "chips", "strip", "label"]);
    }
  });

  test("downgrade locks capability but never deletes configuration; re-upgrade restores", () => {
    const saved = { theme: "editorial", accent: "#FF5A4F", layout: "full-bleed", imageTreatment: "portrait", qrStyle: "accent-frame", card: "outline" };
    assert.equal(lib.resolveAppearance({ slug: "personal", appearance: saved }, "free").theme, "light");
    assert.equal(lib.resolveAppearance({ slug: "personal", appearance: saved }, "plus").theme, "editorial");
    assert.equal(lib.resolveQrStyle({ appearance: saved }, "free"), "standard");
    assert.equal(lib.resolveQrStyle({ appearance: saved }, "plus"), "accent-frame");
    assert.equal(lib.resolveQrStyle({ appearance: saved }, "pro"), "accent-frame");
    assert.equal(lib.isValidAppearance("personal", saved), true, "saved presentation choices remain valid through a downgrade");
    assert.deepEqual(lib.lockedFields(saved, "free"), ["theme", "card", "qrStyle"]);
    assert.deepEqual(lib.lockedFields(saved, "plus"), []);
  });

  test("introducedLockedFields mirrors the database trigger", () => {
    const saved = { theme: "noir", accent: "#FF5A4F", layout: "full-bleed", imageTreatment: "frame" };
    assert.deepEqual(lib.introducedLockedFields(saved, { ...saved, accent: "#C7FF4A" }, "free"), [], "editing around a saved premium look is allowed");
    assert.deepEqual(lib.introducedLockedFields(saved, { ...saved, theme: "studio" }, "free"), ["theme"]);
    assert.deepEqual(lib.introducedLockedFields({ ...saved, theme: "dark" }, { ...saved, theme: "dark", intensity: "signal", soundStyle: "disc" }, "free"), ["intensity", "soundStyle"]);
    assert.deepEqual(lib.introducedLockedFields(saved, { ...saved, theme: "studio", qrStyle: "rounded" }, "plus"), []);
    assert.deepEqual(lib.introducedLockedFields(saved, { ...saved, intensity: "balanced", soundStyle: "core", qrStyle: "standard" }, "free"), [], "Free defaults are never premium");
  });

  test("theme × layout compatibility and Editorial's sharp corners", () => {
    const studioCover = lib.resolveAppearance({ slug: "personal", appearance: { theme: "studio", accent: "#AFCBFF", layout: "full-bleed", imageTreatment: "portrait" } }, "plus");
    assert.equal(studioCover.family, "index", "a hidden pairing renders the theme's default layout");
    const signalPortrait = lib.resolveAppearance({ slug: "personal", appearance: { theme: "signal", accent: "#FF5A4F", layout: "portrait", imageTreatment: "frame" } }, "plus");
    assert.equal(signalPortrait.family, "framed");
    const editorial = lib.resolveAppearance({ slug: "personal", appearance: { theme: "editorial", accent: "#FF5A4F", layout: "portrait-editorial", imageTreatment: "portrait", radius: "soft" } }, "plus");
    assert.equal(editorial.radius, "sharp");
    assert.deepEqual([editorial.card, editorial.button, editorial.links], ["editorial", "editorial", "list"]);
  });

  test("editor layout choices are exactly each Mode's renderable layouts", () => {
    for (const slug of ["personal", "event", "business"]) {
      assert.deepEqual(lib.LAYOUTS[slug].map((layout) => layout.value), [...lib.MODE_LAYOUTS[slug]]);
    }
  });
});

describe("Skin (theme tokens)", () => {
  const skin = (appearance, plan = "plus", slug = "personal") => lib.resolveSkin(lib.resolveAppearance({ slug, appearance: { accent: "#FF5A4F", layout: "full-bleed", imageTreatment: "full-bleed", ...appearance } }, plan));

  test("ink on accent above luminance .42, paper below", () => {
    assert.equal(lib.inkOnAccent("#C7FF4A"), "#0D0D0D");
    assert.equal(lib.inkOnAccent("#FF5A4F"), "#0D0D0D");
    assert.equal(lib.inkOnAccent("#6B4EFF"), "#F5F4EF");
  });

  test("Signal tints the room 12% / 26% and becomes the accent at Signal", () => {
    assert.equal(skin({ theme: "signal", intensity: "quiet" }).page, lib.mixHex("#F5F4EF", "#FF5A4F", 0.12));
    assert.equal(skin({ theme: "signal" }).page, lib.mixHex("#F5F4EF", "#FF5A4F", 0.26));
    assert.equal(skin({ theme: "signal", intensity: "signal" }).page, "#FF5A4F");
  });

  test("Quiet inverts Connect to ink; low-contrast custom accents keep their fill and gain an edge", () => {
    const quiet = skin({ theme: "light", intensity: "quiet" });
    assert.equal(quiet.connect.background, "#0D0D0D");
    const pale = skin({ theme: "light", accent: "#F2EDA8" });
    assert.equal(pale.connect.background, "#F2EDA8");
    assert.match(pale.connect.edge, /inset 0 0 0 1\.5px #0D0D0D/);
    const nearDark = skin({ theme: "dark", accent: "#1C1C24" });
    assert.match(nearDark.connect.edge, /inset 0 0 0 1\.5px #F5F4EF/);
    assert.equal(skin({ theme: "light" }).connect.edge, "none");
  });

  test("Noir uses champagne detail; Editorial is square; Free never draws a premium token", () => {
    const noir = skin({ theme: "noir", imageTreatment: "frame" });
    assert.match(noir.image.frame, /#D6B25E/);
    assert.equal(noir.displayWeight, 700);
    assert.equal(skin({ theme: "editorial" }).radius, 0);
    const downgraded = skin({ theme: "noir", imageTreatment: "frame", button: "editorial" }, "free");
    assert.equal(downgraded.theme, "dark");
    assert.equal(downgraded.image.frame, "none");
    assert.equal(downgraded.button.arrow, false);
  });
});

describe("ProfileRenderer", () => {
  test("every layout family renders its own hero in every Mode", () => {
    for (const slug of ["personal", "event", "business"]) {
      for (const family of lib.LAYOUT_FAMILIES) {
        const html = render(mode(slug, { theme: "dark", layout: lib.layoutForFamily(slug, family), imageTreatment: "portrait" }), "plus");
        assert.equal(attr(html, "data-profile-mode"), slug);
        assert.equal(attr(html, "data-profile-family"), family);
        assert.match(html, new RegExp(`data-profile-hero="${family}"`));
        if (family === "full-portrait") assert.doesNotMatch(html, /data-profile-hero-wide/, "Full Portrait stays a centered portrait on desktop");
        else assert.match(html, new RegExp(`data-profile-hero-wide="${family}"`), "wide two-column hero is part of the same render");
      }
    }
  });

  test("Free renders premium layouts as Cover or Framed and premium themes as Light or Dark", () => {
    const html = render(mode("event", { theme: "studio", layout: "poster", imageTreatment: "frame" }), "free");
    assert.equal(attr(html, "data-profile-theme"), "light");
    assert.equal(attr(html, "data-profile-family"), "cover");
    assert.equal(attr(html, "data-image-treatment"), "portrait");
    assert.doesNotMatch(html, /#D6B25E/);
  });

  test("themes change the page, never the content order", () => {
    const order = (html) => ["data-profile-actions", "data-profile-about", "data-profile-links"].map((marker) => html.indexOf(marker));
    for (const theme of lib.THEMES) {
      const html = render(mode("personal", { theme, layout: "portrait-editorial", imageTreatment: "portrait" }), "plus");
      const positions = order(html);
      assert.ok(positions.every((position) => position > 0), theme);
      assert.deepEqual([...positions].sort((a, b) => a - b), positions, `${theme} keeps Hero → actions → About → links`);
      assert.equal(attr(html, "data-profile-theme"), theme);
    }
  });

  test("Event shows the event card; Save contact and Book a call follow the Mode", () => {
    const event = render(mode("event", { layout: "conference-card", imageTreatment: "portrait" }));
    assert.match(event, /data-event-card/);
    assert.match(event, />Slush</);
    assert.match(event, /HELSINKI · NOV 2026|Helsinki · Nov 2026/);
    assert.match(event, /href="\/aanya\/contact\?mode=event"/);
    assert.doesNotMatch(render(mode("event", { layout: "poster", imageTreatment: "portrait" }), "plus"), /data-event-card/, "Poster carries the event in its headline");
    const booking = { id: "cal", title: "Intro call", url: "https://calendly.com/aanya", link_type: "calendly", is_visible: true, sort_order: 2 };
    const business = render(mode("business", { layout: "structured", imageTreatment: "portrait" }, { links: [...links, booking] }));
    assert.match(business, /data-profile-action="book"/);
    assert.match(business, /Book a call/);
    assert.match(render(mode("personal", { layout: "full-bleed", imageTreatment: "portrait" })), /href="\/aanya\/contact\?mode=personal"/);
  });

  test("member badges: Plus coral, Pro champagne, none on Free", () => {
    const m = mode("personal", { theme: "dark", layout: "full-bleed", imageTreatment: "full-bleed" });
    const html = (memberTier) => lib.renderToStaticMarkup(lib.createElement(lib.ProfileRenderer, { profile, mode: m, plan: memberTier ?? "free", memberTier, viewerState: "visitor_unconnected", sound: "off" }));
    assert.match(html("plus"), /data-member-badge="plus"/);
    assert.match(html("plus"), /#FF5A4F/);
    assert.match(html("pro"), /data-member-badge="pro"/);
    assert.match(html("pro"), /#D6B25E/);
    assert.doesNotMatch(html(null), /data-member-badge/);
  });

  test("link styles and the 8+ collapse", () => {
    const many = Array.from({ length: 9 }, (_, index) => ({ id: `l${index}`, title: `Link ${index}`, url: `https://example.com/${index}`, link_type: "website", is_visible: true, sort_order: index }));
    for (const style of lib.LINK_STYLES) {
      const html = render(mode("personal", { layout: "full-bleed", imageTreatment: "portrait", links: style }, { links: many }), "plus");
      assert.match(html, new RegExp(`data-links-style="${style}"`));
      if (style === "chips" || style === "cards") assert.match(html, /All links · 9/);
      else assert.doesNotMatch(html, /All links/);
    }
  });

  test("soundtrack: Free and Plus both play; presentation styles are Plus; metadata stays out of the public HTML", () => {
    const soundtrack = { id: "track", kind: "music", data: { url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", title: "Private editor title" }, is_visible: true, is_soundtrack: true, sort_order: 0 };
    const m = mode("personal", { theme: "dark", layout: "portrait-editorial", imageTreatment: "portrait", soundStyle: "strip" }, { blocks: [soundtrack] });
    const freeHtml = render(m, "free", "live");
    const plusHtml = render(m, "plus", "live");
    assert.match(freeHtml, /data-soundtrack-player/);
    assert.match(freeHtml, /data-sound-ui/);
    assert.doesNotMatch(freeHtml, /spotify\.com|Private editor title/, "the public HTML keeps soundtrack metadata out of its rendered payload");
    assert.doesNotMatch(plusHtml, /spotify\.com|Private editor title/);
    assert.doesNotMatch(freeHtml, /data-premium-sound="true"/);
    assert.match(plusHtml, /data-premium-sound="true"/);
  });

  test("earned mark and treatment render on every theme and plan", () => {
    for (const plan of plans) for (const theme of ["light", "noir"]) {
      const html = lib.renderToStaticMarkup(lib.createElement(lib.ProfileRenderer, { profile, mode: mode("personal", { theme, layout: "full-bleed", imageTreatment: "portrait" }), plan, viewerState: "visitor_unconnected", sound: "off", selectedRewards: { profile_mark: "signal_50_mark", profile_treatment: "editorial_profile" } }));
      assert.match(html, /data-profile-mark/);
      assert.match(html, /Signal 50/);
      assert.match(html, /data-earned-treatment/);
    }
  });

  test("viewer states: owner shares, visitor connects, connected shows the connection", () => {
    const m = mode("personal", { layout: "full-bleed", imageTreatment: "portrait" });
    const as = (viewerState, extra = {}) => lib.renderToStaticMarkup(lib.createElement(lib.ProfileRenderer, { profile, mode: m, viewerState, sound: "off", ...extra }));
    assert.match(as("owner"), /data-profile-action="share"/);
    assert.match(as("owner"), /data-profile-action="qr"/);
    assert.match(as("visitor_unconnected", { visitorAction: lib.createElement("button", { "data-test-connect": "" }, "Connect") }), /data-test-connect/);
    const connected = as("visitor_connected", { connectionHref: "/app/connections/1", connectionContext: { event: "Rooftop", dateLabel: "10 Oct 2026" } });
    assert.match(connected, /data-profile-action="connected"/);
    assert.match(connected, /Connected · Rooftop · 10 Oct 2026/);
  });

  test("attribution and footer slots", () => {
    const html = lib.renderToStaticMarkup(lib.createElement(lib.ProfileRenderer, { profile, mode: mode("personal", {}), viewerState: "visitor_unconnected", sound: "off", attribution: true, footer: lib.createElement("aside", { "data-footer": "" }) }));
    assert.match(html, /Made with Setuvara/);
    assert.match(html, /data-footer/);
  });

  test("Dutch chrome comes from the i18n system", () => {
    const html = lib.renderToStaticMarkup(lib.createElement(lib.ProfileRenderer, { profile, mode: mode("event", { layout: "conference-card", imageTreatment: "portrait" }), viewerState: "visitor_unconnected", sound: "off", locale: "nl", attribution: true }));
    assert.match(html, /Contact opslaan/);
    assert.match(html, /Ik wil ontmoeten/);
  });
});

describe("QR presentation", () => {
  test("every style surrounds the same code: modules, value and quiet zone never change", () => {
    const value = "https://setuvara.com/aanya?source=qr";
    const code = () => lib.createElement(lib.QRCodeSVG, { value, size: 128, level: "H", marginSize: 4, fgColor: "#0D0D0D", bgColor: "#FFFFFF" });
    const paths = lib.QR_STYLES.map((style) => {
      const html = lib.renderToStaticMarkup(lib.createElement(lib.QrFrame, { style, accent: "#6B4EFF", name: "Aanya Rao", modeLabel: "Event" }, code()));
      assert.match(html, new RegExp(`data-qr-treatment="${style}"`));
      return html.match(/<path fill="#0D0D0D" d="([^"]+)"/)?.[1];
    });
    assert.ok(paths[0]);
    assert.ok(paths.every((path) => path === paths[0]), "identical module path in every frame");
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
    // Tiles have fixed frames (exact first paint); heroes measure themselves in the browser.
    const cases = [
      [mode("personal", { layout: "portrait-editorial", imageTreatment: "portrait" }, focus), 116 / 146],
      [mode("event", { layout: "conference-card", imageTreatment: "compact" }, focus), 1],
      [mode("business", { layout: "poster", imageTreatment: "portrait" }, focus), 1],
      [mode("business", { layout: "editorial-business", imageTreatment: "full-bleed" }, focus), undefined],
    ];
    for (const [item, aspect] of cases) {
      const html = render(item, "plus");
      assert.match(html, /data-photo-focus="50 15"/, `${item.slug} ${item.appearance.layout}`);
      assert.ok(html.includes(`object-position:${lib.focusPosition({ x: 50, y: 15 }, aspect)}`), `${item.slug} ${item.appearance.layout} uses its frame`);
    }
  });
});
