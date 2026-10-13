"use client";

import { useState, type ReactNode } from "react";

import { ACCENT_PRESETS, inkOnAccent, type QrStyle } from "@/components/profile/appearance";
import { QrFrame } from "@/components/profile/qr-frame";

import { Label } from "./primitives";

/** Personal shares the username; Event and Business share a short opaque link (/s/<8 Base62>). */
const MODES = [
  { slug: "personal", label: "Personal", context: "Personal", link: "setuvara.com/aanya" },
  { slug: "event", label: "Event", context: "Event · Slush", link: "setuvara.com/s/k7Qx2mPa" },
  { slug: "business", label: "Business", context: "Business", link: "setuvara.com/s/R4nd8LwQ" },
] as const;

/** The QR treatments members choose in Appearance. Standard is free; the rest are Plus. */
const STYLES: { id: QrStyle; label: string; plus: boolean }[] = [
  { id: "standard", label: "Standard", plus: false },
  { id: "accent-frame", label: "Frame", plus: true },
  { id: "label", label: "Label", plus: true },
  { id: "inverse", label: "Inverse", plus: true },
  { id: "rounded", label: "Rounded", plus: true },
];

const ACCENT_NAMES: Record<(typeof ACCENT_PRESETS)[number]["id"], string> = { coral: "Coral", lime: "Lime", blue: "Blue", lilac: "Lilac", gold: "Gold" };

export function ShareDemoClient({ qr }: { qr: ReactNode }) {
  const [mode, setMode] = useState<(typeof MODES)[number]>(MODES[1]);
  const [accent, setAccent] = useState<string>(ACCENT_PRESETS[0].hex);
  const [style, setStyle] = useState<QrStyle>("label");
  const ink = inkOnAccent(accent);

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-4">
      <div className="reveal w-full rounded-[2rem] bg-ink p-5 text-paper shadow-[0_40px_80px_-40px_rgba(13,13,13,.6)] sm:p-6">
        <div className="flex items-center justify-between">
          <Label className="text-paper/60">Share</Label>
          <p className="font-label text-[11px] font-medium uppercase tracking-[0.16em] transition-colors duration-300" style={{ color: accent }}>{mode.context}</p>
        </div>
        <div aria-label="Mode to share" className="mt-5 grid grid-cols-3 rounded-full bg-white/10 p-1 text-center text-[12px] font-semibold" role="radiogroup">
          {MODES.map((item) => (
            <button aria-checked={mode.slug === item.slug} className={`min-h-9 rounded-full transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper ${mode.slug === item.slug ? "bg-paper text-ink" : "text-paper/60 hover:text-paper"}`} key={item.slug} onClick={() => setMode(item)} role="radio" type="button">{item.label}</button>
          ))}
        </div>

        <div className="mt-5 grid min-h-[300px] place-items-center rounded-[1.5rem] bg-[#1c1c1c] p-5 sm:min-h-[340px]">
          <QrFrame accent={accent} className="w-full max-w-[250px] transition-all duration-300" modeLabel={mode.label} name="Aanya Rao" size="lg" style={style}>
            {qr}
          </QrFrame>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3">
          <span className="truncate font-label text-[12px] text-paper/80">{mode.link}</span>
          <span className="shrink-0 text-[12px] font-semibold transition-colors duration-300" style={{ color: accent }}>Copy</span>
        </div>
        <div className="mt-3 flex h-12 items-center justify-center rounded-full text-[14px] font-semibold transition-colors duration-300" style={{ background: accent, color: ink }}>Share {mode.label} Mode</div>
      </div>

      <div className="flex flex-col gap-3 rounded-[1.5rem] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <Label className="!text-[10px] text-ink/60">Colour</Label>
          <div aria-label="QR colour" className="flex gap-2" role="radiogroup">
            {ACCENT_PRESETS.map((preset) => (
              <button aria-checked={accent === preset.hex} aria-label={ACCENT_NAMES[preset.id]} className={`size-8 rounded-full transition-transform duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${accent === preset.hex ? "scale-110 shadow-[0_0_0_2px_#fff,0_0_0_4px_#0d0d0d]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] hover:scale-105"}`} key={preset.id} onClick={() => setAccent(preset.hex)} role="radio" style={{ background: preset.hex }} type="button" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-ink/10 pt-3">
          <Label className="!text-[10px] text-ink/60">QR style</Label>
          <div aria-label="QR style" className="flex flex-wrap gap-1.5" role="radiogroup">
            {STYLES.map((item) => (
              <button aria-checked={style === item.id} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${style === item.id ? "bg-ink text-paper" : "bg-ink/[0.05] text-ink/75 hover:text-ink"}`} key={item.id} onClick={() => setStyle(item.id)} role="radio" type="button">
                {item.label}{item.plus ? <span className={`font-label text-[9px] uppercase tracking-[0.12em] ${style === item.id ? "text-coral" : "text-[#a43d36]"}`}>Plus</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
