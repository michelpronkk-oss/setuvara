import type { ReactNode } from "react";

import { MeetMark } from "@/components/marketing/brand";
import { inkOnAccent, type QrStyle } from "./appearance";

/**
 * QR presentation from the approved Appearance design. Every style only surrounds the code:
 * the modules stay ink on a white field with its quiet zone, the Setuvara mark stays outside
 * the modules, and the encoded destination is whatever the caller passes in, unchanged.
 */
export function QrFrame({ style, accent, name, modeLabel, children, className = "", size = "md" }: {
  style: QrStyle;
  accent: string;
  name: string;
  modeLabel: string;
  children: ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  const field = size === "lg" ? "rounded-[18px] p-4" : "rounded-[14px] p-3";
  if (style === "standard" || style === "accent-frame") {
    return (
      <div className={`rounded-[18px] bg-white ${size === "lg" ? "p-5" : "p-4"} ${className}`} data-qr-treatment={style} style={{ boxShadow: style === "accent-frame" ? `0 0 0 4px ${accent}, 0 0 0 7px #F5F4EF` : "inset 0 0 0 1px #0D0D0D1F" }}>
        {children}
      </div>
    );
  }
  const outer = style === "inverse" ? "#0D0D0D" : accent;
  const ink = style === "inverse" ? "#F5F4EF" : inkOnAccent(accent);
  return (
    <div className={`flex flex-col gap-2.5 ${style === "rounded" ? "rounded-[32px] p-2.5" : "rounded-[22px] p-2"} ${className}`} data-qr-treatment={style} style={{ background: outer }}>
      <div className={`bg-white ${field}`}>{children}</div>
      <div className="flex items-center justify-between gap-2 px-1 pb-1" style={{ color: ink }}>
        <span className="flex min-w-0 items-center gap-1.5 font-display text-[15px] font-extrabold tracking-[-0.02em]"><MeetMark className="size-3.5 shrink-0" /><span className="truncate">{name}</span></span>
        <span className="shrink-0 font-label text-[9px] uppercase tracking-[0.12em]">{modeLabel}</span>
      </div>
    </div>
  );
}
