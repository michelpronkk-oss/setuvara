import Link from "next/link";

import { Display, Label, LaterTag, Shell } from "./primitives";

export function Events() {
  return (
    <section aria-labelledby="events-title" className="scroll-mt-16 bg-coral" id="events">
      <Shell className="flex flex-col gap-14 py-20 sm:py-28 lg:gap-20 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <div className="flex flex-col gap-5">
            <Label>For events</Label>
            <Display className="text-[clamp(52px,8vw,132px)] leading-[0.84]"><span id="events-title">Your identity for this moment.</span></Display>
          </div>
          <p className="max-w-[30rem] text-[17px] leading-[1.55] sm:text-[19px]">Conferences, festivals, meetups, campus nights. Set up Event Mode before you go, share it in the room, and leave with everyone you met — remembered by event.</p>
        </div>

        <ol className="grid gap-5 lg:grid-cols-3 lg:gap-6">
          <li className="reveal flex flex-col gap-4">
            <Step index="01" title="Before" line="Set up Event Mode." />
            <div aria-hidden="true" className="flex flex-1 flex-col gap-2.5 rounded-[1.75rem] bg-paper p-5">
              <Field label="Event" value="Slush" />
              <Field label="City" value="Helsinki" />
              <Field label="Role" value="Partnerships · Lumen Labs" />
              <Field label="Here to meet" value="Climate founders and grid operators" />
            </div>
          </li>
          <li className="reveal flex flex-col gap-4">
            <Step index="02" title="At the event" line="Share the version that fits the room." />
            <div aria-hidden="true" className="flex flex-1 flex-col justify-between gap-6 rounded-[1.75rem] bg-ink p-6 text-paper">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-display text-[clamp(52px,6vw,76px)] font-extrabold leading-[0.82] tracking-[-0.06em] text-coral">SLUSH</p>
                <p className="text-right text-[12px] text-paper/60">Helsinki</p>
              </div>
              <div>
                <p className="font-display text-[30px] font-bold leading-none tracking-[-0.045em]">Aanya Rao</p>
                <p className="mt-1.5 text-[13px] text-paper/60">Partnerships · Lumen Labs</p>
              </div>
              <span className="flex h-12 items-center justify-center rounded-full bg-coral text-[14px] font-semibold text-ink">Connect</span>
            </div>
          </li>
          <li className="reveal flex flex-col gap-4">
            <Step index="03" title="After" line="Everyone from Slush, in one place." />
            <div aria-hidden="true" className="flex flex-1 flex-col rounded-[1.75rem] bg-paper p-5">
              <div className="flex items-center justify-between border-b border-ink/15 pb-3">
                <span className="text-[14px] font-semibold">Slush · Helsinki</span>
                <span className="font-label text-[10px] uppercase tracking-[0.14em] text-ink/55">3 people</span>
              </div>
              {[["Lena Fischer", "Product Designer · Atelier Nord"], ["Jonas Berg", "Talent · Lumen Labs"], ["Elif Demir", "Founder · Kestrel Grid"]].map(([name, role]) => (
                <div className="flex items-center gap-3 border-b border-ink/10 py-3 last:border-0" key={name}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink font-display text-[14px] font-bold text-paper">{name.slice(0, 1)}</span>
                  <span className="min-w-0"><span className="block truncate text-[14px] font-semibold">{name}</span><span className="block truncate text-[12px] text-ink/55">{role}</span></span>
                </div>
              ))}
            </div>
          </li>
        </ol>

        <Link className="inline-flex min-h-11 items-center gap-2 self-start text-[16px] font-semibold underline decoration-[1.5px] underline-offset-[6px] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" href="/events">Setuvara for Events <span aria-hidden="true">→</span></Link>
      </Shell>
    </section>
  );
}

