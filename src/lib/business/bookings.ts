/**
 * Smart Bookings: weekly hours, open times and held times. The database
 * (20261025090000_business_bookings.sql) computes and enforces every time; this mirrors its shapes
 * and does the visitor-side grouping. Pure, so tests use it directly.
 */

export const SLOT_MINUTES = [15, 20, 30, 45, 60, 90, 120, 180, 240] as const;
export const BUFFER_MINUTES = [0, 5, 10, 15, 30, 45, 60] as const;
export const NOTICE_HOURS = [0, 1, 2, 4, 12, 24, 48, 72, 168] as const;
export const HORIZON_DAYS = [7, 14, 30, 60, 90, 120] as const;
export const WEEKDAYS = [
  { day: "1", short: "Mon", name: "Monday" }, { day: "2", short: "Tue", name: "Tuesday" }, { day: "3", short: "Wed", name: "Wednesday" },
  { day: "4", short: "Thu", name: "Thursday" }, { day: "5", short: "Fri", name: "Friday" }, { day: "6", short: "Sat", name: "Saturday" },
  { day: "7", short: "Sun", name: "Sunday" },
] as const;

/** ISO weekday ("1" = Monday) → up to three [start, end] local times. */
export type WeeklyHours = Partial<Record<string, [string, string][]>>;

export type BookingAvailability = {
  action_id: string; enabled: boolean; timezone: string; slot_minutes: number; buffer_minutes: number;
  notice_hours: number; horizon_days: number; weekly: WeeklyHours;
};
export const AVAILABILITY_COLUMNS = "action_id, enabled, timezone, slot_minutes, buffer_minutes, notice_hours, horizon_days, weekly";

export type BookingStatus = "requested" | "confirmed" | "cancelled";
export type Booking = { id: string; action_id: string; submission_id: string; starts_at: string; ends_at: string; timezone: string; status: BookingStatus };
export const BOOKING_COLUMNS = "id, action_id, submission_id, starts_at, ends_at, timezone, status";
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = { requested: "Requested", confirmed: "Confirmed", cancelled: "Cancelled" };

export type OpenSlots = { enabled: false } | { enabled: true; timezone: string; slot_minutes: number; slots: string[] };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const END = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

/** Weekdays nine to five: where a new schedule starts. */
export function defaultAvailability(actionId: string, timezone: string): BookingAvailability {
  const weekly: WeeklyHours = {};
  for (const day of ["1", "2", "3", "4", "5"]) weekly[day] = [["09:00", "17:00"]];
  return { action_id: actionId, enabled: true, timezone, slot_minutes: 30, buffer_minutes: 15, notice_hours: 12, horizon_days: 14, weekly };
}

/** The same rule as private.booking_weekly_ok: weekdays 1–7, at most three ordered ranges each. */
export function weeklyProblem(weekly: WeeklyHours): string | null {
  for (const [day, ranges] of Object.entries(weekly)) {
    if (!/^[1-7]$/.test(day) || !Array.isArray(ranges) || ranges.length > 3) return "Up to three time ranges a day.";
    let previous = "";
    for (const [start, end] of ranges) {
      const name = WEEKDAYS[Number(day) - 1].name;
      if (!TIME.test(start) || !END.test(end)) return `Check the times on ${name}.`;
      if (end <= start) return `On ${name}, a range has to end after it starts.`;
      if (previous && start < previous) return `On ${name}, the ranges overlap.`;
      previous = end;
    }
  }
  return null;
}

/** Days that have any hours. */
export const openDays = (weekly: WeeklyHours) => WEEKDAYS.filter(({ day }) => (weekly[day] ?? []).length > 0).length;

/** A date's key and label in one time zone, e.g. "2026-10-23" and "Fri 23 Oct". */
function dayOf(iso: string, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export type SlotDay = { key: string; label: string; weekday: string; date: string; slots: { at: string; time: string }[] };

/** Open times grouped by day in the visitor's own zone, earliest first. */
export function groupSlots(slots: string[], timeZone: string): SlotDay[] {
  const days = new Map<string, SlotDay>();
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" });
  const date = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (const at of [...slots].sort()) {
    const key = dayOf(at, timeZone);
    const instant = new Date(at);
    const day = days.get(key) ?? { key, weekday: weekday.format(instant), date: date.format(instant), label: `${weekday.format(instant)} ${date.format(instant)}`, slots: [] };
    day.slots.push({ at, time: time.format(instant) });
    days.set(key, day);
  }
  return [...days.values()];
}

/** "Fri 23 Oct, 09:30" in a zone, built from parts so the server and every browser agree. */
export function formatSlot(iso: string, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`;
}

/** A time zone's short city name, "Europe/Amsterdam" → "Amsterdam". */
export const zoneName = (timeZone: string) => (timeZone.split("/").pop() ?? timeZone).replaceAll("_", " ");

/** Held and confirmed times from now on, grouped by the owner's day, earliest first. */
export function upcoming(bookings: Booking[], now = Date.now()) {
  return bookings.filter((booking) => booking.status !== "cancelled" && new Date(booking.ends_at).getTime() > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** An .ics calendar file for one confirmed time. Text is escaped per RFC 5545. */
export function bookingIcs({ id, startsAt, endsAt, title, attendee, note, stamp = new Date() }: { id: string; startsAt: string; endsAt: string; title: string; attendee: string; note: string; stamp?: Date }) {
  const utc = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Setuvara//Bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${id}@setuvara.com`, `DTSTAMP:${utc(stamp)}`, `DTSTART:${utc(new Date(startsAt))}`, `DTEND:${utc(new Date(endsAt))}`,
    `SUMMARY:${text(`${title} · ${attendee}`.slice(0, 200))}`, `DESCRIPTION:${text(note.slice(0, 1500))}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}
