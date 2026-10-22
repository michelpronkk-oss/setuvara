"use client";

import type { CSSProperties } from "react";

import { Favicon, faviconHost } from "@/components/links/provider-mark";

/**
 * A project's mark when no logo was uploaded: its website's own icon on a light tile, or the
 * first letter in the page accent when the site has none.
 */
export function ProjectMark({ name, url, accent, accentInk, size = 48, display }: { name: string; url: string | null; accent: string; accentInk: string; size?: number; display?: CSSProperties }) {
  const letter = <span className="grid size-full place-items-center font-display font-bold" style={{ ...display, background: accent, color: accentInk, fontSize: size * 0.46 }}>{name.slice(0, 1).toUpperCase()}</span>;
  const host = faviconHost(url);
  return (
    <span aria-hidden="true" className="grid shrink-0 place-items-center overflow-hidden rounded-[14px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" data-project-mark={host ? "site" : "letter"} style={{ width: size, height: size }}>
      {host ? <Favicon className="size-[58%]" fallback={letter} host={host} /> : letter}
    </span>
  );
}
