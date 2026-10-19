import { adminJson, requireAdminApi } from "@/lib/admin/auth";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/admin/data";
import { createBillingAdminClient } from "@/lib/billing/admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Moves a feedback note between open, reviewing and done. The database checks the role again and audits the change. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminApi(request, "feedback");
  if (session instanceof Response) return session;

  const { id } = await params;
  if (!UUID.test(id)) return adminJson({ error: "not_found" }, 404);
  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  const status = body?.status;
  if (typeof status !== "string" || !(FEEDBACK_STATUSES as readonly string[]).includes(status)) return adminJson({ error: "invalid_status" }, 400);

  const { data, error } = await createBillingAdminClient().rpc("admin_set_feedback_status", {
    p_actor: session.userId,
    p_feedback_id: id,
    p_status: status as FeedbackStatus,
    p_context: { via: "admin_console" },
  });
  if (error) {
    if (error.message === "feedback_not_found") return adminJson({ error: "not_found" }, 404);
    if (error.message === "admin_forbidden") return adminJson({ error: "forbidden" }, 403);
    return adminJson({ error: "update_failed" }, 503);
  }
  return adminJson(data);
}
