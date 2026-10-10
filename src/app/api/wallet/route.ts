import { getUserEntitlements } from "@/lib/billing/service";
import { getWalletProviderAvailability } from "@/lib/wallet/config";
import { getWalletPassForProfile, loadWalletProfileData, WalletRequestError, walletAppearance } from "@/lib/wallet/server";
import { getTapOwner } from "@/lib/tap/server";

export const dynamic = "force-dynamic";

function walletJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET() {
  const owner = await getTapOwner();
  if (!owner) return walletJson({ error: "unauthorized" }, 401);

  try {
    const [entitlements, profile, record] = await Promise.all([
      getUserEntitlements(owner.profileId),
      loadWalletProfileData(owner.supabase, owner.profileId),
      getWalletPassForProfile(owner.profileId),
    ]);
    const availability = getWalletProviderAvailability();
    return walletJson({
      providers: availability,
      canUseWallet: entitlements.capabilities["wallet.core"].available,
      canUsePremiumAppearance: entitlements.capabilities["wallet.premium_appearance"].available,
      profile: {
        username: profile.username,
        displayName: profile.displayName,
        mode: profile.mode,
        modeEnabled: profile.modeEnabled,
        published: profile.published,
      },
      pass: {
        exists: record !== null,
        appearance: walletAppearance(record?.appearance_preset) ?? "classic",
      },
    });
  } catch (error) {
    if (error instanceof WalletRequestError) return walletJson({ error: error.code }, error.status);
    if (error instanceof Error && error.message === "billing_state_unavailable") {
      return walletJson({ error: "billing_state_unavailable" }, 503);
    }
    return walletJson({ error: "wallet_unavailable" }, 503);
  }
}
