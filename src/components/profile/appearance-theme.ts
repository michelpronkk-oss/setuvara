import type { PlanCode } from "@/lib/billing/catalog";
import { parseVideo } from "@/lib/blocks/media";
import { inkOnAccent, isLightAppearance, resolveAppearance, type AppearanceId, type SocialStyle } from "./appearance";
import type { ModeSlug, ProfileBlock, ProfileMode } from "./types";

/**
 * Visual tokens for the ten Appearances, from the approved ViralProfile design. Pure data: the
 * renderer composes them; nothing here is stored.
 */

export const PAPER = "#F5F4EF";
export const INK = "#0D0D0D";

export type AppearanceTheme = {
  id: AppearanceId;
  light: boolean;
  /** Page base under the atmosphere (also the browser theme colour). */
  base: string;
  fg: string;
  muted: string;
  /** The low-resolution blurred photo atmosphere behind everything. */
  atmosphere: { on: boolean; saturate: number; brightness: number; veil: string; fromTop: number };
  grain: boolean;
  pill: { bg: string; fg: string };
  card: { bg: string; edge: string };
  radius: number;
  radiusSmall: number;
  bioAlign: "left" | "center";
  /** Identity block on the hero. */
  identity: { align: "left" | "center"; fg: string; muted: string; line: string; serif: boolean; weight: number; shadow: string | null };
  /** Name base size (px at 390 wide) and character width factor for fitting. */
  name: { base: number; charWidth: number };
  connect: { bg: string; fg: string; edge: string; dot: string | null; shadow: string | null; sheen: boolean; full: boolean };
  liveDot: string;
  /** Wide (≥700) composition: photo inset and dissolve. */
  wide: { inset: number; radius: number; mask: boolean };
  /** Text for the default "Make yours" pill and the small mark. */
  socialDefault: SocialStyle;
};

