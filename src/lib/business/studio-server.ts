import "server-only";

import { cache } from "react";

import { redirect } from "next/navigation";

import { loadModeActions } from "@/lib/actions/studio-server";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_COLUMNS, type Booking } from "./bookings";
import { TEAM_HREF, TEAMS_HREF, workspaceHref, type LeadRouting, type Membership, type Team, type Workspace } from "./team";
import { REQUEST_COLUMNS, TESTIMONIAL_COLUMNS, type Testimonial, type TestimonialRequest } from "./testimonials";
import { DEFAULT_BUSINESS_LIMITS, LEAD_COLUMNS, LEAD_READ_BATCH, type BusinessLimits, type Funnel, type Lead, type LeadActivity, type LeadPerson } from "./model";

export const LEADS_HREF = "/app/identity/leads";
/** The most leads the inbox holds; older ones are still in an export. */
export const INBOX_MAX = 5000;

type Reader = Awaited<ReturnType<typeof loadModeActions>>["supabase"];

/** The inbox's leads, most recent activity first, read a page at a time up to INBOX_MAX. */
async function readLeads(supabase: Reader, businessId: string) {
  const leads: Lead[] = [];
  for (let from = 0; from < INBOX_MAX; from += LEAD_READ_BATCH) {
    const { data, error } = await supabase.from("business_leads").select(LEAD_COLUMNS).eq("profile_id", businessId).order("last_activity_at", { ascending: false }).order("id").range(from, from + LEAD_READ_BATCH - 1);
    if (error) return { data: null, error };
    leads.push(...((data ?? []) as Lead[]));
    if ((data ?? []).length < LEAD_READ_BATCH) break;
  }
  return { data: leads, error: null };
}

/**
 * Business Mode's leads, the funnel for the window asked and the plan's limits, read as the owner
 * under RLS. Reads name the business: an owner who is also on someone else's team sees that one apart.
 */
export const loadLeads = cache(async (days: number) => {
  const data = await loadModeActions("business", LEADS_HREF);
  if (!data.mode) return { ...data, ready: false as const };
  const { supabase } = data;
  const bookingActions = data.actions.filter((action) => action.kind === "booking").map((action) => action.id);
  const [leads, funnel, limits, bookings, people] = await Promise.all([
    readLeads(supabase, data.userId),
    supabase.rpc("my_business_funnel", { p_days: days }),
    supabase.rpc("my_business_limits"),
    bookingActions.length
      ? supabase.from("business_bookings").select(BOOKING_COLUMNS).eq("profile_id", data.userId).in("action_id", bookingActions).neq("status", "cancelled").gte("ends_at", new Date().toISOString()).order("starts_at").limit(50)
      : Promise.resolve({ data: [] }),
    supabase.rpc("business_people", { p_business_id: data.userId }),
  ]);
  if (leads.error || funnel.error) return { ...data, ready: false as const };
  return {
    ...data,
    ready: true as const,
    leads: leads.data ?? [],
    funnel: funnel.data as Funnel,
    limits: (limits.data as BusinessLimits | null) ?? DEFAULT_BUSINESS_LIMITS,
    people: (people.error ? [] : people.data ?? []) as LeadPerson[],
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

/**
 * One lead's history and the inquiries behind it, for its detail sheet: the owner's or a teammate's.
 * The database checks access and hands over only this lead's inquiries.
 */
export async function loadLeadDetail(leadId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("business_lead_detail", { p_lead_id: leadId });
  const detail = data as { activity: LeadActivity[]; inquiries: (Omit<LeadInquiry, "labels"> & { questions: unknown })[] } | null;
  if (!detail) return { activity: [], inquiries: [] };
  // Custom questions are stored by id (q1, q2…); their labels live on the Action.
  return {
    activity: detail.activity,
    inquiries: detail.inquiries.map(({ questions, ...row }) => ({ ...row, labels: questionLabels({ questions }) })) as LeadInquiry[],
  };
}

export const TESTIMONIALS_HREF = "/app/identity/testimonials";

/** Business Mode's testimonials, its recent request links, and how many the plan shows, read as the owner under RLS. */
export async function loadTestimonials() {
  const data = await loadModeActions("business", TESTIMONIALS_HREF);
  if (!data.mode) return { ...data, ready: false as const };
  const { supabase } = data;
  const [testimonials, requests, limits] = await Promise.all([
    supabase.from("business_testimonials").select(TESTIMONIAL_COLUMNS).eq("profile_id", data.userId).order("created_at", { ascending: false }).limit(300),
    supabase.from("business_testimonial_requests").select(REQUEST_COLUMNS).eq("profile_id", data.userId).order("created_at", { ascending: false }).limit(60),
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

/** The owner's team: seats on their plan, members and live invites, and their own email for the form. */
export async function loadTeam() {
  const data = await loadModeActions("business", TEAM_HREF);
  if (!data.mode) return { ...data, ready: false as const };
  const [{ data: team, error }, { data: claims }, routing, people] = await Promise.all([
    data.supabase.rpc("my_business_team"),
    data.supabase.auth.getClaims(),
    data.supabase.rpc("my_lead_routing"),
    data.supabase.rpc("business_people", { p_business_id: data.userId }),
  ]);
  if (error || !team) return { ...data, ready: false as const };
  const email = typeof claims?.claims?.email === "string" ? claims.claims.email : null;
  return {
    ...data, ready: true as const, team: team as Team, email,
    routing: (routing.error ? null : routing.data) as LeadRouting | null,
    people: (people.error ? [] : people.data ?? []) as LeadPerson[],
  };
}

async function signedIn(next: string) {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !userId) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, userId };
}

/** The businesses the signed-in person works for. */
export async function loadMemberships() {
  const { supabase } = await signedIn(TEAMS_HREF);
  const { data, error } = await supabase.rpc("my_business_teams");
  return { ready: !error, memberships: (error ? [] : data ?? []) as Membership[] };
}

/** One business's leads and bookings coming up, for a teammate. Null when they have no access (now). */
export async function loadWorkspace(businessId: string) {
  const { supabase } = await signedIn(workspaceHref(businessId));
  const { data } = await supabase.rpc("business_workspace", { p_business_id: businessId });
  const workspace = data as Workspace | null;
  if (!workspace) return null;
  const [leads, people, { data: claims }] = await Promise.all([readLeads(supabase, businessId), supabase.rpc("business_people", { p_business_id: businessId }), supabase.auth.getClaims()]);
  if (leads.error) return null;
  return { workspace, leads: leads.data ?? [], people: (people.error ? [] : people.data ?? []) as LeadPerson[], me: String(claims?.claims?.sub ?? "") };
}
