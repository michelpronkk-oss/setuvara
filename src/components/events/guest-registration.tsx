"use client";

import { useState } from "react";

import { eventButton, eventButtonStyle } from "./event-page-view";

const LABEL = { confirmed: ["You're going", "Your spot is saved."], waitlisted: ["On the waitlist", "If a spot opens, it goes to the next person in line, and we email you."], cancelled: ["Cancelled", "You're no longer on the guest list."] } as const;

/** A guest's own registration, from their private link: the state, and cancelling with one confirmed press. */
export function GuestRegistration({ token, name, email, status: initial, canCancel }: { token: string; name: string; email: string; status: "confirmed" | "waitlisted" | "cancelled"; canCancel: boolean }) {
  const [status, setStatus] = useState(initial);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setSending(true);
    setError(null);
    const response = await fetch("/api/events/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" },
      body: JSON.stringify({ token, intent: "cancel" }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    setSending(false);
    if (!response?.ok || !result?.ok) { setError(result?.error ?? "That didn't go through. Try again."); return; }
    setStatus("cancelled");
    setAsking(false);
  }

  const [title, body] = LABEL[status];
  return (
    <div className="mt-8 rounded-[26px] bg-[var(--av-panel)] p-6 shadow-[inset_0_0_0_1px_var(--av-line)]" data-guest-status={status}>
      <p className="font-label text-[11px] uppercase tracking-[0.18em]" style={{ color: status === "cancelled" ? "var(--av-muted)" : "var(--av-accent)" }}>{title}</p>
      <p className="mt-2 text-[24px] font-bold leading-tight tracking-[-0.03em]">{name}</p>
      <p className="mt-1 text-[15px] text-[var(--av-muted)]">{email}</p>
      <p aria-live="polite" className="mt-4 text-[15px] leading-[1.5]">{body}</p>
      {error && <p className="mt-3 text-[14px] font-semibold text-[var(--av-error)]" role="alert">{error}</p>}
      {status !== "cancelled" && canCancel && (asking ? (
        <div className="mt-5 flex flex-col gap-3">
          <p className="text-[15px] font-semibold">{status === "confirmed" ? "Give up your spot? It goes to the next person on the waitlist." : "Leave the waitlist?"}</p>
          <button className={eventButton} disabled={sending} onClick={() => void cancel()} style={eventButtonStyle} type="button">{sending ? "Cancelling…" : "Yes, cancel"}</button>
          <button className="min-h-12 rounded-full text-[15px] font-semibold text-[var(--av-muted)] transition hover:text-[var(--av-fg)]" onClick={() => setAsking(false)} type="button">Keep it</button>
        </div>
      ) : (
        <button className="mt-5 min-h-12 rounded-full px-5 text-[15px] font-semibold shadow-[inset_0_0_0_1px_var(--av-line)] transition hover:shadow-[inset_0_0_0_1.5px_var(--av-fg)]" onClick={() => setAsking(true)} type="button">{status === "confirmed" ? "I can't make it" : "Leave the waitlist"}</button>
      ))}
    </div>
  );
}
