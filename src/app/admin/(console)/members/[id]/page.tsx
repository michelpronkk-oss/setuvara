import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CopyButton, ProviderCheck } from "@/components/admin/actions";
import { AuditList } from "@/components/admin/audit-list";
import { Badge, buttonClass, Empty, Eyebrow, Initial, KeyValues, Notice, Panel, PlanBadge, Table, Td, Th } from "@/components/admin/ui";
import { recordAdminAccess, requireAdminPage } from "@/lib/admin/auth";
import { getMemberDetail, listAudit } from "@/lib/admin/data";
import { formatCount, formatDateTime, formatDay, formatRelative, titleCase } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Member" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminPage("members");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // The view is written to the audit log before any member data is read; no log, no data.
  await recordAdminAccess(session, "member.viewed", { type: "member", id });
  const member = await getMemberDetail(id);
  if (!member) notFound();
  const audit = await listAudit({ targetType: "member", targetId: id, page: 1, pageSize: 10 });

  const { account, profile, billing } = member;
  const publicUrl = profile?.is_published ? `https://setuvara.com/${profile.username}` : null;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-6 sm:mb-8">
        <Link className={buttonClass("quiet")} href="/members"><span aria-hidden="true">←</span> Members</Link>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5 pb-6 sm:pb-9">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <Initial large name={profile?.display_name ?? account.email} />
          <div className="min-w-0">
            <Eyebrow className="text-coral">{member.admin_role ? `Member · Admin ${member.admin_role}` : "Member"}</Eyebrow>
            <h1 className="mt-2 truncate font-display text-[34px] font-extrabold leading-[0.95] tracking-[-0.055em] sm:text-[52px]">{profile?.display_name ?? "No profile yet"}</h1>
            <p className="mt-2 truncate text-[13.5px] text-ink/55 sm:text-[14.5px]">{profile ? `@${profile.username} · ` : ""}{account.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={account.id} />
          {publicUrl ? <a className={buttonClass("primary")} href={publicUrl} rel="noreferrer" target="_blank">Public profile <span aria-hidden="true">↗</span></a> : null}
        </div>
        <div className="flex w-full flex-wrap gap-1.5">
          <PlanBadge plan={billing.plan} />
          {profile?.is_published ? <Badge dot tone="good">Published</Badge> : <Badge>Not published</Badge>}
          {!account.email_confirmed_at ? <Badge tone="warn">Email unconfirmed</Badge> : null}
          {account.banned ? <Badge tone="bad">Banned until {formatDay(account.banned_until)}</Badge> : null}
          {account.mfa_factors > 0 ? <Badge tone="sky">Two-step on</Badge> : null}
        </div>
      </header>

      <div className="mb-4"><Notice>Your view of this record was added to the audit log.</Notice></div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <Panel title="Account">
          <KeyValues items={[
            { label: "Joined", value: formatDateTime(account.created_at) },
            { label: "Last sign-in", value: account.last_sign_in_at ? `${formatRelative(account.last_sign_in_at)}` : "Never" },
            { label: "Email confirmed", value: account.email_confirmed_at ? formatDay(account.email_confirmed_at) : "No" },
            { label: "Sign-in methods", value: account.providers.length ? account.providers.map(titleCase).join(", ") : "—" },
            { label: "Two-step sign-in", value: account.mfa_factors > 0 ? "On" : "Off" },
            { label: "Profile updated", value: profile ? formatRelative(profile.updated_at) : "—" },
          ]} />
          <p className="mt-4 break-all rounded-[12px] bg-paper px-3 py-2 font-label text-[11px] text-ink/45">{account.id}</p>
        </Panel>

        <Panel
          actions={member.subscriptions.length ? <ProviderCheck memberId={account.id} /> : null}
          description="Plan as the app resolves it today, and every subscription row behind it."
          title="Billing"
        >
          <KeyValues items={[
            { label: "Plan", value: <PlanBadge plan={billing.plan} /> },
            { label: "Interval", value: billing.interval ? titleCase(billing.interval) : "—" },
            { label: "Renews or ends", value: billing.currentPeriodEnd ? formatDay(billing.currentPeriodEnd) : "—" },
            { label: "Cancelling", value: billing.cancelAtPeriodEnd ? "At period end" : "No" },
          ]} />
          {member.subscriptions.length ? (
            <ul className="mt-3 space-y-2">
              {member.subscriptions.map((sub) => (
                <li className="rounded-[16px] bg-paper px-4 py-3 text-[12.5px]" key={sub.dodo_subscription_id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="font-label text-[11.5px] text-ink/70">{sub.dodo_subscription_id}</code>
                    <Badge tone={sub.provider_status === "active" ? "good" : sub.provider_status === "past_due" ? "warn" : "neutral"}>{titleCase(sub.provider_status)}</Badge>
                  </div>
                  <p className="mt-1 text-ink/55">
                    {titleCase(sub.plan_code)} {sub.billing_interval ?? ""} · period ends {formatDay(sub.current_period_end)} · last provider event {formatRelative(sub.last_provider_event_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-[12.5px] text-ink/50">No subscriptions on record.</p>}
          {member.checkouts.length ? (
            <p className="mt-3 text-[12px] text-ink/55">
              Recent checkouts: {member.checkouts.map((checkout) => `${titleCase(checkout.plan_code)} ${checkout.billing_interval} ${checkout.status} (${formatDay(checkout.created_at, true)})`).join(" · ")}
            </p>
          ) : null}
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" padded={false} title="Modes">
          {member.modes.length === 0 ? <Empty>No Modes yet.</Empty> : (
            <Table minWidth={560}>
              <thead>
                <tr><Th>Mode</Th><Th>Connect</Th><Th>Look</Th><Th align="right">Photo</Th><Th align="right">Links</Th><Th align="right">Blocks</Th></tr>
              </thead>
              <tbody>
                {member.modes.map((mode) => (
                  <tr className="border-t border-ink/[0.06]" key={mode.slug}>
                    <Td><span className="font-display text-[15px] font-bold tracking-[-0.03em]">{mode.label}</span>{!mode.is_enabled ? <span className="ml-2"><Badge>Off</Badge></span> : null}</Td>
                    <Td className="text-ink/70">{titleCase(mode.connect_policy)}</Td>
                    <Td className="text-ink/70">{titleCase(mode.theme)}</Td>
                    <Td align="right">{mode.has_photo ? "Yes" : "—"}</Td>
                    <Td align="right">{formatCount(mode.links)}</Td>
                    <Td align="right">{formatCount(mode.blocks)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
        <Panel title="Activity" description="Last 30 days, and totals.">
          <KeyValues items={[
            { label: "Profile views", value: formatCount(member.activity_30d.profile_views) },
            { label: "Shares", value: formatCount(member.activity_30d.profile_shares) },
            { label: "QR and Tap scans", value: formatCount(member.activity_30d.qr_scans) },
            { label: "Connections, 30d", value: formatCount(member.activity_30d.connections) },
            { label: "Connections, all", value: formatCount(member.counts.connections) },
            { label: "Of which guests", value: formatCount(member.counts.guest_connections) },
            { label: "Passport stamps", value: formatCount(member.counts.passport_stamps) },
            { label: "Tap devices", value: formatCount(member.counts.tap_devices) },
          ]} />
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-2">
        <Panel actions={<Link className={buttonClass("quiet")} href="/feedback">Support inbox <span aria-hidden="true">→</span></Link>} title="Feedback from this member">
          {member.feedback.length === 0 ? <Empty>No feedback sent.</Empty> : (
            <ul className="divide-y divide-ink/[0.07]">
              {member.feedback.map((note) => (
                <li className="py-3.5 first:pt-0 last:pb-0" key={note.id}>
                  <div className="flex items-center gap-2 text-[12px] text-ink/55"><Badge>{titleCase(note.kind)}</Badge><Badge tone={note.status === "done" ? "good" : note.status === "reviewing" ? "sky" : "warn"}>{titleCase(note.status)}</Badge>{formatRelative(note.created_at)}</div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-5">{note.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Emails sent">
          {member.emails.length === 0 ? <Empty>No product emails on record.</Empty> : (
            <ul className="divide-y divide-ink/[0.07] text-[13px]">
              {member.emails.map((email, index) => (
                <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" key={`${email.template_key}-${index}`}>
                  <span className="min-w-0 truncate"><span className="font-medium">{titleCase(email.template_key)}</span> <span className="text-ink/45">· {email.category}</span></span>
                  <span className="flex shrink-0 items-center gap-2 text-ink/55">
                    <Badge tone={email.status === "sent" ? "good" : email.status === "failed" ? "bad" : "neutral"}>{titleCase(email.status)}</Badge>
                    {formatDay(email.sent_at ?? email.created_at, true)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="mt-3 sm:mt-4" description="Who opened or changed this member’s record." padded={false} title="Audit trail">
        <AuditList rows={audit.rows} compact />
      </Panel>
    </>
  );
}
