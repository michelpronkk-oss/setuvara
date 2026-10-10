"use client";

import { useEffect, useId, useRef, useState } from "react";

import { MemberBadge } from "@/components/app/status-badge";
import { getPublicPlan, type BillingInterval, type PlanCode } from "@/lib/billing/catalog";

export type PaywallTarget = "plus" | "pro";

const SHEETS = {
  plus: {
    kicker: "SETUVARA PLUS",
    title: "See what brings people to you.",
    body: "Understand which Modes and sharing methods turn views into Connections.",
    items: ["30 and 90 days of growth", "Your Modes and how people reach you", "Views → Connections, as one clear number"],
    cta: "Unlock with Plus",
    button: "bg-[#ff5a4f] text-[#0d0d0d]",
  },
  pro: {
    kicker: "SETUVARA PRO",
    title: "Go deeper into how your identity performs over time.",
    body: "For people whose Setuvara is part of their work.",
    items: ["Custom ranges, up to two years", "Your loop: shares, views, Connections", "Which devices people open you on", "Download any period as CSV"],
    cta: "Explore Pro",
    button: "bg-[#0d0d0d] text-[#e8d28a]",
  },
} as const;

function safeProviderUrl(value: unknown, kind: "checkout" | "portal") {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const hosts = kind === "checkout"
      ? ["checkout.dodopayments.com", "test.checkout.dodopayments.com"]
      : ["customer.dodopayments.com", "test.customer.dodopayments.com"];
    return url.protocol === "https:" && hosts.includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

function price(minor: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
}

/**
 * Contextual upgrade sheet. It never unlocks anything itself: Free starts the canonical
 * checkout for the target plan; a paid member changes plan in the canonical billing portal.
 * The page re-reads the resolved plan from the server after billing returns.
 */
export function AnalyticsPaywall({ target, plan, onClose }: { target: PaywallTarget; plan: PlanCode; onClose: () => void }) {
  const sheet = SHEETS[target];
  const offer = getPublicPlan(target);
  const usesCheckout = plan === "free";
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const busyRef = useRef(false);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>("button:not(:disabled)")];
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);

  async function upgrade() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      if (usesCheckout) {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
          body: JSON.stringify({ plan: target, interval }),
        });
        const url = response.ok ? safeProviderUrl(((await response.json()) as { checkoutUrl?: unknown }).checkoutUrl, "checkout") : null;
        if (url) { window.location.assign(url); return; }
      } else {
        const response = await fetch("/api/billing/portal", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        const url = response.ok ? safeProviderUrl(((await response.json()) as { portalUrl?: unknown }).portalUrl, "portal") : null;
        if (url) { window.location.assign(url); return; }
      }
      setFailed(true);
    } catch {
      setFailed(true);
    }
    busyRef.current = false;
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" data-analytics-paywall={target}>
      <div aria-hidden="true" className="absolute inset-0 bg-[#0d0d0d]/55 [animation:fade-in_160ms_ease-out]" onMouseDown={() => { if (!busyRef.current) onClose(); }} />
      <section
        aria-describedby={bodyId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative flex max-h-[calc(100dvh-16px)] w-full flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-[28px] bg-[#f5f4ef] px-6 pb-[calc(32px+env(safe-area-inset-bottom))] pt-3.5 text-[#0d0d0d] shadow-[0_-24px_60px_-30px_rgba(13,13,13,.5)] outline-none sm:max-h-[calc(100dvh-48px)] sm:max-w-[480px] sm:rounded-[28px] sm:px-8 sm:pb-8 sm:pt-8"
        ref={panel}
        role="dialog"
        tabIndex={-1}
      >
        <span aria-hidden="true" className="h-1 w-10 shrink-0 self-center rounded-full bg-[#0d0d0d]/20 sm:hidden" />
        <div className="flex items-center gap-2 pt-1.5 sm:pt-0">
          <MemberBadge decorative size={28} tier={target} />
          <span className="font-label text-[11px] tracking-[0.16em]">{sheet.kicker}</span>
        </div>
        <h2 className="font-display text-[34px] font-extrabold leading-[0.98] tracking-[-0.05em] [text-wrap:balance]" id={titleId}>{sheet.title}</h2>
        <p className="text-[15px] leading-[1.5]" id={bodyId}>{sheet.body}</p>
        <ol className="flex flex-col">
          {sheet.items.map((item, index) => (
            <li className="grid grid-cols-[30px_1fr] gap-2.5 border-t border-[#0d0d0d]/[0.12] py-3 text-[15px]" key={item}>
              <span className="pt-0.5 font-label text-[12px]">{String(index + 1).padStart(2, "0")}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
        {usesCheckout ? (
          <div aria-label="Billing interval" className="grid grid-cols-2 gap-1 rounded-full bg-[#0d0d0d]/[0.06] p-1" role="group">
            {(["monthly", "yearly"] as const).map((item) => (
              <button aria-pressed={interval === item} className={`min-h-11 rounded-full px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a4f] ${interval === item ? "bg-[#0d0d0d] text-[#f5f4ef]" : "text-[#0d0d0d]/70"}`} disabled={busy} key={item} onClick={() => setInterval(item)} type="button">
                {item === "monthly" ? `${price(offer.monthlyPriceMinor)} / month` : `${price(offer.yearlyPriceMinor)} / year`}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[13px] leading-[1.45] text-[#0d0d0d]/65">Your plan changes in your billing page. Analytics updates as soon as Pro is active.</p>
        )}
        {failed && <p className="text-[14px] text-[#a43d36]" role="alert">Billing could not open right now. Your plan is unchanged.</p>}
        <button className={`min-h-[52px] rounded-full text-[15px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d0d0d] disabled:cursor-wait disabled:opacity-70 ${sheet.button}`} disabled={busy} onClick={() => void upgrade()} type="button">
          {busy ? "Opening…" : sheet.cta}
        </button>
        {usesCheckout && <p className="-mt-1 text-center text-[12px] text-[#0d0d0d]/60">You review the subscription before any payment.</p>}
        <button className="min-h-11 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" disabled={busy} onClick={onClose} type="button">Not now</button>
      </section>
    </div>
  );
}
