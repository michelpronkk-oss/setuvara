import type { Metadata } from "next";

import { OrdersStudio } from "@/components/commerce/orders-studio";
import { loadCommerce } from "@/lib/commerce/studio-server";

export const metadata: Metadata = { title: "Orders · Commerce · Setuvara" };

export default async function CommerceOrdersPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const [commerce, { order }] = await Promise.all([loadCommerce("/app/identity/creator/commerce/orders"), searchParams]);
  if (!commerce.ready || !("seller" in commerce)) return null;
  return <OrdersStudio disputes={commerce.disputes} initialOrder={order ?? null} orders={commerce.orders} refunds={commerce.refunds} />;
}
