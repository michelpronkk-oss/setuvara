import Link from "next/link";
import type { ReactNode } from "react";

import { PlatformTile, StudioHead, StudioPage } from "@/components/creator/studio-ui";
import { MeetMark } from "@/components/marketing/brand";
import type { ProfileAnalyticsReport } from "@/lib/analytics/server";
import { formatAmount } from "@/lib/commerce/model";
import { formatMoney } from "@/lib/creator/deals";
import { formatWait, type AudienceInsight, type DealInsight, type Money, type StoreInsight } from "@/lib/creator/insights";
import { accountState, ACCOUNT_STATE_LABEL, AUDIENCE_NOUN, COMBINED_NOTE, combinedAudience, formatAudience, SOCIAL_NAME, type SocialAccount } from "@/lib/social/model";

const SOURCE_LABEL: Record<string, string> = { direct: "Direct and search", link: "Your shared link", share: "Shares", native_share: "Shares", qr: "QR scans", quick_qr: "Quick QR", tap: "Tap", profile: "From Setuvara" };

export type InsightsRange = { value: string; label: string; say: string; allowed: boolean };

/**
 * Creator Insights: page opens and sources (Plus), then the Creator page's audience, brand deals and
 * store over the same range, and verified platform counts. Every number arrives computed; a dash
 * means we can't know it yet, never zero.
 */
