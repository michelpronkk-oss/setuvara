import { adminJson, recordAdminAccess, requireAdminApi } from "@/lib/admin/auth";
import { createBillingAdminClient } from "@/lib/billing/admin";
import { readDodoConfiguration } from "@/lib/billing/config";
import { retrieveProviderSubscription } from "@/lib/billing/service";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Asks Dodo about each of a member's subscription rows: does Dodo know it, and what does Dodo say
 * its status is? A row Dodo doesn't know is a plan granted by hand in the database.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminApi(request, "members");
  if (session instanceof Response) return session;
  const { id } = await params;
  if (!UUID.test(id)) return adminJson({ error: "not_found" }, 404);
  if (!readDodoConfiguration()) return adminJson({ error: "provider_unconfigured" }, 503);

  const { data, error } = await createBillingAdminClient()
    .from("billing_subscriptions")
    .select("dodo_subscription_id,provider_status")
    .eq("user_id", id)
    .limit(10);
  if (error) return adminJson({ error: "unavailable" }, 503);

  try {
    await recordAdminAccess(session, "billing.provider_checked", { type: "member", id }, { subscriptions: data.length });
  } catch {
    return adminJson({ error: "audit_unavailable" }, 503);
  }

  const results = await Promise.all(data.map(async (row) => {
    try {
      const live = await retrieveProviderSubscription(row.dodo_subscription_id);
      return live
        ? { id: row.dodo_subscription_id, result: "found" as const, providerStatus: live.status, stored: row.provider_status }
        : { id: row.dodo_subscription_id, result: "not_found" as const, stored: row.provider_status };
    } catch {
      return { id: row.dodo_subscription_id, result: "error" as const, stored: row.provider_status };
    }
  }));
  return adminJson({ checkedAt: new Date().toISOString(), results });
}
