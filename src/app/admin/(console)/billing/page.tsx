import type { Metadata } from "next";
import Link from "next/link";

import { Badge, buttonClass, Empty, Notice, PageHeader, Panel, PlanBadge, Stat, Table, Td, Th } from "@/components/admin/ui";
import { requireAdminPage, roleCanOpen } from "@/lib/admin/auth";
import { getBillingOverview } from "@/lib/admin/data";
import { formatCount, formatDay, formatMoneyMinor, formatRelative, plural, titleCase } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Billing" };

const CHECKOUT_ORDER = ["complete", "open", "creating", "expired", "failed"];

export default async function BillingPage() {
  const session = await requireAdminPage("billing");
  const canOpenMembers = roleCanOpen(session.role, "members");
  const billing = await getBillingOverview();
  const { plans, paid } = billing;
  const checkoutTotal = Object.values(billing.checkouts_30d).reduce((sum, value) => sum + value, 0);

  return (
    <>
      <PageHeader
        actions={<a className={buttonClass("primary", "md")} href="https://app.dodopayments.com" rel="noreferrer" target="_blank">Open Dodo <span aria-hidden="true">↗</span></a>}
        description="Plans resolved with the same rules the app uses to grant features. Dodo remains the record for payments, taxes and refunds."
        eyebrow="Plans and payments"
        title="Billing"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Paid members" tone="ink" note={<>{formatCount(plans.plus)} Plus · {formatCount(plans.pro)} Pro · {formatCount(plans.yearly)} yearly</>} value={formatCount(plans.plus + plans.pro)} />
        <Stat label="Run-rate, list price" note="Per month. Yearly plans count as 1/12." value={formatMoneyMinor(plans.listRunRateMinor)} />
        <Stat label="Cancelling" note="Access ends at period end" value={formatCount(plans.cancelling)} />
        <Stat label="Past due" note="Still in the grace period" value={formatCount(plans.pastDue)} />
      </div>

      <Panel className="mt-3 sm:mt-4" description="Everyone a paid plan applies to right now." padded={false} title="Paid members">
        {paid.length === 0 ? <Empty>No member has a paid plan right now.</Empty> : (<>
          {/* Phones: one row per member */}
          <ul className="divide-y divide-ink/[0.07] border-t border-ink/[0.07] md:hidden">
            {paid.map((member) => {
              const name = member.displayName ?? member.userId.slice(0, 8);
              const body = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold">{name}</span><PlanBadge plan={member.snapshot.plan} /></p>
                    <p className="mt-1 truncate text-[12.5px] text-ink/50">
                      {member.snapshot.cancelAtPeriodEnd ? "Cancelling" : member.snapshot.status === "past_due" ? "Past due" : "Active"} · {titleCase(member.snapshot.interval)} · {member.snapshot.cancelAtPeriodEnd ? "ends" : "renews"} {formatDay(member.snapshot.currentPeriodEnd, true)}
                    </p>
                  </div>
                  <span className="shrink-0 text-right font-display text-[18px] font-extrabold tracking-[-0.04em] tabular-nums">{formatMoneyMinor(member.monthlyListMinor)}</span>
                </>
              );
              return (
                <li key={member.userId}>
                  {canOpenMembers
                    ? <Link className="flex items-center gap-3 px-5 py-4 active:bg-paper" href={`/members/${member.userId}`}>{body}</Link>
                    : <div className="flex items-center gap-3 px-5 py-4">{body}</div>}
                </li>
              );
            })}
          </ul>
          <div className="hidden md:block">
          <Table minWidth={720}>
            <thead>
              <tr><Th>Member</Th><Th>Plan</Th><Th>Status</Th><Th>Renews or ends</Th><Th>Subscription</Th><Th align="right">List / month</Th></tr>
            </thead>
            <tbody>
              {paid.map((member) => (
                <tr className="border-t border-ink/[0.06] hover:bg-paper/60" key={member.userId}>
                  <Td>
                    {canOpenMembers
                      ? <Link className="font-semibold hover:underline" href={`/members/${member.userId}`}>{member.displayName ?? member.userId.slice(0, 8)}</Link>
                      : <span className="font-semibold">{member.displayName ?? member.userId.slice(0, 8)}</span>}
                    {member.username ? <span className="ml-1.5 text-[12px] text-ink/50">@{member.username}</span> : null}
                  </Td>
                  <Td><span className="flex items-center gap-1.5"><PlanBadge plan={member.snapshot.plan} /><span className="text-[12px] text-ink/55">{titleCase(member.snapshot.interval)}</span></span></Td>
                  <Td>
                    {member.snapshot.cancelAtPeriodEnd ? <Badge tone="warn">Cancelling</Badge>
                      : member.snapshot.status === "past_due" ? <Badge tone="bad">Past due</Badge>
                        : <Badge dot tone="good">Active</Badge>}
                  </Td>
                  <Td className="whitespace-nowrap text-ink/70">{formatDay(member.snapshot.currentPeriodEnd)}</Td>
                  <Td><code className="font-label text-[11.5px] text-ink/55">{member.subscriptionId}</code></Td>
                  <Td align="right">{formatMoneyMinor(member.monthlyListMinor)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          </div>
        </>)}
      </Panel>

      {billing.lapsed.length ? (
        <div className="mt-3 sm:mt-4">
          <Notice tone="warn">
            {plural(billing.lapsed.length, "subscription")} still marked active but past the period end, so the app treats {billing.lapsed.length === 1 ? "it" : "them"} as Free ({billing.lapsed.map((row) => row.username ? `@${row.username}` : row.user_id.slice(0, 8)).join(", ")}). Usually a renewal webhook that hasn’t arrived yet; Dodo has the answer.
          </Notice>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-2 lg:items-start">
        <Panel description="Checkout sessions started in the last 30 days." title="Checkouts">
          {checkoutTotal === 0 ? <Empty>No checkouts in the last 30 days.</Empty> : (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {CHECKOUT_ORDER.map((status) => (
                <div className="rounded-[16px] bg-paper px-3.5 py-3" key={status}>
                  <dt className="font-label text-[9.5px] uppercase tracking-[0.14em] text-ink/45">{titleCase(status)}</dt>
                  <dd className="mt-2 font-display text-[28px] font-extrabold leading-none tracking-[-0.055em] tabular-nums">{formatCount(billing.checkouts_30d[status] ?? 0)}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-3 text-[12px] text-ink/50">{formatCount(billing.customers)} billing customers on record.</p>
        </Panel>
        <Panel description="Dodo events received in the last 30 days, by outcome." padded={false} title="Webhooks">
          {billing.webhooks_30d.length === 0 ? <Empty>No webhooks in the last 30 days.</Empty> : (
            <Table minWidth={420}>
              <thead><tr><Th>Event</Th><Th>Outcome</Th><Th align="right">Count</Th><Th align="right">Last</Th></tr></thead>
              <tbody>
                {billing.webhooks_30d.map((row) => (
                  <tr className="border-t border-ink/[0.06]" key={`${row.event_type}-${row.status}`}>
                    <Td><code className="font-label text-[11.5px]">{row.event_type}</code></Td>
                    <Td><Badge tone={row.status === "processed" ? "good" : row.status === "failed" ? "bad" : row.status === "processing" ? "warn" : "neutral"}>{titleCase(row.status)}</Badge></Td>
                    <Td align="right">{formatCount(row.count)}</Td>
                    <Td align="right" className="whitespace-nowrap text-ink/60">{formatRelative(row.last_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Notice>
          A plan granted by hand in the database looks like any other row here. Open the member and use “Verify with Dodo” to see whether Dodo knows the subscription. Run-rate is list price only: it ignores discounts, taxes, refunds and currency.
        </Notice>
      </div>
    </>
  );
}
