import type { ReactNode } from "react";

import { CreatorOffBanner } from "@/components/creator/creator-switch";
import { StudioNav } from "@/components/creator/studio-nav";
import { NEEDS_ATTENTION } from "@/lib/actions/model";
import { loadCreatorStudio } from "@/lib/creator/studio-server";

export default async function CreatorStudioLayout({ children }: { children: ReactNode }) {
  const studio = await loadCreatorStudio();
  if (!studio.mode) {
    return <main className="px-4 py-16 text-center md:px-8"><h1 className="font-display text-3xl font-bold tracking-[-0.04em]">Creator isn’t available yet</h1><p className="mt-3 text-black/65">Your account doesn’t have a Creator Mode yet. Try again in a moment.</p></main>;
  }
  const fresh = studio.submissions.filter((item) => NEEDS_ATTENTION.includes(item.status)).length;
  return (
    <div className="pb-10">
      <StudioNav needsYou={fresh} shareUrl={studio.shareUrl} />
      {!studio.mode.is_enabled && <CreatorOffBanner modeId={studio.mode.id} profileId={studio.userId} published={studio.profile.is_published} />}
      {children}
    </div>
  );
}
