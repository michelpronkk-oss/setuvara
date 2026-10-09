import Link from "next/link";

import { HeroModes } from "./hero-modes";
import { ModePhone } from "./mode-phone";
import { person } from "./demo";
import { ClaimForm, Display, Label, Shell } from "./primitives";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <Shell className="flex flex-col items-center pb-14 pt-10 text-center sm:pt-16 lg:pb-20 lg:pt-20">
        <Label className="text-coral">Personal · Event · Business</Label>
        <Display as="h1" className="mt-5 text-[clamp(46px,8vw,124px)] leading-[0.88] sm:mt-6">
          <span id="hero-title">One identity.<br />Every version of&nbsp;you.</span>
        </Display>
        <p className="mt-5 max-w-[22rem] text-[18px] leading-[1.4] text-ink/70 sm:mt-7 sm:max-w-none sm:text-[21px]">
          Share the right you.<br />Remember everyone you meet.
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-3 sm:mt-10">
          <ClaimForm id="hero-claim" />
          <Link className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-ink/70 hover:text-coral" href="#how">See how it works <span aria-hidden="true">↓</span></Link>
        </div>

        <div className="mt-8 w-full max-w-[880px] sm:mt-12">
          <HeroModes
            cards={[
              <ModePhone key="personal" slug="personal" />,
              <ModePhone key="event" slug="event" />,
              <ModePhone key="business" slug="business" />,
            ]}
            name={person.firstName}
          />
        </div>
      </Shell>
    </section>
  );
}
