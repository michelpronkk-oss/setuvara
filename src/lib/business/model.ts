/**
 * Business Mode leads and its funnel. The database (20261023090000_business_leads.sql) owns the
 * rules; this mirrors its stages and shapes for pages and tests. Pure, so tests use it directly.
 */

export const LEAD_STAGES = ["new", "contacted", "qualified", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const OPEN_STAGES: LeadStage[] = ["new", "contacted", "qualified"];
export const STAGE_LABEL: Record<LeadStage, string> = { new: "New", contacted: "Contacted", qualified: "Qualified", won: "Won", lost: "Lost" };

export type Lead = {
  id: string; mode_id: string; source_submission_id: string | null; source_action_id: string | null;
  name: string; email: string | null; stage: LeadStage; lost_reason: string | null; inquiries: number;
  stage_changed_at: string; last_activity_at: string; created_at: string;
};
export const LEAD_COLUMNS = "id, mode_id, source_submission_id, source_action_id, name, email, stage, lost_reason, inquiries, stage_changed_at, last_activity_at, created_at";

export type LeadActivity = {
  id: string; lead_id: string; kind: "created" | "inquiry" | "stage" | "note"; submission_id: string | null;
  from_stage: LeadStage | null; to_stage: LeadStage | null; body: string | null; created_at: string;
};
export const ACTIVITY_COLUMNS = "id, lead_id, kind, submission_id, from_stage, to_stage, body, created_at";

export type BusinessLimits = { plan: "free" | "plus" | "pro"; can_note: boolean; can_export: boolean; funnel_days: number; booking_horizon_days: number; testimonials_shown: number };
export const DEFAULT_BUSINESS_LIMITS: BusinessLimits = { plan: "free", can_note: false, can_export: false, funnel_days: 7, booking_horizon_days: 14, testimonials_shown: 3 };

export type Funnel = {
  days: number; plan_days: number; since: string;
  visits: number; action_views: number; action_opens: number; responses: number; leads: number;
  bookings: number; bookings_accepted: number; won: number; lost: number;
  open_by_stage: Record<"new" | "contacted" | "qualified", number>;
};

export type LeadFilter = LeadStage | "open" | "all";

/** Leads matching a stage filter and a search over name and email, most recent activity first. */
export function filterLeads(leads: Lead[], filter: LeadFilter, query: string) {
  const needle = query.trim().toLowerCase();
  return leads
    .filter((lead) => filter === "all" || (filter === "open" ? OPEN_STAGES.includes(lead.stage) : lead.stage === filter))
    .filter((lead) => !needle || lead.name.toLowerCase().includes(needle) || (lead.email ?? "").toLowerCase().includes(needle))
    .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at));
}

/** One step of the funnel and how it compares with the step before it, when that is meaningful. */
export type FunnelStep = { key: string; label: string; value: number; note: string | null };

/**
 * The funnel as steps. Each number counts its own events in the window; nothing links one visitor
 * across steps, so a share is shown only between steps where one really follows from the other.
 */
export function funnelSteps(funnel: Funnel): FunnelStep[] {
  // Steps aren't linked person by person, so a share over 100% would mean nothing: it isn't shown.
  const share = (part: number, whole: number) => (whole > 0 && part <= whole ? `${Math.round((part / whole) * 100)}% of ${whole}` : null);
  return [
    { key: "visits", label: "Profile visits", value: funnel.visits, note: null },
    { key: "opens", label: "Action opens", value: funnel.action_opens, note: funnel.action_views ? `${funnel.action_views} card views` : null },
    { key: "responses", label: "Inquiries", value: funnel.responses, note: share(funnel.responses, funnel.action_opens) },
    { key: "leads", label: "New leads", value: funnel.leads, note: funnel.responses > funnel.leads ? "repeat inquiries join a lead" : null },
    { key: "bookings", label: "Booking requests", value: funnel.bookings, note: funnel.bookings ? `${funnel.bookings_accepted} accepted` : null },
    { key: "won", label: "Won", value: funnel.won, note: funnel.won + funnel.lost ? `${funnel.lost} lost` : null },
  ];
}

export const LEAD_FILTERS: LeadFilter[] = ["open", ...LEAD_STAGES, "all"];
/** Leads the inbox shows at a time; Show more adds the next page. */
export const LEAD_PAGE = 50;
/** One read of leads, the most PostgREST returns per request. */
export const LEAD_READ_BATCH = 1000;
/** The most leads one export carries. */
export const LEAD_EXPORT_MAX = 25000;

export type LeadExportQuery = { filter: LeadFilter; query: string; days: number | null };

/**
 * An export's filters from its URL: the inbox's stage filter and search, and an optional window
 * on last activity. Anything else falls back to all leads. The search drops characters PostgREST
 * reads as filter syntax, so it can only ever match text.
 */
export function parseLeadExport(params: URLSearchParams): LeadExportQuery {
  const filter = LEAD_FILTERS.find((item) => item === params.get("filter")) ?? "all";
  const query = (params.get("q") ?? "").replace(/[^\p{L}\p{N}@._+\- ]/gu, "").trim().slice(0, 80);
  const days = Number(params.get("days"));
  return { filter, query, days: [7, 30, 90, 365].includes(days) ? days : null };
}

/** The stages a filter keeps, or null for every stage. */
export function filterStages(filter: LeadFilter): LeadStage[] | null {
  return filter === "all" ? null : filter === "open" ? OPEN_STAGES : [filter];
}

export const LEAD_CSV_HEADER = ["Name", "Email", "Stage", "Lost reason", "Inquiries", "First inquiry via", "First inquiry", "Stage changed", "Last activity"];

/** One CSV row per lead, with its first inquiry's Action named rather than by id. */
export function leadCsvRow(lead: Lead, actionTitle: (id: string | null) => string) {
  return [lead.name, lead.email ?? "", STAGE_LABEL[lead.stage], lead.lost_reason ?? "", lead.inquiries, actionTitle(lead.source_action_id), lead.created_at, lead.stage_changed_at, lead.last_activity_at];
}

/** The export link for what the inbox shows now. */
export function leadExportHref(filter: LeadFilter, query: string) {
  const params = new URLSearchParams({ filter });
  if (query.trim()) params.set("q", query.trim());
  return `/api/business/leads/export?${params}`;
}
