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

/** An Action's custom question ids mapped to their labels. */
export function questionLabels(config: unknown): Record<string, string> {
  const questions = (config as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(questions)) return {};
  return Object.fromEntries(questions.flatMap((question) => {
    const { id, label } = (question ?? {}) as { id?: unknown; label?: unknown };
    return typeof id === "string" && typeof label === "string" ? [[id, label]] : [];
  }));
}

export type LeadInquiry = { id: string; action_id: string; kind: string; answers: Record<string, string>; status: string; created_at: string; labels: Record<string, string> };

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
  // Custom questions are stored by id (q1, q2…); their labels live on the Action.
  const actionIds = [...new Set((inquiries ?? []).map((row) => row.action_id as string))];
  const { data: actions } = actionIds.length ? await supabase.from("profile_actions").select("id, config").in("id", actionIds) : { data: [] };
  const labels = new Map((actions ?? []).map((row) => [row.id as string, questionLabels(row.config)]));
  return { activity: rows, inquiries: (inquiries ?? []).map((row) => ({ ...row, labels: labels.get(row.action_id as string) ?? {} })) as LeadInquiry[] };
}
