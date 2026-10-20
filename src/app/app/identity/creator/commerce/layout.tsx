import type { ReactNode } from "react";

import { CommerceNav } from "@/components/commerce/commerce-nav";
import { TestModeTag } from "@/components/commerce/ui";
import { StudioPage } from "@/components/creator/studio-ui";
import { sellerState } from "@/lib/commerce/model";
import { loadCommerce } from "@/lib/commerce/studio-server";

export default async function CommerceLayout({ children }: { children: ReactNode }) {
  const commerce = await loadCommerce("/app/identity/creator/commerce");
  if (!commerce.ready || !("seller" in commerce)) {
    return <StudioPage><h1 className="font-display text-[40px] font-bold tracking-[-0.05em] md:text-[52px]">Commerce</h1><p className="mt-3 max-w-[52ch] text-[15px] text-black/65">Commerce is being set up on Setuvara. Your products and shop links are safe and will show here soon.</p></StudioPage>;
  }
  const state = sellerState(commerce.seller);
  const failed = commerce.orders.filter((order) => order.fulfillment_status === "failed").length;
  const disputes = commerce.disputes.filter((item) => ["needs_response", "warning_needs_response"].includes(item.status)).length;
  return (
    <StudioPage>
      <div className="mb-1 flex items-center justify-end gap-2">{commerce.providerReady && commerce.testMode && <TestModeTag />}</div>
      <CommerceNav attention={{ Orders: failed + disputes, Payments: state === "action_required" || state === "setup_required" ? 1 : 0 }} />
      {children}
    </StudioPage>
  );
}
