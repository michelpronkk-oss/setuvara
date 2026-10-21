import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { deliverOrder } from "./fulfillment";
import type { CommerceProvider, PaymentFacts, VerifiedEvent } from "./provider";
import { storeSeller } from "./server";

type Outcome = "processed" | "ignored";

async function orderForPayment(service: SupabaseClient, provider: string, account: string, paymentId: string) {
  const { data } = await service.from("creator_orders").select("id").eq("provider", provider).eq("provider_account_id", account).eq("provider_payment_id", paymentId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Settles a paid checkout: the database checks amount, currency, seller and fee
 * against the order snapshot and moves it to paid once. Delivery and the
 * processing fee follow; both are safe to repeat.
 */
export async function settlePayment(service: SupabaseClient, provider: CommerceProvider, payment: PaymentFacts, eventId: string, origin: string): Promise<Outcome> {
  if (!payment.orderId || !payment.paymentId) return "ignored";
  const details = await provider.paymentDetails(payment.sellerAccountId, payment.paymentId);
  const { data, error } = await service.rpc("commerce_record_payment", {
    p_order_id: payment.orderId,
    p_provider: provider.code,
    p_checkout_id: payment.checkoutId,
    p_payment_id: payment.paymentId,
    p_amount_minor: payment.amountMinor,
    p_currency: payment.currency,
    p_account_id: payment.sellerAccountId,
    p_application_fee_minor: details.applicationFeeMinor,
    p_buyer_country: payment.buyerCountry,
    p_event_id: eventId,
  });
  if (error) throw new Error(error.message.includes("payment_mismatch") ? "payment_mismatch" : error.message.includes("order_not_found") ? "order_not_found" : "record_payment_failed");
  const result = data as { became_paid: boolean; status: string; offer_type?: string };
  if (details.processing) {
    await service.rpc("commerce_record_processing_fee", { p_order_id: payment.orderId, p_fee_minor: details.processing.feeMinor, p_currency: details.processing.currency, p_event_id: eventId });
  }
  if (result.became_paid && result.offer_type === "digital") await deliverOrder(service, payment.orderId, origin);
  return "processed";
}

export async function handleCommerceEvent(service: SupabaseClient, provider: CommerceProvider, verified: VerifiedEvent, origin: string): Promise<Outcome> {
  // Test events never touch live records and the other way round.
  if (verified.livemode !== provider.livemode) return "ignored";
  const event = verified.event;
  switch (event.kind) {
    case "seller.updated":
    case "seller.disconnected": {
      const { data } = await service.from("creator_payout_accounts").select("creator_user_id").eq("provider", provider.code).eq("provider_account_id", event.sellerAccountId).maybeSingle();
      if (!data) return "ignored";
      // The event is only a nudge; the account is re-read so out-of-order events can't regress it.
      const seller = await provider.retrieveSeller(event.sellerAccountId);
      await storeSeller(service, provider, data.creator_user_id, event.kind === "seller.disconnected" ? { ...seller, disconnected: true } : seller);
      return "processed";
    }
    case "checkout.completed":
    case "checkout.async_succeeded": {
      if (event.payment.paid) return settlePayment(service, provider, event.payment, verified.id, origin);
      if (!event.payment.orderId) return "ignored";
      // Bank debits and similar: the session completed but the money hasn't arrived.
      await service.rpc("commerce_set_order_state", { p_order_id: event.payment.orderId, p_status: "processing", p_failure: null });
      return "processed";
    }
    case "checkout.async_failed":
    case "checkout.expired": {
      if (!event.orderId) return "ignored";
      await service.rpc("commerce_set_order_state", { p_order_id: event.orderId, p_status: event.kind === "checkout.expired" ? "expired" : "failed", p_failure: event.kind === "checkout.expired" ? "checkout_expired" : "payment_failed" });
      return "processed";
    }
    case "refund.updated": {
      const refund = event.refund;
      const account = verified.accountId;
      if (!account || !refund.paymentId) return "ignored";
      // The order comes from the payment on this connected account, never from refund metadata alone:
      // a seller with their own API keys could write any order id there. Metadata only has to agree.
      const orderId = await orderForPayment(service, provider.code, account, refund.paymentId);
      if (!orderId || (refund.orderId && refund.orderId !== orderId)) return "ignored";
      let feeBack = 0;
      if (refund.status === "succeeded") {
        // Exact fee returned for this refund: the platform's running total minus what earlier refunds already recorded.
        const total = await provider.platformFeeRefundedTotal(account, refund.paymentId);
        const { data: earlier } = await service.from("creator_refunds").select("platform_fee_refunded_minor").eq("order_id", orderId).eq("status", "succeeded").neq("provider_refund_id", refund.refundId);
        feeBack = Math.max(total - (earlier ?? []).reduce((sum, row) => sum + Number(row.platform_fee_refunded_minor), 0), 0);
      }
      const { error } = await service.rpc("commerce_record_refund", {
        p_order_id: orderId, p_provider: provider.code, p_refund_id: refund.refundId, p_amount_minor: refund.amountMinor, p_currency: refund.currency,
        p_status: refund.status, p_fee_refunded_minor: feeBack, p_reason: refund.reason, p_requested_by: null,
      });
      if (error) throw new Error("record_refund_failed");
      return "processed";
    }
    case "dispute.updated": {
      const account = verified.accountId;
      if (!account || !event.dispute.paymentId) return "ignored";
      const orderId = await orderForPayment(service, provider.code, account, event.dispute.paymentId);
      if (!orderId) return "ignored";
      const d = event.dispute;
      const { error } = await service.rpc("commerce_record_dispute", { p_order_id: orderId, p_provider: provider.code, p_dispute_id: d.disputeId, p_amount_minor: d.amountMinor, p_currency: d.currency, p_status: d.status, p_reason: d.reason, p_evidence_due: d.evidenceDueBy });
      if (error) throw new Error("record_dispute_failed");
      return "processed";
    }
    case "payout.updated": {
      const p = event.payout;
      const { error } = await service.rpc("commerce_record_payout", { p_provider: provider.code, p_account_id: event.sellerAccountId, p_payout_id: p.payoutId, p_amount_minor: p.amountMinor, p_currency: p.currency, p_status: p.status, p_arrival: p.arrivalDate, p_failure: p.failureCode });
      if (error) throw new Error("record_payout_failed");
      return "processed";
    }
    default:
      return "ignored";
  }
}
