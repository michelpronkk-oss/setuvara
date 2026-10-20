import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { BuyForm } from "@/components/commerce/buy-form";
import { inkOnAccent, resolveModeAccent } from "@/components/profile/appearance";
import type { ProfileMode } from "@/components/profile/types";
import { formatAmount } from "@/lib/commerce/model";
import { getPublicStore } from "@/lib/commerce/public";
import { createCommerceServiceClient } from "@/lib/commerce/server";
import { OFFER_TYPE_LABEL } from "@/lib/creator/studio";
import { getPublishedPublicMode } from "@/lib/seo/public-profile";
import { createClient } from "@/lib/supabase/server";
import { resolveModeShare } from "../../resolve";

type Props = { params: Promise<{ token: string; offerId: string }> };

async function load(token: string, offerId: string) {
  const target = await resolveModeShare(token);
  if (!target || target.slug !== "creator") return null;
  const [record, store] = await Promise.all([getPublishedPublicMode(target.username, target.slug), getPublicStore(target.username)]);
  const product = store.find((item) => item.id === offerId && item.sellsHere);
  return record && product ? { record, product } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token, offerId } = await params;
  const page = await load(token, offerId);
  if (!page) notFound();
  return { title: `${page.product.title} · ${page.record.profile.display_name}`, robots: { index: false, follow: false } };
}

/** A product behind the Creator share link: pictures, what's included, who sells it, and one step to buy. */
export default async function ProductPage({ params }: Props) {
  const { token, offerId } = await params;
  const page = await load(token, offerId);
  if (!page) notFound();
  const { record, product } = page;
  const name = record.profile.display_name;
  const back = `/s/${token}`;
  const accent = resolveModeAccent(record.mode as unknown as ProfileMode);
  const free = product.unit_amount_minor === 0;
  const price = free ? "Free" : formatAmount(product.unit_amount_minor, product.currency);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  const email = typeof claims?.claims?.email === "string" ? claims.claims.email : "";
  const own = userId === record.profile.id;
  if (!own) after(async () => { try { await createCommerceServiceClient().rpc("commerce_count_view", { p_offer_id: product.id }); } catch { /* counts are best effort */ } });

  const pictures = [product.coverUrl, ...product.galleryUrls].filter((url): url is string => Boolean(url));
  const included = product.offer_type === "digital"
    ? [`${product.fileCount} file${product.fileCount === 1 ? "" : "s"} to download`, product.downloadDays ? `Link works for ${product.downloadDays === 365 ? "a year" : `${product.downloadDays} days`}` : "Link keeps working", "Sent to your email"]
    : [product.offer_type === "booking" ? "You'll arrange the time by email" : "The seller follows up by email", "Receipt from Stripe"];

  return (
    <main className={`${marketingFontClasses} min-h-dvh bg-[#F5F4EF] font-brand text-[#0D0D0D]`}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[1080px] flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
        <header className="grid grid-cols-[44px_1fr_44px] items-center">
          <Link aria-label={`Back to ${name}`} className="grid size-11 place-items-center rounded-full text-[22px] hover:bg-black/[0.05] focus-visible:outline-2" href={back}>←</Link>
          <p className="truncate text-center text-[16px] font-semibold">{name}</p>
        </header>
        <div className="mt-5 grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-12">
          <div className="flex flex-col gap-3">
            {pictures.length ? pictures.map((url, index) => (
              // eslint-disable-next-line @next/next/no-img-element -- signed product picture
              <img alt={index === 0 ? product.title : ""} className={`w-full rounded-[22px] object-cover ${index === 0 ? "aspect-[4/3]" : "aspect-[16/10]"}`} key={url} src={url} />
            )) : <div aria-hidden="true" className="grid aspect-[4/3] place-items-center rounded-[22px] font-display text-[64px] font-bold tracking-[-0.06em]" style={{ background: accent, color: inkOnAccent(accent) }}>{product.title.slice(0, 1)}</div>}
          </div>
          <div className="flex flex-col md:sticky md:top-6 md:h-fit">
            <p className="font-label text-[11px] uppercase tracking-[0.16em] text-black/55">{OFFER_TYPE_LABEL[product.offer_type]} · by {name}</p>
            <h1 className="mt-2 font-display text-[40px] font-bold leading-[0.95] tracking-[-0.06em] md:text-[52px]">{product.title}</h1>
            <p className="mt-3 font-display text-[28px] font-bold tracking-[-0.04em]" data-price>{price}</p>
            {product.description && <p className="mt-4 whitespace-pre-line text-[16px] leading-[1.55] text-black/75">{product.description}</p>}
            <ul className="mt-5 grid gap-2 border-y border-black/10 py-4 text-[15px]">{included.map((line) => <li className="flex items-center gap-2" key={line}><span aria-hidden="true" className="size-[6px] rounded-full bg-[#0D0D0D]" />{line}</li>)}</ul>
            <div className="mt-6">
              {own ? (
                <div className="rounded-[22px] bg-white p-6"><p className="text-[17px] font-semibold">This is your own product.</p><Link className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-[18px] text-[15px] font-semibold text-[#F5F4EF]" href="/app/identity/creator/commerce/products">Edit in Commerce</Link></div>
              ) : <BuyForm accent={accent} accentInk={inkOnAccent(accent)} defaultEmail={email} free={free} offerId={product.id} priceLabel={price} returnPath={`/s/${token}/p/${product.id}`} soldOut={product.soldOut} />}
            </div>
            <p className="mt-6 text-[12px] leading-[1.5] text-black/50">{name} is the seller{free ? "" : " and the merchant on your receipt"}. Setuvara hosts this page{free ? "" : "; payments are processed by Stripe"}. Questions about the product go to {name}.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
