import { CharacterAvatar } from "@/components/avatar/character-avatar";

import { demoModes, person, personAvatar } from "./demo";
import { ModePhone } from "./mode-phone";
import { Display, Label, Shell } from "./primitives";

const stages = { personal: "bg-[#ece9e1]", event: "bg-[#ffe1dc]", business: "bg-[#e3ebfb]" } as const;

const facts = [
  { title: "Own links", detail: "60 providers, or your own." },
  { title: "Own look", detail: "Its own layout and style." },
  { title: "Own QR", detail: "Its own link and code." },
];

export function Modes() {
  return (
    <section aria-labelledby="modes-title" className="scroll-mt-16 bg-white" id="modes">
      <Shell className="flex flex-col gap-8 py-16 sm:gap-12 sm:py-28 lg:gap-16 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id="modes-title">Who you are depends on who you’re meeting.</span></Display>
          <p className="max-w-[26rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[20px] lg:text-[22px]">Three Modes. One identity. Each shows only what you choose.</p>
        </div>

        <div aria-hidden="true" className="flex items-center gap-3 sm:gap-4">
          <CharacterAvatar className="size-11 shrink-0 rounded-full" seed={person.name} traits={personAvatar} />
          <span className="shrink-0 text-[15px] font-semibold">One identity · @{person.username}</span>
          <span className="h-[1.5px] min-w-6 flex-1 bg-ink" />
          <span className="shrink-0 font-label text-[11px] uppercase tracking-[0.16em]">3 Modes</span>
        </div>

        {/* Phones and tablets get a swipeable rail of Modes; wider screens see all three side by side. */}
        <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0 lg:gap-6" aria-label="Aanya’s three Modes" role="region" tabIndex={0}>
          {demoModes.map((mode, index) => (
            <div className="reveal flex w-[84%] max-w-[360px] shrink-0 snap-start flex-col gap-4 lg:w-auto lg:max-w-none" key={mode.slug}>
              <div className="flex flex-col gap-1 border-b border-ink/15 pb-3 sm:min-h-12 lg:flex-row lg:items-baseline lg:justify-between lg:gap-3">
                <Label className="shrink-0">{String(index + 1).padStart(2, "0")} · {mode.label}</Label>
                <p className="hidden text-[13px] text-ink/60 sm:block lg:text-right">{mode.audience}</p>
              </div>
              <div className={`flex justify-center rounded-[2rem] px-4 py-7 sm:py-9 ${stages[mode.slug]}`}><div className="relative h-[476px] w-[230px] sm:h-[580px] sm:w-[280px]"><div className="absolute left-0 top-0 origin-top-left scale-[.82] sm:scale-100"><ModePhone slug={mode.slug} /></div></div></div>
            </div>
          ))}
        </div>

        <dl className="grid grid-cols-3 gap-3 border-t-[1.5px] border-ink pt-6 sm:gap-6 sm:pt-8">
          {facts.map((fact) => (
            <div className="flex flex-col gap-2" key={fact.title}>
              <dt className="font-display text-[19px] font-bold leading-tight tracking-[-0.04em] sm:text-[26px]">{fact.title}</dt>
              <dd className="max-w-[22rem] text-[13px] leading-5 text-ink/65 sm:text-[15px] sm:leading-6">{fact.detail}</dd>
            </div>
          ))}
        </dl>
      </Shell>
    </section>
  );
}
