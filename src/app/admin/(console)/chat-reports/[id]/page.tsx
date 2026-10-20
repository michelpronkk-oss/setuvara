import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/auth";
import { openChatReport } from "@/lib/admin/chat-reports";
import { formatDateTime, titleCase } from "@/lib/admin/format";
import { changeChatReportStatus } from "./actions";

export const metadata: Metadata = { title: "Chat report case" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ChatReportCasePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { userId } = await requireAdminPage("chatReports");
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const showError = (await searchParams).error === "update";
  const report = await openChatReport(userId, id);
  return <><Link className="text-sm font-semibold text-ink/55 hover:text-ink" href="/chat-reports">← Chat reports</Link>
    <PageHeader description="Only the reported message and nearby context are available here. This access was logged." eyebrow={`Case ${id.slice(0, 8)}`} title="Message report" />
    {showError && <p className="mt-5 rounded-xl bg-coral/15 px-4 py-3 text-sm" role="alert">The case status could not be updated. Try again.</p>}
    <Panel className="mt-5"><div className="flex flex-wrap items-center gap-2"><Badge tone={report.status === "closed" ? "good" : "warn"}>{titleCase(report.status)}</Badge><Badge tone="neutral">{titleCase(report.reason)}</Badge></div><p className="mt-4 text-sm text-ink/55">Submitted {formatDateTime(report.created_at)}</p>{report.details && <p className="mt-4 whitespace-pre-wrap break-words text-sm">{report.details}</p>}</Panel>
    <Panel className="mt-5"><h2 className="font-display text-lg font-bold">Reported context</h2><ol className="mt-4 space-y-3">{report.evidence.map((message) => <li className="rounded-xl bg-paper p-4" key={message.message_id}><p className="text-xs text-ink/50">{message.sender_id === report.reported_id ? "Reported member" : "Reporting member"} · {formatDateTime(message.created_at)}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p></li>)}</ol></Panel>
    <Panel className="mt-5"><h2 className="font-display text-lg font-bold">Case status</h2><div className="mt-4 flex flex-wrap gap-2">{(["open", "reviewing", "closed"] as const).map((status) => <form action={changeChatReportStatus} key={status}><input name="reportId" type="hidden" value={id} /><input name="status" type="hidden" value={status} /><button className={`min-h-11 rounded-full px-5 text-sm font-semibold ${status === report.status ? "bg-ink text-paper" : "border border-ink/15"}`} disabled={status === report.status} type="submit">{titleCase(status)}</button></form>)}</div><p className="mt-4 text-xs leading-5 text-ink/45">Closed cases become eligible for purge 90 days after closure. The maintenance schedule requires final privacy review.</p></Panel>
  </>;
}
