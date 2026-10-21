/**
 * Events: the shared model for Event Mode's events and their guests. The database
 * (20261022090000_event_foundation.sql) is the source of truth for validation, capacity and the
 * lifecycle; this file mirrors it for pages, forms and labels. Pure, so tests and previews use it.
 */

export const EVENT_STATUSES = ["draft", "published", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];
export type EventPhase = "draft" | "cancelled" | "upcoming" | "live" | "ended";
export type RegistrationWindow = "open" | "soon" | "closed";
export type CheckInWindow = "open" | "soon" | "closed";
export type RegistrationStatus = "confirmed" | "waitlisted" | "cancelled";

export type EventRecord = {
  id: string;
  short_id: string;
  slug: string;
  status: EventStatus;
  title: string;
  summary: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue_name: string;
  address: string;
  city: string;
  country_code: string | null;
  online_url: string | null;
  capacity: number | null;
  waitlist_enabled: boolean;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  confirmed_count: number;
  waitlist_count: number;
  published_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};
export const EVENT_COLUMNS = "id, short_id, slug, status, title, summary, starts_at, ends_at, timezone, venue_name, address, city, country_code, online_url, capacity, waitlist_enabled, registration_opens_at, registration_closes_at, confirmed_count, waitlist_count, published_at, cancelled_at, created_at, updated_at";

/** What the public page gets from get_public_event. The username stays on the server. */
export type PublicEvent = Pick<EventRecord, "id" | "short_id" | "slug" | "status" | "title" | "summary" | "starts_at" | "ends_at" | "timezone" | "venue_name" | "address" | "city" | "country_code" | "online_url" | "capacity" | "waitlist_enabled" | "confirmed_count" | "registration_opens_at" | "registration_closes_at"> & {
  phase: EventPhase;
  registration: RegistrationWindow;
  profile_id: string;
  username: string;
  display_name: string;
};

export type Guest = { id: string; event_id: string; attendee_user_id: string | null; name: string; email: string; status: RegistrationStatus; cancelled_by: "guest" | "organizer" | null; confirmed_at: string | null; promoted_at: string | null; cancelled_at: string | null; created_at: string; checked_in_at: string | null; connect_on_check_in: boolean; connection_id: string | null };
export const GUEST_COLUMNS = "id, event_id, attendee_user_id, name, email, status, cancelled_by, confirmed_at, promoted_at, cancelled_at, created_at, checked_in_at, connect_on_check_in, connection_id";

export const PHASE_LABEL: Record<EventPhase, string> = { draft: "Draft", cancelled: "Cancelled", upcoming: "Upcoming", live: "Happening now", ended: "Ended" };
export const GUEST_STATUS_LABEL: Record<RegistrationStatus, string> = { confirmed: "Going", waitlisted: "Waitlist", cancelled: "Cancelled" };

const at = (iso: string) => new Date(iso).getTime();

/** Same rule as private.event_phase. */
export function eventPhase(event: Pick<EventRecord, "status" | "starts_at" | "ends_at">, now = Date.now()): EventPhase {
  if (event.status === "draft") return "draft";
  if (event.status === "cancelled") return "cancelled";
  if (now >= at(event.ends_at)) return "ended";
  if (now >= at(event.starts_at)) return "live";
  return "upcoming";
}

/** Same rule as private.event_registration_window: closes at the start unless set, never after the end. */
export function registrationWindow(event: Pick<EventRecord, "status" | "starts_at" | "ends_at" | "registration_opens_at" | "registration_closes_at">, now = Date.now()): RegistrationWindow {
  if (event.status !== "published") return "closed";
  if (event.registration_opens_at && now < at(event.registration_opens_at)) return "soon";
  const closes = Math.min(at(event.registration_closes_at ?? event.starts_at), at(event.ends_at));
  return now >= closes ? "closed" : "open";
}

const CHECK_IN_MARGIN_MS = 12 * 60 * 60 * 1000;

/** Same rule as private.event_check_in_window: from 12 hours before the start to 12 hours after the end. */
export function checkInWindow(event: Pick<EventRecord, "status" | "starts_at" | "ends_at">, now = Date.now()): CheckInWindow {
  if (event.status !== "published") return "closed";
  if (now < at(event.starts_at) - CHECK_IN_MARGIN_MS) return "soon";
  return now > at(event.ends_at) + CHECK_IN_MARGIN_MS ? "closed" : "open";
}

/** What a new guest would get right now. */
export function availability(event: Pick<EventRecord, "capacity" | "confirmed_count" | "waitlist_enabled">): "seats" | "waitlist" | "full" {
  if (event.capacity === null || event.confirmed_count < event.capacity) return "seats";
  return event.waitlist_enabled ? "waitlist" : "full";
}

