import { z } from "zod";

import { getUserEntitlements } from "@/lib/billing/service";
import { syncExistingWalletPass } from "@/lib/wallet/sync";
import { WalletRequestError } from "@/lib/wallet/server";
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
    return tapJson(await syncExistingWalletPass(owner.supabase, owner.profileId));
  } catch (error) {
    if (error instanceof WalletRequestError) return tapJson({ error: error.code }, error.status);
    return tapJson({ error: "wallet_update_unavailable" }, 503);
  }
}
