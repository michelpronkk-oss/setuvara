import "server-only";

import Stripe from "stripe";

import type { SellerCountry } from "./model";
import type { Balance, CheckoutRequest, CommerceEvent, CommerceProvider, PaymentFacts, RefundFacts, SellerSnapshot, VerifiedEvent } from "./provider";

/**
 * Stripe Connect with direct charges. The creator's own Stripe account is the
 * merchant of record: the charge, the receipt, the statement descriptor, the
 * Stripe fee, refunds and disputes all sit on that account. Setuvara takes an
 * application fee per charge. Accounts (Accounts v2, merchant configuration) use the full Stripe Dashboard (the
 * pairing Stripe documents for direct charges), the account pays its own
 * Stripe fees, and Stripe is liable for negative balances.
 */

const CAPABILITY = (value: string | undefined): SellerSnapshot["cardPayments"] =>
  value === "active" || value === "pending" || value === "inactive" ? value : "unrequested";

/** Accounts carry no mode flag; it's the mode of the key that read them. */
export function sellerFromAccount(account: Stripe.Account, livemode: boolean): SellerSnapshot {
  const requirements = account.requirements;
  return {
    accountId: account.id,
    country: account.country ?? null,
    defaultCurrency: account.default_currency?.toUpperCase() ?? null,
    chargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
    detailsSubmitted: account.details_submitted === true,
    cardPayments: CAPABILITY(account.capabilities?.card_payments),
    transfers: CAPABILITY(account.capabilities?.transfers),
    currentlyDue: requirements?.currently_due ?? [],
    pastDue: requirements?.past_due ?? [],
    pending: requirements?.pending_verification ?? [],
    errors: (requirements?.errors ?? []).map((error) => ({ code: String(error.code).slice(0, 80), reason: String(error.reason ?? "").slice(0, 300), requirement: String(error.requirement ?? "").slice(0, 120) })),
    disabledReason: requirements?.disabled_reason ?? null,
    currentDeadline: requirements?.current_deadline ? new Date(requirements.current_deadline * 1000).toISOString() : null,
    livemode,
    disconnected: false,
  };
}

const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : value?.id ?? null);

export function paymentFromSession(session: Stripe.Checkout.Session, accountId: string, platformFeeMinor: number): PaymentFacts {
  return {
    orderId: session.metadata?.setuvara_order_id ?? session.client_reference_id ?? null,
    checkoutId: session.id,
    paymentId: idOf(session.payment_intent),
    sellerAccountId: accountId,
    amountMinor: session.amount_total ?? 0,
    currency: (session.currency ?? "").toUpperCase(),
    platformFeeMinor,
    paid: session.payment_status === "paid",
    buyerCountry: session.customer_details?.address?.country ?? null,
  };
}

const REFUND_STATUS = new Set(["pending", "requires_action", "succeeded", "failed", "canceled"]);
export function refundFromObject(refund: Stripe.Refund, platformFeeRefundedMinor = 0): RefundFacts {
  return {
    orderId: refund.metadata?.setuvara_order_id ?? null,
    refundId: refund.id,
    paymentId: idOf(refund.payment_intent) ?? "",
    amountMinor: refund.amount,
    currency: refund.currency.toUpperCase(),
    status: (REFUND_STATUS.has(refund.status ?? "") ? refund.status : "pending") as RefundFacts["status"],
    reason: refund.reason ?? null,
    platformFeeRefundedMinor,
  };
}

