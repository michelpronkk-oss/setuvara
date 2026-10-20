import type { Metadata } from "next";

import { StoreStudio, type StoreOrder } from "@/components/creator/store-studio";
import { StudioPage } from "@/components/creator/studio-ui";
import { loadCreatorStudio } from "@/lib/creator/studio-server";

export const metadata: Metadata = { title: "Store · Creator · Setuvara" };

export default async function CreatorStorePage() {
  const studio = await loadCreatorStudio("/app/identity/creator/store");
  if (!studio.mode) return null;
  const { data: orders } = await studio.supabase.from("creator_orders").select("id, offer_id, gross_amount_minor, currency, status, created_at").eq("creator_user_id", studio.userId).order("created_at", { ascending: false }).limit(50);
  return (
    <StudioPage>
      <StoreStudio canMonetize={studio.canMonetize} firstName={studio.profile.display_name.split(/\s+/)[0] || studio.profile.display_name} offers={studio.offers} orders={(orders ?? []) as StoreOrder[]} profileId={studio.userId} />
    </StudioPage>
  );
}
