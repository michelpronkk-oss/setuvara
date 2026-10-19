import Link from "next/link";

import type { AuditRow } from "@/lib/admin/data";
import { formatDateTime, formatRelative } from "@/lib/admin/format";

import { Badge, Empty } from "./ui";

const ACTION_LABELS: Record<string, string> = {
  "member.viewed": "Viewed member",
  "feedback.status_changed": "Changed feedback status",
  "feedback.screenshot_viewed": "Opened feedback screenshot",
  "billing.provider_checked": "Checked billing with Dodo",
  "session.started": "Signed in to admin",
  "admin_member.granted": "Granted admin access",
  "admin_member.changed": "Changed admin access",
  "admin_member.revoked": "Revoked admin access",
  "admin_member.restored": "Restored admin access",
  "admin_member.removed": "Removed admin access",
};

function change(row: AuditRow) {
  if (!row.before && !row.after) return null;
  const keys = [...new Set([...Object.keys(row.before ?? {}), ...Object.keys(row.after ?? {})])];
  return keys
    .filter((key) => JSON.stringify(row.before?.[key] ?? null) !== JSON.stringify(row.after?.[key] ?? null))
    .map((key) => `${key}: ${String(row.before?.[key] ?? "—")} → ${String(row.after?.[key] ?? "—")}`)
    .join(" · ");
}

function target(row: AuditRow) {
  if (!row.target_type || !row.target_id) return null;
  if (row.target_type === "member" || row.target_type === "admin_member") {
    return <Link className="font-label text-[11.5px] underline-offset-2 hover:underline" href={`/members/${row.target_id}`}>{row.target_id.slice(0, 8)}</Link>;
  }
  return <span className="font-label text-[11.5px]">{row.target_type} {row.target_id.slice(0, 8)}</span>;
}

export function AuditList({ rows, compact = false }: { rows: AuditRow[]; compact?: boolean }) {
  if (rows.length === 0) return <Empty>No entries yet.</Empty>;
  return (
    <ul className="divide-y divide-ink/[0.07] border-t border-ink/[0.07]">
      {rows.map((row) => {
        const diff = change(row);
        return (
          <li className="grid gap-1.5 px-5 py-4 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-7" key={row.id}>
            <time className="font-label text-[11px] tabular-nums text-ink/45" dateTime={row.occurred_at} title={formatDateTime(row.occurred_at)}>
              {compact ? formatRelative(row.occurred_at) : formatDateTime(row.occurred_at)}
            </time>
            <div className="min-w-0">
              <p className="text-[14px]">
                <span className="font-semibold">{ACTION_LABELS[row.action] ?? row.action}</span>
                {!compact && target(row) ? <span className="ml-2 text-ink/55">{target(row)}</span> : null}
              </p>
              {diff ? <p className="mt-0.5 truncate font-label text-[11.5px] text-ink/55">{diff}</p> : null}
            </div>
            <div className="flex min-w-0 items-center gap-2 text-[12px] text-ink/60 sm:justify-end">
              <span className="truncate">{row.actor_email ?? (row.actor_role === "database" ? "SQL editor" : "Unknown")}</span>
              {row.actor_role ? <Badge>{row.actor_role}</Badge> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