/** Maps a verified Stripe event to what Setuvara acts on. Objects that need more data are completed by the handler. */
export function normalizeEvent(event: Stripe.Event): CommerceEvent {
  const account = event.account ?? null;
  const object = event.data.object as unknown as Record<string, unknown> & { id: string };
  switch (event.type) {
    case "account.updated":
      return account || object.id ? { kind: "seller.updated", sellerAccountId: (object.id as string) ?? account! } : { kind: "ignored" };
    case "capability.updated":
      return account ? { kind: "seller.updated", sellerAccountId: account } : { kind: "ignored" };
    case "account.application.deauthorized":
      return account ? { kind: "seller.disconnected", sellerAccountId: account } : { kind: "ignored" };
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (!account) return { kind: "ignored" };
      const payment = paymentFromSession(event.data.object as Stripe.Checkout.Session, account, 0);
      return event.type === "checkout.session.completed" ? { kind: "checkout.completed", payment } : { kind: "checkout.async_succeeded", payment };
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.setuvara_order_id ?? session.client_reference_id ?? null;
      return { kind: event.type === "checkout.session.expired" ? "checkout.expired" : "checkout.async_failed", orderId, checkoutId: session.id };
    }
    case "refund.created":
    case "refund.updated":
    case "refund.failed":
      return account ? { kind: "refund.updated", refund: refundFromObject(event.data.object as Stripe.Refund) } : { kind: "ignored" };
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
    case "charge.dispute.funds_withdrawn":
    case "charge.dispute.funds_reinstated": {
      if (!account) return { kind: "ignored" };
      const dispute = event.data.object as Stripe.Dispute;
      return {
        kind: "dispute.updated",
        dispute: {
          orderId: null,
          disputeId: dispute.id,
          paymentId: idOf(dispute.payment_intent) ?? "",
          amountMinor: dispute.amount,
          currency: dispute.currency.toUpperCase(),
          status: dispute.status,
          reason: dispute.reason ?? null,
          evidenceDueBy: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null,
        },
      };
    }
    case "payout.created":
    case "payout.updated":
    case "payout.paid":
    case "payout.failed":
    case "payout.canceled": {
      if (!account) return { kind: "ignored" };
      const payout = event.data.object as Stripe.Payout;
      return {
        kind: "payout.updated",
        sellerAccountId: account,
        payout: { payoutId: payout.id, amountMinor: payout.amount, currency: payout.currency.toUpperCase(), status: payout.status, arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null, failureCode: payout.failure_code ?? null },
      };
    }
    default:
      return { kind: "ignored" };
  }
}

export class StripeCommerceProvider implements CommerceProvider {
  readonly code = "stripe";
  readonly livemode: boolean;
  private readonly stripe: Stripe;
  private readonly webhookSecret: string | null;

