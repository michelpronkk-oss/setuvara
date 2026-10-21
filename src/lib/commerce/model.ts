/**
 * Creator Commerce, provider-neutral. Everything here is pure so the studio, the
 * routes and the tests share one set of rules. Provider adapters translate their
 * own objects into these shapes; nothing outside an adapter reads a provider type.
 */

// ------------------------------------------------------------------ sellers

/** Where a creator can open a seller account today. Expansion is a config change plus a provider check. */
export const SELLER_COUNTRIES = [
  { code: "US", name: "United States", currency: "USD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
] as const;
export type SellerCountry = (typeof SELLER_COUNTRIES)[number]["code"];
export const isSellerCountry = (value: string): value is SellerCountry => SELLER_COUNTRIES.some((country) => country.code === value);

/** Checkout currencies. The provider converts to the seller's own currency at settlement. */
export const COMMERCE_CURRENCIES = ["EUR", "USD", "GBP"] as const;
export type CommerceCurrency = (typeof COMMERCE_CURRENCIES)[number];
/** Card networks' practical minimum charge, in minor units. */
export const MIN_PRICE_MINOR: Record<CommerceCurrency, number> = { EUR: 50, USD: 50, GBP: 30 };

/** The seller account as the provider last reported it (mirrors creator_payout_accounts). */
export type SellerAccount = {
  provider: string;
  status: "not_connected" | "pending" | "enabled" | "restricted" | "disabled";
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  country_code: string | null;
  default_currency: string | null;
  card_payments_status: "inactive" | "pending" | "active" | "unrequested";
  currently_due: string[];
  past_due: string[];
  pending: string[];
  errors: { code: string; reason: string; requirement: string }[];
  disabled_reason: string | null;
  current_deadline: string | null;
  livemode: boolean;
  synced_at: string | null;
  disconnected_at: string | null;
};

export type SellerStatus = {
  terms_accepted: boolean;
  suspended: boolean;
  can_sell: boolean;
  plan: "free" | "plus" | "pro";
  /** Setuvara's fee for this creator's plan, per checkout currency. */
  fees: { currency: string; fee_bps: number; fixed_fee_minor: number }[];
  account: SellerAccount | null;
};

export function feeLine(fee: { fee_bps: number; fixed_fee_minor: number; currency: string } | undefined) {
  if (!fee || (fee.fee_bps === 0 && fee.fixed_fee_minor === 0)) return "No Setuvara fee";
  const pct = `${(fee.fee_bps / 100).toLocaleString("en", { maximumFractionDigits: 2 })}%`;
  return fee.fixed_fee_minor ? `${pct} + ${formatAmount(fee.fixed_fee_minor, fee.currency)}` : pct;
}

/**
 * The one word a creator sees. Each state comes from provider fields, never from
 * having returned from onboarding.
 */
export type SellerState = "not_connected" | "setup_required" | "verification_pending" | "payments_enabled" | "payouts_restricted" | "action_required" | "rejected" | "suspended";

export function sellerState(status: Pick<SellerStatus, "suspended" | "account"> | null): SellerState {
  if (status?.suspended) return "suspended";
  const account = status?.account;
  if (!account || account.disconnected_at) return "not_connected";
  if (account.disabled_reason?.startsWith("rejected")) return "rejected";
  if (account.past_due.length > 0 || account.errors.length > 0) return "action_required";
  if (!account.details_submitted) return "setup_required";
  if (account.charges_enabled && account.card_payments_status === "active" && !account.disabled_reason) {
    return account.payouts_enabled ? "payments_enabled" : "payouts_restricted";
  }
  if (account.currently_due.length > 0 && account.pending.length === 0) return "action_required";
  return "verification_pending";
}

export const SELLER_STATE_COPY: Record<SellerState, { label: string; line: string; tone: "ink" | "good" | "wait" | "warn" | "bad" }> = {
  not_connected: { label: "Not connected", line: "Turn on payments to sell on your page. Free products and shop links work without it.", tone: "ink" },
  setup_required: { label: "Setup required", line: "Finish the payment setup with Stripe to start selling.", tone: "warn" },
  verification_pending: { label: "Verification pending", line: "Stripe is checking your details. Selling opens when they confirm.", tone: "wait" },
  payments_enabled: { label: "Payments enabled", line: "You can sell. Payouts go to your bank on Stripe's schedule.", tone: "good" },
  payouts_restricted: { label: "Payouts restricted", line: "You can sell, but Stripe is holding payouts until you update your details.", tone: "warn" },
  action_required: { label: "Action required", line: "Stripe needs more information before you can sell or get paid.", tone: "bad" },
  rejected: { label: "Not approved", line: "Stripe didn't approve this account. Contact Stripe support for the reason.", tone: "bad" },
  suspended: { label: "Paused by Setuvara", line: "Selling is paused on your account. Contact hello@setuvara.com.", tone: "bad" },
};

/** Provider requirement keys read as a short human list ("individual.verification.document" → "ID document"). */
export function requirementLabel(key: string): string {
  const k = key.toLowerCase();
  if (k.includes("external_account")) return "Bank account";
  if (k.includes("verification.document") || k.includes("verification.additional_document")) return "ID document";
  if (k.includes("tos_acceptance")) return "Stripe terms";
  if (k.includes("dob")) return "Date of birth";
  if (k.includes("ssn") || k.includes("id_number")) return "Tax or ID number";
  if (k.includes("address")) return "Address";
  if (k.includes("phone")) return "Phone number";
  if (k.includes("email")) return "Email";
  if (k.includes("first_name") || k.includes("last_name") || k.endsWith(".name")) return "Legal name";
  if (k.includes("business_profile.url") || k.includes("product_description")) return "What you sell";
  if (k.includes("mcc")) return "Business category";
  if (k.includes("tax_id") || k.includes("vat")) return "Tax ID";
  if (k.includes("representative") || k.includes("owners") || k.includes("directors") || k.includes("executives")) return "People in the business";
  return "Account details";
}

export function requirementList(keys: readonly string[]): string[] {
  return [...new Set(keys.map(requirementLabel))];
}

// ------------------------------------------------------------------ money

export function minorUnits(currency: string) {
  return ["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "XAF", "XOF"].includes(currency.toUpperCase()) ? 0 : 2;
}

export function formatAmount(amountMinor: number, currency: string, locale = "en-GB") {
  const digits = minorUnits(currency);
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: amountMinor % 10 ** digits === 0 ? 0 : digits, maximumFractionDigits: digits })
    .format(amountMinor / 10 ** digits);
}

