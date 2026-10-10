import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import { createQuickShareCandidate, parseQuickShareLocator, quickShareUrl } from "@/lib/tap/quick-share";
import { getTapOrigin } from "@/lib/tap/server";

import type { WalletAppearance, WalletMode, WalletProfileData } from "./model";

export class WalletRequestError extends Error {
  constructor(readonly code: string, readonly status = 503) {
    super(code);
    this.name = "WalletRequestError";
  }
}

export type WalletPassRecord = {
  profile_id: string;
  apple_serial_number: string;
  google_wallet_object_id: string | null;
  appearance_preset: WalletAppearance;
  content_updated_at: string;
  last_synced_content_at: string | null;
  created_at: string;
  updated_at: string;
};

export function createWalletAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new WalletRequestError("wallet_database_unavailable");
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMode(value: unknown): WalletMode | null {
  return value === "personal" || value === "event" || value === "business" ? value : null;
}

export async function loadWalletProfileData(client: SupabaseClient, profileId: string): Promise<WalletProfileData> {
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,username,display_name,is_published")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError) throw new WalletRequestError("wallet_profile_unavailable");
  if (!profile || typeof profile.username !== "string") throw new WalletRequestError("wallet_profile_unavailable", 404);

  // Equipped state is intentionally exposed through this owner-scoped RPC;
  // direct table access is revoked from authenticated users.
  const { data: equipped, error: equippedError } = await client.rpc("get_equipped_share_state");
  const slug = getMode(isRecord(equipped) ? equipped.mode : null);
  if (equippedError || !slug) throw new WalletRequestError("wallet_mode_unavailable");

  const { data: mode, error: modeError } = await client
    .from("profile_modes")
    .select("slug,is_enabled,settings")
    .eq("profile_id", profileId)
    .eq("slug", slug)
    .maybeSingle();
  if (modeError || !mode || getMode(mode.slug) !== slug) throw new WalletRequestError("wallet_mode_unavailable");

  return {
    profileId,
    username: profile.username,
    displayName: typeof profile.display_name === "string" && profile.display_name.trim()
      ? profile.display_name.trim()
      : profile.username,
    published: profile.is_published === true,
    mode: slug,
    modeEnabled: mode.is_enabled === true,
    modeSettings: isRecord(mode.settings) ? mode.settings : {},
    appearance: "classic",
  };
}

export async function getOwnerQuickShareUrl(client: SupabaseClient, profileId: string) {
  const candidate = createQuickShareCandidate(profileId);
  const { data, error } = await client.rpc("ensure_quick_share_locator", {
    p_nonce: candidate.nonce,
    p_token_hash: candidate.tokenHash,
  });
  const locator = !error ? parseQuickShareLocator(data) : null;
  if (!locator) throw new WalletRequestError("wallet_share_unavailable");
  try {
    return quickShareUrl(profileId, locator, getTapOrigin());
  } catch {
    throw new WalletRequestError("wallet_share_unavailable");
  }
}

export async function getStoredQuickShareUrl(client: SupabaseClient, profileId: string) {
  const { data, error } = await client
    .from("quick_share_locators")
    .select("nonce,token_hash")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error || !data) throw new WalletRequestError("wallet_share_unavailable");
  const locator = parseQuickShareLocator({ nonce: data.nonce, token_hash: data.token_hash });
  if (!locator) throw new WalletRequestError("wallet_share_unavailable");
  try {
    return quickShareUrl(profileId, locator, getTapOrigin());
  } catch {
    throw new WalletRequestError("wallet_share_unavailable");
  }
}

