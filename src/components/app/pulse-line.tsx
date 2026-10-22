"use client";

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type PulsePoint = {
  /** ISO day (yyyy-mm-dd) or a short label. */
  date: string;
  value: number;
  /** What else happened that day, shown in the tooltip and marked on the line. */
  notes?: string[];
};

const W = 800;
const H = 220;
const TOP = 18;
const BOTTOM = 10;

/**
 * Monotone cubic through the points (Fritsch–Carlson): smooth like a spline, but it never swings
 * above a peak or below zero between days.
 */
function monotonePath(pts: readonly (readonly [number, number])[]) {
  const n = pts.length;
  if (n < 2) return "";
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const slope = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
  const tangent = pts.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    if (slope[i - 1] * slope[i] <= 0) return 0;
    const w1 = 2 * dx[i] + dx[i - 1];
    const w2 = dx[i] + 2 * dx[i - 1];
    return (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
  });
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + h * tangent[i]} ${pts[i + 1][0] - h},${pts[i + 1][1] - h * tangent[i + 1]} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

function dayLabel(date: string, long = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", long ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * The /app line: draws in, tinted with the Mode's colour, with day labels underneath. Hover, touch
 * or arrow keys move a marker along it and show that day's number and anything that happened.
 */
export function PulseLine({ points, tone, label, unit = ["", ""], className = "h-[150px] md:h-[180px]" }: {
  points: PulsePoint[]; tone: string; label: string; unit?: [singular: string, plural: string]; className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  if (points.length < 2) return <p className="text-[14px] text-[#F5F4EF]/55">Not enough days yet.</p>;

  const max = Math.max(...points.map((p) => p.value), 1);
  const pts = points.map((p, i) => [(i / (points.length - 1)) * W, H - BOTTOM - (p.value / max) * (H - TOP - BOTTOM)] as const);
  const d = monotonePath(pts);
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  // Mark the busiest day, and days where something happened when there are few enough to read.
  const noted = points.map((p, i) => (p.notes?.length ? i : -1)).filter((i) => i >= 0);
  const marked = [...new Set([...(noted.length <= 6 ? noted : []), ...(points[peak].value > 0 ? [peak] : [])])];

  function pick(event: PointerEvent<HTMLDivElement>) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect?.width) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setActive(Math.round(ratio * (points.length - 1)));
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setActive((current) => Math.min(points.length - 1, Math.max(0, (current ?? points.length - 1) + (event.key === "ArrowRight" ? 1 : -1))));
  }

  const point = active === null ? null : points[active];
  const x = active === null ? 0 : (active / (points.length - 1)) * 100;
  const y = active === null ? 0 : (pts[active][1] / H) * 100;
  const notes = point ? [...(point.notes ?? []), ...(active === peak && point.value > 0 ? ["Busiest day"] : [])] : [];

  return (
    <div>
      <div
        aria-label={`${label}. Use the arrow keys to read each day.`}
        className={`relative touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-[#F5F4EF]/40 focus-visible:ring-offset-8 focus-visible:ring-offset-[#0D0D0D] rounded-[6px] ${className}`}
        onBlur={() => setActive(null)}
        onKeyDown={key}
        onPointerDown={pick}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") setActive(null); }}
        onPointerMove={pick}
        ref={box}
        role="img"
        tabIndex={0}
      >
        <svg aria-hidden="true" className="absolute inset-0 size-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={tone} stopOpacity="0.32" /><stop offset="100%" stopColor={tone} stopOpacity="0" /></linearGradient>
            <linearGradient id={`${id}-line`} x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor={tone} stopOpacity="0.5" /><stop offset="100%" stopColor={tone} /></linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => <line key={f} stroke="#F5F4EF" strokeDasharray="2 6" strokeOpacity="0.09" vectorEffect="non-scaling-stroke" x1="0" x2={W} y1={TOP + (H - TOP - BOTTOM) * f} y2={TOP + (H - TOP - BOTTOM) * f} />)}
          <line stroke="#F5F4EF" strokeOpacity="0.14" vectorEffect="non-scaling-stroke" x1="0" x2={W} y1={H - BOTTOM} y2={H - BOTTOM} />
          <path className="pulse-fade" d={`${d} L${W},${H - BOTTOM} L0,${H - BOTTOM} Z`} fill={`url(#${id}-fill)`} />
          <path className="pulse-draw" d={d} fill="none" stroke={`url(#${id}-line)`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.75" vectorEffect="non-scaling-stroke" />
          {active !== null && <line stroke="#F5F4EF" strokeOpacity="0.35" vectorEffect="non-scaling-stroke" x1={pts[active][0]} x2={pts[active][0]} y1={TOP - 8} y2={H - BOTTOM} />}
        </svg>
        {/* Dots sit outside the stretched SVG so they stay round. */}
        {marked.map((i) => (
          <span aria-hidden="true" className="pulse-fade pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-[#0D0D0D]" key={i} style={{ left: `${(i / (points.length - 1)) * 100}%`, top: `${(pts[i][1] / H) * 100}%`, background: tone }} />
        ))}
        {point && (
          <>
            <span aria-hidden="true" className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F5F4EF] ring-4" style={{ left: `${x}%`, top: `${y}%`, ["--tw-ring-color" as string]: `${tone}55` }} />
            <div className="pointer-events-none absolute z-10 w-max max-w-[220px] rounded-[14px] bg-[#F5F4EF] px-3 py-2 text-[#0D0D0D] shadow-[0_18px_40px_-16px_#000]" role="status" style={{ left: `${x}%`, top: `calc(${y}% - 16px)`, transform: `translate(${x < 18 ? "-8%" : x > 82 ? "-92%" : "-50%"}, -100%)` }}>
              <p className="font-label text-[9.5px] uppercase tracking-[0.14em] text-black/50">{dayLabel(point.date, true)}</p>
              <p className="mt-0.5 font-display text-[22px] font-bold leading-none tracking-[-0.04em] tabular-nums">{point.value.toLocaleString("en")}<span className="ml-1.5 font-sans text-[12.5px] font-medium tracking-normal text-black/55">{point.value === 1 ? unit[0] : unit[1]}</span></p>
              {notes.map((note) => <p className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-black/70" key={note}><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: tone === "#C7FF4A" ? "#0D0D0D" : tone }} />{note}</p>)}
            </div>
          </>
        )}
      </div>
      <div aria-hidden="true" className="mt-3 flex justify-between font-label text-[10px] uppercase tracking-[0.14em] text-[#F5F4EF]/40">
        <span>{dayLabel(points[0].date)}</span>
        {points.length > 4 && <span className="hidden sm:inline">{dayLabel(points[Math.floor((points.length - 1) / 2)].date)}</span>}
        <span>{dayLabel(points[points.length - 1].date)}</span>
      </div>
      <style>{`.pulse-draw{stroke-dasharray:3000;stroke-dashoffset:3000;animation:pulse-draw 1.6s cubic-bezier(.65,0,.35,1) .1s forwards}.pulse-fade{opacity:0;animation:pulse-fade .8s ease-out 1s forwards}@keyframes pulse-draw{to{stroke-dashoffset:0}}@keyframes pulse-fade{to{opacity:1}}@media (prefers-reduced-motion:reduce){.pulse-draw,.pulse-fade{animation:none;stroke-dashoffset:0;opacity:1}}`}</style>
    </div>
  );
}
