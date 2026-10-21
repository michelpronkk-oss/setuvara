"use server";

import { revalidatePath } from "next/cache";

import { cleanAnswers, GOALS, isGoalId, validateAnswers } from "@/lib/goals/templates";
import { createClient } from "@/lib/supabase/server";

const KEY = /^[A-Za-z0-9_-]{16,64}$/;
const ZONE = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/;
const ERRORS: Record<string, string> = {
  goal_requires_plus: "This goal is part of Plus and Pro.",
  mode_not_owned: "Turn this Mode on first.",
  action_config_invalid: "Something in the answers didn't fit. Check them and try again.",
  price_below_minimum: "The lowest price is 0.50.",
  currency_not_supported: "Choose EUR, USD or GBP.",
};
const say = (message?: string) => Object.entries(ERRORS).find(([key]) => message?.includes(key))?.[1] ?? "That didn't go through. Try again.";

export type ApplyGoalResult = { ok: true; setupId: string; duplicate: boolean } | { ok: false; error: string };

/**
 * Creates a goal's drafts in one transaction. The answers are re-validated here; the rows are
 * built from the goal on the server, never taken from the browser; the database checks the Mode,
 * the plan and every record's own rules.
 */
export async function applyGoal(goalId: string, rawAnswers: Record<string, unknown>, idempotencyKey: string, timezone: string): Promise<ApplyGoalResult> {
  if (!isGoalId(goalId) || !KEY.test(idempotencyKey)) return { ok: false, error: "That didn't go through. Try again." };
  const goal = GOALS[goalId];
  const answers = cleanAnswers(goal, rawAnswers ?? {});
  const invalid = validateAnswers(goal, answers);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return { ok: false, error: "Sign in first." };
  const [{ data: mode }, { data: profile }] = await Promise.all([
    supabase.from("profile_modes").select("id").eq("profile_id", userId).eq("slug", goal.mode).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
  ]);
  if (!mode) return { ok: false, error: ERRORS.mode_not_owned };

  const firstName = ((profile?.display_name as string | undefined) ?? "").split(/\s+/)[0] ?? "";
  const plan = goal.build(answers, { firstName, now: Date.now(), timezone: ZONE.test(timezone) ? timezone : "Europe/Amsterdam" });
  const { data, error } = await supabase.rpc("apply_goal_setup", {
    p_mode_id: mode.id, p_template: goal.id, p_idempotency_key: idempotencyKey, p_answers: answers,
    p_actions: plan.actions, p_event: plan.event, p_offer: plan.offer,
  });
  if (error) return { ok: false, error: say(error.message) };
  const result = data as { id: string; duplicate: boolean };
  revalidatePath("/app");
  revalidatePath("/app/identity/goals");
  return { ok: true, setupId: result.id, duplicate: result.duplicate };
}
