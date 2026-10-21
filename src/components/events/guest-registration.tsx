"use client";

import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useState } from "react";

import { eventButton, eventButtonStyle } from "./event-page-view";

const LABEL = { confirmed: ["You're going", "Your spot is saved."], waitlisted: ["On the waitlist", "If a spot opens, it goes to the next person in line, and we email you."], cancelled: ["Cancelled", "You're no longer on the guest list."] } as const;

type Connect = { on: boolean; connected: boolean; organizer: string };

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/events/registration", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const result = await response?.json().catch(() => null) as { ok?: boolean; error?: string; connect?: boolean; connected?: boolean } | null;
  if (response?.ok && result?.ok) return { ok: true as const, connect: result.connect, connected: result.connected };
  return { ok: false as const, error: result?.error ?? "That didn't go through. Try again." };
}

/**
 * A guest's own registration, from their private link: the state, the door pass, connecting with
 * the organizer (members only, their choice), and cancelling with one confirmed press.
 */
export function GuestRegistration({ token, name, email, status: initial, canCancel, passUrl, checkedInAt, connect: initialConnect }: {
  token: string; name: string; email: string; status: "confirmed" | "waitlisted" | "cancelled"; canCancel: boolean;
  passUrl: string | null; checkedInAt: string | null; connect: Connect | null;
}) {
  const [status, setStatus] = useState(initial);
  const [connect, setConnect] = useState(initialConnect);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setSending(true);
    setError(null);
    const result = await post({ token, intent: "cancel" });
    setSending(false);
    if (!result.ok) { setError(result.error); return; }
    setStatus("cancelled");
    setAsking(false);
  }

  async function toggleConnect() {
    if (!connect) return;
    setSaving(true);
    setError(null);
    const result = await post({ token, intent: "connect", connect: !connect.on });
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setConnect({ ...connect, on: Boolean(result.connect), connected: Boolean(result.connected) });
  }

  const organizerFirst = connect ? connect.organizer.split(/\s+/)[0] || connect.organizer : "";

  const [title, body] = LABEL[status];
  return (
    <div className="mt-8 rounded-[26px] bg-[var(--av-panel)] p-6 shadow-[inset_0_0_0_1px_var(--av-line)]" data-guest-status={status}>
      <p className="font-label text-[11px] uppercase tracking-[0.18em]" style={{ color: status === "cancelled" ? "var(--av-muted)" : "var(--av-accent)" }}>{title}</p>
      <p className="mt-2 text-[24px] font-bold leading-tight tracking-[-0.03em]">{name}</p>
      <p className="mt-1 text-[15px] text-[var(--av-muted)]">{email}</p>
      <p aria-live="polite" className="mt-4 text-[15px] leading-[1.5]">{body}</p>
      {status === "confirmed" && passUrl && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-[22px] bg-[var(--av-bg)] p-5 text-center shadow-[inset_0_0_0_1px_var(--av-line)]" data-door-pass={checkedInAt ? "used" : "ready"}>
          <p className="font-label text-[11px] uppercase tracking-[0.18em] text-[var(--av-muted)]">{checkedInAt ? "Checked in" : "Your door pass"}</p>
          <div className={`rounded-[18px] bg-white p-3 ${checkedInAt ? "opacity-40" : ""}`}>
            <QRCodeSVG aria-label="Door pass QR code" bgColor="#FFFFFF" fgColor="#0D0D0D" level="M" marginSize={0} role="img" size={184} value={passUrl} />
          </div>
          <p className="max-w-[300px] text-[14px] leading-[1.5] text-[var(--av-muted)]">{checkedInAt ? "You're in. Enjoy it." : "Show this at the door. The organizer scans it to check you in."}</p>
        </div>
      )}
      {status !== "cancelled" && connect && (
        <div className="mt-4 flex items-start gap-4 rounded-[22px] p-4 shadow-[inset_0_0_0_1px_var(--av-line)]">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{connect.connected ? `You're connected with ${organizerFirst}` : `Connect with ${organizerFirst} at check-in`}</p>
            <p className="mt-1 text-[13px] leading-[1.5] text-[var(--av-muted)]">
              {connect.connected ? <>This event is saved as where you met. <Link className="underline underline-offset-4" href="/app/connections">Your Connections</Link></> : `When you're checked in, you and ${organizerFirst} are added to each other's Connections, with this event as where you met.`}
            </p>
          </div>
          {!connect.connected && (
            <button aria-checked={connect.on} aria-label={`Connect with ${organizerFirst} at check-in`} className="relative mt-0.5 h-8 w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-50" disabled={saving} onClick={() => void toggleConnect()} role="switch" style={{ background: connect.on ? "var(--av-accent)" : "var(--av-line)" }} type="button">
              <span aria-hidden="true" className={`absolute left-0 top-1 size-6 rounded-full bg-white shadow transition-transform ${connect.on ? "translate-x-[24px]" : "translate-x-1"}`} />
            </button>
          )}
        </div>
      )}
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
