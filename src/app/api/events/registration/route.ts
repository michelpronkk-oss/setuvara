import { z } from "zod";

import { getPublicOrigin } from "@/lib/app/viewer";
import { sendEventNotices } from "@/lib/events/guests";
import { createEventsServiceClient, eventsEnabled } from "@/lib/events/server";
import { readGuestToken } from "@/lib/events/token";
import { sameOrigin } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.discriminatedUnion("intent", [
  z.object({ token: z.string().max(100), intent: z.literal("cancel") }),
  z.object({ token: z.string().max(100), intent: z.literal("connect"), connect: z.boolean() }),
]);

/**
 * A guest acts from their private link: cancel, or (a member) choose to connect at check-in. The signature is checked here and the version again in
 * the database, so an old or altered link does nothing. The freed seat goes to the waitlist at once.
 */
export async function POST(request: Request) {
  if (!eventsEnabled()) return Response.json({ error: "This isn't open yet." }, { status: 404 });
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: "The request could not be read." }, { status: 400 }); }
  const parsed = body.safeParse(raw);
  const guest = parsed.success ? readGuestToken(parsed.data.token) : null;
  if (!parsed.success || !guest) return Response.json({ error: "This link doesn't work." }, { status: 404 });

  let service;
  try { service = createEventsServiceClient(); } catch { return Response.json({ error: "This is offline right now." }, { status: 503 }); }

  const input = parsed.data;
  if (input.intent === "connect") {
    const { data, error } = await service.rpc("set_event_connect_preference", { p_registration_id: guest.id, p_token_version: guest.version, p_connect: input.connect });
    if (error) {
      if (error.message?.includes("registration_not_found") || error.message?.includes("not_a_member")) return Response.json({ error: "This link doesn't work." }, { status: 404 });
      if (error.message?.includes("registration_cancelled")) return Response.json({ error: "This registration was cancelled." }, { status: 410 });
      console.error("Event connect preference failed", { code: error.code });
      return Response.json({ error: "That didn't go through. Try again." }, { status: 500 });
    }
    const result = data as { connect: boolean; connected: boolean };
    return Response.json({ ok: true, connect: result.connect, connected: result.connected });
  }

  const { data, error } = await service.rpc("cancel_event_registration", { p_registration_id: guest.id, p_token_version: guest.version });
  if (error) {
    if (error.message?.includes("registration_not_found")) return Response.json({ error: "This link doesn't work." }, { status: 404 });
    if (error.message?.includes("event_ended")) return Response.json({ error: "This event has ended." }, { status: 410 });
    console.error("Event cancellation failed", { code: error.code });
    return Response.json({ error: "That didn't go through. Try again." }, { status: 500 });
  }
  const result = data as { promoted: number };
  if (result.promoted > 0) {
    const { data: row } = await service.from("event_registrations").select("event_id").eq("id", guest.id).maybeSingle();
    if (row) await sendEventNotices(service, await getPublicOrigin(request.headers), row.event_id);
  }
  return Response.json({ ok: true, status: "cancelled" });
}
