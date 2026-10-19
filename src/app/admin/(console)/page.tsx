import type { Metadata } from "next";

import { CountryFlag, countryName } from "@/components/admin/flag";
import { DailyBars, Empty, Meter, Notice, PageHeader, Panel, SectionHead, Segmented, Stat, Table, Td, Th } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/auth";
import { ADMIN_RANGES, getOverview, parseRange, type SiteTraffic } from "@/lib/admin/data";
import { formatCount, formatDay, formatDelta, formatMoneyMinor, formatPercent, plural, sourceLabel, titleCase } from "@/lib/admin/format";
import { SITE_PAGES } from "@/lib/analytics/site-pages";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdminPage("overview");
  const days = parseRange((await searchParams).range);
  const { from, to, overview, traffic, journey, plans } = await getOverview(days);
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
        description={<>{formatDay(from)} to {formatDay(to)}, in UTC. Every change compares with the {days} days before.</>}
        eyebrow={`Last ${days} days`}
        title="Overview"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          delta={formatDelta(accounts.new_in_range, accounts.new_in_previous)}
          href="/members"
          label="New accounts"
          note={<>{formatCount(accounts.total)} in total · {formatCount(accounts.confirmed)} confirmed</>}
          tone="ink"
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
          label="Run-rate, list price"
          note="Per month, from plans that grant access today"
          value={formatMoneyMinor(plans.listRunRateMinor, true)}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" description="New accounts, and profile views recorded by Setuvara’s own analytics." title="Daily activity">
          <div className="grid gap-8 sm:grid-cols-2">
            <DailyBars label="New accounts" points={overview.daily.map((day) => ({ date: day.date, value: day.signups }))} />
            <DailyBars label="Profile views" points={overview.daily.map((day) => ({ date: day.date, value: day.views }))} />
          </div>
        </Panel>
        <Panel className="lg:col-span-2" description="Accounts created in this range, and how far each got." title="Activation">
          {activation.cohort === 0 ? <Empty>No accounts were created in this range.</Empty> : (
            <ol className="space-y-4">
              {funnel.map((step, index) => (
                <li className="flex gap-3" key={step.label}>
                  <span aria-hidden="true" className="mt-0.5 font-label text-[10px] tabular-nums text-ink/35">0{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Meter detail={<>{formatCount(step.value)} · {formatPercent(step.value, activation.cohort)}</>} label={step.label} max={activation.cohort} value={step.value} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <SiteTrafficSection traffic={traffic} />

      <SectionHead description="What members do with Setuvara once they’re in." eyebrow="Engagement" id="engagement" title="Sharing and meeting" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat delta={formatDelta(engagement.profile_views, previous.profile_views)} label="Profile views" note={<>{formatCount(engagement.members_viewed)} members were viewed</>} value={formatCount(engagement.profile_views)} />
        <Stat delta={formatDelta(engagement.profile_shares, previous.profile_shares)} label="Shares" note={<>{formatCount(engagement.members_shared)} members shared</>} value={formatCount(engagement.profile_shares)} />
        <Stat label="QR and Tap scans" note="Quick QR and Setuvara Tap" value={formatCount(engagement.qr_scans)} />
        <Stat delta={formatDelta(engagement.connections, previous.connections)} label="Connections made" note={<>{formatCount(connections.total)} in total · {formatCount(connections.with_guests)} with guests</>} tone="ink" value={formatCount(engagement.connections)} />
      </div>

      <Panel className="mt-3 sm:mt-4" description="Every profile has each Mode switched on by default, so adoption is what members do with it." padded={false} title="Modes">
        {/* Phones: one card per Mode */}
        <ul className="grid gap-px border-t border-ink/[0.07] bg-ink/[0.07] sm:hidden">
          {overview.modes.map((mode) => (
            <li className="bg-white px-5 py-4" key={mode.slug}>
              <p className="font-display text-[18px] font-bold tracking-[-0.03em]">{titleCase(mode.slug)}</p>
              <dl className="mt-3 grid grid-cols-3 gap-y-3 text-[12px]">
                {[
                  ["On", mode.enabled], ["Photo", mode.with_photo], ["Content", mode.with_content],
                  ["Views", mode.views], ["Shares", mode.shares], ["Met", mode.encounters],
                ].map(([label, value]) => (
                  <div key={label}><dt className="font-label text-[9.5px] uppercase tracking-[0.14em] text-ink/40">{label}</dt><dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{formatCount(value as number)}</dd></div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
        <div className="hidden sm:block">
          <Table minWidth={640}>
            <thead>
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
                <tr className="border-t border-ink/[0.06] hover:bg-paper/60" key={mode.slug}>
                  <Td className="font-display text-[16px] font-bold tracking-[-0.03em]">{titleCase(mode.slug)}</Td>
                  <Td align="right">{formatCount(mode.enabled)}</Td>
                  <Td align="right">{formatCount(mode.with_photo)} <span className="text-ink/35">{formatPercent(mode.with_photo, profiles.total)}</span></Td>
                  <Td align="right">{formatCount(mode.with_content)} <span className="text-ink/35">{formatPercent(mode.with_content, profiles.total)}</span></Td>
                  <Td align="right">{formatCount(mode.views)}</Td>
                  <Td align="right">{formatCount(mode.shares)}</Td>
                  <Td align="right">{formatCount(mode.encounters)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Panel>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-3">
        <Panel description="How visitors reached a profile." title="View sources">
          {overview.sources.length === 0 ? <Empty>No views in this range.</Empty> : (
            <ul className="space-y-4">{overview.sources.map((item) => <li key={item.source}><Meter label={sourceLabel(item.source)} max={sourceMax} value={item.count} /></li>)}</ul>
          )}
        </Panel>
        <Panel description="Device class of the viewer." title="Devices">
          {overview.devices.length === 0 ? <Empty>No views in this range.</Empty> : (
            <ul className="space-y-4">{overview.devices.map((item) => <li key={item.device}><Meter label={titleCase(item.device)} max={deviceMax} value={item.count} /></li>)}</ul>
          )}
        </Panel>
        <Panel description="From the product journey report." title="Guest journey" tone="ink">
          {journey ? (
            <dl className="space-y-0">
              {[
                ["Guest connections", journey.guestConnections],
                ["Guests who claimed an account", journey.guestClaims],
                ["First shares", journey.firstShares],
                ["Repeat shares", journey.repeatShares],
                ["Connections after a first share", journey.newConnectionsAfterFirstShare],
              ].map(([label, value]) => (
                <div className="flex items-baseline justify-between gap-3 border-b border-paper/10 py-3 first:pt-0 last:border-b-0 last:pb-0" key={label}>
                  <dt className="text-[13px] text-paper/60">{label}</dt>
                  <dd className="font-display text-[22px] font-extrabold leading-none tracking-[-0.05em] tabular-nums">{formatCount(value as number)}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="py-4 text-[13px] text-paper/55">The journey report is unavailable right now.</p>}
        </Panel>
      </div>

      <div className="mt-6">
        <Notice>
          Profiles: {formatCount(profiles.total)} ({formatCount(profiles.published)} published, {formatCount(profiles.with_bio)} with a bio). Views, shares and scans come from Setuvara’s own event log, which starts on 10 Oct 2026 and records no visitor identity. Run-rate multiplies each paid plan by its list price; collected revenue, taxes and refunds live in Dodo.
        </Notice>
      </div>
    </>
  );
}

const TOP_COUNTRIES = 10;

function SiteTrafficSection({ traffic }: { traffic: SiteTraffic | null }) {
  const head = (description: string) => <SectionHead description={description} eyebrow="setuvara.com" id="site-traffic" title="Site traffic" />;
  if (!traffic) {
    return <section aria-labelledby="site-traffic">{head("Page views of the public site.")}<Notice tone="warn">Site traffic isn’t available yet. It starts once its database update has been applied.</Notice></section>;
  }
  const { totals } = traffic;
  const top = traffic.countries.find((item) => item.country) ?? null;
  const pageMax = Math.max(0, ...traffic.pages.map((item) => item.count));
  const countryMax = Math.max(0, ...traffic.countries.map((item) => item.count));
  const shownCountries = traffic.countries.slice(0, TOP_COUNTRIES);
  const otherCountries = traffic.countries.slice(TOP_COUNTRIES);
  const otherViews = otherCountries.reduce((sum, item) => sum + item.count, 0);
  const since = traffic.recording_since ? `Counting since ${formatDay(traffic.recording_since)}.` : "Counting starts with the first visit.";

  return (
    <section aria-labelledby="site-traffic">
      {head(`Page views of the public site, profiles included. ${since}`)}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat delta={formatDelta(totals.views, totals.views_previous)} label="Page views" note="Every public page, profiles included" tone="ink" value={formatCount(totals.views)} />
        <Stat delta={formatDelta(totals.home, totals.home_previous)} label="Homepage views" note={<>{formatPercent(totals.home, totals.views)} of page views</>} value={formatCount(totals.home)} />
        <Stat label="Countries" note="Where visits came from" value={formatCount(totals.countries)} />
        <Stat
          label="Top country"
          note={top ? <>{formatCount(top.count)} views · {formatPercent(top.count, totals.views)}</> : "No visits in this range"}
          value={top ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <CountryFlag code={top.country} size="lg" />
              <span className="min-w-0 truncate text-[22px] tracking-[-0.05em] sm:text-[26px]">{countryName(top.country)}</span>
            </span>
          ) : "—"}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-3">
        <Panel description="Every public page, and the homepage on its own." title="By day">
          <div className="grid gap-8">
            <DailyBars label="Page views" points={traffic.daily.map((day) => ({ date: day.date, value: day.views }))} />
            <DailyBars label="Homepage" points={traffic.daily.map((day) => ({ date: day.date, value: day.home }))} />
          </div>
        </Panel>
        <Panel description="Views per page in this range." title="Pages">
          {traffic.pages.length === 0 ? <Empty>No page views in this range.</Empty> : (
            <ul className="space-y-4">
              {traffic.pages.map((item) => (
                <li key={item.page}>
                  <Meter detail={<>{formatCount(item.count)} · {formatPercent(item.count, totals.views)}</>} label={SITE_PAGES[item.page as keyof typeof SITE_PAGES] ?? titleCase(item.page)} max={pageMax} value={item.count} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel description="Country of the visit, as reported by the hosting edge." title="Countries">
          {traffic.countries.length === 0 ? <Empty>No page views in this range.</Empty> : (
            <ul className="space-y-4">
              {shownCountries.map((item) => (
                <li key={item.country ?? "unknown"}>
                  <Meter
                    detail={<>{formatCount(item.count)} · {formatPercent(item.count, totals.views)}</>}
                    label={<span className="flex min-w-0 items-center gap-2.5"><CountryFlag code={item.country} /><span className="truncate">{countryName(item.country)}</span></span>}
                    max={countryMax}
                    value={item.count}
                  />
                </li>
              ))}
              {otherCountries.length ? (
                <li><Meter detail={<>{formatCount(otherViews)} · {formatPercent(otherViews, totals.views)}</>} label={plural(otherCountries.length, "other country", "other countries")} max={countryMax} value={otherViews} /></li>
              ) : null}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}
