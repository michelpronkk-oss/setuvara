"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { DemoMode } from "./demo";
import { STAGE_PALETTES } from "./phone-stage";

/**
 * One printed code, four pages: cycles the phone behind the QR through the Modes, and lets the
 * visitor pick one. Each screen is server-rendered; this only chooses which one shows. A soft glow
 * in the showing Mode's stage colours sits behind the phone, so the dark section has one source of light.
 */
export function QrSwitch({ labels, screens, qr }: { labels: { slug: DemoMode["slug"]; name: string; where: string }[]; screens: ReactNode[]; qr: ReactNode }) {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % screens.length), 2800);
    return () => window.clearInterval(timer);
  }, [held, screens.length]);
  return (
    <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-6">
      <div className="flex flex-col items-center gap-7 lg:col-span-5 lg:items-start">
        <div className="relative rotate-[-4deg] rounded-[24px] bg-white p-5 shadow-[0_40px_80px_-40px_rgba(0,0,0,.8)]">
          {qr}
          <p className="mt-3 text-center font-label text-[12px] tracking-[0.08em] text-ink/60">Quick QR · Aanya</p>
          <span className="absolute -right-3 -top-3 rounded-full bg-coral px-3 py-1.5 font-label text-[11px] font-medium uppercase tracking-[0.16em] text-ink">Never reprinted</span>
        </div>
        <div aria-label="Mode the code opens" className="grid w-full max-w-[460px] grid-cols-2 gap-2.5" role="group">
          {labels.map((label, index) => (
            <button aria-pressed={active === index} className={`flex flex-col gap-1 rounded-[18px] px-4 py-3.5 text-left transition focus-visible:outline-2 focus-visible:outline-coral sm:px-5 sm:py-4 ${active === index ? "bg-paper text-ink" : "bg-white/[0.08] text-paper/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)] hover:bg-white/[0.12]"}`} key={label.name} onClick={() => { setActive(index); setHeld(true); }} type="button">
              <span className="text-[16px] font-semibold sm:text-[17px]">{label.name}</span>
              <span className={`font-label text-[11px] uppercase tracking-[0.14em] ${active === index ? "text-coral" : "text-paper/60"}`}>{label.where}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="relative mx-auto h-[580px] w-[280px] lg:col-span-7 lg:h-[650px] lg:w-[314px]">
        {labels.map((label, index) => {
          const palette = STAGE_PALETTES[label.slug];
          return (
            <span aria-hidden="true" className={`pointer-events-none absolute -inset-x-[45%] -inset-y-[4%] transition-opacity duration-1000 ${active === index ? "opacity-100" : "opacity-0"}`} key={label.slug}>
              <span className="absolute left-[4%] top-[10%] size-[60%] rounded-full opacity-[.32] blur-[90px]" style={{ background: palette.a }} />
              <span className="absolute bottom-[12%] right-[6%] size-[50%] rounded-full opacity-[.26] blur-[90px]" style={{ background: palette.c }} />
              <span className="absolute left-[24%] top-[30%] size-[52%] rounded-full opacity-[.2] blur-[80px]" style={{ background: palette.b }} />
            </span>
          );
        })}
        {screens.map((screen, index) => (
          <div aria-hidden={active !== index} className={`absolute inset-0 origin-top transition-all duration-700 lg:[&>*]:origin-top-left lg:[&>*]:scale-[1.12] ${active === index ? "scale-100 opacity-100" : "pointer-events-none scale-[.96] opacity-0"}`} key={index}>{screen}</div>
        ))}
      </div>
    </div>
  );
}
