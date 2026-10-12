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

  test("Make yours for Free, a small mark for Plus; never a Plus grant in the link", () => {
    const free = renderWith(mode("personal", { theme: "immersive" }), { attribution: true, plan: "free" });
    assert.equal(attr(free, "data-attribution"), "make-yours");
    assert.match(free, /Make yours on Setuvara/);
    assert.match(free, /\/signup\?appearance=immersive/);
    const plus = renderWith(mode("personal", { theme: "film" }), { attribution: true, plan: "plus" });
    assert.equal(attr(plus, "data-attribution"), "mark");
    assert.doesNotMatch(plus, /Make yours/);
  });

  test("member badges: Plus coral, Pro champagne, none on Free; no Appearance implies a badge", () => {
    const m = mode("personal", { theme: "glow" });
    const html = (memberTier) => renderWith(m, { plan: memberTier ?? "free", memberTier });
    assert.match(html("plus"), /data-member-badge="plus"/);
    assert.match(html("pro"), /data-member-badge="pro"/);
    assert.doesNotMatch(html(null), /data-member-badge/);
    assert.doesNotMatch(render(m, "plus"), /data-member-badge/);
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
