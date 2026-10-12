import type { AppearanceId, LegacyThemeId, ModeAppearance, ModeSlug, ProfileMode } from "./types";
import { hasCapability, type CapabilityKey } from "@/lib/billing/capabilities";
import type { PlanCode } from "@/lib/billing/catalog";

/**
 * Setuvara Appearance: one of ten visual identities equipped per Mode, stored in
 * profile_modes.appearance, plus a few bounded personal touches.
 *
 * Every value is an enumerated id or a bounded number (never CSS). This module is the single
 * normalization layer: it reads stored legacy rows (the six retired themes and their layouts),
 * stored new rows, the plan-effective look (premium values stay saved but render their Free
 * equivalent without Plus) and private editor previews, and always returns one coherent
 * ResolvedAppearance. The database check constraint and trigger mirror these lists.
 */

export const DEFAULT_MODE_ACCENT = "#FF5A4F";
const HEX_COLOR = /^#[\da-f]{6}$/i;

export const APPEARANCES = ["immersive", "motion", "aura", "clean", "glow", "scene", "frame", "stack", "social", "film"] as const satisfies readonly AppearanceId[];
export type { AppearanceId } from "./types";
export const FREE_APPEARANCES: readonly AppearanceId[] = ["immersive", "clean"];
/** Light Appearances: paper-toned, ink text. Everything else is photo-led and dark. */
export const LIGHT_APPEARANCES: readonly AppearanceId[] = ["aura", "clean"];
export const APPEARANCE_NAMES: Record<AppearanceId, string> = {
  immersive: "Immersive", motion: "Motion", aura: "Aura", clean: "Clean", glow: "Glow",
  scene: "Scene", frame: "Frame", stack: "Stack", social: "Social", film: "Film",
};
/** One line each, for the picker. */
export const APPEARANCE_LINES: Record<AppearanceId, string> = {
  immersive: "Your photo is the room.",
  motion: "Kinetic name, drifting portrait.",
  aura: "A soft cloud from your own photo.",
  clean: "Warm, light and polished.",
  glow: "Dark, with a restrained accent glow.",
  scene: "You, inside your own world.",
  frame: "A gallery print on a matte.",
  stack: "Your portrait and work, fanned.",
  social: "Creator energy, platforms first.",
  film: "Cinematic, with a subtitle.",
};

export const LEGACY_THEMES = ["light", "dark", "editorial", "noir", "signal", "studio"] as const satisfies readonly LegacyThemeId[];
/** Every theme id the database accepts. */
export const STORED_THEMES = [...APPEARANCES, ...LEGACY_THEMES] as const;

/** Retired composition ids, still accepted per Mode (mirrors the database check). */
const SHARED_LAYOUTS = ["portrait", "poster", "index", "full-portrait"] as const;
export const MODE_LAYOUTS = {
  personal: ["full-bleed", "portrait-editorial", ...SHARED_LAYOUTS],
  event: ["event-poster", "conference-card", ...SHARED_LAYOUTS],
  business: ["editorial-business", "structured", ...SHARED_LAYOUTS],
} as const satisfies Record<ModeSlug, readonly string[]>;
export type ModeLayout<S extends ModeSlug = ModeSlug> = (typeof MODE_LAYOUTS)[S][number];
/** Legacy layouts whose photo filled the hero. */
const COVER_LAYOUTS = ["full-bleed", "event-poster", "editorial-business", "portrait", "full-portrait"];

export const IMAGE_TREATMENTS = ["full-bleed", "portrait", "compact", "frame"] as const;
const INTENSITIES = ["quiet", "balanced", "signal"] as const;
const CARD_STYLES = ["flat", "outline", "soft", "layered", "editorial"] as const;
const RADII = ["sharp", "subtle", "soft"] as const;
const BUTTON_STYLES = ["pill", "block", "editorial", "minimal"] as const;
const LINK_STYLES = ["icons", "list", "chips", "cards"] as const;
const SOUND_STYLES = ["core", "strip", "disc", "poster"] as const;
export const QR_STYLES = ["standard", "accent-frame", "label", "inverse", "rounded"] as const;
export type QrStyle = (typeof QR_STYLES)[number];

