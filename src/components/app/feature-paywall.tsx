"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { PLAN_MATRIX, type CapabilityKey } from "@/lib/billing/capabilities";

export function FeaturePaywall({ capability, onClose }: { capability: CapabilityKey; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const feature = PLAN_MATRIX[capability];
  const planName = feature.requiredPlan === "pro" ? "Pro" : "Plus";
  const savedChoice = feature.downgrade === "preserve-config-fallback";

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const dialog = closeRef.current?.closest('[role="dialog"]');
      const focusable = [...(dialog?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? [])];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-[#0D0D0D]/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="feature-paywall-heading" aria-modal="true" className="relative w-full max-w-md rounded-[28px] bg-[#F5F4EF] p-6 shadow-[0_30px_90px_-35px_rgba(0,0,0,.65)] sm:p-8" data-feature-paywall={capability} role="dialog">
        <button aria-label="Close" className="absolute right-5 top-5 grid size-11 place-items-center rounded-full bg-black/[0.06] text-xl focus-visible:outline-2" onClick={onClose} ref={closeRef} type="button">×</button>
        <p className="font-label text-[10px] uppercase tracking-[0.18em] text-[#A43D36]">A Setuvara {planName} detail</p>
        <h2 className="mt-3 max-w-[18rem] font-display text-3xl font-bold leading-[1.02] tracking-[-0.045em]" id="feature-paywall-heading">{feature.label}</h2>
        <p className="mt-4 text-sm leading-6 text-black/65">
          {savedChoice
            ? "Your saved choice stays with your identity. Upgrade to Plus to show it across your profile and shares."
            : `The ${feature.label.toLowerCase()} is included with Setuvara ${planName}. Your core Setuvara experience stays available on Free.`}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#FF5A4F] px-5 text-sm font-semibold text-[#0D0D0D] focus-visible:outline-2 focus-visible:outline-offset-2" href="/pricing" onClick={onClose}>See {planName} plans</Link>
          <button className="inline-flex min-h-12 items-center rounded-full px-5 text-sm font-semibold shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.2)] focus-visible:outline-2" onClick={onClose} type="button">Not now</button>
        </div>
      </section>
    </div>
  );
}
