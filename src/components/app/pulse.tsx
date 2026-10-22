import type { ReactNode } from "react";

/**
 * The one chart style inside /app (Analytics aside): a dark card, a big number, a smooth line
 * that draws in, tinted with the Mode's colour. Bars use the same card for daily counts.
 */

const MOTION = `.pulse-draw{stroke-dasharray:3000;stroke-dashoffset:3000;animation:pulse-draw 1.6s cubic-bezier(.65,0,.35,1) .1s forwards}.pulse-fade{opacity:0;animation:pulse-fade 1s ease-out .8s forwards}.pulse-rise{transform-origin:bottom;transform-box:fill-box;animation:pulse-rise .9s cubic-bezier(.2,.8,.2,1) both}@keyframes pulse-draw{to{stroke-dashoffset:0}}@keyframes pulse-fade{to{opacity:1}}@keyframes pulse-rise{from{transform:scaleY(0)}}@media (prefers-reduced-motion:reduce){.pulse-draw,.pulse-fade,.pulse-rise{animation:none;stroke-dashoffset:0;opacity:1}}`;

export { PulseLine, type PulsePoint } from "./pulse-line";

export type BarLayer = { label: string; color: string; values: number[] };

/**
 * Daily counts as bars: `layers` overlap upward from the baseline (biggest first), `below` mirrors
 * one series under it (joined above, left below).
 */
export function PulseBars({ layers, below, label, days }: { layers: BarLayer[]; below?: BarLayer; label: string; days?: string[] }) {
  const n = Math.max(...layers.map((l) => l.values.length), below?.values.length ?? 0, 1);
  const max = Math.max(1, ...layers.flatMap((l) => l.values), ...(below?.values ?? []));
  const W = 800;
  const base = below ? 84 : 116;
  const up = base - 4;
  const width = W / n;
  const bar = Math.max(Math.min(width * 0.5, 14), 1.5);
  return (
    <figure>
      <svg aria-label={label} className="h-[130px] w-full md:h-[150px]" preserveAspectRatio="none" role="img" viewBox={`0 0 ${W} 120`}>
        <line stroke="#F5F4EF" strokeOpacity="0.15" vectorEffect="non-scaling-stroke" x1="0" x2={W} y1={base} y2={base} />
        {Array.from({ length: n }, (_, index) => {
          const x = index * width + (width - bar) / 2;
          return (
            <g className="pulse-rise" key={index} style={{ animationDelay: `${Math.min(index * 12, 500)}ms` }}>
              {days?.[index] && <title>{days[index]}</title>}
              {layers.map((layer) => { const v = layer.values[index] ?? 0; return v > 0 ? <rect fill={layer.color} height={Math.max(2, (v / max) * up)} key={layer.label} rx="1.5" width={bar} x={x} y={base - Math.max(2, (v / max) * up)} /> : null; })}
              {below && (below.values[index] ?? 0) > 0 && <rect fill={below.color} height={Math.max(2, ((below.values[index] ?? 0) / max) * 32)} rx="1.5" width={bar} x={x} y={base + 1} />}
            </g>
          );
        })}
        <style>{MOTION}</style>
      </svg>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[#F5F4EF]/60">
        {[...layers, ...(below ? [below] : [])].map((l) => <span className="flex items-center gap-1.5" key={l.label}><span aria-hidden="true" className="size-2 rounded-full" style={{ background: l.color }} />{l.label}</span>)}
      </figcaption>
    </figure>
  );
}

/** Up/down chip next to a big number. */
export function DeltaChip({ delta, suffix = "vs previous" }: { delta: number | null; suffix?: string }) {
  if (delta === null || !Number.isFinite(delta)) return null;
  return <span className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold" style={delta >= 0 ? { background: "#C7FF4A", color: "#0D0D0D" } : { boxShadow: "inset 0 0 0 1px rgba(245,244,239,.25)" }}>{delta >= 0 ? "▲" : "▼"} {Math.abs(Math.round(delta))}% {suffix}</span>;
}

/** The dark card: eyebrow, big value, chart, story, and optional side rows. */
export function PulseCard({ eyebrow, value, after, tone, chart, story, rows, label, className = "" }: {
  eyebrow: ReactNode; value: ReactNode; after?: ReactNode; tone: string; chart?: ReactNode; story?: ReactNode;
  rows?: { label: string; value: ReactNode; note?: string }[]; label: string; className?: string;
}) {
  return (
    <section aria-label={label} className={`relative isolate grid gap-6 overflow-hidden rounded-[28px] bg-[#0D0D0D] p-6 text-[#F5F4EF] shadow-[0_30px_60px_-40px_#0D0D0D] md:p-8 ${rows?.length ? "xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : ""} ${className}`}>
      <span aria-hidden="true" className="pointer-events-none absolute -left-24 -top-28 -z-10 size-96 rounded-full opacity-50 blur-3xl" style={{ background: `radial-gradient(circle, ${tone}80, transparent 65%)` }} />
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-label text-[10.5px] uppercase tracking-[0.16em] text-[#F5F4EF]/55">{eyebrow}</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-3">
          <span className="font-display text-[64px] font-bold leading-none tracking-[-0.06em] tabular-nums md:text-[80px]">{value}</span>
          {after}
        </p>
        {chart && <div className="mt-8">{chart}</div>}
        {story && <p className="mt-5 border-t border-[#F5F4EF]/10 pt-4 text-[14px] leading-[1.5] text-[#F5F4EF]/65">{story}</p>}
      </div>
      {!!rows?.length && (
        <dl className="grid content-end gap-2">
          {rows.map((row) => (
            <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[#F5F4EF]/[0.06] px-4 py-3" key={row.label}>
              <dt><span className="block text-[14px] font-semibold">{row.label}</span>{row.note && <span className="block text-[12px] text-[#F5F4EF]/50">{row.note}</span>}</dt>
              <dd className="font-display text-[30px] font-bold leading-none tracking-[-0.05em] tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