  constructor(secretKey: string, webhookSecret: string | null) {
    this.livemode = /^(sk|rk)_live_/.test(secretKey);
    this.stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "Setuvara Creator Commerce" } });
    this.webhookSecret = webhookSecret;
  }

  /**
   * Stripe takes new connected accounts through Accounts v2 only. The merchant
   * configuration makes the account the merchant of record for direct charges;
   * the responsibilities match SELLER_CONTROLLER. The account id works with the
   * v1 payment, refund and balance calls below.
   */
  async createSeller({ userId, country, email, businessType, profileUrl }: { userId: string; country: SellerCountry; email: string | null; businessType: "individual" | "company" | null; profileUrl: string }) {
    const account = await this.stripe.v2.core.accounts.create({
      ...(email ? { contact_email: email } : {}),
      dashboard: "full",
      identity: { country, ...(businessType ? { entity_type: businessType } : {}) },
      configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
      defaults: {
        responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
        profile: { business_url: profileUrl, product_description: "Digital products and creative services sold from a Setuvara creator page." },
      },
      metadata: { setuvara_user_id: userId },
    // A double click within ten minutes gets the same account back.
    }, { idempotencyKey: `seller-v2-${userId}-${country}-${Math.floor(Date.now() / 600_000)}` });
    return { accountId: account.id };
  }

  async onboardingLink({ accountId, refreshUrl, returnUrl }: { accountId: string; refreshUrl: string; returnUrl: string }) {
    const link = await this.stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: { type: "account_onboarding", account_onboarding: { refresh_url: refreshUrl, return_url: returnUrl, collection_options: { fields: "eventually_due" } } },
    });
    return link.url;
  }

  async retrieveSeller(accountId: string): Promise<SellerSnapshot> {
    try {
      return sellerFromAccount(await this.stripe.accounts.retrieve(accountId), this.livemode);
    } catch (error) {
      // A seller who disconnected the platform: the account can no longer be read.
      if (error instanceof Stripe.errors.StripePermissionError || (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "account_invalid")) {
        return { ...sellerFromAccount({ id: accountId, object: "account" } as Stripe.Account, this.livemode), disconnected: true };
      }
      throw error;
    }
  }

  async createCheckout(input: CheckoutRequest) {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: input.amountMinor,
          product_data: { name: input.title.slice(0, 250), ...(input.description.trim() ? { description: input.description.trim().slice(0, 500) } : {}) },
        },
      }],
      customer_email: input.buyerEmail,
      client_reference_id: input.orderId,
      metadata: { setuvara_order_id: input.orderId },
      payment_intent_data: {
        ...(input.platformFeeMinor > 0 ? { application_fee_amount: input.platformFeeMinor } : {}),
        description: `${input.title.slice(0, 200)} · ${input.creatorName.slice(0, 80)}`,
        metadata: { setuvara_order_id: input.orderId },
      },
      submit_type: "pay",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      expires_at: input.expiresAt,
    }, { stripeAccount: input.sellerAccountId, idempotencyKey: `checkout-${input.orderId}` });
    if (!session.url) throw new Error("checkout_without_url");
    return { checkoutId: session.id, url: session.url, expiresAt: new Date(session.expires_at * 1000).toISOString() };
  }

  async retrieveCheckout(sellerAccountId: string, checkoutId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(checkoutId, {}, { stripeAccount: sellerAccountId });
    const details = session.payment_intent ? await this.paymentDetails(sellerAccountId, idOf(session.payment_intent)!) : null;
    return { status: (session.status ?? "open") as "open" | "complete" | "expired", payment: paymentFromSession(session, sellerAccountId, details?.applicationFeeMinor ?? 0) };
  }

  /** The application fee on the payment and Stripe's own processing fee, from the seller's balance transaction. */
  async paymentDetails(sellerAccountId: string, paymentId: string) {
    const intent = await this.stripe.paymentIntents.retrieve(paymentId, { expand: ["latest_charge.balance_transaction"] }, { stripeAccount: sellerAccountId });
    const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    const transaction = charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
    const stripeFee = transaction ? transaction.fee_details.filter((detail) => detail.type === "stripe_fee").reduce((sum, detail) => sum + detail.amount, 0) : null;
    return {
      applicationFeeMinor: intent.application_fee_amount ?? 0,
      applicationFeeId: charge ? idOf(charge.application_fee as string | { id: string } | null) : null,
      processing: transaction && stripeFee !== null ? { feeMinor: stripeFee, currency: transaction.currency.toUpperCase() } : null,
    };
  }

  /** Total application fee returned so far on a payment, read from the platform's own fee record. */
  async platformFeeRefundedTotal(sellerAccountId: string, paymentId: string) {
    const { applicationFeeId } = await this.paymentDetails(sellerAccountId, paymentId);
    if (!applicationFeeId) return 0;
    const fee = await this.stripe.applicationFees.retrieve(applicationFeeId);
    return fee.amount_refunded ?? 0;
  }

  async refund({ sellerAccountId, paymentId, amountMinor, orderId, idempotencyKey, refundPlatformFee }: { sellerAccountId: string; paymentId: string; amountMinor: number; orderId: string; idempotencyKey: string; refundPlatformFee: boolean }) {
    // Setuvara returns its fee in proportion to the refund, so a refunded buyer never leaves the creator paying Setuvara.
    // Stripe refuses refund_application_fee on a charge that carried no fee, so it is only sent when there was one.
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentId,
      amount: amountMinor,
      ...(refundPlatformFee ? { refund_application_fee: true } : {}),
      reason: "requested_by_customer",
      metadata: { setuvara_order_id: orderId },
    }, { stripeAccount: sellerAccountId, idempotencyKey });
    return refundFromObject(refund);
  }

  async balance(sellerAccountId: string): Promise<Balance> {
    const balance = await this.stripe.balance.retrieve({}, { stripeAccount: sellerAccountId });
    return {
      available: balance.available.map((entry) => ({ currency: entry.currency.toUpperCase(), amountMinor: entry.amount })),
      pending: balance.pending.map((entry) => ({ currency: entry.currency.toUpperCase(), amountMinor: entry.amount })),
    };
  }

  verifyWebhook(rawBody: string, signature: string | null): VerifiedEvent {
    if (!this.webhookSecret) throw new Error("webhook_unconfigured");
    if (!signature) throw new Error("webhook_unsigned");
    // Signature and a five-minute timestamp window; replays past that fail here, and event ids dedupe the rest.
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret, 300);
    const object = event.data.object as { id?: string };
    return { id: event.id, type: event.type, accountId: event.account ?? null, objectId: object.id ?? null, livemode: event.livemode, created: new Date(event.created * 1000).toISOString(), event: normalizeEvent(event) };
  }

  async dashboardUrl() {
    return this.livemode ? "https://dashboard.stripe.com/" : "https://dashboard.stripe.com/test/dashboard";
  }
}
