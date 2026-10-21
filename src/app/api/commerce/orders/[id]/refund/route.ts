import { z } from "zod";

import { refundable } from "@/lib/commerce/model";
import { json, signedInUser } from "@/lib/commerce/routes";
import { commerceProvider, createCommerceServiceClient } from "@/lib/commerce/server";
import { sameOrigin } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ amountMinor: z.number().int().positive().optional(), idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/) });

/**
 * The creator refunds a buyer from the studio. The refund is made on the creator's
 * own Stripe account (they are the seller) and Setuvara's fee comes back in
 * proportion. The order changes when the refund succeeds; the webhook confirms it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return json({ error: "This request could not be verified." }, 403);
  const user = await signedInUser();
  if (!user) return json({ error: "Sign in first." }, 401);
  const provider = commerceProvider();
  if (!provider) return json({ error: "Payments aren't open yet." }, 503);
  const { id } = await params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return json({ error: "Check the amount." }, 400);

  // Ownership comes from the creator's own read (RLS); the service client only acts after it.
  const { data: own } = await user.supabase.from("creator_orders").select("id, creator_user_id, order_kind, status, gross_amount_minor, amount_refunded_minor, currency").eq("id", id).eq("creator_user_id", user.id).maybeSingle();
  if (!own) return json({ error: "Order not found." }, 404);
  const max = refundable(own);
  const amount = parsed.data.amountMinor ?? max;
  if (max === 0 || amount > max) return json({ error: max === 0 ? "This order can't be refunded." : "That's more than what's left to refund." }, 409);

  const service = createCommerceServiceClient();
  const { data: order } = await service.from("creator_orders").select("provider, provider_account_id, provider_payment_id, platform_fee_amount_minor").eq("id", id).maybeSingle();
  if (!order?.provider_payment_id || order.provider !== provider.code || !order.provider_account_id) return json({ error: "This order can't be refunded here." }, 409);
  try {
    const refund = await provider.refund({ sellerAccountId: order.provider_account_id, paymentId: order.provider_payment_id, amountMinor: amount, orderId: id, idempotencyKey: `refund-${id}-${parsed.data.idempotencyKey}`, refundPlatformFee: Number(order.platform_fee_amount_minor) > 0 });
    let feeBack = 0;
    if (refund.status === "succeeded") {
      const total = await provider.platformFeeRefundedTotal(order.provider_account_id, order.provider_payment_id);
      const { data: earlier } = await service.from("creator_refunds").select("platform_fee_refunded_minor").eq("order_id", id).eq("status", "succeeded").neq("provider_refund_id", refund.refundId);
      feeBack = Math.max(total - (earlier ?? []).reduce((sum, row) => sum + Number(row.platform_fee_refunded_minor), 0), 0);
    }
    const { data } = await service.rpc("commerce_record_refund", {
      p_order_id: id, p_provider: provider.code, p_refund_id: refund.refundId, p_amount_minor: refund.amountMinor, p_currency: refund.currency,
      p_status: refund.status, p_fee_refunded_minor: feeBack, p_reason: refund.reason, p_requested_by: user.id,
    });
    return json({ ok: true, refund: refund.status, order: data });
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : "";
    console.error("Refund failed", { code: message.slice(0, 80) });
    return json({ error: /insufficient|balance/i.test(message) ? "Your Stripe balance can't cover this refund yet. Stripe will retry, or add funds in Stripe." : "Stripe didn't make the refund. Try again or refund in your Stripe Dashboard." }, 502);
  }
}
