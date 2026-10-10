import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { notifyAppleWalletDevices } from "./apple-apns";
import { getWalletServerConfig } from "./config";
import { buildGoogleGenericObject, type WalletProfileData } from "./model";
import { upsertGoogleWalletObject } from "./google";
import {
  createWalletAdminClient,
  getStoredQuickShareUrl,
  getWalletPassForProfile,
  loadWalletProfileData,
  markWalletPassSynced,
} from "./server";

export async function syncExistingWalletPass(client: SupabaseClient, profileId: string) {
  const record = await getWalletPassForProfile(profileId);
  if (!record) return { exists: false as const, appleNotified: 0, googleUpdated: false };

  const config = getWalletServerConfig();
  const available = config.apple !== null || config.google !== null;
  if (!available) return { exists: true as const, appleNotified: 0, googleUpdated: false };
  if (record.last_synced_content_at && Date.parse(record.last_synced_content_at) >= Date.parse(record.content_updated_at)) {
    return { exists: true as const, appleNotified: 0, googleUpdated: false, unchanged: true as const };
  }

  const [profile, shareUrl] = await Promise.all([
    loadWalletProfileData(client, profileId),
    getStoredQuickShareUrl(createWalletAdminClient(), profileId),
  ]);
  const data = { ...profile, appearance: record.appearance_preset } satisfies WalletProfileData;
  let appleNotified = 0;
  let googleUpdated = false;

  if (config.apple) {
    const result = await notifyAppleWalletDevices(profileId, record.apple_serial_number, config.apple);
    if (result.failed > 0) throw new Error("apple_wallet_update_unavailable");
    appleNotified = result.notified;
  }
  if (config.google) {
    const objectId = record.google_wallet_object_id;
    if (objectId) {
      const object = buildGoogleGenericObject(data, objectId, config.google.classId, shareUrl);
      await upsertGoogleWalletObject(config.google, object);
      googleUpdated = true;
    }
  }

  await markWalletPassSynced(profileId, record.content_updated_at);

  return { exists: true as const, appleNotified, googleUpdated, unchanged: false as const };
}
