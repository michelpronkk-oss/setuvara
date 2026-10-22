import "server-only";

import { discounted, keyHint, RevenueKeyError, snapshot, type RevenueAdapter, type RevenueLine } from "./metrics";

/**
 * Paddle Billing with a member's API key that has Subscriptions: Read only. Sandbox and live keys are
 * told apart by their prefix (pdl_sdbx_ / pdl_live_) and each only works on its own host, so sandbox
 * data is always labelled test.
 */
const HOST = { live: "https://api.paddle.com", test: "https://sandbox-api.paddle.com" } as const;
const KEY = /^pdl_(live|sdbx)_apikey_[A-Za-z0-9_]{20,}$/;
/** Statuses that count in MRR, as for Stripe. Paddle's trialing, paused and canceled add nothing. */
const COUNTED = ["active", "past_due"];

type Cycle = { interval: RevenueLine["interval"]; frequency: number };
type PaddleSubscription = {
  status: string; currency_code: string; customer_id: string; billing_cycle: Cycle;
  items: { status?: string; quantity: number; recurring?: boolean; price: { unit_price: { amount: string; currency_code: string }; billing_cycle: Cycle | null } }[];
  discount?: { type: "percentage" | "flat" | "flat_per_seat"; amount: string; ends_at?: string | null } | null;
};

/** Normalised recurring lines for one subscription, or none when it doesn't count toward MRR. */
export function paddleLines(sub: PaddleSubscription, now = Date.now()): RevenueLine[] {
  if (!COUNTED.includes(sub.status)) return [];
  const currency = sub.currency_code.toLowerCase();
  const items = sub.items.filter((item) => item.price.billing_cycle && item.recurring !== false && (item.status ?? "active") === "active"
    && item.price.unit_price.currency_code.toLowerCase() === currency);
  const gross = items.map((item) => Number(item.price.unit_price.amount) * (item.quantity ?? 1));
  const total = gross.reduce((a, b) => a + b, 0);
  const d = sub.discount && (!sub.discount.ends_at || Date.parse(sub.discount.ends_at) > now) ? sub.discount : null;
  return items.map((item, i) => {
    // A flat discount comes off the whole charge; spread it across items by their share.
    const share = total > 0 ? gross[i] / total : 0;
    const off = !d ? [] : d.type === "percentage" ? [{ percentOff: Number(d.amount) }]
      : [{ amountOffMinor: Number(d.amount) * (d.type === "flat_per_seat" ? item.quantity ?? 1 : share) }];
    const cycle = item.price.billing_cycle!;
    return { customer: sub.customer_id, currency, amountMinor: discounted(gross[i], off), interval: cycle.interval, intervalCount: cycle.frequency };
  });
}

function env(key: string) {
  const match = KEY.exec(key);
  if (!match) throw new RevenueKeyError("Use a Paddle Billing API key (pdl_live_apikey_… or pdl_sdbx_apikey_…).");
  return match[1] === "live" ? "live" : "test";
}

async function call(key: string, url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { authorization: `Bearer ${key}`, accept: "application/json", "content-type": "application/json", ...init.headers }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
}

export const paddleRevenue: RevenueAdapter = {
  code: "paddle",
  async verify(key) {
    const environment = env(key);
    const read = await call(key, `${HOST[environment]}/subscriptions?per_page=1`);
    if (read.status === 401) throw new RevenueKeyError("Paddle didn't accept this key.");
    if (read.status === 403) throw new RevenueKeyError("This key can't read subscriptions. Give it Subscriptions: Read.");
    if (!read.ok) throw new RevenueKeyError("We couldn't reach Paddle. Try again.");
    // A harmless write to a subscription that doesn't exist: a read-only key is refused before Paddle looks it up.
    const write = await call(key, `${HOST[environment]}/subscriptions/sub_01setuvarapermissionprobe00`, { method: "PATCH", body: JSON.stringify({ custom_data: {} }) });
    if (write.status !== 403) throw new RevenueKeyError("This key can write. Create a key with Subscriptions: Read only.");
    return { environment, accountRef: null, keyHint: keyHint(key) };
  },
  async sync(key) {
    const lines: RevenueLine[] = [];
    const subscriptions: Record<string, number> = {};
    const now = Date.now();
    let url: string | null = `${HOST[env(key)]}/subscriptions?status=${COUNTED.join(",")}&per_page=200`;
    for (let page = 0; url && page < 500; page++) {
      const response = await call(key, url);
      if (response.status === 401 || response.status === 403) throw new Error("Paddle refused the API key (permission).");
      if (!response.ok) throw new Error(`Paddle answered ${response.status}.`);
      const body = (await response.json()) as { data: PaddleSubscription[]; meta?: { pagination?: { next?: string; has_more?: boolean } } };
      for (const sub of body.data) {
        const subLines = paddleLines(sub, now);
        if (!subLines.length) continue;
        lines.push(...subLines);
        subscriptions[subLines[0].currency] = (subscriptions[subLines[0].currency] ?? 0) + 1;
      }
      url = body.meta?.pagination?.has_more ? body.meta.pagination.next ?? null : null;
    }
    return { rows: snapshot(lines, subscriptions), method: "paddle_subscriptions_v1" };
  },
};
