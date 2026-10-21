import { z } from "zod";

import { creatorActionsEnabled, createActionsServiceClient } from "@/lib/actions/server";
import { clientIp, createRateLimit, sameOrigin } from "@/lib/marketing/inquiry-mail";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = createRateLimit({ windowMs: 10 * 60 * 1000, perIp: 120, perWindow: 20000 });
const body = z.object({ kind: z.enum(["view", "open"]), ids: z.array(z.string().uuid()).min(1).max(24) });

/**
 * Counts that visitors saw an Action's card or opened its page. Only daily totals are stored: no IP,
 * cookie or visitor id. The owner's own visits don't count.
 */
export async function POST(request: Request) {
  if (!creatorActionsEnabled()) return new Response(null, { status: 204 });
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const ip = clientIp(request);
  if (!limit.allowed(ip)) return new Response(null, { status: 429 });
  limit.record(ip);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const { data: claims } = await (await createClient()).auth.getClaims();
  const viewer = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  try {
    await createActionsServiceClient().rpc("record_action_event", { p_action_ids: [...new Set(parsed.data.ids)], p_kind: parsed.data.kind, p_viewer: viewer });
  } catch {
    // Counting never gets in a visitor's way.
  }
  return new Response(null, { status: 204 });
}
