import { z } from "zod";

import { getUserEntitlements } from "@/lib/billing/service";
import { getSetuvaraOrigin } from "@/lib/billing/config";
import { getWalletServerConfig } from "@/lib/wallet/config";
import { googleSaveUrl, signGoogleWalletSaveJwt, upsertGoogleWalletObject, WalletProviderError } from "@/lib/wallet/google";
import { buildGoogleGenericObject, googleObjectId } from "@/lib/wallet/model";
import { getOrCreateWalletPass, getOwnerQuickShareUrl, loadWalletProfileData, WalletRequestError } from "@/lib/wallet/server";
import { getTapOwner, readTapJson, tapJson } from "@/lib/tap/server";

const emptySchema = z.object({}).strict();

export const runtime = "nodejs";

export async function POST(request: Request) {
  const owner = await getTapOwner();
  if (!owner) return tapJson({ error: "unauthorized" }, 401);
  const parsed = await readTapJson(request, emptySchema);
  if (!parsed.ok) return tapJson({ error: "invalid_request" }, 400);

  try {
    const entitlements = await getUserEntitlements(owner.profileId);
    if (!entitlements.capabilities["wallet.core"].available) return tapJson({ error: "wallet_unavailable" }, 403);
    const config = getWalletServerConfig().google;
    if (!config) return tapJson({ error: "google_wallet_not_configured" }, 503);

    const profile = await loadWalletProfileData(owner.supabase, owner.profileId);
    if (!profile.published) return tapJson({ error: "publish_identity_first" }, 409);
    if (!profile.modeEnabled) return tapJson({ error: "enable_equipped_mode_first" }, 409);

    const [shareUrl, record] = await Promise.all([
      getOwnerQuickShareUrl(owner.supabase, owner.profileId),
      getOrCreateWalletPass(owner.profileId, googleObjectId(config.issuerId, owner.profileId)),
    ]);
    const passProfile = { ...profile, appearance: record.appearance_preset };
    const objectId = record.google_wallet_object_id;
    if (!objectId) throw new WalletRequestError("google_wallet_object_unavailable");
    const object = buildGoogleGenericObject(passProfile, objectId, config.classId, shareUrl);
    await upsertGoogleWalletObject(config, object);
    const jwt = signGoogleWalletSaveJwt(config, object, getSetuvaraOrigin());
    return tapJson({ saveUrl: googleSaveUrl(jwt) });
  } catch (error) {
    if (error instanceof WalletRequestError) return tapJson({ error: error.code }, error.status);
    if (error instanceof WalletProviderError) return tapJson({ error: "google_wallet_unavailable" }, 503);
    return tapJson({ error: "google_wallet_unavailable" }, 503);
  }
}
