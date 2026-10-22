import type { ReactNode } from "react";

import { PLATFORM_BG } from "@/lib/creator/studio";
import { linkProviderById } from "@/lib/links/providers";

/** A Creator studio page: the design's 1440 grid with 32px gutters, one column on phones. */
export function StudioPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  // A page that names its own width gets it; two max-w classes would leave the winner to stylesheet order.
  const width = /(^|\s)max-w-/.test(className) ? "" : "max-w-[1520px]";
  return <main className={`mx-auto w-full ${width} px-3.5 pt-5 md:px-8 md:pt-7 ${className}`}>{children}</main>;
}

export function StudioHead({ title, sub, action, className = "" }: { title: string; sub?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={`mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-6 ${className}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-[40px] font-bold leading-[0.95] tracking-[-0.05em] md:text-[52px]">{title}</h1>
        {sub && <p className="text-[15px] text-black/65 md:text-base">{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function Mono({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <p className={`font-label text-[11px] uppercase tracking-[0.16em] ${className}`} style={style}>{children}</p>;
}

/** The design's quiet "not live yet" marker. */
export function ConceptTag({ children = "Concept" }: { children?: ReactNode }) {
  return <span className="inline-flex shrink-0 items-center rounded-md px-2 py-1 font-label text-[10px] uppercase tracking-[0.14em] shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.4)]">{children}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[26px] bg-white p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] md:p-9">
      <h2 className="font-display text-[26px] font-bold leading-tight tracking-[-0.04em] md:text-[32px]">{title}</h2>
      <p className="max-w-[46ch] text-[15px] leading-[1.5] text-black/70">{body}</p>
      {action}
    </div>
  );
}

export const inkButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0D0D0D] px-[18px] text-[15px] font-semibold text-[#F5F4EF] transition hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-45";
export const coralButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF5A4F] px-[18px] text-[15px] font-semibold text-[#0D0D0D] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-45";
export const lineButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-[18px] text-[15px] font-semibold text-[#0D0D0D] shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] transition hover:bg-black/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-45";

export function FilterPill({ label, count, on, onClick }: { label: string; count?: number; on: boolean; onClick: () => void }) {
  return (
    <button aria-pressed={on} className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold transition focus-visible:outline-2 ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-white text-[#0D0D0D] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] hover:bg-black/[0.03]"}`} onClick={onClick} type="button">
      {label}{count !== undefined && <span className={`font-label text-[11px] ${on ? "text-white/70" : "text-black/50"}`}>{count}</span>}
    </button>
  );
}

/** A platform's mark on its brand tile, from the shared link providers. */
export function PlatformTile({ type, size = 40, className = "" }: { type: string; size?: number; className?: string }) {
  const provider = linkProviderById[type as keyof typeof linkProviderById];
  const background = (PLATFORM_BG as Record<string, string>)[type] ?? (provider?.icon ? `#${provider.icon.hex}` : "#0D0D0D");
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center text-white ${className}`} style={{ width: size, height: size, borderRadius: size * 0.28, background }}>
      {provider?.icon && <svg fill="currentColor" style={{ width: size * 0.48, height: size * 0.48 }} viewBox="0 0 24 24"><path d={provider.icon.path} /></svg>}
    </span>
  );
}
