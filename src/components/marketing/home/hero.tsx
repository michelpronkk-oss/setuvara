import Link from "next/link";

import { HeroModes } from "./hero-modes";
import { ModeProfile } from "./mode-profile";
import { person } from "./demo";
import { ClaimForm, Display, Label, Shell } from "./primitives";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <Shell className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-10 pb-16 pt-10 sm:pt-14 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:pb-20 lg:pt-12 xl:gap-x-20">
        <div className="flex flex-col gap-6 sm:gap-7">
          <Label className="text-coral">One identity · Three Modes</Label>
          <Display as="h1" className="text-[clamp(50px,6.9vw,112px)] leading-[0.86] [text-wrap:initial]">
            <span id="hero-title">One identity.<br />Every version of&nbsp;you.</span>
          </Display>
          <p className="max-w-[34rem] text-[18px] leading-[1.45] text-ink/75 sm:text-[21px]">
            Create one Setuvara. Choose which version of you each person sees — then meet, connect in a tap, and remember where it happened.
          </p>
          <div className="hidden flex-col gap-3.5 lg:flex">
            <ClaimForm id="hero-claim" />
            <HeroFootnote />
          </div>
        </div>

        <div className="lg:pl-4">
          <HeroModes
            cards={[
              <ModeProfile key="personal" linkCount={3} size="compact" slug="personal" />,
              <ModeProfile key="event" linkCount={2} size="compact" slug="event" />,
              <ModeProfile key="business" linkCount={2} size="compact" slug="business" />,
            ]}
            name={person.firstName}
          />
        </div>

        <div className="flex flex-col gap-3.5 lg:hidden">
          <ClaimForm id="hero-claim-mobile" />
          <HeroFootnote />
        </div>
      </Shell>
    </section>
  );
}

function HeroFootnote() {
  return (
    <p className="flex flex-wrap items-center gap-x-5 gap-y-1 pl-1 text-[14px] text-ink/65">
      <span>Claim your name. It takes about a minute.</span>
      <Link className="min-h-11 content-center font-semibold text-ink underline underline-offset-4 hover:text-coral" href="#how">See how it works</Link>
    </p>
  );
}
