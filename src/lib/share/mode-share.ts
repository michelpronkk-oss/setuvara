import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import type { ModeSlug } from "@/components/profile/types";
import { createBillingAdminClient } from "@/lib/billing/admin";
import { createClient } from "@/lib/supabase/server";
import { getTapOrigin } from "@/lib/tap/server";

/**
 * Mode share locators.
 *
 * The canonical `/<username>` URL only ever shows the default Personal Mode.
 * Event and Business are reached through `/s/<token>`, an opaque pointer that
 * resolves server-side to one profile and one Mode. Tokens follow the Quick
 * Share design: derived from the server-only key and a random nonce, with
 * only the nonce and token hash stored in `mode_share_locators`.
 */

export const DEFAULT_PUBLIC_MODE: ModeSlug = "personal";
export const modeShareTokenPattern = /^[A-Za-z0-9_-]{43}$/;

const hex32 = /^[a-f0-9]{64}$/;
const keyPattern = /^[A-Za-z0-9_-]{43}$/;
const uuid = z.string().uuid();

function getShareKey() {
  const encoded = process.env.QUICK_SHARE_TOKEN_KEY?.trim();
  if (!encoded || !keyPattern.test(encoded)) throw new Error("Mode share is unavailable");
  const key = Buffer.from(encoded, "base64url");
  if (key.length !== 32 || key.toString("base64url") !== encoded) throw new Error("Mode share is unavailable");
  return key;
}

/** Exported for tests; callers use getModeShareToken. */
export function deriveModeShareToken(profileId: string, modeId: string, nonce: string) {
  if (!uuid.safeParse(profileId).success || !uuid.safeParse(modeId).success || !hex32.test(nonce)) {
    throw new Error("Mode share is unavailable");
  }
  return createHmac("sha256", getShareKey())
    .update("setuvara-mode-share-v1\0", "utf8")
    .update(profileId.toLowerCase(), "utf8")
    .update("\0", "utf8")
    .update(modeId.toLowerCase(), "utf8")
    .update(Buffer.from(nonce, "hex"))
    .digest("base64url");
}

function tokenHashHex(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function byteaHex(value: unknown) {
  if (typeof value !== "string") return null;
  const hex = value.startsWith("\\x") ? value.slice(2) : value;
  return hex32.test(hex) ? hex : null;
}

type LocatorRow = { profile_id: string; mode_id: string; nonce: unknown; token_hash: unknown };

function tokenFromRow(row: LocatorRow) {
  const nonce = byteaHex(row.nonce);
  const expected = byteaHex(row.token_hash);
  if (!nonce || !expected) return null;
  const token = deriveModeShareToken(row.profile_id, row.mode_id, nonce);
  const ok = timingSafeEqual(Buffer.from(tokenHashHex(token), "hex"), Buffer.from(expected, "hex"));
  return ok ? token : null;
}

/**
 * The stable opaque token for one of a profile's Modes, minted on first use.
 * Returns null when the Mode does not exist or the share key is unavailable;
 * callers must never fall back to a predictable `?mode=` URL.
 */
export async function getModeShareToken(profileId: string, mode: ModeSlug): Promise<string | null> {
  if (!uuid.safeParse(profileId).success) return null;
  try {
    const admin = createBillingAdminClient();
    const { data: modeRow, error: modeError } = await admin
      .from("profile_modes")
      .select("id")
      .eq("profile_id", profileId)
      .eq("slug", mode)
      .maybeSingle();
    if (modeError || !modeRow?.id) return null;

    const select = () => admin
      .from("mode_share_locators")
      .select("profile_id, mode_id, nonce, token_hash")
      .eq("profile_id", profileId)
      .eq("mode_id", modeRow.id)
      .maybeSingle();

    const { data: existing, error: readError } = await select();
    if (readError) return null;
    if (existing) return tokenFromRow(existing as LocatorRow);

    const nonce = randomBytes(32).toString("hex");
    const token = deriveModeShareToken(profileId, modeRow.id, nonce);
    const { error: insertError } = await admin.from("mode_share_locators").insert({
      profile_id: profileId,
      mode_id: modeRow.id,
      nonce: `\\x${nonce}`,
      token_hash: `\\x${tokenHashHex(token)}`,
    });
    // A concurrent request may have minted it first; the stored row wins.
    if (!insertError) return token;
    const { data: raced } = await select();
    return raced ? tokenFromRow(raced as LocatorRow) : null;
  } catch {
    return null;
  }
}

/** Public path for a profile's Mode: the canonical username for the default Mode, `/s/<token>` otherwise. */
export async function publicModePath(profileId: string, username: string, mode: ModeSlug): Promise<string | null> {
  if (mode === DEFAULT_PUBLIC_MODE) return `/${username}`;
  const token = await getModeShareToken(profileId, mode);
  return token ? `/s/${token}` : null;
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
