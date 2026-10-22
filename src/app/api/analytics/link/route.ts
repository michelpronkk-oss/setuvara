import { z } from "zod";

import { createBillingAdminClient } from "@/lib/billing/admin";
import { clientIp, createRateLimit, sameOrigin } from "@/lib/marketing/inquiry-mail";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = createRateLimit({ windowMs: 10 * 60 * 1000, perIp: 120, perWindow: 20000 });
const body = z.object({ linkId: z.string().uuid() });

/**
 * Counts a tap on a link of a public page. Only a daily total per link is stored: no IP, cookie,
 * referrer or visitor id. The owner's own taps don't count.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const ip = clientIp(request);
  if (!limit.allowed(ip)) return new Response(null, { status: 429 });
  limit.record(ip);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const { data: claims } = await (await createClient()).auth.getClaims();
  const viewer = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  try {
    await createBillingAdminClient().rpc("record_link_click", { p_link_id: parsed.data.linkId, p_viewer: viewer });
  } catch {
    // Counting never gets in a visitor's way.
  }
  return new Response(null, { status: 204 });
}
