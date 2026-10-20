import { z } from "zod";

import { hashIp } from "@/lib/actions/server";
import { COMMERCE_ERROR } from "@/lib/commerce/model";
import { commerceOrigin } from "@/lib/commerce/public";
import { json, signedInUser } from "@/lib/commerce/routes";
import { commerceEnabled, commerceProvider, createCommerceServiceClient } from "@/lib/commerce/server";
import { clientIp, createRateLimit, sameOrigin } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = createRateLimit({ windowMs: 10 * 60 * 1000, perIp: 12, perWindow: 600 });
const body = z.object({
  offerId: z.string().uuid(),
  email: z.string().max(254),
  name: z.string().max(120).default(""),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  /** Where Cancel in checkout returns to: a Setuvara page path only. */
  returnPath: z.string().max(300).regex(/^\/(s\/[A-Za-z0-9_-]+(\/p\/[0-9a-f-]{36})?|[a-z0-9_.-]{1,40})$/),
});

/**
 * Starts a paid checkout. The browser names a product; the database decides the
 * price, the fee and the seller, and opens the order. Checkout runs on the
 * creator's own Stripe account (a direct charge) with Setuvara's fee attached.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "This request could not be verified." }, 403);
  const provider = commerceProvider();
  if (!commerceEnabled() || !provider) return json({ error: COMMERCE_ERROR.payments_off }, 404);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Check your details and try again." }, 400);
  const input = parsed.data;
  const ip = clientIp(request);
  if (!limit.allowed(ip)) return json({ error: COMMERCE_ERROR.rate_limited }, 429);
  limit.record(ip);

  const user = await signedInUser();
  const service = createCommerceServiceClient();
  const { data, error } = await service.rpc("commerce_begin_checkout", {
    p_offer_id: input.offerId, p_buyer_user: user?.id ?? null, p_buyer_email: input.email, p_buyer_name: input.name,
    p_idempotency_key: input.idempotencyKey, p_ip_hash: hashIp(ip), p_provider: provider.code, p_livemode: provider.livemode,
  });
  if (error) {
    const key = Object.keys(COMMERCE_ERROR).find((code) => error.message?.includes(code));
    return json({ error: key ? COMMERCE_ERROR[key] : "Checkout didn't open. Try again." }, key ? (key === "rate_limited" ? 429 : 409) : 500);
  }
  const order = data as { order_id: string; existing: boolean; status: string; checkout_url?: string | null; expires_at?: string | null; provider_account_id: string; amount_minor?: number; currency?: string; platform_fee_minor?: number; title?: string; description?: string; creator_user_id?: string };
  // The same click again (or a refresh) gets the same open checkout back, never a second charge.
  if (order.existing) {
    if (order.status === "pending" && order.checkout_url && order.expires_at && Date.parse(order.expires_at) > Date.now() + 60_000) return json({ url: order.checkout_url });
    return json({ error: order.status === "paid" ? "You've already bought this. Check your email." : "That checkout closed. Refresh the page to start again." }, 409);
  }

  const origin = commerceOrigin(request.headers);
  const { data: creator } = await service.from("profiles").select("display_name").eq("id", order.creator_user_id!).maybeSingle();
  try {
    const checkout = await provider.createCheckout({
      orderId: order.order_id,
      sellerAccountId: order.provider_account_id,
      title: order.title!,
      description: order.description ?? "",
      amountMinor: order.amount_minor!,
      currency: order.currency!,
      platformFeeMinor: order.platform_fee_minor!,
      buyerEmail: input.email.trim().toLowerCase(),
      successUrl: `${origin}/purchase/${order.order_id}?session={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}${input.returnPath}`,
      expiresAt: Math.floor(Date.now() / 1000) + 31 * 60,
      creatorName: creator?.display_name ?? "Setuvara creator",
    });
    await service.rpc("commerce_attach_checkout", { p_order_id: order.order_id, p_checkout_id: checkout.checkoutId, p_checkout_url: checkout.url, p_expires_at: checkout.expiresAt });
    return json({ url: checkout.url });
  } catch (failure) {
    console.error("Checkout creation failed", { code: failure instanceof Error ? failure.message.slice(0, 80) : "unknown" });
    await service.rpc("commerce_set_order_state", { p_order_id: order.order_id, p_status: "failed", p_failure: "checkout_not_created" });
    return json({ error: "Checkout didn't open. Try again in a moment." }, 502);
  }
}
