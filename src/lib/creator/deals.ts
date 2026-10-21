/**
 * Creator brand deals. The database (20261024090000_creator_deals.sql) owns the rules; this mirrors
 * the stages and shapes for pages and tests. Money here is only ever the creator's own entry.
 */

export const DEAL_STAGES = ["new", "talking", "booked", "completed", "paid", "declined"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export const OPEN_DEAL_STAGES: DealStage[] = ["new", "talking", "booked", "completed"];
export const DEAL_STAGE_LABEL: Record<DealStage, string> = { new: "New", talking: "Talking", booked: "Booked", completed: "Completed", paid: "Paid", declined: "Declined" };

export type Deal = {
  id: string; submission_id: string | null; brand: string; contact_name: string; contact_email: string | null;
  collab_type: string | null; stated_budget: string | null; stage: DealStage; declined_reason: string | null;
  agreed_amount_cents: number | null; currency: string | null; stage_changed_at: string; last_activity_at: string; created_at: string;
};
export const DEAL_COLUMNS = "id, submission_id, brand, contact_name, contact_email, collab_type, stated_budget, stage, declined_reason, agreed_amount_cents, currency, stage_changed_at, last_activity_at, created_at";

export type DealActivity = { id: string; deal_id: string; kind: "created" | "stage" | "note" | "amount"; from_stage: DealStage | null; to_stage: DealStage | null; body: string | null; amount_cents: number | null; currency: string | null; created_at: string };
export const DEAL_ACTIVITY_COLUMNS = "id, deal_id, kind, from_stage, to_stage, body, amount_cents, currency, created_at";

export type DealFilter = DealStage | "open" | "all";

export function filterDeals(deals: Deal[], filter: DealFilter, query: string) {
  const needle = query.trim().toLowerCase();
  return deals
    .filter((deal) => filter === "all" || (filter === "open" ? OPEN_DEAL_STAGES.includes(deal.stage) : deal.stage === filter))
    .filter((deal) => !needle || [deal.brand, deal.contact_name, deal.contact_email ?? ""].some((text) => text.toLowerCase().includes(needle)))
    .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at));
}

export function formatMoney(cents: number, currency: string, locale = "en-GB") {
  try { return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
}

/** "4,500" or "4500.50" typed by a person, as minor units; null when it isn't a plain amount. */
export function parseAmount(input: string) {
  const clean = input.trim().replace(/[\s,]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/**
 * Totals of what the creator recorded, per currency: booked (agreed, not yet paid) and paid.
 * Currencies are never added together, and a deal without an amount adds nothing.
 */
export function dealTotals(deals: Deal[]) {
  const totals = new Map<string, { booked: number; paid: number }>();
  for (const deal of deals) {
    if (deal.agreed_amount_cents === null || !deal.currency) continue;
    const bucket = deal.stage === "paid" ? "paid" : ["booked", "completed"].includes(deal.stage) ? "booked" : null;
    if (!bucket) continue;
    const row = totals.get(deal.currency) ?? { booked: 0, paid: 0 };
    row[bucket] += deal.agreed_amount_cents;
    totals.set(deal.currency, row);
  }
  return [...totals.entries()].map(([currency, row]) => ({ currency, ...row })).sort((a, b) => a.currency.localeCompare(b.currency));
}
