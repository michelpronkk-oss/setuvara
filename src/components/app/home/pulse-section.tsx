import Link from "next/link";

import { analyticsCapabilities } from "@/lib/analytics/capabilities";
import { resolveAnalyticsQuery } from "@/lib/analytics/range";
import { getProfileAnalyticsReport } from "@/lib/analytics/server";
import type { PlanCode } from "@/lib/billing/catalog";

/**
 * Against the seven days before, in the words the Monday digest uses. The report gives a delta
 * only when the week before had something; nothing then and something now reads as "New".
 */
function weekChange(now: number, delta: number | null | undefined): { text: string; up: boolean } | null {
  if (delta === undefined) return null;
  if (delta === null) return now > 0 ? { text: "New", up: true } : null;
  const pct = Math.round(delta);
  if (pct === 0) return { text: "Level", up: false };
  return { text: `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}%`, up: pct > 0 };
}

/** The last seven days across every Mode, in three numbers, with the way into Analytics. */
export async function PulseSection({ userId, plan, isPublished }: { userId: string; plan: PlanCode; isPublished: boolean }) {
  const query = resolveAnalyticsQuery(new URLSearchParams({ range: "7d" }), analyticsCapabilities(plan));
  if (!query.ok) return null;
  let report;
  try { report = await getProfileAnalyticsReport({ profileId: userId, plan, query: query.data }); }
  catch { return null; }
  const { summary, comparison } = report;
  const scans = summary.qrScans + summary.quickQrScans + summary.tapScans;
  const quiet = summary.profileViews + scans + summary.connections === 0;
  const stats = [
    { label: "Views", value: summary.profileViews, change: comparison ? weekChange(summary.profileViews, comparison.profileViewsDelta) : null },
    { label: "Scans", value: scans, change: null },
    { label: "Connections", value: summary.connections, change: comparison ? weekChange(summary.connections, comparison.connectionsDelta) : null },
  ];
  const lead = stats[0].change;

  return (
    <section aria-labelledby="sv-pulse" className="rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.035em]" id="sv-pulse">This week</h2>
        <Link className="text-[13px] font-semibold underline decoration-black/25 underline-offset-4 hover:decoration-black focus-visible:outline-2" href="/app/analytics">Analytics →</Link>
      </div>
      {quiet ? (
        <p className="mt-3 text-[14px] leading-6 text-black/55">{isPublished ? "Quiet week. Share your QR at the next thing you go to and it shows here." : "Views, scans and connections show here once your Setuvara is published."}</p>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-black/55">{lead && lead.text !== "New" && lead.text !== "Level" ? `Views are ${lead.text.toLowerCase()} on the 7 days before.` : "The last 7 days, against the 7 before."}</p>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {stats.map((stat) => (
              <div className="min-w-0" key={stat.label}>
                <dt className="truncate text-[12.5px] text-black/55">{stat.label}</dt>
                <dd className="mt-1 font-display text-[30px] font-bold leading-none tracking-[-0.04em] tabular-nums">{stat.value.toLocaleString("en")}</dd>
                {stat.change && <dd className={`mt-2 inline-flex rounded-full px-2 py-0.5 font-label text-[10.5px] tracking-[0.04em] ${stat.change.up ? "bg-[#C7FF4A] text-[#0D0D0D]" : "bg-[#0D0D0D]/[0.07] text-[#0D0D0D]"}`}>{stat.change.text}</dd>}
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
