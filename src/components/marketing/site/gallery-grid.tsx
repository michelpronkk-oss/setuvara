import Link from "next/link";

import { APPEARANCE_NAMES, FREE_APPEARANCES } from "@/components/profile/appearance";
import { nameFontClasses } from "@/components/profile/name-fonts";
import type { AppearanceId } from "@/components/profile/types";

import { CAST, DEMO_PEOPLE, ModeDesktop, ModePhone } from "../home/mode-phone";
import { BrowserFrame, Stage } from "./kit";

type ModeSlug = "personal" | "event" | "business" | "creator";
type Person = (typeof DEMO_PEOPLE)[keyof typeof DEMO_PEOPLE];

export type Example = { who: Person; mode: ModeSlug; look: AppearanceId; wide?: boolean; caption?: string; pictures?: string[] };

/** The example cast across all ten Looks, in the gallery's rhythm: a wide desktop, then phones. */
export const EXAMPLES: Example[] = [
  { who: DEMO_PEOPLE.lucasClose, mode: "business", look: "glow", wide: true },
  { who: DEMO_PEOPLE.aanya, mode: "personal", look: "immersive" },
  { who: DEMO_PEOPLE.sena, mode: "creator", look: "film" },
  { who: DEMO_PEOPLE.noor, mode: "personal", look: "aura" },
  { who: DEMO_PEOPLE.sena, mode: "creator", look: "social" },
  { who: DEMO_PEOPLE.noor, mode: "personal", look: "frame" },
  { who: DEMO_PEOPLE.lucasClose, mode: "business", look: "clean" },
  { who: DEMO_PEOPLE.theo, mode: "event", look: "immersive", wide: true, caption: "Theo Laurent · Live at Slush" },
  { who: DEMO_PEOPLE.theo, mode: "event", look: "motion" },
  { who: DEMO_PEOPLE.noor, mode: "personal", look: "scene", pictures: ["/pricing/noor-wide.webp"] },
  { who: DEMO_PEOPLE.aanya, mode: "personal", look: "stack", pictures: ["/pricing/aanya-wide.webp"] },
  { who: DEMO_PEOPLE.sena, mode: "creator", look: "frame" },
  { who: DEMO_PEOPLE.sena, mode: "creator", look: "film", wide: true },
];

function lookFor(example: Example) {
  const cast = CAST[example.mode];
  if (example.pictures) return { theme: example.look, pictures: example.pictures };
  return cast.look.theme === example.look && cast.who.name === example.who.name ? cast.look : { theme: example.look };
}

function Caption({ name, look }: { name: string; look: AppearanceId }) {
  const free = FREE_APPEARANCES.includes(look);
  return (
    <p className="mt-4 flex items-baseline justify-between gap-3">
      <span className="truncate text-[16px] font-semibold">{name}</span>
      <span className="shrink-0 font-label text-[10px] uppercase tracking-[0.16em] text-ink/50">{APPEARANCE_NAMES[look]} · <span className={free ? "" : "text-coral"}>{free ? "Free" : "Plus"}</span></span>
    </p>
  );
}

/** Example pages as a mixed grid: wide desktop spreads beside phones on their Mode's stage. */
export function ExampleGrid({ items }: { items: Example[] }) {
  return (
    <ul className={`${nameFontClasses} grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4`}>
      {items.map((example, index) => (
        <li className={`group relative ${example.wide ? "sm:col-span-2" : ""}`} key={`${example.who.name}-${example.look}-${index}`}>
          <div aria-hidden="true" inert>
            {example.wide ? (
              <div className="flex h-[300px] items-start overflow-hidden rounded-[28px] sm:h-[420px] lg:h-[480px] [&_figure]:h-full [&_figure]:w-full">
                <BrowserFrame url={`setuvara.com/${example.who.username}`}><div className="flex justify-center [&>*]:shrink-0"><ModeDesktop look={lookFor(example)} scales="[--z:.48] sm:[--z:.5] lg:[--z:.52] xl:[--z:.6] min-[1440px]:[--z:.66]" slug={example.mode} who={example.who} /></div></BrowserFrame>
              </div>
            ) : (
              <Stage className="h-[420px] sm:h-[420px] lg:h-[480px]" slug={example.mode}>
                <div className="absolute left-1/2 top-[7%] origin-top -translate-x-1/2 scale-[.7] transition-transform duration-500 group-hover:-translate-y-2 lg:scale-[.76]">
                  <div className="rounded-[46px] shadow-[0_40px_60px_-30px_rgba(13,13,13,.6)]"><ModePhone look={lookFor(example)} slug={example.mode} who={example.who} /></div>
                </div>
              </Stage>
            )}
          </div>
          <Link className="after:absolute after:inset-0 after:rounded-[28px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-coral" href={`/templates/${example.look}`}>
            <span className="sr-only">{APPEARANCE_NAMES[example.look]} template, shown on {example.who.name}’s {example.mode} page</span>
          </Link>
          <Caption look={example.look} name={example.caption ?? example.who.name} />
        </li>
      ))}
    </ul>
  );
}
