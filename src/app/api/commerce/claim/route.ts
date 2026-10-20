import { z } from "zod";

import { hashIp } from "@/lib/actions/server";
import { COMMERCE_ERROR } from "@/lib/commerce/model";
import { deliverOrder } from "@/lib/commerce/fulfillment";
import { commerceOrigin } from "@/lib/commerce/public";
import { json, signedInUser } from "@/lib/commerce/routes";
import { commerceEnabled, createCommerceServiceClient } from "@/lib/commerce/server";
import { clientIp, createRateLimit, sameOrigin } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_FILL_MS = 1500;
const limit = createRateLimit({ windowMs: 10 * 60 * 1000, perIp: 8, perWindow: 400 });
const body = z.object({
  offerId: z.string().uuid(),
  email: z.string().max(254),
  name: z.string().max(120).default(""),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  openedAt: z.number().int().positive(),
  hp: z.string().max(200).default(""),
});

/** A free product: the link goes to the email given, so only its owner can download. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "This request could not be verified." }, 403);
  if (!commerceEnabled()) return json({ error: COMMERCE_ERROR.payments_off }, 404);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Check your email and try again." }, 400);
  const input = parsed.data;
  if (input.hp || Date.now() - input.openedAt < MIN_FILL_MS) return json({ ok: true }, 202);
  const ip = clientIp(request);
  if (!limit.allowed(ip)) return json({ error: COMMERCE_ERROR.rate_limited }, 429);
  limit.record(ip);

  const user = await signedInUser();
  const service = createCommerceServiceClient();
  const { data, error } = await service.rpc("commerce_claim_free", {
    p_offer_id: input.offerId, p_buyer_user: user?.id ?? null, p_buyer_email: input.email, p_buyer_name: input.name,
    p_idempotency_key: input.idempotencyKey, p_ip_hash: hashIp(ip),
  });
  if (error) {
    const key = Object.keys(COMMERCE_ERROR).find((code) => error.message?.includes(code));
    return json({ error: key ? COMMERCE_ERROR[key] : "That didn't work. Try again." }, key ? 409 : 500);
  }
  const order = data as { order_id: string; existing: boolean };
  if (order.existing) return json({ ok: true }, 202);
  const delivered = await deliverOrder(service, order.order_id, commerceOrigin(request.headers));
  if (delivered !== "delivered") return json({ error: "We couldn't send the email. Try again later." }, 503);
  return json({ ok: true }, 202);
}