export function appearanceTheme(id: AppearanceId, accent: string, hasPhoto = true): AppearanceTheme {
  const onAccent = inkOnAccent(accent);
  const light = isLightAppearance(id);
  const base: AppearanceTheme = {
    id,
    light,
    base: "#120F0D",
    fg: PAPER,
    muted: "#F5F4EFB3",
    atmosphere: { on: true, saturate: 1.25, brightness: 0.55, veil: "#0D0D0D33", fromTop: 0 },
    grain: false,
    pill: { bg: "#0D0D0D52", fg: PAPER },
    card: { bg: "#F5F4EF14", edge: "#F5F4EF1F" },
    radius: 26,
    radiusSmall: 18,
    bioAlign: "left",
    identity: { align: "left", fg: PAPER, muted: "#F5F4EFCC", line: "#F5F4EF59", serif: false, weight: 700, shadow: null },
    name: { base: 50, charWidth: 0.55 },
    connect: { bg: PAPER, fg: INK, edge: "none", dot: accent, shadow: null, sheen: false, full: false },
    liveDot: "#FF5A4F",
    wide: { inset: 0, radius: 0, mask: true },
    socialDefault: "rail",
  };
  const darkIdentity = base.identity;
  const lightIdentity = { ...darkIdentity, fg: INK, muted: "#0D0D0D99", line: "#0D0D0D33" };
  let theme: AppearanceTheme;
  switch (id) {
    case "immersive":
      theme = { ...base, socialDefault: "compact" };
      break;
    case "motion":
      theme = { ...base, base: INK, atmosphere: { ...base.atmosphere, brightness: 0.35, veil: "#0D0D0D59" }, name: { base: 22, charWidth: 0 }, connect: { ...base.connect, bg: accent, fg: onAccent, dot: null, sheen: true, full: true }, liveDot: accent };
      break;
    case "aura":
      theme = {
        ...base, base: "#F1ECEA", fg: INK, muted: "#0D0D0DA6",
        atmosphere: { ...base.atmosphere, saturate: 1.6, brightness: 1.25, veil: "#F5F4EF8C" },
        pill: { bg: "#FFFFFFB3", fg: INK }, card: { bg: "#FFFFFF99", edge: "#FFFFFFCC" }, bioAlign: "center",
        identity: { ...lightIdentity, align: "center", muted: "#0D0D0DA6", line: "#0D0D0D40" },
        name: { base: 40, charWidth: 0.55 }, connect: { ...base.connect, bg: INK, fg: PAPER }, liveDot: "#E5352B",
      };
      break;
    case "clean":
      theme = {
        ...base, base: "#F4F2EE", fg: INK, muted: "#0D0D0D99",
        atmosphere: { ...base.atmosphere, on: false },
        pill: { bg: "#FFFFFFD9", fg: INK }, card: { bg: "#FFFFFF", edge: "#0D0D0D0F" },
        identity: lightIdentity, name: { base: 44, charWidth: 0.55 }, connect: { ...base.connect, bg: INK, fg: PAPER }, liveDot: "#E5352B",
        wide: { inset: 20, radius: 28, mask: false }, socialDefault: "row",
      };
      break;
    case "glow":
      theme = {
        ...base, base: "#07070A", atmosphere: { ...base.atmosphere, brightness: 0.25, veil: "#07070A80" },
        card: { bg: "#FFFFFF0D", edge: `${accent}33` }, bioAlign: "center",
        identity: { ...darkIdentity, align: "center", shadow: `0 0 28px ${accent}80` }, name: { base: 40, charWidth: 0.55 },
        connect: { ...base.connect, bg: accent, fg: onAccent, dot: null, shadow: `0 0 30px ${accent}80` },
      };
      break;
    case "scene":
      theme = { ...base, atmosphere: { ...base.atmosphere, brightness: 0.4 }, name: { base: 34, charWidth: 0.55 } };
      break;
    case "frame":
      theme = { ...base, atmosphere: { ...base.atmosphere, saturate: 1.4, brightness: 0.42 }, bioAlign: "center", identity: { ...darkIdentity, align: "center" }, name: { base: 44, charWidth: 0.55 }, wide: { inset: 20, radius: 28, mask: false } };
      break;
    case "stack":
      theme = { ...base, base: "#141210", atmosphere: { ...base.atmosphere, brightness: 0.32 }, identity: { ...darkIdentity, align: "center" }, name: { base: 46, charWidth: 0.55 } };
      break;
    case "social":
      theme = { ...base, atmosphere: { ...base.atmosphere, saturate: 1.4, brightness: 0.48 }, name: { base: 36, charWidth: 0.55 }, connect: { ...base.connect, bg: accent, fg: onAccent, dot: null }, wide: { inset: 20, radius: 28, mask: false } };
      break;
    case "film":
      theme = {
        ...base, base: "#0B0A09", atmosphere: { ...base.atmosphere, brightness: 0.25 }, grain: true, bioAlign: "center",
        identity: { ...darkIdentity, align: "center", serif: true, weight: 400 }, name: { base: 44, charWidth: 0.42 },
        connect: { ...base.connect, bg: "transparent", fg: PAPER, edge: "inset 0 0 0 1.5px #F5F4EFCC", dot: null },
        socialDefault: "compact",
      };
      break;
  }
  // No photo: the accent carries the light atmospheres; dark ones stay calm.
  if (!hasPhoto && theme.atmosphere.on) theme = { ...theme, atmosphere: { ...theme.atmosphere, veil: light ? `${accent}40` : "#0D0D0D00" } };
  return theme;
}

/** Background and darkness of a Mode's look, so a page can continue it past the profile. */
export function profileTone(mode: Pick<ProfileMode, "slug" | "appearance">, plan: PlanCode = "free") {
  const look = resolveAppearance(mode, plan);
  const theme = appearanceTheme(look.id, look.accent);
  return { bg: theme.base, dark: !theme.light };
}

/** Single browser/page surface colour derived from the same tokens as the renderer. */
export function resolvedBrowserThemeColor(mode: Pick<ProfileMode, "slug" | "appearance">, plan: PlanCode = "free"): string {
  return profileTone(mode, plan).bg;
}

/** Every page base, so the document canvas can be painted before the body arrives. */
export const APPEARANCE_BASES = ["#120F0D", "#0D0D0D", "#F1ECEA", "#F4F2EE", "#07070A", "#141210", "#0B0A09"] as const;