/** Platform fee for one sale: basis points rounded down, plus a fixed part. Mirrors commerce_begin_checkout. */
export function platformFee(amountMinor: number, feeBps: number, fixedMinor = 0): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new RangeError("amount");
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) throw new RangeError("fee_bps");
  if (!Number.isSafeInteger(fixedMinor) || fixedMinor < 0) throw new RangeError("fixed_fee");
  if (amountMinor === 0) return 0;
  return Math.floor((amountMinor * feeBps) / 10_000) + fixedMinor;
}

// ------------------------------------------------------------------ orders

export type OrderStatus = "pending" | "processing" | "paid" | "failed" | "cancelled" | "expired" | "refunded" | "partially_refunded" | "disputed" | "charged_back";
export type FulfillmentStatus = "not_required" | "pending" | "delivered" | "failed";

/** The order states a checkout moves through. The database functions enforce the same moves. */
export const ORDER_FLOW: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["processing", "paid", "failed", "expired", "cancelled"],
  processing: ["paid", "failed", "cancelled"],
  paid: ["partially_refunded", "refunded", "disputed"],
  partially_refunded: ["refunded", "disputed"],
  disputed: ["paid", "partially_refunded", "charged_back"],
  refunded: [],
  failed: [],
  cancelled: [],
  expired: [],
  charged_back: [],
};
export const canMoveOrder = (from: OrderStatus, to: OrderStatus) => ORDER_FLOW[from].includes(to);

/** Statuses that count as a sale (money was taken and not fully returned). */
export const SOLD: readonly OrderStatus[] = ["paid", "partially_refunded", "disputed"];
export const ORDER_LABEL: Record<OrderStatus, string> = {
  pending: "Checkout open", processing: "Processing", paid: "Paid", failed: "Failed", cancelled: "Cancelled", expired: "Expired",
  refunded: "Refunded", partially_refunded: "Part refunded", disputed: "Disputed", charged_back: "Charged back",
};
export const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = { not_required: "—", pending: "Sending", delivered: "Delivered", failed: "Not delivered" };

