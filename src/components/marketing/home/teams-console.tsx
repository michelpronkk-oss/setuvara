import { Flag, type Country } from "./flag";
import { LaterTag } from "./primitives";
import { PersonPhoto, SetuvaraTile, TEAM_PEOPLE, type TeamPersonId } from "./team-people";

const roster: { id: TeamPersonId; event: string; country: Country }[] = [
  { id: "aanya", event: "Slush", country: "FI" },
  { id: "theo", event: "Web Summit", country: "PT" },
  { id: "noor", event: "SaaStock", country: "IE" },
  { id: "sena", event: "TNW Conference", country: "NL" },
];

const attribution: { event: string; country: Country; people: TeamPersonId[]; met: number }[] = [
  { event: "Slush", country: "FI", people: ["aanya", "theo", "sena"], met: 14 },
  { event: "Web Summit", country: "PT", people: ["theo", "noor"], met: 9 },
  { event: "SaaStock", country: "IE", people: ["noor", "sena"], met: 6 },
];

function Lock() {
  return <svg aria-hidden="true" className="size-3 shrink-0" fill="none" viewBox="0 0 12 12"><rect fill="currentColor" height="5.5" rx="1.2" width="8" x="2" y="5.5" /><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.3" /></svg>;
}

/** Concept preview of Teams, drawn for Setuvara's own team: a workspace console plus the shared Business template. */
export function TeamsConsole() {
  return (
    <div aria-label="Concept preview of Setuvara for Teams" className="relative isolate xl:py-6 xl:pl-[214px]" role="group">
      <span aria-hidden="true" className="absolute -right-10 top-10 -z-10 size-[70%] rounded-full bg-coral/25 blur-[90px]" />
      <span aria-hidden="true" className="absolute -bottom-6 left-10 -z-10 size-[55%] rounded-full bg-sky/40 blur-[90px]" />
      <div className="reveal overflow-hidden rounded-[2rem] bg-ink text-paper shadow-[0_50px_90px_-40px_rgba(13,13,13,.7),inset_0_0_0_1px_rgba(255,255,255,.06)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <SetuvaraTile className="size-9" />
            <div>
              <p className="text-[14px] font-semibold leading-tight">Setuvara</p>
              <p className="text-[11px] text-paper/50">Team workspace</p>
            </div>
          </div>
          <LaterTag className="text-paper/60">Concept</LaterTag>
        </div>

        <div aria-hidden="true" className="flex gap-5 border-b border-white/10 px-5 text-[12px] font-semibold sm:px-6">
          <span className="border-b-2 border-coral py-3">People</span>
          <span className="py-3 text-paper/45">Template</span>
          <span className="py-3 text-paper/45">Events</span>
        </div>

        <ul className="divide-y divide-white/[0.07] px-5 sm:px-6">
          {roster.map((member) => (
            <li className="flex items-center gap-3 py-3" key={member.id}>
              <PersonPhoto className="size-10 rounded-full ring-1 ring-white/10" id={member.id} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{TEAM_PEOPLE[member.id].name}</span>
                <span className="block truncate text-[12px] text-paper/50">{TEAM_PEOPLE[member.id].role}</span>
              </span>
              <span className="hidden min-w-0 items-center gap-1.5 text-[12px] text-paper/70 sm:flex">
                <Flag className="h-[11px] w-[16px]" country={member.country} />
                <span className="truncate">{member.event}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 font-label text-[9px] uppercase tracking-[0.14em]">
                <span className="size-1.5 rounded-full bg-coral" />Business
              </span>
            </li>
          ))}
        </ul>

        <div className="border-t border-white/10 bg-white/[0.03] px-5 py-5 sm:px-6">
          <p className="font-label text-[10px] uppercase tracking-[0.16em] text-paper/50">Connections by event</p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            {attribution.map((row) => (
              <div className="rounded-2xl bg-white/[0.05] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]" key={row.event}>
                <p className="flex items-center gap-1.5 truncate text-[12px] font-semibold"><Flag className="h-[10px] w-[15px]" country={row.country} /><span className="truncate">{row.event}</span></p>
                <p className="mt-2 font-display text-[28px] font-extrabold leading-none tracking-[-0.05em] sm:text-[32px]">{row.met}</p>
                <div className="mt-2 flex">
                  {row.people.map((id) => <PersonPhoto className="-mr-1.5 size-6 rounded-full ring-2 ring-ink" id={id} key={id} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="reveal relative z-10 mx-auto -mt-8 w-[86%] max-w-[300px] -rotate-2 rounded-[1.5rem] bg-white p-5 text-ink shadow-[0_30px_60px_-24px_rgba(13,13,13,.55),inset_0_0_0_1px_rgba(13,13,13,.06)] xl:absolute xl:-left-8 xl:top-1/2 xl:mx-0 xl:mt-0 xl:w-[236px] xl:-translate-y-1/2">
        <div className="flex items-center justify-between">
          <p className="font-label text-[10px] uppercase tracking-[0.16em] text-ink/55">Business template</p>
          <span className="flex items-center gap-1 rounded-full bg-coral/15 px-2 py-0.5 text-[10px] font-semibold text-[#a43d36]">Synced ✓</span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <SetuvaraTile className="size-11 rounded-[12px]" />
          <div>
            <p className="font-display text-[20px] font-bold leading-none tracking-[-0.04em]">Setuvara</p>
            <p className="mt-1 text-[11px] text-ink/55">Applied to every Business Mode</p>
          </div>
        </div>
        <ul className="mt-4 divide-y divide-ink/[0.07] border-y border-ink/[0.07] text-[12px]">
          {["Company name", "Logo and colors", "Booking link"].map((field) => (
            <li className="flex items-center justify-between py-2" key={field}><span>{field}</span><span className="flex items-center gap-1 text-ink/45"><Lock />Locked</span></li>
          ))}
          <li className="flex items-center justify-between py-2"><span>Name, photo, role</span><span className="font-semibold text-[#a43d36]">Personal</span></li>
        </ul>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex">
            {roster.map((member) => <PersonPhoto className="-mr-2 size-7 rounded-full ring-2 ring-white" id={member.id} key={member.id} />)}
          </div>
          <span className="text-[11px] font-medium text-ink/55">4 people</span>
        </div>
      </div>
    </div>
  );
}