/** Spots left, shown only when it helps someone decide: the last fifth, or the last 10. */
export function spotsLeftNote(event: Pick<EventRecord, "capacity" | "confirmed_count">) {
  if (event.capacity === null) return null;
  const left = Math.max(0, event.capacity - event.confirmed_count);
  if (left === 0 || left > Math.max(10, Math.ceil(event.capacity / 5))) return null;
  return left === 1 ? "1 spot left" : `${left} spots left`;
}

/** A URL name from the title: lowercase ASCII words joined by dashes, at most 60 characters. */
export function slugify(title: string) {
  return title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
}

/** The event's public path. The short id alone always works; the name is for people. */
export function eventPath(event: Pick<EventRecord, "short_id" | "slug">) {
  return `/e/${event.short_id}${event.slug ? `/${event.slug}` : ""}`;
}

export const SHORT_ID = /^[0-9A-Za-z]{8}$/;

/** The UTC offset (minutes) of a time zone at an instant. */
function offsetAt(timeZone: string, instant: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return (asUtc - Math.floor(instant / 1000) * 1000) / 60000;
}

/**
 * A wall-clock date and time in an event's time zone ("2026-11-04", "19:30") as a UTC ISO string.
 * Two passes settle daylight-saving edges; a time skipped by a spring-forward lands just after it.
 */
export function zonedToUtc(date: string, time: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !clock) return null;
  const wall = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(clock[1]), Number(clock[2]));
  if (Number.isNaN(wall)) return null;
  let guess = wall - offsetAt(timeZone, wall) * 60000;
  guess = wall - offsetAt(timeZone, guess) * 60000;
  return new Date(guess).toISOString();
}

/** A UTC instant as the wall-clock date and time in a zone, for the organizer's form. */
export function utcToZoned(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}` };
}

export function isTimeZone(value: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(value); } catch { return false; }
}

/** "Wed 4 November · 19:30 – 23:00 CET", in the event's own zone. Multi-day events show both dates. */
export function eventWhen(event: Pick<EventRecord, "starts_at" | "ends_at" | "timezone">, locale = "en-GB") {
  const zone = { timeZone: event.timezone };
  const day = new Intl.DateTimeFormat(locale, { ...zone, weekday: "short", day: "numeric", month: "long" });
  const time = new Intl.DateTimeFormat(locale, { ...zone, hour: "2-digit", minute: "2-digit" });
  const tz = new Intl.DateTimeFormat(locale, { ...zone, timeZoneName: "short" }).formatToParts(new Date(event.starts_at)).find((part) => part.type === "timeZoneName")?.value ?? "";
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const sameDay = utcToZoned(event.starts_at, event.timezone).date === utcToZoned(event.ends_at, event.timezone).date;
  return {
    date: sameDay ? day.format(start) : `${day.format(start)} – ${day.format(end)}`,
    time: sameDay ? `${time.format(start)} – ${time.format(end)} ${tz}`.trim() : `${time.format(start)} ${tz}`.trim(),
    year: new Intl.DateTimeFormat(locale, { ...zone, year: "numeric" }).format(start),
  };
}

export function eventPlace(event: Pick<EventRecord, "venue_name" | "address" | "city" | "online_url">) {
  const line = [event.venue_name, event.city].filter(Boolean).join(", ");
  return { line: line || (event.online_url ? "Online" : ""), address: event.address, online: Boolean(event.online_url) };
}

const icsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A calendar file for one event. Times are UTC, so every calendar shows them in its own zone. */
export function eventIcs(event: Pick<EventRecord, "id" | "title" | "summary" | "starts_at" | "ends_at" | "venue_name" | "address" | "city" | "online_url" | "updated_at">, url: string) {
  const location = [event.venue_name, event.address, event.city].filter(Boolean).join(", ") || event.online_url || "";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Setuvara//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@setuvara.com`,
    `DTSTAMP:${icsTime(event.updated_at)}`,
    `DTSTART:${icsTime(event.starts_at)}`,
    `DTEND:${icsTime(event.ends_at)}`,
    `SUMMARY:${icsText(event.title)}`,
    event.summary ? `DESCRIPTION:${icsText(`${event.summary}\n\n${url}`)}` : `DESCRIPTION:${icsText(url)}`,
    location ? `LOCATION:${icsText(location)}` : null,
    `URL:${url}`,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean) as string[];
  // Lines longer than 75 octets fold with a leading space (RFC 5545).
  return lines.map((line) => line.length <= 74 ? line : line.match(/.{1,73}/g)!.join("\r\n ")).join("\r\n") + "\r\n";
}
