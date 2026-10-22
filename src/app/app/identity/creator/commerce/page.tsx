import type { Metadata } from "next";
import Link from "next/link";

import { MoneyStat, Panel, shortDay, StateBadge } from "@/components/commerce/ui";
import { coralButton, Mono, StudioHead } from "@/components/creator/studio-ui";
import { commerceTotals, cutoffDaysAgo, dailySeries, formatAmount, productFunnels, SELLER_STATE_COPY, sellerState, SOLD } from "@/lib/commerce/model";
import { loadCommerce } from "@/lib/commerce/studio-server";

export const metadata: Metadata = { title: "Commerce · Creator · Setuvara" };

/** Gross, refunds, fees and net kept apart, per currency. Payouts are Stripe's figures, never ours. */
export default async function CommerceOverviewPage() {
  const commerce = await loadCommerce("/app/identity/creator/commerce");
  if (!commerce.ready || !("seller" in commerce)) return null;
  const { seller, orders, refunds, products, stats, balance, payouts, disputes } = commerce;
  const state = sellerState(seller);
  const since = cutoffDaysAgo(30);
  const recent = orders.filter((order) => order.paid_at && Date.parse(order.paid_at) >= since);
  const totals = commerceTotals(recent, refunds);
  const main = totals[0]?.currency ?? seller.account?.default_currency ?? "EUR";
  const series = dailySeries(orders, main, 30);
  const peak = Math.max(...series.map((day) => day.amount), 1);
  const titles = Object.fromEntries(products.map((product) => [product.id, product.title]));
  const top = productFunnels(stats.filter((stat) => Date.parse(stat.day) >= since), recent, titles).filter((row) => row.purchases > 0).slice(0, 5);
  const sold = orders.filter((order) => SOLD.includes(order.status) && order.order_kind === "purchase").length;
  const claims = orders.filter((order) => order.order_kind === "free_claim").length;
  const attention = [
    ...orders.filter((order) => order.fulfillment_status === "failed").map((order) => ({ key: `d-${order.id}`, text: `Download email to ${order.buyer_email} didn't send`, href: `/app/identity/creator/commerce/orders?order=${order.id}` })),
    ...disputes.filter((item) => ["needs_response", "warning_needs_response"].includes(item.status)).map((item) => ({ key: `x-${item.order_id}`, text: `Dispute needs a response${item.evidence_due_by ? ` by ${shortDay(item.evidence_due_by)}` : ""}. Answer it in Stripe.`, href: `/app/identity/creator/commerce/orders?order=${item.order_id}` })),
  ];
  const live = products.filter((product) => product.status === "active" && product.offer_type !== "external").length;

  return (
    <div className="grid gap-6">
      <StudioHead creator action={<Link className={coralButton} href="/app/identity/creator/commerce/products?new=1">+ New product</Link>} sub="Last 30 days" title="Commerce" />

      {state !== "payments_enabled" && (
        <Link className="flex flex-wrap items-center gap-3 rounded-[22px] bg-[#0D0D0D] px-5 py-4 text-[#F5F4EF] focus-visible:outline-2 focus-visible:outline-offset-2 md:px-6" href="/app/identity/creator/commerce/payments">
          <StateBadge className="!bg-[#F5F4EF] !text-[#0D0D0D]" state={state} />
          <span className="min-w-0 flex-1 text-[15px]">{SELLER_STATE_COPY[state].line}</span>
          <span aria-hidden="true" className="text-[20px]">→</span>
        </Link>
      )}

      {totals.length === 0 ? (
        <Panel>
          <p className="font-display text-[30px] font-bold leading-tight tracking-[-0.04em]">No sales yet.</p>
          <p className="mt-2 max-w-[52ch] text-[15px] text-black/65">{live ? `${live} product${live === 1 ? " is" : "s are"} live on your page. Share your Creator link and sales land here.` : "Add a product, put it live, and share your Creator link."}{claims ? ` ${claims} free download${claims === 1 ? "" : "s"} claimed so far.` : ""}</p>
        </Panel>
      ) : totals.map((t) => (
        <Panel key={t.currency}>
          <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
            <div>
              <MoneyStat amount={t.net} currency={t.currency} label={`You keep · ${t.currency}`} note={`From ${t.orders} order${t.orders === 1 ? "" : "s"}, after refunds and fees${t.feesPending ? `. Stripe fees for ${t.feesPending} order${t.feesPending === 1 ? " are" : "s are"} still coming in` : ""}.`} strong />
              {t.currency === main && (
                <div aria-label="Daily sales, last 30 days" className="mt-5 flex h-20 items-end gap-[3px]" role="img">
                  {series.map((day) => <span className="w-full rounded-[2px]" key={day.day} style={{ height: `${Math.max(6, (day.amount / peak) * 100)}%`, background: day.amount ? "#0D0D0D" : "rgba(13,13,13,.1)" }} title={`${shortDay(day.day)}: ${formatAmount(day.amount, main)}`} />)}
                </div>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 border-t border-black/10 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
              <Row label="Gross sales" value={formatAmount(t.gross, t.currency)} />
              <Row label="Refunds" value={t.refunds ? `−${formatAmount(t.refunds, t.currency)}` : "—"} />
              <Row label="Setuvara fee" value={t.platformFees ? `−${formatAmount(t.platformFees, t.currency)}` : "—"} />
              <Row label="Stripe fees" value={t.processingFees ? `−${formatAmount(t.processingFees, t.currency)}` : t.feesPending ? "Pending" : "—"} />
              {t.chargebacks > 0 && <Row label="Lost disputes" value={`−${formatAmount(t.chargebacks, t.currency)}`} />}
              <Row label="Orders" value={String(t.orders)} />
            </dl>
          </div>
        </Panel>
      ))}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel action={<Link className="text-[14px] font-semibold underline underline-offset-4" href="/app/identity/creator/commerce/payments">Payments</Link>} title="Payouts">
          {balance ? (
            <dl className="grid grid-cols-2 gap-4">
              {balance.pending.filter((entry) => entry.amountMinor).concat(balance.available.filter((entry) => entry.amountMinor)).length === 0 && <p className="col-span-2 text-[15px] text-black/60">Your Stripe balance is empty.</p>}
              {balance.pending.filter((entry) => entry.amountMinor).map((entry) => <Row key={`p-${entry.currency}`} label={`On the way · ${entry.currency}`} value={formatAmount(entry.amountMinor, entry.currency)} />)}
              {balance.available.filter((entry) => entry.amountMinor).map((entry) => <Row key={`a-${entry.currency}`} label={`Ready to pay out · ${entry.currency}`} value={formatAmount(entry.amountMinor, entry.currency)} />)}
            </dl>
          ) : <p className="text-[15px] text-black/60">{seller.account ? "Stripe's balance isn't available right now." : "Payouts appear once payments are on."}</p>}
          {payouts.length > 0 && (
            <ul className="mt-5 divide-y divide-black/10 border-t border-black/10">
              {payouts.slice(0, 4).map((payout) => <li className="flex items-center justify-between py-2.5 text-[14px]" key={payout.id}><span>{payout.arrival_date ? shortDay(payout.arrival_date) : shortDay(payout.created_at)} · {payout.status === "paid" ? "Paid out" : payout.status === "failed" ? "Failed" : "In transit"}</span><span className="font-semibold tabular-nums">{formatAmount(payout.amount_minor, payout.currency)}</span></li>)}
            </ul>
          )}
          <p className="mt-4 text-[12px] leading-[1.45] text-black/50">Figures come from your Stripe account. Stripe pays out to your bank on its own schedule.</p>
        </Panel>

        <Panel action={<Link className="text-[14px] font-semibold underline underline-offset-4" href="/app/identity/creator/commerce/analytics">Analytics</Link>} title="Top products">
          {top.length === 0 ? <p className="text-[15px] text-black/60">Your best sellers show here.</p> : (
            <ol className="divide-y divide-black/10">
              {top.map((row, index) => <li className="flex items-center gap-3 py-2.5" key={row.offerId}><span className="w-5 font-label text-[11px] text-black/45">{index + 1}</span><span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{row.title}</span><span className="text-[13px] text-black/55">{row.purchases} sold</span><span className="w-24 text-right text-[15px] font-semibold tabular-nums">{row.revenue.map((item) => formatAmount(item.amount, item.currency)).join(" · ") || "Free"}</span></li>)}
            </ol>
          )}
          <p className="mt-4 text-[13px] text-black/55">{sold} paid order{sold === 1 ? "" : "s"} all time · {claims} free download{claims === 1 ? "" : "s"}</p>
        </Panel>
      </div>

      {attention.length > 0 && (
        <Panel title="Needs you">
          <ul className="divide-y divide-black/10">
            {attention.map((item) => <li key={item.key}><Link className="flex items-center gap-3 py-3 text-[15px] hover:text-[#FF5A4F]" href={item.href}><span aria-hidden="true" className="size-[7px] rounded-full bg-[#FF5A4F]" /><span className="flex-1">{item.text}</span><span aria-hidden="true">→</span></Link></li>)}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt><Mono className="text-black/50">{label}</Mono></dt><dd className="mt-1 truncate text-[18px] font-semibold tabular-nums">{value}</dd></div>;
}
