import type { PublicRevenue } from "@/lib/builder/model";

const label = "font-label text-[10.5px] uppercase tracking-[0.18em]";
const line = "color-mix(in srgb, currentColor 14%, transparent)";
export const PROVIDER_LABEL: Record<PublicRevenue["provider"], string> = { stripe: "Stripe", revenuecat: "RevenueCat", dodo: "Dodo Payments" };

export function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(minor / 100);
}
const BAND: Record<string, string> = { "<1k": "Under 1k", "1k-5k": "1k–5k", "5k-10k": "5k–10k", "10k-25k": "10k–25k", "25k-50k": "25k–50k", "50k-100k": "50k–100k", "100k-250k": "100k–250k", "250k-1m": "250k–1M", "1m+": "1M+" };

/** Verified figures, one per provider and currency, never summed: overlapping providers can't double-count. */
export function VerifiedRevenue({ sources }: { sources: PublicRevenue[] }) {
  return (
    <ul aria-label="Verified revenue" className="flex flex-wrap gap-2">
      {sources.map((s) => {
        const growth = s.growth_pct == null ? null : `${s.growth_pct > 0 ? "+" : ""}${s.growth_pct}% in 30 days`;
        const figure = s.visibility === "exact" && s.mrr_minor != null ? `${money(s.mrr_minor, s.currency)} MRR`
          : s.visibility === "range" && s.band ? `${BAND[s.band] ?? s.band} ${s.currency.toUpperCase()} MRR` : null;
        if (!figure && !growth) return null;
        return (
          <li className="flex flex-col gap-0.5 rounded-[14px] px-3 py-2" key={`${s.provider}-${s.currency}`} style={{ boxShadow: `inset 0 0 0 1px ${line}` }}>
            <span className={`${label} flex items-center gap-1.5 text-[9.5px] opacity-65`}>
              <svg aria-hidden="true" className="size-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10" /></svg>
              Verified by {PROVIDER_LABEL[s.provider]}
            </span>
            {figure && <span className="text-[15px] font-semibold tabular-nums">{figure}</span>}
            {growth && <span className="text-[13px] tabular-nums opacity-75">{growth}</span>}
            {s.paying_customers != null && <span className="text-[12.5px] tabular-nums opacity-65">{s.paying_customers} paying customers</span>}
          </li>
        );
      })}
    </ul>
  );
}
