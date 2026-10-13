"use client";

import { useId, useState } from "react";

import { MemberBadge } from "@/components/app/status-badge";
import { MeetMark } from "@/components/marketing/brand";

import { PlanCta } from "./pricing-context";
import { H2 } from "./shared";

const FAQ: readonly [string, string][] = [
  ["Do I need to pay?", "No. Free includes every Mode, your profile, sharing, Connections and Passport. No card, no trial clock."],
  ["Can I hide Connect?", "Yes, on every plan. For each Mode, show it to everyone, only to people you share with in person, or no one. Change it whenever."],
  ["What does the badge mean?", "That you’re a Plus or Pro member. It’s status, not an ID check. The Setuvara Mark is awarded, never sold."],
  ["What analytics do I get?", "Free: 7 days. Plus: 30 and 90 days, with sources, Modes and conversion. Pro: any range up to 2 years, the Connection journey, devices and CSV."],
  ["Can I use my own domain?", "Not yet. It’s in development for Pro, with actions, lead capture and webhooks. Pro’s price covers what’s live today."],
  ["How do I switch or cancel?", "From Billing in your account. Upgrades start now, prorated. Downgrades and cancellations take effect at renewal."],
  ["What happens if I downgrade?", "Your Modes, Connections and stamps stay. Plus looks fall back to Free ones, and your choices return if you upgrade again."],
  ["Who handles payment?", "Dodo Payments. Setuvara never sees your full card number."],
];

export function Faq() {
  const [open, setOpen] = useState(0);
  const base = useId();
  return (
    <section aria-labelledby="faq-title" className="scroll-mt-16 bg-paper" id="faq">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,1fr)] items-start gap-x-20 gap-y-10 px-5 py-[clamp(64px,8vw,120px)] sm:px-8 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:px-14">
        <div className="flex flex-col gap-5">
          <H2 id="faq-title">Questions.</H2>
          <p className="m-0 max-w-[360px] text-[15px] leading-[1.5] text-ink/60">Something else? <a className="font-semibold underline underline-offset-[3px] hover:text-coral" href="mailto:hello@setuvara.com">hello@setuvara.com</a>.</p>
        </div>
        <div className="flex flex-col border-t-[1.5px] border-ink">
          {FAQ.map(([question, answer], index) => {
            const isOpen = open === index;
            const panel = `${base}-faq-${index}`;
            return (
              <div className="border-b border-ink/15" key={question}>
                <h3 className="m-0">
                  <button aria-controls={panel} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-6 py-5 text-left font-display text-[clamp(17px,1.4vw,20px)] font-bold tracking-[-0.025em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" onClick={() => setOpen(isOpen ? -1 : index)} type="button">
                    {question}
                    <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full font-brand text-lg font-medium transition-[transform,background-color] duration-300 ${isOpen ? "rotate-45 bg-ink text-paper" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]"}`}>+</span>
                  </button>
                </h3>
                <p className="m-0 pb-5 pr-14 text-[15px] leading-[1.55] text-ink/70 [text-wrap:pretty]" hidden={!isOpen} id={panel}>{answer}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const button = "flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-70";
  return (
    <section aria-labelledby="final-title" className="relative overflow-hidden bg-coral">
      <MeetMark className="pointer-events-none absolute -bottom-[18%] -right-[6%] w-[min(44vw,640px)] text-ink" />
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-9 px-5 py-[clamp(80px,10vw,150px)] sm:px-8 lg:px-14">
        <h2 className="m-0 max-w-[max(62%,320px)] font-display text-[clamp(48px,7vw,116px)] font-extrabold leading-[0.86] tracking-[-0.06em]" id="final-title">Start free.<br />Upgrade when it’s you.</h2>
        <div className="flex max-w-[max(62%,320px)] flex-wrap gap-3">
          <PlanCta className={`${button} bg-ink px-[26px] text-paper hover:bg-[#262626]`} plan="free" />
          <PlanCta className={`${button} bg-paper text-ink hover:bg-white`} plan="plus"><MemberBadge decorative size={18} tier="plus" />Get Plus</PlanCta>
          <PlanCta className={`${button} text-ink shadow-[inset_0_0_0_1.5px_#0d0d0d] hover:bg-ink/10`} plan="pro"><MemberBadge decorative size={18} tier="pro" />Get Pro</PlanCta>
        </div>
      </div>
    </section>
  );
}
