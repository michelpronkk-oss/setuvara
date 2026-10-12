import type { CSSProperties } from "react";

/**
 * Name type: a curated set of display styles for the identity name only (the hero heading and
 * Motion's marquee). Body copy, buttons and system UI keep the brand fonts.
 *
 * Stored per Mode as appearance.nameFont (an id, never a font name, URL or CSS). The faces are
 * self-hosted through next/font in name-fonts.ts and exposed as CSS variables; this module is
 * pure data so the renderer stays free of font loading. Every stack ends in system families so
 * scripts a face lacks (CJK, Arabic, Devanagari…) fall back per glyph instead of to boxes.
 */

export const NAME_FONTS = ["setuvara", "modern", "editorial", "condensed", "impact", "soft"] as const;
export type NameFont = (typeof NAME_FONTS)[number];
/** Free keeps the signature and one clean alternative. Mirrors the database trigger. */
export const FREE_NAME_FONTS: readonly NameFont[] = ["setuvara", "modern"];

export const NAME_FONT_NAMES: Record<NameFont, string> = {
  setuvara: "Setuvara", modern: "Modern", editorial: "Editorial", condensed: "Condensed", impact: "Impact", soft: "Soft",
};

const SANS = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Noto Sans", Arial, sans-serif`;
const SERIF = `ui-serif, Georgia, "Noto Serif", "Times New Roman", serif`;

export type NameType = {
  family: string;
  weight: number;
  italic: boolean;
  uppercase: boolean;
  /** Letter spacing in em. */
  tracking: number;
  /** Line height for multi-line names. */
  leading: number;
  /**
   * Average glyph advance in em, for fitting a name to the width (and the face-safe solver).
   * Measured on rendered names against the signature's 0.55; condensed capitals are about as wide
   * per glyph as the lowercase grotesques, so the condensed look comes from height, not fit.
   */
  charWidth: number;
  /** Optical size against the Appearance's base: condensed faces can run larger, wide ones smaller. */
  scale: number;
};

/** The named styles. "setuvara" is resolved per Appearance by nameType(). */
const STYLES: Record<Exclude<NameFont, "setuvara">, NameType> = {
  // Clean geometric sans: calm, precise, close to the product's own voice.
  modern: { family: `var(--font-name-modern), ${SANS}`, weight: 700, italic: false, uppercase: false, tracking: -0.035, leading: 0.98, charWidth: 0.55, scale: 0.96 },
  // High-contrast display serif: luxury, editorial covers.
  editorial: { family: `var(--font-name-editorial), ${SERIF}`, weight: 500, italic: false, uppercase: false, tracking: -0.02, leading: 1, charWidth: 0.53, scale: 1.04 },
  // Bold condensed capitals: poster and event energy.
  condensed: { family: `var(--font-name-condensed), "Arial Narrow", ${SANS}`, weight: 600, italic: false, uppercase: true, tracking: 0, leading: 0.98, charWidth: 0.535, scale: 1.06 },
  // Heavy italic: loud, fast, creator.
  impact: { family: `var(--font-name-impact), ${SANS}`, weight: 800, italic: true, uppercase: false, tracking: -0.03, leading: 0.98, charWidth: 0.56, scale: 0.98 },
  // Rounded humanist: warm and friendly.
  soft: { family: `var(--font-name-soft), ${SANS}`, weight: 800, italic: false, uppercase: false, tracking: -0.025, leading: 0.98, charWidth: 0.555, scale: 1 },
};

/** The Appearance's own signature (Bricolage, or Film's italic serif): what every name wore before. */
function signature(identity: { serif: boolean; weight: number }, charWidth: number): NameType {
  return identity.serif
    ? { family: `var(--font-instrument-serif), "Instrument Serif", ${SERIF}`, weight: identity.weight, italic: true, uppercase: false, tracking: -0.01, leading: 0.94, charWidth: charWidth || 0.42, scale: 1 }
    : { family: `var(--font-bricolage), ${SANS}`, weight: identity.weight, italic: false, uppercase: false, tracking: -0.045, leading: 0.94, charWidth: charWidth || 0.55, scale: 1 };
}

export const isNameFont = (value: unknown): value is NameFont => (NAME_FONTS as readonly unknown[]).includes(value);
export const isFreeNameFont = (font: NameFont) => FREE_NAME_FONTS.includes(font);

/** The type a name wears for a look: the chosen style, or the Appearance's own for "setuvara". */
export function nameType(font: NameFont, identity: { serif: boolean; weight: number }, charWidth = 0.55): NameType {
  return font === "setuvara" ? signature(identity, charWidth) : STYLES[font];
}

/**
 * Inline style for a name element. Italic faces get a little right padding so the last glyph's
 * overhang is never clipped by an overflow-hidden parent.
 */
export function nameTypeStyle(type: NameType): CSSProperties {
  return {
    fontFamily: type.family,
    fontWeight: type.weight,
    fontStyle: type.italic ? "italic" : "normal",
    textTransform: type.uppercase ? "uppercase" : undefined,
    letterSpacing: `${type.tracking}em`,
    lineHeight: type.leading,
    paddingRight: type.italic ? "0.06em" : undefined,
  };
}
