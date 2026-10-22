import Link from "next/link";

import type { ModeSlug } from "@/components/profile/types";

export type HomeModeTile = { slug: ModeSlug; enabled: boolean; summary: string };

const NAMES: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" };
const DOT: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF", creator: "#E8A6FF" };
const PURPOSE: Record<ModeSlug, string> = {
  personal: "Friends and new people",
  event: "Conferences and meetups",
  business: "Clients and partners",
  creator: "Your work and audience",
};
/** The tools each Mode is for, so they are one click from Home. */
const TOOLS: Record<ModeSlug, { label: string; href: string }[]> = {
  personal: [{ label: "Share", href: "/app/identity?mode=personal&section=share" }, { label: "Actions", href: "/app/identity/actions?mode=personal" }],
  event: [{ label: "Events", href: "/app/identity/events" }, { label: "Actions", href: "/app/identity/actions?mode=event" }],
  business: [{ label: "Leads", href: "/app/identity/leads" }, { label: "Builder", href: "/app/identity/builder?mode=business" }, { label: "Testimonials", href: "/app/identity/testimonials" }],
  creator: [{ label: "Studio", href: "/app/identity/creator/work" }, { label: "Commerce", href: "/app/identity/creator/commerce" }, { label: "Builder", href: "/app/identity/creator/builder" }],
};

/** Every version of you, side by side: what each Mode is for, whether it's open, and its tools. */
export function ModesSection({ modes, published }: { modes: HomeModeTile[]; published: boolean }) {
  return (
    <section aria-labelledby="sv-home-modes">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.035em]" id="sv-home-modes">Your Modes</h2>
        <p className="hidden text-[13px] text-black/50 sm:block">One identity, a version for every room.</p>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {modes.map((mode) => {
          const live = published && mode.enabled;
          return (
            <li className="flex min-h-[156px] flex-col rounded-[20px] bg-white p-4 sm:min-h-[176px] sm:rounded-[22px] sm:p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition-shadow focus-within:shadow-[inset_0_0_0_1.5px_#0D0D0D] hover:shadow-[inset_0_0_0_1px_rgba(13,13,13,.18)]" key={mode.slug}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.14em] text-black/55">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: DOT[mode.slug], opacity: mode.enabled ? 1 : 0.4 }} />
                  {live ? "Live" : mode.enabled ? "Private" : "Off"}
                </span>
              </div>
              <Link className="mt-3 rounded-[6px] font-display text-[20px] sm:text-[24px] font-bold leading-none tracking-[-0.04em] focus-visible:outline-2 focus-visible:outline-offset-4 hover:underline hover:decoration-2 hover:underline-offset-4" href={`/app/identity?mode=${mode.slug}`}>{NAMES[mode.slug]}</Link>
              <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-black/55 sm:text-[13.5px]">{mode.enabled ? mode.summary : PURPOSE[mode.slug]}</p>
              <div className="mt-auto flex flex-wrap gap-x-3.5 gap-y-1 pt-4">
                {mode.enabled
                  ? TOOLS[mode.slug].map((tool) => <Link className="text-[13px] font-semibold text-black/75 underline decoration-black/20 underline-offset-4 hover:text-black hover:decoration-black focus-visible:outline-2" href={tool.href} key={tool.label}>{tool.label}</Link>)
                  : <Link className="text-[13px] font-semibold underline decoration-black/25 underline-offset-4 hover:decoration-black focus-visible:outline-2" href={`/app/identity?mode=${mode.slug}&section=settings`}>Set up {NAMES[mode.slug]} →</Link>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
