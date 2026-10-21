"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { saveBookingHours } from "@/app/app/identity/leads/booking-actions";
import { PlusTag, Toggle } from "@/app/app/identity/editor-ui";
import { inkButton, lineButton, Mono } from "@/components/creator/studio-ui";
import { BOOKING_STATUS_LABEL, BUFFER_MINUTES, formatSlot, HORIZON_DAYS, NOTICE_HOURS, openDays, SLOT_MINUTES, upcoming, WEEKDAYS, weeklyProblem, zoneName, type Booking, type BookingAvailability, type WeeklyHours } from "@/lib/business/bookings";

const select = "min-h-11 w-full rounded-full bg-white px-4 text-[15px] font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]";
const time = "min-h-10 w-0 min-w-0 flex-1 sm:max-w-[150px] rounded-full bg-white px-2 [&::-webkit-calendar-picker-indicator]:hidden text-center text-[15px] tabular-nums shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]";
const minutes = (value: number) => (value < 60 ? `${value} min` : value % 60 ? `${Math.floor(value / 60)} h ${value % 60}` : `${value / 60} h`);
const notice = (value: number) => (value === 0 ? "None" : value < 24 ? `${value} h` : value % 24 ? `${value} h` : `${value / 24} day${value === 24 ? "" : "s"}`);

/** Every zone the browser knows, the owner's own first. */
function zones(current: string) {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return [...new Set([current, ...all])];
}

function Choice<T extends number>({ id, label, value, options, format, onChange, cap }: { id: string; label: string; value: T; options: readonly T[]; format: (value: T) => string; onChange: (value: T) => void; cap?: number }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold" htmlFor={id}>{label}</label>
      <select className={select} id={id} onChange={(event) => onChange(Number(event.target.value) as T)} value={value}>
        {options.map((option) => <option disabled={cap !== undefined && option > cap} key={option} value={option}>{format(option)}{cap !== undefined && option > cap ? " · higher plan" : ""}</option>)}
      </select>
    </div>
  );
}

/**
 * A Booking Action's times: the weekly hours people can pick from, and what is held or confirmed.
 * Open times are worked out by the database from these hours and every time already taken, across
 * all of the owner's Booking Actions, so nobody is ever double booked.
 */
