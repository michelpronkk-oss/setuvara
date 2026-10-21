"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { checkInGuest } from "@/app/app/identity/events/actions";
import { inkButton, lineButton, Mono } from "@/components/creator/studio-ui";
import type { CheckInWindow, Guest } from "@/lib/events/model";

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const CLOSED: Record<Exclude<CheckInWindow, "open"> | "cancelled", string> = {
  soon: "Check-in opens 12 hours before the start.",
  closed: "Check-in has closed for this event.",
  cancelled: "This event was cancelled.",
};

/** The guest on the pass, and one press to let them in. Taking it back keeps any Connection made. */
export function CheckInCard({ eventId, guest, window }: { eventId: string; guest: Guest; window: CheckInWindow | "cancelled" }) {
  const [checkedInAt, setCheckedInAt] = useState(guest.checked_in_at);
  const [connected, setConnected] = useState(Boolean(guest.connection_id));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [doing, setDoing] = useState<"in" | "out" | null>(null);
  const going = guest.status === "confirmed";
  const blocked = window !== "open" ? CLOSED[window] : !going ? (guest.status === "waitlisted" ? "This guest is on the waitlist, not going." : "This guest cancelled.") : null;

  function set(next: boolean) {
    setError(null);
    setDoing(next ? "in" : "out");
    start(async () => {
      const result = await checkInGuest(eventId, guest.id, next);
      setDoing(null);
      if (!result.ok) { setError(result.error); return; }
      setCheckedInAt(result.checkedInAt);
      setConnected(result.connected);
    });
  }

  return (
    <div className="flex flex-col gap-4" data-check-in={checkedInAt ? "in" : "out"}>
      <div className={`rounded-[28px] p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition-colors md:p-7 ${checkedInAt ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-white"}`}>
        <Mono className={checkedInAt ? "text-[#C7FF4A]" : "text-black/50"}>{checkedInAt ? `Checked in · ${clock(checkedInAt)}` : going ? "Going" : guest.status === "waitlisted" ? "Waitlist" : "Cancelled"}</Mono>
        <p className="mt-3 break-words font-display text-[40px] font-bold leading-[0.95] tracking-[-0.05em]">{guest.name}</p>
        <p className={`mt-2 truncate text-[15px] ${checkedInAt ? "text-[#F5F4EF]/65" : "text-black/55"}`}>{guest.email}</p>
        {guest.attendee_user_id && (
          <p aria-live="polite" className={`mt-4 text-[14px] font-semibold ${checkedInAt ? "text-[#F5F4EF]/80" : "text-black/60"}`}>
            {connected ? "You're connected now. They're in your Connections, met here." : guest.connect_on_check_in ? "Setuvara member. Checking in connects you." : "Setuvara member. They chose not to connect."}
          </p>
        )}
      </div>
      {error && <p className="text-[14px] font-semibold text-[#B42318]" role="alert">{error}</p>}
      {blocked ? (
        <p className="rounded-[18px] bg-[#FFF3D6] px-4 py-3 text-[14px] leading-[1.5]">{blocked}</p>
      ) : checkedInAt ? (
        <button className={lineButton} disabled={pending} onClick={() => set(false)} type="button">{doing === "out" ? "Undoing…" : "Undo check-in"}</button>
      ) : (
        <button className={`${inkButton} min-h-14 text-[17px]`} disabled={pending} onClick={() => set(true)} type="button">{doing === "in" ? "Checking in…" : `Check in ${guest.name.split(/\s+/)[0] || guest.name}`}</button>
      )}
      <Link className="self-center py-2 text-[14px] font-semibold text-black/55 underline-offset-4 hover:underline" href={`/app/identity/events/${eventId}`}>Guest list</Link>
    </div>
  );
}
