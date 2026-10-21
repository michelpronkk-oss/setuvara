import { z } from "zod";

import { hashIp } from "@/lib/actions/server";
import { getPublicOrigin } from "@/lib/app/viewer";
import { emailGuest } from "@/lib/events/guests";
import { createEventsServiceClient, eventsEnabled } from "@/lib/events/server";
import { clientIp, createRateLimit, sameOrigin } from "@/lib/marketing/inquiry-mail";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_FILL_MS = 1500;
const limit = createRateLimit({ windowMs: 10 * 60 * 1000, perIp: 10, perWindow: 1000 });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const body = z.object({
  name: z.string().max(80),
  email: z.string().max(254),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  openedAt: z.number().int().positive(),
  /** The spam trap: hidden from people, filled by bots. */
  hp: z.string().max(200).default(""),
});

const REFUSALS: Record<string, [number, string]> = {
  event_unavailable: [404, "This event isn't available."],
  event_cancelled: [410, "This event was cancelled."],
  registration_closed: [410, "Registration has closed."],
  registration_not_open: [409, "Registration isn't open yet."],
  event_full: [409, "This event is full."],
  rate_limited: [429, "A few too many tries. Try again later."],
  name_required: [400, "Add your name."],
  email_required: [400, "Add your email."],
  invalid_email: [400, "Check your email address."],
  own_event: [400, "This is your own event."],
};

/**
 * A guest registers for a published event. The route checks origin, the spam trap, fill time and
 * per-IP limits; one database function then takes the event's row lock and decides seat or waitlist,
 * so two people can never get the last seat. The guest's email carries their private link.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!eventsEnabled()) return Response.json({ error: "This isn't open yet." }, { status: 404 });
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  const { id } = await params;
  if (!uuid.test(id)) return Response.json({ error: "Not found." }, { status: 404 });

  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: "The form could not be read." }, { status: 400 }); }
  const parsed = body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Check the form and try again." }, { status: 400 });
  const input = parsed.data;
  // Bots get a quiet answer so they don't learn what tripped them.
  if (input.hp || Date.now() - input.openedAt < MIN_FILL_MS) return Response.json({ ok: true, status: "confirmed" }, { status: 202 });

  const ip = clientIp(request);
  if (!limit.allowed(ip)) return Response.json({ error: REFUSALS.rate_limited[1] }, { status: 429 });
  limit.record(ip);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const attendee = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;

  let service;
  try { service = createEventsServiceClient(); } catch { return Response.json({ error: "Registration is offline right now." }, { status: 503 }); }
  const { data, error } = await service.rpc("register_for_event", {
    p_event_id: id, p_attendee: attendee, p_name: input.name, p_email: input.email, p_idempotency_key: input.idempotencyKey, p_ip_hash: hashIp(ip),
  });
  if (error) {
    const refusal = Object.entries(REFUSALS).find(([key]) => error.message?.includes(key))?.[1];
    if (refusal) return Response.json({ error: refusal[1] }, { status: refusal[0] });
    console.error("Event registration failed", { code: error.code });
    return Response.json({ error: "That didn't go through. Try again." }, { status: 500 });
  }

  const result = data as { id: string; status: "confirmed" | "waitlisted" | "cancelled"; duplicate: boolean; token_version: number; shown_status?: "confirmed" | "waitlisted" };
  const origin = await getPublicOrigin(request.headers);
  // A new guest gets their confirmation; someone already on the list gets their own link again,
  // sent to the address on file, so typing another person's email reveals and changes nothing.
  const kind = result.duplicate && result.shown_status ? "reminder_link" : result.status === "waitlisted" ? "waitlisted" : "confirmed";
  const { data: guest } = await service.from("event_registrations").select("email").eq("id", result.id).maybeSingle();
  if (guest && result.status !== "cancelled") {
    await emailGuest(service, { origin, eventId: id, registration: { id: result.id, email: guest.email, token_version: result.token_version }, kind });
  }
  return Response.json({ ok: true, status: result.shown_status ?? result.status }, { status: result.duplicate ? 200 : 201 });
}
