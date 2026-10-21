"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { inviteTeammate, removeTeammate, setTeammateRole } from "@/app/app/identity/team/actions";
import { inkButton, Mono } from "@/components/creator/studio-ui";
import { relativeTime } from "@/lib/creator/studio";
import { inviteProblem, memberName, ROLE_LABEL, ROLE_NOTE, seatCount, TEAM_ROLES, teamInviteMail, type Team, type TeamMember, type TeamRole } from "@/lib/business/team";

const field = "min-h-11 w-full rounded-full bg-white px-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]";

function RolePicker({ value, onChange, disabled, label }: { value: TeamRole; onChange: (role: TeamRole) => void; disabled?: boolean; label: string }) {
  return (
    <div aria-label={label} className="grid grid-cols-2 gap-1 rounded-full bg-black/[0.05] p-1" role="radiogroup">
      {TEAM_ROLES.map((role) => (
        <button aria-checked={value === role} className={`min-h-9 rounded-full px-3 text-[13px] font-semibold transition disabled:opacity-50 ${value === role ? "bg-white text-[#0D0D0D] shadow-[0_1px_2px_rgba(13,13,13,.12)]" : "text-black/55 hover:text-[#0D0D0D]"}`}
          disabled={disabled} key={role} onClick={() => onChange(role)} role="radio" type="button">{ROLE_LABEL[role]}</button>
      ))}
    </div>
  );
}

