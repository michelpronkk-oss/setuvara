import "server-only";

import Stripe from "stripe";

import { discounted, keyHint, RevenueKeyError, snapshot, type RevenueAdapter, type RevenueLine } from "./metrics";

/** Statuses Stripe counts in MRR. Trials, unpaid, incomplete and canceled subscriptions add nothing. */
const COUNTED = new Set(["active", "past_due"]);

function client(key: string) {
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "Setuvara Verified Revenue" } });
}

type Coupon = { percent_off?: number | null; amount_off?: number | null; currency?: string | null; duration?: string };

/** The coupon behind a discount, on both the current (source.coupon) and older (coupon) shapes. */
function couponOf(discount: unknown): Coupon | null {
  if (!discount || typeof discount !== "object") return null;
  const d = discount as { coupon?: unknown; source?: { coupon?: unknown } };
  const coupon = d.source?.coupon ?? d.coupon;
  return coupon && typeof coupon === "object" ? (coupon as Coupon) : null;
}

/** Normalised recurring lines for one subscription, or none when it doesn't count toward MRR. */
export function stripeLines(sub: Stripe.Subscription): RevenueLine[] {
  return COUNTED.has(sub.status) ? recurringLines(sub) : [];
}

/** Whether a subscription was paying at a past moment (unix seconds): started, out of trial, not yet ended. */
export function paidAt(sub: Stripe.Subscription, at: number) {
  if (sub.status === "incomplete" || sub.status === "incomplete_expired") return false;
  const start = sub.start_date ?? sub.created;
  const ended = sub.ended_at ?? sub.canceled_at ?? null;
  return start <= at && (sub.trial_end == null || sub.trial_end <= at) && (ended == null || ended > at);
}

/** Last day of each of the past `months` calendar months, oldest first, as UTC dates and end-of-day seconds. */
export function monthEnds(months: number, now = new Date()) {
  return Array.from({ length: months }, (_, i) => {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 0));
    return { day: end.toISOString().slice(0, 10), at: Math.floor(end.getTime() / 1000) + 86_399 };
  });
}

/**
 * Month-end MRR rebuilt from subscription start, trial and end dates. Prices and discounts are the
 * subscription's current ones, so plan changes and past coupons aren't reflected: these rows are
 * labelled reconstructed and never mixed up with daily measurements.
 */
export function stripeHistory(subs: Stripe.Subscription[], ends: { day: string; at: number }[]) {
  return ends.flatMap(({ day, at }) => {
    const lines: RevenueLine[] = [];
    const subscriptions: Record<string, number> = {};
    for (const sub of subs) {
      if (!paidAt(sub, at)) continue;
      const subLines = recurringLines(sub);
      if (!subLines.length) continue;
      lines.push(...subLines);
      subscriptions[sub.currency] = (subscriptions[sub.currency] ?? 0) + 1;
    }
    return snapshot(lines, subscriptions).map((row) => ({ day, ...row }));
  });
}

function recurringLines(sub: Stripe.Subscription): RevenueLine[] {
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const ongoing = (sub.discounts ?? []).map(couponOf)
    .filter((c): c is Coupon => !!c && c.duration !== "once" && (!c.currency || c.currency === sub.currency));
  const items = sub.items.data.filter((item) => item.price.recurring && item.price.recurring.usage_type !== "metered");
  const gross = items.map((item) => (item.price.unit_amount ?? Number(item.price.unit_amount_decimal ?? 0)) * (item.quantity ?? 1));
  const total = gross.reduce((a, b) => a + b, 0);
  return items.map((item, i) => {
    // A fixed-amount coupon comes off the whole invoice; spread it across items by their share.
    const share = total > 0 ? gross[i] / total : 0;
    const amount = discounted(gross[i], ongoing.map((c) => ({ percentOff: c.percent_off, amountOffMinor: c.amount_off ? c.amount_off * share : null })));
    return { customer, currency: sub.currency, amountMinor: amount, interval: item.price.recurring!.interval as RevenueLine["interval"], intervalCount: item.price.recurring!.interval_count };
  });
}

export const stripeRevenue: RevenueAdapter = {
  code: "stripe",
  async verify(key) {
    const match = /^rk_(live|test)_[A-Za-z0-9]{20,}$/.exec(key);
    if (!match) throw new RevenueKeyError("Use a restricted key (rk_…). Setuvara doesn't accept secret keys.");
    const stripe = client(key);
    try { await stripe.subscriptions.list({ limit: 1, status: "all" }); }
    catch (error) { throw new RevenueKeyError(error instanceof Stripe.errors.StripeAuthenticationError ? "Stripe didn't accept this key." : "This key can't read Subscriptions. Give it Read access to Subscriptions, Customers and Prices."); }
    // A harmless write to a customer that doesn't exist: a read-only key is refused before Stripe looks it up.
    try {
      await stripe.customers.update("cus_setuvara_permission_probe", { metadata: {} });
      throw new RevenueKeyError("This key can write. Create a restricted key with Read access only.");
    } catch (error) {
      if (error instanceof RevenueKeyError) throw error;
      if (!(error instanceof Stripe.errors.StripePermissionError)) throw new RevenueKeyError("This key can write. Create a restricted key with Read access only.");
    }
    let accountRef: string | null = null;
    try { accountRef = (await stripe.accounts.retrieveCurrent()).id; } catch { /* reading the account is optional */ }
    return { environment: match[1] === "live" ? "live" : "test", accountRef, keyHint: keyHint(key) };
  },
  async sync(key) {
    const stripe = client(key);
    const lines: RevenueLine[] = [];
    const subscriptions: Record<string, number> = {};
    for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.discounts.source.coupon"] })) {
      const subLines = stripeLines(sub);
      if (!subLines.length) continue;
      lines.push(...subLines);
      subscriptions[sub.currency] = (subscriptions[sub.currency] ?? 0) + 1;
    }
    return { rows: snapshot(lines, subscriptions), method: "stripe_subscriptions_v1" };
  },
  async history(key, months) {
    const stripe = client(key);
    const subs: Stripe.Subscription[] = [];
    for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.discounts.source.coupon"] })) subs.push(sub);
    return { rows: stripeHistory(subs, monthEnds(months)), method: "stripe_history_v1" };
  },
};
