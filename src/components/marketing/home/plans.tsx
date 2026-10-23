import Link from "next/link";

import { PRICES } from "@/lib/marketing/facts";

import { RAIL, RAIL_ITEM } from "../site/kit";
import { Display, Label, Shell, Say } from "./primitives";

/** Free, Plus and Pro in one row: the price from the catalog and the four lines that matter most. */
const PLANS = [
  { name: "Free", price: "$0", note: "For good", tone: "bg-white text-ink", lines: ["All four Modes", "Actions, Leads and Builder", "QR, Quick QR and Tap", "Connections and Passport"], cta: { href: "/signup", label: "Create your Setuvara" } },
  { name: "Plus", price: PRICES.plus.monthly, note: `a month, or ${PRICES.plus.yearly} a year`, tone: "bg-white text-ink shadow-[inset_0_0_0_2px_#FF5A4F]", lines: ["All 10 Looks and every QR style", "Email your Audience", "Verified revenue on Builder", "0% Setuvara fee on sales"], cta: { href: "/pricing", label: "See Plus" } },
  { name: "Pro", price: PRICES.pro.monthly, note: `a month, or ${PRICES.pro.yearly} a year`, tone: "bg-ink text-paper", lines: ["A team of 5 on your Leads", "Analytics up to 2 years, with comparison", "24 live Actions, 20,000 emails a month", "3 revenue providers, 20 projects"], cta: { href: "/pricing", label: "See Pro" } },
] as const;

export function Plans() {
  return (
    <section aria-labelledby="plans-title" className="scroll-mt-16 bg-paper" id="plans">
      <Shell className="py-16 sm:py-24 lg:py-32">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <div>
            <Label className="text-coral">Plus and Pro</Label>
            <Display className="mt-4 text-[clamp(40px,4.4vw,72px)] leading-[0.92]"><span id="plans-title"><Say d={<>Free to start.<br />More when you want it.</>} m="Free to start." /></span></Display>
          </div>
          <p className="max-w-[28rem] text-[18px] max-sm:hidden leading-[1.5] text-ink/70 sm:text-[20px]">Free is complete for meeting people. Plus makes it yours; Pro is for the work around it.</p>
        </div>
        <ul className={`mt-12 grid gap-4 lg:mt-16 lg:grid-cols-3 ${RAIL}`}>
          {PLANS.map((plan) => (
            <li className={`flex flex-col rounded-[28px] p-7 sm:p-8 ${RAIL_ITEM} ${plan.tone}`} key={plan.name}>
              <p className="font-label text-[11px] uppercase tracking-[0.16em] opacity-60">{plan.name}</p>
              <p className="mt-4 flex items-baseline gap-2"><span className="font-display text-[48px] font-extrabold leading-none tracking-[-0.05em]">{plan.price}</span><span className="text-[14px] opacity-60">{plan.note}</span></p>
              <ul className="mt-6 flex flex-col gap-2.5 border-t border-current/15 pt-6">
                {plan.lines.map((line) => <li className="flex gap-2.5 text-[15px] leading-[1.4]" key={line}><span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-coral" />{line}</li>)}
              </ul>
              <Link className={`mt-8 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${plan.name === "Pro" ? "bg-paper text-ink" : plan.name === "Plus" ? "bg-coral text-ink" : "bg-ink text-paper"}`} href={plan.cta.href}>{plan.cta.label}</Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-[14px] text-ink/55"><Link className="font-semibold underline decoration-ink/25 underline-offset-4 hover:decoration-ink" href="/pricing#compare">Compare every line</Link> · Prices in USD</p>
      </Shell>
    </section>
  );
}
