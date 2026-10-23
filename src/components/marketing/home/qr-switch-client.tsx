"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * One printed code, four pages: cycles the phone behind the QR through the Modes, and lets the
 * visitor pick one. Each screen is server-rendered; this only chooses which one shows.
 */
export function QrSwitch({ labels, screens, qr }: { labels: { name: string; where: string }[]; screens: ReactNode[]; qr: ReactNode }) {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % screens.length), 2800);
    return () => window.clearInterval(timer);
  }, [held, screens.length]);
  return (
    <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-6">
      <div className="flex flex-col items-center gap-6 lg:col-span-5 lg:items-start">
        <div className="relative rotate-[-4deg] rounded-[24px] bg-white p-5 shadow-[0_40px_80px_-40px_rgba(13,13,13,.6)]">
          {qr}
          <p className="mt-3 text-center font-label text-[12px] tracking-[0.08em] text-ink/60">Quick QR · Aanya</p>
          <span className="absolute -right-3 -top-3 rounded-full bg-coral px-3 py-1.5 font-label text-[10px] font-medium uppercase tracking-[0.16em] text-ink">Never reprinted</span>
        </div>
        <div aria-label="Mode the code opens" className="grid w-full max-w-[420px] grid-cols-2 gap-2" role="group">
          {labels.map((label, index) => (
            <button aria-pressed={active === index} className={`flex flex-col rounded-[16px] px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-coral ${active === index ? "bg-paper text-ink" : "bg-white/[0.06] text-paper/70 hover:bg-white/[0.1]"}`} key={label.name} onClick={() => { setActive(index); setHeld(true); }} type="button">
              <span className="text-[15px] font-semibold">{label.name}</span>
              <span className={`font-label text-[10px] uppercase tracking-[0.14em] ${active === index ? "text-coral" : "text-paper/40"}`}>{label.where}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="relative mx-auto h-[580px] w-[280px] lg:col-span-7">
        {screens.map((screen, index) => (
          <div aria-hidden={active !== index} className={`absolute inset-0 transition-all duration-700 ${active === index ? "scale-100 opacity-100" : "pointer-events-none scale-[.96] opacity-0"}`} key={index}>{screen}</div>
        ))}
      </div>
    </div>
  );
}
