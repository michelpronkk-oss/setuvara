import Link from "next/link";

import { analyticsCapabilities } from "@/lib/analytics/capabilities";
import { resolveAnalyticsQuery } from "@/lib/analytics/range";
import { getProfileAnalyticsReport } from "@/lib/analytics/server";
import type { PlanCode } from "@/lib/billing/catalog";

/** The last seven days across every Mode, in three numbers, with the way into Analytics. */
export async function PulseSection({ userId, plan, isPublished }: { userId: string; plan: PlanCode; isPublished: boolean }) {
  const query = resolveAnalyticsQuery(new URLSearchParams({ range: "7d" }), analyticsCapabilities(plan));
  if (!query.ok) return null;
  let summary;
  try { summary = (await getProfileAnalyticsReport({ profileId: userId, plan, query: query.data })).summary; }
  catch { return null; }
  const scans = summary.qrScans + summary.quickQrScans + summary.tapScans;
  const quiet = summary.profileViews + scans + summary.connections === 0;
  const stats = [
    { label: "Profile views", value: summary.profileViews },
    { label: "Scans and taps", value: scans },
    { label: "New connections", value: summary.connections },
  ];

  return (
    <section aria-labelledby="sv-pulse" className="rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.035em]" id="sv-pulse">Last 7 days</h2>
        <Link className="text-[13px] font-semibold underline decoration-black/25 underline-offset-4 hover:decoration-black focus-visible:outline-2" href="/app/analytics">Analytics →</Link>
      </div>
      {quiet ? (
        <p className="mt-3 text-[14px] leading-6 text-black/55">{isPublished ? "Quiet week. Share your QR at the next thing you go to and it shows here." : "Views, scans and connections show here once your Setuvara is published."}</p>
      ) : (
        <dl className="mt-4 grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div className="min-w-0" key={stat.label}>
              <dt className="truncate text-[12.5px] text-black/55">{stat.label}</dt>
              <dd className="mt-1 font-display text-[30px] font-bold leading-none tracking-[-0.04em] tabular-nums">{stat.value.toLocaleString("en")}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