export const PORTRAIT_ZOOMS = [100, 110, 115, 120, 130, 140] as const;
/** What the editor offers; 110 and 120 stay valid for rows saved earlier. */
export const EDITOR_ZOOMS = [100, 115, 130, 140] as const;
export type PortraitZoom = (typeof PORTRAIT_ZOOMS)[number];
export const NAME_SIZES = ["compact", "standard", "large", "statement"] as const;
export type NameSize = (typeof NAME_SIZES)[number];
export const NAME_POSITIONS = ["auto", "top", "bottom"] as const;
export type NamePosition = (typeof NAME_POSITIONS)[number];
export const READABILITY = ["auto", "soft", "deep"] as const;
export type Readability = (typeof READABILITY)[number];
export const SOCIAL_STYLES = ["rail", "row", "compact", "hidden"] as const;
export type SocialStyle = (typeof SOCIAL_STYLES)[number];
/** Where platforms show: under the name, only in the link rows, or both (each twice, on purpose). */
export const SOCIAL_PLACEMENTS = ["name", "links", "both"] as const;
export type SocialPlacement = (typeof SOCIAL_PLACEMENTS)[number];
export const MOTION_LEVELS = ["off", "subtle", "full"] as const;
export type MotionLevel = (typeof MOTION_LEVELS)[number];
export const SOUND_PRESENTATIONS = ["ambient", "minimal", "featured"] as const;
export type SoundPresentation = (typeof SOUND_PRESENTATIONS)[number];

/** Five presets. Custom hex is also Free (appearance.core); contrast is handled, never refused. */
export const ACCENT_PRESETS = [
  { id: "coral", hex: "#FF5A4F" },
  { id: "lime", hex: "#C7FF4A" },
  { id: "blue", hex: "#AFCBFF" },
  { id: "lilac", hex: "#E8A6FF" },
  { id: "gold", hex: "#F5C66E" },
] as const;

/** Each Appearance's own socials treatment and motion when nothing is saved. */
const APPEARANCE_DEFAULTS: Record<AppearanceId, { socialStyle: SocialStyle; motion: MotionLevel; showUsername: boolean }> = {
  immersive: { socialStyle: "compact", motion: "subtle", showUsername: false },
  motion: { socialStyle: "rail", motion: "full", showUsername: false },
  aura: { socialStyle: "rail", motion: "subtle", showUsername: true },
  clean: { socialStyle: "row", motion: "off", showUsername: false },
  glow: { socialStyle: "rail", motion: "subtle", showUsername: false },
  scene: { socialStyle: "rail", motion: "subtle", showUsername: false },
  frame: { socialStyle: "rail", motion: "off", showUsername: false },
  stack: { socialStyle: "rail", motion: "off", showUsername: false },
  social: { socialStyle: "rail", motion: "subtle", showUsername: true },
  film: { socialStyle: "compact", motion: "subtle", showUsername: false },
};

/** Where new accounts and missing values start. Free defaults only. */
export const MODE_DEFAULT_APPEARANCE: Record<ModeSlug, AppearanceId> = { personal: "immersive", event: "immersive", business: "clean" };

/** A Mode's look with every value checked against the plan. */
export type ResolvedAppearance = {
  slug: ModeSlug;
  /** What renders. */
  id: AppearanceId;
  /** The Appearance the saved row asks for (after legacy mapping), before plan fallback. */
  stored: AppearanceId;
  accent: string;
  nameSize: NameSize;
  namePosition: NamePosition;
  readability: Readability;
  /** How icons look under the name; "hidden" exactly when placement is "links". */
  socialStyle: SocialStyle;
  socialPlacement: SocialPlacement;
  motion: MotionLevel;
  soundPresentation: SoundPresentation;
  zoom: PortraitZoom;
  showUsername: boolean;
  qrStyle: QrStyle;
  /** Saved values above the plan (kept, rendering their Free equivalent). */
  locked: PremiumField[];
};

const includes = <T extends string | number>(list: readonly T[], value: unknown): value is T => (list as readonly unknown[]).includes(value);

export const isAppearanceId = (value: unknown): value is AppearanceId => includes(APPEARANCES, value);
export const isFreeAppearance = (id: AppearanceId) => FREE_APPEARANCES.includes(id);
export const isLightAppearance = (id: AppearanceId) => LIGHT_APPEARANCES.includes(id);

export function isModeLayout<S extends ModeSlug>(slug: S, layout: unknown): layout is ModeLayout<S> {
  return includes(MODE_LAYOUTS[slug] as readonly string[], layout);
}

/**
 * The Appearance a stored row means. New rows name it directly; legacy rows map by theme and
 * composition: dark and every photo-filled cover → Immersive, light framed/editorial/studio →
 * Clean, noir → Glow, signal → Motion.
 */
