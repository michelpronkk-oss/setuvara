import Link from "next/link";
import type { ReactNode } from "react";

import { MeetMark, Wordmark } from "../brand";
import { Display, Label, Shell } from "../home/primitives";
import { StageField } from "../home/phone-stage";
import { PersonPhoto } from "../home/team-people";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * Shared layout for /privacy and /terms: a short "in plain words" summary up top, then numbered
 * sections with a sticky contents list on wide screens.
 */
export function LegalPage({ kicker, title, updated, sections, other }: { kicker: string; title: string; updated: string; sections: LegalSection[]; other: { href: string; label: string } }) {
  return (
    <>
      <section aria-labelledby="legal-title" className="relative isolate overflow-hidden">
        <span aria-hidden="true" className="absolute -right-32 -top-40 -z-10 size-[520px] rounded-full bg-coral/15 blur-[120px]" />
        <Shell className="grid grid-cols-[minmax(0,1fr)] gap-10 pb-14 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:pb-0 lg:pt-16">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-coral">{kicker}</Label>
              <span className="inline-flex items-center rounded-full bg-ink px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.14em] text-paper">Draft · in legal review</span>
            </div>
            <Display as="h1" className="text-[clamp(46px,7vw,104px)] leading-[0.9]"><span id="legal-title">{title}</span></Display>
            <p className="font-label text-[11px] uppercase tracking-[0.16em] text-ink/55">Last updated {updated}</p>
          </div>
          <HandPhone />
        </Shell>
      </section>

      <section className="border-t border-ink/10 bg-white">
        <Shell className="grid grid-cols-[minmax(0,1fr)] gap-10 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)] lg:justify-items-center lg:py-24">

          <div className="flex w-full max-w-[48rem] flex-col">
            {sections.map((section, index) => (
              <article aria-labelledby={`${section.id}-title`} className="scroll-mt-24 border-b border-ink/10 py-8 first:pt-0 last:border-0" id={section.id} key={section.id}>
                <div className="flex items-baseline gap-4">
                  <span className="font-label text-[11px] text-coral">{String(index + 1).padStart(2, "0")}</span>
                  <h2 className="font-display text-[clamp(24px,2.4vw,32px)] font-bold leading-[1.05] tracking-[-0.04em]" id={`${section.id}-title`}>{section.title}</h2>
                </div>
                <div className="legal-prose mt-4 flex flex-col gap-3 pl-0 text-[16px] leading-[1.65] text-ink/75 sm:pl-[34px] [&_a]:font-semibold [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_b]:font-semibold [&_b]:text-ink [&_li]:relative [&_li]:pl-5 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[11px] [&_li]:before:size-1.5 [&_li]:before:rounded-full [&_li]:before:bg-ink/30 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2">{section.body}</div>
              </article>
            ))}

            <div className="mt-10 flex flex-col gap-4 rounded-[1.75rem] bg-paper p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <p className="font-display text-[24px] font-bold tracking-[-0.04em]">Questions?</p>
                <p className="mt-1 text-[15px] text-ink/65">Write to us. A person reads every message.</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <a className="inline-flex min-h-12 items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-paper hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" href="mailto:hello@setuvara.com">hello@setuvara.com</a>
                <Link className="text-[14px] font-semibold underline underline-offset-4 hover:text-coral" href={other.href}>{other.label} →</Link>
              </div>
            </div>
          </div>
        </Shell>
      </section>
    </>
  );
}

/**
 * The hero object: setuvara.com on a phone, held in a hand, over a soft coral field. Drawn, not
 * photographed: the phone's screen is a small live-styled copy of the homepage hero.
 */
