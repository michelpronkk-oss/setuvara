/**
 * Appearance: the ten Appearances, entitlements, legacy mapping, the face-safe solver, rendering
 * and QR presentation.
 *
 *   npm run test:appearance
 *
 * Bundles the real profile renderer with esbuild and renders it to HTML, so it needs no
 * database, browser or dev server.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
        export * from "@/components/profile/appearance-theme";
        export * from "@/components/profile/face-safe";
        export * from "@/components/profile/name-type";
        export * from "@/components/profile/photo-focus";
        export { ProfileRenderer } from "@/components/profile/profile-renderer";
        export { QrFrame } from "@/components/profile/qr-frame";
        export { QRCodeSVG } from "qrcode.react";
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
const profile = { id: "p", username: "aanya", display_name: "Aanya Rao", bio: "Designer in Lisbon. Making quiet things.", is_published: true };
const settings = {
  personal: { location: "Lisboa" },
  event: { eventName: "Slush", city: "Helsinki", dateLabel: "Nov 2026", role: "Founder", hereToMeet: "Investors" },
  business: { role: "Founder", company: "Setuvara", city: "Amsterdam", description: "Identity, in person." },
};
const mode = (slug, appearance, extra = {}) => ({ id: slug, slug, label: slug, is_enabled: true, settings: settings[slug], appearance: { theme: "immersive", accent: "#FF5A4F", ...appearance }, image_path: "x", image_url: PHOTO, links, blocks: [], ...extra });
const renderWith = (m, props = {}) => lib.renderToStaticMarkup(lib.createElement(lib.ProfileRenderer, { profile, mode: m, plan: "free", viewerState: "visitor_unconnected", sound: "off", ...props }));
const render = (m, plan = "free", sound = "off") => renderWith(m, { plan, sound });
const attr = (html, name) => html.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const resolveFor = (appearance, plan = "free", slug = "personal") => lib.resolveAppearance({ slug, appearance: { accent: "#FF5A4F", ...appearance } }, plan);

const plans = ["free", "plus", "pro"];
const TEN = ["immersive", "motion", "aura", "clean", "glow", "scene", "frame", "stack", "social", "film"];

describe("Appearances", () => {
  test("exactly ten, in the approved order, two of them Free", () => {
    assert.deepEqual([...lib.APPEARANCES], TEN);
    assert.deepEqual([...lib.FREE_APPEARANCES], ["immersive", "clean"]);
    for (const id of TEN) assert.ok(lib.APPEARANCE_NAMES[id] && lib.APPEARANCE_LINES[id], id);
  });

  test("the editor picker renders exactly the ten Appearances", () => {
    const source = readFileSync(join(root, "src/app/app/identity/editor-appearance.tsx"), "utf8");
    assert.match(source, /data-appearance-picker/);
    assert.match(source, /APPEARANCES\.map\(/, "the picker iterates the canonical list");
    assert.doesNotMatch(source, /THEMES|LAYOUT_FAMILIES/, "no retired theme or layout pickers");
  });

  test("entitlements: Free gets Immersive and Clean; Plus and Pro get all ten", () => {
    for (const id of TEN) {
      const free = resolveFor({ theme: id }, "free");
      assert.equal(free.stored, id);
      assert.equal(free.id, lib.isFreeAppearance(id) ? id : (["aura", "clean"].includes(id) ? "clean" : "immersive"), `${id} on Free`);
      assert.equal(resolveFor({ theme: id }, "plus").id, id);
      assert.equal(resolveFor({ theme: id }, "pro").id, id);
    }
  });

  test("controls: zoom, show username and social style are Free; the rest is Plus", () => {
    const free = resolveFor({ theme: "immersive", portraitZoom: 140, portraitShowUsername: true, socialStyle: "hidden", portraitNameSize: "statement", namePosition: "top", readability: "deep", motion: "full", soundtrackPresentation: "featured" });
    assert.equal(free.zoom, 140);
    assert.equal(free.showUsername, true);
    assert.equal(free.socialStyle, "hidden");
    assert.equal(free.nameSize, "standard");
    assert.equal(free.namePosition, "auto");
    assert.equal(free.readability, "auto");
    assert.equal(free.motion, "subtle");
    assert.equal(free.soundPresentation, "minimal", "Featured falls back to Minimal without Plus");
    const plus = resolveFor({ theme: "immersive", portraitZoom: 115, portraitNameSize: "statement", namePosition: "top", readability: "deep", motion: "full", soundtrackPresentation: "featured" }, "plus");
    assert.deepEqual([plus.zoom, plus.nameSize, plus.namePosition, plus.readability, plus.motion, plus.soundPresentation], [115, "statement", "top", "deep", "full", "featured"]);
    assert.equal(resolveFor({ namePosition: "bottom" }).namePosition, "bottom", "Bottom is Free");
    assert.equal(resolveFor({ namePosition: "center" }, "plus").namePosition, "auto", "center reads as Auto");
  });

  test("legacy rows map onto the ten", () => {
    const cases = [
      [{ theme: "dark", layout: "full-bleed" }, "immersive"],
      [{ theme: "dark", layout: "portrait-editorial" }, "immersive"],
      [{ theme: "light", layout: "full-bleed" }, "immersive"],
      [{ theme: "light", layout: "portrait-editorial", imageTreatment: "full-bleed" }, "immersive"],
      [{ theme: "light", layout: "portrait-editorial", imageTreatment: "portrait" }, "clean"],
      [{ theme: "editorial", layout: "portrait-editorial" }, "clean"],
      [{ theme: "studio", layout: "full-bleed" }, "clean"],
      [{ theme: "noir", layout: "full-bleed" }, "glow"],
      [{ theme: "signal", layout: "full-bleed" }, "motion"],
      [{ theme: "light", layout: "full-portrait" }, "immersive"],
    ];
    for (const [appearance, expected] of cases) assert.equal(lib.storedAppearance(appearance, "personal"), expected, JSON.stringify(appearance));
    assert.equal(lib.storedSoundPresentation({ soundStyle: "core" }), "minimal");
    assert.equal(lib.storedSoundPresentation({ soundStyle: "strip" }), "minimal");
    assert.equal(lib.storedSoundPresentation({ soundStyle: "disc" }), "featured");
    assert.equal(lib.storedSoundPresentation({ soundStyle: "poster" }), "featured");
    assert.equal(lib.storedSoundPresentation({}), "ambient");
  });

  test("defaults: Personal and Event Immersive, Business Clean", () => {
    assert.equal(lib.resolveAppearance({ slug: "personal", appearance: null }).id, "immersive");
    assert.equal(lib.resolveAppearance({ slug: "event", appearance: null }).id, "immersive");
    assert.equal(lib.resolveAppearance({ slug: "business", appearance: null }).id, "clean");
  });

  test("downgrade keeps configuration and re-upgrade restores it", () => {
    const saved = { theme: "film", accent: "#6B4EFF", portraitNameSize: "large", motion: "full", soundtrackPresentation: "featured", qrStyle: "label" };
    const down = resolveFor(saved, "free");
    assert.equal(down.id, "immersive");
    assert.deepEqual(down.locked, ["theme", "portraitNameSize", "motion", "soundtrackPresentation", "qrStyle"]);
    assert.equal(saved.theme, "film", "resolving never mutates the saved row");
    const up = resolveFor(saved, "plus");
    assert.equal(up.id, "film");
    assert.equal(up.nameSize, "large");
    assert.deepEqual(up.locked, []);
  });

  test("introducedLockedFields mirrors the database trigger", () => {
    const saved = { theme: "film", accent: "#FF5A4F", motion: "full" };
    assert.deepEqual(lib.introducedLockedFields(saved, { ...saved, accent: "#6B4EFF" }, "free"), [], "a downgraded member can still edit other values");
    assert.deepEqual(lib.introducedLockedFields(saved, { ...saved, theme: "glow" }, "free"), ["theme"]);
    assert.deepEqual(lib.introducedLockedFields({ theme: "immersive" }, { theme: "immersive", namePosition: "top", readability: "soft" }, "free"), ["namePosition", "readability"]);
    assert.deepEqual(lib.introducedLockedFields({ theme: "immersive" }, { theme: "immersive", portraitZoom: 140, socialStyle: "row", portraitShowUsername: true }, "free"), []);
    assert.deepEqual(lib.introducedLockedFields({ theme: "immersive" }, { theme: "glow" }, "plus"), []);
  });

  test("validation matches the database constraint", () => {
    const ok = (appearance, slug = "personal") => lib.isValidAppearance(slug, appearance);
    for (const id of TEN) assert.ok(ok({ theme: id, accent: "#FF5A4F" }), id);
    assert.ok(ok({ theme: "immersive", accent: "#FF5A4F", portraitZoom: 115, namePosition: "bottom", readability: "soft", socialStyle: "compact", motion: "off", soundtrackPresentation: "ambient" }));
    assert.ok(!ok({ theme: "immersive", accent: "#FF5A4F", namePosition: "center" }), "center is never persisted");
    assert.ok(!ok({ theme: "immersive", accent: "#FF5A4F", portraitZoom: 125 }));
    assert.ok(!ok({ theme: "immersive", accent: "#FF5A4F", imageFocus: { x: 1, y: 2 } }), "no imageFocus key");
    assert.ok(!ok({ theme: "neon", accent: "#FF5A4F" }));
    assert.ok(!ok({ theme: "immersive", accent: "red" }));
  });

  test("equip drops retired composition keys; reset touches only the visual config", () => {
    const saved = { theme: "dark", layout: "full-bleed", imageTreatment: "portrait", accent: "#6b4eff", qrStyle: "label", motion: "full", namePosition: "top" };
    const equipped = lib.equipAppearance(saved, "frame");
    assert.equal(equipped.theme, "frame");
    assert.equal(equipped.layout, undefined);
    assert.equal(equipped.imageTreatment, undefined);
    assert.equal(equipped.accent, "#6B4EFF");
    assert.equal(equipped.motion, "full", "personal touches stay");
    assert.deepEqual(lib.resetAppearance("personal", saved), { theme: "immersive", accent: "#6B4EFF", qrStyle: "label" });
    assert.deepEqual(lib.resetAppearance("business", {}), { theme: "clean", accent: "#FF5A4F" });
  });

  test("?appearance= hints are validated and grant nothing", () => {
    assert.equal(lib.appearanceHint("Film"), "film");
    assert.equal(lib.appearanceHint(["glow", "clean"]), "glow");
    assert.equal(lib.appearanceHint("javascript:alert(1)"), null);
    assert.equal(lib.appearanceHint(undefined), null);
    const sql = readFileSync(join(root, "supabase/migrations/20261012050000_viral_identity_appearance.sql"), "utf8");
    assert.match(sql, /'appearance'\s*=\s*'clean'/, "signup only honours the Free Clean hint");
  });
});

describe("Face-safe solver", () => {
  const base = { frame: { width: 390, height: 844 }, zoom: 1, name: "Aanya Rao", nameBase: 64, nameScale: 1, namePosition: "auto", liveContext: false, meta: true, featuredSound: false, socialStyle: "compact", secondary: false };
  const solve = (extra) => lib.solveFaceSafe({ ...base, ...extra });
  const clears = (layout, input) => {
    if (!layout.face) return true;
    return layout.face.chin < input.frame.height && layout.face.chin > 0;
  };

  test("matrix: focus, zoom, frame, name length and position always give a decision", () => {
    const frames = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }];
    const names = ["Li", "Aanya Rao", "Maximiliana Wolkenstein-Oberhausen"];
    for (const frame of frames) for (const y of [12, 25, 35, 50, 70]) for (const zoom of [1, 1.15, 1.4]) for (const name of names) for (const namePosition of ["auto", "top", "bottom"]) {
      const input = { ...base, frame, focus: { x: 50, y }, zoom, name, namePosition };
      const layout = lib.solveFaceSafe(input);
      const label = `${frame.width}×${frame.height} y${y} z${zoom} ${name} ${namePosition}`;
      assert.ok(["bottom", "top", "split"].includes(layout.strategy), label);
      assert.ok(layout.decision.length > 0, label);
      assert.ok(layout.nameSize >= Math.floor(lib.fittedNameSize(name, 64, 1, frame.width) * 0.78) - 1, `${label}: name shrinks only as a last resort`);
      assert.ok(layout.shiftY <= 0 && layout.shiftY >= -190, label);
      if (namePosition === "bottom") assert.equal(layout.strategy, "bottom", `${label}: Bottom never moves the name up`);
      assert.ok(clears(layout, input), label);
    }
  });

  test("a face high in the frame puts the identity below the chin, untouched", () => {
    const layout = solve({ focus: { x: 50, y: 20 } });
    assert.equal(layout.strategy, "bottom");
    assert.equal(layout.shiftY, 0);
    assert.equal(layout.nameSize, lib.fittedNameSize("Aanya Rao", 64, 1, 390));
  });

  test("a low face reframes or moves the name before shrinking it", () => {
    const layout = solve({ focus: { x: 50, y: 72 } });
    assert.ok(layout.strategy !== "bottom" || layout.shiftY < 0, layout.decision);
  });

  test("Top places the name above the brow when there is room", () => {
    const layout = solve({ focus: { x: 50, y: 55 }, namePosition: "top" });
    assert.equal(layout.strategy, "split");
    assert.ok(layout.face.top > 66, "brow stays below the identity block");
  });

  test("a face on the left aligns the identity right", () => {
    assert.equal(solve({ focus: { x: 18, y: 30 } }).align, "right");
    assert.equal(solve({ focus: { x: 50, y: 30 } }).align, "left");
  });

  test("no photo: bottom, nothing shifted", () => {
    const layout = solve({ focus: null });
    assert.equal(layout.strategy, "bottom");
    assert.equal(layout.face, null);
  });

  test("a detected face box replaces the estimate without changing anything else", () => {
    const estimated = solve({ focus: { x: 50, y: 30 } });
    const detected = solve({ focus: { x: 50, y: 30 }, faceBox: { top: 0.05, mouth: 0.15, chin: 0.2, left: 0.4, right: 0.6 } });
    assert.ok(detected.face.chin < estimated.face.chin);
  });
});

describe("Theme helpers", () => {
  test("hero socials: at most five, Mode priority, deduped", () => {
    const make = (providerId, index) => ({ providerId, link: { id: `${providerId}${index}`, sort_order: index } });
    const items = ["website", "instagram", "instagram", "linkedin", "x", "tiktok", "youtube", "github"].map(make);
    const personal = lib.heroSocials("personal", items);
    assert.equal(personal.length, 5);
    assert.equal(new Set(personal.map((item) => item.providerId)).size, 5);
    const business = lib.heroSocials("business", items);
    assert.equal(business[0].providerId, "linkedin");
  });

  test("Film subtitle is the first sentence, never truncated mid-word", () => {
    assert.equal(lib.filmSubtitle("Designer in Lisbon. Making quiet things."), "Designer in Lisbon.");
    assert.equal(lib.filmSubtitle("No full stop here"), "No full stop here");
    assert.equal(lib.filmSubtitle(""), "");
    assert.equal(lib.filmSubtitle(null), "");
  });

  test("content images come only from real image, feature and video blocks", () => {
    const blocks = [
      { id: "a", kind: "image", data: { image_url: "https://x.test/a.jpg" }, is_visible: true, sort_order: 0 },
      { id: "b", kind: "text", data: { text: "hi" }, is_visible: true, sort_order: 1 },
      { id: "c", kind: "image", data: { image_url: "https://x.test/c.jpg" }, is_visible: false, sort_order: 2 },
    ];
    assert.deepEqual(lib.contentImages(blocks).map((item) => item.blockId), ["a"]);
  });

  test("ink on accent above luminance .42, paper below", () => {
    assert.equal(lib.inkOnAccent("#C7FF4A"), "#0D0D0D");
    assert.equal(lib.inkOnAccent("#3D1F8C"), "#F5F4EF");
  });
});

describe("ProfileRenderer", () => {
  test("every Appearance renders its own hero in every Mode with the same content order", () => {
    const order = (html) => ["data-profile-hero-mobile", "data-appearance-content", "data-profile-links"].map((marker) => html.indexOf(marker));
    for (const slug of ["personal", "event", "business"]) for (const id of TEN) {
      const html = render(mode(slug, { theme: id }), "plus");
      assert.equal(attr(html, "data-appearance"), id, `${slug} ${id}`);
      assert.equal(attr(html, "data-profile-mode"), slug);
      assert.match(html, new RegExp(`data-hero="${id}"`));
      assert.match(html, /data-wide-hero/);
      const positions = order(html);
      assert.ok(positions.every((position) => position > 0), `${slug} ${id}`);
      assert.deepEqual([...positions].sort((a, b) => a - b), positions, `${slug} ${id} keeps hero → content → links`);
    }
  });

  test("Free renders Plus Appearances as their Free equivalent", () => {
    assert.equal(attr(render(mode("personal", { theme: "glow" }), "free"), "data-appearance"), "immersive");
    assert.equal(attr(render(mode("personal", { theme: "aura" }), "free"), "data-appearance"), "clean");
    assert.equal(attr(render(mode("personal", { theme: "noir", layout: "full-bleed" }), "free"), "data-appearance"), "immersive");
    assert.equal(attr(render(mode("personal", { theme: "noir", layout: "full-bleed" }), "plus"), "data-appearance"), "glow");
  });

  test("Immersive reports its face-safe strategy", () => {
    const html = render(mode("personal", { theme: "immersive" }, { image_focus_x: 50, image_focus_y: 22 }));
    assert.match(html, /data-face-strategy="(bottom|top|split)"/);
  });

  test("Connect is the only relationship action; booking only when configured; never Save contact", () => {
    const connect = lib.createElement("button", { "data-test-connect": "" }, "Connect");
    for (const id of TEN) {
      const html = renderWith(mode("personal", { theme: id }), { plan: "plus", visitorAction: connect });
      assert.match(html, /data-test-connect/, id);
      assert.match(html, /data-hero-connect/, id);
      assert.match(html, /data-floating-connect/, id);
      assert.doesNotMatch(html, /save-contact|\/contact\?|Save contact|vcard/i, id);
      assert.doesNotMatch(html, /data-profile-action="book"/, `${id} without booking`);
    }
    const booking = { id: "cal", title: "Intro call", url: "https://calendly.com/aanya", link_type: "calendly", is_visible: true, sort_order: 2 };
    const business = renderWith(mode("business", { theme: "clean" }, { links: [...links, booking] }), { visitorAction: connect });
    assert.match(business, /data-profile-action="book"/);
    assert.match(business, /Book a call/);
  });

  test("no visitor action means no fake Connect button", () => {
    const html = render(mode("personal", { theme: "immersive" }));
    assert.doesNotMatch(html, /data-floating-connect/);
    assert.doesNotMatch(html, /disabled[^>]*>Connect</);
  });

  test("Event shows its card", () => {
    const html = renderWith(mode("event", { theme: "clean" }), { visitorAction: lib.createElement("button", null, "Connect") });
    assert.match(html, /data-event-card/);
    assert.match(html, /Slush/);
  });

  test("Live Context shows label and an until time; expired or absent contexts render nothing", () => {
    const expiresAt = new Date(Date.now() + 2 * 3600_000).toISOString();
    const html = renderWith(mode("personal", { theme: "immersive" }), { liveContext: { label: "Rooftop drinks", type: "event", expiresAt } });
    assert.match(html, /data-live-context/);
    assert.match(html, /Live/);
    assert.match(html, /Rooftop drinks/);
    const expired = renderWith(mode("personal", { theme: "immersive" }), { liveContext: { label: "Rooftop drinks", type: "event", expiresAt: new Date(Date.now() - 1000).toISOString() } });
    assert.doesNotMatch(expired, /Rooftop drinks/);
    assert.doesNotMatch(render(mode("personal", { theme: "immersive" })), /data-live-context/);
  });

  test("the setuvara mark ends Free profiles only; never a Plus grant in the link", () => {
    const free = renderWith(mode("personal", { theme: "immersive" }), { attribution: true, plan: "free" });
    assert.equal(attr(free, "data-attribution"), "setuvara");
    assert.match(free, /aria-label="Make yours on Setuvara"/);
    assert.match(free, /\/signup\?appearance=immersive/);
    for (const plan of ["plus", "pro"]) {
      const paid = renderWith(mode("personal", { theme: "film" }), { attribution: true, plan });
      assert.doesNotMatch(paid, /data-attribution/, `${plan} carries no branding`);
      assert.doesNotMatch(paid, /Make yours/);
    }
  });

  test("member badges: Plus coral, Pro champagne, none on Free; no Appearance implies a badge", () => {
    const m = mode("personal", { theme: "glow" });
    const html = (memberTier) => renderWith(m, { plan: memberTier ?? "free", memberTier });
    assert.match(html("plus"), /data-member-badge="plus"/);
    assert.match(html("pro"), /data-member-badge="pro"/);
    assert.doesNotMatch(html(null), /data-member-badge/);
    assert.doesNotMatch(render(m, "plus"), /data-member-badge/);
  });

  test("each social platform shows once: under the name, or in the link rows", () => {
    const rows = (html) => html.slice(html.indexOf("data-profile-links"));
    const hero = (html) => html.slice(0, html.indexOf("data-appearance-content"));
    for (const socialStyle of ["rail", "row", "compact"]) {
      const html = render(mode("personal", { theme: "immersive", socialStyle }));
      assert.match(hero(html), /instagram\.com\/aanya/, `${socialStyle}: under the name`);
      assert.doesNotMatch(rows(html), /instagram\.com\/aanya/, `${socialStyle}: not repeated in the rows`);
      assert.match(rows(html), /example\.com/, "other links stay in the rows");
    }
    const inLinks = render(mode("personal", { theme: "immersive", socialStyle: "hidden" }));
    assert.doesNotMatch(hero(inLinks), /instagram\.com\/aanya/);
    assert.match(rows(inLinks), /instagram\.com\/aanya/);
    const both = render(mode("personal", { theme: "immersive", socialStyle: "rail", socialPlacement: "both" }));
    assert.match(hero(both), /instagram\.com\/aanya/, "Both: under the name");
    assert.match(rows(both), /instagram\.com\/aanya/, "Both: and in the rows, on purpose");
    assert.equal(resolveFor({ theme: "immersive" }).socialPlacement, "name");
    assert.equal(resolveFor({ theme: "immersive", socialStyle: "hidden" }).socialPlacement, "links");
    const resolvedBoth = resolveFor({ theme: "film", socialPlacement: "both" }, "plus");
    assert.deepEqual([resolvedBoth.socialPlacement, resolvedBoth.socialStyle], ["both", "compact"]);
    assert.ok(lib.isValidAppearance("personal", { theme: "clean", accent: "#FF5A4F", socialStyle: "row", socialPlacement: "both" }));
    assert.ok(!lib.isValidAppearance("personal", { theme: "clean", accent: "#FF5A4F", socialPlacement: "everywhere" }));
  });

  test("alignment: Center and Left override the look; Auto keeps its own side", () => {
    for (const id of ["immersive", "clean", "scene", "glow"]) {
      const centered = render(mode("personal", { theme: id, identityAlign: "center" }), "plus");
      assert.equal(attr(centered.slice(centered.indexOf("data-profile-hero-mobile")), "data-identity-align"), "center", `${id} centers`);
    }
    const left = render(mode("personal", { theme: "glow", identityAlign: "left" }), "plus");
    assert.equal(attr(left.slice(left.indexOf("data-profile-hero-mobile")), "data-identity-align"), "left");
    const auto = render(mode("personal", { theme: "glow" }), "plus");
    assert.equal(attr(auto.slice(auto.indexOf("data-profile-hero-mobile")), "data-identity-align"), "center", "Glow is centered by its own design");
    assert.equal(resolveFor({ theme: "immersive" }).align, "auto");
    assert.ok(lib.isValidAppearance("personal", { theme: "immersive", accent: "#FF5A4F", identityAlign: "center" }));
    assert.ok(!lib.isValidAppearance("personal", { theme: "immersive", accent: "#FF5A4F", identityAlign: "right" }));
  });

  test("zoom out: 70 and 85 apply where the photo has a zoom control; others stay at 100 or more", () => {
    assert.equal(resolveFor({ theme: "immersive", portraitZoom: 70 }).zoom, 70);
    assert.equal(resolveFor({ theme: "immersive", portraitZoom: 85 }).zoom, 85);
    assert.equal(resolveFor({ theme: "clean", portraitZoom: 70 }).zoom, 70);
    assert.equal(resolveFor({ theme: "aura", portraitZoom: 85, }, "plus").zoom, 85);
    assert.equal(resolveFor({ theme: "frame", portraitZoom: 70 }, "plus").zoom, 100);
    assert.ok(lib.isValidAppearance("personal", { theme: "immersive", accent: "#FF5A4F", portraitZoom: 70 }));
    assert.ok(!lib.isValidAppearance("personal", { theme: "immersive", accent: "#FF5A4F", portraitZoom: 60 }));
    const frame = { width: 390, height: 640 };
    const base = { frame, focus: { x: 50, y: 30 }, name: "Aanya Rao", nameBase: 64, nameScale: 1, namePosition: "auto", liveContext: false, meta: false, featuredSound: false, socialStyle: "rail", secondary: false };
    // A saved 4:5 photo has nothing beyond itself: zoomed out it is smaller, and the face holds its place.
    const at100 = lib.solveFaceSafe({ ...base, zoom: 1 });
    const out = lib.solveFaceSafe({ ...base, zoom: 0.7 });
    assert.ok(out.imageBottom - out.imageTop < at100.imageBottom - at100.imageTop, "zoomed out shows the photo smaller");
    assert.equal(out.imageTop, 0, "where the photo runs out, it stays on the top edge: no atmosphere above the head");
    const legacy = lib.placePhoto(lib.legacySource(PHOTO, { x: 50, y: 30 }), 390 / 844, 0.7);
    assert.equal(legacy.top, 0);
    assert.ok(legacy.top + legacy.height < 1, "the spare space is below, behind the name");
    const html = render(mode("personal", { theme: "immersive", portraitZoom: 70 }));
    assert.match(html, /data-photo-zoom="70"/);
    assert.doesNotMatch(html, /scale\(0\.7\)/, "never a shrunken copy by transform");
  });

  test("slideshow: Free shows one photo, Plus two, Pro four; speed is saved", () => {
    const slide_urls = [1, 2, 3, 4].map((index) => ({ url: `https://media.example.test/slide${index}.png`, x: 50, y: 40 }));
    const count = (html) => Number(attr(html, "data-slide-count"));
    const withSlides = mode("personal", { theme: "immersive", slideSpeed: "fast" }, { slide_urls });
    const free = render(withSlides, "free");
    assert.doesNotMatch(free, /data-slides/, "Free: no slideshow");
    assert.equal(count(render(withSlides, "plus")), 2);
    assert.equal(count(render(withSlides, "pro")), 4);
    assert.equal(attr(render(withSlides, "pro"), "data-slides"), "fast");
    assert.equal(lib.extraSlideLimit("free"), 0);
    assert.equal(lib.extraSlideLimit("plus"), 1);
    assert.equal(lib.extraSlideLimit("pro"), 3);
    assert.equal(resolveFor({ theme: "clean" }).slideSpeed, "medium");
    assert.ok(lib.isValidAppearance("personal", { theme: "clean", accent: "#FF5A4F", slideSpeed: "slow" }));
    assert.ok(!lib.isValidAppearance("personal", { theme: "clean", accent: "#FF5A4F", slideSpeed: "warp" }));
    for (const id of TEN) assert.match(render(mode("personal", { theme: id }, { slide_urls }), "pro"), /data-slides/, `${id} slides`);
  });

  test("the public page never names the Mode, on every Appearance", () => {
    const soundtrack = { id: "track", kind: "music", data: { url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT" }, is_visible: true, is_soundtrack: true, sort_order: 0 };
    for (const id of TEN) for (const slug of ["personal", "event", "business"]) {
      const html = renderWith(mode(slug, { theme: id, soundtrackPresentation: "featured" }, { blocks: [soundtrack] }), { plan: "plus", sound: "preview" });
      const text = html.replace(/<[^>]+>/g, " ");
      assert.doesNotMatch(text, /\b(Personal|Event|Business)\b/, `${id} · ${slug}: no Mode name`);
      assert.doesNotMatch(html, /data-mode-indicator|(Personal|Event|Business) (Mode|soundtrack)/i, `${id} · ${slug}: nor in labels`);
    }
  });

  test("picture layout: featured by default; stack, grid and carousel on request", () => {
    const pictures = [1, 2, 3].map((index) => ({ id: `img${index}`, kind: "image", data: { image_url: `https://media.example.test/p${index}.png`, alt: `P${index}` }, is_visible: true, sort_order: index }));
    assert.equal(resolveFor({ theme: "immersive" }).mediaLayout, "featured");
    for (const layout of ["featured", "stack", "grid", "carousel"]) {
      const html = render(mode("personal", { theme: "immersive", ...(layout === "featured" ? {} : { mediaLayout: layout }) }, { blocks: pictures }));
      assert.match(html, new RegExp(`data-media-layout="${layout}"`), layout);
      assert.equal((html.match(/<img[^>]*media\.example\.test\/p\d/g) ?? []).length, 3, `${layout}: every picture once`);
    }
    const grid = render(mode("personal", { theme: "clean", mediaLayout: "grid" }, { blocks: pictures }));
    assert.equal((grid.match(/data-featured-media/g) ?? []).length, 1, "grid: an odd first picture leads full width");
    const single = render(mode("personal", { theme: "clean", mediaLayout: "grid" }, { blocks: pictures.slice(0, 1) }));
    assert.match(single, /data-media-layout="single"/);
    assert.ok(lib.isValidAppearance("personal", { theme: "clean", accent: "#FF5A4F", mediaLayout: "carousel" }));
    assert.ok(!lib.isValidAppearance("personal", { theme: "clean", accent: "#FF5A4F", mediaLayout: "masonry" }));
  });

  test("links collapse after eight", () => {
    const many = Array.from({ length: 9 }, (_, index) => ({ id: `l${index}`, title: `Link ${index}`, url: `https://example.com/${index}`, link_type: "website", is_visible: true, sort_order: index }));
    const html = render(mode("personal", { theme: "clean" }, { links: many }));
    assert.match(html, /data-profile-links/);
    assert.match(html, /9/);
  });

  test("soundtrack: Free and Plus both play; Featured is Plus; metadata stays out of the public HTML", () => {
    const soundtrack = { id: "track", kind: "music", data: { url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", title: "Private editor title" }, is_visible: true, is_soundtrack: true, sort_order: 0 };
    const m = mode("personal", { theme: "immersive", soundtrackPresentation: "featured" }, { blocks: [soundtrack] });
    const freeHtml = render(m, "free", "live");
    const plusHtml = render(m, "plus", "live");
    assert.match(freeHtml, /data-soundtrack-player/);
    assert.equal(attr(freeHtml, "data-sound-presentation"), "minimal");
    assert.equal(attr(plusHtml, "data-sound-presentation"), "featured");
    for (const html of [freeHtml, plusHtml]) assert.doesNotMatch(html, /spotify\.com|Private editor title|4cOdK2wGLETKBW3PvgPWqT/);
  });

  test("earned mark and treatment render on every Appearance and plan", () => {
    for (const plan of plans) for (const theme of ["immersive", "clean", "glow"]) {
      const html = renderWith(mode("personal", { theme }), { plan, selectedRewards: { profile_mark: "signal_50_mark", profile_treatment: "editorial_profile" } });
      assert.match(html, /data-profile-mark/, `${plan} ${theme}`);
      assert.match(html, /data-earned-treatment/, `${plan} ${theme}`);
    }
  });

  test("viewer states: owner shares, visitor connects, connected shows the connection", () => {
    const m = mode("personal", {});
    assert.match(renderWith(m, { viewerState: "owner" }), /data-profile-action="share"/);
    assert.match(renderWith(m, { viewerState: "owner" }), /data-profile-action="qr"/);
    const connected = renderWith(m, { viewerState: "visitor_connected", connectionHref: "/app/connections/1", connectionContext: { event: "Rooftop", dateLabel: "10 Oct 2026" } });
    assert.match(connected, /data-profile-action="connected"/);
    assert.match(connected, /Rooftop/);
  });

  test("interface chrome stays English while profile-authored Dutch content stays untouched", () => {
    const authoredBio = "Ik ontwerp producten in Amsterdam.";
    const html = lib.renderToStaticMarkup(lib.createElement(lib.ProfileRenderer, { profile: { ...profile, bio: authoredBio }, mode: mode("event", {}), viewerState: "visitor_unconnected", visitorAction: lib.createElement("button", null, "Connect"), sound: "off", locale: "nl", attribution: true }));
    assert.match(html, />Connect</);
    assert.match(html, new RegExp(authoredBio));
    assert.doesNotMatch(html, /Contact opslaan|Ik wil ontmoeten|save-contact|\/contact\?/);
  });

  test("photo-led Appearances frame their photo on the saved focus", () => {
    for (const id of ["clean", "frame", "aura"]) {
      const html = render(mode("personal", { theme: id }, { image_focus_x: 50, image_focus_y: 15 }), "plus");
      assert.match(html, /data-photo-focus="50 15"/, id);
    }
  });
});

describe("Name type", () => {
  const STYLES = ["setuvara", "modern", "editorial", "condensed", "impact", "soft"];
  const nameHtml = (html) => html.match(/<h1[^>]*data-name[^>]*>/)?.[0] ?? "";

  test("six curated styles; Setuvara and Modern are Free, the rest Plus", () => {
    assert.deepEqual([...lib.NAME_FONTS], STYLES);
    assert.deepEqual([...lib.FREE_NAME_FONTS], ["setuvara", "modern"]);
    for (const font of STYLES) {
      assert.equal(lib.capabilityForField("nameFont", font), lib.isFreeNameFont(font) ? null : "appearance.premium", font);
      assert.equal(resolveFor({ nameFont: font }, "free").nameFont, lib.isFreeNameFont(font) ? font : "setuvara", `${font} on Free`);
      assert.equal(resolveFor({ nameFont: font }, "plus").nameFont, font);
    }
    assert.equal(resolveFor({}).nameFont, "setuvara", "absent is Setuvara");
    assert.equal(resolveFor({ nameFont: "Comic Sans" }, "pro").nameFont, "setuvara", "unknown ids never render");
  });

  test("stored as an id only, validated, kept on downgrade and cleared by reset", () => {
    assert.equal(lib.isValidAppearance("personal", { theme: "immersive", accent: "#FF5A4F", nameFont: "impact" }), true);
    assert.equal(lib.isValidAppearance("personal", { theme: "immersive", accent: "#FF5A4F", nameFont: "https://fonts.example/x.woff2" }), false);
    assert.equal(lib.isValidAppearance("personal", { theme: "immersive", accent: "#FF5A4F", nameFont: "Comic Sans" }), false);
    assert.deepEqual(lib.lockedFields({ theme: "immersive", accent: "#FF5A4F", nameFont: "soft" }, "free"), ["nameFont"]);
    assert.deepEqual(lib.introducedLockedFields({ theme: "immersive", accent: "#FF5A4F", nameFont: "soft" }, { theme: "immersive", accent: "#C7FF4A", nameFont: "soft" }, "free"), [], "a saved Plus style survives a downgrade");
    assert.deepEqual(lib.introducedLockedFields({ theme: "immersive", accent: "#FF5A4F" }, { theme: "immersive", accent: "#FF5A4F", nameFont: "editorial" }, "free"), ["nameFont"]);
    assert.deepEqual(lib.introducedLockedFields({ theme: "immersive", accent: "#FF5A4F" }, { theme: "immersive", accent: "#FF5A4F", nameFont: "modern" }, "free"), []);
    assert.ok(lib.VISUAL_KEYS.includes("nameFont"));
    assert.equal(lib.resetAppearance("personal", { theme: "glow", accent: "#FF5A4F", nameFont: "impact" }).nameFont, undefined);
  });

  test("the plan trigger mirrors the field list", () => {
    // The latest migration that recreates the trigger carries the whole list.
    const sql = readFileSync(join(root, "supabase/migrations/20261013020000_scroll_cue.sql"), "utf8");
    assert.match(sql, /'qrStyle', 'nameFont', 'scrollCue'\n  \] loop/, "same order as PREMIUM_FIELDS");
    assert.equal(lib.PREMIUM_FIELDS.at(-2), "nameFont");
    assert.match(sql, /p_field = 'nameFont' then p_value #>> '\{\}' not in \('setuvara', 'modern'\)/);
  });

  test("every Appearance draws its name in the chosen face; Setuvara keeps each look's own", () => {
    for (const id of TEN) {
      const signature = nameHtml(render(mode("personal", { theme: id }), "pro"));
      assert.match(signature, id === "film" ? /--font-instrument-serif/ : /--font-bricolage/, `${id} signature`);
      for (const font of STYLES.slice(1)) {
        const html = render(mode("personal", { theme: id, nameFont: font }), "pro");
        const heading = nameHtml(html);
        assert.match(heading, new RegExp(`data-name-font="${font}"`), `${id} ${font}`);
        assert.match(heading, new RegExp(`--font-name-${font}`), `${id} ${font} family`);
        assert.match(heading, /system-ui|serif/, "every stack ends in system families");
        const free = nameHtml(render(mode("personal", { theme: id, nameFont: font }), "free"));
        if (!lib.isFreeNameFont(font)) assert.match(free, /data-name-font="setuvara"/, `${id} ${font} falls back on Free`);
      }
    }
  });

  test("Motion's marquee wears the style too", () => {
    const html = render(mode("personal", { theme: "motion", nameFont: "condensed" }), "pro");
    assert.match(html, /--font-name-condensed[^"]*;text-transform:uppercase/);
  });

  test("long names fit narrower for wide faces and wider for condensed ones", () => {
    for (const font of STYLES) {
      const type = lib.nameType(font, { serif: false, weight: 700 });
      const size = lib.fittedNameSize("Maximiliana-Alexandrovna", 50, type.scale, 390, 346, type.charWidth);
      assert.ok(size * type.charWidth * 24 <= 346 + 1, `${font} fits the width`);
    }
    const layout = (font) => lib.solveFaceSafe({ frame: { width: 390, height: 844 }, focus: { x: 50, y: 30 }, name: "Maximiliana Alexandrovna Ríos-Đặng", nameBase: 50, nameScale: 1, nameCharWidth: lib.nameType(font, { serif: false, weight: 700 }).charWidth, nameLeading: lib.nameType(font, { serif: false, weight: 700 }).leading, namePosition: "auto", liveContext: false, meta: true, featuredSound: false, socialStyle: "rail", secondary: false });
    for (const font of STYLES) {
      const result = layout(font);
      assert.ok(result.nameSize >= 20 && result.nameSize <= 60, `${font}: ${result.nameSize}`);
      if (result.face) assert.ok(["bottom", "top", "split"].includes(result.strategy));
    }
    assert.deepEqual(layout("setuvara"), lib.solveFaceSafe({ frame: { width: 390, height: 844 }, focus: { x: 50, y: 30 }, name: "Maximiliana Alexandrovna Ríos-Đặng", nameBase: 50, nameScale: 1, namePosition: "auto", liveContext: false, meta: true, featuredSound: false, socialStyle: "rail", secondary: false }), "Setuvara solves exactly as before");
  });

  test("diacritic and non-Latin names render as text, untouched", () => {
    for (const name of ["Zoë Ðorđević-Łukasiewicz", "Nguyễn Thị Ánh", "Αλέξανδρος", "Дмитрий", "สมชาย", "佐藤 花子", "محمد"]) {
      const html = renderWith(mode("personal", { theme: "immersive", nameFont: "impact" }), { plan: "pro", profile: { ...profile, display_name: name } });
      assert.ok(html.includes(name), name);
    }
  });

  test("fonts are self-hosted with next/font: one weight each, swap, never preloaded", () => {
    const source = readFileSync(join(root, "src/components/profile/name-fonts.ts"), "utf8");
    assert.match(source, /from "next\/font\/google"/);
    assert.equal((source.match(/display: "swap"/g) ?? []).length, 5);
    assert.equal((source.match(/preload: false/g) ?? []).length, 5);
    assert.doesNotMatch(source, /https?:\/\//, "no external font URLs");
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
    }
  });

  test("unknown frames fall back to the focus itself; missing values use the default", () => {
    assert.equal(lib.focusPosition({ x: 40, y: 20 }), "40% 20%");
    assert.deepEqual(lib.readFocus(null, undefined), lib.DEFAULT_FOCUS);
    assert.deepEqual(lib.modeFocus({ image_focus_x: 30, image_focus_y: 12 }), { x: 30, y: 12 });
  });
});

describe("Photo originals", () => {
  // A 3:4 phone photo, 3000×4000, with a 4:5 crop of 2400×3000 starting 300px in and 400px down.
  const crop = { x: 300 / 3000, y: 400 / 4000, w: 2400 / 3000, h: 3000 / 4000, width: 3000, height: 4000 };
  const ORIGINAL = "https://media.example.test/original.webp";
  const withOriginal = (appearance, extra = {}) => mode("personal", appearance, { image_original_path: "y", image_original_url: ORIGINAL, image_crop: crop, image_focus_x: 50, image_focus_y: 30, ...extra });
  const source = () => lib.photoSource({ image_url: PHOTO, image_original_url: ORIGINAL, image_crop: crop, image_focus_x: 50, image_focus_y: 30 });

  test("a Mode with a kept original frames from it; older photos fall back to the saved crop", () => {
    const kept = source();
    assert.equal(kept.url, ORIGINAL);
    assert.equal(kept.original, true);
    assert.equal(kept.aspect, 0.75);
    const legacy = lib.photoSource({ image_url: PHOTO, image_original_url: null, image_crop: null, image_focus_x: 50, image_focus_y: 30 });
    assert.equal(legacy.url, PHOTO);
    assert.equal(legacy.original, false);
    assert.deepEqual(legacy.crop, { x: 0, y: 0, w: 1, h: 1 });
    // Malformed metadata never renders the wrong framing: it falls back to the saved crop.
    assert.equal(lib.photoSource({ image_url: PHOTO, image_original_url: ORIGINAL, image_crop: { x: 0.5, y: 0, w: 0.8, h: 1, width: 10, height: 10 } }).url, PHOTO);
    assert.equal(lib.readCrop({ ...crop, extra: 1 })?.w, crop.w);
    assert.equal(lib.readCrop("nope"), null);
  });

  test("at 100% the profile frame shows exactly the member's crop", () => {
    const placement = lib.placePhoto(source(), 4 / 5, 1);
    // The crop fills the frame: its left/top edges sit at the frame's edges.
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    assert.ok(near(placement.left + crop.x * placement.width, 0));
    assert.ok(near(placement.top + crop.y * placement.height, 0));
    assert.ok(near(crop.w * placement.width, 1));
    assert.ok(near(crop.h * placement.height, 1));
    assert.equal(placement.covers, true);
  });

  test("the same face at the same scale, but a wide frame shows real image beyond the crop", () => {
    const wide = lib.placePhoto(source(), 16 / 9, 1);
    assert.equal(wide.covers, true, "never empty at 100%");
    // The crop is narrower than the wide frame: the original fills the rest with real pixels.
    assert.ok(crop.w * wide.width < 1, "more than the crop is visible");
    const legacy = lib.placePhoto(lib.legacySource(PHOTO, { x: 50, y: 30 }), 16 / 9, 1);
    assert.ok(Math.abs(legacy.width - 1) < 1e-9, "a saved crop can only be zoomed in to fill a wide frame");
  });

  test("zoom out reveals the original first, and leaves the frame to the atmosphere only past it", () => {
    const at100 = lib.placePhoto(source(), 390 / 844, 1);
    const at70 = lib.placePhoto(source(), 390 / 844, 0.7);
    assert.ok(at70.width < at100.width && at70.height < at100.height, "the image is drawn smaller");
    const visible = (p) => Math.min(1, p.left + p.width) - Math.max(0, p.left);
    assert.ok(visible(at70) / at70.width > visible(at100) / at100.width, "a larger share of the original is visible");
    const legacy70 = lib.placePhoto(lib.legacySource(PHOTO, { x: 50, y: 30 }), 390 / 844, 0.7);
    assert.equal(legacy70.covers, false, "a saved crop runs out: the atmosphere fills the rest");
    const html = render(withOriginal({ theme: "immersive", portraitZoom: 70 }));
    assert.match(html, /data-photo-source="original"/);
    assert.match(html, new RegExp(ORIGINAL.replace(/[.]/g, "\\.")));
    const framed = render(withOriginal({ theme: "clean", portraitZoom: 70 }));
    assert.match(framed, /data-photo-zoom="70"/);
  });

  test("the face model is measured against the crop, so it is the same face from the original or the crop", () => {
    const frame = { width: 390, height: 844 };
    const fromOriginal = lib.estimateFace(source(), frame);
    const fromCrop = lib.estimateFace(lib.legacySource(PHOTO, { x: 50, y: 30 }), frame);
    for (const key of ["top", "mouth", "chin", "left", "right"]) assert.ok(Math.abs(fromOriginal[key] - fromCrop[key]) < 1e-6, key);
    const layout = lib.solveFaceSafe({ frame, focus: { x: 50, y: 30 }, source: source(), zoom: 0.85, name: "Aanya Rao", nameBase: 64, nameScale: 1, namePosition: "auto", liveContext: false, meta: true, featuredSound: false, socialStyle: "compact", secondary: false });
    assert.ok(["bottom", "top", "split"].includes(layout.strategy));
  });

  test("the migration keeps the original private, owner-scoped and paired with its crop", () => {
    const sql = readFileSync(join(root, "supabase/migrations/20261012230100_photo_originals.sql"), "utf8");
    assert.match(sql, /add column if not exists image_original_path text/);
    assert.match(sql, /\(image_original_path is null\) = \(image_crop is null\)/);
    assert.match(sql, /split_part\(image_original_path, '\/', 1\) = profile_id::text/);
    assert.match(sql, /modes\.image_original_path = storage\.objects\.name\s+and modes\.is_enabled\s+and profiles\.is_published/);
  });
});

describe("Scroll cue", () => {
  const CUES = ["glide", "rail", "orb", "mouse", "beam", "cascade", "caption", "cards", "swipe", "credits"];
  const withBlocks = (appearance) => mode("personal", appearance, { blocks: [{ id: "b", kind: "image", is_visible: true, sort_order: 0, data: { image_url: "https://media.example.test/one.png" } }] });
  const cueOf = (html) => attr(html, "data-scroll-cue");

  test("ten cues, one per Appearance, each different", () => {
    assert.deepEqual([...lib.SCROLL_CUES], CUES);
    assert.deepEqual([...lib.SCROLL_CUE_CHOICES], ["auto", "off", ...CUES]);
    assert.equal(new Set(Object.values(lib.APPEARANCE_CUES)).size, 10);
    for (const id of TEN) assert.equal(resolveFor({ theme: id }, "plus").scrollCue, lib.APPEARANCE_CUES[id], id);
  });

  test("Auto and Off are Free; choosing one of the ten is Plus, kept on downgrade", () => {
    for (const value of ["auto", "off"]) assert.equal(lib.capabilityForField("scrollCue", value), null);
    for (const cue of CUES) {
      assert.equal(lib.capabilityForField("scrollCue", cue), "appearance.premium", cue);
      assert.equal(resolveFor({ theme: "immersive", scrollCue: cue }, "plus").scrollCue, cue);
      assert.equal(resolveFor({ theme: "immersive", scrollCue: cue }, "free").scrollCue, "glide", `${cue} on Free wears Immersive's own`);
    }
    assert.equal(resolveFor({ theme: "clean", scrollCue: "off" }, "free").scrollCue, null);
    assert.equal(resolveFor({ theme: "clean" }, "free").scrollCue, "mouse");
    assert.equal(resolveFor({ theme: "clean" }, "free").scrollCueMotion, false, "Free is still");
    assert.equal(resolveFor({ theme: "clean" }, "plus").scrollCueMotion, false, "Clean's motion is off");
    assert.equal(resolveFor({ theme: "immersive" }, "plus").scrollCueMotion, true);
    assert.equal(resolveFor({ theme: "immersive", motion: "off" }, "plus").scrollCueMotion, false);
    assert.ok(lib.isValidAppearance("personal", { theme: "immersive", accent: "#FF5A4F", scrollCue: "orb" }));
    assert.ok(!lib.isValidAppearance("personal", { theme: "immersive", accent: "#FF5A4F", scrollCue: "spin" }));
    assert.deepEqual(lib.introducedLockedFields({ theme: "immersive", accent: "#FF5A4F" }, { theme: "immersive", accent: "#FF5A4F", scrollCue: "beam" }, "free"), ["scrollCue"]);
    assert.deepEqual(lib.introducedLockedFields({ theme: "immersive", accent: "#FF5A4F" }, { theme: "immersive", accent: "#FF5A4F", scrollCue: "off" }, "free"), []);
    assert.ok(lib.VISUAL_KEYS.includes("scrollCue"));
    const sql = readFileSync(join(root, "supabase/migrations/20261013020000_scroll_cue.sql"), "utf8");
    assert.match(sql, /p_field = 'scrollCue' then p_value #>> '\{\}' not in \('auto', 'off'\)/);
    assert.match(sql, /'scrollCue', 'motion'/);
  });

  test("every Appearance renders its cue on phone and wide, and Off renders none", () => {
    for (const id of TEN) {
      const html = render(withBlocks({ theme: id }), "plus");
      const cues = html.match(/data-scroll-cue="([a-z]+)"/g) ?? [];
      assert.equal(cues.length, 2, `${id}: phone and wide`);
      assert.equal(cueOf(html), lib.APPEARANCE_CUES[id], id);
      assert.doesNotMatch(render(withBlocks({ theme: id, scrollCue: "off" }), "plus"), /data-scroll-cue=/, `${id} off`);
    }
    assert.match(render(withBlocks({ theme: "immersive" }), "plus", "live"), /data-scroll-cue-motion="loop"/);
    assert.match(render(withBlocks({ theme: "immersive" }), "free", "live"), /data-scroll-cue-motion="still"/);
    assert.match(render(withBlocks({ theme: "immersive" }), "plus", "off"), /data-scroll-cue-motion="still"/, "thumbnails stay still");
  });

  test("Social no longer repeats the Mode's pictures in the hero", () => {
    const images = [{ id: "i1", kind: "image", is_visible: true, sort_order: 0, data: { image_url: "https://media.example.test/one.png" } }, { id: "i2", kind: "image", is_visible: true, sort_order: 1, data: { image_url: "https://media.example.test/two.png" } }];
    const html = render(mode("personal", { theme: "social" }, { blocks: images }), "plus");
    assert.doesNotMatch(html, /data-social-tiles/);
    const hero = html.slice(html.indexOf("data-profile-hero-mobile"), html.indexOf("data-profile-hero-wide"));
    assert.doesNotMatch(hero, /one\.png/);
    assert.match(html, /one\.png/, "the pictures still show once, below");
    assert.equal(cueOf(html), "swipe");
  });
});