export type CommerceOrder = {
  id: string;
  offer_id: string;
  offer_title: string;
  offer_type: "digital" | "service" | "booking";
  order_kind: "purchase" | "free_claim";
  status: OrderStatus;
  currency: string;
  gross_amount_minor: number;
  platform_fee_amount_minor: number;
  provider_fee_amount_minor: number | null;
  amount_refunded_minor: number;
  buyer_email: string | null;
  buyer_name: string | null;
  buyer_country: string | null;
  fulfillment_status: FulfillmentStatus;
  delivery_attempts: number;
  livemode: boolean;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  failure_code: string | null;
};
export const ORDER_COLUMNS = "id, offer_id, offer_title, offer_type, order_kind, status, currency, gross_amount_minor, platform_fee_amount_minor, provider_fee_amount_minor, amount_refunded_minor, buyer_email, buyer_name, buyer_country, fulfillment_status, delivery_attempts, livemode, created_at, paid_at, refunded_at, failure_code";

/** A refund's platform-fee share comes back to the creator; mirrors refund_application_fee on the provider. */
export type RefundRow = { order_id: string; amount_minor: number; currency: string; status: string; platform_fee_refunded_minor: number; created_at: string };

export type Totals = {
  currency: string;
  /** Money buyers paid, before anything comes off. */
  gross: number;
  refunds: number;
  /** Setuvara's fee, after fees returned on refunds. */
  platformFees: number;
  /** The payment provider's processing fees, where already known. */
  processingFees: number;
  /** Lost disputes. */
  chargebacks: number;
  /** What the creator keeps: gross − refunds − platform fees − processing fees − chargebacks. */
  net: number;
  orders: number;
  /** Paid orders whose processing fee hasn't been reported yet. */
  feesPending: number;
};

/**
 * Totals per currency over paid purchases. Currencies are never added together;
 * processing fees are assumed to be in the order currency (the provider reports
 * settlement currency separately; a mismatch is flagged by the caller).
 */
export function commerceTotals(orders: readonly CommerceOrder[], refunds: readonly RefundRow[]): Totals[] {
  const byCurrency = new Map<string, Totals>();
  const feeBack = new Map<string, number>();
  for (const refund of refunds) if (refund.status === "succeeded") feeBack.set(refund.order_id, (feeBack.get(refund.order_id) ?? 0) + refund.platform_fee_refunded_minor);
  for (const order of orders) {
    if (order.order_kind !== "purchase" || !order.paid_at) continue;
    const t = byCurrency.get(order.currency) ?? { currency: order.currency, gross: 0, refunds: 0, platformFees: 0, processingFees: 0, chargebacks: 0, net: 0, orders: 0, feesPending: 0 };
    t.orders += 1;
    t.gross += order.gross_amount_minor;
    t.refunds += order.amount_refunded_minor;
    t.platformFees += order.platform_fee_amount_minor - (feeBack.get(order.id) ?? 0);
    if (order.provider_fee_amount_minor === null) t.feesPending += 1;
    else t.processingFees += order.provider_fee_amount_minor;
    if (order.status === "charged_back") t.chargebacks += order.gross_amount_minor - order.amount_refunded_minor;
    byCurrency.set(order.currency, t);
  }
  return [...byCurrency.values()].map((t) => ({ ...t, net: t.gross - t.refunds - t.platformFees - t.processingFees - t.chargebacks })).sort((a, b) => b.gross - a.gross);
}

export type CustomerRow = { email: string; name: string | null; orders: number; spent: { currency: string; amount: number }[]; firstAt: string; lastAt: string; country: string | null };

