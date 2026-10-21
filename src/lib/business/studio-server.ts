import "server-only";

import { cache } from "react";

import { loadModeActions } from "@/lib/actions/studio-server";
import { ACTIVITY_COLUMNS, DEFAULT_BUSINESS_LIMITS, LEAD_COLUMNS, type BusinessLimits, type Funnel, type Lead, type LeadActivity } from "./model";

export const LEADS_HREF = "/app/identity/leads";

/** Business Mode's leads, the funnel for the window asked and the plan's limits, read as the owner under RLS. */
export const loadLeads = cache(async (days: number) => {
  const data = await loadModeActions("business", LEADS_HREF);
  if (!data.mode) return { ...data, ready: false as const };
  const { supabase } = data;
  const [leads, funnel, limits] = await Promise.all([
    supabase.from("business_leads").select(LEAD_COLUMNS).order("last_activity_at", { ascending: false }).limit(1000),
    supabase.rpc("my_business_funnel", { p_days: days }),
    supabase.rpc("my_business_limits"),
  ]);
  if (leads.error || funnel.error) return { ...data, ready: false as const };
  return {
    ...data,
    ready: true as const,
    leads: (leads.data ?? []) as Lead[],
    funnel: funnel.data as Funnel,
    limits: (limits.data as BusinessLimits | null) ?? DEFAULT_BUSINESS_LIMITS,
  };
});

export type LeadInquiry = { id: string; action_id: string; kind: string; answers: Record<string, string>; status: string; created_at: string };

/** One lead's history and the inquiries behind it, for its detail sheet. */
export async function loadLeadDetail(leadId: string) {
  const data = await loadModeActions("business", LEADS_HREF);
  const { supabase } = data;
  const { data: activity } = await supabase.from("business_lead_activities").select(ACTIVITY_COLUMNS).eq("lead_id", leadId).order("created_at", { ascending: false }).limit(200);
  const rows = (activity ?? []) as LeadActivity[];
  const ids = rows.map((row) => row.submission_id).filter((id): id is string => Boolean(id));
  const { data: inquiries } = ids.length
    ? await supabase.from("action_submissions").select("id, action_id, kind, answers, status, created_at").in("id", ids)
    : { data: [] };
  return { activity: rows, inquiries: (inquiries ?? []) as LeadInquiry[] };
}
