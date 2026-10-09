import { getPublicProfileEntitlements } from "@/lib/billing/service";
import { json } from "@/lib/billing/http";

export async function GET(_request: Request, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return json({ error: "not_found" }, 404);
  try {
    const entitlements = await getPublicProfileEntitlements(username);
    return entitlements ? json({ entitlements }) : json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "billing_unavailable" }, 503);
  }
}
