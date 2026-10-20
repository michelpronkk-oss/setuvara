import type { Metadata } from "next";

import { PaymentsStudio } from "@/components/commerce/payments-studio";
import { sellerState } from "@/lib/commerce/model";
import { loadCommerce } from "@/lib/commerce/studio-server";

export const metadata: Metadata = { title: "Payments · Commerce · Setuvara" };

export default async function CommercePaymentsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [commerce, { notice }] = await Promise.all([loadCommerce("/app/identity/creator/commerce/payments"), searchParams]);
  if (!commerce.ready || !("seller" in commerce)) return null;
  return <PaymentsStudio notice={notice ?? null} open={commerce.enabled && commerce.providerReady} payoutsHref={commerce.testMode ? "https://dashboard.stripe.com/test/dashboard" : "https://dashboard.stripe.com/"} seller={commerce.seller} state={sellerState(commerce.seller)} />;
}