export async function getOrCreateWalletPass(profileId: string, googleObjectId?: string): Promise<WalletPassRecord> {
  const admin = createWalletAdminClient();
  const { data: existing, error: readError } = await admin
    .from("wallet_passes")
    .select("profile_id,apple_serial_number,google_wallet_object_id,appearance_preset,content_updated_at,last_synced_content_at,created_at,updated_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (readError) throw new WalletRequestError("wallet_database_unavailable");

  if (existing) {
    if (googleObjectId && existing.google_wallet_object_id !== googleObjectId) {
      const { data, error } = await admin
        .from("wallet_passes")
        .update({ google_wallet_object_id: googleObjectId })
        .eq("profile_id", profileId)
        .select("profile_id,apple_serial_number,google_wallet_object_id,appearance_preset,content_updated_at,last_synced_content_at,created_at,updated_at")
        .single();
      if (error || !data) throw new WalletRequestError("wallet_database_unavailable");
      return data as WalletPassRecord;
    }
    return existing as WalletPassRecord;
  }

  const { data, error } = await admin
    .from("wallet_passes")
    .insert({ profile_id: profileId, ...(googleObjectId ? { google_wallet_object_id: googleObjectId } : {}) })
    .select("profile_id,apple_serial_number,google_wallet_object_id,appearance_preset,content_updated_at,last_synced_content_at,created_at,updated_at")
    .single();
  if (!error && data) return data as WalletPassRecord;
  if (error?.code === "23505") {
    const { data: raced, error: racedError } = await admin
      .from("wallet_passes")
      .select("profile_id,apple_serial_number,google_wallet_object_id,appearance_preset,content_updated_at,last_synced_content_at,created_at,updated_at")
      .eq("profile_id", profileId)
      .single();
    if (!racedError && raced) {
      if (googleObjectId && raced.google_wallet_object_id !== googleObjectId) {
        const { data: updated, error: updateError } = await admin
          .from("wallet_passes")
          .update({ google_wallet_object_id: googleObjectId })
          .eq("profile_id", profileId)
          .select("profile_id,apple_serial_number,google_wallet_object_id,appearance_preset,content_updated_at,last_synced_content_at,created_at,updated_at")
          .single();
        if (updateError || !updated) throw new WalletRequestError("wallet_database_unavailable");
        return updated as WalletPassRecord;
      }
      return raced as WalletPassRecord;
    }
  }
  throw new WalletRequestError("wallet_database_unavailable");
}

export async function getWalletPassBySerial(serialNumber: string) {
  const admin = createWalletAdminClient();
  const { data, error } = await admin
    .from("wallet_passes")
    .select("profile_id,apple_serial_number,google_wallet_object_id,appearance_preset,content_updated_at,last_synced_content_at,created_at,updated_at")
    .eq("apple_serial_number", serialNumber)
    .maybeSingle();
  if (error) throw new WalletRequestError("wallet_database_unavailable");
  return data as WalletPassRecord | null;
}

export async function getWalletPassForProfile(profileId: string) {
  const admin = createWalletAdminClient();
  const { data, error } = await admin
    .from("wallet_passes")
    .select("profile_id,apple_serial_number,google_wallet_object_id,appearance_preset,content_updated_at,last_synced_content_at,created_at,updated_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new WalletRequestError("wallet_database_unavailable");
  return data as WalletPassRecord | null;
}

export async function updateWalletAppearance(profileId: string, appearance: WalletAppearance) {
  const record = await getOrCreateWalletPass(profileId);
  const admin = createWalletAdminClient();
  const { data, error } = await admin
    .from("wallet_passes")
    .update({ appearance_preset: appearance, content_updated_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .select("profile_id,apple_serial_number,google_wallet_object_id,appearance_preset,content_updated_at,last_synced_content_at,created_at,updated_at")
    .single();
  if (error || !data || record.profile_id !== profileId) throw new WalletRequestError("wallet_database_unavailable");
  return data as WalletPassRecord;
}

export async function registerAppleDevice(profileId: string, serialNumber: string, deviceHash: Buffer, pushToken: string) {
  const admin = createWalletAdminClient();
  const existing = await admin
    .from("apple_wallet_registrations")
    .select("device_library_hash")
    .eq("device_library_hash", `\\x${deviceHash.toString("hex")}`)
    .eq("pass_serial_number", serialNumber)
    .maybeSingle();
  if (existing.error) throw new WalletRequestError("wallet_database_unavailable");
  const { error } = await admin.from("apple_wallet_registrations").upsert({
    device_library_hash: `\\x${deviceHash.toString("hex")}`,
    profile_id: profileId,
    pass_serial_number: serialNumber,
    push_token: pushToken,
    updated_at: new Date().toISOString(),
    ...(existing.data ? {} : { registered_at: new Date().toISOString() }),
  }, { onConflict: "device_library_hash,pass_serial_number" });
  if (error) throw new WalletRequestError("wallet_database_unavailable");
  return existing.data ? 200 : 201;
}

export async function unregisterAppleDevice(serialNumber: string, deviceHash: Buffer) {
  const admin = createWalletAdminClient();
  const { data, error } = await admin
    .from("apple_wallet_registrations")
    .delete()
    .eq("device_library_hash", `\\x${deviceHash.toString("hex")}`)
    .eq("pass_serial_number", serialNumber)
    .select("pass_serial_number");
  if (error) throw new WalletRequestError("wallet_database_unavailable");
  return (data?.length ?? 0) > 0;
}

export async function listAppleDevicePasses(passSerials: string[]) {
  if (!passSerials.length) return [];
  const admin = createWalletAdminClient();
  const { data, error } = await admin
    .from("wallet_passes")
    .select("profile_id,apple_serial_number,content_updated_at")
    .in("apple_serial_number", passSerials);
  if (error) throw new WalletRequestError("wallet_database_unavailable");
  return data ?? [];
}

export async function getAppleDeviceSerials(deviceHash: Buffer) {
  const admin = createWalletAdminClient();
  const { data, error } = await admin
    .from("apple_wallet_registrations")
    .select("pass_serial_number")
    .eq("device_library_hash", `\\x${deviceHash.toString("hex")}`);
  if (error) throw new WalletRequestError("wallet_database_unavailable");
  return (data ?? []).map((row) => row.pass_serial_number as string);
}

export async function markWalletPassSynced(profileId: string, contentUpdatedAt: string) {
  const admin = createWalletAdminClient();
  const { error } = await admin
    .from("wallet_passes")
    .update({ last_synced_content_at: contentUpdatedAt })
    .eq("profile_id", profileId)
    .eq("content_updated_at", contentUpdatedAt);
  if (error) throw new WalletRequestError("wallet_database_unavailable");
}

export function walletAppearance(value: unknown): WalletAppearance | null {
  return value === "classic" || value === "editorial" ? value : null;
}

export async function loadAdminWalletProfileData(profileId: string) {
  const admin = createWalletAdminClient();
  const data = await loadWalletProfileData(admin, profileId);
  const record = await getWalletPassForProfile(profileId);
  return record ? { ...data, appearance: record.appearance_preset } : data;
}
