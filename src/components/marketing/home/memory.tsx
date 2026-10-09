import { CharacterAvatar } from "@/components/avatar/character-avatar";

import { ConnectionsDemo } from "./connections-demo";
import { demoConnections } from "./demo";
import { Flag } from "./flag";
import { Display, Label, Shell } from "./primitives";

const encounters = [
  { when: "Jun 2026", where: "TNW Conference · Amsterdam", mode: "Business", country: "NL" },
  { when: "Mar 2026", where: "Coffee · Lisbon", mode: "Personal", country: "PT" },
  { when: "Nov 2025", where: "Web Summit · Lisbon", mode: "Event", country: "PT" },
] as const;

export function Memory() {
  return (
    <section aria-labelledby="remember-title" className="scroll-mt-16" id="remember">
      <Shell className="flex flex-col gap-16 py-16 sm:gap-20 sm:py-28 lg:gap-28 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
          <div className="flex flex-col gap-5">
            <Label className="text-coral">Remember</Label>
            <Display className="text-[clamp(48px,6.6vw,108px)] leading-[0.88]"><span id="remember-title">Names fade. Context shouldn’t.</span></Display>
            <p className="max-w-[30rem] text-[17px] leading-[1.5] text-ink/70 sm:text-[19px]">Who, where, when. Plus a note only you&nbsp;see.</p>
          </div>

          <article aria-label="Example connection: Marco Silva" className="reveal flex flex-col gap-6 rounded-[2rem] bg-white p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] sm:p-8">
            <div className="flex items-center gap-4">
              <CharacterAvatar className="size-14 shrink-0 rounded-2xl" seed="Marco Silva" />
              <div className="min-w-0">
                <p className="font-display text-[28px] font-bold leading-none tracking-[-0.04em]">Marco Silva</p>
                <p className="mt-1.5 truncate text-[14px] text-ink/60">Head of Sales · Northlight</p>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-x-3 gap-y-4 border-t-[1.5px] border-ink pt-5">
              <div><dt className="font-label text-[10px] uppercase tracking-[0.14em] text-coral">You met</dt><dd className="mt-1 text-[14px] font-semibold sm:text-[16px]">TNW Conference</dd></div>
              <div><dt className="font-label text-[10px] uppercase tracking-[0.14em] text-ink/50">Where</dt><dd className="mt-1 text-[14px] font-semibold sm:text-[16px]">Amsterdam</dd></div>
              <div><dt className="font-label text-[10px] uppercase tracking-[0.14em] text-ink/50">Mode</dt><dd className="mt-1 text-[14px] font-semibold sm:text-[16px]">Business</dd></div>
            </dl>
            <div className="rounded-2xl bg-[repeating-linear-gradient(-30deg,#f5f4ef_0_8px,#fff_8px_16px)] px-5 py-4 shadow-[inset_0_0_0_1.5px_#0d0d0d]">
              <Label className="!text-[10px]">Private note · Only you</Label>
              <p className="mt-1.5 text-[15px] font-medium leading-6">Wants intros to Nordic grid operators. Follow up after Q4 planning.</p>
            </div>
            <div>
              <Label className="!text-[10px] text-ink/50">3 encounters</Label>
              <ol className="mt-2 divide-y divide-ink/10">
                {encounters.map((encounter) => (
                  <li className="flex flex-col gap-0.5 py-2.5 text-[14px] sm:flex-row sm:items-baseline sm:justify-between sm:gap-4" key={encounter.when}>
                    <span className="flex min-w-0 items-center gap-2 font-semibold"><Flag className="h-[11px] w-[16px]" country={encounter.country} /><span className="truncate">{encounter.where}</span></span>
                    <span className="shrink-0 font-label text-[11px] uppercase tracking-[0.1em] text-ink/50">{encounter.mode} · {encounter.when}</span>
                  </li>
                ))}
              </ol>
            </div>
          </article>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] scroll-mt-20 gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20" id="connections">
          <div className="flex flex-col gap-5 lg:pt-6">
            <Label className="text-coral">Connections</Label>
            <Display className="text-[clamp(40px,4.6vw,72px)] leading-[0.92]">Everyone you’ve met. Searchable by moment.</Display>
            <p className="max-w-[28rem] text-[17px] leading-[1.5] text-ink/70">Try it. These are example people.</p>
          </div>
          <ConnectionsDemo items={demoConnections} />
        </div>
      </Shell>
    </section>
  );
}
