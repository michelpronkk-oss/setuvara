"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Sheet, TextInput } from "@/app/app/identity/editor-ui";
import { EmptyState, FilterPill, inkButton, lineButton, Mono, StudioHead } from "@/components/creator/studio-ui";
import { FULFILLMENT_LABEL, formatAmount, ORDER_LABEL, refundable, type CommerceOrder, type RefundRow } from "@/lib/commerce/model";
import type { Dispute } from "@/lib/commerce/studio-server";
import { parseMoney } from "@/lib/creator/studio";
import { dateTime, intentKey, shortDay } from "./ui";

const FILTERS = [
  { key: "all", label: "All", match: (order: CommerceOrder) => order.status !== "pending" && order.status !== "expired" },
  { key: "paid", label: "Paid", match: (order: CommerceOrder) => ["paid", "partially_refunded"].includes(order.status) },
  { key: "refunded", label: "Refunded", match: (order: CommerceOrder) => ["refunded", "partially_refunded"].includes(order.status) },
  { key: "attention", label: "Needs you", match: (order: CommerceOrder) => order.fulfillment_status === "failed" || order.status === "disputed" },
  { key: "open", label: "Unfinished", match: (order: CommerceOrder) => ["pending", "processing", "expired", "failed", "cancelled"].includes(order.status) },
] as const;
const TONE: Partial<Record<CommerceOrder["status"], string>> = { paid: "text-[#1F7A4D]", disputed: "text-[#B42318]", charged_back: "text-[#B42318]", failed: "text-black/45", expired: "text-black/45", cancelled: "text-black/45" };

