import type { ProfileMode } from "./types";

const DEFAULT_MODE_ACCENT = "#FF5A4F";
const HEX_COLOR = /^#[\da-f]{6}$/i;

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
