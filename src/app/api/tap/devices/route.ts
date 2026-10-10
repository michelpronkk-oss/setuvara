import { z } from "zod";

import {
  createTapToken,
  createTapUrl,
  getTapOwner,
  getTapOrigin,
  parseTapDeviceList,
  readTapJson,
  tapDeviceKindSchema,
  tapJson,
} from "@/lib/tap/server";

const createSchema = z.object({
  label: z.string().trim().min(1).max(60),
  kind: tapDeviceKindSchema,
}).strict();

export async function GET() {
  const owner = await getTapOwner();
  if (!owner) return tapJson({ error: "unauthorized" }, 401);
  try {
    const { data, error } = await owner.supabase.rpc("list_tap_devices");
    if (error) return tapJson({ error: "tap_unavailable" }, 503);
    const devices = parseTapDeviceList(data);
    return devices ? tapJson({ devices }) : tapJson({ error: "tap_unavailable" }, 503);
  } catch {
    return tapJson({ error: "tap_unavailable" }, 503);
  }
}

export async function POST(request: Request) {
  const owner = await getTapOwner();
  if (!owner) return tapJson({ error: "unauthorized" }, 401);
  const parsed = await readTapJson(request, createSchema);
  if (!parsed.ok) return tapJson({ error: "invalid_request" }, 400);

  try {
    const origin = getTapOrigin();
    const { token, tokenHash } = createTapToken();
    const { data, error } = await owner.supabase.rpc("create_tap_device", {
      p_label: parsed.data.label,
      p_kind: parsed.data.kind,
      p_token_hash: tokenHash,
    });
    const id = z.string().uuid().safeParse(data);
    if (error || !id.success) return tapJson({ error: "tap_unavailable" }, 503);
    return tapJson({ device: { id: id.data, label: parsed.data.label, kind: parsed.data.kind }, tapUrl: createTapUrl(token, origin) }, 201);
  } catch {
    return tapJson({ error: "tap_unavailable" }, 503);
  }
}
