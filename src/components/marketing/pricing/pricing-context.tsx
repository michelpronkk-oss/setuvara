"use client";

import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";

import type { BillingInterval, PlanCode } from "@/lib/billing/catalog";
import { openCheckout } from "@/lib/billing/client-actions";

export type PricingViewer = {
  signedIn: boolean;
  plan: PlanCode;
  interval: BillingInterval | null;
  /** False when the signed-in member's plan could not be read; actions then go to Billing. */
  available: boolean;
};

type PricingState = {
  viewer: PricingViewer;
  interval: BillingInterval;
  setInterval: (value: BillingInterval) => void;
  busy: "plus" | "pro" | null;
  error: string | null;
  checkout: (plan: "plus" | "pro") => void;
};

const PricingContext = createContext<PricingState | null>(null);

export function PricingProvider({ viewer, children }: { viewer: PricingViewer; children: ReactNode }) {
  const [interval, setInterval] = useState<BillingInterval>(viewer.interval ?? "yearly");
  const [busy, setBusy] = useState<"plus" | "pro" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function checkout(plan: "plus" | "pro") {
    if (busy) return;
    setBusy(plan);
    setError(null);
    void openCheckout(plan, interval).then((result) => {
      if (result.ok) { window.location.assign(result.value); return; }
      setError(result.message);
      setBusy(null);
    });
  }

  return <PricingContext.Provider value={{ viewer, interval, setInterval, busy, error, checkout }}>{children}</PricingContext.Provider>;
}

export function usePricing() {
  const value = useContext(PricingContext);
  if (!value) throw new Error("usePricing outside PricingProvider");
  return value;
}

const NAME = { plus: "Plus", pro: "Pro" } as const;

/**
 * One action per plan, chosen from who is looking:
 * signed out → signup carrying the plan; Free member → secure checkout;
 * paid member → Billing (current plan, or a previewed switch); unreadable plan → Billing.
 */
export function PlanCta({ plan, className, children }: { plan: PlanCode; className: string; children?: ReactNode }) {
  const { viewer, interval, busy, checkout } = usePricing();

  if (plan === "free") {
    if (!viewer.signedIn) return <Link className={className} href="/signup">{children ?? "Create your Setuvara"}</Link>;
    return <Link className={className} href="/app">{viewer.plan === "free" ? "Your plan · Open Setuvara" : "Open Setuvara"}</Link>;
  }

  if (!viewer.signedIn) {
    return <Link className={className} href={`/signup?plan=${plan}&interval=${interval}`}>{children ?? `Get ${NAME[plan]}`}</Link>;
  }
  if (!viewer.available) return <Link className={className} href="/app/settings/billing">Open Billing</Link>;
  if (viewer.plan === "free") {
    return (
      <button aria-busy={busy === plan} className={className} disabled={busy !== null} onClick={() => checkout(plan)} type="button">
        {busy === plan ? "Opening checkout…" : children ?? `Get ${NAME[plan]}`}
      </button>
    );
  }
  if (viewer.plan === plan && viewer.interval === interval) {
    return <Link className={className} href="/app/settings/billing">Your plan · Manage</Link>;
  }
  const label = viewer.plan === plan ? `Switch to ${interval}` : plan === "pro" ? "Upgrade to Pro" : "Switch to Plus";
  return <Link className={className} href={`/app/settings/billing?start=${plan}&interval=${interval}`}>{label}</Link>;
}

export function PricingError() {
  const { error } = usePricing();
  return error ? <p className="text-center text-sm text-[#a43d36]" role="alert">{error}</p> : null;
}

export function IntervalToggle() {
  const { interval, setInterval } = usePricing();
  return (
    <div aria-label="Billing period" className="flex gap-0.5 rounded-full bg-ink p-1" role="group">
      <button aria-pressed={interval === "monthly"} className={`h-11 rounded-full px-5 text-[15px] font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${interval === "monthly" ? "bg-paper text-ink" : "text-paper/70 hover:text-paper"}`} onClick={() => setInterval("monthly")} type="button">Monthly</button>
      <button aria-pressed={interval === "yearly"} className={`flex h-11 items-center gap-2.5 rounded-full pl-5 pr-2 text-[15px] font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${interval === "yearly" ? "bg-paper text-ink" : "text-paper/70 hover:text-paper"}`} onClick={() => setInterval("yearly")} type="button">
        Yearly<span className="rounded-full bg-lime px-2 py-[5px] font-label text-[10px] leading-none tracking-[0.1em] text-ink">2 MONTHS FREE</span>
      </button>
    </div>
  );
}
