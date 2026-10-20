import "server-only";

import { cache } from "react";

import type { ModeSlug } from "@/components/profile/types";
import { createPublicProfileImageUrl } from "@/lib/supabase/public-profile-image-url";
import { createClient } from "@/lib/supabase/server";
import type { PublicAction } from "./model";
import { creatorActionsEnabled } from "./server";

/** A Mode's live Actions with their cover pictures, as any visitor may see them. Empty while Actions are switched off. */
export const getPublicActions = cache(async (username: string, mode: ModeSlug): Promise<{ action: PublicAction; coverUrl: string | null }[]> => {
  if (!creatorActionsEnabled()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_profile_actions", { p_username: username, p_mode: mode });
  if (error || !Array.isArray(data)) return [];
  const actions = data as PublicAction[];
  const coverIds = [...new Set(actions.map((item) => item.cover_block_id).filter((id): id is string => Boolean(id)))];
  // Covers are this Mode's own picture blocks, read under their public rules.
  const { data: blocks } = coverIds.length ? await supabase.from("profile_blocks").select("id, data").in("id", coverIds) : { data: [] };
  const covers = new Map(await Promise.all((blocks ?? []).map(async (block) => {
    const path = (block.data as Record<string, unknown> | null)?.image_path;
    return [block.id as string, typeof path === "string" ? await createPublicProfileImageUrl(supabase, path) : null] as const;
  })));
  return actions.map((action) => ({ action, coverUrl: action.cover_block_id ? covers.get(action.cover_block_id) ?? null : null }));
});
