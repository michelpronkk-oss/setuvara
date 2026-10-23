import { ConnectionsDemo } from "./connections-demo";
import { demoConnections } from "./demo";
import { Flag } from "./flag";
import { Display, Label, Shell, Say } from "./primitives";

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
            <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id="remember-title">Names fade. Context shouldn’t.</span></Display>
            <p className="max-w-[26rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[20px] lg:text-[22px]">Who, where, when. Plus a note only you&nbsp;see.</p>
          </div>

          <article aria-label="Example connection: Noor Haddad" className="reveal relative overflow-hidden rounded-[2rem] bg-ink text-paper shadow-[0_60px_120px_-60px_rgba(13,13,13,.7)]">
            <div className="relative h-[260px] sm:h-[320px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- static example portrait */}
              <img alt="" className="absolute inset-0 size-full object-cover" src="/pricing/noor-wide.webp" style={{ objectPosition: "50% 30%" }} />
              <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-transparent" />
              <span className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-black/45 px-3.5 py-2 text-[12px] font-semibold backdrop-blur sm:left-7 sm:top-7"><span className="size-2 rounded-full bg-coral" />Met 3 times</span>
              <div className="absolute inset-x-5 bottom-5 sm:inset-x-8 sm:bottom-7">
                <p className="font-display text-[44px] font-extrabold leading-[0.9] tracking-[-0.055em] sm:text-[60px]">Noor Haddad</p>
                <p className="mt-2 text-[14px] text-paper/70 sm:text-[15px]">Partner · Ondas Ventures</p>
              </div>
            </div>
            <div className="flex flex-col gap-5 p-5 sm:p-8 sm:pt-6">
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[["You met", "TNW Conference"], ["Where", "Amsterdam"], ["Mode", "Business"]].map(([term, value], index) => (
                  <div className={`rounded-2xl px-3.5 py-3 ${index === 0 ? "col-span-2 bg-coral text-ink sm:col-span-1" : "bg-white/[0.06]"}`} key={term}><dt className={`font-label text-[10px] uppercase tracking-[0.14em] ${index === 0 ? "text-ink/60" : "text-paper/45"}`}>{term}</dt><dd className="mt-1 truncate text-[14px] font-semibold sm:text-[16px]">{value}</dd></div>
                ))}
              </dl>
              <div className="rounded-2xl bg-paper px-5 py-4 text-ink">
                <p className="flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.14em] text-ink/55"><svg aria-hidden="true" className="size-3" fill="none" viewBox="0 0 24 24"><rect height="10" rx="2" stroke="currentColor" strokeWidth="2.5" width="14" x="5" y="11" /><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2.5" /></svg>Private note · Only you</p>
                <p className="mt-1.5 text-[15px] font-medium leading-6">Wants intros to Nordic grid operators. Follow up after Q4 planning.</p>
              </div>
              <ol className="relative flex flex-col gap-3 pl-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-white/15">
                {encounters.map((encounter, index) => (
                  <li className="relative flex flex-col gap-0.5 text-[14px] sm:flex-row sm:items-baseline sm:justify-between sm:gap-4" key={encounter.when}>
                    <span aria-hidden="true" className={`absolute -left-5 top-[5px] size-[11px] rounded-full ${index === 0 ? "bg-coral" : "bg-ink shadow-[inset_0_0_0_1.5px_rgba(245,244,239,.35)]"}`} />
                    <span className="flex min-w-0 items-center gap-2 font-semibold"><Flag className="h-[11px] w-[16px]" country={encounter.country} /><span className="truncate">{encounter.where}</span></span>
                    <span className="shrink-0 font-label text-[11px] uppercase tracking-[0.1em] text-paper/45">{encounter.mode} · {encounter.when}</span>
                  </li>
                ))}
              </ol>
            </div>
          </article>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] scroll-mt-20 gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20" id="connections">
          <div className="flex flex-col gap-5 lg:pt-6">
            <Label className="text-coral">Connections</Label>
            <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><Say d="Everyone you’ve met. Searchable by moment." m="Search by moment." /></Display>
            <p className="max-w-[26rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[20px] lg:text-[22px]">Try it. These are example people.</p>
          </div>
          <ConnectionsDemo items={demoConnections} />
        </div>
      </Shell>
    </section>
  );
}
