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
      <StudioHead creator
        action={(
          <nav aria-label="Range" className="inline-flex gap-1 rounded-full bg-white p-1 text-[#0D0D0D] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]">
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
          {report ? (
            <OpensPulse delta={delta} opens={opens ?? 0} rows={[
              { label: "QR and Tap", value: scans ?? 0, note: "scans of your code" },
              { label: "Followers", value: followerCount, note: "following you on Setuvara" },
              { label: "Action responses", value: responses, note: "requests, entries, questions" },
            ]} story={storyLine(opens ?? 0, peak, typeof sources[0]?.source === "string" ? sources[0].source : undefined)} values={daily.map((row) => row.profileViews)} />
          ) : (
            <div className="relative isolate overflow-hidden rounded-[28px] bg-[#0D0D0D] p-7 text-[#F5F4EF]">
              <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 -z-10 size-72 rounded-full opacity-70 blur-2xl" style={{ background: "radial-gradient(circle, #E8A6FF80, transparent 65%)" }} />
              <p className="font-display text-[28px] font-bold leading-[1.05] tracking-[-0.04em]">Creator page opens come with Plus.</p>
              <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.5] text-[#F5F4EF]/65">Plus splits your analytics by Mode, so you see this page on its own: daily opens and where visitors came from. Your audience, deals and store below are always yours.</p>
              <Link className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#E8A6FF] px-[18px] text-[15px] font-semibold text-[#0D0D0D]" href="/pricing">See Plus</Link>
              <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-[#F5F4EF]/10 pt-5">
                {[["QR and Tap", scans ?? 0], ["Followers", followerCount], ["Action responses", responses]].map(([label, value]) => <div key={label}><dt className="font-label text-[10px] uppercase tracking-[0.16em] text-[#F5F4EF]/50">{label}</dt><dd className="mt-1 font-display text-[32px] font-bold leading-none tracking-[-0.05em]">{value}</dd></div>)}
              </dl>
            </div>
          )}

          <Group id="audience" title="Audience" tag={`${audience.subscribed.toLocaleString("en")} on your lists`}>
            <Kpi detail={audience.left ? `${audience.left.toLocaleString("en")} left` : undefined} label="Joined" value={audience.joined} />
            <Kpi detail="Joined minus left" good={audience.net > 0} label="Net growth" value={audience.net} signed />
            <Kpi detail={signups === null ? "Needs page opens" : "Of page opens"} label="Sign-up rate" text={signups === null ? null : percent(signups)} />
            <Kpi detail="From Creator campaigns" label="Emails sent" value={emailsSent} />
          </Group>
          {audience.joined + audience.left > 0 && (
            <div className="mt-3 rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.07)] md:p-6">
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
          <p className="mt-2 px-1 text-[12.5px] text-black/50">Amounts are the fees you entered on each deal.</p>

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
            <section aria-labelledby="sources" className="rounded-[26px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.07),0_24px_50px_-44px_#0D0D0D] md:p-6">
              <h2 className="font-display text-[20px] font-bold tracking-[-0.03em]" id="sources">Where visitors came from</h2>
              {sources.length ? (
                <ul className="flex flex-col gap-4 pt-4">
                  {sources.map((row, index) => {
                    const share = Math.round((row.count / sourceTotal) * 100);
                    return <li key={row.source}><div className="flex justify-between text-[15px]"><span>{SOURCE_LABEL[row.source as string] ?? row.source}</span><span className="tabular-nums">{share}%</span></div><div className="mt-1.5 h-2.5 rounded-full bg-black/[0.06]"><div className="h-2.5 rounded-full" style={{ width: `${share}%`, background: index === 0 ? "linear-gradient(90deg,#E8A6FF,#FF5A4F)" : "#0D0D0D" }} /></div></li>;
                  })}
                </ul>
              ) : <p className="pt-4 text-[15px] text-black/60">No visits in this range yet.</p>}
            </section>
          )}
          <section aria-labelledby="platforms" className="rounded-[26px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.07),0_24px_50px_-44px_#0D0D0D] md:p-6">
            <h2 className="font-display text-[20px] font-bold tracking-[-0.03em]" id="platforms">From your platforms</h2>
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

const GROUP_ICON: Record<string, string> = {
  audience: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-7 9c.6-3.4 3.3-5.5 7-5.5s6.4 2.1 7 5.5H2Zm14.5-9a3 3 0 1 0 0-6M22 20c-.4-2.6-2-4.4-4.3-5",
  collabs: "M4 12h4l3-3 3 3 2-2h4M4 12l4 4 2-2m4-2-2 2 2 2 4-4",
  store: "M5 8h14l-1 12H6L5 8Zm3 0a4 4 0 1 1 8 0",
};

function Group({ id, title, tag, children }: { id: string; title: string; tag?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-5 rounded-[26px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.07),0_24px_50px_-44px_#0D0D0D] md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-display text-[22px] font-bold tracking-[-0.035em]" id={id}>
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-[12px] bg-[#0D0D0D] text-[#E8A6FF]"><svg className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d={GROUP_ICON[id] ?? GROUP_ICON.store} /></svg></span>
          {title}
        </h2>
        {tag && <span className="rounded-full bg-[#F5F4EF] px-3 py-1 text-[12.5px] font-semibold text-black/65">{tag}</span>}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] bg-black/[0.06] md:grid-cols-4">{children}</dl>
    </section>
  );
}

function Kpi({ label, value = null, text, detail, good = false, signed = false }: { label: string; value?: number | null; text?: string | null; detail?: string; good?: boolean; signed?: boolean }) {
  const shown = text !== undefined ? text : value === null ? null : `${signed && value > 0 ? "+" : ""}${value.toLocaleString("en")}`;
  return (
    <div className="min-w-0 bg-white p-4">
      <dt className="text-[13.5px] text-black/60">{label}</dt>
      <dd className={`mt-1 truncate font-display font-bold leading-none tracking-[-0.05em] ${shown && shown.length > 9 ? "text-[22px] md:text-[24px]" : "text-[34px] md:text-[38px]"}`}>{shown ?? "—"}</dd>
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

/** Page opens on a dark card: the count, a smooth curve that draws in, and the other signals beside it. */
function OpensPulse({ opens, delta, values, story, rows }: { opens: number; delta: number | null; values: number[]; story: string; rows: { label: string; value: number; note: string }[] }) {
  const W = 800;
  const H = 220;
  const max = Math.max(...values, 1) * 1.15;
  const pts = values.map((value, index) => [values.length > 1 ? (index / (values.length - 1)) * W : W / 2, H - 6 - (value / max) * (H - 20)] as const);
  let d = pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]];
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return (
    <section aria-label="Page opens" className="relative isolate grid gap-6 overflow-hidden rounded-[28px] bg-[#0D0D0D] p-6 text-[#F5F4EF] shadow-[0_30px_60px_-40px_#0D0D0D] md:p-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <span aria-hidden="true" className="pointer-events-none absolute -left-24 -top-28 -z-10 size-96 rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(circle, #E8A6FF80, transparent 65%)" }} />
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-label text-[10.5px] uppercase tracking-[0.16em] text-[#F5F4EF]/55"><MeetMark className="size-3.5" />Page opens on Setuvara</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-3">
          <span className="font-display text-[72px] font-bold leading-none tracking-[-0.06em] tabular-nums md:text-[88px]">{opens.toLocaleString("en")}</span>
          {delta !== null && <span className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold" style={delta >= 0 ? { background: "#C7FF4A", color: "#0D0D0D" } : { boxShadow: "inset 0 0 0 1px rgba(245,244,239,.25)" }}>{delta >= 0 ? "▲" : "▼"} {Math.abs(Math.round(delta))}% vs previous</span>}
        </p>
        {values.length > 1 ? (
          <svg aria-label="Page opens per day" className="mt-5 h-[170px] w-full overflow-visible md:h-[200px]" preserveAspectRatio="none" role="img" viewBox={`0 0 ${W} ${H}`}>
            <defs>
              <linearGradient id="opens-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#E8A6FF" stopOpacity="0.35" /><stop offset="100%" stopColor="#E8A6FF" stopOpacity="0" /></linearGradient>
              <linearGradient id="opens-line" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="#E8A6FF" /><stop offset="100%" stopColor="#FF5A4F" /></linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((y) => <line key={y} stroke="#F5F4EF" strokeDasharray="2 5" strokeOpacity="0.1" vectorEffect="non-scaling-stroke" x1="0" x2={W} y1={H * y} y2={H * y} />)}
            <path className="opens-fade" d={`${d} L${W},${H} L0,${H} Z`} fill="url(#opens-fill)" />
            <path className="opens-draw" d={d} fill="none" stroke="url(#opens-line)" strokeLinecap="round" strokeWidth="2.75" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : <p className="mt-5 text-[14px] text-[#F5F4EF]/55">Not enough days yet.</p>}
        <p className="mt-3 text-[14px] leading-[1.5] text-[#F5F4EF]/65">{story}</p>
      </div>
      <dl className="grid content-end gap-2">
        {rows.map((row) => (
          <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[#F5F4EF]/[0.06] px-4 py-3" key={row.label}>
            <dt><span className="block text-[14px] font-semibold">{row.label}</span><span className="block text-[12px] text-[#F5F4EF]/50">{row.note}</span></dt>
            <dd className="font-display text-[30px] font-bold leading-none tracking-[-0.05em] tabular-nums">{row.value.toLocaleString("en")}</dd>
          </div>
        ))}
      </dl>
      <style>{`.opens-draw{stroke-dasharray:3000;stroke-dashoffset:3000;animation:opens-draw 1.6s cubic-bezier(.65,0,.35,1) .1s forwards}.opens-fade{opacity:0;animation:opens-fade 1s ease-out .8s forwards}@keyframes opens-draw{to{stroke-dashoffset:0}}@keyframes opens-fade{to{opacity:1}}@media (prefers-reduced-motion:reduce){.opens-draw,.opens-fade{animation:none;stroke-dashoffset:0;opacity:1}}`}</style>
    </section>
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
