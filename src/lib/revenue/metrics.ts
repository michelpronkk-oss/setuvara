/**
 * Provider-neutral revenue maths. Adapters turn each provider's subscriptions into normalised
 * lines; this file turns lines into one snapshot row per currency. Amounts are minor units,
 * excluding tax; currencies are never converted into each other.
 */

export type RevenueLine = {
  customer: string;
  currency: string;
  /** Recurring amount per billing period, after quantity and discounts. */
  amountMinor: number;
  interval: "day" | "week" | "month" | "year";
  intervalCount: number;
};

export type SnapshotRow = { currency: string; mrr_minor: number; paying_customers: number; active_subscriptions: number };

/** Monthly equivalent of one billing period, the same normalisation Stripe's MRR uses (a year is 12 months, a month 365/12 days). */
export function monthly(line: Pick<RevenueLine, "amountMinor" | "interval" | "intervalCount">) {
  const count = Math.max(1, line.intervalCount);
  const perMonth = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 }[line.interval];
  return (line.amountMinor * perMonth) / count;
}

/** Sums lines per currency. A customer counts as paying in a currency when their lines there add up to more than zero. */
export function snapshot(lines: RevenueLine[], subscriptionsByCurrency: Record<string, number>): SnapshotRow[] {
  const byCurrency = new Map<string, { mrr: number; customers: Map<string, number> }>();
  for (const line of lines) {
    const currency = line.currency.toLowerCase();
    const bucket = byCurrency.get(currency) ?? { mrr: 0, customers: new Map() };
    const value = monthly(line);
    bucket.mrr += value;
    bucket.customers.set(line.customer, (bucket.customers.get(line.customer) ?? 0) + value);
    byCurrency.set(currency, bucket);
  }
  return [...byCurrency.entries()].map(([currency, bucket]) => ({
    currency,
    mrr_minor: Math.max(0, Math.round(bucket.mrr)),
    paying_customers: [...bucket.customers.values()].filter((v) => v > 0).length,
    active_subscriptions: subscriptionsByCurrency[currency] ?? 0,
  })).filter((row) => row.mrr_minor > 0 || row.active_subscriptions > 0);
}

/** Applies stacked discounts to a period amount: percentages first, then fixed amounts, never below zero. */
export function discounted(amountMinor: number, discounts: { percentOff?: number | null; amountOffMinor?: number | null }[]) {
  let value = amountMinor;
  for (const d of discounts) if (d.percentOff) value *= 1 - Math.min(100, d.percentOff) / 100;
  for (const d of discounts) if (d.amountOffMinor) value -= d.amountOffMinor;
  return Math.max(0, value);
}

export type ProviderCode = "stripe" | "revenuecat" | "dodo";

export type VerifiedKey = { environment: "live" | "test"; accountRef: string | null; keyHint: string };

export interface RevenueAdapter {
  code: ProviderCode;
  /** Checks the key reads what it needs and cannot write. Throws a member-facing message otherwise. */
  verify(key: string): Promise<VerifiedKey>;
  /** Current snapshot rows. Throws on any provider error so a partial read is never recorded. */
  sync(key: string): Promise<{ rows: SnapshotRow[]; method: string }>;
  /** Month-end rows rebuilt from the provider's records, for providers that keep them. */
  history?(key: string, months: number): Promise<{ rows: (SnapshotRow & { day: string })[]; method: string }>;
}

export type HistoryMode = "daily" | "reconstructed";

export class RevenueKeyError extends Error {}

export function keyHint(key: string) {
  return `${key.slice(0, Math.min(8, key.indexOf("_", 3) + 1 || 4))}…${key.slice(-4)}`;
}
