import type { Metadata } from "next";

import { KitStudio } from "@/components/creator/kit-studio";
import { withVerified } from "@/components/creator/media-kit-document";
import { StudioPage } from "@/components/creator/studio-ui";
import { loadCreatorStudio } from "@/lib/creator/studio-server";

export const metadata: Metadata = { title: "Media kit · Creator · Setuvara" };

const KIT_PLATFORMS = new Set(["instagram", "tiktok", "youtube", "twitch", "x", "threads", "spotify", "substack", "patreon"]);

export default async function CreatorKitPage() {
  const studio = await loadCreatorStudio("/app/identity/creator/kit");
  if (!studio.mode) return null;
  const { settings, profile } = studio;
  return (
    <StudioPage className="!pt-0">
      <KitStudio
        base={{
          displayName: profile.display_name,
          tagline: settings.tagline,
          category: settings.category,
          city: settings.city,
          imageUrl: studio.imageUrl,
          platforms: withVerified(
            studio.links.filter((link) => link.is_visible && KIT_PLATFORMS.has(link.link_type)).map((link) => ({ type: link.link_type, url: link.url })),
            studio.socials.filter((item) => item.show_on_page && item.status === "connected").map((item) => ({ provider: item.provider, profile_url: item.profile_url, audience_count: item.audience_hidden ? null : item.audience_count })),
          ),
        }}
        initial={studio.kit}
        kitUrl={studio.shareUrl ? `${studio.shareUrl}/kit` : null}
        profileId={studio.userId}
      />
    </StudioPage>
  );
}
