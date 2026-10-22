"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * The free media kit template: fill in the fields, see the kit, save it as a PDF through the
 * browser's print dialog. Nothing is uploaded; the print stylesheet shows only the kit.
 */

type Platform = { name: string; handle: string; followers: string };
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
  platforms: [{ name: "YouTube", handle: "@sena", followers: "48K" }, { name: "Instagram", handle: "@sena", followers: "31K" }, { name: "TikTok", handle: "@sena", followers: "120K" }],
  engagement: "6.2% average engagement",
  audience: "18–34 · Nigeria, UK, US",
  brands: "Two audio brands, a streaming service, three festivals",
  rates: "Session feature from $800 · Story set from $250",
  accent: "#E8A6FF",
};

const noop = () => () => {};

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

function inkOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? "#0D0D0D" : "#F5F4EF";
}

function Sheet({ kit }: { kit: Kit }) {
  const ink = inkOn(kit.accent);
  const rows = [["Engagement", kit.engagement], ["Audience", kit.audience], ["Worked with", kit.brands], ["Rates", kit.rates]].filter(([, value]) => value.trim());
  return (
    <article className="media-kit-sheet mx-auto flex aspect-[1/1.414] w-full max-w-[560px] flex-col overflow-hidden rounded-[10px] bg-white text-ink shadow-[0_30px_70px_-30px_rgba(13,13,13,.45)]">
      <header className="flex flex-col gap-2 p-[7%]" style={{ background: kit.accent, color: ink }}>
        <p className="font-label text-[10px] uppercase tracking-[0.18em] opacity-70">Media kit</p>
        <h2 className="font-display text-[clamp(30px,6vw,48px)] font-extrabold leading-[0.92] tracking-[-0.05em]">{kit.name || "Your name"}</h2>
        <p className="text-[13px] font-semibold opacity-80">{[kit.niche, kit.city].filter(Boolean).join(" · ")}</p>
      </header>
      <div className="flex flex-1 flex-col gap-5 p-[7%]">
        {kit.bio && <p className="text-[13.5px] leading-[1.55] text-ink/80">{kit.bio}</p>}
        <ul className="grid grid-cols-3 gap-2">
          {kit.platforms.filter((p) => p.name.trim()).map((p) => (
            <li className="rounded-[10px] bg-[#F5F4EF] p-3" key={p.name + p.handle}>
              <p className="font-display text-[22px] font-extrabold leading-none tracking-[-0.04em]">{p.followers || "—"}</p>
              <p className="mt-1 text-[11px] font-semibold">{p.name}</p>
              <p className="truncate text-[10.5px] text-ink/55">{p.handle}</p>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col divide-y divide-ink/10 border-y border-ink/10">
          {rows.map(([term, value]) => <div className="flex gap-4 py-2.5 text-[12.5px]" key={term}><dt className="w-24 shrink-0 font-semibold">{term}</dt><dd className="text-ink/75">{value}</dd></div>)}
        </dl>
        <p className="mt-auto text-[12.5px]"><span className="font-semibold">Contact</span> <span className="text-ink/70">{kit.email}</span></p>
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
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" onChange={set("name")} value={kit.name} max={40} />
          <Field label="What you make" onChange={set("niche")} value={kit.niche} max={50} />
          <Field label="City" onChange={set("city")} value={kit.city} max={40} />
          <Field label="Contact email" onChange={set("email")} value={kit.email} max={80} />
        </div>
        <Field area label="About you" max={220} onChange={set("bio")} value={kit.bio} />
        <fieldset>
          <legend className="font-label text-[11px] uppercase tracking-[0.14em] text-ink/55">Platforms</legend>
          <div className="mt-1.5 flex flex-col gap-2">
            {kit.platforms.map((platform, index) => (
              <div className="grid grid-cols-3 gap-2" key={index}>
                {(["name", "handle", "followers"] as const).map((key) => <input aria-label={`Platform ${index + 1} ${key}`} className="min-h-11 min-w-0 rounded-xl bg-white px-3 text-[14px] shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.14)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" key={key} maxLength={24} onChange={(event) => setPlatform(index, key)(event.target.value)} placeholder={key === "name" ? "Platform" : key === "handle" ? "@handle" : "Followers"} value={platform[key]} />)}
              </div>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Engagement" onChange={set("engagement")} value={kit.engagement} max={60} />
          <Field label="Audience" onChange={set("audience")} value={kit.audience} max={60} />
        </div>
        <Field label="Brands you’ve worked with" onChange={set("brands")} value={kit.brands} max={100} />
        <Field label="Rates" onChange={set("rates")} value={kit.rates} max={100} />
        <fieldset>
          <legend className="font-label text-[11px] uppercase tracking-[0.14em] text-ink/55">Colour</legend>
          <div className="mt-2 flex flex-wrap gap-2">{ACCENTS.map((accent) => <button aria-label={`Colour ${accent}`} aria-pressed={kit.accent === accent} className={`size-10 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${kit.accent === accent ? "shadow-[0_0_0_2px_#F5F4EF,0_0_0_4px_#0D0D0D]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]"}`} key={accent} onClick={() => set("accent")(accent)} style={{ background: accent }} type="button" />)}</div>
        </fieldset>
      </div>
      <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <Sheet kit={kit} />
        <button className="inline-flex min-h-12 items-center justify-center self-center rounded-full bg-ink px-7 text-[15px] font-semibold text-paper hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" onClick={() => window.print()} type="button">Save as PDF</button>
        <p className="text-center text-[13px] text-ink/55">Opens your browser’s print dialog: choose “Save as PDF”. Nothing is uploaded.</p>
      </div>
    </div>
  );
}
