import { adminJson, recordAdminAccess, requireAdminApi } from "@/lib/admin/auth";
import { createBillingAdminClient } from "@/lib/billing/admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Opens a feedback screenshot through a one-minute signed link. The private bucket is never listed or exposed. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminApi(request, "feedback");
  if (session instanceof Response) return session;
  const { id } = await params;
  if (!UUID.test(id)) return adminJson({ error: "not_found" }, 404);

  const admin = createBillingAdminClient();
  const { data: path, error } = await admin.rpc("admin_feedback_screenshot_path", { p_feedback_id: id });
  if (error) return adminJson({ error: "unavailable" }, 503);
  if (typeof path !== "string" || !path) return adminJson({ error: "not_found" }, 404);

  try {
    await recordAdminAccess(session, "feedback.screenshot_viewed", { type: "feedback", id });
  } catch {
    return adminJson({ error: "audit_unavailable" }, 503);
  }
  const { data: signed, error: signError } = await admin.storage.from("product-feedback").createSignedUrl(path, 60);
  if (signError || !signed?.signedUrl) return adminJson({ error: "unavailable" }, 503);
  return Response.redirect(signed.signedUrl, 303);
}
