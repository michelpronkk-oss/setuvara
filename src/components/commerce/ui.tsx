import type { ReactNode } from "react";

import { formatAmount, SELLER_STATE_COPY, type SellerState } from "@/lib/commerce/model";
import { Mono } from "@/components/creator/studio-ui";

const TONE = {
  ink: "bg-[#0D0D0D] text-[#F5F4EF]",
  good: "bg-[#C7FF4A] text-[#0D0D0D]",
  wait: "bg-[#E6DCFF] text-[#0D0D0D]",
  warn: "bg-[#FFE7B8] text-[#0D0D0D]",
  bad: "bg-[#FF5A4F] text-[#0D0D0D]",
} as const;

export function StateBadge({ state, className = "" }: { state: SellerState; className?: string }) {
  const copy = SELLER_STATE_COPY[state];
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 font-label text-[11px] uppercase tracking-[0.14em] ${TONE[copy.tone]} ${className}`} data-seller-state={state}>{copy.label}</span>;
}

export function TestModeTag() {
  return <span className="inline-flex shrink-0 items-center rounded-md bg-[#FFE7B8] px-2 py-1 font-label text-[10px] uppercase tracking-[0.14em] text-[#0D0D0D]" title="Stripe sandbox: no real money moves">Test mode</span>;
}

/** One money figure with its label and a short note. Currencies are never mixed. */
export function MoneyStat({ label, amount, currency, note, strong = false, negative = false }: { label: string; amount: number; currency: string; note?: ReactNode; strong?: boolean; negative?: boolean }) {
  return (
    <div className="min-w-0">
      <Mono className="text-black/55">{label}</Mono>
      <p className={`mt-1.5 font-display font-bold leading-none tracking-[-0.05em] tabular-nums ${strong ? "text-[40px] md:text-[48px]" : "text-[26px] md:text-[30px]"}`}>{negative && amount > 0 ? "−" : ""}{formatAmount(Math.abs(amount), currency)}</p>
      {note && <p className="mt-1.5 text-[13px] leading-snug text-black/55">{note}</p>}
    </div>
  );
}

export function Panel({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[26px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] md:p-7 ${className}`}>
      {(title || action) && <div className="mb-4 flex items-center justify-between gap-3">{title && <h2 className="text-[17px] font-semibold">{title}</h2>}{action}</div>}
      {children}
    </section>
  );
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function shortDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** A new random key per click-intent, for idempotent POSTs. */
export function intentKey() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
