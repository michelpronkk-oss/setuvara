import { settlePayment } from "@/lib/commerce/events";
import { deliverOrder } from "@/lib/commerce/fulfillment";
import { commerceOrigin } from "@/lib/commerce/public";
import { commerceProvider, createCommerceServiceClient, refreshSeller } from "@/lib/commerce/server";
import { sameSecret } from "@/lib/social/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hourly safety net for missed webhooks (CRON_SECRET). Asks Stripe about
 * checkouts still open past their expiry, fills in processing fees not yet
 * known, retries failed deliveries, re-reads sellers that need attention, and
 * applies retention. Every step is safe to repeat.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return Response.json({ error: "Not found." }, { status: 404 });
  const provider = commerceProvider();
  const service = createCommerceServiceClient();
  const origin = commerceOrigin(request.headers);
  const report = { checkouts: 0, settled: 0, fees: 0, deliveries: 0, sellers: 0, errors: 0 };

  if (provider) {
    const stale = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: open } = await service.from("creator_orders").select("id, provider_account_id, provider_checkout_id")
      .eq("provider", provider.code).eq("livemode", provider.livemode).in("status", ["pending", "processing"]).not("provider_checkout_id", "is", null).lt("expires_at", stale).limit(50);
    for (const order of open ?? []) {
      report.checkouts += 1;
      try {
        const checkout = await provider.retrieveCheckout(order.provider_account_id!, order.provider_checkout_id!);
        if (checkout.payment.paid) { await settlePayment(service, provider, { ...checkout.payment, orderId: order.id }, `reconcile-${order.provider_checkout_id}`, origin); report.settled += 1; }
        else if (checkout.status === "expired") await service.rpc("commerce_set_order_state", { p_order_id: order.id, p_status: "expired", p_failure: "checkout_expired" });
      } catch { report.errors += 1; }
    }
    const { data: unpriced } = await service.from("creator_orders").select("id, provider_account_id, provider_payment_id")
      .eq("provider", provider.code).eq("livemode", provider.livemode).is("provider_fee_amount_minor", null).not("provider_payment_id", "is", null).limit(50);
    for (const order of unpriced ?? []) {
      try {
        const details = await provider.paymentDetails(order.provider_account_id!, order.provider_payment_id!);
        if (details.processing) { await service.rpc("commerce_record_processing_fee", { p_order_id: order.id, p_fee_minor: details.processing.feeMinor, p_currency: details.processing.currency, p_event_id: `reconcile-fee-${order.id}` }); report.fees += 1; }
      } catch { report.errors += 1; }
    }
    const { data: sellers } = await service.from("creator_payout_accounts").select("creator_user_id")
      .eq("provider", provider.code).is("disconnected_at", null).or("status.neq.enabled,synced_at.lt." + new Date(Date.now() - 24 * 3600_000).toISOString()).limit(25);
    for (const seller of sellers ?? []) {
      try { await refreshSeller(service, provider, seller.creator_user_id); report.sellers += 1; } catch { report.errors += 1; }
    }
  }

  const { data: undelivered } = await service.from("creator_orders").select("id").eq("offer_type", "digital").in("status", ["paid", "partially_refunded"]).in("fulfillment_status", ["pending", "failed"]).lt("delivery_attempts", 5).limit(25);
  for (const order of undelivered ?? []) if ((await deliverOrder(service, order.id, origin)) === "delivered") report.deliveries += 1;

  const { data: purge } = await service.rpc("commerce_purge");
  return Response.json({ ...report, purge });
}
