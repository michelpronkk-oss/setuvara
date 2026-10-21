"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getPublicOrigin } from "@/lib/app/viewer";
import { sendEventNotices } from "@/lib/events/guests";
import { passTokenFromScan, type ScanResult } from "@/lib/events/model";
import { createEventsServiceClient } from "@/lib/events/server";
import { readPassToken } from "@/lib/events/token";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in organizer's own event, read under RLS, or null. */
async function ownEvent(eventId: string) {
  if (!UUID.test(eventId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("id").eq("id", eventId).maybeSingle();
  return data ? supabase : null;
}

/** After an edit that can free seats: email the guests the waitlist just promoted. */
export async function settleEvent(eventId: string) {
  if (!(await ownEvent(eventId))) return { ok: false as const };
  const sent = await sendEventNotices(createEventsServiceClient(), await getPublicOrigin(await headers()), eventId).catch(() => 0);
  revalidatePath(`/app/identity/events/${eventId}`);
  return { ok: true as const, promoted: sent };
}

/** The organizer takes a guest off the list. Their seat goes to the waitlist straight away. */
export async function cancelGuest(eventId: string, registrationId: string) {
  const supabase = await ownEvent(eventId);
  if (!supabase || !UUID.test(registrationId)) return { ok: false as const, error: "Not found." };
  const { error } = await supabase.rpc("owner_cancel_event_registration", { p_registration_id: registrationId });
  if (error) return { ok: false as const, error: error.message?.includes("event_ended") ? "This event has ended." : "That didn't go through. Try again." };
  return settleEvent(eventId);
}

const CHECK_IN_ERRORS: Record<string, string> = {
  check_in_not_open: "Check-in opens 12 hours before the start.",
  check_in_closed: "Check-in has closed for this event.",
  guest_not_going: "Only guests who are going can be checked in.",
  event_cancelled: "This event was cancelled.",
  registration_not_found: "This guest isn't on your list.",
};

/** The organizer checks a guest in, or takes it back. A member who asked is connected in the same step. */
export async function checkInGuest(eventId: string, registrationId: string, checkedIn: boolean) {
  const supabase = await ownEvent(eventId);
  if (!supabase || !UUID.test(registrationId)) return { ok: false as const, error: "Not found." };
  const { data, error } = await supabase.rpc("owner_check_in_event_registration", { p_registration_id: registrationId, p_checked_in: checkedIn });
  if (error) {
    const known = Object.entries(CHECK_IN_ERRORS).find(([key]) => error.message?.includes(key))?.[1];
    return { ok: false as const, error: known ?? "That didn't go through. Try again." };
  }
  revalidatePath(`/app/identity/events/${eventId}`);
  const result = data as { checked_in_at: string | null; connected: boolean };
  return { ok: true as const, checkedInAt: result.checked_in_at, connected: result.connected };
}

export type ScanOutcome =
  | { ok: true; result: ScanResult; guest: { name: string; status: string; checked_in_at: string | null; connected: boolean } | null; otherEvent: string | null; checkedIn: number; going: number }
  | { ok: false; error: string };

/**
 * One scan at the door. The pass signature is checked here; the database checks the version, the
 * event, the guest and the time, and lets each pass in once.
 */
export async function scanPass(eventId: string, scanned: string): Promise<ScanOutcome> {
  const supabase = await ownEvent(eventId);
  if (!supabase) return { ok: false, error: "Not found." };
  const token = typeof scanned === "string" ? passTokenFromScan(scanned) : null;
  const pass = token ? readPassToken(token) : null;
  if (!pass) return { ok: true, result: "invalid", guest: null, otherEvent: null, checkedIn: -1, going: -1 };
  const { data, error } = await supabase.rpc("owner_scan_event_pass", { p_event_id: eventId, p_registration_id: pass.id, p_token_version: pass.version });
  if (error) {
    if (error.message?.includes("rate_limited")) return { ok: false, error: "Too many scans in a minute. Wait a moment." };
    if (error.message?.includes("event_cancelled")) return { ok: false, error: "This event was cancelled." };
    return { ok: false, error: "That scan didn't go through. Try again." };
  }
  const row = data as { result: ScanResult; guest: { name: string; status: string; checked_in_at: string | null; connected: boolean } | null; other_event: string | null; checked_in: number; going: number };
  if (row.result === "checked_in") revalidatePath(`/app/identity/events/${eventId}`);
  return { ok: true, result: row.result, guest: row.guest, otherEvent: row.other_event, checkedIn: row.checked_in, going: row.going };
}
