import { z } from "zod";

import { modeShortIdPattern } from "@/lib/share/mode-share";
import { getTapOwner, readTapJson, tapJson } from "@/lib/tap/server";

const rotateSchema = z.object({
  mode: z.enum(["event", "business"]),
  current: z.string().regex(modeShortIdPattern),
}).strict();

/**
 * Regenerates one Mode's share link. The owner's own session calls the
 * rotation, which compares against the link they are looking at, so a stale
 * tab cannot replace a newer one. Every older link to that Mode stops opening.
 */
export async function POST(request: Request) {
  const owner = await getTapOwner();
  if (!owner) return tapJson({ error: "unauthorized" }, 401);
  const parsed = await readTapJson(request, rotateSchema);
  if (!parsed.ok) return tapJson({ error: "invalid_request" }, 400);

  try {
    const { data, error } = await owner.supabase.rpc("rotate_mode_share_locator", {
      p_mode: parsed.data.mode,
      p_expected_short_id: parsed.data.current,
    });
    if (error) return tapJson({ error: "share_unavailable" }, 503);
    if (typeof data !== "string" || !modeShortIdPattern.test(data)) return tapJson({ error: "stale_link" }, 409);
    return tapJson({ path: `/s/${data}` });
  } catch {
    return tapJson({ error: "share_unavailable" }, 503);
  }
}
