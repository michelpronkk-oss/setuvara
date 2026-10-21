"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getPublicOrigin } from "@/lib/app/viewer";
import { sendEventNotices } from "@/lib/events/guests";
import { createEventsServiceClient } from "@/lib/events/server";
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
