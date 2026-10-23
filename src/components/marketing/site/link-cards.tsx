import Link from "next/link";
import type { ReactNode } from "react";

import { nameFontClasses } from "@/components/profile/name-fonts";
import { COMPARE_PAGES } from "@/lib/marketing/compare-content";

import { CastPhone, ModeDesktop } from "../home/mode-phone";
import { Label, Shell } from "../home/primitives";
import { FitCanvas } from "./fit-canvas";
import { RAIL, RAIL_ITEM } from "./kit";
import { BannerVisual, type VisualKey } from "./visuals";

/**
 * Link cards that lead with the thing they link to: a feature's own visual, a Mode's real page,
 * or a side-by-side for comparisons. Used by the index pages and every "Keep exploring". Phones
 * get one swipeable row; the visual carries the card, the copy is a title and one line.
 */

type ModeSlug = "personal" | "event" | "business" | "creator";
const MODES: ModeSlug[] = ["personal", "event", "business", "creator"];
const FEATURE_VISUALS = new Set<VisualKey>(["actions", "builder", "analytics", "qr-and-tap", "wallet"]);

/** A plain list of links beside a Setuvara page: what each comparison is about, drawn. */
function VersusVisual({ name, mode }: { name: string; mode: ModeSlug }) {
  return (
    <FitCanvas className="rounded-[20px]">
      <div className="relative h-full w-full bg-[radial-gradient(90%_90%_at_100%_0%,#FFFFFF,transparent_70%),radial-gradient(120%_120%_at_0%_100%,#E7E3D9,#F1EEE7_75%)]">
        <div className="absolute left-[90px] top-[150px] w-[400px] rounded-[40px] bg-white p-9 shadow-[0_60px_90px_-50px_rgba(13,13,13,.45)]">
          <span className="block size-24 rounded-full bg-ink/10" />
          <span className="mt-6 block h-7 w-56 rounded-full bg-ink/15" />
          {[0, 1, 2, 3].map((i) => <span className="mt-5 block h-16 rounded-full bg-ink/[0.06] shadow-[inset_0_0_0_2px_rgba(13,13,13,.06)]" key={i} />)}
          <p className="mt-8 text-center font-label text-[22px] uppercase tracking-[0.16em] text-ink/40">{name}</p>
        </div>
        <span className="absolute left-[540px] top-[360px] font-display text-[64px] font-extrabold tracking-[-0.05em] text-ink/25">vs</span>
        <div className={`${nameFontClasses} absolute right-[110px] top-[60px] origin-top-right scale-[1.18] rounded-[46px] shadow-[0_60px_90px_-40px_rgba(13,13,13,.6)]`}><CastPhone slug={mode} /></div>
      </div>
    </FitCanvas>
  );
}

const USE_CASE_VISUAL: Record<string, ReactNode> = {
  "digital-business-card-for-founders": <ModeDesktop fit slug="business" />,
  "link-in-bio-for-creators": <ModeDesktop fit slug="creator" />,
  "event-networking-app": <ModeDesktop fit slug="event" />,
  "qr-business-card": <BannerVisual name="qr-and-tap" />,
  "share-saas-revenue-publicly": <BannerVisual name="builder" />,
};
const COMPARE_MODE: Record<string, ModeSlug> = { linktree: "personal", beacons: "creator", popl: "business", carrd: "event" };

/** The visual a link should carry, from where it goes. */
export function visualFor(href: string, name = ""): ReactNode {
  const [, section, slug = ""] = href.split("/");
  if (section === "features" && FEATURE_VISUALS.has(slug as VisualKey)) return <BannerVisual name={slug as VisualKey} />;
  if (MODES.includes(section as ModeSlug)) return <ModeDesktop fit slug={section as ModeSlug} />;
  if (section === "use-cases" && USE_CASE_VISUAL[slug]) return USE_CASE_VISUAL[slug];
  if (section === "compare" && COMPARE_MODE[slug]) return <VersusVisual mode={COMPARE_MODE[slug]} name={(COMPARE_PAGES as Record<string, { name: string }>)[slug]?.name ?? (name || slug)} />;
  if (section === "tools" && slug === "qr-code-generator") return <BannerVisual name="qr-and-tap" />;
  if (section === "tools" && slug === "media-kit-template") return <ModeDesktop fit slug="creator" />;
  if (section === "tools") return <VersusVisual mode="personal" name="Your bio link" />;
  if (section === "pricing") return <ModeDesktop fit slug="event" />;
  return <ModeDesktop fit slug="personal" />;
}

export type LinkCard = { href: string; title: ReactNode; line: string; tag?: string; name?: string };

export function LinkCards({ items, columns = 3 }: { items: LinkCard[]; columns?: 2 | 3 | 4 }) {
  const cols = { 2: "md:grid-cols-2", 3: "md:grid-cols-2 lg:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <ul className={`grid gap-6 ${cols} ${RAIL}`}>
      {items.map((item) => (
        <li className={`min-w-0 ${RAIL_ITEM}`} key={item.href}>
          <Link className="group flex h-full flex-col rounded-[28px] bg-white p-2.5 shadow-[0_40px_80px_-60px_rgba(13,13,13,.5)] transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" href={item.href}>
            <div aria-hidden="true" className="aspect-[16/10] overflow-hidden rounded-[20px] [&_*]:pointer-events-none" inert>{visualFor(item.href, item.name)}</div>
            <div className="flex flex-1 flex-col px-4 pb-5 pt-5 sm:px-5">
              {item.tag ? <span className="font-label text-[10px] uppercase tracking-[0.16em] text-coral">{item.tag}</span> : null}
              <span className={`${item.tag ? "mt-2" : ""} font-display text-[26px] font-extrabold leading-[0.98] tracking-[-0.05em]`}>{item.title}<span aria-hidden="true" className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span></span>
              <span className="mt-2.5 text-[14.5px] leading-[1.5] text-ink/60">{item.line}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "Keep exploring": the same cards, under a rule at the end of a page. */
export function RelatedLinks({ title = "Keep exploring", items }: { title?: string; items: { href: string; label: string; line: string }[] }) {
  return (
    <section aria-label={title} className="bg-paper">
      <Shell className="pb-20 pt-2 sm:pb-24">
        <div className="border-t-[1.5px] border-ink pt-8">
          <Label className="text-ink/55">{title}</Label>
          <div className="mt-6"><LinkCards columns={items.length >= 4 ? 4 : 3} items={items.map((item) => ({ href: item.href, title: item.label, line: item.line, name: item.label }))} /></div>
        </div>
      </Shell>
    </section>
  );
}
