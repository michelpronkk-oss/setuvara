import Link from "next/link";

import { PlusTag } from "@/app/app/identity/editor-ui";
import { Mono } from "@/components/creator/studio-ui";
import type { ModeSlug } from "@/components/profile/types";
import { GOALS, goalHref, MODE_GOALS } from "@/lib/goals/templates";

const MODE_NAME: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" };
const MODE_DOT: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF", creator: "#E8A6FF" };

/** Goals for each Mode the owner has, starter first. Locked goals say so instead of hiding. */
export function GoalPicker({ modes, access }: { modes: ModeSlug[]; access: Record<string, boolean> }) {
  return (
    <div className="grid gap-10">
      {modes.map((mode) => (
        <section aria-labelledby={`goals-${mode}`} key={mode}>
          <h2 className="mb-3 flex items-center gap-2" id={`goals-${mode}`}><span aria-hidden="true" className="size-2 rounded-full" style={{ background: MODE_DOT[mode] }} /><Mono className="text-black/60">{MODE_NAME[mode]} Mode</Mono></h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {MODE_GOALS[mode].map((id) => {
              const goal = GOALS[id];
              return (
                <li key={id}>
                  <Link className="group flex h-full flex-col justify-between gap-6 rounded-[26px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition hover:-translate-y-0.5 hover:shadow-[inset_0_0_0_1.5px_#0D0D0D,0_18px_40px_-28px_rgba(13,13,13,.5)] focus-visible:outline-2" href={goalHref(id)}>
                    <span>
                      <span className="flex flex-wrap items-center gap-2"><span className="font-display text-[24px] font-bold leading-[1.02] tracking-[-0.04em]">{goal.name}</span>{access[id] === false && <PlusTag />}{goal.free && <span className="rounded-full bg-[#F5F4EF] px-2 py-0.5 font-label text-[10px] uppercase tracking-[0.12em] text-black/55">Starter</span>}</span>
                      <span className="mt-2 block text-[15px] leading-[1.45] text-black/65">{goal.promise}</span>
                    </span>
                    <span className="text-[14px] font-semibold text-black/45 transition group-hover:text-black">{goal.fields.length} questions →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