export function InsightsView({ ranges, range, report, audience, collabs, store, emailsSent, responses, followerCount, platforms }: {
  ranges: InsightsRange[]; range: InsightsRange; report: ProfileAnalyticsReport | null;
  audience: AudienceInsight; collabs: DealInsight; store: StoreInsight; emailsSent: number; responses: number; followerCount: number; platforms: SocialAccount[];
}) {
  const opens = report?.summary.profileViews ?? null;
  const scans = report ? report.summary.qrScans + report.summary.quickQrScans + report.summary.tapScans : null;
  const delta = report?.comparison.profileViewsDelta ?? null;
  const daily = report?.daily ?? [];
  const peak = daily.reduce((best, row) => (row.profileViews > best.profileViews ? row : best), { date: "", profileViews: 0 } as { date: string; profileViews: number });
  const sources = (report?.sources ?? []).filter((row) => row.count > 0);
  const sourceTotal = sources.reduce((sum, row) => sum + row.count, 0);
  const combined = combinedAudience(platforms);
  const signups = opens ? audience.joined / opens : null;

  return (
    <StudioPage>
      <StudioHead
        action={(
          <nav aria-label="Range" className="inline-flex gap-1 rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]">
            {ranges.map((item) => {
              const on = item.value === range.value;
              return item.allowed
                ? <Link aria-current={on ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full px-4 text-[15px] font-semibold ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : ""}`} href={`?range=${item.value}`} key={item.value} scroll={false}>{item.label}</Link>
                : <span className="inline-flex min-h-10 items-center rounded-full px-4 text-[15px] font-semibold text-black/35" key={item.value} title="Longer ranges come with Plus">{item.label}</span>;
            })}
          </nav>
        )}
        sub={range.say}
        title="Insights"
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)] lg:gap-10">
        <section aria-labelledby="on-setuvara" className="min-w-0">
          <h2 className="flex items-center gap-2 border-b-[1.5px] border-[#0D0D0D] pb-3 font-label text-[11px] uppercase tracking-[0.18em]" id="on-setuvara"><MeetMark className="size-3.5" />On Setuvara</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 py-5 md:grid-cols-4">
            <Kpi detail={delta === null ? undefined : `${delta >= 0 ? "+" : ""}${Math.round(delta)}% vs previous`} good={delta !== null && delta >= 0} label="Page opens" value={opens} />
            <Kpi label="QR and Tap" value={scans} />
            <Kpi detail="Following you on Setuvara" label="Followers" value={followerCount} />
            <Kpi detail="Requests, entries and questions" label="Action responses" value={responses} />
          </dl>
          {report ? (
            <div className="rounded-[22px] bg-white p-5 md:p-6">
              <div className="mb-3 flex items-baseline justify-between gap-3"><p className="text-[15px] font-semibold">Page opens per day</p>{peak.profileViews > 0 && <p className="text-[14px] text-black/60">Peak: {peak.profileViews.toLocaleString("en")} opens</p>}</div>
              <OpensChart values={daily.map((row) => row.profileViews)} />
              <p className="mt-3 text-[14px] leading-[1.5] text-black/70">{storyLine(opens ?? 0, peak, typeof sources[0]?.source === "string" ? sources[0].source : undefined)}</p>
            </div>
          ) : (
            <div className="rounded-[22px] bg-white p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
              <p className="text-[17px] font-semibold">Creator page opens come with Plus.</p>
              <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.5] text-black/65">Plus splits your analytics by Mode, so you see this page on its own: daily opens and where visitors came from. Your audience, deals and store below are always yours.</p>
              <Link className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-[18px] text-[15px] font-semibold text-[#F5F4EF]" href="/pricing">See Plus</Link>
            </div>
          )}

          <Group id="audience" title="Audience" tag={`${audience.subscribed.toLocaleString("en")} on your lists`}>
            <Kpi detail={audience.left ? `${audience.left.toLocaleString("en")} left` : undefined} label="Joined" value={audience.joined} />
            <Kpi detail="Joined minus left" good={audience.net > 0} label="Net growth" value={audience.net} signed />
            <Kpi detail={signups === null ? "Needs page opens" : "Of page opens"} label="Sign-up rate" text={signups === null ? null : percent(signups)} />
            <Kpi detail="From Creator campaigns" label="Emails sent" value={emailsSent} />
          </Group>
          {audience.joined + audience.left > 0 && (
            <div className="rounded-[22px] bg-white p-5 md:p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[15px] font-semibold">Joined and left per day</p>
                <p className="flex items-center gap-3 text-[13px] text-black/60"><span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-[#0D0D0D]" />Joined</span><span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-[#FF5A4F]" />Left</span></p>
              </div>
              <Bars rows={audience.daily} />
            </div>
          )}

          <Group id="collabs" title="Collaborations" tag={collabs.open ? `${collabs.open} open` : undefined}>
            <Kpi label="Brand inquiries" value={collabs.inquiries} />
            <Kpi detail={collabs.winRate === null ? "None decided yet" : `${collabs.won} booked · ${collabs.declined} declined`} label="Win rate" text={collabs.winRate === null ? null : percent(collabs.winRate)} />
            <Kpi detail="Median, New to next stage" label="First reply" text={collabs.medianReplyHours === null ? null : formatWait(collabs.medianReplyHours)} />
            <Kpi detail={collabs.pipeline.length ? `${moneyLine(collabs.pipeline, formatMoney)} booked` : "Marked Paid in range"} label="Paid deals" text={collabs.paid.length ? moneyLine(collabs.paid, formatMoney) : null} />
          </Group>
          <p className="-mt-2 text-[13px] text-black/50">Amounts are the fees you entered on each deal.</p>

          <Group id="store" title="Store" tag={store.test ? "Test payments" : undefined}>
            <Kpi detail={store.totals.length ? moneyLine(store.totals.map((row) => ({ currency: row.currency, amount: row.gross })), formatAmount) + " gross" : undefined} label="Kept" text={store.totals.length ? moneyLine(store.totals.map((row) => ({ currency: row.currency, amount: row.net })), formatAmount) : null} />
            <Kpi detail={store.freeClaims ? `+${store.freeClaims} free claims` : undefined} label="Purchases" value={store.purchases} />
            <Kpi detail={store.returning ? `${store.returning} came back` : undefined} label="Buyers" value={store.buyers} />
            <Kpi detail={`${store.views.toLocaleString("en")} product views`} label="Conversion" text={store.conversion === null ? null : percent(store.conversion)} />
          </Group>
          {store.totals.some((row) => row.feesPending > 0) && <p className="-mt-2 text-[13px] text-black/50">Some processing fees aren&apos;t reported yet, so kept may drop slightly.</p>}
        </section>

        <div className="flex flex-col gap-8">
          {report && (
            <section aria-labelledby="sources">
              <h2 className="border-b-[1.5px] border-[#0D0D0D] pb-3 font-label text-[11px] uppercase tracking-[0.18em]" id="sources">Where visitors came from</h2>
              {sources.length ? (
                <ul className="flex flex-col gap-4 pt-4">
                  {sources.map((row, index) => {
                    const share = Math.round((row.count / sourceTotal) * 100);
                    return <li key={row.source}><div className="flex justify-between text-[15px]"><span>{SOURCE_LABEL[row.source as string] ?? row.source}</span><span className="tabular-nums">{share}%</span></div><div className="mt-1.5 h-2 rounded-full bg-black/[0.08]"><div className="h-2 rounded-full" style={{ width: `${share}%`, background: index === 0 ? "#FF5A4F" : "#0D0D0D" }} /></div></li>;
                  })}
                </ul>
              ) : <p className="pt-4 text-[15px] text-black/60">No visits in this range yet.</p>}
            </section>
          )}
          <section aria-labelledby="platforms">
            <h2 className="border-b-[1.5px] border-[#0D0D0D] pb-3 font-label text-[11px] uppercase tracking-[0.18em]" id="platforms">From your platforms</h2>
            {platforms.length ? (
              <ul className="flex flex-col gap-3 pt-4">
                {platforms.map((account) => {
                  const state = accountState(account);
                  const count = account.status === "connected" && !account.audience_hidden ? account.audience_count : null;
                  return (
                    <li className="flex items-center gap-3" key={account.id}>
                      <PlatformTile size={32} type={account.provider} />
                      <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{SOCIAL_NAME[account.provider]}</span><span className="block truncate text-[13px] text-black/55">@{account.username}</span></span>
                      <span className="text-right">
                        <span className="block font-display text-[20px] font-bold leading-none tracking-[-0.03em]">{count === null ? "—" : formatAudience(count)}</span>
                        <span className={`block pt-1 font-label text-[10px] uppercase tracking-[0.1em] ${state === "synced" ? "text-[#1F7A4D]" : "text-black/45"}`}>{count === null ? ACCOUNT_STATE_LABEL[state] : `${AUDIENCE_NOUN[account.provider]} · ${ACCOUNT_STATE_LABEL[state]}`}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="pt-4 text-[15px] text-black/60">No platforms connected yet.</p>}
            {combined && <p className="pt-4 text-[13px] leading-[1.5] text-black/60"><b className="text-[#0D0D0D]">{formatAudience(combined.total)}</b> across {combined.platforms} platforms. {COMBINED_NOTE}</p>}
            <p className="pt-3 text-[13px] leading-[1.5] text-black/60">Counts come from each platform after you sign in with it, never typed. <Link className="font-semibold text-[#0D0D0D] underline underline-offset-2" href="/app/identity/creator/settings">Connect platforms</Link></p>
          </section>
        </div>
      </div>
    </StudioPage>
  );
}

function percent(share: number) {
  const value = share * 100;
  return `${value > 0 && value < 1 ? value.toFixed(1) : Math.round(value)}%`;
}

/** "€1,200 · $300": currencies side by side, never added. */
function moneyLine(rows: Money[], format: (amount: number, currency: string) => string) {
  return rows.map((row) => format(row.amount, row.currency)).join(" · ");
}

function Group({ id, title, tag, children }: { id: string; title: string; tag?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <div className="flex items-baseline justify-between gap-3 border-b-[1.5px] border-[#0D0D0D] pb-3">
        <h2 className="font-label text-[11px] uppercase tracking-[0.18em]" id={id}>{title}</h2>
        {tag && <span className="text-[13px] font-semibold text-black/60">{tag}</span>}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 py-5 md:grid-cols-4">{children}</dl>
    </section>
  );
}

function Kpi({ label, value = null, text, detail, good = false, signed = false }: { label: string; value?: number | null; text?: string | null; detail?: string; good?: boolean; signed?: boolean }) {
  const shown = text !== undefined ? text : value === null ? null : `${signed && value > 0 ? "+" : ""}${value.toLocaleString("en")}`;
  return (
    <div className="min-w-0">
      <dt className="text-[15px] text-black/70">{label}</dt>
      <dd className={`mt-1 truncate font-display font-bold leading-none tracking-[-0.05em] ${shown && shown.length > 9 ? "text-[24px] md:text-[26px]" : "text-[36px] md:text-[40px]"}`}>{shown ?? "—"}</dd>
      {detail && <dd className={`mt-1.5 text-[13px] font-semibold ${good ? "text-[#1F7A4D]" : "text-black/60"}`}>{detail}</dd>}
    </div>
  );
}

function storyLine(opens: number, peak: { date: string; profileViews: number }, topSource?: string) {
  if (!opens) return "No one has opened your Creator page in this range yet. Share it where your audience already is.";
  const day = peak.date ? new Date(`${peak.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }) : null;
  const from = topSource ? (SOURCE_LABEL[topSource] ?? topSource).toLowerCase() : null;
  return `${opens.toLocaleString("en")} opens.${day ? ` Busiest day was ${day}.` : ""}${from ? ` Most visitors came from ${from}.` : ""}`;
}

function OpensChart({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="grid h-[220px] place-items-center text-sm text-black/50">Not enough days yet.</div>;
  const max = Math.max(...values, 1) * 1.1;
  const points = values.map((value, index) => [(index / (values.length - 1)) * 800, 260 - (value / max) * 240] as const);
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg aria-label="Page opens per day" className="h-[220px] w-full md:h-[300px]" preserveAspectRatio="none" role="img" viewBox="0 0 800 260">
      {[65, 130, 195].map((y) => <line key={y} stroke="rgba(13,13,13,.08)" strokeWidth="1" vectorEffect="non-scaling-stroke" x1="0" x2="800" y1={y} y2={y} />)}
      <path d={`M0,260 L${line.replaceAll(" ", " L")} L800,260 Z`} fill="#FF5A4F" fillOpacity=".12" />
      <polyline fill="none" points={line} stroke="#FF5A4F" strokeLinejoin="round" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Joined above the line, left below, one bar per day. */
function Bars({ rows }: { rows: { day: string; joined: number; left: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => Math.max(row.joined, row.left)));
  const width = 800 / rows.length;
  const bar = Math.max(Math.min(width * 0.45, 14), 1);
  return (
    <svg aria-label="Joined and left per day" className="h-[120px] w-full md:h-[140px]" preserveAspectRatio="none" role="img" viewBox="0 0 800 120">
      <line stroke="rgba(13,13,13,.15)" strokeWidth="1" vectorEffect="non-scaling-stroke" x1="0" x2="800" y1="80" y2="80" />
      {rows.map((row, index) => (
        <g key={row.day}>
          {row.joined > 0 && <rect fill="#0D0D0D" height={(row.joined / max) * 76} rx="1.5" width={bar} x={index * width + (width - bar) / 2} y={80 - (row.joined / max) * 76} />}
          {row.left > 0 && <rect fill="#FF5A4F" height={(row.left / max) * 36} rx="1.5" width={bar} x={index * width + (width - bar) / 2} y={81} />}
        </g>
      ))}
    </svg>
  );
}
