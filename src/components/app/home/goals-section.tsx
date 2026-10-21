import Link from "next/link";

import { GOALS, goalsHref, isGoalId, recordHref, type GoalProgress } from "@/lib/goals/templates";
import { createClient } from "@/lib/supabase/server";

const STATUS: Record<string, string> = { draft: "Draft", published: "Live", closed: "Closed", archived: "Archived", cancelled: "Cancelled", active: "Live", paused: "Paused" };

/** The latest goals and how each record is doing; a quiet prompt when there are none yet. */
export async function GoalsSection() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("goal_progress");
  if (error) return null;
  const goals = ((data ?? []) as GoalProgress[]).filter((goal) => isGoalId(goal.template)).slice(0, 2);
  if (!goals.length) {
    return (
      <Link className="flex items-center justify-between gap-4 rounded-[26px] bg-white px-5 py-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]" href={goalsHref()}>
        <span><span className="block font-semibold">Start from a goal</span><span className="text-[14px] text-black/60">Get clients, grow an audience, host an event. A few questions, ready-made drafts.</span></span>
        <span aria-hidden="true" className="text-black/40">→</span>
      </Link>
    );
  }
  return (
    <section aria-labelledby="home-goals" className="rounded-[26px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-[22px] font-bold tracking-[-0.04em]" id="home-goals">Goals</h2><Link className="text-[14px] font-semibold text-black/55 hover:text-black" href={goalsHref()}>New goal</Link></div>
      <ul className="grid gap-3">
        {goals.map((goal) => {
          const live = goal.records.filter((record) => record.status === "published" || record.status === "active").length;
          const responses = goal.records.reduce((sum, record) => sum + Number(record.responses ?? 0), 0);
          return (
            <li className="rounded-[18px] bg-[#F5F4EF] p-4" key={goal.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-semibold">{GOALS[goal.template].name}</span><span className="text-[13px] text-black/60">{live} of {goal.records.length} live · {responses} {responses === 1 ? "response" : "responses"}</span></div>
              <ul className="mt-2 flex flex-wrap gap-2">
                {goal.records.map((record) => <li key={record.id}><Link className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3 text-[13px] font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]" href={recordHref(record, goal.mode_slug)}>{record.title}<span className="font-normal text-black/50">{STATUS[record.status ?? ""] ?? record.status}</span></Link></li>)}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
