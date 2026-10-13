"use client";

import { MemberBadge } from "@/components/app/status-badge";
import { MeetMark } from "@/components/marketing/brand";
import { getPublicPlan } from "@/lib/billing/catalog";
import { COMING_TO_PRO, formatPrice, monthlyNote, PLAN_HIGHLIGHTS, PLAN_TAGLINES, yearlyNote } from "@/lib/billing/plan-copy";

import { IntervalToggle, PlanCta, PricingError, usePricing } from "./pricing-context";
import { BadgedName, Check, Mono, SECTION } from "./shared";

const PLAN_NAME = { free: "Free", plus: "Plus", pro: "Pro" } as const;

const CTA = "flex h-12 w-full items-center justify-center rounded-full px-5 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral disabled:cursor-wait disabled:opacity-70";

export function HeroPlans() {
  const { interval, viewer } = usePricing();
  const yearly = interval === "yearly";
  const per = yearly ? "/year" : "/month";
  const amount = (plan: "plus" | "pro") => formatPrice(yearly ? getPublicPlan(plan).yearlyPriceMinor : getPublicPlan(plan).monthlyPriceMinor);
  const note = (plan: "plus" | "pro") => (yearly ? yearlyNote(plan) : monthlyNote(plan));

  return (
    <section aria-labelledby="pricing-title" className="relative overflow-hidden">
      <MeetMark className="pointer-events-none absolute -right-[8%] -top-[12%] w-[min(48vw,720px)] text-ink opacity-[0.045]" />
      <div className={`${SECTION} relative gap-[clamp(36px,4.5vw,56px)] pb-[clamp(56px,6vw,96px)] pt-[clamp(40px,6vw,88px)]`}>
        <div className="grid grid-cols-[minmax(0,1fr)] items-end gap-x-16 gap-y-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <Mono className="tracking-[0.16em] text-coral">Pricing</Mono>
            <h1 className="m-0 font-display text-[clamp(46px,6.6vw,104px)] font-extrabold leading-[0.88] tracking-[-0.055em]" id="pricing-title">Free to start.<br />Made to stand out.</h1>
          </div>
          <div className="flex flex-col gap-7 pb-2">
            <p className="m-0 max-w-[400px] text-[clamp(16px,1.25vw,18px)] leading-[1.45] text-ink/70 [text-wrap:pretty]">Free is complete, for good. Plus makes it premium. Pro shows what it’s worth.</p>
            <div className="flex flex-wrap items-center gap-3.5">
              <IntervalToggle />
              <span className="text-[13px] text-ink/60">USD · Cancel anytime</span>
              {viewer.signedIn ? <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]"><span className="size-1.5 rounded-full bg-lime shadow-[0_0_0_2px_rgba(13,13,13,.15)]" />Signed in{viewer.available ? ` · ${PLAN_NAME[viewer.plan]}` : ""}</span> : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-5 lg:grid-cols-3">
          <article className="flex flex-col gap-5 rounded-[28px] bg-white p-7 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] sm:p-8" data-plan="free">
            <div className="flex h-7 items-center"><Mono className="text-[12px] text-ink/65">Free</Mono></div>
            <h2 className="m-0 font-display text-[22px] font-bold leading-[1.05] tracking-[-0.03em]">{PLAN_TAGLINES.free}</h2>
            <div className="flex items-baseline gap-2"><span className="font-display text-[56px] font-extrabold leading-[0.9] tracking-[-0.05em]">$0</span><span className="text-[15px] text-ink/70">forever</span></div>
            <span className="-mt-3 min-h-5 text-[13px] text-ink/70">No card needed.</span>
            <div className="flex flex-col gap-1.5 rounded-[18px] bg-paper px-[18px] py-4">
              <Mono className="text-[10px] text-ink/65">Standard profile</Mono>
              <span className="font-display text-2xl font-bold leading-none tracking-[-0.035em]">Aanya Rao</span>
              <span className="font-label text-[12px] text-ink/60">setuvara.com/aanya</span>
            </div>
            <PlanCta className={`${CTA} text-ink shadow-[inset_0_0_0_1.5px_#0d0d0d] hover:bg-ink hover:text-paper`} plan="free" />
            <PlanList included="Included" items={PLAN_HIGHLIGHTS.free} tone="free" />
          </article>

          <article className="relative flex flex-col gap-5 rounded-[28px] bg-white p-7 shadow-[inset_0_0_0_2px_#ff5a4f,0_24px_48px_-28px_rgba(255,90,79,.6)] sm:p-8" data-plan="plus">
            <div className="flex h-7 items-center justify-between">
              <Mono className="flex items-center gap-2 text-[12px] text-ink"><MemberBadge decorative size={18} tier="plus" />Plus</Mono>
              <span className="rounded-full bg-coral px-2.5 py-1.5 font-label text-[10px] leading-none tracking-[0.14em] text-ink">MOST POPULAR</span>
            </div>
            <h2 className="m-0 font-display text-[22px] font-bold leading-[1.05] tracking-[-0.03em]">{PLAN_TAGLINES.plus}</h2>
            <div className="flex items-baseline gap-2"><span className="font-display text-[56px] font-extrabold leading-[0.9] tracking-[-0.05em]">{amount("plus")}</span><span className="text-[15px] text-ink/70">{per}</span></div>
            <span className="-mt-3 min-h-5 text-[13px] text-ink/70">{note("plus")}</span>
            <div className="flex flex-col gap-1.5 rounded-[18px] bg-[#fff1ef] px-[18px] py-4">
              <Mono className="text-[10px] text-[#a43d36]">Plus status · premium look</Mono>
              <BadgedName className="font-display text-2xl font-bold leading-none tracking-[-0.035em]" name="Aanya Rao" size={18} tier="plus" />
              <span className="font-label text-[12px] text-ink/60">setuvara.com/aanya</span>
            </div>
            <PlanCta className={`${CTA} bg-coral text-ink hover:bg-[#ff7168]`} plan="plus" />
            <PlanList included="Everything in Free, plus" items={PLAN_HIGHLIGHTS.plus} tone="plus" />
          </article>

          <article className="relative flex flex-col gap-5 overflow-hidden rounded-[28px] bg-ink p-7 text-paper sm:p-8" data-plan="pro">
            <MeetMark className="pointer-events-none absolute -right-[70px] -top-[50px] size-[260px] text-[#d6b25e] opacity-[0.07]" />
            <div className="relative flex h-7 items-center"><Mono className="flex items-center gap-2 text-[12px] text-[#e8d28a]"><MemberBadge decorative size={18} tier="pro" />Pro</Mono></div>
            <h2 className="relative m-0 font-display text-[22px] font-bold leading-[1.05] tracking-[-0.03em]">{PLAN_TAGLINES.pro}</h2>
            <div className="relative flex items-baseline gap-2"><span className="font-display text-[56px] font-extrabold leading-[0.9] tracking-[-0.05em]">{amount("pro")}</span><span className="text-[15px] text-paper/70">{per}</span></div>
            <span className="relative -mt-3 min-h-5 text-[13px] text-paper/70">{note("pro")}</span>
            <div className="relative flex flex-col gap-1.5 rounded-[18px] bg-[#1a1a1a] px-[18px] py-4">
              <Mono className="text-[10px] text-[#e8d28a]">Pro status · Business Mode</Mono>
              <BadgedName className="font-display text-2xl font-bold leading-none tracking-[-0.035em]" name="Aanya Rao" size={18} tier="pro" />
              <span className="font-label text-[12px] text-paper/60">setuvara.com/aanya</span>
            </div>
            <PlanCta className={`${CTA} relative bg-[#d6b25e] text-ink hover:bg-[#e8d28a]`} plan="pro" />
            <PlanList included="Everything in Plus, and" items={PLAN_HIGHLIGHTS.pro} tone="pro" />
            <div className="relative flex flex-col gap-2 rounded-[18px] px-[18px] py-4 shadow-[inset_0_0_0_1px_rgba(245,244,239,.14)]">
              <Mono className="text-[10px] text-paper/60">Coming to Pro</Mono>
              {COMING_TO_PRO.map((item) => <span className="text-[13px] text-paper/60" key={item}>{item}</span>)}
            </div>
          </article>
        </div>
        <PricingError />
        <p className="m-0 text-center text-[13px] text-ink/60">Every Mode, on every plan.</p>
      </div>
    </section>
  );
}

function PlanList({ included, items, tone }: { included: string; items: readonly { text: string; strong?: boolean }[]; tone: "free" | "plus" | "pro" }) {
  const dark = tone === "pro";
  return (
    <div className={`relative flex flex-col gap-3 border-t pt-5 text-[14px] ${dark ? "border-paper/15" : "border-ink/10"}`}>
      <Mono className={dark ? "text-paper/65" : "text-ink/65"}>{included}</Mono>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {items.map((item) => (
          <li className="flex gap-2.5" key={item.text}>
            <Check className={tone === "plus" ? "text-coral" : tone === "pro" ? "text-[#d6b25e]" : ""} />
            <span className={item.strong ? "font-semibold" : undefined}>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
