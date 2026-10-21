import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { EVENT_COLUMNS, eventPath, type EventRecord } from "./model";
import { renderGuestEmail, sendGuestEmail, type GuestEmailKind } from "./mail";
import { signGuestToken } from "./token";

type Service = SupabaseClient;

/** One guest email, with the private link signed for that registration. */
export async function emailGuest(service: Service, { origin, eventId, registration, kind }: {
  origin: string; eventId: string; registration: { id: string; email: string; token_version: number }; kind: GuestEmailKind;
}) {
  const { data: event } = await service.from("events").select(`${EVENT_COLUMNS}, profile_id`).eq("id", eventId).maybeSingle();
  if (!event) return "failed" as const;
  const { data: organizer } = await service.from("profiles").select("display_name").eq("id", event.profile_id).maybeSingle();
  const token = signGuestToken(registration.id, registration.token_version);
  const email = renderGuestEmail({
    kind,
    event: event as EventRecord,
    organizer: organizer?.display_name ?? "a Setuvara member",
    manageUrl: `${origin}/e/r/${token}`,
    eventUrl: `${origin}${eventPath(event as EventRecord)}`,
  });
  // A retry of the same email for the same state never sends twice.
  return sendGuestEmail(registration.email, email, `event-${kind}-${registration.id}-${registration.token_version}`);
}

/** Emails the database still owes guests (waitlist promotions), each taken once. */
export async function sendEventNotices(service: Service, origin: string, eventId: string) {
  const { data } = await service.rpc("take_event_notices", { p_event_id: eventId });
  const due = (data ?? []) as { id: string; email: string; notice: "promoted"; token_version: number }[];
  await Promise.all(due.map((row) => emailGuest(service, { origin, eventId, registration: row, kind: row.notice })));
  return due.length;
}
