import { getConfirmedBillingUser } from "@/lib/billing/auth";
import { createBillingAdminClient } from "@/lib/billing/admin";
import { getDodoApiClient } from "@/lib/billing/provider";
import { getSetuvaraOrigin } from "@/lib/billing/config";
import { json, isSameOriginJsonRequest, safeProviderUrl } from "@/lib/billing/http";

export async function POST(request: Request) {
  if (!isSameOriginJsonRequest(request)) return json({ error: "invalid_request" }, 400);
  const user = await getConfirmedBillingUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  try {
    const admin = createBillingAdminClient();
    const { data, error } = await admin.from("billing_customers")
      .select("dodo_customer_id").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "billing_customer_unavailable" }, 404);
    const portal = await getDodoApiClient().customers.customerPortal.create(data.dodo_customer_id, {
      return_url: `${getSetuvaraOrigin()}/app`,
      send_email: false,
    });
    const portalUrl = safeProviderUrl(portal.link, "portal");
    return portalUrl ? json({ portalUrl }) : json({ error: "billing_unavailable" }, 503);
  } catch {
    return json({ error: "billing_unavailable" }, 503);
  }
}
