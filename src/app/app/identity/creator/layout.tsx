import type { ReactNode } from "react";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { CreatorOffBanner } from "@/components/creator/creator-switch";
import { StudioShell } from "@/components/creator/studio-shell";
import { readFocus } from "@/components/profile/photo-focus";
import type { ModeSlug } from "@/components/profile/types";
import { NEEDS_ATTENTION } from "@/lib/actions/model";
import { signHomeImage } from "@/lib/app/media";
import { getPublicOrigin, getViewerPlan } from "@/lib/app/viewer";
import { loadCreatorStudio } from "@/lib/creator/studio-server";
import { ownerModeHandles } from "@/lib/handles/mode-server";
import { headers } from "next/headers";
import { signOut } from "../actions";

const MODE_SLUGS: ModeSlug[] = ["personal", "event", "business", "creator"];

export default async function CreatorStudioLayout({ children }: { children: ReactNode }) {
  const studio = await loadCreatorStudio();
  if (!studio.mode) {
    return <main className="px-4 py-16 text-center md:px-8"><h1 className="font-display text-3xl font-bold tracking-[-0.04em]">Creator isn’t available yet</h1><p className="mt-3 text-black/65">Your account doesn’t have a Creator Mode yet. Try again in a moment.</p></main>;
  }
  const [{ data: modeRows }, billing, handles, origin] = await Promise.all([
    studio.supabase.from("profile_modes").select("slug, is_enabled, image_path, image_focus_x, image_focus_y").eq("profile_id", studio.userId).order("sort_order"),
    getViewerPlan(studio.userId),
    ownerModeHandles(studio.userId),
    headers().then(getPublicOrigin),
  ]);
  const modes = (modeRows ?? []).filter((row): row is typeof row & { slug: ModeSlug } => MODE_SLUGS.includes(row.slug as ModeSlug)).map((row) => ({ slug: row.slug, is_enabled: Boolean(row.is_enabled) }));
  const personal = modeRows?.find((row) => row.slug === "personal");
  const avatarUrl = await signHomeImage(studio.supabase, personal?.image_path, true);
  const handle = handles.creator?.is_live ? `${origin}/${handles.creator.handle}` : null;
  const shareUrl = studio.mode.is_enabled && studio.profile.is_published ? handle ?? studio.shareUrl : null;
  const fresh = studio.submissions.filter((item) => NEEDS_ATTENTION.includes(item.status)).length;
  return (
    <div className={marketingFontClasses}>
      <StudioShell
        avatarFocus={readFocus(personal?.image_focus_x, personal?.image_focus_y)}
        avatarUrl={avatarUrl}
        enabled={studio.mode.is_enabled}
        liveUrl={shareUrl ?? handle ?? studio.shareUrl ?? `${origin}/${studio.profile.username}`}
        modes={modes}
        needsYou={fresh}
        personalUrl={studio.profile.username ? `${origin}/${studio.profile.username}` : null}
        plan={billing.plan}
        profile={studio.profile}
        shareUrl={shareUrl}
        signOut={signOut}
      >
        {!studio.mode.is_enabled && <div className="print:hidden"><CreatorOffBanner modeId={studio.mode.id} profileId={studio.userId} published={studio.profile.is_published} /></div>}
        {children}
      </StudioShell>
    </div>
  );
}
