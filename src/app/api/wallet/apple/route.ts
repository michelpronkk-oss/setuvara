import { getUserEntitlements } from "@/lib/billing/service";
import { getSetuvaraOrigin } from "@/lib/billing/config";
import { createApplePassArchive } from "@/lib/wallet/apple";
import { getWalletServerConfig } from "@/lib/wallet/config";
import { deriveAppleAuthenticationToken } from "@/lib/wallet/model";
import { getOrCreateWalletPass, getOwnerQuickShareUrl, loadWalletProfileData, WalletRequestError } from "@/lib/wallet/server";
import { getTapOwner } from "@/lib/tap/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(status: number, error: string) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET() {
  const owner = await getTapOwner();
  if (!owner) return errorResponse(401, "unauthorized");

  try {
    const entitlements = await getUserEntitlements(owner.profileId);
    if (!entitlements.capabilities["wallet.core"].available) return errorResponse(403, "wallet_unavailable");

    const config = getWalletServerConfig().apple;
    if (!config) return errorResponse(503, "apple_wallet_not_configured");
    const profile = await loadWalletProfileData(owner.supabase, owner.profileId);
    if (!profile.published) return errorResponse(409, "publish_identity_first");
    if (!profile.modeEnabled) return errorResponse(409, "enable_equipped_mode_first");

    const [shareUrl, record] = await Promise.all([
      getOwnerQuickShareUrl(owner.supabase, owner.profileId),
      getOrCreateWalletPass(owner.profileId),
    ]);
    const passProfile = { ...profile, appearance: record.appearance_preset };
    const token = deriveAppleAuthenticationToken(owner.profileId, record.apple_serial_number, config.passAuthSecret);
    const pass = await createApplePassArchive(
      passProfile,
      config,
      record.apple_serial_number,
      token,
      `${getSetuvaraOrigin()}/api/wallet/apple`,
      shareUrl,
    );
    return new Response(new Uint8Array(pass), {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.pkpass",
        "content-disposition": 'attachment; filename="Setuvara.pkpass"',
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof WalletRequestError) return errorResponse(error.status, error.code);
    return errorResponse(503, "apple_wallet_unavailable");
  }
}
