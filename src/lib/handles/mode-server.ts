import "server-only";

import { cache } from "react";

import type { ModeSlug } from "@/components/profile/types";
import { createBillingAdminClient } from "@/lib/billing/admin";
import { modeShortIdPattern } from "@/lib/share/mode-share-pattern";
import { createClient } from "@/lib/supabase/server";
import { usernamePattern } from "@/lib/usernames";
import { isModeHandleSlug, parseModeHandleState, type ModeHandleSlug, type ModeHandleState } from "./mode-handle";

export type ResolvedModeHandle = { username: string; slug: ModeHandleSlug; handle: string; indexable: boolean; shareToken: string | null };

/**
 * A live Business or Creator handle: which profile and Mode it opens. The resolver runs with the
 * service role only, so the username behind a Mode handle never reaches a browser.
 */
export const resolveModeHandle = cache(async (handle: string): Promise<ResolvedModeHandle | null> => {
  if (!usernamePattern.test(handle)) return null;
  try {
    const { data, error } = await createBillingAdminClient().rpc("resolve_mode_handle", { p_handle: handle });
    if (error || !data || typeof data !== "object") return null;
    const row = data as Record<string, unknown>;
    if (typeof row.username !== "string" || !usernamePattern.test(row.username) || typeof row.mode !== "string" || !isModeHandleSlug(row.mode) || row.handle !== handle) return null;
    const shareToken = typeof row.share_id === "string" && modeShortIdPattern.test(row.share_id) ? row.share_id : null;
    return { username: row.username, slug: row.mode, handle, indexable: row.indexed === true, shareToken };
  } catch {
    return null;
  }
});

/** The live handle of one profile's Mode, or null. Keyed by profile id; server only. */
export const liveModeHandle = cache(async (profileId: string, mode: ModeSlug): Promise<string | null> => {
  if (!isModeHandleSlug(mode)) return null;
  try {
    const { data, error } = await createBillingAdminClient().rpc("live_mode_handle", { p_profile: profileId, p_mode: mode });
    return !error && typeof data === "string" && usernamePattern.test(data) ? data : null;
  } catch {
    return null;
  }
});

/** The signed-in owner's own Mode handles (RLS: owners read their own rows only). */
export async function ownerModeHandles(profileId: string): Promise<Partial<Record<ModeHandleSlug, ModeHandleState>>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("mode_handles").select("handle, mode_slug, is_live, search_indexed").eq("profile_id", profileId);
    if (error) return {};
    const entries = (data ?? []).flatMap((row) => {
      const state = parseModeHandleState(row);
      return state && isModeHandleSlug(row.mode_slug) ? [[row.mode_slug, state] as const] : [];
    });
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}
