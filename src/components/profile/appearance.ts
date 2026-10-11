import type { ModeAppearance, ModeSlug, ProfileMode } from "./types";
import { hasCapability, type CapabilityKey } from "@/lib/billing/capabilities";
import type { PlanCode } from "@/lib/billing/catalog";

/**
 * Setuvara Appearance: one curated appearance per Mode, stored in profile_modes.appearance.
 *
 *   theme (character) × layout (composition) × colour × image × surfaces
 *
 * Every value is an enumerated id (never CSS). Optional fields left out mean "the theme's own
 * default". The database check constraint mirrors these lists; plan access is resolved at render
 * time from server billing (lock capability, never delete configuration) and a database trigger
 * refuses new premium values for accounts without Plus or Pro.
 */

export const DEFAULT_MODE_ACCENT = "#FF5A4F";
const HEX_COLOR = /^#[\da-f]{6}$/i;

export const THEMES = ["light", "dark", "editorial", "noir", "signal", "studio"] as const;
export type ThemeId = (typeof THEMES)[number];
export const FREE_THEMES: readonly ThemeId[] = ["light", "dark"];
/** Kept for older call sites: every theme the renderer can draw. */
export const MODE_THEMES = THEMES;

/** Layout families. Cover and Framed are the Mode's own pair; the rest work in every Mode. */
export const LAYOUT_FAMILIES = ["cover", "framed", "portrait", "poster", "index", "full-portrait"] as const;
export type LayoutFamily = (typeof LAYOUT_FAMILIES)[number];
export const FREE_LAYOUT_FAMILIES: readonly LayoutFamily[] = ["cover", "framed"];
const SHARED_LAYOUTS = ["portrait", "poster", "index", "full-portrait"] as const;

/** The Mode's own stored layout ids for Cover and Framed (live since the first appearance release). */
export const FAMILY_LAYOUTS = {
  personal: { cover: "full-bleed", framed: "portrait-editorial" },
  event: { cover: "event-poster", framed: "conference-card" },
  business: { cover: "editorial-business", framed: "structured" },
} as const satisfies Record<ModeSlug, { cover: string; framed: string }>;

/** Layouts each Mode may store. Mirrors the profile_modes appearance check constraint. */
export const MODE_LAYOUTS = {
  personal: ["full-bleed", "portrait-editorial", ...SHARED_LAYOUTS],
  event: ["event-poster", "conference-card", ...SHARED_LAYOUTS],
  business: ["editorial-business", "structured", ...SHARED_LAYOUTS],
} as const satisfies Record<ModeSlug, readonly string[]>;

export type ModeLayout<S extends ModeSlug = ModeSlug> = (typeof MODE_LAYOUTS)[S][number];

export const IMAGE_TREATMENTS = ["full-bleed", "portrait", "compact", "frame"] as const;
export type ImageTreatment = (typeof IMAGE_TREATMENTS)[number];
export const INTENSITIES = ["quiet", "balanced", "signal"] as const;
export type Intensity = (typeof INTENSITIES)[number];
export const CARD_STYLES = ["flat", "outline", "soft", "layered", "editorial"] as const;
export type CardStyle = (typeof CARD_STYLES)[number];
export const RADII = ["sharp", "subtle", "soft"] as const;
export type Radius = (typeof RADII)[number];
export const BUTTON_STYLES = ["pill", "block", "editorial", "minimal"] as const;
export type ButtonStyle = (typeof BUTTON_STYLES)[number];
export const LINK_STYLES = ["icons", "list", "chips", "cards"] as const;
export type LinkStyle = (typeof LINK_STYLES)[number];
export const SOUND_STYLES = ["core", "strip", "disc", "poster"] as const;
export type SoundStyle = (typeof SOUND_STYLES)[number];
export const QR_STYLES = ["standard", "accent-frame", "label", "inverse", "rounded"] as const;
export type QrStyle = (typeof QR_STYLES)[number];

/** Five presets. Custom hex is also Free (appearance.core); contrast is handled, never refused. */
export const ACCENT_PRESETS = [
  { id: "coral", hex: "#FF5A4F" },
  { id: "lime", hex: "#C7FF4A" },
  { id: "blue", hex: "#AFCBFF" },
  { id: "lilac", hex: "#E8A6FF" },
  { id: "gold", hex: "#F5C66E" },
] as const;

type ThemeDefaults = { layout: LayoutFamily; card: CardStyle; radius: Radius; button: ButtonStyle; links: LinkStyle; image: ImageTreatment };

/** Each theme's own surfaces. Free renders these; Plus may override them. */
export const THEME_DEFAULTS: Record<ThemeId, ThemeDefaults> = {
  light: { layout: "cover", card: "soft", radius: "soft", button: "pill", links: "icons", image: "full-bleed" },
  dark: { layout: "cover", card: "soft", radius: "soft", button: "pill", links: "icons", image: "full-bleed" },
  editorial: { layout: "framed", card: "editorial", radius: "sharp", button: "editorial", links: "list", image: "portrait" },
  noir: { layout: "cover", card: "outline", radius: "subtle", button: "pill", links: "list", image: "frame" },
  signal: { layout: "framed", card: "soft", radius: "soft", button: "block", links: "chips", image: "frame" },
  studio: { layout: "index", card: "outline", radius: "subtle", button: "pill", links: "cards", image: "portrait" },
};

