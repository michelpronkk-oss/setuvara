import { nameFontClasses } from "@/components/profile/name-fonts";

import { HeroModes } from "./hero-modes";
import { CastPhone } from "./mode-phone";
import { ClaimForm, Display, Label, Shell } from "./primitives";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <Shell className="flex flex-col items-center pb-14 pt-7 text-center sm:pt-12 lg:pb-20 lg:pt-14">
        <Display as="h1" className="text-[clamp(46px,7vw,112px)] leading-[0.88]">
          <span id="hero-title">One identity.<br />Every version of&nbsp;you.</span>
        </Display>
        <p className="mt-4 max-w-[40rem] text-[17px] leading-[1.45] text-ink/70 sm:mt-7 sm:text-[21px] sm:leading-[1.5]">
          <span className="sm:hidden">A page for every part of your life.<br />Remember everyone you meet.</span>
          <span className="hidden sm:inline">One account with a page for each part of your life. Share the right one by link, QR or tap, and remember everyone you meet.</span>
        </p>

        <div className="mt-6 flex w-full flex-col items-center gap-2.5 sm:mt-10 sm:gap-3">
          <ClaimForm id="hero-claim" />
          <Label className="text-ink/45">Free · All four Modes · No card</Label>
        </div>

        <div className={`${nameFontClasses} mt-6 w-full max-w-[880px] sm:mt-10`}>
          <HeroModes
            cards={[
              <CastPhone key="personal" mediaPriority="high" slug="personal" />,
              <CastPhone key="event" mediaPriority="high" slug="event" />,
              <CastPhone key="business" mediaPriority="high" slug="business" />,
              <CastPhone key="creator" slug="creator" />,
            ]}
            caption="Four people · Four Modes"
          />
        </div>
      </Shell>
    </section>
  );
}
