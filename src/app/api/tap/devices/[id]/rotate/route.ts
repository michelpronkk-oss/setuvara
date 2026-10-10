import { z } from "zod";

import {
  createTapToken,
  createTapUrl,
  getTapOwner,
  getTapOrigin,
  readTapJson,
  tapJson,
} from "@/lib/tap/server";

const idSchema = z.string().uuid();
const emptySchema = z.object({}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getTapOwner();
  if (!owner) return tapJson({ error: "unauthorized" }, 401);
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return tapJson({ error: "invalid_request" }, 400);
  const parsed = await readTapJson(request, emptySchema);
  if (!parsed.ok) return tapJson({ error: "invalid_request" }, 400);

  try {
    const origin = getTapOrigin();
    const { token, tokenHash } = createTapToken();
    const { data, error } = await owner.supabase.rpc("rotate_tap_device", {
      p_device_id: id.data,
      p_token_hash: tokenHash,
    });
    if (error) return tapJson({ error: "tap_unavailable" }, 503);
    if (data !== true) return tapJson({ error: "device_not_found" }, 404);
    return tapJson({ tapUrl: createTapUrl(token, origin) });
  } catch {
    return tapJson({ error: "tap_unavailable" }, 503);
  }
}
