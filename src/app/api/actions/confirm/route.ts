import { z } from "zod";

import { creatorActionsEnabled, createActionsServiceClient } from "@/lib/actions/server";
import { sameOrigin } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/) });

/** Confirms a giveaway entry or newsletter signup. Only a person pressing the button on the confirm page reaches this. */
export async function POST(request: Request) {
  if (!creatorActionsEnabled()) return Response.json({ error: "This isn't open yet." }, { status: 404 });
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: "The request could not be read." }, { status: 400 }); }
  const parsed = body.safeParse(raw);
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  let service;
  try { service = createActionsServiceClient(); } catch { return Response.json({ error: "Confirmation is offline right now." }, { status: 503 }); }
  const { data, error } = await service.rpc("confirm_action_entry", { p_token: parsed.data.token });
  if (error) return Response.json({ error: "That didn't work. Try again." }, { status: 500 });
  const result = data as { ok: boolean; reason?: string; title?: string; kind?: string; action_id?: string };
  // Confirmed entries and signups unlock the owner's thank-you and reward.
  const { data: thanks } = result.ok && result.action_id ? await service.rpc("action_thanks_for", { p_action_id: result.action_id }) : { data: null };
  return Response.json({ ok: result.ok, reason: result.reason ?? null, title: result.title ?? null, kind: result.kind ?? null, thanks: thanks ?? null }, { status: result.ok ? 200 : 410 });
}
