import type { PublicRevenue } from "@/lib/builder/model";

const label = "font-label text-[10px] uppercase tracking-[0.2em]";
const line = "color-mix(in srgb, currentColor 12%, transparent)";
export const PROVIDER_LABEL: Record<PublicRevenue["provider"], string> = { stripe: "Stripe", revenuecat: "RevenueCat", dodo: "Dodo Payments", paddle: "Paddle" };

export function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(minor / 100);
}
const compact = (minor: number, currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase(), notation: "compact", maximumFractionDigits: 1 }).format(minor / 100);
const BAND: Record<string, string> = { "<1k": "Under 1k", "1k-5k": "1k–5k", "5k-10k": "5k–10k", "10k-25k": "10k–25k", "25k-50k": "25k–50k", "50k-100k": "50k–100k", "100k-250k": "100k–250k", "250k-1m": "250k–1M", "1m+": "1M+" };

const W = 320;
const H = 88;
const PAD = 6;

/** A smooth line through the points (Catmull-Rom as cubic Béziers), plus the area under it. */
function paths(values: number[]) {
  const series = values.length > 1 ? values : [0.55, 0.55];
  const pts = series.map((v, i) => [(i / (series.length - 1)) * W, PAD + (1 - Math.max(0, Math.min(1, v))) * (H - PAD * 2)] as const);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return { line: d, area: `${d} L${W},${H} L0,${H} Z`, end: pts[pts.length - 1] };
}

/** Animated trend: the line draws in, the area fades up, the latest point pulses. Shape only, never amounts. */
function Trend({ values, accent, id }: { values: number[]; accent: string; id: string }) {
  const { line: d, area, end } = paths(values);
  return (
    <div aria-hidden="true" className="relative h-[88px]">
      <svg className="block h-full w-full" preserveAspectRatio="none" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.38" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-stroke`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="1" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((y) => <line key={y} stroke="currentColor" strokeDasharray="2 4" strokeOpacity="0.1" vectorEffect="non-scaling-stroke" x1="0" x2={W} y1={H * y} y2={H * y} />)}
        <path className="vr-area" d={area} fill={`url(#${id}-fill)`} />
        <path className="vr-line" d={d} fill="none" stroke={`url(#${id}-stroke)`} strokeLinecap="round" strokeWidth="2.25" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* The latest point sits in HTML so it stays round however wide the chart is. */}
      <span className="vr-dot absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(end[0] / W) * 100}%`, top: `${(end[1] / H) * 100}%`, background: accent, boxShadow: "0 0 0 2px color-mix(in srgb, currentColor 18%, transparent)" }}>
        <span className="vr-pulse absolute inset-0 rounded-full" style={{ background: accent }} />
      </span>
    </div>
  );
}

const CSS = `
.vr-line{stroke-dasharray:2400;stroke-dashoffset:2400;animation:vr-draw 1.6s cubic-bezier(.65,0,.35,1) .15s forwards}
.vr-area{opacity:0;animation:vr-fade 1.2s ease-out .7s forwards}
.vr-dot{opacity:0;animation:vr-fade .4s ease-out 1.6s forwards}
.vr-pulse{animation:vr-pulse 2.4s ease-out 1.9s infinite;opacity:0}
.vr-rise{animation:vr-rise .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes vr-draw{to{stroke-dashoffset:0}}
@keyframes vr-fade{to{opacity:1}}
@keyframes vr-pulse{0%{opacity:.45;transform:scale(.6)}100%{opacity:0;transform:scale(2.6)}}
@keyframes vr-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.vr-line,.vr-area,.vr-dot,.vr-rise{animation:none;opacity:1;stroke-dashoffset:0;transform:none}.vr-pulse{animation:none;opacity:0}}
`;

/** Verified figures, one card per provider and currency, never summed: overlapping providers can't double-count. */
export function VerifiedRevenue({ sources, accent, accentInk, idBase }: { sources: PublicRevenue[]; accent: string; accentInk: string; idBase: string }) {
  const cards = sources.map((s, i) => {
    const figure = s.visibility === "exact" && s.mrr_minor != null ? money(s.mrr_minor, s.currency)
      : s.visibility === "range" && s.band ? `${BAND[s.band] ?? s.band}` : null;
    const growth = s.growth_pct;
    if (!figure && growth == null) return null;
    const note = s.preview ? (s.test ? "Test data · only you see this" : s.stale ? "Not current · only you see this" : null) : null;
    return (
      <li className="vr-rise relative overflow-hidden rounded-[22px] p-4 sm:p-5" key={`${s.provider}-${s.currency}`}
        style={{ animationDelay: `${i * 90}ms`, boxShadow: `inset 0 0 0 1px ${line}`, background: `radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, ${accent} 16%, transparent), transparent 60%), color-mix(in srgb, currentColor 3%, transparent)` }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`${label} inline-flex items-center gap-1.5 opacity-70`}>
            <span className="grid size-4 place-items-center rounded-full" style={{ background: accent, color: accentInk }}>
              <svg className="size-2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10" /></svg>
            </span>
            Verified by {PROVIDER_LABEL[s.provider]}
          </span>
          {note && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ boxShadow: `inset 0 0 0 1px ${line}` }}>{note}</span>}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
          {figure && <p className="font-display text-[34px] font-bold leading-none tracking-[-0.04em] tabular-nums">{figure}<span className="ml-1.5 align-baseline text-[13px] font-semibold tracking-normal opacity-60">{s.visibility === "range" ? `${s.currency.toUpperCase()} MRR` : "MRR"}</span></p>}
          {growth != null && (
            <span className="mb-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12.5px] font-semibold tabular-nums" style={growth >= 0 ? { background: accent, color: accentInk } : { boxShadow: `inset 0 0 0 1px ${line}` }}>
              <svg aria-hidden="true" className="size-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24"><path d={growth >= 0 ? "M7 17 17 7M9 7h8v8" : "M7 7l10 10M17 9v8H9"} /></svg>
              {growth > 0 ? "+" : ""}{growth}% <span className="font-normal opacity-75">30d</span>
            </span>
          )}
        </div>
        {(s.arr_minor != null || s.paying_customers != null) && (
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {s.arr_minor != null && <div className="flex gap-1.5"><dt className="opacity-55">ARR</dt><dd className="font-semibold tabular-nums">{compact(s.arr_minor, s.currency)}</dd></div>}
            {s.paying_customers != null && <div className="flex gap-1.5"><dt className="opacity-55">Paying customers</dt><dd className="font-semibold tabular-nums">{s.paying_customers}</dd></div>}
          </dl>
        )}
        {s.trend && s.trend.length > 0 && <div className="mt-4 pr-1"><Trend accent={accent} id={`vr-${idBase}-${i}`} values={s.trend} /></div>}
        <p className="mt-2 text-[11.5px] opacity-50">{s.reconstructed ? "Reconstructed from Stripe history, then measured daily · " : s.trend && s.trend.length > 1 ? `Last ${s.trend.length} days · ` : "Tracking started · "}synced {new Date(s.synced_at).toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" })}</p>
      </li>
    );
  });
  return (
    <>
      <style>{CSS}</style>
      <ul aria-label="Verified revenue" className="grid gap-3">{cards}</ul>
    </>
  );
}
