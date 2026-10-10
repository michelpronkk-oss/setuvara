import { z } from "zod";

import { getTapOwner, readTapJson, tapJson } from "@/lib/tap/server";

const idSchema = z.string().uuid();
const statusSchema = z.object({ status: z.enum(["active", "disabled", "lost", "retired"]) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getTapOwner();
  if (!owner) return tapJson({ error: "unauthorized" }, 401);
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return tapJson({ error: "invalid_request" }, 400);
  const parsed = await readTapJson(request, statusSchema);
  if (!parsed.ok) return tapJson({ error: "invalid_request" }, 400);

  try {
    const { data, error } = await owner.supabase.rpc("set_tap_device_status", {
      p_device_id: id.data,
      p_status: parsed.data.status,
    });
    if (error) return tapJson({ error: "tap_unavailable" }, 503);
    return data === true ? tapJson({ updated: true }) : tapJson({ error: "device_not_found" }, 404);
  } catch {
    return tapJson({ error: "tap_unavailable" }, 503);
  }
}
