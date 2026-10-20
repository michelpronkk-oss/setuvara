import type { Metadata } from "next";

import { Badge, Empty, KeyValues, Notice, PageHeader, Panel, Segmented, Stat, Table, Td, Th } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/auth";
import { ADMIN_RANGES, getCommerceOverview, parseRange, type CommerceCurrencyRow } from "@/lib/admin/data";
import { formatCount, formatDay, formatMoneyMinor } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Commerce" };

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

function setuvaraNet(row: CommerceCurrencyRow) {
  return row.platform_fees_minor - row.platform_fees_refunded_minor;
}

export default async function CommercePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdminPage("commerce");
  const days = parseRange((await searchParams).range);
  const { from, to, commerce, subscriptionRunRateMinor } = await getCommerceOverview(days);
  const live = commerce.by_currency.filter((row) => row.livemode);
  const test = commerce.by_currency.filter((row) => !row.livemode);
  const sellers = commerce.sellers;

  const table = (rows: CommerceCurrencyRow[]) => (
    <Table minWidth={860}>
      <thead>
        <tr><Th>Currency</Th><Th align="right">Orders</Th><Th align="right">Creator sales (GMV)</Th><Th align="right">Refunded</Th><Th align="right">Chargebacks</Th><Th align="right">Stripe fees (creator pays)</Th><Th align="right">Setuvara fees</Th><Th align="right">Fees returned</Th><Th align="right">Setuvara net</Th></tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr className="border-t border-ink/[0.06]" key={`${row.currency}-${row.livemode}`}>
            <Td><span className="font-semibold">{row.currency}</span></Td>
            <Td align="right">{formatCount(row.orders)}</Td>
            <Td align="right">{money(row.gmv_minor, row.currency)}</Td>
            <Td align="right">{money(row.refunds_minor, row.currency)}</Td>
            <Td align="right">{money(row.chargebacks_minor, row.currency)}</Td>
            <Td align="right">{money(row.processing_fees_minor, row.currency)}</Td>
            <Td align="right">{money(row.platform_fees_minor, row.currency)}</Td>
            <Td align="right">{money(row.platform_fees_refunded_minor, row.currency)}</Td>
            <Td align="right"><span className="font-semibold">{money(setuvaraNet(row), row.currency)}</span></Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );

  return (
    <>
      <PageHeader
        actions={<Segmented current={String(days)} options={ADMIN_RANGES.map((range) => ({ label: `${range}d`, value: String(range), href: `/commerce?range=${range}` }))} />}
        description={<>Paid {formatDay(from)} to {formatDay(to)}, in UTC. Creators sell with direct charges, so their sales are not Setuvara revenue; Setuvara earns only its fee.</>}
        eyebrow="Creator sales"
        title="Commerce"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Subscriptions run-rate" note="Plus and Pro, list price per month" tone="ink" value={formatMoneyMinor(subscriptionRunRateMinor)} />
        <Stat label="Sellers who can sell" note={<>{formatCount(sellers.total)} connected · {formatCount(sellers.payouts_enabled)} with payouts</>} value={formatCount(sellers.can_sell)} />
        <Stat label="Need action" note="Stripe requirements past due or disabled" value={formatCount(sellers.action_required)} />
        <Stat label="Free claims" note="Free downloads in this range" value={formatCount(commerce.free_claims)} />
      </div>

      {commerce.open_disputes || commerce.failed_deliveries || commerce.failed_events_7d ? (
        <div className="mt-3 sm:mt-4">
          <Notice tone="warn">
            {formatCount(commerce.open_disputes)} open disputes · {formatCount(commerce.failed_deliveries)} failed deliveries · {formatCount(commerce.failed_events_7d)} webhook events failed in the last 7 days.
          </Notice>
        </div>
      ) : null}

      <Panel className="mt-3 sm:mt-4" description="Live payments only, per currency. Currencies are never added together." padded={false} title="Live">
        {live.length ? table(live) : <Empty>No live creator sales in this range. Live charges are off until Setuvara turns them on.</Empty>}
      </Panel>

      <Panel actions={<Badge tone="warn">Test mode</Badge>} className="mt-3 sm:mt-4" description="Stripe sandbox payments. Never counted as revenue." padded={false} title="Sandbox">
        {test.length ? table(test) : <Empty>No sandbox payments in this range.</Empty>}
      </Panel>

      <Panel className="mt-3 sm:mt-4" title="How to read this">
        <KeyValues items={[
          { label: "Creator sales", value: "What buyers paid creators. The creator is the seller and gets paid by Stripe directly." },
          { label: "Setuvara fees", value: "Application fees set in creator fee policies. No policy means no fee." },
          { label: "Setuvara net", value: "Fees minus fees returned on refunds. Stripe's own fee on Setuvara's balance is not shown here." },
          { label: "Stripe fees", value: "Paid by the creator's account, recorded for their reports." },
        ]} />
      </Panel>
    </>
  );
}
