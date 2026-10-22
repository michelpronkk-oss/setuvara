import type { Metadata } from "next";

import { Panel, shortDay } from "@/components/commerce/ui";
import { EmptyState, Mono, StudioHead } from "@/components/creator/studio-ui";
import { cutoffDaysAgo, dailySeries, formatAmount, productFunnels } from "@/lib/commerce/model";
import { loadCommerce } from "@/lib/commerce/studio-server";

export const metadata: Metadata = { title: "Analytics · Commerce · Setuvara" };

const pct = (value: number | null) => (value === null ? "—" : `${(value * 100).toLocaleString("en", { maximumFractionDigits: 1 })}%`);

/** Product page views, checkouts started and purchases over 30 days. Views start counting when this ships. */
export default async function CommerceAnalyticsPage() {
  const commerce = await loadCommerce("/app/identity/creator/commerce/analytics");
  if (!commerce.ready || !("seller" in commerce)) return null;
  const since = cutoffDaysAgo(30);
  const stats = commerce.stats.filter((stat) => Date.parse(stat.day) >= since);
  const orders = commerce.orders.filter((order) => order.paid_at && Date.parse(order.paid_at) >= since);
  const titles = Object.fromEntries(commerce.products.map((product) => [product.id, product.title]));
  const rows = productFunnels(stats, orders, titles);
  const views = rows.reduce((sum, row) => sum + row.views, 0);
  const starts = rows.reduce((sum, row) => sum + row.checkoutStarts, 0);
  const purchases = rows.reduce((sum, row) => sum + row.purchases, 0);
  const currencies = [...new Set(orders.filter((order) => order.order_kind === "purchase").map((order) => order.currency))];

  return (
    <div className="grid gap-6">
      <StudioHead creator sub="Last 30 days" title="Analytics" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {([["Product views", views.toLocaleString("en")], ["Checkouts started", starts.toLocaleString("en")], ["Purchases and claims", purchases.toLocaleString("en")], ["Conversion", pct(views ? purchases / views : null)]] as const).map(([label, value]) => (
          <div className="rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" key={label}><Mono className="text-black/55">{label}</Mono><p className="mt-2 font-display text-[32px] font-bold leading-none tracking-[-0.05em] tabular-nums">{value}</p></div>
        ))}
      </div>
      {rows.length === 0 ? <EmptyState body="Views, checkouts and sales per product appear once your products are live and visited." title="Nothing to show yet." /> : (
        <Panel title="By product">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-[15px]" data-funnel>
              <thead><tr className="border-b border-black/10">{["Product", "Views", "Checkouts", "Sold", "Conversion", "Revenue"].map((head) => <th className="py-2 pr-4" key={head} scope="col"><Mono className="text-black/50">{head}</Mono></th>)}</tr></thead>
              <tbody className="divide-y divide-black/10">
                {rows.map((row) => <tr key={row.offerId}><td className="py-3 pr-4 font-semibold">{row.title}</td><td className="py-3 pr-4 tabular-nums">{row.views}</td><td className="py-3 pr-4 tabular-nums">{row.checkoutStarts}</td><td className="py-3 pr-4 tabular-nums">{row.purchases}</td><td className="py-3 pr-4 tabular-nums">{pct(row.conversion)}</td><td className="py-3 pr-4 font-semibold tabular-nums">{row.revenue.map((item) => formatAmount(item.amount, item.currency)).join(" · ") || "—"}</td></tr>)}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-black/50">Revenue is what buyers paid minus refunds, before fees. Checkouts count paid products only; free downloads go straight to email.</p>
        </Panel>
      )}
      {currencies.map((currency) => {
        const series = dailySeries(orders, currency, 30);
        const peak = Math.max(...series.map((day) => day.amount), 1);
        return (
          <Panel key={currency} title={`Daily sales · ${currency}`}>
            <div aria-label={`Daily sales in ${currency}, last 30 days`} className="flex h-32 items-end gap-[3px]" role="img">
              {series.map((day) => <span className="w-full rounded-[2px]" key={day.day} style={{ height: `${Math.max(4, (day.amount / peak) * 100)}%`, background: day.amount ? "#0D0D0D" : "rgba(13,13,13,.1)" }} title={`${shortDay(day.day)}: ${formatAmount(day.amount, currency)} · ${day.orders} orders`} />)}
            </div>
            <div className="mt-2 flex justify-between text-[12px] text-black/50"><span>{shortDay(series[0].day)}</span><span>Today</span></div>
          </Panel>
        );
      })}
    </div>
  );
}
