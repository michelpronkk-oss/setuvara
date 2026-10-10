import { z } from "zod";

import { createQuickShareCandidate, parseQuickShareLocator, quickShareUrl } from "@/lib/tap/quick-share";
import { getTapOwner, getTapOrigin, readTapJson, tapJson } from "@/lib/tap/server";

const emptySchema = z.object({}).strict();

export async function POST(request: Request) {
  const owner = await getTapOwner();
  if (!owner) return tapJson({ error: "unauthorized" }, 401);
  const parsed = await readTapJson(request, emptySchema);
  if (!parsed.ok) return tapJson({ error: "invalid_request" }, 400);

  try {
    const origin = getTapOrigin();
    const currentCandidate = createQuickShareCandidate(owner.profileId);
    const { data: currentData, error: currentError } = await owner.supabase.rpc("ensure_quick_share_locator", {
      p_nonce: currentCandidate.nonce,
      p_token_hash: currentCandidate.tokenHash,
    });
    const current = parseQuickShareLocator(currentData);
    if (currentError || !current) return tapJson({ error: "share_unavailable" }, 503);
    const candidate = createQuickShareCandidate(owner.profileId);
    const { data, error } = await owner.supabase.rpc("rotate_quick_share_locator", {
      p_expected_token_hash: `\\x${current.token_hash}`,
      p_nonce: candidate.nonce,
      p_token_hash: candidate.tokenHash,
    });
    if (error) return tapJson({ error: "share_unavailable" }, 503);
    const locator = parseQuickShareLocator(data);
    return locator
      ? tapJson({ url: quickShareUrl(owner.profileId, locator, origin) })
      : tapJson({ error: "share_changed" }, 409);
  } catch {
    return tapJson({ error: "share_unavailable" }, 503);
  }
}
