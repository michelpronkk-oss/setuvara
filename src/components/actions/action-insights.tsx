import Link from "next/link";

import { PlusTag } from "@/app/app/identity/editor-ui";
import { PulseBars } from "@/components/app/pulse";
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

      <section className="relative isolate overflow-hidden rounded-[28px] bg-[#0D0D0D] p-5 text-[#F5F4EF] shadow-[0_30px_60px_-40px_#0D0D0D] md:p-6">
        <span aria-hidden="true" className="pointer-events-none absolute -left-20 -top-24 -z-10 size-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, #FF5A4F66, transparent 65%)" }} />
        <Mono className="mb-4 block text-[#F5F4EF]/55">Daily · {insights.days} days</Mono>
        <PulseBars days={daily.map((day) => day.day)} label={`${row.views} views, ${row.opens} opens and ${row.responses} responses over ${insights.days} days`} layers={[
          { label: "Views", color: "rgba(245,244,239,.22)", values: daily.map((day) => day.views) },
          { label: "Opens", color: "#F5F4EF", values: daily.map((day) => day.opens) },
          { label: steps[2].label, color: "#FF5A4F", values: daily.map((day) => day.responses) },
        ]} />
      </section>

      <p className="text-[13px] leading-[1.5] text-black/55">
        {conversion === null ? "Numbers start once people see this on your page." : `${percent(conversion, confirms ? row.confirmed : row.responses)} of people who saw the card ${confirms ? "confirmed" : "sent"}.`} Your own visits don&apos;t count. Views and opens are daily totals with no visitor details kept.
      </p>
    </div>
  );
}
