import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Display, Label, Shell } from "../home/primitives";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * Shared layout for /privacy, /terms, /cookies and /refunds: a short "in plain words" summary up top, then numbered
 * sections with a sticky contents list on wide screens.
 */
export function LegalPage({ kicker, title, updated, sections, other }: { kicker: string; title: string; updated: string; sections: LegalSection[]; other: { href: string; label: string } }) {
  return (
    <>
      <section aria-labelledby="legal-title" className="relative isolate overflow-hidden">
        <span aria-hidden="true" className="absolute -right-32 -top-40 -z-10 size-[520px] rounded-full bg-coral/15 blur-[120px]" />
        <Shell className="grid grid-cols-[minmax(0,1fr)] gap-10 pb-14 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:pb-8 lg:pt-16">
          <div className="flex flex-col gap-6">
            <Label className="text-coral">{kicker}</Label>
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

/** The hero object: a real hand holding a phone with a Setuvara identity on it. */
function HandPhone() {
  return (
    <div className="relative mx-auto w-full max-w-[460px] lg:mb-16">
      <span aria-hidden="true" className="absolute -inset-10 -z-10 rounded-full bg-coral/20 blur-[80px]" />
      <Image alt="A hand holding a phone showing Sena Okafor’s Setuvara identity" className="h-auto w-full rounded-[2.25rem] shadow-[0_50px_100px_-50px_rgba(13,13,13,.55)]" height={1402} priority sizes="(min-width: 1024px) 460px, 92vw" src="/legal/hand-phone.webp" width={1122} />
    </div>
  );
}
