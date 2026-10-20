import "server-only";

import { notFound } from "next/navigation";

import { createBillingAdminClient } from "@/lib/billing/admin";

export type ChatReportSummary = {
  id: string; reason: string; status: string; created_at: string;
  reporter_id: string; reported_id: string;
};
export type ChatReportCase = ChatReportSummary & {
  details: string | null;
  evidence: { message_id: string; sequence: number; sender_id: string; body: string; created_at: string }[];
};

export async function listChatReports(actorId: string, beforeAt: string | null, beforeId: string | null): Promise<ChatReportSummary[]> {
  const { data, error } = await createBillingAdminClient().rpc("chat_admin_list_reports", {
    p_actor: actorId, p_limit: 50, p_before_at: beforeAt, p_before_id: beforeId,
  });
  if (error) notFound();
  return (data ?? []) as ChatReportSummary[];
}

export async function openChatReport(actorId: string, reportId: string): Promise<ChatReportCase> {
  const { data, error } = await createBillingAdminClient().rpc("chat_admin_open_report", {
    p_actor: actorId, p_report_id: reportId,
  });
  if (error || !data) notFound();
  return data as ChatReportCase;
}
