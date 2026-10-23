import Link from "next/link";

import { RAIL, RAIL_ITEM } from "../site/kit";
import { Display, Label, Shell } from "./primitives";

/** Setuvara in one line of five steps; each step links to the page that goes deeper. */
const STEPS = [
  { title: "Identity", line: "Claim your name. One account, one person.", href: "/signup", cta: "Claim yours" },
  { title: "Mode", line: "Personal, Event, Business or Creator: the right version of you for the room.", href: "/modes", cta: "The four Modes" },
  { title: "Share", line: "By link, your QR code, Quick QR or a tap of an NFC card. They only see that Mode.", href: "/features/qr-and-tap", cta: "QR and Tap" },
  { title: "Connect", line: "One tap saves you both, no app or account needed on their side.", href: "/event", cta: "Event Mode" },
  { title: "Stay connected", line: "Where and when you met, a private note, a Passport stamp. Then share again.", href: "/features/analytics", cta: "See it working" },
] as const;

export function Loop() {
  return (
    <section aria-labelledby="loop-title" className="scroll-mt-16 bg-ink text-paper" id="how">
      <Shell className="py-16 sm:py-24 lg:py-32">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <div>
            <Label className="text-coral">How it works</Label>
            <Display className="mt-4 text-[clamp(40px,5vw,80px)] leading-[0.92]"><span id="loop-title">Meet once.<br />Stay connected.</span></Display>
          </div>
          <p className="max-w-[28rem] text-[18px] max-sm:hidden leading-[1.5] text-paper/70 sm:text-[20px]">Five steps, and the last one leads back to the first: every connection is a reason to share again.</p>
        </div>
        <ol className={`mt-12 grid gap-px rounded-[26px] md:overflow-hidden md:bg-paper/10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-5 ${RAIL}`}>
          {STEPS.map((step, index) => (
            <li className={`flex flex-col bg-ink p-6 max-md:rounded-[22px] max-md:bg-[#1B1B1B] sm:p-7 ${RAIL_ITEM}`} key={step.title}>
              <span className="font-label text-[11px] tracking-[0.16em] text-coral">0{index + 1}</span>
              <h3 className="mt-5 font-display text-[28px] font-bold leading-none tracking-[-0.045em]">{step.title}</h3>
              <p className="mt-3 text-[15px] leading-[1.55] text-paper/65">{step.line}</p>
              <Link className="mt-auto inline-flex min-h-11 items-end pt-5 text-[14px] font-semibold text-paper/85 underline decoration-paper/25 underline-offset-4 hover:decoration-coral focus-visible:outline-2 focus-visible:outline-coral" href={step.href}>{step.cta} →</Link>
            </li>
          ))}
        </ol>
      </Shell>
    </section>
  );
}
