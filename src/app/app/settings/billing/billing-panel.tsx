"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { MemberBadge } from "@/components/app/status-badge";
import { getPublicPlan, type BillingInterval } from "@/lib/billing/catalog";
import { applyPlanChange, openCheckout, openPortal, previewPlanChange, type PlanChangePreview } from "@/lib/billing/client-actions";
import type { PlanIntent } from "@/lib/billing/intent";
import { classifyPlanChange } from "@/lib/billing/plan-change";
import { COMING_TO_PRO, formatPrice, PLAN_HIGHLIGHTS, PLAN_TAGLINES } from "@/lib/billing/plan-copy";
import type { ScheduledPlanChange } from "@/lib/billing/service";
import type { BillingSnapshot } from "@/lib/billing/state";

type Paid = "plus" | "pro";

const PLAN_NAME = { free: "Free", plus: "Setuvara Plus", pro: "Setuvara Pro" } as const;
const SHORT = { plus: "Plus", pro: "Pro" } as const;
const INTERVAL = { monthly: "Monthly", yearly: "Yearly" } as const;

function longDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function planLine(billing: BillingSnapshot, granted: boolean) {
  if (billing.plan === "free") return "Every Mode, sharing, Connections and Passport. Free for good.";
  if (granted) return "Granted to you, with no payment attached. Nothing renews or bills.";
  const end = longDate(billing.currentPeriodEnd);
  const cadence = billing.interval ? `${INTERVAL[billing.interval]} · ` : "";
  if (billing.status === "past_due") return `${cadence}Your last payment didn’t go through. Update your payment method to keep ${SHORT[billing.plan]}.`;
  if (billing.cancelAtPeriodEnd) return `${cadence}Ends ${end ?? "at the end of this period"}. You return to Free with everything you made.`;
  return `${cadence}Renews ${end ?? "automatically"}.`;
}

type Pending = { plan: Paid; interval: BillingInterval; preview: PlanChangePreview } | null;

