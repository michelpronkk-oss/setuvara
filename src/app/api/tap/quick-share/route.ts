import { z } from "zod";

import { createQuickShareCandidate, parseQuickShareLocator, quickShareUrl } from "@/lib/tap/quick-share";
import { getTapOwner, getTapOrigin, readTapJson, tapJson } from "@/lib/tap/server";

const emptySchema = z.object({}).strict();

/** Idempotently creates the owner's stable locator, then returns its current public URL. */
export async function POST(request: Request) {
  const owner = await getTapOwner();
  if (!owner) return tapJson({ error: "unauthorized" }, 401);
  const parsed = await readTapJson(request, emptySchema);
  if (!parsed.ok) return tapJson({ error: "invalid_request" }, 400);

  try {
    const origin = getTapOrigin();
    const candidate = createQuickShareCandidate(owner.profileId);
    const { data, error } = await owner.supabase.rpc("ensure_quick_share_locator", {
      p_nonce: candidate.nonce,
      p_token_hash: candidate.tokenHash,
    });
    if (error) return tapJson({ error: "share_unavailable" }, 503);
    const locator = parseQuickShareLocator(data);
    return locator
      ? tapJson({ url: quickShareUrl(owner.profileId, locator, origin) })
      : tapJson({ error: "share_unavailable" }, 503);
  } catch {
    return tapJson({ error: "share_unavailable" }, 503);
  }
}
