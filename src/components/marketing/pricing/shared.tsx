import type { ReactNode } from "react";

import { MemberBadge } from "@/components/app/status-badge";

/** Pricing page building blocks. Colours follow the Signal Coral / champagne system. */

export const SECTION = "mx-auto flex w-full max-w-[1440px] flex-col px-5 sm:px-8 lg:px-14";
export const SECTION_PAD = "py-[clamp(64px,8vw,120px)]";

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-label text-[11px] uppercase tracking-[0.14em] ${className}`}>{children}</span>;
}

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-[9px] py-[5px] font-label text-[10px] uppercase leading-none tracking-[0.14em] ${className}`}>{children}</span>;
}

export function SoonPill({ dark = false, children = "Coming soon" }: { dark?: boolean; children?: ReactNode }) {
  return <Pill className={dark ? "shadow-[inset_0_0_0_1px_rgba(245,244,239,.3)] text-paper/70" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.3)] text-ink/65"}>{children}</Pill>;
}

export function H2({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <h2 className={`m-0 font-display text-[clamp(36px,4.4vw,68px)] font-extrabold leading-[0.94] tracking-[-0.05em] ${className}`} id={id}>{children}</h2>;
}

export function Lede({ children, className = "" }: { children: ReactNode; className?: string }) {
  const tone = /\btext-(paper|ink)\//.test(className) ? "" : "text-ink/70 ";
  return <p className={`m-0 max-w-[440px] text-[clamp(15px,1.15vw,17px)] leading-[1.5] ${tone}[text-wrap:pretty] ${className}`}>{children}</p>;
}

/** Two-column section head: heading left, lede right, bottom aligned. */
export function SectionHead({ children, lede }: { children: ReactNode; lede: ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1fr)] items-end gap-x-16 gap-y-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">{children}{lede}</div>;
}

export function Check({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={`mt-[3px] size-4 shrink-0 ${className}`} viewBox="0 0 16 16">
      <path d="M3 8.5L6.5 12L13 4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

/** Plus badge drawn in ink, for use on a coral surface where the coral badge would vanish. */
export function PlusInkBadge({ size }: { size: number }) {
  return (
    <svg aria-hidden="true" className="inline-block shrink-0" height={size} viewBox="0 0 100 100" width={size}>
      <polygon fill="#0D0D0D" points="50,4 59.71,13.78 73,10.16 76.52,23.48 89.84,27 86.22,40.29 96,50 86.22,59.71 89.84,73 76.52,76.52 73,89.84 59.71,86.22 50,96 40.29,86.22 27,89.84 23.48,76.52 10.16,73 13.78,59.71 4,50 13.78,40.29 10.16,27 23.48,23.48 27,10.16 40.29,13.78" stroke="#0D0D0D" strokeLinejoin="round" strokeWidth={4} />
      <path d="M31 51L44 63L69 37" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth={10} />
    </svg>
  );
}

/** A name with its member badge sitting on the cap height, the way profiles render it. */
export function BadgedName({ name, tier, size, className = "" }: { name: string; tier: "plus" | "pro"; size: number; className?: string }) {
  return (
    <span className={`whitespace-nowrap ${className}`}>
      {name}
      <span className="ml-[0.24em] inline-block" style={{ verticalAlign: `calc(.36em - ${size / 2}px)` }}><MemberBadge className="block" decorative size={size} tier={tier} /></span>
    </span>
  );
}

