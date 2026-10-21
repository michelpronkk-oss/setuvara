import Link from "next/link";
import { notFound } from "next/navigation";

import { Head } from "@/components/actions/actions-pages";
import { EmptyState, Mono, StudioPage } from "@/components/creator/studio-ui";
import { loadMemberships, loadWorkspace } from "@/lib/business/studio-server";
import { ROLE_LABEL, TEAMS_HREF, workspaceHref } from "@/lib/business/team";
import { LeadsInbox } from "./leads-client";
import { ComingUp } from "./leads-pages";
import { LeaveTeam } from "./workspace-client";

const dot = <span aria-hidden="true" className="size-2 rounded-full bg-[#AFCBFF] shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]" />;

/** The businesses someone works for. One opens straight into its leads. */
export async function TeamsIndex() {
  const { memberships } = await loadMemberships();
  return (
    <StudioPage className="max-w-[920px] pb-10">
      <Head eyebrow={<>{dot}Teams</>} sub="Businesses that brought you in to work their leads." title="Teams" />
      {memberships.length === 0 ? (
        <EmptyState body="When a business on Setuvara Pro invites you, accept from the link in their email and their leads show up here." title="No teams yet." />
      ) : (
        <ul className="divide-y divide-black/[0.07] overflow-hidden rounded-[22px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
          {memberships.map((team) => (
            <li className="flex items-center gap-3 px-4 py-4 md:px-5" data-team={team.open ? "open" : "paused"} key={team.member_id}>
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[#0D0D0D] font-display text-[18px] font-bold text-[#AFCBFF]">{(team.company || team.display_name).charAt(0).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{team.company || team.display_name}</span>
                <span className="block truncate text-[13px] text-black/55">{ROLE_LABEL[team.role]}{team.open ? "" : " · paused while their plan has no team"}</span>
              </span>
              {team.open
                ? <Link className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-[#0D0D0D] px-4 text-[14px] font-semibold text-[#F5F4EF]" href={workspaceHref(team.business_id)}>Open leads</Link>
                : <LeaveTeam memberId={team.member_id} name={team.company || team.display_name} />}
            </li>
          ))}
        </ul>
      )}
    </StudioPage>
  );
}

/** A teammate's view of one business: bookings coming up and the lead inbox, on the owner's plan. */
export async function WorkspaceIndex({ businessId }: { businessId: string }) {
  const data = await loadWorkspace(businessId);
  if (!data) notFound();
  const { workspace, leads, people } = data;
  const name = workspace.company || workspace.display_name;
  const open = leads.filter((lead) => lead.stage === "new" || lead.stage === "contacted" || lead.stage === "qualified").length;
  const { memberships } = await loadMemberships();
  const membership = memberships.find((item) => item.business_id === businessId);
  return (
    <StudioPage className="max-w-[1180px] pb-10">
      <Head
        action={<span className="flex items-center gap-2">
          <span className="rounded-full bg-[#0D0D0D] px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.12em] text-[#C7FF4A]">{ROLE_LABEL[workspace.role]}</span>
          {membership && <LeaveTeam memberId={membership.member_id} name={name} />}
        </span>}
        back={{ href: TEAMS_HREF, label: "Teams" }}
        eyebrow={<>{dot}{name} · Business Mode</>}
        sub={leads.length ? `${open} open · ${leads.filter((lead) => lead.stage === "new").length} new` : "Every inquiry to this business lands here as a lead."}
        title="Leads"
      />
      <ComingUp bookings={workspace.bookings} linked={false} />
      {leads.length === 0 ? (
        <EmptyState body={`When someone books, asks or pitches ${name} through their page, the lead shows up here for the whole team.`} title="No leads yet." />
      ) : (
        <LeadsInbox business={businessId} canExport={workspace.limits.can_export} canNote={workspace.limits.can_note} leads={leads} owner={workspace.display_name} people={people} />
      )}
      <Mono className="mt-8 text-black/40">You work these leads with {workspace.display_name}. Changes show for everyone on the team.</Mono>
    </StudioPage>
  );
}
