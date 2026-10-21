"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { cancelGuest, checkInGuest } from "@/app/app/identity/events/actions";
import { FilterPill } from "@/components/creator/studio-ui";
import { GUEST_STATUS_LABEL, type Guest, type RegistrationStatus } from "@/lib/events/model";

const time = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const TONE: Record<RegistrationStatus, string> = { confirmed: "bg-[#C7FF4A] text-[#0D0D0D]", waitlisted: "bg-[#FFE7B8] text-[#0D0D0D]", cancelled: "bg-black/[0.06] text-black/55" };

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * The guest list: search, filter, check-in at the door, and taking someone off the list. Waitlist
 * order is the join order. A member who asked to connect is connected when they're checked in.
 */
export function GuestList({ eventId, guests, canEdit, canCheckIn }: { eventId: string; guests: Guest[]; canEdit: boolean; canCheckIn: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RegistrationStatus | "all" | "checked_in">("all");
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = (status: RegistrationStatus) => guests.filter((guest) => guest.status === status).length;
  const waitlistRank = useMemo(() => new Map(guests.filter((guest) => guest.status === "waitlisted").map((guest, index) => [guest.id, index + 1])), [guests]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return guests
      .filter((guest) => (filter === "all" ? guest.status !== "cancelled" : filter === "checked_in" ? guest.status === "confirmed" && guest.checked_in_at : guest.status === filter))
      .filter((guest) => !needle || guest.name.toLowerCase().includes(needle) || guest.email.toLowerCase().includes(needle));
  }, [guests, query, filter]);

  function remove(guest: Guest) {
    if (!window.confirm(`Take ${guest.name} off the list? ${guest.status === "confirmed" ? "Their spot goes to the next person on the waitlist." : ""}`)) return;
    setBusyId(guest.id);
    setError(null);
    start(async () => {
      const result = await cancelGuest(eventId, guest.id);
      setBusyId(null);
      if (!result.ok) { setError("error" in result ? result.error ?? "That didn't go through." : "That didn't go through."); return; }
      router.refresh();
    });
  }

  function toggleCheckIn(guest: Guest) {
    setBusyId(guest.id);
    setError(null);
    start(async () => {
      const result = await checkInGuest(eventId, guest.id, !guest.checked_in_at);
      setBusyId(null);
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    });
  }

  const checkedIn = guests.filter((guest) => guest.status === "confirmed" && guest.checked_in_at).length;

  return (
    <section aria-label="Guest list" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="-mx-3.5 flex gap-2 overflow-x-auto px-3.5 pb-1 md:mx-0 md:px-0">
          <FilterPill count={count("confirmed") + count("waitlisted")} label="All" on={filter === "all"} onClick={() => setFilter("all")} />
          <FilterPill count={count("confirmed")} label="Going" on={filter === "confirmed"} onClick={() => setFilter("confirmed")} />
          <FilterPill count={count("waitlisted")} label="Waitlist" on={filter === "waitlisted"} onClick={() => setFilter("waitlisted")} />
          {(canCheckIn || checkedIn > 0) && <FilterPill count={checkedIn} label="Checked in" on={filter === "checked_in"} onClick={() => setFilter("checked_in")} />}
          <FilterPill count={count("cancelled")} label="Cancelled" on={filter === "cancelled"} onClick={() => setFilter("cancelled")} />
        </div>
        <label className="relative block">
          <span className="sr-only">Search guests</span>
          <svg aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-black/40" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input className="min-h-11 w-full rounded-full bg-white pl-11 pr-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" onChange={(change) => setQuery(change.target.value)} placeholder="Name or email" type="search" value={query} />
        </label>
      </div>
      {error && <p className="text-[14px] font-semibold text-[#B42318]" role="alert">{error}</p>}
      {shown.length === 0 ? (
        <p className="rounded-[22px] bg-white p-6 text-[15px] text-black/55 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">{guests.length === 0 ? "No RSVPs yet. Share the event page to fill it." : "Nobody matches."}</p>
      ) : (
        <ul className="divide-y divide-black/[0.07] overflow-hidden rounded-[22px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
          {shown.map((guest) => (
            <li className="flex items-center gap-3 px-4 py-3.5 md:px-5" data-guest={guest.status} key={guest.id}>
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#0D0D0D] text-[15px] font-semibold text-[#F5F4EF]">{guest.name.trim().charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{guest.name}{guest.attendee_user_id && <span className="ml-2 font-label text-[10px] uppercase tracking-[0.12em] text-black/45">{guest.connect_on_check_in && !guest.connection_id ? "Member · connects at check-in" : "Member"}</span>}</p>
                <p className="truncate text-[13px] text-black/55">{guest.email} · {time(guest.created_at)}</p>
              </div>
              {guest.status === "confirmed" && guest.checked_in_at ? (
                <span className="shrink-0 rounded-full bg-[#0D0D0D] px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.12em] text-[#C7FF4A]">In<span className="hidden sm:inline">{guest.connection_id ? " · connected" : ` · ${clock(guest.checked_in_at)}`}</span></span>
              ) : (
                <span className={`shrink-0 rounded-full px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.12em] ${TONE[guest.status]}`}>{guest.status === "waitlisted" ? `Waitlist #${waitlistRank.get(guest.id)}` : guest.promoted_at && guest.status === "confirmed" ? <>Going<span className="hidden sm:inline"> · from waitlist</span></> : GUEST_STATUS_LABEL[guest.status]}</span>
              )}
              {canCheckIn && guest.status === "confirmed" && (
                <button aria-label={guest.checked_in_at ? `Undo check-in for ${guest.name}` : `Check in ${guest.name}`} aria-pressed={Boolean(guest.checked_in_at)} className={`grid size-10 shrink-0 place-items-center rounded-full transition disabled:opacity-40 ${guest.checked_in_at ? "bg-[#C7FF4A] text-[#0D0D0D] shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]" : "text-black/45 shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.18)] hover:text-[#0D0D0D] hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]"}`} data-check-in={guest.checked_in_at ? "in" : "out"} disabled={pending && busyId === guest.id} onClick={() => toggleCheckIn(guest)} type="button">
                  <svg aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                </button>
              )}
              {canEdit && guest.status !== "cancelled" && (
                <button aria-label={`Take ${guest.name} off the list`} className="grid size-10 shrink-0 place-items-center rounded-full text-black/45 transition hover:bg-black/[0.05] hover:text-[#B42318] disabled:opacity-40" disabled={pending && busyId === guest.id} onClick={() => remove(guest)} type="button">
                  <svg aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17" /></svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
