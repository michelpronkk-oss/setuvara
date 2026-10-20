import type { ReactNode } from "react";

import { PLATFORM_BG } from "@/lib/creator/studio";
import { linkProviderById } from "@/lib/links/providers";

/** A Creator studio page, inside the studio shell: the editor's gutters, one column on phones. */
export function StudioPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto w-full max-w-[1320px] px-4 pt-5 sm:px-6 lg:px-10 lg:pt-10 xl:px-11 ${className}`}>{children}</main>;
}

/** The page title, as in the identity editor. Phones already show it in the studio header. */
export function StudioHead({ title, sub, action, className = "" }: { title: string; sub?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 lg:mb-7 ${sub || action ? "mb-5" : "mb-4"} ${className}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-[2rem] font-extrabold leading-[0.95] tracking-[-0.05em] max-lg:sr-only lg:text-[2.75rem]">{title}</h1>
        {sub && <p className="font-label text-[11px] uppercase tracking-[0.14em] text-black/50 lg:text-[12px]">{sub}</p>}
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
    <div className="relative isolate flex flex-col items-start gap-3 overflow-hidden rounded-[28px] bg-white p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.07),0_24px_50px_-40px_rgba(13,13,13,.45)] md:p-10">
      {/* A quiet Creator glow and three empty cards: the shape of what will fill this space. */}
      <span aria-hidden="true" className="absolute -right-24 -top-28 -z-10 size-[340px] rounded-full bg-[radial-gradient(closest-side,rgba(232,166,255,.38),transparent)]" />
      <span aria-hidden="true" className="absolute bottom-0 right-8 -z-10 hidden translate-y-6 gap-3 md:flex">
        {[0, 1, 2].map((index) => <span className="h-[150px] w-[104px] rounded-t-[18px] bg-[#F5F4EF] shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)]" key={index} style={{ transform: `translateY(${[28, 0, 46][index]}px)` }} />)}
      </span>
      <Mono className="flex items-center gap-2 text-[10px] text-black/50"><span aria-hidden="true" className="size-1.5 rounded-full bg-[#E8A6FF]" />Start here</Mono>
      <h2 className="font-display text-[28px] font-extrabold leading-[1] tracking-[-0.045em] md:max-w-[60%] md:text-[36px]">{title}</h2>
      <p className="max-w-[46ch] text-[15px] leading-[1.5] text-black/65">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export const inkButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0D0D0D] px-[18px] text-[15px] font-semibold text-[#F5F4EF] transition hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-45";
export const coralButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF5A4F] px-[18px] text-[15px] font-semibold text-[#0D0D0D] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-45";
export const lineButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-[18px] text-[15px] font-semibold text-[#0D0D0D] shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] transition hover:bg-black/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-45";

export function FilterPill({ label, count, on, onClick }: { label: string; count?: number; on: boolean; onClick: () => void }) {
  return (
    <button aria-pressed={on} className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition focus-visible:outline-2 ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-white text-[#0D0D0D] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] hover:bg-black/[0.03]"}`} onClick={onClick} type="button">
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
