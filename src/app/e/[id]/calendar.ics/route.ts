import { eventIcs, eventPath } from "@/lib/events/model";
import { loadPublicEvent } from "@/lib/events/server";

export const dynamic = "force-dynamic";

/** The event as a calendar file, for "Add to calendar". */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await loadPublicEvent(id);
  if (!page || page.event.phase === "cancelled") return new Response("Not found", { status: 404 });
  const { event } = page;
  const body = eventIcs({ ...event, updated_at: new Date().toISOString() }, `https://setuvara.com${eventPath(event)}`);
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug || event.short_id}.ics"`,
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
