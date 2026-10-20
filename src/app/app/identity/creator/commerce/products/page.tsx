import type { Metadata } from "next";

import { ProductsStudio } from "@/components/commerce/products-studio";
import { COMMERCE_CURRENCIES, SOLD, type CommerceCurrency } from "@/lib/commerce/model";
import { loadCommerce } from "@/lib/commerce/studio-server";

export const metadata: Metadata = { title: "Products · Commerce · Setuvara" };

export default async function CommerceProductsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const [commerce, query] = await Promise.all([loadCommerce("/app/identity/creator/commerce/products"), searchParams]);
  if (!commerce.ready || !("seller" in commerce)) return null;
  const sales: Record<string, number> = {};
  for (const order of commerce.orders) if (SOLD.includes(order.status)) sales[order.offer_id] = (sales[order.offer_id] ?? 0) + 1;
  const views: Record<string, number> = {};
  for (const stat of commerce.stats) views[stat.offer_id] = (views[stat.offer_id] ?? 0) + stat.views;
  const accountCurrency = commerce.seller.account?.default_currency;
  const defaultCurrency = (COMMERCE_CURRENCIES as readonly string[]).includes(accountCurrency ?? "") ? accountCurrency as CommerceCurrency : "EUR";
  return <ProductsStudio canSell={commerce.seller.can_sell} defaultCurrency={defaultCurrency} open={commerce.enabled} products={commerce.products} sales={sales} startNew={query.new === "1"} userId={commerce.studio.userId} views={views} />;
}
