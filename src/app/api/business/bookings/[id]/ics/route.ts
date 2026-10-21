import { bookingIcs, BOOKING_COLUMNS, type Booking } from "@/lib/business/bookings";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A confirmed booking as a calendar file, for its owner. Rows come through the owner's RLS-limited client. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") return new Response("Sign in", { status: 401 });
  const { data } = await supabase.from("business_bookings").select(BOOKING_COLUMNS).eq("id", id).maybeSingle();
  const booking = data as Booking | null;
  if (!booking || booking.status !== "confirmed") return new Response("Not found", { status: 404 });
  const [{ data: action }, { data: request }] = await Promise.all([
    supabase.from("profile_actions").select("title").eq("id", booking.action_id).maybeSingle(),
    supabase.from("action_submissions").select("name, email, answers").eq("id", booking.submission_id).maybeSingle(),
  ]);
  const answers = (request?.answers ?? {}) as Record<string, string>;
  const body = bookingIcs({
    id: booking.id, startsAt: booking.starts_at, endsAt: booking.ends_at, title: action?.title ?? "Booking",
    attendee: request?.name || request?.email || "Guest",
    note: [request?.email, answers.company, answers.message].filter(Boolean).join("\n"),
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${booking.starts_at.slice(0, 10)}.ics"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
