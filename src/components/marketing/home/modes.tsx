import Link from "next/link";

import { nameFontClasses } from "@/components/profile/name-fonts";
import { MODE_ORDER, MODE_PAGES } from "@/lib/marketing/modes-content";

import { CAST, CastPhone } from "./mode-phone";
import { PhoneStage } from "./phone-stage";
import { Display, Label, Shell, Say } from "./primitives";

/** Each Mode's own tools, as named in the app (components/app/side-nav modeTools). */
const TOOLS = { personal: "Actions · Audience", event: "Events · Actions · Audience", business: "Leads · Builder · Testimonials · Team", creator: "Store · Media kit · Deals · Builder" } as const;

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
          <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id="modes-title"><Say d="Who you are depends on who you’re meeting." m="Four Modes. One you." /></span></Display>
          <p className="max-w-[26rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[20px] lg:text-[22px]"><Say d="Four Modes. One identity. Each shows only what you choose, and comes with its own tools." m="Each shows only what you choose." /></p>
        </div>

        <div aria-hidden="true" className="flex items-center gap-3 sm:gap-4">
          <span className="flex shrink-0">
            {MODE_ORDER.map((slug) => {
              const { who } = CAST[slug];
              return <span className="-ml-2.5 size-11 overflow-hidden rounded-full bg-cover shadow-[0_0_0_2.5px_#fff] first:ml-0" key={slug} style={{ backgroundImage: `url(${who.photo})`, backgroundPosition: `${who.face.x}% ${who.face.y}%` }} />;
            })}
          </span>
          <span className="min-w-0 truncate text-[15px] font-semibold">Four people · Four Modes</span>
          <span className="hidden h-[1.5px] min-w-6 flex-1 bg-ink sm:block" />
          <span className="hidden shrink-0 font-label text-[11px] uppercase tracking-[0.16em] sm:block">4 Modes</span>
        </div>

        {/* Phones and tablets get a swipeable rail of Modes; wider screens see all four side by side. */}
        <div className={`${nameFontClasses} -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 xl:mx-0 xl:grid xl:grid-cols-4 xl:overflow-visible xl:px-0 xl:pb-0 xl:gap-5`} aria-label="Four Modes" role="region" tabIndex={0}>
          {MODE_ORDER.map((slug, index) => {
            const page = MODE_PAGES[slug];
            return (
              <div className="reveal flex w-[84%] max-w-[330px] shrink-0 snap-start flex-col gap-4 xl:w-auto xl:max-w-none" key={slug}>
                <div className="flex flex-col gap-1 border-b border-ink/15 pb-3 sm:min-h-12">
                  <Label className="shrink-0">{String(index + 1).padStart(2, "0")} · {page.name}</Label>
                  <p className="text-[13px] text-ink/60">{TOOLS[slug]}</p>
                </div>
                <PhoneStage className="rounded-[2rem] px-4 py-7 sm:py-8" slug={slug}><div className="relative h-[476px] w-[230px]"><div className="absolute left-0 top-0 origin-top-left scale-[.82]"><CastPhone slug={slug} /></div></div></PhoneStage>
                <Link className="inline-flex min-h-11 items-center text-[15px] font-semibold underline decoration-ink/25 underline-offset-4 hover:decoration-coral focus-visible:outline-2 focus-visible:outline-coral" href={page.path}>{page.name} Mode →</Link>
              </div>
            );
          })}
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
