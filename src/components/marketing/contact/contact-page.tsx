import Link from "next/link";

import { CONTACT_EMAIL } from "@/lib/marketing/contact";

import { MeetMark } from "../brand";
import { Display, Label, Shell } from "../home/primitives";
import { ContactForm } from "./contact-form";

const ELSEWHERE = [
  { href: "/pricing", title: "Plans and billing", line: "What Plus and Pro include." },
  { href: "/refunds", title: "Refunds", line: "Cancelling and the 14-day window." },
  { href: "/privacy", title: "Privacy", line: "What we keep, and what we don’t." },
];

/** /contact: one form for every kind of note, sent to the Setuvara inbox. */
export function ContactPage() {
  return (
    <>
      <section aria-labelledby="contact-title" className="relative isolate overflow-hidden">
        <span aria-hidden="true" className="absolute -left-40 -top-48 -z-10 size-[560px] rounded-full bg-coral/15 blur-[120px]" />
        <MeetMark className="pointer-events-none absolute -right-[14%] top-24 -z-10 hidden w-[min(44vw,560px)] text-ink/[0.04] lg:block" />
        <Shell className="grid grid-cols-[minmax(0,1fr)] gap-10 pb-16 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20 lg:pb-28 lg:pt-20">
          <div className="flex flex-col gap-6 lg:sticky lg:top-32 lg:self-start">
            <Label className="text-coral">Contact</Label>
            <Display as="h1" className="text-[clamp(46px,7vw,104px)] leading-[0.9]"><span id="contact-title">Talk to a person.</span></Display>
            <p className="max-w-[28rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[21px]">Support, partnerships, events or teams. One note, read by the people building Setuvara.</p>
            <dl className="mt-2 max-w-[28rem] border-t border-ink/15">
              <div className="flex items-baseline justify-between gap-6 border-b border-ink/15 py-3.5">
                <dt className="text-[15px] font-semibold">Email</dt>
                <dd><a className="text-[15px] text-ink/70 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-coral hover:decoration-coral" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></dd>
              </div>
              <div className="flex items-baseline justify-between gap-6 border-b border-ink/15 py-3.5">
                <dt className="text-[15px] font-semibold">Instagram</dt>
                <dd><a className="text-[15px] text-ink/70 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-coral hover:decoration-coral" href="https://instagram.com/setuvara.app" rel="noopener noreferrer" target="_blank">@setuvara.app</a></dd>
              </div>
            </dl>
          </div>

          <ContactForm />
        </Shell>
      </section>

      <section aria-labelledby="elsewhere-title" className="border-t border-ink/10 bg-white">
        <Shell className="grid grid-cols-[minmax(0,1fr)] gap-8 py-14 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div className="flex flex-col gap-3">
            <Label className="text-ink/55">Before you write</Label>
            <Display className="text-[clamp(32px,3.6vw,52px)] leading-[0.95]"><span id="elsewhere-title">The answer may already be here.</span></Display>
          </div>
          <ul className="border-t border-ink/15">
            {ELSEWHERE.map((item) => (
              <li className="border-b border-ink/15" key={item.href}>
                <Link className="group flex min-h-[68px] items-center justify-between gap-6 py-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral" href={item.href}>
                  <span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-6">
                    <span className="text-[17px] font-semibold">{item.title}</span>
                    <span className="text-[14px] text-ink/60">{item.line}</span>
                  </span>
                  <span aria-hidden="true" className="text-[18px] text-ink/35 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-coral">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Shell>
      </section>
    </>
  );
}