/**
 * Layout × theme compatibility from the approved design (● default, ○ allowed, — hidden).
 * A hidden pairing is never rendered: the theme's default layout is used instead.
 */
export const THEME_LAYOUTS: Record<ThemeId, readonly LayoutFamily[]> = {
  light: ["cover", "framed", "portrait", "poster", "index"],
  dark: ["cover", "framed", "portrait", "poster", "index", "full-portrait"],
  editorial: ["cover", "framed", "portrait", "index"],
  noir: ["cover", "framed", "portrait", "index"],
  signal: ["cover", "framed", "poster", "index"],
  studio: ["framed", "index"],
};

/** Where a downgraded premium theme lands (Noir keeps its darkness). */
const FREE_THEME_FALLBACK: Record<ThemeId, ThemeId> = { light: "light", dark: "dark", editorial: "light", noir: "dark", signal: "light", studio: "light" };

/** What each Mode falls back to when a saved value is missing or not one of its own. */
const MODE_DEFAULTS: { [S in ModeSlug]: { theme: ThemeId; layout: ModeLayout<S>; imageTreatment: ImageTreatment } } = {
  personal: { theme: "dark", layout: "full-bleed", imageTreatment: "portrait" },
  event: { theme: "light", layout: "event-poster", imageTreatment: "portrait" },
  business: { theme: "light", layout: "structured", imageTreatment: "portrait" },
};

/** A Mode's appearance with every value checked against that Mode's options and the plan. */
export type ResolvedAppearance = {
  slug: ModeSlug;
  theme: ThemeId;
  /** The stored Mode layout id (Cover/Framed resolve to the Mode's own pair). */
  layout: ModeLayout;
  family: LayoutFamily;
  imageTreatment: ImageTreatment;
  accent: string;
  intensity: Intensity;
  card: CardStyle;
  radius: Radius;
  button: ButtonStyle;
  links: LinkStyle;
  soundStyle: SoundStyle;
  qrStyle: QrStyle;
  portraitZoom: 100 | 110 | 120 | 130 | 140;
  portraitNameSize: "compact" | "standard" | "large" | "statement";
  portraitShowUsername: boolean;
};

export const PORTRAIT_ZOOMS = [100, 110, 120, 130, 140] as const;
export const PORTRAIT_NAME_SIZES = ["compact", "standard", "large", "statement"] as const;

const includes = <T extends string | number>(list: readonly T[], value: unknown): value is T => (list as readonly unknown[]).includes(value);

export function isModeLayout<S extends ModeSlug>(slug: S, layout: unknown): layout is ModeLayout<S> {
  return includes(MODE_LAYOUTS[slug] as readonly string[], layout);
}

/** The family a stored layout belongs to (unknown values count as the Mode's Cover). */
export function layoutFamily(slug: ModeSlug, layout: unknown): LayoutFamily {
  if (includes(SHARED_LAYOUTS, layout)) return layout;
  return FAMILY_LAYOUTS[slug]?.framed === layout ? "framed" : "cover";
}

/** The stored layout id for a family in a Mode. */
export function layoutForFamily(slug: ModeSlug, family: LayoutFamily): ModeLayout {
  return family === "cover" || family === "framed" ? FAMILY_LAYOUTS[slug][family] : family;
}

/** Which capability each appearance field needs above Free, for a given saved value. */
export function capabilityForField(field: keyof ModeAppearance, value: unknown): CapabilityKey | null {
  switch (field) {
    case "theme": return includes(FREE_THEMES, value) || value === undefined ? null : "appearance.premium";
    case "layout": return includes(SHARED_LAYOUTS, value) ? "appearance.premium" : null;
    case "portraitZoom": case "portraitNameSize": case "portraitShowUsername": return value === undefined ? null : "appearance.premium";
    case "imageTreatment": return value === "frame" ? "appearance.premium" : null;
    case "intensity": return value === undefined || value === "balanced" ? null : "appearance.advanced_controls";
    case "card": case "radius": case "button": case "links": return value === undefined ? null : "appearance.advanced_controls";
    case "soundStyle": return value === undefined || value === "core" ? null : "soundtrack.premium_treatment";
    case "qrStyle": return value === undefined || value === "standard" ? null : "share.qr_premium";
    default: return null;
  }
}

export const PREMIUM_FIELDS = ["theme", "layout", "portraitZoom", "portraitNameSize", "portraitShowUsername", "imageTreatment", "intensity", "card", "radius", "button", "links", "soundStyle", "qrStyle"] as const;
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

/**
 * The single place a Mode's look is decided. Each value is resolved against the Mode's own
 * options and defaults, so one Mode can never pick up another Mode's layout or treatment.
 * Premium values stay in storage; without the capability the Free equivalent renders.
 */
