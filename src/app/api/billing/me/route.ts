import { getConfirmedBillingUser } from "@/lib/billing/auth";
import { getUserBillingState, getUserEntitlements } from "@/lib/billing/service";
import { json } from "@/lib/billing/http";

export async function GET() {
  const user = await getConfirmedBillingUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  try {
    const billing = await getUserBillingState(user.id);
    const entitlements = await getUserEntitlements(user.id, billing);
    return json({
      billing: { plan: billing.plan, canManageBilling: billing.canManageBilling },
      entitlements,
    });
  } catch {
    return json({ error: "billing_unavailable" }, 503);
  }
}
