/**
 * Creator Insights: audience, collaborations and the store over one range, from rows the creator can
 * already read under RLS. Pure, so tests use it directly. Money is never added across currencies,
 * and a number we can't know reads as null, never as zero.
 */

import { commerceTotals, type CommerceOrder, type DayStat, type RefundRow, type Totals } from "@/lib/commerce/model";
import { OPEN_DEAL_STAGES, type Deal, type DealActivity } from "./deals";

const DAY = 86_400_000;

/** UTC days oldest first, ending today. */
export function rangeDays(days: number, now = new Date()) {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, index) => new Date(end - (days - 1 - index) * DAY).toISOString().slice(0, 10));
}
/** The first instant of the range: midnight UTC, `days - 1` days ago. */
export const rangeSince = (days: number, now = new Date()) => `${rangeDays(days, now)[0]}T00:00:00.000Z`;
const inRange = (iso: string | null | undefined, since: string) => Boolean(iso && iso >= since);

export type Subscriber = { email: string | null; status: string; verified_at: string | null; unsubscribed_at: string | null };
export type AudienceInsight = { subscribed: number; joined: number; left: number; net: number; daily: { day: string; joined: number; left: number }[] };

/**
 * Newsletter sign-ups on the Creator page's lists. Subscribed counts people (one email on two
 * lists is one person); joined and left count confirmations and unsubscribes in the range.
 */
export function audienceInsight(rows: readonly Subscriber[], days: number, now = new Date()): AudienceInsight {
  const since = rangeSince(days, now);
  const daily = rangeDays(days, now).map((day) => ({ day, joined: 0, left: 0 }));
  const byDay = new Map(daily.map((row) => [row.day, row]));
  const people = new Set<string>();
  let joined = 0;
  let left = 0;
  for (const row of rows) {
    if (row.status === "subscribed" && row.email) people.add(row.email.trim().toLowerCase());
    if (inRange(row.verified_at, since)) { joined += 1; const day = byDay.get(row.verified_at!.slice(0, 10)); if (day) day.joined += 1; }
    if (inRange(row.unsubscribed_at, since)) { left += 1; const day = byDay.get(row.unsubscribed_at!.slice(0, 10)); if (day) day.left += 1; }
  }
  return { subscribed: people.size, joined, left, net: joined - left, daily };
}

export type Money = { currency: string; amount: number };
export type DealInsight = {
  /** Deals that came in during the range. */
  inquiries: number;
  /** Of those, how many reached Booked or later. */
  won: number;
  declined: number;
  /** won ÷ (won + declined) among this range's deals; null until one is decided. */
  winRate: number | null;
  /** Median hours from a deal arriving to its first move out of New; null without any. */
  medianReplyHours: number | null;
  /** Deals marked Paid during the range, per currency. */
  paid: Money[];
  /** Agreed amounts on open deals (Booked, Completed), per currency, whenever they came in. */
  pipeline: Money[];
  open: number;
};

const WON = new Set(["booked", "completed", "paid"]);

/** Brand deals, from what the creator recorded. Amounts are the creator's own entries. */
export function dealInsight(deals: readonly Deal[], activities: readonly Pick<DealActivity, "deal_id" | "kind" | "from_stage" | "created_at">[], days: number, now = new Date()): DealInsight {
  const since = rangeSince(days, now);
  const recent = deals.filter((deal) => inRange(deal.created_at, since));
  const won = recent.filter((deal) => WON.has(deal.stage)).length;
  const declined = recent.filter((deal) => deal.stage === "declined").length;

  const firstMove = new Map<string, string>();
  for (const item of activities) {
    if (item.kind !== "stage" || item.from_stage !== "new") continue;
    const seen = firstMove.get(item.deal_id);
    if (!seen || item.created_at < seen) firstMove.set(item.deal_id, item.created_at);
  }
  const waits = recent.flatMap((deal) => {
    const moved = firstMove.get(deal.id);
    return moved ? [Math.max(0, Date.parse(moved) - Date.parse(deal.created_at)) / 3_600_000] : [];
  });

  const sum = (rows: readonly Deal[]) => {
    const map = new Map<string, number>();
    for (const deal of rows) if (deal.agreed_amount_cents !== null && deal.currency) map.set(deal.currency, (map.get(deal.currency) ?? 0) + deal.agreed_amount_cents);
    return [...map.entries()].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => b.amount - a.amount);
  };
  const open = deals.filter((deal) => OPEN_DEAL_STAGES.includes(deal.stage));
  return {
    inquiries: recent.length,
    won,
    declined,
    winRate: won + declined > 0 ? won / (won + declined) : null,
    medianReplyHours: median(waits),
    paid: sum(deals.filter((deal) => deal.stage === "paid" && inRange(deal.stage_changed_at, since))),
    pipeline: sum(open.filter((deal) => deal.stage === "booked" || deal.stage === "completed")),
    open: open.length,
  };
}

export type StoreInsight = {
  /** Kept money per currency for purchases paid in the range (refunds, fees and chargebacks off). */
  totals: Totals[];
  purchases: number;
  freeClaims: number;
  buyers: number;
  /** Buyers in the range who had paid before it. */
  returning: number;
  views: number;
  /** Purchases ÷ product page views; null without views, never invented. */
  conversion: number | null;
  /** True when the numbers are test payments (no live order exists yet). */
  test: boolean;
};

const SOLD_LIKE = new Set(["paid", "partially_refunded", "refunded", "disputed", "charged_back"]);

/**
 * The store over the range. Live and test payments never mix: once a live order exists only live
 * orders count; before that, test orders show, flagged as test.
 */
export function storeInsight(all: readonly CommerceOrder[], refunds: readonly RefundRow[], stats: readonly DayStat[], days: number, now = new Date()): StoreInsight {
  const since = rangeSince(days, now);
  const live = all.some((order) => order.livemode && order.paid_at);
  const orders = all.filter((order) => order.livemode === live && order.paid_at && SOLD_LIKE.has(order.status));
  const recent = orders.filter((order) => inRange(order.paid_at, since));
  const purchases = recent.filter((order) => order.order_kind === "purchase");
  const ids = new Set(purchases.map((order) => order.id));

  const firstPaid = new Map<string, string>();
  for (const order of orders) {
    if (order.order_kind !== "purchase" || !order.buyer_email) continue;
    const key = order.buyer_email.toLowerCase();
    const seen = firstPaid.get(key);
    if (!seen || order.paid_at! < seen) firstPaid.set(key, order.paid_at!);
  }
  const buyers = new Set(purchases.flatMap((order) => (order.buyer_email ? [order.buyer_email.toLowerCase()] : [])));
  const returning = [...buyers].filter((email) => (firstPaid.get(email) ?? since) < since).length;
  const views = stats.filter((row) => row.day >= since.slice(0, 10)).reduce((total, row) => total + row.views, 0);

  return {
    totals: commerceTotals(purchases, refunds.filter((refund) => ids.has(refund.order_id))),
    purchases: purchases.length,
    freeClaims: recent.length - purchases.length,
    buyers: buyers.size,
    returning,
    views,
    conversion: views > 0 ? purchases.length / views : null,
    test: !live && orders.length > 0,
  };
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** "3 h", "2 days", "under an hour". */
export function formatWait(hours: number) {
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}
