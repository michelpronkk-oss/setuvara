import { createActionsServiceClient } from "@/lib/actions/server";
import { readUnsubscribe } from "@/lib/audience/token";
import { clientIp, createRateLimit } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = createRateLimit({ windowMs: 10 * 60 * 1000, perIp: 30, perWindow: 3000 });

/** Opening the link shows a page with a button; only a POST unsubscribes, so link scanners can't. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  return Response.redirect(new URL(`/s/unsubscribe?t=${encodeURIComponent(token)}`, request.url), 303);
}

/**
 * One-click unsubscribe (RFC 8058) from mail apps, and the button on the unsubscribe page. The signed
 * token is the only credential; it removes that address from the campaign's lists for good.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!limit.allowed(ip)) return Response.json({ error: "Try again in a moment." }, { status: 429 });
  limit.record(ip);
  let token = new URL(request.url).searchParams.get("t");
  if (!token && request.headers.get("content-type")?.includes("application/json")) {
    const body = await request.json().catch(() => null) as { token?: unknown } | null;
    token = typeof body?.token === "string" ? body.token : null;
  }
  const recipientId = readUnsubscribe(token);
  if (!recipientId) return Response.json({ ok: false, error: "This link doesn't work." }, { status: 400 });
  let service;
  try { service = createActionsServiceClient(); } catch { return Response.json({ error: "Try again later." }, { status: 503 }); }
  const { data, error } = await service.rpc("audience_unsubscribe", { p_recipient_id: recipientId });
  if (error) return Response.json({ error: "That didn't work. Try again." }, { status: 500 });
  const result = data as { ok: boolean; lists?: string[] };
  return Response.json({ ok: result.ok, lists: result.lists ?? [] }, { status: result.ok ? 200 : 404 });
}
