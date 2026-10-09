import { demoModes, person } from "./demo";
import { ModeProfile } from "./mode-profile";
import { Display, Label, Shell } from "./primitives";

const facts = [
  { title: "Its own links", detail: "Pick from 60 providers — social, creator, messaging, work, event, community — or add your own." },
  { title: "Its own look", detail: "Each Mode carries its own appearance and layout, from quiet editorial to event poster." },
  { title: "Its own share", detail: "Every Mode has its own link and QR, so the person you meet lands on the right version." },
];

export function Modes() {
  return (
    <section aria-labelledby="modes-title" className="scroll-mt-16 bg-white" id="modes">
      <Shell className="flex flex-col gap-12 py-20 sm:py-28 lg:gap-16 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 lg:items-end lg:gap-16">
          <Display className="text-[clamp(44px,5.8vw,92px)] leading-[0.9]"><span id="modes-title">Who you are depends on who you’re meeting.</span></Display>
          <p className="max-w-[32rem] text-[17px] leading-[1.55] text-ink/70 sm:text-[19px]">Modes aren’t separate accounts. They’re three expressions of the same identity — and each one shows only what you choose for that context.</p>
        </div>

        <div aria-hidden="true" className="flex items-center gap-3 sm:gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink font-display text-[15px] font-bold text-paper">{person.initials}</span>
          <span className="shrink-0 text-[15px] font-semibold">One identity · @{person.username}</span>
          <span className="h-[1.5px] min-w-6 flex-1 bg-ink" />
          <span className="shrink-0 font-label text-[11px] uppercase tracking-[0.16em]">3 Modes</span>
        </div>

        {/* Phones and tablets get a swipeable rail of Modes; wider screens see all three side by side. */}
        <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0 lg:gap-6" aria-label="Aanya’s three Modes" role="region" tabIndex={0}>
          {demoModes.map((mode, index) => (
            <div className="reveal flex w-[84%] max-w-[360px] shrink-0 snap-start flex-col gap-4 lg:w-auto lg:max-w-none" key={mode.slug}>
              <div className="flex min-h-12 flex-col gap-1 border-b border-ink/15 pb-3 lg:flex-row lg:items-baseline lg:justify-between lg:gap-3">
                <Label className="shrink-0">{String(index + 1).padStart(2, "0")} · {mode.label}</Label>
                <p className="text-[13px] text-ink/60 lg:text-right">{mode.audience}</p>
              </div>
              <div className="min-h-[540px] flex-1 lg:min-h-[560px]"><ModeProfile slug={mode.slug} /></div>
            </div>
          ))}
        </div>

        <dl className="grid gap-8 border-t-[1.5px] border-ink pt-8 lg:grid-cols-3 md:gap-6">
          {facts.map((fact) => (
            <div className="flex flex-col gap-2" key={fact.title}>
              <dt className="font-display text-[26px] font-bold tracking-[-0.04em]">{fact.title}</dt>
              <dd className="max-w-[22rem] text-[15px] leading-6 text-ink/65">{fact.detail}</dd>
            </div>
          ))}
        </dl>
      </Shell>
    </section>
  );
}
