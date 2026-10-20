import type { Metadata } from "next";
import Link from "next/link";

import { ConceptTag, PlatformTile, StudioHead, StudioPage } from "@/components/creator/studio-ui";
import { MeetMark } from "@/components/marketing/brand";
import { analyticsCapabilities } from "@/lib/analytics/capabilities";
import { resolveAnalyticsQuery } from "@/lib/analytics/range";
import { getProfileAnalyticsReport, type ProfileAnalyticsReport } from "@/lib/analytics/server";
import { getViewerPlan } from "@/lib/app/viewer";
import { platformAccounts, PLATFORM_NAME } from "@/lib/creator/studio";
import { loadCreatorStudio } from "@/lib/creator/studio-server";

export const metadata: Metadata = { title: "Insights · Creator · Setuvara" };

const RANGES = [{ value: "7d", label: "7 days", say: "Last 7 days", days: 7 }, { value: "30d", label: "30 days", say: "Last 30 days", days: 30 }, { value: "90d", label: "90 days", say: "Last 90 days", days: 90 }] as const;
const SOURCE_LABEL: Record<string, string> = { direct: "Direct and search", link: "Your shared link", share: "Shares", native_share: "Shares", qr: "QR scans", quick_qr: "Quick QR", tap: "Tap", profile: "From Setuvara" };

export default async function CreatorInsightsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const [studio, query] = await Promise.all([loadCreatorStudio("/app/identity/creator/insights"), searchParams]);
  if (!studio.mode) return null;
  const { plan } = await getViewerPlan(studio.userId);
  const capabilities = analyticsCapabilities(plan);
  const range = RANGES.find((item) => item.value === query.range && capabilities.availableRanges.includes(item.value)) ?? RANGES[0];
  // Creator-only numbers need the Mode filter, which comes with Plus. Free sees what Setuvara itself holds.
  const resolved = capabilities.modeBreakdown ? resolveAnalyticsQuery(new URLSearchParams({ range: range.value, mode: "creator" }), capabilities) : null;
  let report: ProfileAnalyticsReport | null = null;
  if (resolved?.ok) {
    try { report = await getProfileAnalyticsReport({ profileId: studio.userId, plan, query: resolved.data }); } catch { report = null; }
  }
  const since = rangeStart(range.days);
  const responses = studio.submissions.filter((item) => item.status !== "pending_verification" && item.status !== "spam" && new Date(item.created_at).getTime() >= since).length;
  const { data: orders } = await studio.supabase.from("creator_orders").select("status, created_at").eq("creator_user_id", studio.userId).eq("status", "paid").gte("created_at", new Date(since).toISOString());

  const opens = report?.summary.profileViews ?? null;
  const scans = report ? report.summary.qrScans + report.summary.quickQrScans + report.summary.tapScans : null;
  const delta = report?.comparison.profileViewsDelta ?? null;
  const daily = report?.daily ?? [];
  const peak = daily.reduce((best, row) => (row.profileViews > best.profileViews ? row : best), { date: "", profileViews: 0 } as { date: string; profileViews: number });
  const sources = (report?.sources ?? []).filter((row) => row.count > 0);
  const sourceTotal = sources.reduce((sum, row) => sum + row.count, 0);
  const accounts = platformAccounts(studio.links).filter((item) => item.link);

  return (
    <StudioPage>
      <StudioHead
        action={(
          <nav aria-label="Range" className="inline-flex gap-1 rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]">
            {RANGES.map((item) => {
              const allowed = capabilities.availableRanges.includes(item.value);
              const on = item.value === range.value;
              return allowed
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
            <Kpi detail="Paid on Setuvara" label="Store orders" value={orders?.length ?? 0} />
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
              <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.5] text-black/65">Plus splits your analytics by Mode, so you see this page on its own: daily opens and where visitors came from. Inquiries and orders above are always yours.</p>
              <Link className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-[18px] text-[15px] font-semibold text-[#F5F4EF]" href="/pricing">See Plus</Link>
            </div>
          )}
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
            <div className="flex items-center justify-between gap-3 border-b border-dashed border-black/25 pb-3"><h2 className="font-label text-[11px] uppercase tracking-[0.18em]" id="platforms">From your platforms</h2><ConceptTag /></div>
            {accounts.length ? (
              <ul className="flex flex-col gap-3 pt-4">
                {accounts.map((item) => <li className="flex items-center gap-3" key={item.platform}><PlatformTile size={32} type={item.platform} /><span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{PLATFORM_NAME[item.platform]}</span><span className="block truncate text-[13px] text-black/55">{item.handle}</span></span><span className="font-label text-[11px] tracking-[0.1em] text-black/45">NOT CONNECTED</span></li>)}
              </ul>
            ) : null}
            <p className="pt-4 text-[13px] leading-[1.5] text-black/60">Follower counts come from each platform once platform sign-in ships. Setuvara never asks you to type them.</p>
          </section>
        </div>
      </div>
    </StudioPage>
  );
}

function rangeStart(days: number) {
  return Date.now() - days * 86_400_000;
}

function Kpi({ label, value, detail, good = false }: { label: string; value: number | null; detail?: string; good?: boolean }) {
  return (
    <div>
      <dt className="text-[15px] text-black/70">{label}</dt>
      <dd className="mt-1 font-display text-[36px] font-bold leading-none tracking-[-0.05em] md:text-[40px]">{value === null ? "—" : value.toLocaleString("en")}</dd>
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
