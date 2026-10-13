import "server-only";

import { z } from "zod";

import type { ModeSlug } from "@/components/profile/types";
import { createBillingAdminClient } from "@/lib/billing/admin";
import { createClient } from "@/lib/supabase/server";
import { getTapOrigin } from "@/lib/tap/server";
import { modeShareTokenPattern, modeShortIdPattern } from "@/lib/share/mode-share-pattern";

/**
 * Mode share locators.
 *
 * The canonical `/<username>` URL only ever shows the default Personal Mode.
 * Event and Business are reached through `/s/<short id>`: an 8-character
 * Base62 id drawn by the database from a CSPRNG, one stable id per Mode,
 * resolved server-side to one profile and one Mode. It is a pointer only,
 * never authorization. 43-character tokens issued before short ids keep
 * resolving until the owner regenerates that Mode's link.
 */

export const DEFAULT_PUBLIC_MODE: ModeSlug = "personal";
export { modeShareTokenPattern, modeShortIdPattern };

const uuid = z.string().uuid();

/**
 * The stable short id for one of a profile's Modes, minted on first use.
 * Returns null when the Mode does not exist or the locator store is
 * unavailable; callers must never fall back to a predictable `?mode=` URL.
 */
export async function getModeShareId(profileId: string, mode: ModeSlug): Promise<string | null> {
  if (!uuid.safeParse(profileId).success) return null;
  try {
    // The Mode is read as the caller (owner, or a visitor of a published
    // identity); the service role only touches the locator table.
    const supabase = await createClient();
    const { data: modeRow, error: modeError } = await supabase
      .from("profile_modes")
      .select("id")
      .eq("profile_id", profileId)
      .eq("slug", mode)
      .maybeSingle();
    if (modeError || !modeRow?.id) return null;
    const admin = createBillingAdminClient();

    const select = () => admin
      .from("mode_share_locators")
      .select("short_id")
      .eq("profile_id", profileId)
      .eq("mode_id", modeRow.id)
      .maybeSingle();
    const shortId = (row: { short_id?: unknown } | null) =>
      typeof row?.short_id === "string" && modeShortIdPattern.test(row.short_id) ? row.short_id : null;

    const { data: existing, error: readError } = await select();
    if (readError) return null;
    if (existing) return shortId(existing);

    // The database default draws the short id; a rare id collision or a
    // concurrent first mint fails the insert, and the next try settles it.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data: inserted, error: insertError } = await admin
        .from("mode_share_locators")
        .insert({ profile_id: profileId, mode_id: modeRow.id })
        .select("short_id")
        .single();
      if (!insertError) return shortId(inserted);
      const { data: raced } = await select();
      if (raced) return shortId(raced);
    }
    return null;
  } catch {
    return null;
  }
}

/** Public path for a profile's Mode: the canonical username for the default Mode, `/s/<token>` otherwise. */
export async function publicModePath(profileId: string, username: string, mode: ModeSlug): Promise<string | null> {
  if (mode === DEFAULT_PUBLIC_MODE) return `/${username}`;
  const shortId = await getModeShareId(profileId, mode);
  return shortId ? `/s/${shortId}` : null;
}

/**
 * Same as publicModePath when only the username is known (Tap, Quick QR,
 * Connection Pass). Those only land on published identities, which the
 * visitor's own client can already read; the service role never reads usernames.
 */
export async function publicModePathForUsername(username: string, mode: ModeSlug): Promise<string | null> {
  if (mode === DEFAULT_PUBLIC_MODE) return `/${username}`;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("id").eq("username", username).eq("is_published", true).maybeSingle();
    return data?.id ? publicModePath(data.id, username, mode) : null;
  } catch {
    return null;
  }
}

/** Absolute share URLs for each of the owner's Modes, for the editor and home. */
export async function ownerModeShareUrls(profileId: string, username: string, modes: ModeSlug[], origin = getTapOrigin()) {
  const entries = await Promise.all(modes.map(async (mode) => {
    const path = await publicModePath(profileId, username, mode);
    return [mode, path ? `${origin}${path}` : null] as const;
  }));
  return Object.fromEntries(entries) as Partial<Record<ModeSlug, string | null>>;
}

export type ResolvedModeShare = { username: string; mode: ModeSlug };

export function parseResolvedModeShare(value: unknown): ResolvedModeShare | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.username !== "string" || !/^[a-z0-9_]{3,24}$/.test(row.username)) return null;
  if (row.mode !== "personal" && row.mode !== "event" && row.mode !== "business") return null;
  return { username: row.username, mode: row.mode };
}
