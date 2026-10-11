import type { CSSProperties } from "react";

import { CONNECT_EDGE_CONTRAST, contrastRatio, inkOnAccent, mixHex, type ResolvedAppearance, type ThemeId } from "./appearance";

/**
 * Theme tokens from the approved Appearance design (ProfilePreview reference renderer), resolved
 * once per render. Every surface in the profile reads from here, so the editor preview and the
 * public profile can never drift apart.
 */

export const INK = "#0D0D0D";
export const PAPER = "#F5F4EF";
export const CHAMPAGNE = "#D6B25E";

type Palette = { page: string; fg: string; muted: string; surface: string; border: string };

const PALETTES: Record<ThemeId, Palette> = {
  light: { page: PAPER, fg: INK, muted: "#0D0D0DB3", surface: "#FFFFFF", border: "#0D0D0D1F" },
  dark: { page: INK, fg: PAPER, muted: "#F5F4EFB3", surface: "#1A1A1A", border: "#F5F4EF26" },
  editorial: { page: PAPER, fg: INK, muted: "#0D0D0DB3", surface: "transparent", border: "#0D0D0D33" },
  noir: { page: INK, fg: PAPER, muted: "#F5F4EFB3", surface: "#1A1A1A", border: "#D6B25E59" },
  signal: { page: PAPER, fg: INK, muted: "#0D0D0DB3", surface: PAPER, border: "#0D0D0D1F" },
  studio: { page: "#FFFFFF", fg: INK, muted: "#0D0D0DA6", surface: PAPER, border: "#0D0D0D1A" },
};

const RADIUS_PX = { sharp: 4, subtle: 12, soft: 22 } as const;
/** Name weights per theme (Noir is lighter, Studio is the quiet 600). */
const DISPLAY_WEIGHT: Record<ThemeId, number> = { light: 800, dark: 800, editorial: 800, noir: 700, signal: 800, studio: 600 };

type Paint = { background: string; color: string };

export type Skin = {
  theme: ThemeId;
  dark: boolean;
  page: string;
  fg: string;
  muted: string;
  surface: string;
  border: string;
  accent: string;
  /** Text on the accent: ink above luminance .42, else paper. */
  onAccent: string;
  radius: number;
  displayWeight: number;
  /** About card, link cards and other content surfaces. */
  card: { style: CSSProperties; color: string; muted: string; edge: string };
  /** Primary Connect (and the owner's Share). Never Minimal, never low contrast. */
  connect: Paint & { edge: string };
  secondary: { edge: string; underline: boolean; color: string };
  button: { radius: string; height: number; secondaryHeight: number; arrow: boolean };
  icon: Paint & { edge: string };
  chip: Paint;
  eventCard: Paint & { muted: string };
  poster: Paint & { filled: boolean };
  /** Row rules in list links (Noir: champagne). */
  rule: string;
  links: ResolvedAppearance["links"];
  image: { radius: string; frame: string };
  strip: Paint;
  artRadius: number;
  /** CSS variables the Connect trigger (rendered by the page) reads. */
  connectVars: CSSProperties;
};

