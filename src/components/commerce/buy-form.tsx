"use client";

import { useState } from "react";

import { intentKey } from "./ui";

/**
 * The buyer's one step on Setuvara: an email for the receipt and the download,
 * then Stripe's own checkout (or, for free products, the email itself).
 */
export function BuyForm({ offerId, free, priceLabel, returnPath, accent, accentInk, defaultEmail, soldOut }: { offerId: string; free: boolean; priceLabel: string; returnPath: string; accent: string; accentInk: string; defaultEmail: string; soldOut: boolean }) {
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [key] = useState(intentKey);
  const [openedAt] = useState(() => Date.now());
  const [hp, setHp] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError("Check your email address."); return; }
    setBusy(true); setError(null);
    const response = await fetch(free ? "/api/commerce/claim" : "/api/commerce/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" },
      body: JSON.stringify(free ? { offerId, email: email.trim(), name: name.trim(), idempotencyKey: key, openedAt, hp } : { offerId, email: email.trim(), name: name.trim(), idempotencyKey: key, returnPath }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { url?: string; error?: string } | null;
    if (response?.ok && result?.url) { window.location.assign(result.url); return; }
    setBusy(false);
    if (response?.ok) { setSent(true); return; }
    setError(result?.error ?? "That didn't work. Try again.");
  }

  if (sent) {
    return (
      <div className="rounded-[22px] bg-white p-6" role="status">
        <p className="text-[19px] font-semibold">Check your email.</p>
        <p className="mt-2 text-[15px] leading-[1.5] text-black/65">Your download link is on its way to {email.trim()}. It can take a minute; look in spam if it doesn&apos;t arrive.</p>
      </div>
    );
  }

  return (
    <form className="grid gap-3" data-buy-form noValidate onSubmit={(event) => void submit(event)}>
      <label className="grid gap-1.5 text-[14px] font-semibold" htmlFor="buy-email">Email<input autoComplete="email" className="min-h-12 rounded-2xl bg-white px-4 text-[16px] font-normal shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] focus-visible:outline-2" id="buy-email" inputMode="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} /></label>
      <label className="grid gap-1.5 text-[14px] font-semibold" htmlFor="buy-name"><span>Name <span className="font-normal text-black/50">optional</span></span><input autoComplete="name" className="min-h-12 rounded-2xl bg-white px-4 text-[16px] font-normal shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] focus-visible:outline-2" id="buy-name" maxLength={120} onChange={(event) => setName(event.target.value)} value={name} /></label>
      <input aria-hidden="true" autoComplete="off" className="absolute -left-[9999px] size-px opacity-0" name="website" onChange={(event) => setHp(event.target.value)} tabIndex={-1} value={hp} />
      {error && <p className="text-[14px] font-medium text-[#B42318]" role="alert">{error}</p>}
      <div className="sticky bottom-0 -mx-5 bg-[#F5F4EF] px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 sm:static sm:mx-0 sm:p-0">
        <button className="min-h-14 w-full rounded-full text-[17px] font-semibold transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" disabled={busy || soldOut} style={{ background: accent, color: accentInk }} type="submit">
          {soldOut ? "Sold out" : busy ? (free ? "Sending…" : "Opening checkout…") : free ? "Email me the download" : `Buy · ${priceLabel}`}
        </button>
      </div>
      <p className="text-center text-[12px] leading-[1.45] text-black/50">{free ? "We email you a private download link. Nothing to pay." : "Secure checkout by Stripe. Cards, Apple Pay and Google Pay where available."}</p>
    </form>
  );
}
