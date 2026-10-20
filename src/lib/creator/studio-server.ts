import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { ProfileBlock, ProfileLink } from "@/components/profile/types";
import { readableBlocks, selectBlocks } from "@/lib/blocks/registry";
import { getPublicOrigin } from "@/lib/app/viewer";
import { ownerModeShareUrls } from "@/lib/share/mode-share";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LIMITS, SUBMISSION_COLUMNS, type ActionLimits, type ProfileAction, type Submission } from "@/lib/actions/model";
import { SOCIAL_ACCOUNT_COLUMNS, type SocialAccount } from "@/lib/social/model";
import { EMPTY_KIT, isWorkBlock, readCreatorSettings, workItem, type MediaKit, type StoreOffer, type WorkItem } from "./studio";

const MEDIA = "profile-media";

/** Everything the Creator studio and the Creator dashboard read, for the signed-in owner only. */
export const loadCreatorStudio = cache(async (next = "/app/identity/creator") => {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !userId) redirect(`/login?next=${encodeURIComponent(next)}`);

  const [{ data: profile }, { data: mode }] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, bio, is_published").eq("id", userId).maybeSingle(),
    supabase.from("profile_modes").select("id, slug, is_enabled, settings, appearance, image_path, image_focus_x, image_focus_y, connect_policy, updated_at").eq("profile_id", userId).eq("slug", "creator").maybeSingle(),
  ]);
  if (!profile) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!mode) return { supabase, userId, profile, mode: null } as const;

  const [links, blocks, offers, actions, submissions, limits, socials, kit, follows, monetization, requestHeaders, image] = await Promise.all([
    supabase.from("profile_links").select("id, title, url, link_type, is_visible, sort_order").eq("profile_id", userId).eq("mode_id", mode.id).order("sort_order"),
    selectBlocks("id, kind, data, is_visible, sort_order", (columns) => supabase.from("profile_blocks").select(columns).eq("profile_id", userId).eq("mode_id", mode.id).order("sort_order")),
    // Offer types arrive with the Creator studio migration; before it the Store reads as empty.
    supabase.from("creator_offers").select("id, kind, offer_type, external_url, title, description, currency, unit_amount_minor, status, sort_order").neq("status", "archived").order("sort_order").order("created_at", { ascending: false }),
    // Actions and platform accounts arrive with the Creator Actions migration; before it they read as empty.
    supabase.from("profile_actions").select("id, mode_id, kind, status, title, intro, cta_label, cover_block_id, config, sort_order, starts_at, ends_at, published_at, closed_at, created_at, updated_at").eq("mode_id", mode.id).order("sort_order").order("created_at"),
    supabase.from("action_submissions").select(SUBMISSION_COLUMNS).eq("profile_id", userId).order("created_at", { ascending: false }).limit(500),
    supabase.rpc("my_action_limits"),
    supabase.from("social_accounts").select(SOCIAL_ACCOUNT_COLUMNS).eq("profile_id", userId),
    supabase.from("creator_media_kits").select("languages, partners, rates, contact_email, show_platforms, show_partners, show_rates, show_contact, updated_at").maybeSingle(),
    supabase.rpc("creator_follower_count"),
    supabase.rpc("creator_monetization_enabled"),
    headers(),
    mode.image_path ? supabase.storage.from(MEDIA).createSignedUrl(mode.image_path, 3600) : Promise.resolve({ data: null }),
  ]);

  const rows = readableBlocks(blocks.data as unknown[] | null);
  const signed = await Promise.all(rows.map(async (block): Promise<ProfileBlock> => {
    const imagePath = typeof block.data.image_path === "string" ? block.data.image_path : null;
    const videoPath = typeof block.data.video_path === "string" ? block.data.video_path : null;
    const [imageUrl, videoUrl] = await Promise.all([
      imagePath ? supabase.storage.from(MEDIA).createSignedUrl(imagePath, 3600) : Promise.resolve({ data: null }),
      videoPath ? supabase.storage.from(MEDIA).createSignedUrl(videoPath, 3600) : Promise.resolve({ data: null }),
    ]);
    return { ...block, data: { ...block.data, ...(imageUrl.data ? { image_url: imageUrl.data.signedUrl } : {}), ...(videoUrl.data ? { video_url: videoUrl.data.signedUrl } : {}) } };
  }));
  const origin = await getPublicOrigin(requestHeaders);
  const shareUrls = mode.is_enabled && profile.is_published ? await ownerModeShareUrls(userId, profile.username, ["creator"], origin) : {};

  return {
    supabase,
    userId,
    profile,
    mode: { ...mode, settings: (mode.settings ?? {}) as Record<string, unknown> },
    settings: readCreatorSettings(mode.settings as Record<string, unknown>),
    imageUrl: image.data?.signedUrl ?? null,
    links: (links.data ?? []) as ProfileLink[],
    blocks: signed,
    work: signed.filter(isWorkBlock).map(workItem) as WorkItem[],
    offers: (offers.error ? [] : offers.data ?? []) as StoreOffer[],
    actions: (actions.error ? [] : actions.data ?? []) as unknown as ProfileAction[],
    submissions: (submissions.error ? [] : submissions.data ?? []) as unknown as Submission[],
    limits: (limits.data as ActionLimits | null) ?? DEFAULT_LIMITS.free,
    socials: (socials.error ? [] : socials.data ?? []) as SocialAccount[],
    kit: { ...EMPTY_KIT, ...(kit.data ?? {}) } as MediaKit,
    /** False when the Creator studio migration has not reached this database yet. */
    studioReady: !kit.error,
    /** False when the Creator Actions migration has not reached this database yet. */
    actionsReady: !actions.error && !submissions.error,
    followerCount: Number(follows.data ?? 0),
    canMonetize: monetization.data === true,
    shareUrl: shareUrls.creator ?? null,
    origin,
  } as const;
});

export type CreatorStudio = Exclude<Awaited<ReturnType<typeof loadCreatorStudio>>, { mode: null }>;