/** The invite link just made, with copy and a prefilled email. Shown once: only a fingerprint is kept. */
function InviteLink({ url, email, role, owner, business }: { url: string; email: string; role: TeamRole; owner: string; business: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-[20px] bg-[#0D0D0D] p-4 text-[#F5F4EF]" data-invite-link>
      <Mono className="text-[#C7FF4A]">Invite for {email} · 7 days</Mono>
      <p className="break-all font-label text-[13px] text-white/85">{url}</p>
      <div className="flex flex-wrap gap-2">
        <button className="inline-flex min-h-10 items-center rounded-full bg-[#F5F4EF] px-4 text-[14px] font-semibold text-[#0D0D0D]" onClick={() => void navigator.clipboard?.writeText(url).then(() => setCopied(true))} type="button">{copied ? "Copied" : "Copy link"}</button>
        <a className="inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-semibold text-[#F5F4EF] shadow-[inset_0_0_0_1px_rgba(245,244,239,.3)]" href={teamInviteMail({ to: email, owner, business, role, url })}>Email it</a>
      </div>
      <p className="text-[12.5px] text-white/55">Only {email} can accept it, signed in with that address. Copy it now: Setuvara keeps only a fingerprint.</p>
    </div>
  );
}

function MemberRow({ member, busy, onRole, onRemove }: { member: TeamMember; busy: boolean; onRole: (role: TeamRole) => void; onRemove: () => void }) {
  const name = memberName(member);
  const invited = member.status === "invited";
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center md:px-5" data-member={member.status}>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full text-[15px] font-semibold ${invited ? "bg-black/[0.06] text-black/45" : "bg-[#0D0D0D] text-[#F5F4EF]"}`}>{name.charAt(0).toUpperCase()}</span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{name}</span>
          <span className="block truncate text-[13px] text-black/55">
            {invited ? `Invited ${relativeTime(member.created_at)} · not joined yet` : `${member.email} · joined ${relativeTime(member.accepted_at ?? member.created_at)}`}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-2 sm:w-[300px]">
        <span className="flex-1"><RolePicker disabled={busy} label={`Role for ${name}`} onChange={onRole} value={member.role} /></span>
        <button className="min-h-10 shrink-0 rounded-full px-3 text-[13px] font-semibold text-black/45 transition hover:text-[#B42318]" disabled={busy} onClick={onRemove} type="button">{invited ? "Cancel" : "Remove"}</button>
      </span>
    </li>
  );
}

/** Invite, change roles, remove. Access is checked on every request, so a change applies at once. */
export function TeamBoard({ team, owner, ownerEmail, business, routing }: { team: Team; owner: string; ownerEmail: string | null; business: string; /** The Lead routing card, beside the invite. */ routing?: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("member");
  const [fresh, setFresh] = useState<{ url: string; email: string; role: TeamRole } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { left } = seatCount(team);
  const run = (task: () => Promise<{ ok: boolean; error?: string }>) => { setError(null); start(async () => { const result = await task(); if (!result.ok) setError(result.error ?? "Try again."); else router.refresh(); }); };
  function invite() {
    const problem = inviteProblem(email, ownerEmail);
    if (problem) { setError(problem); return; }
    setError(null);
    start(async () => {
      const result = await inviteTeammate(email.trim(), role);
      if (!result.ok) { setError(result.error); return; }
      setFresh({ url: result.url, email: email.trim(), role });
      setEmail("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <div aria-hidden="true" className="flex gap-1.5" data-seats={team.seats}>
          {Array.from({ length: team.seats }, (_, index) => (
            <span className={`h-2 flex-1 rounded-full ${index < team.members.length ? "bg-[#0D0D0D]" : "bg-black/[0.08]"}`} key={index} />
          ))}
        </div>
        {error && <p className="text-[14px] font-semibold text-[#B42318]" role="alert">{error}</p>}
        <ul className="divide-y divide-black/[0.07] overflow-hidden rounded-[22px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
          <li className="flex items-center gap-3 px-4 py-4 md:px-5" data-member="owner">
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#C7FF4A] text-[15px] font-semibold text-[#0D0D0D] shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]">{owner.charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{owner} <span className="font-normal text-black/45">(you)</span></span><span className="block truncate text-[13px] text-black/55">Page, Actions, hours, testimonials and the team</span></span>
            <span className="shrink-0 rounded-full bg-[#0D0D0D] px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.12em] text-[#C7FF4A]">{ROLE_LABEL.owner}</span>
          </li>
          {team.members.map((member) => (
            <MemberRow busy={pending} key={member.id} member={member}
              onRemove={() => { if (window.confirm(member.status === "invited" ? `Cancel the invite for ${member.email}?` : `Remove ${memberName(member)}? They lose access now.`)) run(() => removeTeammate(member.id)); }}
              onRole={(next) => { if (next !== member.role) run(() => setTeammateRole(member.id, next)); }} />
          ))}
        </ul>
        {team.members.length === 0 && <p className="text-[14px] text-black/55">Nobody yet. Invite the people who answer your leads.</p>}
      </div>

      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
        <section aria-labelledby="invite-title" className="flex flex-col gap-3 rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-[22px] font-bold tracking-[-0.035em]" id="invite-title">Invite</h2>
            <Mono className="text-black/45">{left} {left === 1 ? "seat" : "seats"} left</Mono>
          </div>
          <label className="sr-only" htmlFor="invite-email">Their email</label>
          <input autoComplete="off" className={field} disabled={left === 0} id="invite-email" inputMode="email" maxLength={254} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") invite(); }} placeholder="name@company.com" type="email" value={email} />
          <RolePicker disabled={left === 0} label="Role" onChange={setRole} value={role} />
          <p className="text-[13px] leading-[1.45] text-black/55">{ROLE_NOTE[role]}</p>
          <button className={inkButton} disabled={pending || left === 0 || !email.trim()} onClick={invite} type="button">{pending ? "Inviting…" : "Make an invite link"}</button>
          {fresh && <InviteLink business={business} email={fresh.email} owner={owner} role={fresh.role} url={fresh.url} />}
        </section>
        {routing}
        <p className="px-1 text-[13px] leading-[1.5] text-black/50">Teammates use their own Setuvara account. They never see your billing, page editor or private links, and if Pro ends, their access pauses until it&apos;s back.</p>
      </aside>
    </div>
  );
}
