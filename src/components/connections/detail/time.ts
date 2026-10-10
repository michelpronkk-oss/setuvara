"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** The viewer's time zone after hydration; UTC while server rendering so markup matches. */
export function useTimeZone() {
  return useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", () => "UTC");
}

export function formatDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
}

/** A remembered calendar date (YYYY-MM-DD) is a wall-calendar day, not an instant. */
export function formatCalendarDate(day: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** Local YYYY-MM-DD and HH:mm of an instant, for prefilled date/time pickers. */
export function localParts(iso: string, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone,
  }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function relativeDay(iso: string, timeZone: string, now = new Date()) {
  const day = (value: Date) => Date.parse(`${localParts(value.toISOString(), timeZone).date}T00:00:00Z`);
  const days = Math.round((day(now) - day(new Date(iso))) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return null;
}