export function resolveAppearance(mode: Pick<ProfileMode, "slug" | "appearance">, plan: PlanCode = "free"): ResolvedAppearance {
  const defaults = MODE_DEFAULTS[mode.slug];
  if (!defaults) throw new Error(`Unknown Mode: ${String(mode.slug)}`);
  const saved: Partial<ModeAppearance> = mode.appearance ?? {};
  const allowed = (field: PremiumField) => {
    const capability = capabilityForField(field, saved[field]);
    return capability === null || hasCapability(plan, capability);
  };

  const savedTheme: ThemeId = includes(THEMES, saved.theme) ? saved.theme : defaults.theme;
  const effectiveTheme = allowed("theme") ? savedTheme : FREE_THEME_FALLBACK[savedTheme];
  const theme = saved.layout === "full-portrait" && allowed("layout") ? "dark" : effectiveTheme;
  const themeDefaults = THEME_DEFAULTS[theme];

  let family: LayoutFamily = isModeLayout(mode.slug, saved.layout) ? layoutFamily(mode.slug, saved.layout) : layoutFamily(mode.slug, defaults.layout);
  // A premium layout falls back to the Mode's own composition: Index is the framed one.
  if (!allowed("layout")) family = family === "index" ? "framed" : "cover";
  if (!THEME_LAYOUTS[theme].includes(family)) family = themeDefaults.layout;

  const savedImage: ImageTreatment = includes(IMAGE_TREATMENTS, saved.imageTreatment) ? saved.imageTreatment : defaults.imageTreatment;
  const pick = <T extends string>(field: PremiumField, list: readonly T[], fallback: T): T => {
    const value = saved[field as keyof ModeAppearance];
    return includes(list, value) && allowed(field) ? value : fallback;
  };

  // Editorial is print: it locks Sharp corners.
  const radius = theme === "editorial" ? "sharp" : pick("radius", RADII, themeDefaults.radius);
  return {
    slug: mode.slug,
    theme,
    layout: layoutForFamily(mode.slug, family),
    family,
    imageTreatment: allowed("imageTreatment") ? savedImage : "portrait",
    accent: resolveModeAccent(mode),
    intensity: pick("intensity", INTENSITIES, "balanced"),
    card: pick("card", CARD_STYLES, themeDefaults.card),
    radius,
    button: pick("button", BUTTON_STYLES, themeDefaults.button),
    links: pick("links", LINK_STYLES, themeDefaults.links),
    soundStyle: pick("soundStyle", SOUND_STYLES, "core"),
    qrStyle: pick("qrStyle", QR_STYLES, "standard"),
    portraitZoom: includes(PORTRAIT_ZOOMS, saved.portraitZoom) && allowed("portraitZoom") ? saved.portraitZoom : 100,
    portraitNameSize: includes(PORTRAIT_NAME_SIZES, saved.portraitNameSize) && allowed("portraitNameSize") ? saved.portraitNameSize : "standard",
    portraitShowUsername: typeof saved.portraitShowUsername === "boolean" && allowed("portraitShowUsername") ? saved.portraitShowUsername : true,
  };
}

/** Whether a saved appearance is valid as-is for its Mode (what the database accepts). */
export function isValidAppearance(slug: ModeSlug, appearance: ModeAppearance) {
  const known = new Set(["theme", "accent", "layout", "imageTreatment", "qrStyle", "intensity", "card", "radius", "button", "links", "soundStyle", "portraitZoom", "portraitNameSize", "portraitShowUsername"]);
  const optional = (value: unknown, list: readonly string[]) => value === undefined || includes(list, value);
  return Object.keys(appearance).every((key) => known.has(key))
    && includes(THEMES, appearance.theme)
    && HEX_COLOR.test(appearance.accent)
    && isModeLayout(slug, appearance.layout)
    && includes(IMAGE_TREATMENTS, appearance.imageTreatment)
    && optional(appearance.qrStyle, QR_STYLES)
    && optional(appearance.intensity, INTENSITIES)
    && optional(appearance.card, CARD_STYLES)
    && optional(appearance.radius, RADII)
    && optional(appearance.button, BUTTON_STYLES)
    && optional(appearance.links, LINK_STYLES)
    && optional(appearance.soundStyle, SOUND_STYLES)
    && (appearance.portraitZoom === undefined || (PORTRAIT_ZOOMS as readonly unknown[]).includes(appearance.portraitZoom))
    && optional(appearance.portraitNameSize, PORTRAIT_NAME_SIZES)
    && (appearance.portraitShowUsername === undefined || typeof appearance.portraitShowUsername === "boolean");
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

/** A filled control whose colour sits this close to the page gains an edge so it stays visible (presets like coral on paper do not). */
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

/** Mix a hex colour over another at `amount` (0–1), for tints such as the Signal page. */
export function mixHex(base: string, over: string, amount: number): string {
  const parse = (hex: string) => [0, 2, 4].map((index) => parseInt((HEX_COLOR.exec(hex)?.[0].slice(1) ?? "000000").slice(index, index + 2), 16));
  const [b, o] = [parse(base), parse(over)];
  return `#${b.map((channel, index) => Math.round(channel + (o[index] - channel) * amount).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
