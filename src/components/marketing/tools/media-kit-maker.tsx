"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { linkProviderById } from "@/lib/links/providers";

/**
 * The free media kit template: fill in the fields, see the kit, save it as a PDF through the
 * browser's print dialog. Nothing is uploaded; the print stylesheet shows only the kit.
 */

type Platform = { provider: PlatformId; handle: string; followers: string };
type Kit = {
  name: string; niche: string; city: string; bio: string; email: string;
  platforms: Platform[]; engagement: string; audience: string; brands: string; rates: string; accent: string;
};

const START: Kit = {
  name: "Sena Okafor",
  niche: "Music · Live sessions",
  city: "Lagos",
  bio: "Late-night sets, recorded live. A new session every Friday, watched by people who stay to the end.",
  email: "hello@example.com",
  platforms: [{ provider: "youtube", handle: "@sena", followers: "48K" }, { provider: "instagram", handle: "@sena", followers: "31K" }, { provider: "tiktok", handle: "@sena", followers: "120K" }],
  engagement: "6.2% average engagement",
  audience: "18–34 · Nigeria, UK, US",
  brands: "Two audio brands, a streaming service, three festivals",
  rates: "Session feature from $800 · Story set from $250",
  accent: "#E8A6FF",
};

const noop = () => () => {};

/** Platforms a creator reports followers on; names and brand marks come from the link providers. */
const PLATFORMS = ["instagram", "tiktok", "youtube", "x", "threads", "twitch", "kick", "spotify", "soundcloud", "apple_music", "snapchat", "pinterest", "facebook", "linkedin", "bluesky", "substack", "patreon"] as const;
type PlatformId = (typeof PLATFORMS)[number];
const MAX_PLATFORMS = 4;

function PlatformIcon({ id, className = "" }: { id: PlatformId; className?: string }) {
  const icon = linkProviderById[id]?.icon;
  return <svg aria-hidden="true" className={className} fill={icon ? `#${icon.hex}` : "currentColor"} focusable="false" viewBox="0 0 24 24"><path d={icon?.path ?? ""} /></svg>;
}

/** "48K", "1.2M" or "120,000" as a number; null when it isn't one. */
function followerCount(value: string) {
  const match = value.replace(/[,\s]/g, "").match(/^(\d+(?:\.\d+)?)([kKmM]?)$/);
  if (!match) return null;
  return Number(match[1]) * (match[2].toLowerCase() === "m" ? 1_000_000 : match[2].toLowerCase() === "k" ? 1_000 : 1);
}

const ACCENTS = ["#E8A6FF", "#FF5A4F", "#C7FF4A", "#7CC4FF", "#FFC94D", "#0D0D0D"];

function Field({ label, value, onChange, area = false, max = 120 }: { label: string; value: string; onChange: (value: string) => void; area?: boolean; max?: number }) {
  const id = useId();
  const style = "mt-1.5 block w-full rounded-2xl bg-white px-4 text-[15px] shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.14)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]";
  return (
    <div>
      <label className="font-label text-[11px] uppercase tracking-[0.14em] text-ink/55" htmlFor={id}>{label}</label>
      {area ? <textarea className={`${style} min-h-24 py-3`} id={id} maxLength={max} onChange={(event) => onChange(event.target.value)} value={value} /> : <input className={`${style} min-h-12`} id={id} maxLength={max} onChange={(event) => onChange(event.target.value)} value={value} />}
    </div>
  );
}