export function resolveSkin(look: ResolvedAppearance): Skin {
  const { theme, intensity, accent } = look;
  const onAccent = inkOnAccent(accent);
  let { page, fg, muted, border } = PALETTES[theme];
  const { surface } = PALETTES[theme];
  // Signal: the accent becomes the room. A tint of paper at Quiet/Balanced, the accent itself at Signal.
  const accentRoom = theme === "signal" && intensity === "signal";
  if (theme === "signal") {
    if (accentRoom) {
      page = accent;
      fg = onAccent;
      muted = onAccent === INK ? "#0D0D0DB3" : "#F5F4EFCC";
      border = onAccent === INK ? "#0D0D0D26" : "#F5F4EF33";
    } else {
      page = mixHex(PAPER, accent, intensity === "quiet" ? 0.12 : 0.26);
    }
  }
  const dark = theme === "dark" || theme === "noir" || (accentRoom && onAccent !== INK);
  const radius = theme === "editorial" ? 0 : RADIUS_PX[look.radius];
  const cardRadius = `${radius}px`;

  // Content cards. Signal keeps paper cards; Noir outlines in champagne.
  const cardColor = theme === "signal" ? INK : fg;
  const cardMuted = theme === "signal" ? "#0D0D0DB3" : muted;
  const cards: Record<ResolvedAppearance["card"], CSSProperties> = {
    flat: { background: "transparent", boxShadow: "none", borderRadius: cardRadius, padding: 0 },
    outline: { background: "transparent", boxShadow: `inset 0 0 0 1px ${theme === "noir" ? "#D6B25E59" : border}`, borderRadius: cardRadius, padding: "16px 18px" },
    soft: { background: theme === "signal" ? PAPER : surface, borderRadius: cardRadius, padding: "16px 18px" },
    layered: { background: theme === "signal" ? PAPER : surface, boxShadow: dark ? "0 14px 30px -18px #000000" : "0 14px 30px -20px #0D0D0D66", borderRadius: cardRadius, padding: "16px 18px" },
    editorial: { background: "transparent", borderTop: `1.5px solid ${fg}`, borderRadius: cardRadius, padding: "12px 0 0" },
  };
  const card = { ...cards[look.card] };
  if (theme === "signal" && look.card !== "soft" && look.card !== "layered") card.background = PAPER;
  const cardEdge = typeof card.boxShadow === "string" && card.boxShadow !== "none" ? card.boxShadow : `inset 0 0 0 1px ${border}`;

  const buttonRadius = look.button === "pill" || look.button === "minimal" ? "999px" : look.button === "editorial" ? "0px" : `${Math.min(radius, 14)}px`;
  const height = look.button === "pill" || look.button === "minimal" ? 52 : 56;

  const quietConnect = intensity === "quiet" || accentRoom;
  const connectFill = quietConnect ? { background: fg, color: page } : { background: accent, color: onAccent };
  // A custom accent too close to the page keeps its fill and gains an edge; we never swap the colour.
  const connectEdge = contrastRatio(connectFill.background, page) < CONNECT_EDGE_CONTRAST ? `inset 0 0 0 1.5px ${fg}` : "none";

  const signalIcons = intensity === "signal";
  const detail = theme === "noir" ? CHAMPAGNE : theme === "signal" ? INK : border;
  const frame = look.imageTreatment !== "frame" ? "none"
    : theme === "signal" ? `10px 10px 0 0 ${accentRoom ? INK : accent}`
      : `0 0 0 5px ${page}, 0 0 0 6px ${detail}`;
  const imageRadius = look.imageTreatment === "full-bleed" ? "0px" : look.imageTreatment === "compact" ? "50%" : cardRadius;

  const accentEvent = intensity === "signal" && theme !== "signal";
  const posterFilled = intensity !== "quiet";

  return {
    theme,
    dark,
    page,
    fg,
    muted,
    surface,
    border,
    accent,
    onAccent,
    radius,
    displayWeight: DISPLAY_WEIGHT[theme],
    card: { style: card, color: cardColor, muted: cardMuted, edge: cardEdge },
    connect: { ...connectFill, edge: connectEdge },
    secondary: {
      edge: look.button === "minimal" ? "none" : `inset 0 0 0 1.5px ${theme === "noir" ? "#D6B25E8C" : `${fg}40`}`,
      underline: look.button === "minimal",
      color: fg,
    },
    button: { radius: buttonRadius, height, secondaryHeight: look.button === "minimal" ? 40 : height - 4, arrow: look.button === "editorial" },
    icon: {
      background: signalIcons ? accent : theme === "signal" ? PAPER : surface === "transparent" ? "#FFFFFF" : surface,
      color: signalIcons ? onAccent : cardColor,
      edge: theme === "noir" ? "inset 0 0 0 1px #D6B25E59" : theme === "editorial" && !signalIcons ? `inset 0 0 0 1px ${border}` : "none",
    },
    chip: {
      background: theme === "signal" ? (accentRoom ? INK : PAPER) : surface === "transparent" ? "#FFFFFF" : surface,
      color: theme === "signal" && accentRoom ? PAPER : cardColor,
    },
    eventCard: {
      background: accentEvent ? accent : theme === "signal" ? PAPER : surface === "transparent" ? "#FFFFFF" : surface,
      color: accentEvent ? onAccent : cardColor,
      muted: accentEvent ? `${onAccent}B3` : cardMuted,
    },
    poster: { filled: posterFilled, background: posterFilled ? accent : "transparent", color: posterFilled ? onAccent : fg },
    rule: theme === "noir" ? "#D6B25E40" : border,
    links: look.links,
    image: { radius: imageRadius, frame },
    strip: { background: dark ? "#1A1A1A" : INK, color: PAPER },
    artRadius: Math.min(radius, 10),
    connectVars: {
      "--sv-connect-fill": connectFill.background,
      "--sv-connect-ink": connectFill.color,
      "--sv-connect-edge": connectEdge,
      "--sv-connect-radius": buttonRadius,
      "--sv-connect-h": `${height}px`,
      "--sv-connect-justify": look.button === "editorial" ? "space-between" : "center",
      "--sv-connect-arrow": look.button === "editorial" ? "\"→\"" : "none",
      "--sv-focus": fg,
    } as CSSProperties,
  };
}
