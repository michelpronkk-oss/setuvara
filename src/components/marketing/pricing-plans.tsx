"use client";

import Link from "next/link";
import { useState } from "react";

import { getPricingFeatureGroups } from "@/lib/billing/capabilities";
import type { PlanCode } from "@/lib/billing/catalog";

type PlanOffer = {
  code: PlanCode;
  displayName: string;
  monthlyPriceMinor: number;
  yearlyPriceMinor: number;
};

function price(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value / 100);
}

function checkoutUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["checkout.dodopayments.com", "test.checkout.dodopayments.com"].includes(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function portalUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["customer.dodopayments.com", "test.customer.dodopayments.com"].includes(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function PricingPlans({
  plans,
  currentPlan,
  signedIn,
  billingAvailable,
}: {
  plans: readonly PlanOffer[];
  currentPlan: PlanCode;
  signedIn: boolean;
  billingAvailable: boolean;
}) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [busyPlan, setBusyPlan] = useState<PlanCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectPlan(plan: PlanCode) {
    if (!signedIn || plan === "free" || plan === currentPlan || !billingAvailable || busyPlan) return;
    setBusyPlan(plan);
    setError(null);
    try {
      if (currentPlan !== "free") {
        const response = await fetch("/api/billing/portal", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        const result = await response.json() as { portalUrl?: unknown };
        const url = response.ok ? portalUrl(result.portalUrl) : null;
        if (url) {
          window.location.assign(url);
          return;
        }
      } else {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({ plan, interval }),
        });
        const result = await response.json() as { checkoutUrl?: unknown };
        const url = response.ok ? checkoutUrl(result.checkoutUrl) : null;
        if (url) {
          window.location.assign(url);
          return;
        }
      }
      setError("Billing could not open right now. Your current plan is unchanged.");
    } catch {
      setError("Billing could not open right now. Your current plan is unchanged.");
    }
    setBusyPlan(null);
  }

  return (
    <section aria-label="Setuvara plans" className="mx-auto w-full max-w-[1440px] px-5 pb-24 sm:px-8 lg:px-14">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <p className="font-label text-[11px] font-medium uppercase tracking-[0.16em] text-coral">One identity, at your pace</p>
        <h1 className="mt-5 text-balance font-display text-[clamp(44px,7vw,84px)] font-extrabold leading-[0.9] tracking-[-0.06em]">Keep the network open.</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-ink/70 sm:text-lg">Your identity, Modes, sharing, Tap, Connections, Passport, and soundtrack stay part of Free. Plus adds a curated profile finish and richer insight. Pro adds advanced analytics for your growing network.</p>
        <div aria-label="Billing interval" className="mt-7 inline-flex min-h-12 items-center gap-1 rounded-full bg-ink/[0.06] p-1" role="group">
          <button aria-pressed={interval === "monthly"} className={`min-h-10 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${interval === "monthly" ? "bg-ink text-paper" : "text-ink/65"}`} onClick={() => setInterval("monthly")} type="button">Monthly</button>
          <button aria-pressed={interval === "yearly"} className={`min-h-10 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${interval === "yearly" ? "bg-ink text-paper" : "text-ink/65"}`} onClick={() => setInterval("yearly")} type="button">Yearly</button>
        </div>
      </div>

      {!billingAvailable && signedIn && <p className="mx-auto mt-6 max-w-3xl rounded-2xl border border-ink/10 bg-white px-5 py-4 text-center text-sm text-ink/70" role="status">Plan details are temporarily unavailable. Try again before changing a plan.</p>}

      <div className="mx-auto mt-9 grid max-w-[1120px] items-stretch gap-4 lg:grid-cols-3 lg:gap-5">
        {plans.map((plan) => {
          const isCurrent = signedIn && billingAvailable && currentPlan === plan.code;
          const amount = plan.code === "free" ? 0 : interval === "monthly" ? plan.monthlyPriceMinor : plan.yearlyPriceMinor;
          const actionLabel = signedIn && !billingAvailable
            ? "Temporarily unavailable"
            : isCurrent
            ? "Your current plan"
            : !signedIn
              ? "Create an account"
              : currentPlan === "free"
                ? `Choose ${plan.displayName}`
                : "Manage plan";

          return (
            <article className={`relative flex flex-col rounded-[28px] border p-6 sm:p-7 ${plan.code === "plus" ? "border-coral bg-[#fff8f5] shadow-[0_14px_50px_rgba(13,13,13,.08)] lg:-my-2 lg:p-8" : "border-ink/10 bg-white"}`} key={plan.code}>
              {plan.code === "plus" && <span className="absolute right-5 top-5 rounded-full bg-coral px-3 py-1.5 font-label text-[9px] font-semibold uppercase tracking-[0.14em] text-ink">Most popular</span>}
              <p className="font-label text-[10px] uppercase tracking-[0.17em] text-ink/50">{plan.code === "free" ? "The full Setuvara loop" : plan.code === "plus" ? "Premium expression and insight" : "Advanced network insight"}</p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-[-0.045em]">{plan.displayName}</h2>
              <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-5xl font-bold tracking-[-0.06em]">{price(amount)}</span>
                <span className="text-sm text-ink/55">{plan.code === "free" ? "forever" : interval === "monthly" ? "/ month" : "/ year"}</span>
              </p>
              {plan.code !== "free" && <p className="mt-1 min-h-5 text-xs text-ink/55">{interval === "yearly" ? "Billed yearly. No free trial." : "Billed monthly. No free trial."}</p>}
              {plan.code === "free" && <p className="mt-1 min-h-5 text-xs text-ink/55">Free is permanent.</p>}
              <ul className="mt-7 flex flex-1 flex-col gap-3 border-t border-ink/10 pt-6 text-sm leading-6 text-ink/75">
                {getPricingFeatureGroups(plan.code).map(({ id, label }) => <li className="flex gap-2.5" key={id}><span aria-hidden="true" className="mt-[2px] font-semibold text-coral">✓</span><span>{label}</span></li>)}
              </ul>
              {signedIn ? (
                <button className={`mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral disabled:cursor-not-allowed disabled:opacity-55 ${plan.code === "plus" ? "bg-coral text-ink hover:bg-[#ff7168]" : "bg-ink text-paper hover:bg-[#262626]"}`} disabled={isCurrent || !billingAvailable || (busyPlan !== null && busyPlan !== plan.code) || plan.code === "free"} onClick={() => void selectPlan(plan.code)} type="button">{busyPlan === plan.code ? "Opening…" : actionLabel}</button>
              ) : (
                <Link className={`mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral ${plan.code === "plus" ? "bg-coral text-ink hover:bg-[#ff7168]" : "bg-ink text-paper hover:bg-[#262626]"}`} href="/signup?next=/app">{plan.code === "free" ? "Create your identity" : actionLabel}</Link>
              )}
            </article>
          );
        })}
      </div>

      {error && <p className="mx-auto mt-5 max-w-xl text-center text-sm text-[#a43d36]" role="alert">{error}</p>}
      <p className="mx-auto mt-7 max-w-3xl text-center text-xs leading-5 text-ink/50">Prices are in USD. The core Setuvara network remains available on Free. Setuvara Mark is separately awarded and is not a paid plan benefit.</p>
    </section>
  );
}
