import "server-only";

import DodoPayments from "dodopayments";

import { keyHint, RevenueKeyError, snapshot, type RevenueAdapter, type RevenueLine } from "./metrics";

/**
 * Dodo Payments with a member's per-resource API key set to Subscriptions: Read. Test and live keys
 * are separate and only work against their own host, so the host that accepts the key says which
 * mode it is: test keys are always recognised as test data.
 */
type Mode = "live_mode" | "test_mode";
/** Statuses that count in MRR, as for Stripe: paying now or retrying a failed payment. */
const COUNTED = new Set(["active", "past_due"]);
const INTERVAL = { Day: "day", Week: "week", Month: "month", Year: "year" } as const;

function client(key: string, environment: Mode) {
  return new DodoPayments({ bearerToken: key, environment, maxRetries: 2, timeout: 20_000 });
}

type DodoSubscription = {
  status: string; currency: string; customer: { customer_id: string }; recurring_pre_tax_amount: number;
  payment_frequency_interval: keyof typeof INTERVAL; payment_frequency_count: number;
  created_at: string; trial_period_days?: number | null;
};

/** The recurring line for one subscription, or none while it doesn't count (inactive, or still in its trial). */
export function dodoLines(sub: DodoSubscription, now = Date.now()): RevenueLine[] {
  if (!COUNTED.has(sub.status)) return [];
  if (sub.trial_period_days && Date.parse(sub.created_at) + sub.trial_period_days * 86_400_000 > now) return [];
  const interval = INTERVAL[sub.payment_frequency_interval];
  if (!interval || !(sub.recurring_pre_tax_amount > 0)) return [];
  // recurring_pre_tax_amount is the whole recurring charge in minor units, after quantity and before tax.
  return [{ customer: sub.customer.customer_id, currency: sub.currency.toLowerCase(), amountMinor: sub.recurring_pre_tax_amount, interval, intervalCount: sub.payment_frequency_count }];
}

const status = (error: unknown) => (error as { status?: number } | null)?.status;

/** Which host accepts the key. Live is tried first; a key either host refuses is not a Dodo key. */
async function modeOf(key: string): Promise<Mode> {
  for (const mode of ["live_mode", "test_mode"] as const) {
    try { await client(key, mode).subscriptions.list({ page_size: 1 }); return mode; }
    catch (error) {
      if (status(error) === 403) throw new RevenueKeyError("This key can't read Subscriptions. Give it Subscriptions: Read.");
      if (status(error) !== 401) throw new RevenueKeyError("We couldn't reach Dodo Payments. Try again.");
    }
  }
  throw new RevenueKeyError("Dodo Payments didn't accept this key.");
}

export const dodoRevenue: RevenueAdapter = {
  code: "dodo",
  async verify(key) {
    if (!/^[A-Za-z0-9._-]{20,}$/.test(key)) throw new RevenueKeyError("Paste the whole Dodo Payments API key.");
    const mode = await modeOf(key);
    // A harmless write to a subscription that doesn't exist: a read-only key is refused before Dodo looks it up.
    try {
      await client(key, mode).subscriptions.update("sub_setuvara_permission_probe", { metadata: {} });
      throw new RevenueKeyError("This key can write. Create a key with Subscriptions: Read only.");
    } catch (error) {
      if (error instanceof RevenueKeyError) throw error;
      if (status(error) !== 403) throw new RevenueKeyError("This key can write. Create a key with Subscriptions: Read only.");
    }
    return { environment: mode === "live_mode" ? "live" : "test", accountRef: null, keyHint: keyHint(key) };
  },
  async sync(key) {
    const mode = await modeOf(key).catch((error) => { throw new Error(`Dodo Payments refused the API key (${error instanceof Error ? error.message : "authentication"}).`); });
    const lines: RevenueLine[] = [];
    const subscriptions: Record<string, number> = {};
    const now = Date.now();
    for (const state of COUNTED) {
      for await (const sub of client(key, mode).subscriptions.list({ status: state as "active" | "past_due", page_size: 100 })) {
        const subLines = dodoLines(sub as DodoSubscription, now);
        if (!subLines.length) continue;
        lines.push(...subLines);
        subscriptions[subLines[0].currency] = (subscriptions[subLines[0].currency] ?? 0) + 1;
      }
    }
    return { rows: snapshot(lines, subscriptions), method: "dodo_subscriptions_v1" };
  },
};
