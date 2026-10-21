"use server";

import { revalidatePath } from "next/cache";

import { LEAD_STAGES, type LeadStage } from "@/lib/business/model";
import { LEADS_HREF, loadLeadDetail } from "@/lib/business/studio-server";
import { TEAMS_HREF } from "@/lib/business/team";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[A-Za-z0-9_-]{16,64}$/;

const ERRORS: Record<string, string> = {
  lead_not_found: "This lead isn't here anymore.",
  lead_open_elsewhere: "This person has another open lead. Work that one instead.",
  notes_require_plus: "Notes are part of Plus.",
  invalid_note: "Write something first, up to 2,000 characters.",
  invalid_reason: "Keep the reason under 200 characters.",
};
const say = (message?: string) => Object.entries(ERRORS).find(([key]) => message?.includes(key))?.[1] ?? "That didn't go through. Try again.";

/** Moves a lead to another stage; Lost can carry a short reason. The database checks access and writes the history. */
export async function setLeadStage(leadId: string, stage: LeadStage, lostReason?: string) {
  if (!UUID.test(leadId) || !LEAD_STAGES.includes(stage)) return { ok: false as const, error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_business_lead_stage", { p_lead_id: leadId, p_stage: stage, p_lost_reason: stage === "lost" ? lostReason?.trim() || null : null });
  if (error) return { ok: false as const, error: say(error.message) };
  revalidatePath(LEADS_HREF);
  revalidatePath(TEAMS_HREF, "layout");
  return { ok: true as const };
}

/** Adds a private note (Plus). The key makes a retried press the same note. */
export async function addLeadNote(leadId: string, body: string, key: string) {
  if (!UUID.test(leadId) || !KEY.test(key)) return { ok: false as const, error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_business_lead_note", { p_lead_id: leadId, p_body: body, p_idempotency_key: key });
  if (error) return { ok: false as const, error: say(error.message) };
  revalidatePath(LEADS_HREF);
  revalidatePath(TEAMS_HREF, "layout");
  return { ok: true as const };
}

/** A lead's history and inquiries when its sheet opens, for the owner or a teammate; the database checks. */
export async function leadDetail(leadId: string) {
  if (!UUID.test(leadId)) return { activity: [], inquiries: [] };
  return loadLeadDetail(leadId);
}
