import type { Metadata } from "next";

import { SettingsStudio, type SettingsTab } from "@/components/creator/settings-studio";
import { StudioPage } from "@/components/creator/studio-ui";
import { collectionsOf } from "@/lib/creator/studio";
import { loadCreatorStudio } from "@/lib/creator/studio-server";

export const metadata: Metadata = { title: "Settings · Creator · Setuvara" };

export default async function CreatorSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [studio, query] = await Promise.all([loadCreatorStudio("/app/identity/creator/settings"), searchParams]);
  if (!studio.mode) return null;
  const tab: SettingsTab = query.tab === "accounts" || query.tab === "visibility" ? query.tab : "presentation";
  const featured = studio.work.find((item) => item.featured);
  const collections = collectionsOf(studio.work).length;
  const live = studio.offers.filter((offer) => offer.status === "active").length;
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  return (
    <StudioPage>
      <SettingsStudio
        counts={{
          featured: featured ? featured.title : "Feature a piece from Work",
          work: studio.work.length ? `${plural(studio.work.length, "piece")}${collections ? ` · ${plural(collections, "collection")}` : ""}` : "No work yet",
          store: live ? `${plural(live, "offer")} live` : "No live offers",
          collabs: "",
        }}
        enabled={studio.mode.is_enabled}
        firstName={studio.profile.display_name.split(/\s+/)[0] || studio.profile.display_name}
        links={studio.links}
        modeId={studio.mode.id}
        profileId={studio.userId}
        published={studio.profile.is_published}
        settings={studio.settings}
        tab={tab}
      />
    </StudioPage>
  );
}
