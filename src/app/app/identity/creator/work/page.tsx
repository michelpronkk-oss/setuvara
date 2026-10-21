import type { Metadata } from "next";

import { creatorSteps, FirstRun } from "@/components/creator/creator-dashboard";
import { StudioPage } from "@/components/creator/studio-ui";
import { WorkStudio } from "@/components/creator/work-studio";
import { isWorkBlock, platformAccounts } from "@/lib/creator/studio";
import type { WorkAccess, WorkDrop } from "@/lib/creator/fan-drops";
import { loadCreatorStudio } from "@/lib/creator/studio-server";

export const metadata: Metadata = { title: "Work · Creator · Setuvara" };

export default async function CreatorWorkPage() {
  const studio = await loadCreatorStudio("/app/identity/creator/work");
  if (!studio.mode) return null;
  const rawData = Object.fromEntries(studio.blocks.filter(isWorkBlock).map((block) => [block.id, block.data as Record<string, unknown>]));
  const steps = creatorSteps(studio, platformAccounts(studio.links).filter((item) => item.link), studio.actions.filter((item) => item.status === "published").length);
  const done = steps.filter((step) => step.done).length;
  // Who can open each piece and when it drops, read as the creator under RLS.
  const [{ data: rules }, { data: drops }] = await Promise.all([
    studio.supabase.from("creator_content_rules").select("profile_block_id, access_level, teaser_title").eq("creator_user_id", studio.userId),
    studio.supabase.from("creator_drops").select("id, profile_block_id, starts_at, early_access_level, early_access_starts_at, status").eq("creator_user_id", studio.userId).in("status", ["scheduled", "live"]),
  ]);
  const access = Object.fromEntries(((rules ?? []) as WorkAccess[]).map((row) => [row.profile_block_id, row]));
  const dropsByBlock = Object.fromEntries(((drops ?? []) as WorkDrop[]).map((row) => [row.profile_block_id, row]));
  // A new Creator gets the first-run steps beside the empty Work, as on the Creator dashboard.
  const firstRun = studio.work.length === 0 && done < 2 ? <FirstRun cta={false} done={done} steps={steps} /> : null;
  return (
    <StudioPage>
      <WorkStudio access={access} aside={firstRun} drops={dropsByBlock} blockCount={studio.blocks.length} items={studio.work} modeId={studio.mode.id} profileId={studio.userId} rawData={rawData} />
    </StudioPage>
  );
}
