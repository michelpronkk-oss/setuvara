import * as Flags from "country-flag-icons/react/3x2";
import type { ComponentType, SVGProps } from "react";

const FLAGS = Flags as unknown as Record<string, ComponentType<SVGProps<SVGSVGElement> & { title?: string }>>;
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string | null) {
  if (!code) return "Unknown";
  try { return regionNames.of(code) ?? code; } catch { return code; }
}

/** A country flag drawn as inline SVG, so it looks the same on every system (emoji flags don't on Windows). */
export function CountryFlag({ code }: { code: string | null }) {
  const Flag = code ? FLAGS[code] : undefined;
  const frame = "inline-block h-[14px] w-[21px] shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(13,13,13,.14)]";
  if (!Flag) return <span aria-hidden="true" className={`${frame} bg-ink/[0.08]`} />;
  return <Flag aria-hidden="true" className={frame} />;
}
