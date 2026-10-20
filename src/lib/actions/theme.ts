import type { CSSProperties } from "react";

import { inkOnAccent, resolveAppearance, type MotionLevel } from "@/components/profile/appearance";
import { appearanceTheme } from "@/components/profile/appearance-theme";
import { nameType, nameTypeStyle } from "@/components/profile/name-type";
import type { ProfileMode } from "@/components/profile/types";
import type { PlanCode } from "@/lib/billing/catalog";

/**
 * An Action's page and success moment wear the Mode's Appearance: its base, ink, accent, the
 * Connect button's treatment and the name's typeface. Pure, so the editor previews it exactly.
 */
export type ActionTheme = {
  light: boolean;
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  onAccent: string;
  /** The submit button: the Appearance's Connect treatment. */
  button: { bg: string; fg: string; edge: string; shadow: string };
  radius: number;
  grain: boolean;
  motion: MotionLevel;
  heading: CSSProperties;
};

export function actionTheme(mode: Pick<ProfileMode, "slug" | "appearance">, plan: PlanCode = "free", hasPhoto = true): ActionTheme {
  const look = resolveAppearance(mode, plan);
  const theme = appearanceTheme(look.id, look.accent, hasPhoto);
  const connect = theme.connect;
  // A transparent Connect (Film) reads as a line on the page; everything else is a filled pill.
  const button = connect.bg === "transparent"
    ? { bg: "transparent", fg: theme.fg, edge: connect.edge, shadow: "none" }
    : { bg: connect.bg, fg: connect.fg, edge: connect.edge === "none" ? "none" : connect.edge, shadow: connect.shadow ?? "none" };
  return {
    light: theme.light,
    bg: theme.base,
    fg: theme.fg,
    muted: theme.muted,
    accent: look.accent,
    onAccent: inkOnAccent(look.accent),
    button,
    radius: theme.radius,
    grain: theme.grain,
    motion: look.motion,
    heading: nameTypeStyle(nameType(look.nameFont, theme.identity, theme.name.charWidth)),
  };
}

/** The theme as CSS custom properties, set once on the page or preview root. */
export function actionThemeVars(theme: ActionTheme): CSSProperties {
  return {
    "--av-bg": theme.bg,
    "--av-fg": theme.fg,
    "--av-muted": theme.muted,
    "--av-line": `color-mix(in srgb, ${theme.fg} 14%, transparent)`,
    "--av-field": theme.light ? "#FFFFFF" : `color-mix(in srgb, ${theme.fg} 7%, transparent)`,
    "--av-field-edge": `color-mix(in srgb, ${theme.fg} ${theme.light ? 12 : 18}%, transparent)`,
    "--av-panel": theme.light ? "#FFFFFF" : `color-mix(in srgb, ${theme.fg} 6%, transparent)`,
    "--av-accent": theme.accent,
    "--av-on-accent": theme.onAccent,
    "--av-btn-bg": theme.button.bg,
    "--av-btn-fg": theme.button.fg,
    "--av-btn-ring": [theme.button.edge, theme.button.shadow].filter((value) => value && value !== "none").join(", ") || "none",
    "--av-error": theme.light ? "#B42318" : "#FF8A80",
    background: theme.bg,
    color: theme.fg,
    colorScheme: theme.light ? "light" : "dark",
  } as CSSProperties;
}
