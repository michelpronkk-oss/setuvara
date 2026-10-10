import { z } from "zod";

import {
  getTapOwner,
  readTapJson,
  tapDeviceKindSchema,
  tapJson,
} from "@/lib/tap/server";

const idSchema = z.string().uuid();
const updateSchema = z.object({
  label: z.string().trim().min(1).max(60),
  kind: tapDeviceKindSchema,
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getTapOwner();
  if (!owner) return tapJson({ error: "unauthorized" }, 401);
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return tapJson({ error: "invalid_request" }, 400);
  const parsed = await readTapJson(request, updateSchema);
  if (!parsed.ok) return tapJson({ error: "invalid_request" }, 400);

  try {
    const { data, error } = await owner.supabase.rpc("update_tap_device", {
      p_device_id: id.data,
      p_label: parsed.data.label,
      p_kind: parsed.data.kind,
    });
    if (error) return tapJson({ error: "tap_unavailable" }, 503);
    return data === true ? tapJson({ updated: true }) : tapJson({ error: "device_not_found" }, 404);
  } catch {
    return tapJson({ error: "tap_unavailable" }, 503);
  }
}
