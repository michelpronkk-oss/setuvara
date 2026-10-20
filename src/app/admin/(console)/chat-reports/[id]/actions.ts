"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminPage } from "@/lib/admin/auth";
import { createBillingAdminClient } from "@/lib/billing/admin";

export async function changeChatReportStatus(formData: FormData) {
  const { userId } = await requireAdminPage("chatReports");
  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(reportId) || !["open", "reviewing", "closed"].includes(status)) return;
  const { error } = await createBillingAdminClient().rpc("chat_admin_set_report_status", {
    p_actor: userId, p_report_id: reportId, p_status: status,
  });
  if (error) redirect(`/chat-reports/${reportId}?error=update`);
  revalidatePath(`/chat-reports/${reportId}`);
  redirect(`/chat-reports/${reportId}`);
}
