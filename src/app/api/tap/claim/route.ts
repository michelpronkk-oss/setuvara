import { z } from "zod";

import {
  getTapOwner,
  parseClaimResult,
  readTapJson,
  tapJson,
} from "@/lib/tap/server";

const claimSchema = z.object({
  claimSecret: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
}).strict();

export async function POST(request: Request) {
  const owner = await getTapOwner();
  if (!owner) return tapJson({ error: "unauthorized" }, 401);
  const parsed = await readTapJson(request, claimSchema);
  if (!parsed.ok) return tapJson({ error: "invalid_request" }, 400);
  try {
    const { data, error } = await owner.supabase.rpc("claim_tap_device", {
      p_claim_secret: parsed.data.claimSecret,
    });
    if (error) return tapJson({ error: "claim_unavailable" }, 503);
    const result = parseClaimResult(data);
    return result ? tapJson(result) : tapJson({ error: "claim_unavailable" }, 404);
  } catch {
    return tapJson({ error: "claim_unavailable" }, 503);
  }
}