/** Buyers grouped by email, from orders the creator can already see. */
export function customersOf(orders: readonly CommerceOrder[]): CustomerRow[] {
  const map = new Map<string, CustomerRow>();
  for (const order of orders) {
    if (!order.buyer_email || !order.paid_at) continue;
    const key = order.buyer_email.toLowerCase();
    const row = map.get(key) ?? { email: key, name: null, orders: 0, spent: [], firstAt: order.paid_at, lastAt: order.paid_at, country: null };
    row.orders += 1;
    row.name ||= order.buyer_name;
    row.country ||= order.buyer_country;
    if (order.paid_at < row.firstAt) row.firstAt = order.paid_at;
    if (order.paid_at > row.lastAt) row.lastAt = order.paid_at;
    const kept = order.gross_amount_minor - order.amount_refunded_minor;
    if (kept > 0) {
      const spent = row.spent.find((item) => item.currency === order.currency);
      if (spent) spent.amount += kept; else row.spent.push({ currency: order.currency, amount: kept });
    }
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

export type DayStat = { offer_id: string; day: string; views: number; checkout_starts: number };
export type ProductFunnel = { offerId: string; title: string; views: number; checkoutStarts: number; purchases: number; conversion: number | null; revenue: { currency: string; amount: number }[] };

/** Views → checkout starts → purchases per product, over the same window. Conversion is purchases ÷ views. */
export function productFunnels(stats: readonly DayStat[], orders: readonly CommerceOrder[], titles: Record<string, string>): ProductFunnel[] {
  const rows = new Map<string, ProductFunnel>();
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) { r = { offerId: id, title: titles[id] ?? "Removed product", views: 0, checkoutStarts: 0, purchases: 0, conversion: null, revenue: [] }; rows.set(id, r); }
    return r;
  };
  for (const stat of stats) { const r = row(stat.offer_id); r.views += stat.views; r.checkoutStarts += stat.checkout_starts; }
  for (const order of orders) {
    if (!order.paid_at) continue;
    const r = row(order.offer_id);
    r.purchases += 1;
    const kept = order.gross_amount_minor - order.amount_refunded_minor;
    if (kept > 0) {
      const item = r.revenue.find((entry) => entry.currency === order.currency);
      if (item) item.amount += kept; else r.revenue.push({ currency: order.currency, amount: kept });
    }
  }
  return [...rows.values()].map((r) => ({ ...r, conversion: r.views > 0 ? r.purchases / r.views : null })).sort((a, b) => b.purchases - a.purchases || b.views - a.views);
}

/** Daily kept revenue for one currency, oldest first, with empty days filled. */
export function dailySeries(orders: readonly CommerceOrder[], currency: string, days: number, now = new Date()): { day: string; amount: number; orders: number }[] {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out = Array.from({ length: days }, (_, index) => ({ day: new Date(end - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10), amount: 0, orders: 0 }));
  const byDay = new Map(out.map((entry) => [entry.day, entry]));
  for (const order of orders) {
    if (order.order_kind !== "purchase" || !order.paid_at || order.currency !== currency) continue;
    const entry = byDay.get(order.paid_at.slice(0, 10));
    if (!entry) continue;
    entry.amount += order.gross_amount_minor - order.amount_refunded_minor;
    entry.orders += 1;
  }
  return out;
}

/** Which orders a refund button may act on, and up to how much. */
export function refundable(order: Pick<CommerceOrder, "order_kind" | "status" | "gross_amount_minor" | "amount_refunded_minor">): number {
  if (order.order_kind !== "purchase" || !["paid", "partially_refunded"].includes(order.status)) return 0;
  return Math.max(order.gross_amount_minor - order.amount_refunded_minor, 0);
}

/** Setuvara's fee on one sale, the way the database computes it at checkout: rounded down to a whole minor unit. */
export function platformFeeMinor(amountMinor: number, fee: { fee_bps: number; fixed_fee_minor: number } | undefined) {
  if (!fee || amountMinor <= 0) return 0;
  return Math.floor((amountMinor * fee.fee_bps) / 10000) + fee.fixed_fee_minor;
}

export const COMMERCE_ERROR: Record<string, string> = {
  offer_unavailable: "This isn't for sale right now.",
  offer_is_free: "This one is free.",
  own_offer: "This is your own product.",
  seller_unavailable: "This creator can't take payments right now.",
  sold_out: "Sold out.",
  rate_limited: "Too many tries. Try again in a while.",
  invalid_email: "Check your email address.",
  fee_exceeds_price: "This product can't be sold at this price.",
  fee_policy_missing: "This product can't be sold in this currency yet.",
  payments_off: "Checkout isn't open yet.",
};

/** Time helpers kept out of render code. */
export const cutoffDaysAgo = (days: number, now = Date.now()) => now - days * 86_400_000;
export const ageMs = (iso: string, now = Date.now()) => now - Date.parse(iso);
