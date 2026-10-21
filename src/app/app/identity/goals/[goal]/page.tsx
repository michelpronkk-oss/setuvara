import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Mono, StudioHead, StudioPage } from "@/components/creator/studio-ui";
import { GoalSetup } from "@/components/goals/goal-setup";
import { GOALS, goalsHref, isGoalId } from "@/lib/goals/templates";
import { createClient } from "@/lib/supabase/server";

const requestTime = () => Date.now();

export async function generateMetadata({ params }: { params: Promise<{ goal: string }> }): Promise<Metadata> {
  const { goal } = await params;
  return { title: `${isGoalId(goal) ? GOALS[goal].name : "Goal"} · Setuvara` };
}

export default async function GoalPage({ params }: { params: Promise<{ goal: string }> }) {
  const { goal: id } = await params;
  if (!isGoalId(id)) notFound();
  const goal = GOALS[id];
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) redirect(`/login?next=/app/identity/goals/${id}`);
  const [{ data: profile }, { data: mode }, { data: access }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("profile_modes").select("id, is_enabled").eq("profile_id", userId).eq("slug", goal.mode).maybeSingle(),
    supabase.rpc("goal_template_access"),
  ]);
  if (!mode) notFound();
  const firstName = ((profile?.display_name as string | undefined) ?? "").split(/\s+/)[0] ?? "";
  const locked = (access as Record<string, boolean> | null)?.[id] !== true;
  return (
    <StudioPage>
      <Link className="mb-4 inline-flex text-[14px] font-semibold text-black/55 hover:text-black" href={goalsHref(goal.mode)}>← All goals</Link>
      <Mono className="text-black/55">{goal.mode[0].toUpperCase() + goal.mode.slice(1)} Mode · Goal</Mono>
      <StudioHead sub={goal.promise} title={goal.name} />
      <GoalSetup firstName={firstName} goalId={id} initial={goal.defaults({ firstName, now: requestTime(), timezone: "UTC" })} locked={locked} />
    </StudioPage>
  );
}
