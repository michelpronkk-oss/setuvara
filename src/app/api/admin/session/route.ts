import { adminJson, recordAdminAccess, requireAdminApi } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

/** Called once a sign-in completes its second step, so every admin session shows in the audit log. */
export async function POST(request: Request) {
  const session = await requireAdminApi(request, "overview");
  if (session instanceof Response) return session;
  try {
    await recordAdminAccess(session, "session.started", null);
    return adminJson({ ok: true });
  } catch {
    return adminJson({ error: "audit_unavailable" }, 503);
  }
}
