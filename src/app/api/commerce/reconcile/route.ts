import { settlePayment } from "@/lib/commerce/events";
import { deliverOrder } from "@/lib/commerce/fulfillment";
import { commerceOrigin } from "@/lib/commerce/public";
import { commerceProvider, createCommerceServiceClient, refreshSeller } from "@/lib/commerce/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hourly safety net for missed webhooks, called by Supabase Cron (pg_cron +
 * pg_net) with a bearer secret that lives in Supabase Vault. Asks Stripe about
 * checkouts still open past their expiry, fills in processing fees not yet
 * known, retries failed deliveries, re-reads sellers that need attention, and
 * applies retention. Every step is safe to repeat; a lease keeps two runs from
 * overlapping and every run is logged in commerce_job_runs.
 */
export async function GET(request: Request) {
  const token = /^Bearer ([A-Za-z0-9]{32,128})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return Response.json({ error: "Not found." }, { status: 404 });
  const service = createCommerceServiceClient();
  const { data: valid } = await service.rpc("commerce_cron_token_valid", { p_token: token });
  if (valid !== true) return Response.json({ error: "Not found." }, { status: 404 });
  const { data: runId } = await service.rpc("commerce_job_begin", { p_job: "reconcile", p_lease_seconds: 300 });
  if (!runId) return Response.json({ skipped: "another run is active" }, { status: 409 });
  try {
    const report = await reconcile(service, request);
    await service.rpc("commerce_job_finish", { p_run_id: runId, p_ok: report.errors === 0, p_report: report, p_error: null });
    if (report.errors) console.error("Commerce reconcile finished with errors", report);
    return Response.json(report);
  } catch (failure) {
    const code = failure instanceof Error ? failure.message.slice(0, 120) : "unknown";
    await service.rpc("commerce_job_finish", { p_run_id: runId, p_ok: false, p_report: null, p_error: code });
    console.error("Commerce reconcile failed", { code });
    return Response.json({ error: "Reconcile failed." }, { status: 500 });
  }
}

async function reconcile(service: ReturnType<typeof createCommerceServiceClient>, request: Request) {
  const provider = commerceProvider();
  const origin = commerceOrigin(request.headers);
  const report = { checkouts: 0, settled: 0, fees: 0, deliveries: 0, sellers: 0, errors: 0, purge: null as unknown };

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
  report.purge = purge;
  return report;
}
