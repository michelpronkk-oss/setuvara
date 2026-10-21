import type { SellerCountry } from "./model";

/**
 * The boundary between Setuvara commerce and a payment provider. Orders, products,
 * delivery and the studio only speak these shapes; Stripe Connect is the first
 * adapter. A second provider (Mollie Connect, say) implements the same contract
 * and gets its own `provider` code in every table.
 */
export type SellerSnapshot = {
  accountId: string;
  country: string | null;
  defaultCurrency: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  cardPayments: "inactive" | "pending" | "active" | "unrequested";
  transfers: "inactive" | "pending" | "active" | "unrequested";
  currentlyDue: string[];
  pastDue: string[];
  pending: string[];
  errors: { code: string; reason: string; requirement: string }[];
  disabledReason: string | null;
  currentDeadline: string | null;
  livemode: boolean;
  /** The provider no longer lets this platform act for the account. */
  disconnected: boolean;
};

export type CheckoutRequest = {
  orderId: string;
  sellerAccountId: string;
  title: string;
  description: string;
  amountMinor: number;
  currency: string;
  platformFeeMinor: number;
  buyerEmail: string;
  successUrl: string;
  cancelUrl: string;
  /** Unix seconds; providers have their own minimum and maximum. */
  expiresAt: number;
  creatorName: string;
};

export type PaymentFacts = {
  orderId: string | null;
  checkoutId: string;
  paymentId: string | null;
  sellerAccountId: string;
  amountMinor: number;
  currency: string;
  platformFeeMinor: number;
  paid: boolean;
  buyerCountry: string | null;
};

export type RefundFacts = { orderId: string | null; refundId: string; paymentId: string; amountMinor: number; currency: string; status: "pending" | "requires_action" | "succeeded" | "failed" | "canceled"; reason: string | null; platformFeeRefundedMinor: number };
export type DisputeFacts = { orderId: string | null; disputeId: string; paymentId: string; amountMinor: number; currency: string; status: string; reason: string | null; evidenceDueBy: string | null };
export type PayoutFacts = { payoutId: string; amountMinor: number; currency: string; status: string; arrivalDate: string | null; failureCode: string | null };

/** A verified provider event, reduced to what Setuvara acts on. */
export type CommerceEvent =
  | { kind: "seller.updated"; sellerAccountId: string }
  | { kind: "seller.disconnected"; sellerAccountId: string }
  | { kind: "checkout.completed"; payment: PaymentFacts }
  | { kind: "checkout.async_succeeded"; payment: PaymentFacts }
  | { kind: "checkout.async_failed"; orderId: string | null; checkoutId: string }
  | { kind: "checkout.expired"; orderId: string | null; checkoutId: string }
  | { kind: "refund.updated"; refund: RefundFacts }
  | { kind: "dispute.updated"; dispute: DisputeFacts }
  | { kind: "payout.updated"; sellerAccountId: string; payout: PayoutFacts }
  | { kind: "ignored" };

export type VerifiedEvent = { id: string; type: string; accountId: string | null; objectId: string | null; livemode: boolean; created: string; event: CommerceEvent };

export type Balance = { available: { currency: string; amountMinor: number }[]; pending: { currency: string; amountMinor: number }[] };

export interface CommerceProvider {
  readonly code: string;
  readonly livemode: boolean;
  createSeller(input: { userId: string; country: SellerCountry; email: string | null; businessType: "individual" | "company" | null; profileUrl: string }): Promise<{ accountId: string }>;
  onboardingLink(input: { accountId: string; refreshUrl: string; returnUrl: string }): Promise<string>;
  retrieveSeller(accountId: string): Promise<SellerSnapshot>;
  createCheckout(input: CheckoutRequest): Promise<{ checkoutId: string; url: string; expiresAt: string }>;
  retrieveCheckout(sellerAccountId: string, checkoutId: string): Promise<{ status: "open" | "complete" | "expired"; payment: PaymentFacts }>;
  /** The platform fee on a payment and the provider's processing fee (null until the provider reports it). */
  paymentDetails(sellerAccountId: string, paymentId: string): Promise<{ applicationFeeMinor: number; processing: { feeMinor: number; currency: string } | null }>;
  /** Platform fee returned so far on a payment, from the platform's own fee record. */
  platformFeeRefundedTotal(sellerAccountId: string, paymentId: string): Promise<number>;
  refund(input: { sellerAccountId: string; paymentId: string; amountMinor: number; orderId: string; idempotencyKey: string; refundPlatformFee: boolean }): Promise<RefundFacts>;
  balance(sellerAccountId: string): Promise<Balance>;
  verifyWebhook(rawBody: string, signature: string | null): VerifiedEvent;
  /** Where the seller manages payouts, refunds and disputes with the provider. */
  dashboardUrl(accountId: string): Promise<string>;
}