export function storedAppearance(appearance: Partial<ModeAppearance> | null | undefined, slug: ModeSlug): AppearanceId {
  const saved = appearance ?? {};
  if (isAppearanceId(saved.theme)) return saved.theme;
  const layout = typeof saved.layout === "string" ? saved.layout : "";
  if (layout === "full-portrait") return "immersive";
  switch (saved.theme) {
    case "dark": return "immersive";
    case "noir": return "glow";
    case "signal": return "motion";
    case "editorial": case "studio": return "clean";
    case "light": return COVER_LAYOUTS.includes(layout) || saved.imageTreatment === "full-bleed" ? "immersive" : "clean";
    default: return MODE_DEFAULT_APPEARANCE[slug] ?? "immersive";
  }
}

/** Legacy soundtrack styles: Core and Strip → Minimal, Disc and Poster → Featured. */
export function storedSoundPresentation(appearance: Partial<ModeAppearance> | null | undefined): SoundPresentation {
  const saved = appearance ?? {};
  if (includes(SOUND_PRESENTATIONS, saved.soundtrackPresentation)) return saved.soundtrackPresentation;
  if (saved.soundStyle === "disc" || saved.soundStyle === "poster") return "featured";
  if (saved.soundStyle === "core" || saved.soundStyle === "strip") return "minimal";
  return "ambient";
}

/** Which capability each appearance field needs above Free, for a given saved value. */
export function capabilityForField(field: keyof ModeAppearance, value: unknown): CapabilityKey | null {
  if (value === undefined || value === null) return null;
  switch (field) {
    case "theme": return value === "light" || value === "dark" || (isAppearanceId(value) && isFreeAppearance(value)) ? null : "appearance.premium";
    case "layout": return includes(SHARED_LAYOUTS, value) ? "appearance.premium" : null;
    case "portraitNameSize": return value === "standard" ? null : "appearance.advanced_controls";
    case "namePosition": return value === "top" ? "appearance.advanced_controls" : null;
    case "readability": return value === "soft" || value === "deep" ? "appearance.advanced_controls" : null;
    case "motion": return value === "full" ? "appearance.advanced_controls" : null;
    case "soundtrackPresentation": return value === "featured" ? "soundtrack.premium_treatment" : null;
    case "imageTreatment": return value === "frame" ? "appearance.premium" : null;
    case "intensity": return value === "balanced" ? null : "appearance.advanced_controls";
    case "card": case "radius": case "button": case "links": return "appearance.advanced_controls";
    case "soundStyle": return value === "core" ? null : "soundtrack.premium_treatment";
    case "qrStyle": return value === "standard" ? null : "share.qr_premium";
    default: return null;
  }
}

/** Fields the database trigger checks (same list, same order). */
export const PREMIUM_FIELDS = [
  "theme", "layout", "portraitZoom", "portraitNameSize", "portraitShowUsername",
  "namePosition", "readability", "socialStyle", "motion", "soundtrackPresentation",
  "imageTreatment", "intensity", "card", "radius", "button", "links", "soundStyle", "qrStyle",
] as const;
export type PremiumField = (typeof PREMIUM_FIELDS)[number];

/** Saved fields whose value needs a capability the plan does not have (kept, shown as inactive). */
export function lockedFields(appearance: Partial<ModeAppearance> | null | undefined, plan: PlanCode): PremiumField[] {
  const saved = appearance ?? {};
  return PREMIUM_FIELDS.filter((field) => {
    const capability = capabilityForField(field, saved[field]);
    return capability !== null && !hasCapability(plan, capability);
  });
}

/**
 * Premium values a save would newly introduce without the capability. Mirrors the database
 * trigger: values already saved (a downgraded member's look) pass untouched; new ones do not.
 */
export function introducedLockedFields(saved: Partial<ModeAppearance> | null | undefined, next: Partial<ModeAppearance>, plan: PlanCode): PremiumField[] {
  const before = saved ?? {};
  return PREMIUM_FIELDS.filter((field) => {
    if (next[field] === before[field]) return false;
    const capability = capabilityForField(field, next[field]);
    return capability !== null && !hasCapability(plan, capability);
  });
}

/** Where a premium Appearance lands without Plus: light ones become Clean, the rest Immersive. */
export function freeFallback(id: AppearanceId): AppearanceId {
  if (isFreeAppearance(id)) return id;
  return isLightAppearance(id) ? "clean" : "immersive";
}

/**
 * The single place a Mode's look is decided. Legacy values are normalized; premium values stay
 * in storage and, without the capability, the Free equivalent renders. "center" name positions
 * read as Auto.
 */
