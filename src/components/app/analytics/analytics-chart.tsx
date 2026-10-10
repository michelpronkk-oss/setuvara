"use client";

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";

import type { AnalyticsDailyPoint, AnalyticsRangeKind } from "@/lib/analytics/normalize";
import { axisLabels, barReadout, chartBars, chartSummary, growthTitle, type Format } from "@/lib/analytics/view";

const label = "font-label text-[11px] uppercase tracking-[0.14em]";

/**
 * One growth chart: profile views as ink bars, the latest in Coral, and a Coral dot
 * under every day someone connected. No gridlines, no y-axis, three dates.
 */
export function GrowthChart({ daily, kind, delta, fmt }: { daily: AnalyticsDailyPoint[]; kind: AnalyticsRangeKind; delta: number | null | undefined; fmt: Format }) {
  const { bars, unit } = useMemo(() => chartBars(daily), [daily]);
  const [selected, setSelected] = useState<number | null>(null);
  const summaryId = useId();
  const readoutId = useId();
  const max = Math.max(0, ...bars.map((bar) => bar.views));
  const gap = bars.length > 30 ? 1 : 3;
  const title = growthTitle(kind, delta);
  const active = selected !== null && bars[selected] ? bars[selected] : null;
  const legend = (
    <div className="flex flex-wrap gap-[18px] text-[13px]">
      <span className="flex items-center gap-[7px]"><span aria-hidden="true" className="size-2.5 rounded-[2px] bg-[#0d0d0d]" />Profile views</span>
      <span className="flex items-center gap-[7px]"><span aria-hidden="true" className="size-2 rounded-full bg-[#ff5a4f]" />Days someone connected</span>
    </div>
  );

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!bars.length || box.width <= 0) return;
    const index = Math.floor(((event.clientX - box.left) / box.width) * bars.length);
    setSelected(Math.max(0, Math.min(bars.length - 1, index)));
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!bars.length) return;
    const last = bars.length - 1;
    const next = event.key === "ArrowRight" ? Math.min(last, (selected ?? -1) + 1)
      : event.key === "ArrowLeft" ? Math.max(0, (selected ?? bars.length) - 1)
        : event.key === "Home" ? 0
          : event.key === "End" ? last
            : event.key === "Escape" ? null
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setSelected(next);
  };

  return (
    <section aria-labelledby={`${summaryId}-title`} className="flex min-w-0 flex-col gap-4 lg:gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-baseline lg:justify-between lg:gap-6">
        <div className="flex flex-col gap-2">
          <span className={`${label} lg:hidden`}>Over time</span>
          <h2 className="font-display text-[30px] font-extrabold leading-none tracking-[-0.04em]" id={`${summaryId}-title`}>{title}</h2>
        </div>
        <div className="hidden lg:block">{legend}</div>
      </div>
      {bars.length === 0 ? (
        <p className="border-b-[1.5px] border-[#0d0d0d] pb-4 text-[15px] text-black/65">No daily activity in this period yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p aria-live="polite" className="min-h-4 font-label text-[11px] tracking-[0.06em]" data-chart-readout="" id={readoutId}>{active ? barReadout(active, unit, fmt) : ""}</p>
          <div
            aria-describedby={summaryId}
            aria-label={`Profile views over time. Use the arrow keys to read each ${unit}.`}
            className="relative touch-pan-y rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff5a4f]"
            onBlur={() => setSelected(null)}
            onKeyDown={onKey}
            onPointerDown={pick}
            onPointerLeave={(event) => { if (event.pointerType === "mouse") setSelected(null); }}
            onPointerMove={(event) => { if (event.pointerType === "mouse") pick(event); }}
            role="group"
            tabIndex={0}
          >
            <div aria-hidden="true" className="flex h-[150px] items-end border-b-[1.5px] border-[#0d0d0d] lg:h-[300px]" style={{ gap }}>
              {bars.map((bar, index) => {
                const height = max > 0 ? Math.max(bar.views > 0 ? 2 : 0, (bar.views / max) * 100) : 0;
                const latest = index === bars.length - 1;
                const dim = active !== null && selected !== index;
                return (
                  <div className="flex h-full min-w-0 flex-1 items-end" key={bar.key}>
                    <div className={`w-full rounded-t-[2px] transition-opacity ${latest ? "bg-[#ff5a4f]" : "bg-[#0d0d0d]"} ${dim ? "opacity-30" : ""}`} style={{ height: height > 0 ? `${height}%` : "1.5px", opacity: height > 0 ? undefined : 0.15 }} />
                  </div>
                );
              })}
            </div>
            <div aria-hidden="true" className="mt-2 flex h-2.5" style={{ gap }}>
              {bars.map((bar) => (
                <div className="flex min-w-0 flex-1 justify-center" key={bar.key}>
                  {bar.connections > 0 && <span className={`shrink-0 rounded-full bg-[#ff5a4f] ${bar.connections > 1 ? "size-[7px]" : "size-[5px]"}`} />}
                </div>
              ))}
            </div>
          </div>
          <div aria-hidden="true" className="flex justify-between font-label text-[11px] tracking-[0.06em]">
            {axisLabels(bars).map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
          </div>
          <p className="sr-only" id={summaryId}>{chartSummary(bars, unit, fmt)}</p>
        </div>
      )}
      <div className="lg:hidden">{legend}</div>
    </section>
  );
}
