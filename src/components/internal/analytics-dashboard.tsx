"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

const countSchema = z.number().int().nonnegative().safe();
const analyticsSchema = z.object({
  range: z.object({ start: z.string().min(1).max(64), end: z.string().min(1).max(64) }).strict(),
  totals: z.object({
    guestConnections: countSchema,
    guestClaims: countSchema,
    identitiesCreated: countSchema,
    identityCompleted: countSchema,
    firstShares: countSchema,
    repeatShares: countSchema,
    newConnectionsAfterFirstShare: countSchema,
  }).strict(),
  sourceBreakdown: z.array(z.object({ source: z.string().min(1).max(60), count: countSchema }).strict()).max(30),
  modeBreakdown: z.array(z.object({ mode: z.string().min(1).max(40), count: countSchema }).strict()).max(20),
  daily: z.array(z.object({
    date: z.string().min(1).max(64),
    guestConnections: countSchema,
    claims: countSchema,
    identityCompleted: countSchema,
    firstShares: countSchema,
    repeatShares: countSchema,
  }).strict()).max(90),
}).strict();

type AnalyticsData = z.infer<typeof analyticsSchema>;

const metrics: { key: keyof AnalyticsData["totals"]; label: string; note: string }[] = [
  { key: "guestConnections", label: "Guest connections", note: "Started before sign-in" },
  { key: "guestClaims", label: "Guest claims", note: "Claimed after account creation" },
  { key: "identitiesCreated", label: "Identities created", note: "New Setuvara accounts" },
  { key: "identityCompleted", label: "Identity completed", note: "Reached the completion milestone" },
  { key: "firstShares", label: "First shares", note: "First profile share per identity" },
  { key: "repeatShares", label: "Repeat shares", note: "Additional profile shares" },
  { key: "newConnectionsAfterFirstShare", label: "Connections after first share", note: "New connections following a first share" },
];

const numberFormat = new Intl.NumberFormat();

export function InternalAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/internal/analytics", {
        method: "GET",
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error("analytics_unavailable");
      const parsed = analyticsSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("invalid_analytics_response");
      setData(parsed.data);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className="min-h-dvh bg-[#f5f4ef] px-4 py-8 text-[#0d0d0d] sm:px-7 sm:py-10 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-black/15 pb-6">
          <div>
            <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-black/55">Setuvara · Internal</p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.06em] sm:text-5xl">Product analytics</h1>
            <p className="mt-2 text-sm text-black/60">Aggregate activity across the Setuvara journey.</p>
          </div>
          <div className="flex items-center gap-3">
            {data && <p className="text-xs text-black/55">{formatRange(data.range.start, data.range.end)}</p>}
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/20 px-4 text-sm font-semibold transition hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
              disabled={loading}
              onClick={() => void load()}
              type="button"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>

        {loading && !data ? (
          <section aria-live="polite" className="mt-8 rounded-[24px] border border-black/10 bg-white p-6 text-sm text-black/60" role="status">
            Loading aggregate analytics…
          </section>
        ) : error || !data ? (
          <section aria-live="polite" className="mt-8 rounded-[24px] border border-black/10 bg-white p-6 sm:p-8" role="status">
            <h2 className="font-display text-2xl font-bold tracking-[-0.04em]">Analytics are unavailable right now.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-black/60">The dashboard could not load the aggregate report. Your access remains private; try again in a moment.</p>
            <button className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#0d0d0d] px-5 text-sm font-semibold text-[#f5f4ef] focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => void load()} type="button">Try again</button>
          </section>
        ) : (
          <>
            <section aria-label="Aggregate totals" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <article className="min-h-[148px] rounded-[22px] border border-black/10 bg-white p-5" key={metric.key}>
                  <p className="font-label text-[10px] font-semibold uppercase tracking-[0.16em] text-black/55">{metric.label}</p>
                  <p className="mt-5 font-display text-[40px] font-bold leading-none tracking-[-0.06em]">{numberFormat.format(data.totals[metric.key])}</p>
                  <p className="mt-2 text-xs text-black/55">{metric.note}</p>
                </article>
              ))}
            </section>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Breakdown title="Connection sources" items={data.sourceBreakdown.map(({ source, count }) => ({ label: source, count }))} empty="No source activity in this range." />
              <Breakdown title="Shared Modes" items={data.modeBreakdown.map(({ mode, count }) => ({ label: mode, count }))} empty="No Mode activity in this range." />
            </div>

            <section className="mt-4 overflow-hidden rounded-[22px] border border-black/10 bg-white">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/10 px-5 py-4 sm:px-6">
                <div>
                  <p className="font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-black/50">Journey activity</p>
                  <h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">Daily totals</h2>
                </div>
                <p className="text-xs text-black/55">{data.daily.length} days</p>
              </div>
              {data.daily.length === 0 ? (
                <p className="px-5 py-8 text-sm text-black/55 sm:px-6">No daily activity in this range.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[740px] border-collapse text-left text-sm">
                    <thead className="bg-black/[0.025] text-[10px] font-semibold uppercase tracking-[0.13em] text-black/50">
                      <tr>
                        <th className="px-5 py-3 sm:px-6">Date</th>
                        <th className="px-4 py-3 text-right">Guest connections</th>
                        <th className="px-4 py-3 text-right">Claims</th>
                        <th className="px-4 py-3 text-right">Completed</th>
                        <th className="px-4 py-3 text-right">First shares</th>
                        <th className="px-5 py-3 text-right sm:px-6">Repeat shares</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.daily].reverse().map((day) => (
                        <tr className="border-t border-black/[0.07]" key={day.date}>
                          <th className="whitespace-nowrap px-5 py-3 font-medium sm:px-6">{formatDate(day.date)}</th>
                          <Cell value={day.guestConnections} />
                          <Cell value={day.claims} />
                          <Cell value={day.identityCompleted} />
                          <Cell value={day.firstShares} />
                          <Cell value={day.repeatShares} last />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <p className="mt-4 text-xs leading-5 text-black/45">This view contains aggregate counts only. It does not display member identities or raw event records.</p>
          </>
        )}
      </div>
    </main>
  );
}

function Breakdown({ title, items, empty }: { title: string; items: { label: string; count: number }[]; empty: string }) {
  const largest = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="rounded-[22px] border border-black/10 bg-white p-5 sm:p-6">
      <h2 className="font-display text-2xl font-bold tracking-[-0.04em]">{title}</h2>
      {items.length === 0 ? <p className="mt-5 text-sm text-black/55">{empty}</p> : (
        <ul className="mt-5 space-y-4">
          {items.map((item) => (
            <li key={item.label}>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="truncate font-medium">{item.label}</span>
                <span className="shrink-0 tabular-nums text-black/60">{numberFormat.format(item.count)}</span>
              </div>
              <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
                <div className="h-full rounded-full bg-[#ff5a4f]" style={{ width: `${Math.min(100, (item.count / largest) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Cell({ value, last = false }: { value: number; last?: boolean }) {
  return <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums text-black/70 ${last ? "pr-5 sm:pr-6" : ""}`}>{numberFormat.format(value)}</td>;
}

function formatRange(start: string, end: string) {
  const first = formatDate(start);
  const last = formatDate(end);
  return first === last ? first : `${first} – ${last}`;
}

function formatDate(value: string) {
  const datePart = value.slice(0, 10);
  const date = new Date(`${datePart}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? datePart
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}
