import type { AnalyticsData, ProAnalytics } from "@/lib/analytics/normalize";
import { dateSpan, scanTotal, type Format } from "@/lib/analytics/view";

const label = "font-label text-[11px] uppercase tracking-[0.14em]";
const sectionTitle = "font-display text-[30px] font-extrabold leading-none tracking-[-0.04em]";
const MODE: Record<ProAnalytics["modeFunnels"][number]["mode"], { name: string; color: string }> = {
  personal: { name: "Personal", color: "#FF5A4F" },
  event: { name: "Event", color: "#C7FF4A" },
  business: { name: "Business", color: "#AFCBFF" },
  creator: { name: "Creator", color: "#E8A6FF" },
};

/** Change against the previous period: a percentage when there is a base, "new" when there wasn't. */
export function changeOf(now: number, before: number): { text: string; tone: "up" | "down" | "flat" | "new" | "none" } {
  if (before === 0) return now === 0 ? { text: "—", tone: "none" } : { text: "New", tone: "new" };
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.5) return { text: "Level", tone: "flat" };
  const shown = Math.abs(pct) >= 10 ? Math.round(Math.abs(pct)).toString() : Math.abs(pct).toFixed(1).replace(/\.0$/, "");
  return { text: `${pct > 0 ? "▲" : "▼"} ${shown}%`, tone: pct > 0 ? "up" : "down" };
}

const TONE = { up: "bg-[#C7FF4A] text-[#0d0d0d]", new: "bg-[#C7FF4A] text-[#0d0d0d]", down: "bg-[#0d0d0d] text-[#f5f4ef]", flat: "bg-[#0d0d0d]/[0.08] text-[#0d0d0d]", none: "text-black/40" } as const;

/** This period against the one before it, metric by metric. Pro. */
export function PeriodCompare({ data, pro, fmt }: { data: AnalyticsData; pro: ProAnalytics; fmt: Format }) {
  const before = pro.previous;
  const rows = [
    { key: "views", label: "Profile views", now: data.summary.profileViews, before: before.profileViews },
    { key: "scans", label: "Scans and taps", now: scanTotal(data.summary), before: before.scans },
    { key: "connections", label: "Connections", now: data.summary.connections, before: before.connections },
  ];
  return (
    <section aria-labelledby="compare-title" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className={label}>Against the period before</span>
        <h2 className={sectionTitle} id="compare-title">Then and now.</h2>
        <p className="text-[14px] leading-[1.45]">{data.range ? dateSpan(data.range.start, data.range.end) : "This period"} against {dateSpan(before.from, before.to)}.</p>
      </div>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="font-label text-[10.5px] uppercase tracking-[0.12em] text-black/55">
            <th className="pb-2 font-normal" scope="col">Metric</th>
            <th className="pb-2 text-right font-normal" scope="col">Now</th>
            <th className="pb-2 text-right font-normal" scope="col">Before</th>
            <th className="pb-2 text-right font-normal" scope="col"><span className="sr-only">Change</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const change = changeOf(row.now, row.before);
            return (
              <tr className="border-t border-[#0d0d0d]/[0.12]" key={row.key}>
                <th className="py-3 pr-3 text-[16px] font-semibold" scope="row">{row.label}</th>
                <td className="py-3 text-right font-display text-[28px] font-extrabold tabular-nums tracking-[-0.04em]">{fmt(row.now)}</td>
                <td className="py-3 pl-3 text-right text-[16px] tabular-nums text-black/55">{fmt(row.before)}</td>
                <td className="py-3 pl-3 text-right"><span className={`inline-flex min-w-[58px] justify-center rounded-full px-2 py-1 font-label text-[11px] tracking-[0.04em] ${TONE[change.tone]}`}>{change.text}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/** The loop (views → shares → connections) for each Mode, with what share of views became a connection. Pro. */
export function ModeFunnels({ pro, fmt }: { pro: ProAnalytics; fmt: Format }) {
  const rows = pro.modeFunnels;
  const top = Math.max(1, ...rows.map((row) => row.profileViews));
  return (
    <section aria-labelledby="mode-loop-title" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className={label}>Your loop, by Mode</span>
        <h2 className={sectionTitle} id="mode-loop-title">{rows.length ? leadLine(rows) : "Which Mode turns views into people?"}</h2>
        <p className="text-[14px] leading-[1.45]">Views, shares and new connections for each Mode, and how many views became a connection.</p>
      </div>
      {rows.length === 0 ? <p className="text-[15px] text-black/65">No Mode activity in this period yet.</p> : (
        <ul className="flex flex-col">
          {rows.map((row) => {
            const rate = row.profileViews ? (row.connections / row.profileViews) * 100 : 0;
            return (
              <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-t border-[#0d0d0d]/[0.12] py-3.5" key={row.mode}>
                <span className="flex items-center gap-2 text-[16px] font-semibold"><span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: MODE[row.mode].color }} />{MODE[row.mode].name}</span>
                <span className="text-right font-label text-[12px] tabular-nums">{row.profileViews ? `${rate >= 10 ? Math.round(rate) : rate.toFixed(1).replace(/\.0$/, "")}% connect` : "—"}</span>
                <div aria-hidden="true" className="col-span-2 h-2 overflow-hidden rounded-full bg-[#0d0d0d]/[0.06]">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, (row.profileViews / top) * 100)}%`, background: MODE[row.mode].color }} />
                </div>
                <dl className="col-span-2 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px]">
                  <div className="flex gap-1.5"><dt className="text-black/55">Views</dt><dd className="font-semibold tabular-nums">{fmt(row.profileViews)}</dd></div>
                  <div className="flex gap-1.5"><dt className="text-black/55">Shares</dt><dd className="font-semibold tabular-nums">{fmt(row.shares)}</dd></div>
                  <div className="flex gap-1.5"><dt className="text-black/55">Connections</dt><dd className="font-semibold tabular-nums">{fmt(row.connections)}</dd></div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Names the Mode that converts best, or the one most people see when nobody connected yet. */
function leadLine(rows: ProAnalytics["modeFunnels"]) {
  const converting = rows.filter((row) => row.connections > 0 && row.profileViews > 0).sort((a, b) => b.connections / b.profileViews - a.connections / a.profileViews)[0];
  if (converting) return `${MODE[converting.mode].name} turns views into people.`;
  return `${MODE[rows[0].mode].name} gets the most eyes.`;
}