function Step({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[28px] bg-white p-5 shadow-[0_30px_60px_-50px_rgba(13,13,13,.4),inset_0_0_0_1px_rgba(13,13,13,.05)] sm:p-7">
      <p className="flex items-baseline gap-3 font-display text-[22px] font-extrabold tracking-[-0.04em]"><span className="font-label text-[11px] font-normal text-coral">{String(index).padStart(2, "0")}</span>{title}</p>
      <div className="mt-5 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function inkOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? "#0D0D0D" : "#F5F4EF";
}

function Sheet({ kit }: { kit: Kit }) {
  const ink = inkOn(kit.accent);
  const rows = [["Engagement", kit.engagement], ["Audience", kit.audience], ["Worked with", kit.brands], ["Rates", kit.rates]].filter(([, value]) => value.trim());
  const platforms = kit.platforms.filter((p) => p.handle.trim() || p.followers.trim());
  const counts = platforms.map((p) => followerCount(p.followers));
  const reach = counts.length > 1 && counts.every((n) => n !== null) ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(counts.reduce<number>((sum, n) => sum + (n ?? 0), 0)) : null;
  return (
    <article className="media-kit-sheet mx-auto flex aspect-[1/1.414] w-full max-sm:aspect-auto max-w-[560px] flex-col overflow-hidden rounded-[12px] bg-white text-ink shadow-[0_40px_80px_-30px_rgba(13,13,13,.45)]">
      <header className="relative flex shrink-0 items-end justify-between gap-4 overflow-hidden p-[7%]" style={{ background: kit.accent, color: ink }}>
        <span aria-hidden="true" className="absolute -right-[10%] -top-[60%] size-[70%] rounded-full bg-white opacity-25 blur-[50px]" />
        <div className="relative min-w-0">
          <p className="font-label text-[10px] uppercase tracking-[0.18em] opacity-70">Media kit</p>
          <h2 className="mt-2 font-display text-[clamp(30px,6vw,48px)] font-extrabold leading-[0.92] tracking-[-0.05em]">{kit.name || "Your name"}</h2>
          <p className="mt-2 text-[13px] font-semibold opacity-80">{[kit.niche, kit.city].filter(Boolean).join(" · ")}</p>
        </div>
        {reach ? <div className="relative shrink-0 text-right"><p className="font-display text-[clamp(26px,4.6vw,38px)] font-extrabold leading-none tracking-[-0.05em]">{reach}</p><p className="mt-1 font-label text-[9.5px] uppercase tracking-[0.16em] opacity-70">Total reach</p></div> : null}
      </header>
      <div className="flex flex-1 flex-col gap-5 p-[7%]">
        {kit.bio && <p className="text-[13.5px] leading-[1.55] text-ink/80">{kit.bio}</p>}
        {platforms.length ? (
          <ul className={`grid gap-2 ${platforms.length === 4 ? "grid-cols-2" : platforms.length === 1 ? "grid-cols-1" : platforms.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {platforms.map((p, index) => (
              <li className="rounded-[12px] bg-[#F5F4EF] p-3" key={`${p.provider}-${index}`}>
                <span className="grid size-7 place-items-center rounded-[8px] bg-white shadow-[0_1px_2px_rgba(13,13,13,.08)]"><PlatformIcon className="size-4" id={p.provider} /></span>
                <p className="mt-2.5 font-display text-[22px] font-extrabold leading-none tracking-[-0.04em]">{p.followers || "—"}</p>
                <p className="mt-1 text-[11px] font-semibold">{linkProviderById[p.provider]?.name}</p>
                <p className="truncate text-[10.5px] text-ink/55">{p.handle}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <dl className="flex flex-col divide-y divide-ink/10 border-y border-ink/10">
          {rows.map(([term, value]) => <div className="flex gap-4 py-2.5 text-[12.5px]" key={term}><dt className="w-24 shrink-0 font-semibold">{term}</dt><dd className="text-ink/75">{value}</dd></div>)}
        </dl>
        <p className="mt-auto flex items-center justify-between gap-3 text-[12.5px]"><span><span className="font-semibold">Contact</span> <span className="text-ink/70">{kit.email}</span></span><span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: kit.accent }} /></p>
      </div>
    </article>
  );
}

export function MediaKitMaker() {
  const [kit, setKit] = useState<Kit>(START);
  // True only in the browser, after hydration: the portal needs document.body.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const set = <K extends keyof Kit>(key: K) => (value: Kit[K]) => setKit((current) => ({ ...current, [key]: value }));
  const setPlatform = (index: number, key: keyof Platform) => (value: string) => setKit((current) => ({ ...current, platforms: current.platforms.map((p, i) => (i === index ? { ...p, [key]: value } : p)) }));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
      {/* Print shows only a copy of the sheet placed directly in <body>: one A4 page, nothing else. */}
      <style>{`.media-kit-print { display: none } @media print { @page { size: A4; margin: 0 } body > *:not(.media-kit-print) { display: none !important } .media-kit-print { display: block; width: 210mm; height: 297mm; -webkit-print-color-adjust: exact; print-color-adjust: exact } .media-kit-print .media-kit-sheet { max-width: none; width: 100%; height: 100%; aspect-ratio: auto; border-radius: 0; box-shadow: none } }`}</style>
      {mounted && createPortal(<div className="media-kit-print"><Sheet kit={kit} /></div>, document.body)}
      <div className="flex flex-col gap-4">
        <Step index={1} title="You">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" onChange={set("name")} value={kit.name} max={40} />
            <Field label="What you make" onChange={set("niche")} value={kit.niche} max={50} />
            <Field label="City" onChange={set("city")} value={kit.city} max={40} />
            <Field label="Contact email" onChange={set("email")} value={kit.email} max={80} />
          </div>
          <Field area label="About you" max={220} onChange={set("bio")} value={kit.bio} />
        </Step>
        <Step index={2} title="Platforms">
          <div className="flex flex-col gap-2">
            {kit.platforms.map((platform, index) => (
              <div className="grid grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)_32px] items-center gap-2 max-sm:pb-2 sm:grid-cols-[44px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,.8fr)_32px]" key={index}>
                <span className="grid size-11 place-items-center rounded-xl bg-[#F5F4EF]"><PlatformIcon className="size-5" id={platform.provider} /></span>
                <select aria-label={`Platform ${index + 1}`} className="min-h-11 min-w-0 max-sm:col-span-2 rounded-xl bg-white px-2.5 text-[14px] font-medium shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.14)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" onChange={(event) => setPlatform(index, "provider")(event.target.value)} value={platform.provider}>
                  {PLATFORMS.map((id) => <option key={id} value={id}>{linkProviderById[id]?.name ?? id}</option>)}
                </select>
                {(["handle", "followers"] as const).map((key) => <input aria-label={`Platform ${index + 1} ${key}`} className={`min-h-11 min-w-0 ${key === "handle" ? "max-sm:col-start-2" : ""} rounded-xl bg-white px-3 text-[14px] shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.14)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]`} key={key} maxLength={24} onChange={(event) => setPlatform(index, key)(event.target.value)} placeholder={key === "handle" ? "@handle" : "48K"} value={platform[key]} />)}
                <button aria-label={`Remove platform ${index + 1}`} className="grid size-8 max-sm:col-start-4 max-sm:row-start-1 place-items-center rounded-full text-[18px] text-ink/45 hover:bg-ink/[0.06] hover:text-ink disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-coral" disabled={kit.platforms.length === 1} onClick={() => setKit((current) => ({ ...current, platforms: current.platforms.filter((_, i) => i !== index) }))} type="button">×</button>
              </div>
            ))}
          </div>
          {kit.platforms.length < MAX_PLATFORMS ? <button className="inline-flex min-h-11 items-center gap-2 self-start rounded-full px-4 text-[14px] font-semibold shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.14)] hover:shadow-[inset_0_0_0_1.5px_#0D0D0D] focus-visible:outline-2 focus-visible:outline-coral" onClick={() => setKit((current) => ({ ...current, platforms: [...current.platforms, { provider: PLATFORMS.find((id) => !current.platforms.some((p) => p.provider === id)) ?? "instagram", handle: "", followers: "" }] }))} type="button">+ Add platform</button> : null}
        </Step>
        <Step index={3} title="Numbers and rates">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Engagement" onChange={set("engagement")} value={kit.engagement} max={60} />
            <Field label="Audience" onChange={set("audience")} value={kit.audience} max={60} />
          </div>
          <Field label="Brands you’ve worked with" onChange={set("brands")} value={kit.brands} max={100} />
          <Field label="Rates" onChange={set("rates")} value={kit.rates} max={100} />
        </Step>
        <Step index={4} title="Colour">
          <div className="flex flex-wrap gap-2.5">{ACCENTS.map((accent) => <button aria-label={`Colour ${accent}`} aria-pressed={kit.accent === accent} className={`size-11 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${kit.accent === accent ? "shadow-[0_0_0_3px_#FFFFFF,0_0_0_5px_#0D0D0D]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] hover:scale-105"}`} key={accent} onClick={() => set("accent")(accent)} style={{ background: accent }} type="button" />)}</div>
        </Step>
      </div>
      <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <div className="relative isolate overflow-hidden rounded-[32px] bg-[#E9E6DF] px-5 py-8 sm:px-10 sm:py-12">
          <span aria-hidden="true" className="absolute left-1/2 top-[20%] -z-10 size-[80%] -translate-x-1/2 rounded-full opacity-50 blur-[90px] transition-colors duration-500" style={{ background: kit.accent }} />
          <Sheet kit={kit} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <button className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-7 text-[15px] font-semibold text-paper hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" onClick={() => window.print()} type="button">Save as PDF</button>
          <p className="text-center text-[13px] text-ink/55">Opens your browser’s print dialog: choose “Save as PDF”. Nothing is uploaded.</p>
        </div>
      </div>
    </div>
  );
}
