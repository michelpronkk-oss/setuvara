"use client";

import { useId, useState } from "react";

import { MemberBadge } from "@/components/app/status-badge";
import { MeetMark } from "@/components/marketing/brand";

import { PlanCta } from "./pricing-context";
import { H2 } from "./shared";

export function Levels() {
  const rows = [
    { name: "Free", tier: null, title: "For anyone starting.", body: "Students, new cities, first conferences. A complete identity and every Mode from day one." },
    { name: "Plus", tier: "plus" as const, title: "For people who want to be remembered.", body: "Hosts, connectors, the person everyone asks for their link. Your identity, finished, with premium status and real insights." },
    { name: "Pro", tier: "pro" as const, title: "For people whose name is the work.", body: "Founders, creators, consultants and sales. Real numbers over any period, and more room to show the work." },
  ];
  return (
    <section aria-labelledby="levels-title" className="bg-[#e6e4dc]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[clamp(36px,4vw,56px)] px-5 py-[clamp(72px,9vw,140px)] sm:px-8 lg:px-14">
        <H2 id="levels-title">Built for every<br />level of identity.</H2>
        <div className="flex flex-col border-t-[1.5px] border-ink">
          {rows.map((row, index) => (
            <div className={`grid grid-cols-[minmax(0,1fr)] items-baseline gap-x-12 gap-y-3 py-[clamp(24px,3vw,40px)] lg:grid-cols-3 ${index < rows.length - 1 ? "border-b border-ink/15" : ""}`} key={row.name}>
              <span className="flex items-center gap-3 font-display text-[clamp(40px,4.4vw,64px)] font-extrabold leading-[0.9] tracking-[-0.05em]">{row.name}{row.tier && <MemberBadge decorative size={34} tier={row.tier} />}</span>
              <span className="font-display text-[clamp(22px,2vw,28px)] font-bold leading-[1.1] tracking-[-0.03em]">{row.title}</span>
              <span className="text-base leading-[1.5] text-ink/80">{row.body}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ: readonly [string, string][] = [
  ["Do I need to pay to use Setuvara?", "No. Free includes all three Modes, your public profile, sharing, Connections, Passport and seven days of activity. Use it for as long as you like. No card needed."],
  ["Is there a free trial?", "There’s no trial because Free is permanent. Upgrade when you want premium expression and insights, or deeper numbers."],
  ["Are Personal, Event and Business Modes included?", "Yes, on every plan. Modes are how Setuvara works, so they are never behind a paywall."],
  ["What does the Plus badge mean?", "It shows you are a Setuvara Plus member. It is a premium status badge, not an identity or ID check. Pro members carry the Pro badge. The Setuvara Mark is separate: Setuvara awards it, and it can’t be bought."],
  ["What analytics come with each plan?", "Free shows seven days of views, scans and Connections. Plus adds sources, Modes and conversion over 30 or 90 days. Pro adds custom ranges up to two years, the Connection journey, devices and CSV export."],
  ["Can I use my own domain?", "Not yet. Your own domain is in development for Pro, along with advanced actions, lead capture and webhooks. They aren’t part of Pro today, and Pro’s price covers what is live now."],
  ["Is Tap or Wallet included?", "Quick QR is live on every plan. The NFC card and Wallet pass are coming soon, and core sharing on both will be free. Plus adds a premium pass look. Tap sharing insights are already part of Pro analytics."],
  ["Can I switch plans, or between monthly and yearly?", "Yes, from Billing in your account menu. Upgrades start right away and you pay the prorated difference, shown before you confirm. Downgrades and moves to monthly start at your next renewal."],
  ["What happens to my stamps and looks if I downgrade?", "Your stamps stay: they are earned by meeting people. The Member finish switches back to the standard cover, and Plus looks fall back to a Free one. Your choices are saved, so they return if you upgrade again."],
  ["Can I cancel anytime?", "Yes. Open Billing, then Manage billing. Paid features stay on until the end of your billing period, then your profile returns to Free with your Modes, Connections and Passport intact."],
  ["Who handles payment?", "Checkout, invoices and your card details are handled by our payment provider, Dodo Payments. Setuvara never sees your full card number."],
];

export function Faq() {
  const [open, setOpen] = useState(0);
  const base = useId();
  return (
    <section aria-labelledby="faq-title" className="scroll-mt-16 bg-paper" id="faq">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,1fr)] items-start gap-x-20 gap-y-10 px-5 py-[clamp(72px,9vw,140px)] sm:px-8 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:px-14">
        <div className="flex flex-col gap-5">
          <H2 id="faq-title">Questions.</H2>
          <p className="m-0 max-w-[360px] text-base leading-[1.5] text-ink/70">Something else? Write to <a className="font-semibold underline underline-offset-[3px] hover:text-coral" href="mailto:hello@setuvara.com">hello@setuvara.com</a>.</p>
        </div>
        <div className="flex flex-col border-t-[1.5px] border-ink">
          {FAQ.map(([question, answer], index) => {
            const isOpen = open === index;
            const panel = `${base}-faq-${index}`;
            return (
              <div className="border-b border-ink/15" key={question}>
                <h3 className="m-0">
                  <button aria-controls={panel} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-6 py-[22px] text-left font-display text-[clamp(19px,1.7vw,24px)] font-bold tracking-[-0.025em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" onClick={() => setOpen(isOpen ? -1 : index)} type="button">
                    {question}
                    <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full font-brand text-lg font-medium transition-[transform,background-color] duration-300 ${isOpen ? "rotate-45 bg-ink text-paper" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]"}`}>+</span>
                  </button>
                </h3>
                <p className="m-0 pb-6 pr-14 text-base leading-[1.55] text-ink/80 [text-wrap:pretty]" hidden={!isOpen} id={panel}>{answer}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const button = "flex h-14 items-center gap-2 rounded-full px-[22px] text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-70";
  return (
    <section aria-labelledby="final-title" className="relative overflow-hidden bg-coral">
      <MeetMark className="pointer-events-none absolute -bottom-[18%] -right-[6%] w-[min(44vw,640px)] text-ink" />
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-9 px-5 py-[clamp(96px,12vw,180px)] sm:px-8 lg:px-14">
        <h2 className="m-0 max-w-[max(62%,320px)] font-display text-[clamp(56px,8.4vw,140px)] font-extrabold leading-[0.84] tracking-[-0.06em]" id="final-title">Start free.<br />Upgrade when it’s you.</h2>
        <div className="flex max-w-[max(62%,320px)] flex-wrap gap-3">
          <PlanCta className={`${button} bg-ink px-[26px] text-paper hover:bg-[#262626]`} plan="free" />
          <PlanCta className={`${button} bg-paper text-ink hover:bg-white`} plan="plus"><MemberBadge decorative size={18} tier="plus" />Get Plus</PlanCta>
          <PlanCta className={`${button} text-ink shadow-[inset_0_0_0_1.5px_#0d0d0d] hover:bg-ink/10`} plan="pro"><MemberBadge decorative size={18} tier="pro" />Get Pro</PlanCta>
        </div>
      </div>
    </section>
  );
}
