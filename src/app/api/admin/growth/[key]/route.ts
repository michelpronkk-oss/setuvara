import { adminJson, requireAdminApi, roleCanOpen } from "@/lib/admin/auth";
import { CHECKLIST_KEYS } from "@/lib/admin/growth";
import { createBillingAdminClient } from "@/lib/billing/admin";

export const dynamic = "force-dynamic";

/** Ticks an off-site checklist item on or off. Owners and admins only; the database checks again and audits it. */
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await requireAdminApi(request, "growth");
  if (session instanceof Response) return session;
  if (!roleCanOpen(session.role, "members")) return adminJson({ error: "forbidden" }, 403);

  const { key } = await params;
  if (!CHECKLIST_KEYS.has(key)) return adminJson({ error: "not_found" }, 404);
  const body = await request.json().catch(() => null) as { done?: unknown } | null;
  if (typeof body?.done !== "boolean") return adminJson({ error: "invalid_body" }, 400);

  const { data, error } = await createBillingAdminClient().rpc("admin_set_growth_item", { p_actor: session.userId, p_key: key, p_done: body.done });
  if (error) return adminJson({ error: error.message === "admin_forbidden" ? "forbidden" : "update_failed" }, error.message === "admin_forbidden" ? 403 : 503);
  return adminJson(data);
}
