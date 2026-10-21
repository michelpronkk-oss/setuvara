import Link from "next/link";

import { PlusTag } from "@/app/app/identity/editor-ui";
import { Mono } from "@/components/creator/studio-ui";
import { isConfirmedKind, rate, type ActionInsights, type ActionKind } from "@/lib/actions/model";

const WINDOWS = [7, 30, 90, 365];
/** "<1%" rather than "0%" once anyone has made it through. */
const percent = (share: number, part: number) => (share === 0 && part > 0 ? "<1%" : `${share}%`);

/**
 * One Action's funnel: how many saw the card, opened its page, sent, and (for Newsletters and
 * Giveaways) confirmed by email. Views and opens are plain daily counts, kept without any visitor id.
 */
export function ActionInsightsView({ kind, insights }: { kind: ActionKind; insights: ActionInsights | null }) {
  if (!insights) return <p className="rounded-[24px] bg-white p-6 text-[15px] text-black/60 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)]">Insights need a database update that hasn&apos;t reached this site yet.</p>;
  const row = insights.actions[0] ?? { views: 0, opens: 0, responses: 0, confirmed: 0 };
  const confirms = isConfirmedKind(kind);
  const steps = [
    { label: "Saw the card", value: row.views, of: null as number | null },
    { label: "Opened it", value: row.opens, of: row.views },
    { label: kind === "newsletter" ? "Signed up" : kind === "giveaway" ? "Entered" : "Sent", value: row.responses, of: row.opens },
    ...(confirms ? [{ label: "Confirmed", value: row.confirmed, of: row.responses }] : []),
  ];
  const daily = insights.daily ?? [];
  const peak = Math.max(1, ...daily.map((day) => Math.max(day.views, day.opens)));
  const bar = 6;
  const gap = daily.length > 120 ? 1 : 3;
  const total = Math.max(1, daily.length * (bar + gap));
  const conversion = rate(confirms ? row.confirmed : row.responses, row.views);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Window" className="inline-flex gap-1 rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]">
          {WINDOWS.map((value) => {
            const allowed = value <= insights.plan_days;
            const on = value === insights.days;
            return allowed
              ? <Link aria-current={on ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-semibold transition ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "text-black/60 hover:text-black"}`} href={`?tab=insights&days=${value}`} key={value} scroll={false}>{value === 365 ? "1 year" : `${value} days`}</Link>
              : <span aria-disabled="true" className="inline-flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-semibold text-black/30" key={value}>{value === 365 ? "1 year" : `${value} days`}</span>;
          })}
        </nav>
        {insights.plan_days < 365 && <span className="flex items-center gap-2 text-[13px] text-black/60"><PlusTag label={insights.plan_days < 90 ? "Plus" : "Pro"} />{insights.plan_days < 90 ? "keeps 90 days" : "keeps a year"}</span>}
      </div>

      <ol className={`grid grid-cols-2 gap-3 ${confirms ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        {steps.map((step) => {
          const share = step.of === null ? null : rate(step.value, step.of);
          return (
            <li className="rounded-[24px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)] md:p-5" key={step.label}>
              <Mono className="text-black/55">{step.label}</Mono>
              <p className="mt-2 font-display text-[36px] font-bold leading-none tracking-[-0.05em] md:text-[44px]">{step.value.toLocaleString("en")}</p>
              <p className="mt-1 text-[13px] text-black/60">{step.of === null ? `last ${insights.days} days` : share === null ? "—" : `${percent(share, step.value)} of the step before`}</p>
            </li>
          );
        })}
      </ol>

      <figure className="rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)] md:p-6">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
          <Mono className="text-black/55">Daily · {insights.days} days</Mono>
          <span className="flex items-center gap-3 text-[13px] text-black/60">
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-black/20" />Views</span>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-[#0D0D0D]" />Opens</span>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-[#FF5A4F]" />{steps[2].label}</span>
          </span>
        </figcaption>
        <svg aria-label={`${row.views} views, ${row.opens} opens and ${row.responses} responses over ${insights.days} days`} className="mt-4 h-[140px] w-full" preserveAspectRatio="none" role="img" viewBox={`0 0 ${total} 100`}>
          <line stroke="rgba(13,13,13,.12)" strokeWidth=".6" vectorEffect="non-scaling-stroke" x1="0" x2={total} y1="99" y2="99" />
          {daily.map((day, index) => {
            const x = index * (bar + gap);
            return (
              <g key={day.day}>
                <title>{`${day.day}: ${day.views} views, ${day.opens} opens, ${day.responses} ${steps[2].label.toLowerCase()}`}</title>
                {day.views > 0 && <rect fill="rgba(13,13,13,.16)" height={(day.views / peak) * 96} rx="1" width={bar} x={x} y={99 - (day.views / peak) * 96} />}
                {day.opens > 0 && <rect fill="#0D0D0D" height={(day.opens / peak) * 96} rx="1" width={bar} x={x} y={99 - (day.opens / peak) * 96} />}
                {day.responses > 0 && <rect fill="#FF5A4F" height={Math.max(3, (Math.min(day.responses, peak) / peak) * 96)} rx="1" width={bar} x={x} y={99 - Math.max(3, (Math.min(day.responses, peak) / peak) * 96)} />}
              </g>
            );
          })}
        </svg>
        <div className="mt-2 flex justify-between font-label text-[10px] uppercase tracking-[0.12em] text-black/40"><span>{daily[0]?.day.slice(5) ?? ""}</span><span>Today</span></div>
      </figure>

      <p className="text-[13px] leading-[1.5] text-black/55">
        {conversion === null ? "Numbers start once people see this on your page." : `${percent(conversion, confirms ? row.confirmed : row.responses)} of people who saw the card ${confirms ? "confirmed" : "sent"}.`} Your own visits don&apos;t count. Views and opens are daily totals with no visitor details kept.
      </p>
    </div>
  );
}
