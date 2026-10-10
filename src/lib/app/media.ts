import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModeSlug } from "@/components/profile/types";

export type ConnectionImageRequest = {
  connectionId: string;
  profileId: string | null;
  mode: ModeSlug;
};

export type ConnectionProfileMode = {
  slug: ModeSlug;
  is_enabled: true;
  settings: Record<string, unknown>;
  image_path: string | null;
};

export type ResolvedConnectionProfiles = {
  modesByProfile: Map<string, Map<ModeSlug, ConnectionProfileMode>>;
  imagePathsByConnection: Map<string, string>;
};

/**
 * Resolves only the registered counterpart's published Mode photo. The
 * profile_modes RLS policy hides unpublished/disabled Modes; the owner-folder
 * check below also prevents a stale or malformed row from pointing at someone
 * else's private Storage object.
 */
export async function resolveConnectionProfiles(
  supabase: SupabaseClient,
  requests: readonly ConnectionImageRequest[],
): Promise<ResolvedConnectionProfiles> {
  const modesByProfile = new Map<string, Map<ModeSlug, ConnectionProfileMode>>();
  const imagePathsByConnection = new Map<string, string>();
  const profileIds = [...new Set(requests.flatMap((request) => request.profileId ? [request.profileId] : []))];
  if (!profileIds.length) return { modesByProfile, imagePathsByConnection };

  const { data: modes, error } = await supabase
    .from("profile_modes")
    .select("profile_id,slug,is_enabled,settings,image_path")
    .in("profile_id", profileIds)
    .in("slug", ["personal", "event", "business"])
    .eq("is_enabled", true);
  if (error || !modes?.length) return { modesByProfile, imagePathsByConnection };

  for (const mode of modes) {
    if (mode.slug !== "personal" && mode.slug !== "event" && mode.slug !== "business") continue;
    const row: ConnectionProfileMode = {
      slug: mode.slug,
      is_enabled: true,
      settings: isObject(mode.settings) ? mode.settings : {},
      image_path: mode.image_path && isProfileMediaPath(mode.profile_id, mode.image_path) ? mode.image_path : null,
    };
    const profileModes = modesByProfile.get(mode.profile_id) ?? new Map<ModeSlug, ConnectionProfileMode>();
    profileModes.set(mode.slug, row);
    modesByProfile.set(mode.profile_id, profileModes);
  }

  for (const request of requests) {
    if (!request.profileId) continue;
    const profileModes = modesByProfile.get(request.profileId);
    const path = profileModes?.get(request.mode)?.image_path ?? profileModes?.get("personal")?.image_path;
    if (path) imagePathsByConnection.set(request.connectionId, path);
  }
  return { modesByProfile, imagePathsByConnection };
}

function isProfileMediaPath(profileId: string, path: string) {
  return path.startsWith(`${profileId}/`)
    && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(path);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Hosted Storage supports transforms; the local stack can run without imgproxy. */
export async function signHomeImage(supabase: SupabaseClient, path: string | null | undefined, thumbnail = false) {
  if (!path) return null;
  const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1").hostname;
  const local = hostname === "127.0.0.1" || hostname === "localhost";
  const bucket = supabase.storage.from("profile-media");
  const transform = thumbnail ? { width: 96, height: 96, resize: "cover" as const } : { width: 1600, quality: 72 };
  const { data, error } = await bucket.createSignedUrl(path, 3600, local ? undefined : { transform });
  if (!error) return data?.signedUrl ?? null;
  if (local) return null;
  const fallback = await bucket.createSignedUrl(path, 3600);
  return fallback.data?.signedUrl ?? null;
}
