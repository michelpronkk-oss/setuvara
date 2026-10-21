import { creatorActionsEnabled } from "@/lib/actions/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A live Booking Action's open times. The database computes them from the owner's hours and every
 * time already held; it says only which times are free, never who holds the rest.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!creatorActionsEnabled() || !uuid.test(id)) return Response.json({ enabled: false }, { status: 404 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booking_slots", { p_action_id: id });
  if (error) return Response.json({ enabled: false }, { status: 503 });
  return Response.json(data ?? { enabled: false }, { headers: { "Cache-Control": "private, no-store" } });
}
