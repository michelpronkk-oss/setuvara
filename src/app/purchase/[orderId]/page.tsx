import type { Metadata } from "next";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { issueLink } from "@/lib/commerce/fulfillment";
import { ageMs, formatAmount } from "@/lib/commerce/model";
import { createCommerceServiceClient } from "@/lib/commerce/server";

export const metadata: Metadata = { title: "Your purchase · Setuvara", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderId: string }>; searchParams: Promise<{ session?: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where Stripe sends the buyer back. The page never settles anything: it shows
 * the order as the webhook left it, and only to someone holding the checkout id
 * Stripe put in the return URL. A just-paid digital order gets its files here too.
 */
export default async function PurchasePage({ params, searchParams }: Props) {
  const [{ orderId }, { session }] = await Promise.all([params, searchParams]);
  const valid = uuid.test(orderId) && typeof session === "string" && /^cs_[A-Za-z0-9_]{8,200}$/.test(session);
  const service = valid ? createCommerceServiceClient() : null;
  const { data: order } = service ? await service.from("creator_orders").select("id, status, offer_type, offer_title, gross_amount_minor, currency, buyer_email, paid_at, creator_user_id, created_at")
    .eq("id", orderId).eq("provider_checkout_id", session!).maybeSingle() : { data: null };
  const { data: creator } = order && service ? await service.from("profiles").select("display_name").eq("id", order.creator_user_id).maybeSingle() : { data: null };
  const name = creator?.display_name ?? "the creator";

  let token: string | null = null;
  if (order && service && order.offer_type === "digital" && ["paid", "partially_refunded"].includes(order.status) && order.paid_at && ageMs(order.paid_at) < 3600_000) {
    const { count } = await service.from("creator_download_links").select("id", { count: "exact", head: true }).eq("order_id", order.id);
    if ((count ?? 0) < 4) token = await issueLink(service, order.id);
  }
  // Waiting on Stripe's confirmation: look again shortly while the checkout can still complete.
  const waiting = order?.status === "pending" && ageMs(order.created_at) < 40 * 60_000;

  return (
    <main className={`${marketingFontClasses} grid min-h-dvh place-items-center bg-[#F5F4EF] px-5 py-10 font-brand text-[#0D0D0D]`}>
      {waiting && <meta content="3" httpEquiv="refresh" />}
      <div className="w-full max-w-[480px]" data-purchase-state={order?.status ?? "unknown"}>
        <p className="font-label text-[11px] uppercase tracking-[0.16em] text-black/55">Setuvara · {name}</p>
        {!order ? (
          <><h1 className="mt-3 font-display text-[40px] font-bold leading-[0.95] tracking-[-0.06em]">We can&apos;t show this order.</h1><p className="mt-3 text-[16px] text-black/65">If you paid, your receipt from Stripe and the delivery email have everything you need.</p></>
        ) : ["paid", "partially_refunded"].includes(order.status) ? (
          <>
            <h1 className="mt-3 font-display text-[44px] font-bold leading-[0.95] tracking-[-0.06em]">Thank you.</h1>
            <p className="mt-3 text-[17px] leading-[1.5]">You bought <strong>{order.offer_title}</strong> for {formatAmount(order.gross_amount_minor, order.currency)}.</p>
            {order.offer_type === "digital" ? (
              <>
                {token && <a className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#0D0D0D] text-[17px] font-semibold text-[#F5F4EF] focus-visible:outline-2 focus-visible:outline-offset-2" href={`/d/${token}`}>Open your files</a>}
                <p className="mt-4 text-[15px] text-black/65">We also emailed a download link to {order.buyer_email}. Keep that email to download again later.</p>
              </>
            ) : <p className="mt-4 text-[15px] text-black/65">{name} will be in touch at {order.buyer_email} to arrange the rest.</p>}
            <p className="mt-6 text-[13px] text-black/50">Stripe sends your receipt. {name} is the seller.</p>
          </>
        ) : order.status === "pending" || order.status === "processing" ? (
          <>
            <h1 className="mt-3 font-display text-[40px] font-bold leading-[0.95] tracking-[-0.06em]">{order.status === "processing" ? "Your payment is processing." : "Confirming your payment…"}</h1>
            <p className="mt-3 text-[16px] text-black/65">{order.status === "processing" ? `Your bank is still sending the money. We email ${order.buyer_email} as soon as it lands.` : "This takes a few seconds. You can close this page; we email you either way."}</p>
          </>
        ) : (
          <><h1 className="mt-3 font-display text-[40px] font-bold leading-[0.95] tracking-[-0.06em]">{order.status === "refunded" ? "This order was refunded." : "This checkout didn't complete."}</h1><p className="mt-3 text-[16px] text-black/65">{order.status === "refunded" ? "The money goes back to how you paid." : "Nothing was charged. Go back to the product to try again."}</p></>
        )}
      </div>
    </main>
  );
}
