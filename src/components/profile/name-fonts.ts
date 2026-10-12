import { Kanit, Manrope, Nunito, Oswald, Playfair_Display } from "next/font/google";

/**
 * Faces for the curated name styles (see name-type.ts), self-hosted by next/font at build time:
 * no runtime requests to Google, no uploads, no member-supplied URLs. Each is one weight and is
 * never preloaded, so a face downloads only on a page whose name actually wears it. Every subset
 * a face has is declared (with unicode-range), so diacritics and Cyrillic, Greek, Thai or
 * Vietnamese names use the face where it covers them and the system fallback where it doesn't.
 */
const modern = Manrope({ subsets: ["latin"], variable: "--font-name-modern", display: "swap", weight: "700", preload: false });
const editorial = Playfair_Display({ subsets: ["latin"], variable: "--font-name-editorial", display: "swap", weight: "500", preload: false });
const condensed = Oswald({ subsets: ["latin"], variable: "--font-name-condensed", display: "swap", weight: "600", preload: false });
const impact = Kanit({ subsets: ["latin"], variable: "--font-name-impact", display: "swap", weight: "800", style: "italic", preload: false });
const soft = Nunito({ subsets: ["latin"], variable: "--font-name-soft", display: "swap", weight: "800", preload: false });

/** Put on any surface that renders a profile (public page, editor, app). */
export const nameFontClasses = [modern, editorial, condensed, impact, soft].map((font) => font.variable).join(" ");