export function resolveAppearance(mode: Pick<ProfileMode, "slug" | "appearance">, plan: PlanCode = "free"): ResolvedAppearance {
  if (!MODE_LAYOUTS[mode.slug]) throw new Error(`Unknown Mode: ${String(mode.slug)}`);
  const saved: Partial<ModeAppearance> = mode.appearance ?? {};
  const can = (capability: CapabilityKey) => hasCapability(plan, capability);
  const stored = storedAppearance(saved, mode.slug);
  const id = isFreeAppearance(stored) || can("appearance.premium") ? stored : freeFallback(stored);
  const defaults = APPEARANCE_DEFAULTS[id];
  const advanced = can("appearance.advanced_controls");

  const savedSize = includes(NAME_SIZES, saved.portraitNameSize) ? saved.portraitNameSize : "standard";
  const savedPosition: NamePosition = includes(NAME_POSITIONS, saved.namePosition) ? saved.namePosition : "auto";
  const savedReadability: Readability = includes(READABILITY, saved.readability) ? saved.readability : "auto";
  const savedMotion: MotionLevel = includes(MOTION_LEVELS, saved.motion) ? saved.motion : defaults.motion;
  const sound = storedSoundPresentation(saved);
  const savedStyle: SocialStyle = includes(SOCIAL_STYLES, saved.socialStyle) ? saved.socialStyle : defaults.socialStyle;
  const placement: SocialPlacement = includes(SOCIAL_PLACEMENTS, saved.socialPlacement) ? saved.socialPlacement : savedStyle === "hidden" ? "links" : "name";

  return {
    slug: mode.slug,
    id,
    stored,
    accent: resolveModeAccent(mode),
    nameSize: savedSize === "standard" || advanced ? savedSize : "standard",
    namePosition: savedPosition === "top" && !advanced ? "auto" : savedPosition,
    readability: savedReadability !== "auto" && !advanced ? "auto" : savedReadability,
    socialStyle: placement === "links" ? "hidden" : savedStyle === "hidden" ? defaults.socialStyle : savedStyle,
    socialPlacement: placement,
    // An Appearance whose character is motion keeps its own motion; Full needs Plus elsewhere.
    motion: savedMotion === "full" && !advanced ? "subtle" : savedMotion,
    soundPresentation: sound === "featured" && !can("soundtrack.premium_treatment") ? "minimal" : sound,
    zoom: includes(PORTRAIT_ZOOMS, saved.portraitZoom) ? saved.portraitZoom : 100,
    showUsername: typeof saved.portraitShowUsername === "boolean" ? saved.portraitShowUsername : defaults.showUsername,
    qrStyle: resolveQrStyle(mode, plan),
    locked: lockedFields(saved, plan),
  };
}

/**
 * The look for an editor preview of an unsaved draft: every value as chosen, as if the plan had
 * Plus. Never used by the public page.
 */
export function previewAppearance(mode: Pick<ProfileMode, "slug" | "appearance">): ResolvedAppearance {
  return resolveAppearance(mode, "pro");
}

/** Keys an Appearance reset clears. Accent, QR frame and everything outside appearance stay. */
export const VISUAL_KEYS = [
  "layout", "imageTreatment", "intensity", "card", "radius", "button", "links", "soundStyle",
  "portraitZoom", "portraitNameSize", "portraitShowUsername", "namePosition", "readability",
  "socialStyle", "socialPlacement", "motion", "soundtrackPresentation",
] as const satisfies readonly (keyof ModeAppearance)[];

/**
 * Reset Appearance: the Mode's Free default with its own accent and QR frame. Only the visual
 * config changes; photo, bio, links, content blocks, soundtrack, connections, Live Context,
 * Passport and billing live elsewhere and are untouched.
 */
export function resetAppearance(slug: ModeSlug, saved: Partial<ModeAppearance> | null | undefined): ModeAppearance {
  const current = saved ?? {};
  const next: ModeAppearance = { theme: MODE_DEFAULT_APPEARANCE[slug], accent: HEX_COLOR.test(current.accent ?? "") ? current.accent!.toUpperCase() : DEFAULT_MODE_ACCENT };
  if (current.qrStyle) next.qrStyle = current.qrStyle;
  return next;
}

/**
 * The saved appearance after equipping an Appearance: the id is written, the retired composition
 * keys that would contradict it are dropped, and every other saved value (accent, QR frame,
 * personal touches) is kept.
 */
export function equipAppearance(saved: Partial<ModeAppearance> | null | undefined, id: AppearanceId): ModeAppearance {
  const current = { ...(saved ?? {}) } as Partial<ModeAppearance>;
  delete current.layout;
  delete current.imageTreatment;
  return { ...current, theme: id, accent: HEX_COLOR.test(current.accent ?? "") ? current.accent!.toUpperCase() : DEFAULT_MODE_ACCENT } as ModeAppearance;
}

