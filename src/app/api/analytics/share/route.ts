import { z } from "zod";

import { recordProductAnalyticsEvent } from "@/lib/analytics/events";
import { getConfirmedBillingUser } from "@/lib/billing/auth";
import { isSameOriginJsonRequest } from "@/lib/billing/http";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  mode: z.enum(["personal", "event", "business"]),
  action: z.enum(["copy", "native_share", "qr_open"]),
  requestId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  const noStore = { "Cache-Control": "private, no-store" };
  if (!isSameOriginJsonRequest(request)) return Response.json({ error: "invalid_request" }, { status: 403, headers: noStore });
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400, headers: noStore });
  const user = await getConfirmedBillingUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  try {
    const supabase = await createClient();
    const { data: profile, error } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (error || !profile) return Response.json({ error: "analytics_unavailable" }, { status: 503, headers: noStore });
    const recorded = await recordProductAnalyticsEvent({
      eventName: "profile_shared",
      ownerProfileId: profile.id,
      mode: parsed.data.mode,
      source: parsed.data.action === "native_share" ? "native_share" : parsed.data.action === "qr_open" ? "qr" : "share",
      idempotencyKey: parsed.data.requestId,
    });
    if (!recorded) return Response.json({ error: "analytics_unavailable" }, { status: 503, headers: noStore });
    return Response.json({ recorded: true }, { headers: noStore });
  } catch {
    return Response.json({ error: "analytics_unavailable" }, { status: 503, headers: noStore });
  }
}
