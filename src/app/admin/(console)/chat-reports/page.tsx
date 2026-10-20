import type { Metadata } from "next";
import Link from "next/link";

import { Badge, Empty, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/auth";
import { listChatReports } from "@/lib/admin/chat-reports";
import { formatRelative, titleCase } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Chat reports" };

export default async function ChatReportsPage({ searchParams }: {
  searchParams: Promise<{ beforeAt?: string; beforeId?: string }>;
}) {
  const { userId } = await requireAdminPage("chatReports");
  const params = await searchParams;
  const beforeAt = params.beforeAt && !Number.isNaN(Date.parse(params.beforeAt)) ? params.beforeAt : null;
  const beforeId = params.beforeId && /^[0-9a-f-]{36}$/i.test(params.beforeId) ? params.beforeId : null;
  const reports = await listChatReports(userId, beforeAt && beforeId ? beforeAt : null, beforeId && beforeAt ? beforeId : null);
  const last = reports.at(-1);
  return <><PageHeader description="Only approved reviewers can open a case. Every evidence view is audited." eyebrow="Safety" title="Chat reports" />
    <Panel className="mt-6" padded={false}>{reports.length ? <ul className="divide-y divide-ink/[0.07]">{reports.map((report) => <li key={report.id}><Link className="flex min-h-20 items-center justify-between gap-4 px-5 py-4 hover:bg-paper focus-visible:outline-2 sm:px-7" href={`/chat-reports/${report.id}`}><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="text-sm">{titleCase(report.reason)}</strong><Badge tone={report.status === "closed" ? "good" : report.status === "reviewing" ? "sky" : "warn"}>{titleCase(report.status)}</Badge></span><span className="mt-1 block text-xs text-ink/45">{formatRelative(report.created_at)} · Case {report.id.slice(0, 8)}</span></span><span aria-hidden="true">→</span></Link></li>)}</ul> : <Empty>No chat reports to review.</Empty>}</Panel>
    {reports.length === 50 && last && <Link className="mt-5 inline-flex min-h-11 items-center rounded-full border border-ink/15 px-5 text-sm font-semibold" href={`/chat-reports?beforeAt=${encodeURIComponent(last.created_at)}&beforeId=${last.id}`}>Older reports →</Link>}</>;
}
