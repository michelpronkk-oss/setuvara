import type { Metadata } from "next";

import { StudioPage } from "@/components/creator/studio-ui";
import { WorkStudio } from "@/components/creator/work-studio";
import { isWorkBlock } from "@/lib/creator/studio";
import { loadCreatorStudio } from "@/lib/creator/studio-server";

export const metadata: Metadata = { title: "Work · Creator · Setuvara" };

export default async function CreatorWorkPage() {
  const studio = await loadCreatorStudio("/app/identity/creator/work");
  if (!studio.mode) return null;
  const rawData = Object.fromEntries(studio.blocks.filter(isWorkBlock).map((block) => [block.id, block.data as Record<string, unknown>]));
  return (
    <StudioPage>
      <WorkStudio blockCount={studio.blocks.length} items={studio.work} modeId={studio.mode.id} profileId={studio.userId} rawData={rawData} />
    </StudioPage>
  );
}