function Step({ index, title, line }: { index: string; title: string; line: string }) {
  return (
    <div className="border-b-[1.5px] border-ink pb-3">
      <p className="flex items-baseline gap-3">
        <span className="font-label text-[11px] tracking-[0.14em]">{index}</span>
        <span className="font-display text-[26px] font-bold tracking-[-0.04em]">{title}</span>
      </p>
      <p className="mt-1 text-[14px]">{line}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink/15 bg-white px-4 py-2.5">
      <span className="block font-label text-[10px] uppercase tracking-[0.14em] text-ink/50">{label}</span>
      <span className="mt-0.5 block text-[15px] font-semibold">{value}</span>
    </div>
  );
}

const teamCapabilities = [
  "Managed Business Mode templates",
  "Consistent company identity for every employee",
  "Employee sharing at events and on the road",
  "Lead attribution by event and team member",
  "Team connections, shared where it makes sense",
];

const team = [
  { initials: "AR", name: "Aanya Rao", role: "Partnerships Lead", tone: "bg-coral text-ink" },
  { initials: "JB", name: "Jonas Berg", role: "Talent", tone: "bg-sky text-ink" },
  { initials: "MT", name: "Mei Tanaka", role: "Solutions Engineer", tone: "bg-lime text-ink" },
];

export function Teams() {
  return (
    <section aria-labelledby="teams-title" className="scroll-mt-16" id="teams">
      <Shell className="grid grid-cols-[minmax(0,1fr)] gap-12 py-20 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-20 lg:py-36">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3"><Label>For teams</Label><LaterTag>In development</LaterTag></div>
          <Display className="text-[clamp(44px,5.6vw,92px)] leading-[0.9]"><span id="teams-title">Built for people. Ready for teams.</span></Display>
          <p className="max-w-[30rem] text-[17px] leading-[1.55] text-ink/70">Setuvara starts with each person’s own identity. Teams is the next layer: the company’s Business Mode, worn by the people who actually meet customers.</p>
          <ul className="border-t border-ink/15">
            {teamCapabilities.map((item) => (
              <li className="flex items-center justify-between gap-4 border-b border-ink/15 py-3.5 text-[15px]" key={item}>
                <span>{item}</span>
                <span className="shrink-0 font-label text-[10px] uppercase tracking-[0.14em] text-ink/45">Planned</span>
              </li>
            ))}
          </ul>
          <Link className="inline-flex min-h-11 items-center gap-2 self-start text-[16px] font-semibold underline decoration-[1.5px] underline-offset-[6px] hover:text-coral focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral" href="/teams">Setuvara for Teams <span aria-hidden="true">→</span></Link>
        </div>

        <div aria-label="Concept preview of a team identity" className="reveal flex flex-col gap-5 rounded-[2rem] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] sm:p-8" role="group">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-[30px] font-extrabold tracking-[-0.045em]">Lumen Labs</p>
            <Label className="!text-[10px] text-ink/50">Concept preview</Label>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {team.map((member) => (
              <div className="flex flex-col gap-3 rounded-[1.25rem] bg-paper p-3 sm:gap-4 sm:p-4" key={member.initials}>
                <div className="flex items-start justify-between">
                  <span className={`grid size-10 place-items-center rounded-xl font-display text-[14px] font-bold sm:size-12 sm:text-[16px] ${member.tone}`}>{member.initials}</span>
                  <span className="hidden font-label text-[9px] uppercase tracking-[0.16em] text-ink/45 sm:inline">Business</span>
                </div>
                <div>
                  <p className="text-[14px] font-semibold leading-tight sm:text-[16px]">{member.name}</p>
                  <p className="mt-0.5 text-[12px] text-ink/60">{member.role}</p>
                </div>
                <div className="hidden flex-col gap-1.5 border-t border-ink/10 pt-3 text-[12px] font-medium sm:flex">
                  <span>LinkedIn</span><span>Book a meeting</span><span>Company website</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[13px] leading-5 text-ink/55">One template, three people. Each still owns their identity and Personal Mode.</p>
        </div>
      </Shell>
    </section>
  );
}
