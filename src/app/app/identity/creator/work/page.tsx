import type { Metadata } from "next";

import { creatorSteps, FirstRun } from "@/components/creator/creator-dashboard";
import { StudioPage } from "@/components/creator/studio-ui";
import { WorkStudio } from "@/components/creator/work-studio";
import { isWorkBlock, platformAccounts } from "@/lib/creator/studio";
import { loadCreatorStudio } from "@/lib/creator/studio-server";

export const metadata: Metadata = { title: "Work · Creator · Setuvara" };

export default async function CreatorWorkPage() {
  const studio = await loadCreatorStudio("/app/identity/creator/work");
  if (!studio.mode) return null;
  const rawData = Object.fromEntries(studio.blocks.filter(isWorkBlock).map((block) => [block.id, block.data as Record<string, unknown>]));
  const steps = creatorSteps(studio, platformAccounts(studio.links).filter((item) => item.link), studio.actions.filter((item) => item.status === "published").length);
  const done = steps.filter((step) => step.done).length;
  // A new Creator gets the first-run steps beside the empty Work, as on the Creator dashboard.
  const firstRun = studio.work.length === 0 && done < 2 ? <FirstRun cta={false} done={done} steps={steps} /> : null;
  return (
    <StudioPage>
      <WorkStudio aside={firstRun} blockCount={studio.blocks.length} items={studio.work} modeId={studio.mode.id} profileId={studio.userId} rawData={rawData} />
    </StudioPage>
  );
}