export function BookingTimes({ initial, fresh, bookings, names, horizonCap, plan, path, live }: {
  initial: BookingAvailability; /** Nothing saved yet: start from the browser's time zone. */ fresh: boolean; bookings: Booking[]; names: Record<string, string>;
  horizonCap: number; plan: "free" | "plus" | "pro"; path: string; live: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const zoneList = useMemo(() => zones(draft.timezone), [draft.timezone]);
  useEffect(() => {
    const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the server can't know the owner's zone
    if (fresh && own) setDraft((current) => ({ ...current, timezone: own }));
  }, [fresh]);
  const next = upcoming(bookings);
  const problem = weeklyProblem(draft.weekly);

  const setWeekly = (weekly: WeeklyHours) => { setSaved(false); setDraft((current) => ({ ...current, weekly })); };
  const patch = (change: Partial<BookingAvailability>) => { setSaved(false); setDraft((current) => ({ ...current, ...change })); };
  function setRange(day: string, index: number, edge: 0 | 1, value: string) {
    const ranges = [...(draft.weekly[day] ?? [])].map((range) => [...range] as [string, string]);
    ranges[index][edge] = value;
    setWeekly({ ...draft.weekly, [day]: ranges });
  }
  function toggleDay(day: string, on: boolean) {
    const weekly = { ...draft.weekly };
    if (on) weekly[day] = [["09:00", "17:00"]]; else delete weekly[day];
    setWeekly(weekly);
  }
  function addRange(day: string) {
    const ranges = draft.weekly[day] ?? [];
    const last = ranges[ranges.length - 1]?.[1] ?? "12:00";
    const hour = Math.min(23, Number(last.slice(0, 2)) + 1);
    setWeekly({ ...draft.weekly, [day]: [...ranges, [`${String(hour).padStart(2, "0")}:00`, hour >= 23 ? "24:00" : `${String(Math.min(23, hour + 3)).padStart(2, "0")}:00`]] });
  }
  function save() {
    setError(null);
    start(async () => {
      const result = await saveBookingHours(draft, path);
      if (!result.ok) { setError(result.error); return; }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-[28px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.07)] md:p-7" data-booking-hours={draft.enabled ? "on" : "off"}>
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[22px] font-bold leading-tight tracking-[-0.035em]">Open times</h2>
            <p className="mt-1 max-w-[52ch] text-[14px] leading-[1.45] text-black/55">People pick a real time from your hours. Requested times are held for you; Accepted confirms them, Declined frees them.</p>
          </div>
          <Toggle label="Let people pick a time" on={draft.enabled} onChange={(enabled) => patch({ enabled })} />
        </header>

        <div className={`grid gap-5 ${draft.enabled ? "" : "pointer-events-none opacity-45"}`} aria-disabled={!draft.enabled}>
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="book-zone">Time zone</label>
            <select className={select} id="book-zone" onChange={(event) => patch({ timezone: event.target.value })} value={draft.timezone}>
              {zoneList.map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}
            </select>
          </div>

          <div>
            <Mono className="mb-2 text-black/50">Weekly hours</Mono>
            <ul className="divide-y divide-black/[0.07] rounded-[20px] bg-[#F5F4EF] px-4">
              {WEEKDAYS.map(({ day, short, name }) => {
                const ranges = draft.weekly[day] ?? [];
                return (
                  <li className="grid gap-2 py-2.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-start" data-day={day} key={day}>
                    <div className="flex min-h-10 items-center gap-2">
                      <Toggle label={`Open on ${name}`} on={ranges.length > 0} onChange={(on) => toggleDay(day, on)} />
                      <span className="text-[15px] font-semibold">{short}</span>
                      {ranges.length === 0 && <span className="ml-auto text-[14px] text-black/45 sm:ml-2">Closed</span>}
                    </div>
                    {ranges.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {ranges.map(([from, to], index) => (
                          <div className="flex items-center gap-2" key={index}>
                            <input aria-label={`${name} from`} className={time} onChange={(event) => setRange(day, index, 0, event.target.value)} step={900} type="time" value={from} />
                            <span aria-hidden="true" className="text-black/40">–</span>
                            <input aria-label={`${name} until`} className={time} onChange={(event) => setRange(day, index, 1, event.target.value === "00:00" ? "24:00" : event.target.value)} step={900} type="time" value={to === "24:00" ? "00:00" : to} />
                            {index > 0
                              ? <button aria-label={`Remove this range on ${name}`} className="grid size-10 shrink-0 place-items-center rounded-full text-black/45 transition hover:bg-black/[0.05] hover:text-black" onClick={() => setWeekly({ ...draft.weekly, [day]: ranges.filter((_, at) => at !== index) })} type="button">×</button>
                              : <button aria-label={`Add a range on ${name}`} className="grid size-10 shrink-0 place-items-center rounded-full text-[18px] text-black/45 transition hover:bg-black/[0.05] hover:text-black disabled:opacity-30" disabled={ranges.length >= 3} onClick={() => addRange(day)} type="button">+</button>}
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Choice format={minutes} id="book-length" label="Length" onChange={(slot_minutes) => patch({ slot_minutes })} options={SLOT_MINUTES} value={draft.slot_minutes as (typeof SLOT_MINUTES)[number]} />
            <Choice format={(value) => (value ? minutes(value) : "None")} id="book-buffer" label="Buffer between" onChange={(buffer_minutes) => patch({ buffer_minutes })} options={BUFFER_MINUTES} value={draft.buffer_minutes as (typeof BUFFER_MINUTES)[number]} />
            <Choice format={notice} id="book-notice" label="Minimum notice" onChange={(notice_hours) => patch({ notice_hours })} options={NOTICE_HOURS} value={draft.notice_hours as (typeof NOTICE_HOURS)[number]} />
            <div>
              <Choice cap={horizonCap} format={(value) => `${value} days`} id="book-horizon" label="Book up to" onChange={(horizon_days) => patch({ horizon_days })} options={[...new Set([...HORIZON_DAYS, horizonCap])].sort((a, b) => a - b) as number[]} value={draft.horizon_days} />
              {plan !== "pro" && <p className="mt-2 flex items-center gap-2 text-[12.5px] text-black/50"><PlusTag />{plan === "free" ? "Plus books 60 days ahead, Pro 120." : "Pro books 120 days ahead."}</p>}
            </div>
          </div>
        </div>

        {(error || (draft.enabled && problem)) && <p className="mt-5 text-[14px] font-semibold text-[#B42318]" role="alert">{error ?? problem}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {saved && <span className="text-[14px] font-semibold text-black/55" role="status">Saved. {draft.enabled ? `Open ${openDays(draft.weekly)} days a week.` : "People send a request without a time."}</span>}
          <button className={inkButton} disabled={pending || (draft.enabled && Boolean(problem))} onClick={save} type="button">{pending ? "Saving…" : "Save times"}</button>
        </div>
        {!live && <p className="mt-4 text-[13px] text-black/50">This Action isn&apos;t live yet. Times show on your page once it is.</p>}
      </section>

      <aside aria-labelledby="held-title" className="flex flex-col gap-3">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.035em]" id="held-title">Coming up</h2>
        {next.length === 0 ? (
          <p className="rounded-[22px] bg-white p-5 text-[14px] text-black/55 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">Nothing held yet. Requested times appear here the moment someone picks one.</p>
        ) : (
          <ul className="divide-y divide-black/[0.07] overflow-hidden rounded-[22px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
            {next.slice(0, 12).map((booking) => (
              <li className="flex items-center gap-3 px-4 py-3" data-booking={booking.status} key={booking.id}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{formatSlot(booking.starts_at, booking.timezone)}</span>
                  <span className="block truncate text-[13px] text-black/55">{names[booking.submission_id] || "Someone"} · {zoneName(booking.timezone)}</span>
                </span>
                {booking.status === "confirmed"
                  ? <a className={`${lineButton} min-h-9 px-3 text-[13px]`} download href={`/api/business/bookings/${booking.id}/ics`}>.ics</a>
                  : <span className="rounded-full bg-[#FFE7B8] px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.12em]">{BOOKING_STATUS_LABEL[booking.status]}</span>}
              </li>
            ))}
          </ul>
        )}
        <Link className="text-[14px] font-semibold text-black/55 underline-offset-4 hover:text-black hover:underline" href="?tab=responses">Accept or decline in Responses</Link>
      </aside>
    </div>
  );
}