/** Whether a saved appearance is valid as-is for its Mode (what the database accepts). */
export function isValidAppearance(slug: ModeSlug, appearance: ModeAppearance) {
  const known = new Set<string>(["theme", "accent", "qrStyle", "socialPlacement", ...PREMIUM_FIELDS]);
  const optional = (value: unknown, list: readonly string[]) => value === undefined || includes(list, value);
  return Boolean(appearance) && typeof appearance === "object"
    && Object.keys(appearance).every((key) => known.has(key))
    && includes(STORED_THEMES, appearance.theme)
    && typeof appearance.accent === "string" && HEX_COLOR.test(appearance.accent)
    && (appearance.layout === undefined || isModeLayout(slug, appearance.layout))
    && optional(appearance.imageTreatment, IMAGE_TREATMENTS)
    && optional(appearance.qrStyle, QR_STYLES)
    && optional(appearance.intensity, INTENSITIES)
    && optional(appearance.card, CARD_STYLES)
    && optional(appearance.radius, RADII)
    && optional(appearance.button, BUTTON_STYLES)
    && optional(appearance.links, LINK_STYLES)
    && optional(appearance.soundStyle, SOUND_STYLES)
    && (appearance.portraitZoom === undefined || includes(PORTRAIT_ZOOMS, appearance.portraitZoom))
    && optional(appearance.portraitNameSize, NAME_SIZES)
    && (appearance.portraitShowUsername === undefined || typeof appearance.portraitShowUsername === "boolean")
    && optional(appearance.namePosition, NAME_POSITIONS)
    && optional(appearance.readability, READABILITY)
    && optional(appearance.socialStyle, SOCIAL_STYLES)
    && optional(appearance.socialPlacement, SOCIAL_PLACEMENTS)
    && optional(appearance.motion, MOTION_LEVELS)
    && optional(appearance.soundtrackPresentation, SOUND_PRESENTATIONS);
}

/** Validate an untrusted ?appearance= hint. A hint only pre-selects a preview; it grants nothing. */
export function appearanceHint(value: unknown): AppearanceId | null {
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === "string" && isAppearanceId(text.trim().toLowerCase()) ? (text.trim().toLowerCase() as AppearanceId) : null;
}

/** Premium QR styling changes only the frame around a QR; its value and modules are untouched. */
export function resolveQrStyle(mode: { appearance: Pick<ModeAppearance, "qrStyle"> }, plan: PlanCode = "free"): QrStyle {
  const style = mode.appearance?.qrStyle;
  return includes(QR_STYLES, style) && style !== "standard" && hasCapability(plan, "share.qr_premium") ? style : "standard";
}

/** Resolve the saved Mode accent, falling back to Setuvara's current coral default. */
export function resolveModeAccent(mode: Pick<ProfileMode, "appearance">): string {
  const accent = mode.appearance?.accent;
  return typeof accent === "string" && HEX_COLOR.test(accent) ? accent.toUpperCase() : DEFAULT_MODE_ACCENT;
}

export function accentLuminance(hex: string): number {
  const value = HEX_COLOR.exec(hex)?.[0].slice(1);
  if (!value) return 0;
  const [red, green, blue] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** Readable ink on a validated Mode accent: ink above luminance .42, else paper. */
export function inkOnAccent(hex: string): string {
  return accentLuminance(hex) > 0.42 ? "#0D0D0D" : "#F5F4EF";
}

/** A filled control whose colour sits this close to the page gains an edge so it stays visible. */
export const CONNECT_EDGE_CONTRAST = 2;

/** WCAG relative luminance (sRGB, linearised). */
export function relativeLuminance(hex: string): number {
  const value = HEX_COLOR.exec(hex)?.[0].slice(1);
  if (!value) return 0;
  const [red, green, blue] = [0, 2, 4].map((index) => {
    const channel = parseInt(value.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Mix a hex colour over another at `amount` (0–1). */
export function mixHex(base: string, over: string, amount: number): string {
  const parse = (hex: string) => [0, 2, 4].map((index) => parseInt((HEX_COLOR.exec(hex)?.[0].slice(1) ?? "000000").slice(index, index + 2), 16));
  const [b, o] = [parse(base), parse(over)];
  return `#${b.map((channel, index) => Math.round(channel + (o[index] - channel) * amount).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}


/** The style a look wears when its platforms show under the name again. */
export const defaultSocialStyle = (id: AppearanceId): SocialStyle => APPEARANCE_DEFAULTS[id].socialStyle;
