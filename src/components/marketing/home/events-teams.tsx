import Link from "next/link";

import { CharacterAvatar } from "@/components/avatar/character-avatar";

import { Display, Label, LaterTag, Shell } from "./primitives";
import { TeamsConsole } from "./teams-console";

export function Events() {
  return (
    <section aria-labelledby="events-title" className="scroll-mt-16 bg-coral" id="events">
      <Shell className="flex flex-col gap-10 py-16 sm:gap-14 sm:py-28 lg:gap-20 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <div className="flex flex-col gap-5">
            <Label>For events</Label>
            <Display className="text-[clamp(52px,8vw,132px)] leading-[0.84]"><span id="events-title">Your identity for this moment.</span></Display>
          </div>
          <p className="max-w-[30rem] text-[17px] leading-[1.5] sm:text-[19px]">Set it before. Share it in the room. Remember everyone after.</p>
        </div>

        <ol aria-label="Event Mode before, during and after" className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-1 sm:scroll-px-8 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0" tabIndex={0}>
          <li className="reveal flex w-[84%] max-w-[380px] shrink-0 snap-start flex-col gap-4 lg:w-auto lg:max-w-none">
            <Step index="01" title="Before" line="Set up Event Mode." />
            <div aria-hidden="true" className="flex flex-1 flex-col gap-2.5 rounded-[1.75rem] bg-paper p-5">
              <Field label="Event" value="Slush" />
              <Field label="City" value="Helsinki" />
              <Field label="Role" value="Partnerships · Lumen Labs" />
              <Field label="Here to meet" value="Climate founders and grid operators" />
            </div>
          </li>
          <li className="reveal flex w-[84%] max-w-[380px] shrink-0 snap-start flex-col gap-4 lg:w-auto lg:max-w-none">
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
          <li className="reveal flex w-[84%] max-w-[380px] shrink-0 snap-start flex-col gap-4 lg:w-auto lg:max-w-none">
            <Step index="03" title="After" line="Everyone from Slush, in one place." />
            <div aria-hidden="true" className="flex flex-1 flex-col rounded-[1.75rem] bg-paper p-5">
              <div className="flex items-center justify-between border-b border-ink/15 pb-3">
                <span className="text-[14px] font-semibold">Slush · Helsinki</span>
                <span className="font-label text-[10px] uppercase tracking-[0.14em] text-ink/55">3 people</span>
              </div>
              {[["Lena Fischer", "Product Designer · Atelier Nord"], ["Jonas Berg", "Talent · Lumen Labs"], ["Elif Demir", "Founder · Kestrel Grid"]].map(([name, role]) => (
                <div className="flex items-center gap-3 border-b border-ink/10 py-3 last:border-0" key={name}>
                  <CharacterAvatar className="size-9 shrink-0 rounded-full" seed={name} />
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
      <p className="mt-1 hidden text-[14px] sm:block">{line}</p>
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
  "Company branding for every employee",
  "Lead attribution by event",
  "Team connections",
];


export function Teams() {
  return (
    <section aria-labelledby="teams-title" className="scroll-mt-16" id="teams">
      <Shell className="grid grid-cols-[minmax(0,1fr)] gap-10 py-16 sm:gap-12 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-20 lg:py-36">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3"><Label>For teams</Label><LaterTag>In development</LaterTag></div>
          <Display className="text-[clamp(44px,5.6vw,92px)] leading-[0.9]"><span id="teams-title">Built for people. Ready for teams.</span></Display>
          <p className="max-w-[30rem] text-[17px] leading-[1.5] text-ink/70">Your company’s Business Mode, worn by your people.</p>
          <ul className="border-t border-ink/15">
            {teamCapabilities.map((item) => (
              <li className="flex items-center justify-between gap-4 border-b border-ink/15 py-3 text-[15px] sm:py-3.5" key={item}>
                <span>{item}</span>
                <span className="shrink-0 font-label text-[10px] uppercase tracking-[0.14em] text-ink/45">Planned</span>
              </li>
            ))}
          </ul>
          <Link className="inline-flex min-h-11 items-center gap-2 self-start text-[16px] font-semibold underline decoration-[1.5px] underline-offset-[6px] hover:text-coral focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral" href="/teams">Setuvara for Teams <span aria-hidden="true">→</span></Link>
        </div>

        <TeamsConsole />
      </Shell>
    </section>
  );
}
