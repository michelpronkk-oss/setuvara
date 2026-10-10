import type { ModeAppearance, ModeSlug, ProfileMode } from "./types";

const DEFAULT_MODE_ACCENT = "#FF5A4F";
const HEX_COLOR = /^#[\da-f]{6}$/i;

/** Layouts each Mode may use. Mirrors the profile_modes appearance check constraint. */
export const MODE_LAYOUTS = {
  personal: ["full-bleed", "portrait-editorial"],
  event: ["event-poster", "conference-card"],
  business: ["structured", "editorial-business"],
} as const satisfies Record<ModeSlug, readonly string[]>;

export type ModeLayout<S extends ModeSlug = ModeSlug> = (typeof MODE_LAYOUTS)[S][number];

export const MODE_THEMES = ["light", "dark", "editorial"] as const satisfies readonly ModeAppearance["theme"][];
export const IMAGE_TREATMENTS = ["full-bleed", "portrait", "compact"] as const satisfies readonly ModeAppearance["imageTreatment"][];

/** What each Mode falls back to when a saved value is missing or not one of its own. */
const MODE_DEFAULTS: { [S in ModeSlug]: { theme: ModeAppearance["theme"]; layout: ModeLayout<S>; imageTreatment: ModeAppearance["imageTreatment"] } } = {
  personal: { theme: "dark", layout: "full-bleed", imageTreatment: "portrait" },
  event: { theme: "light", layout: "event-poster", imageTreatment: "portrait" },
  business: { theme: "light", layout: "structured", imageTreatment: "portrait" },
};

/** A Mode's appearance with every value checked against that Mode's own options. */
export type ResolvedAppearance = {
  slug: ModeSlug;
  theme: ModeAppearance["theme"];
  layout: ModeLayout;
  imageTreatment: ModeAppearance["imageTreatment"];
  accent: string;
};

export function isModeLayout<S extends ModeSlug>(slug: S, layout: unknown): layout is ModeLayout<S> {
  return (MODE_LAYOUTS[slug] as readonly unknown[]).includes(layout);
}

/**
 * The single place a Mode's look is decided. Each value is resolved against the Mode's own
 * options and defaults, so one Mode can never pick up another Mode's layout or treatment.
 */
export function resolveAppearance(mode: Pick<ProfileMode, "slug" | "appearance">): ResolvedAppearance {
  const defaults = MODE_DEFAULTS[mode.slug];
  if (!defaults) throw new Error(`Unknown Mode: ${String(mode.slug)}`);
  const saved: Partial<ModeAppearance> = mode.appearance ?? {};
  return {
    slug: mode.slug,
    theme: (MODE_THEMES as readonly unknown[]).includes(saved.theme) ? saved.theme! : defaults.theme,
    layout: isModeLayout(mode.slug, saved.layout) ? saved.layout : defaults.layout,
    imageTreatment: (IMAGE_TREATMENTS as readonly unknown[]).includes(saved.imageTreatment) ? saved.imageTreatment! : defaults.imageTreatment,
    accent: resolveModeAccent(mode),
  };
}

/** Whether a saved appearance is valid as-is for its Mode (what the database accepts). */
export function isValidAppearance(slug: ModeSlug, appearance: ModeAppearance) {
  return (MODE_THEMES as readonly unknown[]).includes(appearance.theme)
    && HEX_COLOR.test(appearance.accent)
    && isModeLayout(slug, appearance.layout)
    && (IMAGE_TREATMENTS as readonly unknown[]).includes(appearance.imageTreatment);
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

/** Readable ink on a validated Mode accent. */
export function inkOnAccent(hex: string): string {
  return accentLuminance(hex) > 0.42 ? "#0D0D0D" : "#F5F4EF";
}
