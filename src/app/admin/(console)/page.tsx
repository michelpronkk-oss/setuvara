import type { Metadata } from "next";

import { DailyBars, Meter, Notice, PageHeader, Panel, Segmented, Stat, Table, Td, Th } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/auth";
import { ADMIN_RANGES, getOverview, parseRange } from "@/lib/admin/data";
import { formatCount, formatDay, formatDelta, formatMoneyMinor, formatPercent, sourceLabel, titleCase } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdminPage("overview");
  const days = parseRange((await searchParams).range);
  const { from, to, overview, journey, plans } = await getOverview(days);
  const { accounts, profiles, activation, engagement, engagement_previous: previous, connections } = overview;

  const funnel = [
    { label: "Created an account", value: activation.cohort },
    { label: "Set up a profile", value: activation.profile_created },
    { label: "Completed identity", value: activation.identity_completed },
    { label: "Shared for the first time", value: activation.first_share },
    { label: "Made a first connection", value: activation.first_connection },
  ];
  const sourceMax = Math.max(0, ...overview.sources.map((item) => item.count));
  const deviceMax = Math.max(0, ...overview.devices.map((item) => item.count));

  return (
    <>
      <PageHeader
        actions={<Segmented current={String(days)} options={ADMIN_RANGES.map((range) => ({ label: `${range}d`, value: String(range), href: `/?range=${range}` }))} />}
        description={<>{formatDay(from)} – {formatDay(to)} · UTC. Changes compare with the {days} days before.</>}
        title="Overview"
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          delta={formatDelta(accounts.new_in_range, accounts.new_in_previous)}
          href="/members"
          label="New accounts"
          note={<>{formatCount(accounts.total)} accounts in total · {formatCount(accounts.confirmed)} confirmed</>}
          value={formatCount(accounts.new_in_range)}
        />
        <Stat
          label="Signed in, 7 days"
          note={<>{formatCount(accounts.signed_in_30d)} in 30 days · {formatPercent(accounts.signed_in_7d, accounts.total)} of accounts</>}
          value={formatCount(accounts.signed_in_7d)}
        />
        <Stat
          href="/billing"
          label="Paid members"
          note={<>{formatCount(plans.plus)} Plus · {formatCount(plans.pro)} Pro · {formatPercent(plans.plus + plans.pro, profiles.total)} of profiles</>}
          value={formatCount(plans.plus + plans.pro)}
        />
        <Stat
          href="/billing"
          label="Run-rate at list price"
          note="Per month, from plans that grant access today"
          value={formatMoneyMinor(plans.listRunRateMinor, true)}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Daily activity" description="New accounts, and profile views recorded by first-party analytics.">
          <div className="grid gap-6 sm:grid-cols-2">
            <DailyBars label="New accounts" points={overview.daily.map((day) => ({ date: day.date, value: day.signups }))} />
            <DailyBars label="Profile views" points={overview.daily.map((day) => ({ date: day.date, value: day.views }))} />
          </div>
        </Panel>
        <Panel title="Activation" description={`Accounts created in this range, and how far each got. A step counts once it has happened, at any time.`}>
          {activation.cohort === 0 ? <p className="py-4 text-[13px] text-ink/50">No accounts were created in this range.</p> : (
            <ol className="space-y-3.5">
              {funnel.map((step) => (
                <li key={step.label}>
                  <Meter detail={<>{formatCount(step.value)} · {formatPercent(step.value, activation.cohort)}</>} label={step.label} max={activation.cohort} value={step.value} />
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat delta={formatDelta(engagement.profile_views, previous.profile_views)} label="Profile views" note={<>{formatCount(engagement.members_viewed)} members were viewed</>} value={formatCount(engagement.profile_views)} />
        <Stat delta={formatDelta(engagement.profile_shares, previous.profile_shares)} label="Shares" note={<>{formatCount(engagement.members_shared)} members shared</>} value={formatCount(engagement.profile_shares)} />
        <Stat label="QR and Tap scans" note="Quick QR and Setuvara Tap" value={formatCount(engagement.qr_scans)} />
        <Stat delta={formatDelta(engagement.connections, previous.connections)} label="Connections made" note={<>{formatCount(connections.total)} in total · {formatCount(connections.with_guests)} with guests</>} value={formatCount(engagement.connections)} />
      </div>

      <Panel className="mt-3" description="Every profile has each Mode switched on by default, so adoption is what members do with it." padded={false} title="Modes">
        <Table minWidth={640}>
          <thead className="bg-ink/[0.02]">
            <tr>
              <Th>Mode</Th>
              <Th align="right">Switched on</Th>
              <Th align="right">With photo</Th>
              <Th align="right">With content</Th>
              <Th align="right">Views</Th>
              <Th align="right">Shares</Th>
              <Th align="right">Met in person</Th>
            </tr>
          </thead>
          <tbody>
            {overview.modes.map((mode) => (
              <tr className="border-t border-ink/[0.06]" key={mode.slug}>
                <Td className="font-semibold">{titleCase(mode.slug)}</Td>
                <Td align="right">{formatCount(mode.enabled)}</Td>
                <Td align="right">{formatCount(mode.with_photo)} <span className="text-ink/40">{formatPercent(mode.with_photo, profiles.total)}</span></Td>
                <Td align="right">{formatCount(mode.with_content)} <span className="text-ink/40">{formatPercent(mode.with_content, profiles.total)}</span></Td>
                <Td align="right">{formatCount(mode.views)}</Td>
                <Td align="right">{formatCount(mode.shares)}</Td>
                <Td align="right">{formatCount(mode.encounters)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel description="How visitors reached a profile." title="View sources">
          {overview.sources.length === 0 ? <p className="py-4 text-[13px] text-ink/50">No views in this range.</p> : (
            <ul className="space-y-3">{overview.sources.map((item) => <li key={item.source}><Meter label={sourceLabel(item.source)} max={sourceMax} value={item.count} /></li>)}</ul>
          )}
        </Panel>
        <Panel description="Device class of the viewer." title="Devices">
          {overview.devices.length === 0 ? <p className="py-4 text-[13px] text-ink/50">No views in this range.</p> : (
            <ul className="space-y-3">{overview.devices.map((item) => <li key={item.device}><Meter label={titleCase(item.device)} max={deviceMax} value={item.count} /></li>)}</ul>
          )}
        </Panel>
        <Panel description="From the product journey report." title="Guest journey">
          {journey ? (
            <dl className="space-y-2.5 text-[13px]">
              {[
                ["Guest connections", journey.guestConnections],
                ["Guests who claimed an account", journey.guestClaims],
                ["First shares", journey.firstShares],
                ["Repeat shares", journey.repeatShares],
                ["Connections after a first share", journey.newConnectionsAfterFirstShare],
              ].map(([label, value]) => (
                <div className="flex items-baseline justify-between gap-3 border-b border-ink/[0.06] pb-2.5 last:border-b-0 last:pb-0" key={label}>
                  <dt className="text-ink/60">{label}</dt><dd className="font-semibold tabular-nums">{formatCount(value as number)}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="py-4 text-[13px] text-ink/50">The journey report is unavailable right now.</p>}
        </Panel>
      </div>

      <div className="mt-3">
        <Notice>
          Profiles: {formatCount(profiles.total)} ({formatCount(profiles.published)} published, {formatCount(profiles.with_bio)} with a bio). Views, shares and scans come from Setuvara’s own event log, which starts on 10 Oct 2026 and records no visitor identity. Run-rate multiplies each paid plan by its list price; collected revenue, taxes and refunds live in Dodo.
        </Notice>
      </div>
    </>
  );
}
