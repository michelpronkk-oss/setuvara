import Link from "next/link";
import { notFound } from "next/navigation";

import { Head } from "@/components/actions/actions-pages";
import { MemberBadge } from "@/components/app/status-badge";
import { EmptyState, Mono, StudioPage, inkButton } from "@/components/creator/studio-ui";
import { loadTeam } from "@/lib/business/studio-server";
import { ROLE_LABEL, ROLE_NOTE, seatCount, TEAM_ROLES } from "@/lib/business/team";
import { RoutingCard } from "./routing-card";
import { TeamBoard } from "./team-client";

/** Action kinds whose Business Mode responses become leads. */
const LEAD_KINDS: string[] = ["collab", "booking", "submission", "form"];

const eyebrow = <><span aria-hidden="true" className="size-2 rounded-full bg-[#C7FF4A] shadow-[inset_0_0_0_1px_rgba(13,13,13,.25)]" />Business Mode</>;

/** Business Mode's team: who works the leads with the owner, and the seats Pro gives. */
export async function TeamIndex() {
  const data = await loadTeam();
  if (!data.mode) notFound();
  if (!data.ready) return <StudioPage><Head eyebrow={eyebrow} title="Team" /><EmptyState body="Teams need a database update that hasn't reached this site yet." title="Not ready yet." /></StudioPage>;
  const { team } = data;
  const { used } = seatCount(team);

  if (team.seats === 0) {
    return (
      <StudioPage className="max-w-[1180px]">
        <Head eyebrow={eyebrow} sub="Bring the people who answer your leads." title="Team" />
        <section className="relative overflow-hidden rounded-[30px] bg-[#0D0D0D] p-7 text-[#F5F4EF] md:p-10" data-team-upsell>
          <span aria-hidden="true" className="absolute -right-24 -top-24 size-72 rounded-full bg-[#C7FF4A]/25 blur-3xl" />
          <Mono className="relative flex items-center gap-2 text-[#e8d28a]"><MemberBadge decorative size={16} tier="pro" />Pro</Mono>
          <h2 className="relative mt-4 max-w-[16ch] font-display text-[40px] font-bold leading-[0.95] tracking-[-0.05em] md:text-[56px]">Work your leads together.</h2>
          <p className="relative mt-4 max-w-[52ch] text-[16px] leading-[1.5] text-white/65">Invite up to five teammates by email. They sign in with their own account, see your leads and bookings coming up, and move them along. You keep your page, Actions and testimonials.</p>
          <ul className="relative mt-6 grid max-w-[640px] gap-2 sm:grid-cols-2">
            {TEAM_ROLES.map((role) => (
              <li className="rounded-[18px] bg-white/[0.06] p-4" key={role}><p className="text-[15px] font-semibold">{ROLE_LABEL[role]}</p><p className="mt-1 text-[13.5px] text-white/55">{ROLE_NOTE[role]}</p></li>
            ))}
          </ul>
          <Link className={`${inkButton} relative mt-7 bg-[#F5F4EF] text-[#0D0D0D] hover:bg-white`} href="/app/settings/billing">See Pro</Link>
        </section>
      </StudioPage>
    );
  }

  return (
    <StudioPage className="max-w-[1180px]">
      <Head eyebrow={eyebrow} sub={`${used} of ${team.seats} seats · ${team.members.filter((member) => member.status === "active").length} joined`} title="Team" />
      <TeamBoard business={data.profile.display_name} ownerEmail={data.email} owner={data.profile.display_name} team={team}
        routing={data.routing && <RoutingCard actions={data.actions.filter((action) => LEAD_KINDS.includes(action.kind)).map(({ id, title }) => ({ id, title }))} people={data.people} routing={data.routing} />} />
    </StudioPage>
  );
}
