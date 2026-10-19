import type { Metadata } from "next";
import Link from "next/link";

import { FeedbackStatusActions } from "@/components/admin/actions";
import { Badge, Empty, PageHeader, Pager, Panel, Tabs } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/auth";
import { FEEDBACK_STATUSES, getHealth, listFeedback, type FeedbackStatus } from "@/lib/admin/data";
import { formatDateTime, formatRelative, titleCase } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Support" };

const KIND_TONE = { bug: "bad", confusing: "warn", idea: "sky", other: "neutral" } as const;

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdminPage("feedback");
  const params = await searchParams;
  const status: FeedbackStatus | null = params.status === "all" ? null
    : (FEEDBACK_STATUSES as readonly string[]).includes(params.status ?? "") ? params.status as FeedbackStatus : "open";
  const page = Math.max(1, Math.min(1000, Number.parseInt(params.page ?? "1", 10) || 1));
  const [feedback, health] = await Promise.all([listFeedback(status, page), getHealth()]);
  const current = status ?? "all";
  const href = (value: string, nextPage = 1) => `/feedback?status=${value}${nextPage > 1 ? `&page=${nextPage}` : ""}`;

  return (
    <>
      <PageHeader description="Notes members send from the app’s account menu. Status changes are recorded in the audit log." title="Support" />
      <Tabs
        current={current}
        options={[
          { label: "Open", value: "open", href: href("open"), count: health.feedback.open },
          { label: "Reviewing", value: "reviewing", href: href("reviewing"), count: health.feedback.reviewing },
          { label: "Done", value: "done", href: href("done") },
          { label: "All", value: "all", href: href("all") },
        ]}
      />

      <Panel className="mt-3" padded={false}>
        {feedback.rows.length === 0 ? <Empty>{status === "open" ? "Inbox zero. No open feedback." : "Nothing here."}</Empty> : (
          <ul className="divide-y divide-ink/[0.06]">
            {feedback.rows.map((note) => (
              <li className="px-4 py-4 sm:px-5" key={note.id}>
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink/55">
                  <Badge tone={KIND_TONE[note.kind as keyof typeof KIND_TONE] ?? "neutral"}>{titleCase(note.kind)}</Badge>
                  {status === null ? <Badge tone={note.status === "done" ? "good" : note.status === "reviewing" ? "sky" : "warn"}>{titleCase(note.status)}</Badge> : null}
                  <Link className="font-semibold text-ink hover:underline" href={`/members/${note.user_id}`}>{note.display_name ?? note.email ?? "Member"}</Link>
                  {note.username ? <span>@{note.username}</span> : null}
                  <time dateTime={note.created_at} title={formatDateTime(note.created_at)}>{formatRelative(note.created_at)}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-[13.5px] leading-[21px]">{note.message}</p>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-label text-[11px] text-ink/45">
                  {note.route ? <span>Page {note.route}</span> : null}
                  {note.mode ? <span>Mode {note.mode}</span> : null}
                  {note.plan ? <span>Plan {note.plan}</span> : null}
                  {note.viewport ? <span>Screen {note.viewport}</span> : null}
                  {note.locale ? <span>Locale {note.locale}</span> : null}
                </div>
                {note.user_agent ? <p className="mt-1 truncate font-label text-[11px] text-ink/35" title={note.user_agent}>{note.user_agent}</p> : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <FeedbackStatusActions id={note.id} status={note.status} />
                  {note.has_screenshot ? (
                    <a className="inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold text-ink/65 hover:text-ink" href={`/api/admin/feedback/${note.id}/screenshot`} rel="noreferrer" target="_blank">Screenshot ↗</a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-ink/[0.06]">
          <Pager href={(next) => href(current, next)} page={page} pageSize={30} total={feedback.total} />
        </div>
      </Panel>
    </>
  );
}
