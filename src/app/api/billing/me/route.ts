import { getConfirmedBillingUser } from "@/lib/billing/auth";
import { getUserBillingState, getUserEntitlements } from "@/lib/billing/service";
import { json } from "@/lib/billing/http";

export async function GET() {
  const user = await getConfirmedBillingUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  try {
    const [billing, entitlements] = await Promise.all([
      getUserBillingState(user.id),
      getUserEntitlements(user.id),
    ]);
    return json({ billing, entitlements });
  } catch {
    return json({ error: "billing_unavailable" }, 503);
  }
}
