import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { ModeSlug, ProfileBlock, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";
import { readableBlocks, selectBlocks } from "@/lib/blocks/registry";
import { parseConnectPolicy } from "@/lib/connections/access";
import { getPublicOrigin, getViewerPlan } from "@/lib/app/viewer";
import { parseSlidePhotos, signSlidePhotos } from "@/lib/app/slides";
import { memberTierForPlan } from "@/lib/billing/member-badge";
import { ownerModeHandles } from "@/lib/handles/mode-server";
import { ownerModeShareUrls } from "@/lib/share/mode-share";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LIMITS, SUBMISSION_COLUMNS, type ActionLimits, type ProfileAction, type Submission } from "./model";

const MEDIA = "profile-media";
export const ACTION_MODES: readonly ModeSlug[] = ["personal", "event", "business", "creator"];
export const isActionMode = (value: unknown): value is ModeSlug => ACTION_MODES.includes(value as ModeSlug);

/** Where a Mode's Actions live in the app. Creator keeps them inside the Creator studio. */
export function actionsBase(slug: ModeSlug) {
  return slug === "creator" ? "/app/identity/creator/actions" : "/app/identity/actions";
}
export function actionsListHref(slug: ModeSlug) {
  return slug === "creator" ? actionsBase(slug) : `${actionsBase(slug)}?mode=${slug}`;
}
export function newActionHref(slug: ModeSlug, kind?: string) {
  const query = [slug === "creator" ? null : `mode=${slug}`, kind ? `kind=${kind}` : null].filter(Boolean).join("&");
  return `${actionsBase(slug)}/new${query ? `?${query}` : ""}`;
}

/**
 * One Mode's Actions for its signed-in owner, with everything the editor's phone needs to draw the
 * real page: the Mode as the profile renders it (signed photos, links, blocks), the plan and the link.
 */
export const loadModeActions = cache(async (slug: ModeSlug, next: string) => {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !userId) redirect(`/login?next=${encodeURIComponent(next)}`);

  const [{ data: profile }, { data: modeRows }, viewer, requestHeaders] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, bio, is_published").eq("id", userId).maybeSingle(),
    supabase.from("profile_modes").select("id, slug, label, sort_order, is_enabled, settings, appearance, image_path, image_original_path, image_crop, slide_photos, image_focus_x, image_focus_y, connect_policy").eq("profile_id", userId).order("sort_order"),
    getViewerPlan(userId),
    headers(),
  ]);
  if (!profile) redirect(`/login?next=${encodeURIComponent(next)}`);
  const row = modeRows?.find((item) => item.slug === slug);
  if (!row) return { supabase, userId, profile: profile as ProfileIdentity, mode: null } as const;

  const [links, blocks, actions, limits, image, original, slideUrls, handles] = await Promise.all([
    supabase.from("profile_links").select("id, mode_id, title, url, link_type, sort_order, is_visible").eq("profile_id", userId).eq("mode_id", row.id).order("sort_order"),
    selectBlocks("id, mode_id, kind, data, sort_order, is_visible", (columns) => supabase.from("profile_blocks").select(columns).eq("profile_id", userId).eq("mode_id", row.id).order("sort_order")),
    supabase.from("profile_actions").select("id, mode_id, kind, status, title, intro, cta_label, cover_block_id, config, sort_order, starts_at, ends_at, published_at, closed_at, show_before_start, show_after_end, created_at, updated_at").eq("mode_id", row.id).order("sort_order").order("created_at"),
    supabase.rpc("my_action_limits"),
    row.image_path ? supabase.storage.from(MEDIA).createSignedUrl(row.image_path, 3600) : Promise.resolve({ data: null }),
    row.image_path && row.image_original_path ? supabase.storage.from(MEDIA).createSignedUrl(row.image_original_path, 3600) : Promise.resolve({ data: null }),
    signSlidePhotos(supabase, parseSlidePhotos(row.slide_photos)),
    ownerModeHandles(userId),
  ]);
  const actionRows = (actions.error ? [] : actions.data ?? []) as unknown as ProfileAction[];
  const submissions = actionRows.length
    ? await supabase.from("action_submissions").select(SUBMISSION_COLUMNS).eq("profile_id", userId).in("action_id", actionRows.map((item) => item.id)).order("created_at", { ascending: false }).limit(1000)
    : { data: [], error: null };

  const signed = await Promise.all(readableBlocks(blocks.data as unknown[] | null).map(async (block): Promise<ProfileBlock> => {
    const imagePath = typeof block.data.image_path === "string" ? block.data.image_path : null;
    const videoPath = typeof block.data.video_path === "string" ? block.data.video_path : null;
    const [imageUrl, videoUrl] = await Promise.all([
      imagePath ? supabase.storage.from(MEDIA).createSignedUrl(imagePath, 3600) : Promise.resolve({ data: null }),
      videoPath ? supabase.storage.from(MEDIA).createSignedUrl(videoPath, 3600) : Promise.resolve({ data: null }),
    ]);
    return { ...block, data: { ...block.data, ...(imagePath ? { image_url: imageUrl.data?.signedUrl ?? null } : {}), ...(videoPath ? { video_url: videoUrl.data?.signedUrl ?? null } : {}) } };
  }));

  const mode: ProfileMode = {
    ...row,
    slug: row.slug as ModeSlug,
    settings: (row.settings ?? {}) as Record<string, string | boolean>,
    appearance: row.appearance as ProfileMode["appearance"],
    connect_policy: parseConnectPolicy(row.connect_policy),
    image_url: image.data?.signedUrl ?? null,
    image_original_url: original.data?.signedUrl ?? null,
    image_crop: row.image_crop as ProfileMode["image_crop"],
    slide_photos: parseSlidePhotos(row.slide_photos),
    slide_urls: slideUrls,
    links: (links.data ?? []) as ProfileLink[],
    blocks: signed,
  };

  // Where visitors open this Mode, and so where an Action's own page hangs.
  const origin = await getPublicOrigin(requestHeaders);
  const handle = slug === "business" || slug === "creator" ? handles[slug] : undefined;
  const live = Boolean(profile.is_published && row.is_enabled);
  const shareUrls = live && slug !== "personal" ? await ownerModeShareUrls(userId, profile.username, [slug], origin) : {};
  const pageUrl = !live ? null : handle?.is_live ? `${origin}/${handle.handle}` : slug === "personal" ? `${origin}/${profile.username}` : shareUrls[slug] ?? null;

  return {
    supabase,
    userId,
    profile: profile as ProfileIdentity,
    mode,
    modes: (modeRows ?? []).filter((item) => isActionMode(item.slug)).map((item) => ({ slug: item.slug as ModeSlug, is_enabled: Boolean(item.is_enabled) })),
    personalImagePath: modeRows?.find((item) => item.slug === "personal")?.image_path ?? null,
    plan: viewer.plan,
    memberTier: memberTierForPlan(viewer.plan),
    actions: actionRows,
    submissions: (submissions.error ? [] : submissions.data ?? []) as unknown as Submission[],
    limits: (limits.data as ActionLimits | null) ?? DEFAULT_LIMITS.free,
    covers: signed.filter((block) => block.kind === "image" && typeof block.data.image_url === "string").map((block) => ({ id: block.id, imageUrl: block.data.image_url as string, title: typeof block.data.title === "string" && block.data.title ? block.data.title : "Picture" })),
    actionsReady: !actions.error && !submissions.error,
    pageUrl,
    origin,
  } as const;
});

export type ModeActions = Exclude<Awaited<ReturnType<typeof loadModeActions>>, { mode: null }>;
