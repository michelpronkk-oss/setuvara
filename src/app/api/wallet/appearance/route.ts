import { z } from "zod";

import { getUserEntitlements } from "@/lib/billing/service";
import { updateWalletAppearance, WalletRequestError } from "@/lib/wallet/server";
import { getTapOwner, readTapJson, tapJson } from "@/lib/tap/server";

const appearanceSchema = z.object({
  appearance: z.enum(["classic", "editorial"]),
}).strict();

export async function PUT(request: Request) {
  const owner = await getTapOwner();
  if (!owner) return tapJson({ error: "unauthorized" }, 401);
  const parsed = await readTapJson(request, appearanceSchema);
  if (!parsed.ok) return tapJson({ error: "invalid_request" }, 400);

  try {
    const entitlements = await getUserEntitlements(owner.profileId);
    if (!entitlements.capabilities["wallet.core"].available) return tapJson({ error: "wallet_unavailable" }, 403);
    if (parsed.data.appearance === "editorial" && !entitlements.capabilities["wallet.premium_appearance"].available) {
      return tapJson({ error: "wallet_premium_appearance_required" }, 403);
    }
    const record = await updateWalletAppearance(owner.profileId, parsed.data.appearance);
    return tapJson({ appearance: record.appearance_preset });
  } catch (error) {
    if (error instanceof WalletRequestError) return tapJson({ error: error.code }, error.status);
    return tapJson({ error: "wallet_appearance_unavailable" }, 503);
  }
}
