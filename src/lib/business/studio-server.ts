import "server-only";

import { cache } from "react";

import { loadModeActions } from "@/lib/actions/studio-server";
import { BOOKING_COLUMNS, type Booking } from "./bookings";
import { REQUEST_COLUMNS, TESTIMONIAL_COLUMNS, type Testimonial, type TestimonialRequest } from "./testimonials";
import { ACTIVITY_COLUMNS, DEFAULT_BUSINESS_LIMITS, LEAD_COLUMNS, LEAD_READ_BATCH, type BusinessLimits, type Funnel, type Lead, type LeadActivity } from "./model";

export const LEADS_HREF = "/app/identity/leads";
/** The most leads the inbox holds; older ones are still in an export. */
export const INBOX_MAX = 5000;

type Reader = Awaited<ReturnType<typeof loadModeActions>>["supabase"];

/** The inbox's leads, most recent activity first, read a page at a time up to INBOX_MAX. */
async function readLeads(supabase: Reader) {
  const leads: Lead[] = [];
  for (let from = 0; from < INBOX_MAX; from += LEAD_READ_BATCH) {
    const { data, error } = await supabase.from("business_leads").select(LEAD_COLUMNS).order("last_activity_at", { ascending: false }).order("id").range(from, from + LEAD_READ_BATCH - 1);
    if (error) return { data: null, error };
    leads.push(...((data ?? []) as Lead[]));
    if ((data ?? []).length < LEAD_READ_BATCH) break;
  }
  return { data: leads, error: null };
}

/** Business Mode's leads, the funnel for the window asked and the plan's limits, read as the owner under RLS. */
export const loadLeads = cache(async (days: number) => {
  const data = await loadModeActions("business", LEADS_HREF);
  if (!data.mode) return { ...data, ready: false as const };
  const { supabase } = data;
  const bookingActions = data.actions.filter((action) => action.kind === "booking").map((action) => action.id);
  const [leads, funnel, limits, bookings] = await Promise.all([
    readLeads(supabase),
    supabase.rpc("my_business_funnel", { p_days: days }),
    supabase.rpc("my_business_limits"),
    bookingActions.length
      ? supabase.from("business_bookings").select(BOOKING_COLUMNS).in("action_id", bookingActions).neq("status", "cancelled").gte("ends_at", new Date().toISOString()).order("starts_at").limit(50)
      : Promise.resolve({ data: [] }),
  ]);
  if (leads.error || funnel.error) return { ...data, ready: false as const };
  return {
    ...data,
    ready: true as const,
    leads: leads.data ?? [],
    funnel: funnel.data as Funnel,
    limits: (limits.data as BusinessLimits | null) ?? DEFAULT_BUSINESS_LIMITS,
    bookings: ((bookings.data ?? []) as Booking[]).map((booking) => {
      const request = data.submissions.find((item) => item.id === booking.submission_id);
      return { ...booking, name: request?.name || request?.email || "Someone", title: data.actions.find((action) => action.id === booking.action_id)?.title ?? "Booking" };
    }),
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

export const TESTIMONIALS_HREF = "/app/identity/testimonials";

/** Business Mode's testimonials, its recent request links, and how many the plan shows, read as the owner under RLS. */
export async function loadTestimonials() {
  const data = await loadModeActions("business", TESTIMONIALS_HREF);
  if (!data.mode) return { ...data, ready: false as const };
  const { supabase } = data;
  const [testimonials, requests, limits] = await Promise.all([
    supabase.from("business_testimonials").select(TESTIMONIAL_COLUMNS).order("created_at", { ascending: false }).limit(300),
    supabase.from("business_testimonial_requests").select(REQUEST_COLUMNS).order("created_at", { ascending: false }).limit(60),
    supabase.rpc("my_business_limits"),
  ]);
  if (testimonials.error || requests.error) return { ...data, ready: false as const };
  return {
    ...data,
    ready: true as const,
    testimonials: (testimonials.data ?? []) as Testimonial[],
    requests: (requests.data ?? []) as TestimonialRequest[],
    limits: { ...DEFAULT_BUSINESS_LIMITS, ...((limits.data as Partial<BusinessLimits> | null) ?? {}) } as BusinessLimits,
  };
}
