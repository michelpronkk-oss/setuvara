"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

import type { ModeSlug } from "@/components/profile/types";

export const coral = "#FF5A4F";
export const ink = "#0D0D0D";
export const paper = "#F5F4EF";

export const modeMeta: Record<ModeSlug, { name: string; bg: string; fg: string; ring?: string }> = {
  personal: { name: "Personal", bg: ink, fg: paper },
  event: { name: "Event", bg: coral, fg: ink },
  business: { name: "Business", bg: "#FFFFFF", fg: ink, ring: `inset 0 0 0 2px ${ink}` },
};

export function ModeTag({ slug, size = "md" }: { slug: ModeSlug; size?: "sm" | "md" }) {
  const meta = modeMeta[slug];
  return <span className={`inline-flex shrink-0 items-center rounded-full font-semibold ${size === "sm" ? "h-6 px-2.5 text-[11px]" : "h-7 px-3 text-[13px]"}`} style={{ background: meta.bg, color: meta.fg, boxShadow: slug === "business" ? `inset 0 0 0 1.5px ${ink}` : undefined }}>{meta.name} Mode</span>;
}

export function SectionHeader({ title, slug, description, action }: { title: string; slug: ModeSlug; description: string; action?: ReactNode }) {
  return (
    <header className="mb-7">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-display text-[2.4rem] font-extrabold leading-[0.95] tracking-[-0.055em] sm:text-[3.1rem]">{title}</h1>
        <ModeTag slug={slug} />
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <p className="mt-2.5 max-w-xl text-[15px] leading-6 text-black/65">{description}</p>
    </header>
  );
}

export function Field({ label, hint, error, children, htmlFor, className = "" }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label className="text-sm font-semibold" htmlFor={htmlFor}>{label}</label>
        {hint && <span className="text-right text-[13px] text-black/50">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1.5 text-[13px] font-medium text-[#B42318]" role="alert">{error}</p>}
    </div>
  );
}

const inputBase = "w-full rounded-2xl bg-white px-4 text-base text-[#0D0D0D] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] outline-none transition placeholder:text-black/35 focus:shadow-[inset_0_0_0_2px_#0D0D0D] aria-[invalid=true]:shadow-[inset_0_0_0_2px_#B42318]";

export function TextInput({ big = false, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { big?: boolean }) {
  return <input data-display={big ? "" : undefined} className={`${inputBase} ${big ? "min-h-[68px] font-display text-[2rem] font-bold tracking-[-0.045em] sm:text-[2.25rem]" : "min-h-[52px]"} ${className}`} {...props} />;
}

export function TextArea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputBase} min-h-[96px] resize-y py-3.5 leading-6 ${className}`} {...props} />;
}

export function Toggle({ on, onChange, label, disabled = false }: { on: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button aria-checked={on} aria-label={label} className="relative inline-flex h-11 w-[52px] shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled} onClick={() => onChange(!on)} role="switch" type="button">
      <span className="absolute h-[26px] w-[46px] rounded-full transition-colors" style={{ background: on ? ink : "rgba(13,13,13,.2)" }} />
      <span className="absolute size-5 rounded-full bg-white shadow-sm transition-transform" style={{ transform: `translateX(${on ? 10 : -10}px)` }} />
    </button>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label, size = "md", full = false }: { options: { value: T; label: ReactNode; disabled?: boolean }[]; value: T; onChange: (value: T) => void; label: string; size?: "sm" | "md"; full?: boolean }) {
  return (
    <div aria-label={label} className={`${full ? "flex w-full" : "inline-flex"} gap-1 rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]`} role="radiogroup">
      {options.map((option) => {
        const on = option.value === value;
        return <button aria-checked={on} className={`${full ? "flex-1" : ""} ${size === "sm" ? "min-h-9 px-3 text-[13px]" : "min-h-10 px-4 text-sm"} inline-flex items-center justify-center whitespace-nowrap rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "text-black/65 hover:text-black"}`} disabled={option.disabled} key={option.value} onClick={() => onChange(option.value)} role="radio" type="button">{option.label}</button>;
      })}
    </div>
  );
}

export function Pill({ children, onClick, variant = "outline", className = "", disabled = false, type = "button", ariaLabel }: { children: ReactNode; onClick?: () => void; variant?: "outline" | "ink" | "coral" | "ghost" | "muted"; className?: string; disabled?: boolean; type?: "button" | "submit"; ariaLabel?: string }) {
  const styles = {
    outline: "shadow-[inset_0_0_0_1.5px_#0D0D0D] hover:bg-black/[0.04]",
    ink: "bg-[#0D0D0D] text-[#F5F4EF] hover:bg-black/85",
    coral: "bg-[#FF5A4F] text-[#0D0D0D] hover:brightness-95",
    ghost: "hover:bg-black/[0.05]",
    muted: "bg-black/[0.06] text-black/45",
  }[variant];
  return <button aria-label={ariaLabel} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-[18px] text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${styles} ${className}`} disabled={disabled} onClick={onClick} type={type}>{children}</button>;
}

export function Card({ children, className = "", tone = "white" }: { children: ReactNode; className?: string; tone?: "white" | "ink" | "coral" }) {
  const styles = { white: "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]", ink: "bg-[#0D0D0D] text-[#F5F4EF]", coral: "bg-[#FF5A4F] text-[#0D0D0D]" }[tone];
  return <div className={`rounded-[22px] ${styles} ${className}`}>{children}</div>;
}

export function MonoLabel({ children, className = "", color }: { children: ReactNode; className?: string; color?: string }) {
  return <p className={`font-label text-[11px] uppercase tracking-[0.16em] ${className}`} style={color ? { color } : undefined}>{children}</p>;
}

export function Counter({ value, max }: { value: string; max: number }) {
  return <span className={value.length > max * 0.9 ? "text-[#B42318]" : undefined}>{value.length} / {max}</span>;
}

export const cutCorner = (size: number) => `polygon(0 0,100% 0,100% calc(100% - ${size}px),calc(100% - ${Math.round(size * 0.58)}px) 100%,0 100%)`;
