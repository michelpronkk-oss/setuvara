import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { readFocus, type PhotoFocus } from "@/components/profile/photo-focus";
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
  image_focus: PhotoFocus;
};

export type ResolvedConnectionProfiles = {
  modesByProfile: Map<string, Map<ModeSlug, ConnectionProfileMode>>;
  imagePathsByConnection: Map<string, string>;
  /** Focus point of the photo chosen for each Connection, alongside its path. */
  imageFocusByConnection: Map<string, PhotoFocus>;
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
  const imageFocusByConnection = new Map<string, PhotoFocus>();
  const profileIds = [...new Set(requests.flatMap((request) => request.profileId ? [request.profileId] : []))];
  if (!profileIds.length) return { modesByProfile, imagePathsByConnection, imageFocusByConnection };

  const { data: modes, error } = await supabase
    .from("profile_modes")
    .select("profile_id,slug,is_enabled,settings,image_path,image_focus_x,image_focus_y")
    .in("profile_id", profileIds)
    .in("slug", ["personal", "event", "business"])
    .eq("is_enabled", true);
  if (error || !modes?.length) return { modesByProfile, imagePathsByConnection, imageFocusByConnection };

  for (const mode of modes) {
    if (mode.slug !== "personal" && mode.slug !== "event" && mode.slug !== "business") continue;
    const row: ConnectionProfileMode = {
      slug: mode.slug,
      is_enabled: true,
      settings: isObject(mode.settings) ? mode.settings : {},
      image_path: mode.image_path && isProfileMediaPath(mode.profile_id, mode.image_path) ? mode.image_path : null,
      image_focus: readFocus(mode.image_focus_x, mode.image_focus_y),
    };
    const profileModes = modesByProfile.get(mode.profile_id) ?? new Map<ModeSlug, ConnectionProfileMode>();
    profileModes.set(mode.slug, row);
    modesByProfile.set(mode.profile_id, profileModes);
  }

  for (const request of requests) {
    if (!request.profileId) continue;
    const profileModes = modesByProfile.get(request.profileId);
    const requested = profileModes?.get(request.mode);
    const row = requested?.image_path ? requested : profileModes?.get("personal");
    if (row?.image_path) {
      imagePathsByConnection.set(request.connectionId, row.image_path);
      imageFocusByConnection.set(request.connectionId, row.image_focus);
    }
  }
  return { modesByProfile, imagePathsByConnection, imageFocusByConnection };
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
  // Thumbnails keep the photo's own 4:5 shape so the focus point can frame them on the client.
  const transform = thumbnail ? { width: 96, height: 120, resize: "cover" as const } : { width: 1600, quality: 72 };
  const { data, error } = await bucket.createSignedUrl(path, 3600, local ? undefined : { transform });
  if (!error) return data?.signedUrl ?? null;
  if (local) return null;
  const fallback = await bucket.createSignedUrl(path, 3600);
  return fallback.data?.signedUrl ?? null;
}
