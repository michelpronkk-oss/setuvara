import * as Flags from "country-flag-icons/react/3x2";
import type { ComponentType, SVGProps } from "react";

const FLAGS = Flags as unknown as Record<string, ComponentType<SVGProps<SVGSVGElement> & { title?: string }>>;
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string | null) {
  if (!code) return "Unknown";
  try { return regionNames.of(code) ?? code; } catch { return code; }
}

/** A country flag drawn as inline SVG, so it looks the same on every system (emoji flags don't on Windows). */
export function CountryFlag({ code, size = "sm" }: { code: string | null; size?: "sm" | "lg" }) {
  const Flag = code ? FLAGS[code] : undefined;
  const frame = `inline-block shrink-0 overflow-hidden shadow-[0_0_0_1px_rgba(13,13,13,.14)] ${size === "lg" ? "h-[22px] w-[33px] rounded-[5px] sm:h-[26px] sm:w-[39px]" : "h-[15px] w-[22px] rounded-[3px]"}`;
  if (!Flag) return <span aria-hidden="true" className={`${frame} bg-ink/[0.08]`} />;
  return <Flag aria-hidden="true" className={frame} />;
}