/** Orders with search, filters and a detail view for refunds and re-sending downloads. */
export function OrdersStudio({ orders, refunds, disputes, initialOrder }: { orders: CommerceOrder[]; refunds: RefundRow[]; disputes: Dispute[]; initialOrder: string | null }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialOrder);
  const shown = useMemo(() => {
    const test = FILTERS.find((item) => item.key === filter)!.match;
    const q = query.trim().toLowerCase();
    return orders.filter((order) => test(order) && (!q || [order.buyer_email, order.buyer_name, order.offer_title, order.id].some((value) => value?.toLowerCase().includes(q))));
  }, [orders, filter, query]);
  const open = orders.find((order) => order.id === openId) ?? null;

  return (
    <div>
      <StudioHead sub={`${orders.filter((order) => order.paid_at).length} completed`} title="Orders" />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="-mx-3.5 flex gap-2 overflow-x-auto px-3.5 [scrollbar-width:none] md:mx-0 md:px-0">{FILTERS.map((item) => <FilterPill count={orders.filter(item.match).length} key={item.key} label={item.label} on={filter === item.key} onClick={() => setFilter(item.key)} />)}</div>
        <TextInput aria-label="Search orders" className="md:ml-auto md:max-w-[280px]" onChange={(event) => setQuery(event.target.value)} placeholder="Search email or product" value={query} />
      </div>
      {orders.length === 0 ? <EmptyState body="Orders appear here the moment a buyer pays or claims a free download." title="No orders yet." /> : shown.length === 0 ? <p className="py-10 text-center text-[15px] text-black/55">Nothing matches.</p> : (
        <ul className="divide-y divide-black/10 border-y border-black/10" data-orders>
          {shown.map((order) => (
            <li key={order.id}>
              <button className="flex w-full items-center gap-4 py-3.5 text-left hover:bg-black/[0.02] focus-visible:outline-2" onClick={() => setOpenId(order.id)} type="button">
                <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{order.offer_title}</span><span className="block truncate text-[13px] text-black/60">{order.buyer_name ? `${order.buyer_name} · ` : ""}{order.buyer_email} · {shortDay(order.paid_at ?? order.created_at)}{!order.livemode ? " · test" : ""}</span></span>
                {order.fulfillment_status === "failed" && <span className="hidden shrink-0 rounded-md bg-[#FF5A4F] px-2 py-1 font-label text-[10px] tracking-[0.12em] sm:block">NOT DELIVERED</span>}
                <span className={`hidden w-28 shrink-0 text-right font-label text-[11px] uppercase tracking-[0.12em] sm:block ${TONE[order.status] ?? "text-black/60"}`}>{order.order_kind === "free_claim" ? "Free" : ORDER_LABEL[order.status]}</span>
                <span className="w-24 shrink-0 text-right text-[15px] font-semibold tabular-nums">{order.gross_amount_minor ? formatAmount(order.gross_amount_minor, order.currency) : "Free"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <OrderSheet dispute={disputes.find((item) => item.order_id === open.id) ?? null} onChanged={() => router.refresh()} onClose={() => setOpenId(null)} order={open} refunds={refunds.filter((item) => item.order_id === open.id)} />}
    </div>
  );
}

function OrderSheet({ order, refunds, dispute, onClose, onChanged }: { order: CommerceOrder; refunds: RefundRow[]; dispute: Dispute | null; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [partial, setPartial] = useState("");
  const [key] = useState(intentKey);
  const max = refundable(order);
  const feeBack = refunds.filter((item) => item.status === "succeeded").reduce((sum, item) => sum + item.platform_fee_refunded_minor, 0);
  const net = order.gross_amount_minor - order.amount_refunded_minor - (order.platform_fee_amount_minor - feeBack) - (order.provider_fee_amount_minor ?? 0);

  async function post(path: string, body: unknown, label: string) {
    setBusy(label); setMessage(null);
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" }, body: JSON.stringify(body) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; refund?: string } | null;
    setBusy(null);
    if (!response?.ok) { setMessage({ ok: false, text: result?.error ?? "That didn't work. Try again." }); return; }
    setMessage({ ok: true, text: label === "resend" ? "A new download link is on its way." : result?.refund === "succeeded" ? "Refunded." : "Refund sent to Stripe. It updates here when Stripe confirms." });
    onChanged();
  }
  function refund(amount?: number) {
    const value = amount ?? max;
    if (!window.confirm(`Refund ${formatAmount(value, order.currency)} to ${order.buyer_email}? It comes out of your Stripe balance.`)) return;
    void post(`/api/commerce/orders/${order.id}/refund`, { amountMinor: value, idempotencyKey: `${key}${value}` }, "refund");
  }

  return (
    <Sheet onClose={onClose} title={order.offer_title} wide>
      <div className="grid gap-5" data-order-detail={order.id}>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#0D0D0D] px-3 py-1 font-label text-[11px] uppercase tracking-[0.12em] text-[#F5F4EF]">{order.order_kind === "free_claim" ? "Free download" : ORDER_LABEL[order.status]}</span>
          {order.offer_type === "digital" && <span className="rounded-full bg-white px-3 py-1 font-label text-[11px] uppercase tracking-[0.12em] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]">{FULFILLMENT_LABEL[order.fulfillment_status]}</span>}
          {!order.livemode && <span className="rounded-full bg-[#FFE7B8] px-3 py-1 font-label text-[11px] uppercase tracking-[0.12em]">Test</span>}
        </div>
        <dl className="grid grid-cols-2 gap-4 rounded-[18px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
          <Line label="Buyer" value={order.buyer_name ? `${order.buyer_name}\n${order.buyer_email}` : order.buyer_email ?? "—"} />
          <Line label={order.paid_at ? "Paid" : "Started"} value={dateTime(order.paid_at ?? order.created_at)} />
          {order.buyer_country && <Line label="Country" value={order.buyer_country} />}
          <Line label="Order" value={order.id.slice(0, 8).toUpperCase()} />
        </dl>
        {order.order_kind === "purchase" && (
          <dl className="grid gap-2 text-[15px]">
            <Money label="Paid by buyer" value={formatAmount(order.gross_amount_minor, order.currency)} />
            {order.amount_refunded_minor > 0 && <Money label="Refunded" value={`−${formatAmount(order.amount_refunded_minor, order.currency)}`} />}
            <Money label="Setuvara fee" value={order.platform_fee_amount_minor - feeBack ? `−${formatAmount(order.platform_fee_amount_minor - feeBack, order.currency)}` : "—"} />
            <Money label="Stripe fee" value={order.provider_fee_amount_minor === null ? (order.paid_at ? "Pending" : "—") : `−${formatAmount(order.provider_fee_amount_minor, order.currency)}`} />
            {order.paid_at && <Money label="You keep" strong value={formatAmount(Math.max(net, 0), order.currency)} />}
          </dl>
        )}
        {dispute && <p className="rounded-2xl bg-[#FFE7B8] px-4 py-3 text-[15px]">The buyer disputed this payment ({dispute.reason?.replace(/_/g, " ") ?? "no reason given"}). {["needs_response", "warning_needs_response"].includes(dispute.status) ? `Respond in your Stripe Dashboard${dispute.evidence_due_by ? ` by ${shortDay(dispute.evidence_due_by)}` : ""}.` : `Status: ${dispute.status.replace(/_/g, " ")}.`}</p>}
        {refunds.length > 0 && (
          <div><Mono className="mb-2 text-black/55">Refunds</Mono><ul className="grid gap-1 text-[14px]">{refunds.map((item, index) => <li className="flex justify-between" key={index}><span>{shortDay(item.created_at)} · {item.status === "succeeded" ? "Done" : item.status}</span><span className="tabular-nums">{formatAmount(item.amount_minor, item.currency)}</span></li>)}</ul></div>
        )}
        {message && <p className={`text-[14px] font-medium ${message.ok ? "text-[#1F7A4D]" : "text-[#B42318]"}`} role="status">{message.text}</p>}
        <div className="flex flex-wrap gap-2 border-t border-black/10 pt-4">
          {order.offer_type === "digital" && ["paid", "partially_refunded"].includes(order.status) && <button className={inkButton} disabled={busy !== null} onClick={() => void post(`/api/commerce/orders/${order.id}/resend`, {}, "resend")} type="button">{busy === "resend" ? "Sending…" : order.fulfillment_status === "failed" ? "Send download again" : "Re-send download"}</button>}
          {max > 0 && <button className={lineButton} disabled={busy !== null} onClick={() => refund()} type="button">{busy === "refund" ? "Refunding…" : `Refund ${formatAmount(max, order.currency)}`}</button>}
        </div>
        {max > 0 && (
          <div className="flex items-end gap-2">
            <label className="grid flex-1 gap-1 text-[13px] font-semibold">Part refund<TextInput inputMode="decimal" onChange={(event) => setPartial(event.target.value)} placeholder={`Up to ${formatAmount(max, order.currency)}`} value={partial} /></label>
            <button className={lineButton} disabled={busy !== null || !parseMoney(partial) || (parseMoney(partial) ?? 0) > max} onClick={() => refund(parseMoney(partial) ?? undefined)} type="button">Refund part</button>
          </div>
        )}
        {order.offer_type !== "digital" && order.paid_at && <p className="text-[14px] text-black/60">Get in touch with the buyer at {order.buyer_email} to arrange this {order.offer_type}.</p>}
      </div>
    </Sheet>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt><Mono className="text-black/50">{label}</Mono></dt><dd className="mt-1 whitespace-pre-line break-words text-[15px] font-semibold">{value}</dd></div>;
}
function Money({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 ${strong ? "border-t border-black/10 pt-2 text-[17px] font-bold" : ""}`}><dt className={strong ? "" : "text-black/65"}>{label}</dt><dd className="tabular-nums">{value}</dd></div>;
}
