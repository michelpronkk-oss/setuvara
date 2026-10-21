import "server-only";

import { keyHint, RevenueKeyError, type RevenueAdapter, type SnapshotRow } from "./metrics";

/**
 * RevenueCat through API v2 with a project-scoped secret key that has Charts & metrics read only.
 * Numbers are RevenueCat's own overview metrics (MRR, active subscriptions), so the figures match
 * the RevenueCat dashboard; nothing is recomputed here. A v2 key can't list its project without
 * project-configuration access, so the member gives the project ID and it is stored with the key
 * as "projectId:key". Overview metrics leave out sandbox purchases, so what a key reads is live data.
 */
const API = "https://api.revenuecat.com/v2";
/** Overview metrics are reported in one currency; RevenueCat converts store prices into it. */
const CURRENCY = "usd";
const KEY = /^sk_[A-Za-z0-9]{20,}$/;
const PROJECT = /^[A-Za-z0-9_-]{4,64}$/;

/** Splits the stored credential. The member may paste "projectId:key" or give them separately. */
export function revenuecatCredential(secret: string) {
  const at = secret.lastIndexOf(":");
  const projectId = at > 0 ? secret.slice(0, at).trim() : "";
  const key = secret.slice(at + 1).trim();
  if (!PROJECT.test(projectId)) throw new RevenueKeyError("Add your RevenueCat project ID. It's in the dashboard URL, after /projects/.");
  if (!KEY.test(key)) throw new RevenueKeyError("Use a RevenueCat API v2 secret key (sk_…).");
  return { projectId, key };
}

type Metric = { id?: string; value?: number | string | null; unit?: string };

/** One snapshot row from an overview-metrics response. MRR arrives in major units. */
export function revenuecatRows(body: unknown): SnapshotRow[] {
  const metrics = (body as { metrics?: Metric[] } | null)?.metrics;
  if (!Array.isArray(metrics)) throw new Error("RevenueCat returned no metrics.");
  const value = (id: string) => {
    const raw = metrics.find((m) => m.id === id)?.value;
    const n = typeof raw === "string" ? Number(raw) : raw;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) throw new Error(`RevenueCat returned no ${id}.`);
    return n;
  };
  const mrr = Math.round(value("mrr") * 100);
  const active = Math.round(value("active_subscriptions"));
  const currency = String((body as { currency?: string }).currency ?? CURRENCY).toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) throw new Error("RevenueCat returned an unknown currency.");
  if (mrr === 0 && active === 0) return [];
  // RevenueCat doesn't report paying customers separately; each active paid subscription is one subscriber.
  return [{ currency, mrr_minor: mrr, paying_customers: active, active_subscriptions: active }];
}

async function call(key: string, path: string, init: RequestInit = {}) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${key}`, accept: "application/json", ...init.headers },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
}

async function overview(projectId: string, key: string) {
  const response = await call(key, `/projects/${encodeURIComponent(projectId)}/metrics/overview?currency=${CURRENCY.toUpperCase()}`);
  if (response.status === 401) throw new Error("RevenueCat refused the API key (authentication).");
  if (response.status === 403) throw new Error("RevenueCat refused the API key (permission).");
  if (!response.ok) throw new Error(`RevenueCat answered ${response.status}.`);
  return response.json();
}

export const revenuecatRevenue: RevenueAdapter = {
  code: "revenuecat",
  async verify(secret) {
    const { projectId, key } = revenuecatCredential(secret);
    const metrics = await call(key, `/projects/${encodeURIComponent(projectId)}/metrics/overview`);
    if (metrics.status === 401) throw new RevenueKeyError("RevenueCat didn't accept this key.");
    if (metrics.status === 404) throw new RevenueKeyError("RevenueCat doesn't know this project ID for this key.");
    if (metrics.status === 403) throw new RevenueKeyError("This key can't read metrics. Give it Charts & metrics: Read only.");
    if (!metrics.ok) throw new RevenueKeyError("We couldn't reach RevenueCat. Try again.");
    revenuecatRows(await metrics.json());
    // Least privilege: a metrics-only key is refused everywhere else. A delete of a customer that doesn't
    // exist is harmless, and a read-only key is refused before RevenueCat looks it up.
    const write = await call(key, `/projects/${encodeURIComponent(projectId)}/customers/setuvara_permission_probe`, { method: "DELETE" });
    if (write.status !== 403) throw new RevenueKeyError("This key can write. Create a v2 key with Charts & metrics: Read only.");
    return { environment: "live", accountRef: projectId, keyHint: keyHint(key) };
  },
  async sync(secret) {
    const { projectId, key } = revenuecatCredential(secret);
    return { rows: revenuecatRows(await overview(projectId, key)), method: "revenuecat_overview_v2" };
  },
};
