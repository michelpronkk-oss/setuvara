"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERRORS: Record<string, string> = {
  sign_in_required: "Sign in to take part.",
  confirm_email_first: "Confirm your email address first.",
  rate_limited: "That's a lot for now. Try again later.",
  voting_closed: "Voting is closed on this project.",
  suggestions_closed: "This project isn't taking suggestions.",
  already_shipped: "This one already shipped.",
  own_project: "This is your own project.",
  invalid_suggestion: "Give it a title of 3–100 characters.",
  item_not_found: "That item isn't here anymore.",
  project_not_found: "That project isn't here anymore.",
  suggestion_not_found: "That suggestion isn't here anymore.",
};
const say = (message?: string) => Object.entries(ERRORS).find(([key]) => message?.includes(key))?.[1] ?? "That didn't go through. Try again.";

/** A visitor's vote on a roadmap item. The database checks who they are, the item and the limits. */
export async function voteBuilderItem(itemId: string, vote: boolean) {
  if (!UUID.test(itemId)) return { ok: false as const, error: ERRORS.item_not_found };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vote_builder_item", { p_item_id: itemId, p_vote: vote });
  if (error) return { ok: false as const, error: say(error.message) };
  return { ok: true as const, ...(data as { voted: boolean; votes: number }) };
}

/** A visitor's idea for a project; private until the owner approves it. */
export async function suggestBuilderFeature(projectId: string, title: string, body: string) {
  if (!UUID.test(projectId)) return { ok: false as const, error: ERRORS.project_not_found };
  const supabase = await createClient();
  const { error } = await supabase.rpc("suggest_builder_feature", { p_project_id: projectId, p_title: title.slice(0, 100), p_body: body.slice(0, 1000) });
  if (error) return { ok: false as const, error: say(error.message) };
  return { ok: true as const };
}

/** The owner approves (optionally onto the roadmap) or declines a suggestion. */
export async function reviewBuilderSuggestion(suggestionId: string, approve: boolean, addToRoadmap: boolean) {
  if (!UUID.test(suggestionId)) return { ok: false as const, error: ERRORS.suggestion_not_found };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_builder_suggestion", { p_suggestion_id: suggestionId, p_approve: approve, p_add_to_roadmap: addToRoadmap });
  if (error) return { ok: false as const, error: say(error.message) };
  revalidatePath("/app/identity/creator/builder");
  revalidatePath("/app/identity/builder");
  return { ok: true as const };
}
