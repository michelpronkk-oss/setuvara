import { z } from "zod";

import {
  getTapOwner,
  parseEquippedState,
  readTapJson,
  tapIntentSchema,
  tapJson,
  tapModeSchema,
} from "@/lib/tap/server";

const updateSchema = z.object({
  mode: tapModeSchema,
  intent: tapIntentSchema,
}).strict();

export async function GET() {
  const owner = await getTapOwner();
  if (!owner) return tapJson({ error: "unauthorized" }, 401);
  try {
    const { data, error } = await owner.supabase.rpc("get_equipped_share_state");
    if (error) return tapJson({ error: "tap_unavailable" }, 503);
    const state = parseEquippedState(data);
    return state ? tapJson({ state }) : tapJson({ error: "tap_unavailable" }, 503);
  } catch {
    return tapJson({ error: "tap_unavailable" }, 503);
  }
}

export async function PUT(request: Request) {
  const owner = await getTapOwner();
  if (!owner) return tapJson({ error: "unauthorized" }, 401);
  const parsed = await readTapJson(request, updateSchema);
  if (!parsed.ok) return tapJson({ error: "invalid_request" }, 400);
  try {
    const { data, error } = await owner.supabase.rpc("set_equipped_share_state", {
      p_mode: parsed.data.mode,
      p_intent: parsed.data.intent,
    });
    if (error) return tapJson({ error: "tap_unavailable" }, 503);
    const state = parseEquippedState(data);
    return state ? tapJson({ state }) : tapJson({ error: "tap_unavailable" }, 503);
  } catch {
    return tapJson({ error: "tap_unavailable" }, 503);
  }
}
