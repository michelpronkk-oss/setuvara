import Link from "next/link";

import { nameFontClasses } from "@/components/profile/name-fonts";
import { MODE_PAGES } from "@/lib/marketing/modes-content";

import { BrowserFrame } from "../site/kit";
import { ModeDesktop } from "./mode-phone";
import { Display, Label, Shell } from "./primitives";

/**
 * Example pages as a desktop visitor sees them, drawn by the same Look code as every member's
 * page. The gallery holds real members' pages; these three show the range.
 */
const EXAMPLES = [
  { slug: "business", caption: "Business · Glow" },
  { slug: "creator", caption: "Creator · Film" },
  { slug: "event", caption: "Event · Immersive, Live at Slush" },
] as const;

export function Examples() {
  return (
    <section aria-labelledby="examples-title" className="scroll-mt-16 overflow-hidden bg-white" id="examples">
      <Shell className="py-16 sm:py-24 lg:py-32">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Label className="text-coral">Example pages</Label>
            <Display className="mt-4 max-w-[14ch] text-[clamp(40px,5vw,80px)] leading-[0.92]"><span id="examples-title">A page that looks like you.</span></Display>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="inline-flex min-h-12 items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-paper hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" href="/gallery">See real pages</Link>
            <Link className="inline-flex min-h-12 items-center rounded-full px-5 text-[15px] font-semibold shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.2)] hover:shadow-[inset_0_0_0_1.5px_#0D0D0D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" href="/templates">Browse templates</Link>
          </div>
        </div>
        <p className="mt-5 max-w-[34rem] text-[18px] max-sm:hidden leading-[1.5] text-ink/65">Ten Looks, each with its own phone and desktop composition. On a laptop your page is a full editorial spread, not a phone in the middle of the screen.</p>
        <ul className={`${nameFontClasses} mx-auto mt-12 grid max-w-[1168px] gap-6 lg:mt-16 lg:grid-cols-2`}>
          {EXAMPLES.map((example, index) => (
            <li className={`group relative ${index === 0 ? "lg:col-span-2" : ""}`} key={example.slug}>
              {/* The drawing is a real page with its own links, so it is inert and the caption link covers the card. */}
              <div inert>
                <BrowserFrame className="transition-transform duration-300 group-hover:-translate-y-1" url={MODE_PAGES[example.slug].share}>
                  {/* One drawing, zoomed per breakpoint. Column widths: lg 912px (halves 444), xl 1168px (halves 572). */}
                  <ModeDesktop fit slug={example.slug} />
                </BrowserFrame>
              </div>
              <p className="mt-3 flex items-center justify-between text-[14px] text-ink/60"><span>{example.caption}</span><Link className="font-semibold text-ink transition-transform after:absolute after:inset-0 after:rounded-[20px] group-hover:translate-x-0.5 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-coral" href={MODE_PAGES[example.slug].path}>{MODE_PAGES[example.slug].name} Mode →</Link></p>
            </li>
          ))}
        </ul>
      </Shell>
    </section>
  );
}