export function BillingPanel({ billing, granted, scheduled, intent, notice, checkoutConfigured }: {
  billing: BillingSnapshot | null;
  /** The plan comes from a row with no subscription at Dodo (granted by hand). */
  granted: boolean;
  scheduled: ScheduledPlanChange | null;
  intent: PlanIntent | null;
  notice: "return" | "cancelled" | null;
  checkoutConfigured: boolean;
}) {
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>(intent?.interval ?? billing?.interval ?? "yearly");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [done, setDone] = useState<string | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const refreshes = useRef(0);

  // After checkout the webhook writes the plan, usually within seconds. Re-read a few times.
  useEffect(() => {
    if (notice !== "return" || !billing || billing.plan !== "free" || refreshes.current >= 6) return;
    const timer = window.setTimeout(() => { refreshes.current += 1; router.refresh(); }, 3000);
    return () => window.clearTimeout(timer);
  }, [notice, billing, router]);

  useEffect(() => { if (pending) confirmRef.current?.focus(); }, [pending]);

  if (!billing) {
    return (
      <Frame>
        <section className="rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] sm:p-6" role="status">
          <h2 className="font-semibold">Billing is taking a moment.</h2>
          <p className="mt-1 text-sm leading-6 text-black/60">We couldn’t load your plan. Nothing has changed. Refresh this page in a moment.</p>
        </section>
      </Frame>
    );
  }

  const current = billing;
  const paid = current.plan !== "free";
  const ending = paid && current.cancelAtPeriodEnd;
  const pastDue = current.status === "past_due";
  const canManage = current.canManageBilling && !granted;

  async function run<T>(key: string, action: () => Promise<{ ok: true; value: T } | { ok: false; message: string }>, onValue: (value: T) => void) {
    if (busy) return;
    setBusy(key); setError(null);
    const result = await action();
    if (result.ok) onValue(result.value);
    else setError(result.message);
    setBusy(null);
  }

  function choose(plan: Paid) {
    setDone(null);
    if (!paid) {
      void run(`checkout-${plan}`, () => openCheckout(plan, interval), (url) => { setBusy("redirect"); window.location.assign(url); });
      return;
    }
    void run(`preview-${plan}`, () => previewPlanChange(plan, interval), (preview) => setPending({ plan, interval, preview }));
  }

  function confirmChange() {
    if (!pending) return;
    const { plan, interval: nextInterval } = pending;
    void run("apply", () => applyPlanChange(plan, nextInterval), (value) => {
      setPending(null);
      setDone(value.kind === "upgrade"
        ? `You’re moving to ${SHORT[plan]}, ${INTERVAL[nextInterval].toLowerCase()}. It shows here as soon as the payment clears.`
        : `${SHORT[plan]}, ${INTERVAL[nextInterval].toLowerCase()}, starts ${longDate(value.effectiveAt) ?? "at your next renewal"}. Nothing changes until then.`);
      window.setTimeout(() => router.refresh(), 2500);
    });
  }

  function manage() {
    void run("portal", openPortal, (url) => { setBusy("redirect"); window.location.assign(url); });
  }

  const intentOpen = intent !== null && !(paid && intent.plan === current.plan && intent.interval === current.interval);
  const intentLine = intentOpen && intent
    ? `You picked ${SHORT[intent.plan]}, ${INTERVAL[intent.interval].toLowerCase()}. ${paid ? "Review the change below. You see the exact amount before anything is charged." : "Review it below, then continue to secure checkout."}`
    : null;

  return (
    <Frame>
      {notice === "return" && (
        <p className="mb-5 rounded-2xl bg-[#C7FF4A] px-4 py-3 text-sm font-medium text-[#0d0d0d]" role="status">
          {paid ? `Welcome to ${SHORT[current.plan as Paid]}. Your new look and insights are on.` : "Payment received. Your plan appears here in a few seconds."}
        </p>
      )}
      {notice === "cancelled" && <p className="mb-5 rounded-2xl bg-black/[0.05] px-4 py-3 text-sm text-black/70" role="status">Checkout closed. Nothing was charged.</p>}

      <section aria-labelledby="current-plan" className={`relative overflow-hidden rounded-[26px] p-5 sm:p-7 ${current.plan === "pro" ? "bg-[#0d0d0d] text-[#f5f4ef]" : current.plan === "plus" ? "bg-white shadow-[inset_0_0_0_2px_#ff5a4f]" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]"}`}>
        <p className={`font-label text-[11px] uppercase tracking-[0.16em] ${current.plan === "pro" ? "text-[#e8d28a]" : "text-black/50"}`}>Current plan</p>
        <h2 className="mt-3 flex items-center gap-2.5 font-display text-[34px] font-bold leading-none tracking-[-0.045em]" id="current-plan">
          {PLAN_NAME[current.plan]}
          {paid && <MemberBadge decorative size={24} tier={current.plan as Paid} />}
        </h2>
        <p className={`mt-3 max-w-xl text-[15px] leading-6 ${current.plan === "pro" ? "text-[#f5f4ef]/75" : "text-black/65"} ${pastDue ? "font-semibold text-[#a43d36]" : ""}`}>{planLine(current, granted)}</p>
        {scheduled && !done && (
          <p className={`mt-2 text-sm ${current.plan === "pro" ? "text-[#f5f4ef]/70" : "text-black/60"}`}>
            Switching to {SHORT[scheduled.plan]}, {INTERVAL[scheduled.interval].toLowerCase()}, on {longDate(scheduled.effectiveAt) ?? "your next renewal"}.
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          {canManage && (
            <button className={`inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors disabled:opacity-60 ${current.plan === "pro" ? "bg-[#d6b25e] text-[#0d0d0d] hover:bg-[#e8d28a]" : "bg-[#0d0d0d] text-[#f5f4ef] hover:bg-[#262626]"}`} disabled={busy !== null} onClick={manage} type="button">
              {busy === "portal" || busy === "redirect" ? "Opening…" : pastDue ? "Update payment method" : ending ? "Resume or manage" : "Manage billing"}
            </button>
          )}
          <Link className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold underline-offset-4 hover:underline ${current.plan === "pro" ? "text-[#f5f4ef]/80" : "text-black/70"}`} href="/pricing">Compare plans</Link>
        </div>
        {canManage && <p className={`mt-3 text-xs ${current.plan === "pro" ? "text-[#f5f4ef]/55" : "text-black/50"}`}>Manage billing opens our payment provider for your card, invoices and cancellation.</p>}
      </section>

      {done && <p className="mt-5 rounded-2xl bg-[#C7FF4A] px-4 py-3 text-sm font-medium text-[#0d0d0d]" role="status">{done}</p>}
      {error && <p className="mt-5 rounded-2xl bg-[#ffe9e6] px-4 py-3 text-sm text-[#a43d36]" role="alert">{error}</p>}

      <section aria-labelledby="plans-title" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-[-0.04em]" id="plans-title">{paid ? "Change plan" : "Upgrade"}</h2>
            <p className="mt-1 text-sm text-black/55">{paid ? "Upgrades start now, prorated. Downgrades start at your next renewal." : "Prices in USD. Cancel anytime. No free trial: Free is permanent."}</p>
          </div>
          <div aria-label="Billing period" className="inline-flex rounded-full bg-[#0d0d0d] p-1" role="group">
            {(["monthly", "yearly"] as const).map((value) => (
              <button aria-pressed={interval === value} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${interval === value ? "bg-[#f5f4ef] text-[#0d0d0d]" : "text-[#f5f4ef]/70"}`} key={value} onClick={() => { setInterval(value); setPending(null); }} type="button">
                {INTERVAL[value]}{value === "yearly" && <span className="rounded-full bg-[#C7FF4A] px-2 py-0.5 font-label text-[9px] tracking-[0.1em] text-[#0d0d0d]">2 MONTHS FREE</span>}
              </button>
            ))}
          </div>
        </div>

        {intentLine && <p className="mt-5 flex gap-2.5 rounded-2xl bg-white px-4 py-3 text-sm leading-5 text-black/75 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]"><span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#ff5a4f]" /><span>{intentLine}</span></p>}
        {!checkoutConfigured && <p className="mt-5 rounded-2xl bg-black/[0.05] px-4 py-3 text-sm text-black/70" role="status">Upgrades are paused for a moment. Your plan is unchanged.</p>}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {(["plus", "pro"] as const).map((plan) => {
            const offer = getPublicPlan(plan);
            const amount = interval === "monthly" ? offer.monthlyPriceMinor : offer.yearlyPriceMinor;
            const kind = paid ? classifyPlanChange({ plan: current.plan, interval: current.interval }, { plan, interval }) : "upgrade";
            const isCurrent = paid && kind === "same";
            const picked = intentOpen && intent?.plan === plan && intent.interval === interval;
            const label = !paid
              ? `Continue with ${SHORT[plan]}`
              : isCurrent
                ? "Your plan"
                : current.plan === plan
                  ? `Switch to ${INTERVAL[interval].toLowerCase()}`
                  : kind === "upgrade" ? `Upgrade to ${SHORT[plan]}` : `Switch to ${SHORT[plan]}`;
            const dark = plan === "pro";
            return (
              <article className={`flex flex-col rounded-[24px] p-5 sm:p-6 ${dark ? "bg-[#0d0d0d] text-[#f5f4ef]" : "bg-white"} ${picked ? "shadow-[inset_0_0_0_2px_#ff5a4f]" : dark ? "" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]"}`} key={plan}>
                <p className={`flex items-center gap-2 font-label text-[11px] uppercase tracking-[0.16em] ${dark ? "text-[#e8d28a]" : "text-black/60"}`}><MemberBadge decorative size={16} tier={plan} />{SHORT[plan]}</p>
                <p className="mt-3 font-display text-lg font-bold tracking-[-0.03em]">{PLAN_TAGLINES[plan]}</p>
                <p className="mt-3 flex items-baseline gap-1.5"><span className="font-display text-[40px] font-extrabold leading-none tracking-[-0.05em]">{formatPrice(amount)}</span><span className={`text-sm ${dark ? "text-[#f5f4ef]/65" : "text-black/55"}`}>{interval === "monthly" ? "/month" : "/year"}</span></p>
                <ul className={`mt-5 flex flex-1 flex-col gap-2 border-t pt-4 text-sm leading-5 ${dark ? "border-[#f5f4ef]/15 text-[#f5f4ef]/85" : "border-black/10 text-black/75"}`}>
                  {PLAN_HIGHLIGHTS[plan].map((item) => <li className="flex gap-2" key={item.text}><span aria-hidden="true" className={dark ? "text-[#d6b25e]" : "text-[#ff5a4f]"}>✓</span><span className={item.strong ? "font-semibold" : undefined}>{item.text}</span></li>)}
                </ul>
                {plan === "pro" && <p className="mt-3 text-xs leading-5 text-[#f5f4ef]/55">Coming to Pro: {COMING_TO_PRO.join(", ").toLowerCase()}.</p>}
                <button
                  className={`mt-5 inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${dark ? "bg-[#d6b25e] text-[#0d0d0d] hover:bg-[#e8d28a]" : "bg-[#ff5a4f] text-[#0d0d0d] hover:bg-[#ff7168]"}`}
                  disabled={isCurrent || busy !== null || !checkoutConfigured || (paid && (ending || pastDue || granted))}
                  onClick={() => choose(plan)}
                  type="button"
                >
                  {busy === `checkout-${plan}` || busy === `preview-${plan}` ? "Opening…" : label}
                </button>
              </article>
            );
          })}
        </div>
        {paid && (granted || ending || pastDue) && <p className="mt-3 text-sm text-black/60">{granted ? "Your plan was granted without a payment, so it can’t be changed here. Plan changes work on plans bought through checkout." : ending ? "Resume your plan in Manage billing to change it." : "Fix the payment in Manage billing to change plans."}</p>}

        {pending && (
          <div aria-labelledby="confirm-change" className="mt-5 rounded-[22px] bg-[#0d0d0d] p-5 text-[#f5f4ef] outline-none sm:p-6" ref={confirmRef} role="region" tabIndex={-1}>
            <h3 className="font-display text-xl font-bold tracking-[-0.03em]" id="confirm-change">Switch to {SHORT[pending.plan]}, {INTERVAL[pending.interval].toLowerCase()}?</h3>
            <p className="mt-2 text-sm leading-6 text-[#f5f4ef]/75">
              {pending.preview.kind === "upgrade"
                ? `${formatPrice(pending.preview.amountMinor)} is charged today to your saved payment method, prorated for the rest of this period. ${SHORT[pending.plan]} starts right away.`
                : `No charge today. You keep ${SHORT[current.plan as Paid]} until ${longDate(pending.preview.effectiveAt) ?? "your next renewal"}, then ${SHORT[pending.plan]} starts at ${formatPrice(pending.interval === "monthly" ? getPublicPlan(pending.plan).monthlyPriceMinor : getPublicPlan(pending.plan).yearlyPriceMinor)} ${pending.interval === "monthly" ? "a month" : "a year"}.`}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button className="inline-flex min-h-11 items-center rounded-full bg-[#f5f4ef] px-5 text-sm font-semibold text-[#0d0d0d] disabled:opacity-60" disabled={busy !== null} onClick={confirmChange} type="button">{busy === "apply" ? "Confirming…" : "Confirm change"}</button>
              <button className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-[#f5f4ef]/75 hover:text-[#f5f4ef]" disabled={busy === "apply"} onClick={() => setPending(null)} type="button">Keep my plan</button>
            </div>
          </div>
        )}
      </section>

      <p className="mt-10 text-xs leading-5 text-black/50">Downgrading or cancelling never removes your Modes, Connections, stamps or saved looks. Plus-only styles switch back to a Free look and return when you upgrade again. The Setuvara Mark is awarded, never sold.</p>
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="font-label text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">Settings</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.045em]">Billing</h1>
      <div className="mt-7">{children}</div>
    </main>
  );
}