function HandPhone() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-[440px] w-full max-w-[420px] sm:h-[540px] lg:h-[600px]">
      <div className="absolute -inset-x-16 -bottom-10 -top-6 [mask-image:radial-gradient(closest-side,#000_45%,transparent)]">
        <StageField slug="business" />
      </div>
      <div className="absolute bottom-0 left-1/2 w-[300px] -translate-x-1/2 origin-bottom scale-[.78] sm:scale-95 lg:scale-100">
        <svg className="relative block h-[600px] w-[300px] overflow-visible" viewBox="0 0 300 600">
          <defs>
            <linearGradient id="legal-skin" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#e7b391" /><stop offset=".55" stopColor="#d49a76" /><stop offset="1" stopColor="#b97b5a" /></linearGradient>
            <linearGradient id="legal-skin-dark" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#c88a67" /><stop offset="1" stopColor="#e2ad8b" /></linearGradient>
            <filter id="legal-soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#0d0d0d" floodOpacity=".28" /></filter>
          </defs>
          {/* Palm and wrist, behind the phone. */}
          <path d="M48 640 C 40 560, 26 486, 40 440 C 56 392, 140 372, 214 376 C 262 384, 282 430, 280 486 C 278 540, 262 600, 262 640 Z" fill="url(#legal-skin)" filter="url(#legal-soft)" />
          {/* Fingers curl round the left edge: only their sides show past the phone. */}
          {[296, 340, 384, 428].map((y, index) => (
            <rect fill="url(#legal-skin-dark)" height="40" key={y} rx="20" transform={`rotate(${-10 + index * 5} 120 ${y + 20})`} width="120" x={14 + index * 2} y={y} />
          ))}
        </svg>
        {/* The phone itself, in front of the palm. */}
        <div className="absolute left-[38px] top-[20px] h-[470px] w-[228px] rounded-[40px] bg-[#1b1b1b] p-[8px] shadow-[0_40px_70px_-30px_rgba(13,13,13,.6),inset_0_0_0_1.5px_rgba(255,255,255,.08)]">
          <div className="relative h-full w-full overflow-hidden rounded-[32px] bg-paper">
            <span className="absolute left-1/2 top-2 z-10 h-[20px] w-[68px] -translate-x-1/2 rounded-full bg-[#0a0a0a]" />
            <div className="flex items-center justify-between px-4 pt-10">
              <span className="flex items-center gap-1"><MeetMark className="size-3.5" /><Wordmark className="text-[11px]" /></span>
              <span className="rounded-full bg-ink px-2 py-1 text-[7px] font-semibold text-paper">Get Setuvara</span>
            </div>
            <div className="flex flex-col items-center px-4 pt-7 text-center">
              <span className="font-label text-[6.5px] uppercase tracking-[0.16em] text-coral">Personal · Event · Business</span>
              <p className="mt-2 font-display text-[25px] font-extrabold leading-[0.95] tracking-[-0.055em]">One identity. Every version of&nbsp;you.</p>
              <p className="mt-2 text-[8.5px] leading-[1.35] text-ink/65">Share the right you.<br />Remember everyone you meet.</p>
              <div className="mt-3 flex h-7 w-full items-center justify-between rounded-full bg-white pl-3 pr-0.5 shadow-[inset_0_0_0_1px_#0d0d0d]"><span className="font-label text-[7px] text-ink/60">setuvara.com/<span className="text-ink/35">you</span></span><span className="rounded-full bg-ink px-2.5 py-1.5 text-[7px] font-semibold text-paper">Claim</span></div>
            </div>
            <div className="relative mt-5 h-[170px]">
              {(["aanya", "theo", "lucas"] as const).map((id, index) => (
                <div className="absolute left-1/2 top-0 h-[150px] w-[76px] overflow-hidden rounded-[12px] border-[3px] border-[#1b1b1b] shadow-[0_12px_20px_-10px_rgba(13,13,13,.6)]" key={id} style={{ transform: `translateX(calc(-50% + ${(index - 1) * 52}px)) translateY(${index === 1 ? 0 : 8}px) rotate(${(index - 1) * 6}deg) scale(${index === 1 ? 1 : 0.9})`, zIndex: index === 1 ? 2 : 1 }}>
                  <PersonPhoto className="h-full w-full" id={id} zoom="cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Fingers wrap the left edge; the thumb rests on the right. Both sit in front of the phone. */}
        <svg className="pointer-events-none absolute inset-0 h-[600px] w-[300px] overflow-visible" viewBox="0 0 300 600">
          <path d="M282 520 C 296 470, 292 400, 272 352 C 266 338, 250 338, 248 354 C 246 378, 254 420, 252 458 C 250 492, 246 520, 250 548 Z" fill="url(#legal-skin)" />
          <ellipse cx="259" cy="362" fill="#f0c6aa" opacity=".55" rx="7" ry="10" />
        </svg>
      </div>
    </div>
  );
}
