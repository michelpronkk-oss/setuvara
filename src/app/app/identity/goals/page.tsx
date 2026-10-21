import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StudioHead, StudioPage } from "@/components/creator/studio-ui";
import { GoalPicker } from "@/components/goals/goal-picker";
import type { ModeSlug } from "@/components/profile/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Goals · Setuvara" };
const ORDER: ModeSlug[] = ["personal", "business", "creator", "event"];

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) redirect("/login?next=/app/identity/goals");
  const [{ data: rows }, { data: access }] = await Promise.all([
    supabase.from("profile_modes").select("slug").eq("profile_id", userId).eq("is_enabled", true),
    supabase.rpc("goal_template_access"),
  ]);
  const enabled = new Set((rows ?? []).map((row) => row.slug as ModeSlug));
  const modes = ORDER.filter((slug) => enabled.has(slug)).sort((a, b) => (a === mode ? -1 : b === mode ? 1 : 0));
  return (
    <StudioPage>
      <StudioHead sub="Pick what you want to happen. Answer a few questions and Setuvara prepares the drafts. You review, edit and publish." title="What do you want to achieve?" />
      <GoalPicker access={(access as Record<string, boolean> | null) ?? {}} modes={modes.length ? modes : ["personal"]} />
    </StudioPage>
  );
}
