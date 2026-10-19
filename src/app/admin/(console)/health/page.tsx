import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge, Notice, PageHeader, Panel, type Tone } from "@/components/admin/ui";
import { requireAdminPage, roleCanOpen } from "@/lib/admin/auth";
import { getHealth } from "@/lib/admin/data";
import { formatCount, formatDateTime, formatRelative, plural, titleCase } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Health" };

type Check = { title: string; tone: Tone; state: string; lines: ReactNode[]; href?: string };

function Card({ check }: { check: Check }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[14px] font-semibold">{check.title}</h2>
        <Badge dot tone={check.tone}>{check.state}</Badge>
      </div>
      <ul className="mt-3 space-y-1.5 text-[12.5px] text-ink/65">
        {check.lines.map((line, index) => <li key={index}>{line}</li>)}
      </ul>
    </>
  );
  const className = "block rounded-[14px] bg-white px-4 py-4 shadow-[0_0_0_1px_rgba(13,13,13,.07),0_1px_2px_rgba(13,13,13,.04)] sm:px-5";
  return check.href ? <Link className={`${className} hover:shadow-[0_0_0_1px_rgba(13,13,13,.16)]`} href={check.href}>{body}</Link> : <div className={className}>{body}</div>;
}

const HOUR = 3_600_000;

export default async function HealthPage() {
  const session = await requireAdminPage("health");
  const health = await getHealth();
  const now = Date.parse(health.checked_at);
  const age = (value: string | null) => value ? now - Date.parse(value) : Infinity;

  const checks: Check[] = [
    {
      title: "Billing webhooks",
      tone: health.webhooks.failed_7d || health.webhooks.stuck ? "bad" : "good",
      state: health.webhooks.failed_7d || health.webhooks.stuck ? "Needs attention" : "Healthy",
      lines: [
        <>Last received {formatRelative(health.webhooks.last_received_at, now)}</>,
        <>{formatCount(health.webhooks.received_7d)} received in 7 days, {formatCount(health.webhooks.failed_7d)} failed</>,
        <>{formatCount(health.webhooks.stuck)} stuck in processing for over 15 minutes</>,
      ],
      href: "/billing",
    },
    {
      title: "Email delivery",
      tone: health.emails.failed_7d || health.emails.overdue ? "bad" : "good",
      state: health.emails.failed_7d || health.emails.overdue ? "Needs attention" : "Healthy",
      lines: [
        <>Last sent {formatRelative(health.emails.last_sent_at, now)}</>,
        <>{formatCount(health.emails.sent_7d)} sent in 7 days, {formatCount(health.emails.failed_7d)} failed, {formatCount(health.emails.suppressed_7d)} suppressed</>,
        <>{formatCount(health.emails.overdue)} overdue in the queue</>,
      ],
    },
    {
      title: "Product analytics",
      tone: age(health.analytics.last_event_at) > 24 * HOUR ? "warn" : "good",
      state: age(health.analytics.last_event_at) > 24 * HOUR ? "Quiet" : "Recording",
      lines: [
        <>Last event {formatRelative(health.analytics.last_event_at, now)}</>,
        <>{formatCount(health.analytics.events_24h)} events in 24 hours</>,
      ],
      href: "/",
    },
    {
      title: "Checkout",
      tone: health.checkouts.failed_7d ? "warn" : "good",
      state: health.checkouts.failed_7d ? "Failures" : "Healthy",
      lines: [
        <>{formatCount(health.checkouts.open)} open sessions</>,
        <>{formatCount(health.checkouts.failed_7d)} failed in 7 days</>,
        <>{formatCount(health.checkouts.stale_open)} expired but never closed</>,
      ],
    },
    {
      title: "Support queue",
      tone: health.feedback.open && age(health.feedback.oldest_open_at) > 72 * HOUR ? "warn" : "good",
      state: health.feedback.open ? `${formatCount(health.feedback.open)} open` : "Clear",
      lines: [
        <>{formatCount(health.feedback.open)} open, {formatCount(health.feedback.reviewing)} in review</>,
        <>Oldest open {health.feedback.oldest_open_at ? formatRelative(health.feedback.oldest_open_at, now) : "—"}</>,
      ],
      href: roleCanOpen(session.role, "feedback") ? "/feedback" : undefined,
    },
    {
      title: "Accounts",
      tone: health.accounts.without_profile ? "warn" : "good",
      state: health.accounts.without_profile ? "Check" : "Healthy",
      lines: [
        <>{formatCount(health.accounts.unconfirmed_over_24h)} unconfirmed for over 24 hours</>,
        <>{formatCount(health.accounts.without_profile)} accounts without a profile</>,
      ],
    },
  ];

  return (
    <>
      <PageHeader description={<>Built from records the platform already keeps. Checked {formatDateTime(health.checked_at)}.</>} title="Health" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => <Card check={check} key={check.title} />)}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title="Recent webhook failures">
          {health.webhook_failures.length === 0 ? <p className="text-[13px] text-ink/50">None on record.</p> : (
            <ul className="space-y-2 text-[12.5px]">
              {health.webhook_failures.map((failure, index) => (
                <li className="flex flex-wrap justify-between gap-2" key={index}>
                  <span><code className="font-label">{failure.event_type}</code> · {failure.error ?? "unknown"} · {plural(failure.attempts, "attempt")}</span>
                  <span className="text-ink/50">{formatRelative(failure.received_at, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent email failures">
          {health.email_failures.length === 0 ? <p className="text-[13px] text-ink/50">None on record.</p> : (
            <ul className="space-y-2 text-[12.5px]">
              {health.email_failures.map((failure, index) => (
                <li className="flex flex-wrap justify-between gap-2" key={index}>
                  <span>{titleCase(failure.template_key)} · {failure.error ?? "unknown"} · {plural(failure.attempts, "attempt")}</span>
                  <span className="text-ink/50">{formatRelative(failure.created_at, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-3">
        <Notice>
          Server errors, response times and Edge Function logs aren’t stored in the database, so they aren’t shown here. Use the Vercel and Supabase dashboards for those.
        </Notice>
      </div>
    </>
  );
}
