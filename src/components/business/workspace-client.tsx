"use client";

import { confirmDialog } from "@/components/app/confirm-dialog";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { removeTeammate } from "@/app/app/identity/team/actions";
import { TEAMS_HREF } from "@/lib/business/team";

/** A teammate leaves a business's team. Access ends at once. */
export function LeaveTeam({ memberId, name }: { memberId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className="min-h-10 shrink-0 rounded-full px-3 text-[13px] font-semibold text-black/45 transition hover:text-[#B42318] disabled:opacity-50" disabled={pending}
      onClick={async () => { if (await confirmDialog({ title: `Leave ${name}'s team?`, body: "You'll need a new invite to come back.", action: "Leave team", tone: "danger" })) start(async () => { const result = await removeTeammate(memberId); if (result.ok) { router.push(TEAMS_HREF); router.refresh(); } }); }} type="button">
      Leave
    </button>
  );
}
