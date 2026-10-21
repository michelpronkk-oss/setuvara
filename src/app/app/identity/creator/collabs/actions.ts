"use server";

import { revalidatePath } from "next/cache";

import { DEAL_ACTIVITY_COLUMNS, DEAL_STAGES, type DealActivity, type DealStage } from "@/lib/creator/deals";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[A-Za-z0-9_-]{16,64}$/;
const PATH = "/app/identity/creator/collabs";
const ERRORS: Record<string, string> = {
  deal_not_found: "This deal isn't here anymore.",
  notes_require_plus: "Notes are part of Plus.",
  invalid_note: "Write something first, up to 2,000 characters.",
  invalid_reason: "Keep the reason under 200 characters.",
  invalid_amount: "Enter an amount and a three-letter currency, like 4500 EUR.",
};
const say = (message?: string) => Object.entries(ERRORS).find(([key]) => message?.includes(key))?.[1] ?? "That didn't go through. Try again.";

export async function setDealStage(dealId: string, stage: DealStage, reason?: string) {
  if (!UUID.test(dealId) || !DEAL_STAGES.includes(stage)) return { ok: false as const, error: "Not found." };
  const { error } = await (await createClient()).rpc("set_creator_deal_stage", { p_deal_id: dealId, p_stage: stage, p_reason: stage === "declined" ? reason?.trim() || null : null });
  if (error) return { ok: false as const, error: say(error.message) };
  revalidatePath(PATH);
  return { ok: true as const };
}

export async function setDealAmount(dealId: string, amountCents: number | null, currency: string | null) {
  if (!UUID.test(dealId)) return { ok: false as const, error: "Not found." };
  const { error } = await (await createClient()).rpc("set_creator_deal_amount", { p_deal_id: dealId, p_amount_cents: amountCents, p_currency: currency });
  if (error) return { ok: false as const, error: say(error.message) };
  revalidatePath(PATH);
  return { ok: true as const };
}

export async function addDealNote(dealId: string, body: string, key: string) {
  if (!UUID.test(dealId) || !KEY.test(key)) return { ok: false as const, error: "Not found." };
  const { error } = await (await createClient()).rpc("add_creator_deal_note", { p_deal_id: dealId, p_body: body, p_idempotency_key: key });
  if (error) return { ok: false as const, error: say(error.message) };
  revalidatePath(PATH);
  return { ok: true as const };
}

/** A deal's history and the request behind it, read under RLS. */
export async function dealDetail(dealId: string) {
  if (!UUID.test(dealId)) return { activity: [] as DealActivity[], answers: null };
  const supabase = await createClient();
  const [{ data: activity }, { data: deal }] = await Promise.all([
    supabase.from("creator_deal_activities").select(DEAL_ACTIVITY_COLUMNS).eq("deal_id", dealId).order("created_at", { ascending: false }).limit(200),
    supabase.from("creator_deals").select("submission_id").eq("id", dealId).maybeSingle(),
  ]);
  const { data: submission } = deal?.submission_id ? await supabase.from("action_submissions").select("answers").eq("id", deal.submission_id).maybeSingle() : { data: null };
  return { activity: (activity ?? []) as DealActivity[], answers: (submission?.answers ?? null) as Record<string, string> | null };
}