/** Booking providers become the Business "Book a call" action instead of a hero platform. */
export const BOOKING_PROVIDERS = ["calendly", "cal_com", "booking_link", "calendar"];

/** Platforms that can appear in the hero, ranked per Mode. Presentation only; storage order is untouched. */
const HERO_PRIORITY: Record<ModeSlug, string[]> = {
  personal: ["instagram", "tiktok", "spotify", "x", "youtube", "threads", "soundcloud", "apple_music", "bluesky", "snapchat", "pinterest", "twitch", "kick", "facebook", "mastodon", "substack", "medium", "patreon", "behance", "dribbble", "github", "gitlab", "linkedin", "portfolio", "website", "email"],
  event: ["linkedin", "instagram", "x", "website", "company_website", "github", "behance", "dribbble", "tiktok", "youtube", "threads", "bluesky", "spotify", "portfolio", "email"],
  business: ["linkedin", "website", "company_website", "behance", "email", "dribbble", "github", "portfolio", "x", "instagram", "youtube", "medium", "substack", "threads", "bluesky", "tiktok"],
};
export const HERO_SOCIAL_LIMIT = 5;

/** Up to five hero platforms from the Mode's existing visible links, in Mode priority. */
export function heroSocials<T extends { providerId: string; link: { id: string; sort_order: number } }>(slug: ModeSlug, links: readonly T[]): T[] {
  const priority = HERO_PRIORITY[slug];
  const seen = new Set<string>();
  return links
    .filter((item) => priority.includes(item.providerId))
    .sort((a, b) => priority.indexOf(a.providerId) - priority.indexOf(b.providerId) || a.link.sort_order - b.link.sort_order)
    .filter((item) => (seen.has(item.providerId) ? false : (seen.add(item.providerId), true)))
    .slice(0, HERO_SOCIAL_LIMIT);
}

/** Brand colours, used only by the Social Appearance. */
export const BRAND_COLOURS: Record<string, string> = {
  instagram: "#E1306C", spotify: "#1DB954", linkedin: "#0A66C2", behance: "#1769FF", youtube: "#FF0000",
  twitch: "#9146FF", soundcloud: "#FF5500", dribbble: "#EA4C89", pinterest: "#E60023", facebook: "#1877F2",
  bluesky: "#1185FE", mastodon: "#6364FF", substack: "#FF6719", patreon: "#FF424D", apple_music: "#FA243C",
};
export const brandColour = (providerId: string) => BRAND_COLOURS[providerId] ?? INK;

/** Images that already exist in a Mode's content, in stored order: image blocks, feature images and video posters. */
export function contentImages(blocks: readonly ProfileBlock[] | undefined): { url: string; blockId: string; kind: ProfileBlock["kind"] }[] {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  return (blocks ?? []).filter((block) => block.is_visible && !block.is_soundtrack).flatMap((block) => {
    let url = "";
    if (block.kind === "image") url = text(block.data.image_url);
    else if (block.kind === "feature") url = text(block.data.image_url) || text(block.data.image);
    else if (block.kind === "video") url = text(block.data.thumbnail) || (parseVideo(text(block.data.url))?.thumbnail ?? "");
    // https only; plain http is allowed for a local stack's signed URLs.
    return /^https:\/\//i.test(url) || /^http:\/\/(127\.0\.0\.1|localhost)[:/]/i.test(url) || url.startsWith("/") ? [{ url, blockId: block.id, kind: block.kind }] : [];
  });
}

/** Film's subtitle: the bio's first sentence, or nothing. */
export function filmSubtitle(bio: string | null | undefined): string {
  const text = (bio ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  const match = /^.+?[.!?。！？](?=\s|$)/u.exec(text);
  return (match ? match[0] : text).trim();
}

/** The SVG noise used as Film grain (CSS only). */
export const FILM_GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E\")";

export const NAME_SCALE = { compact: 0.74, standard: 1, large: 1.2, statement: 1.42 } as const;
export const SOCIAL_HEIGHTS = { rail: 54, row: 34, compact: 52, hidden: 0 } as const;
