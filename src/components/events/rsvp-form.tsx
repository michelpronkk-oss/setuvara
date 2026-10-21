"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { eventButton, eventButtonStyle } from "./event-page-view";

const input = "min-h-12 w-full rounded-[16px] bg-[var(--av-field)] px-4 text-[16px] text-[var(--av-fg)] shadow-[inset_0_0_0_1px_var(--av-field-edge)] outline-none transition-shadow placeholder:text-[var(--av-muted)] focus:shadow-[inset_0_0_0_2px_var(--av-fg)] aria-[invalid=true]:shadow-[inset_0_0_0_2px_var(--av-error)]";
const errorText = "text-[13px] font-medium text-[var(--av-error)]";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.padEnd(16, "0");
}

/**
 * The RSVP: name and email, one press. The route and the database decide seat or waitlist; this only
 * shows the answer. `waitlist` changes the words before anyone presses.
 */
export function RsvpForm({ eventId, organizerFirstName, waitlist, spotsNote, signedInName = "" }: { eventId: string; organizerFirstName: string; waitlist: boolean; spotsNote: string | null; signedInName?: string }) {
  const uid = useId();
  const [name, setName] = useState(signedInName);
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [done, setDone] = useState<null | { status: "confirmed" | "waitlisted"; email: string }>(null);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [meta] = useState(() => ({ key: newKey(), openedAt: Date.now() }));

  const problems: Record<string, string> = {};
  if (!name.trim()) problems.name = "Add your name.";
  if (!email.trim()) problems.email = "Add your email.";
  else if (!EMAIL.test(email.trim())) problems.email = "Check your email address.";
  const show = (key: string) => (tried ? problems[key] : undefined);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setTried(true);
    if (Object.keys(problems).length) return;
    setState("sending");
    setError(null);
    const response = await fetch(`/api/events/${eventId}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), idempotencyKey: meta.key, openedAt: meta.openedAt, hp }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { ok?: boolean; status?: "confirmed" | "waitlisted"; error?: string } | null;
    setState("idle");
    if (!response?.ok || !result?.ok) {
      setError(result?.error ?? "That didn't go through. Check your connection and try again.");
      return;
    }
    setDone({ status: result.status === "waitlisted" ? "waitlisted" : "confirmed", email: email.trim() });
  }

  if (done) {
    const going = done.status === "confirmed";
    return (
      <div aria-live="polite" className="mt-8 rounded-[26px] bg-[var(--av-panel)] p-6 shadow-[inset_0_0_0_1px_var(--av-line)] motion-safe:animate-[sheet-up_.45s_ease-out_both]" data-rsvp-done={done.status} role="status">
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-full" style={{ background: "var(--av-accent)", color: "var(--av-on-accent)" }}>
          <svg className="size-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" viewBox="0 0 24 24">{going ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 2" /></>}</svg>
        </span>
        <p className="mt-4 font-label text-[11px] uppercase tracking-[0.18em] text-[var(--av-muted)]">{going ? "You're going" : "On the waitlist"}</p>
        <p className="mt-2 text-[26px] font-bold leading-tight tracking-[-0.03em]">{going ? "See you there." : "You're next in line."}</p>
        <p className="mt-2 text-[15px] leading-[1.5] text-[var(--av-muted)]">
          {going ? `Your confirmation is on its way to ${done.email}. It has your private link to manage or cancel.` : `If a spot opens, it goes to the next person in line and we email ${done.email}.`}
        </p>
      </div>
    );
  }

  return (
    <form className="mt-8 flex flex-1 flex-col gap-5" noValidate onSubmit={(event) => void send(event)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{waitlist ? "Join the waitlist" : "RSVP"}</h2>
        {spotsNote && !waitlist && <p className="font-label text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--av-accent)" }}>{spotsNote}</p>}
      </div>
      {waitlist && <p className="-mt-2 text-[15px] leading-[1.5] text-[var(--av-muted)]">It&apos;s full right now. Spots that open go to the waitlist in order.</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2.5">
          <label className="text-[16px] font-semibold" htmlFor={`${uid}-name`}>Your name</label>
          <input aria-describedby={show("name") ? `${uid}-name-error` : undefined} aria-invalid={show("name") ? true : undefined} autoComplete="name" className={input} id={`${uid}-name`} maxLength={80} onChange={(event) => setName(event.target.value)} value={name} />
          {show("name") && <p className={errorText} id={`${uid}-name-error`}>{show("name")}</p>}
        </div>
        <div className="flex flex-col gap-2.5">
          <label className="text-[16px] font-semibold" htmlFor={`${uid}-email`}>Email</label>
          <input aria-describedby={show("email") ? `${uid}-email-error` : undefined} aria-invalid={show("email") ? true : undefined} autoComplete="email" className={input} id={`${uid}-email`} inputMode="email" maxLength={254} onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
          {show("email") && <p className={errorText} id={`${uid}-email-error`}>{show("email")}</p>}
        </div>
      </div>
      {/* The spam trap: people never see it, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${uid}-hp`}>Leave this empty</label>
        <input autoComplete="off" id={`${uid}-hp`} onChange={(event) => setHp(event.target.value)} tabIndex={-1} value={hp} />
      </div>
      <p className="text-[13px] leading-[1.5] text-[var(--av-muted)]">
        {organizerFirstName} sees your name and email on the guest list. Other guests don&apos;t. We email you about this event only. <Link className="underline underline-offset-4" href="/privacy">Privacy</Link>
      </p>
      {error && <p className="text-[14px] font-semibold text-[var(--av-error)]" role="alert">{error}</p>}
      <div className="sticky bottom-0 -mx-5 mt-auto px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-6" style={{ background: "linear-gradient(to bottom, transparent, var(--av-bg) 24px)" }}>
        <button className={eventButton} disabled={state === "sending"} style={eventButtonStyle} type="submit">
          {state === "sending" ? <><span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />Saving your spot…</> : waitlist ? "Join the waitlist" : "I'm going"}
        </button>
      </div>
    </form>
  );
}
