import Link from "next/link";

import { nameFontClasses } from "@/components/profile/name-fonts";

import { FinalCta } from "../home/closing";
import { CastPhone } from "../home/mode-phone";
import { Display, Label, LaterTag, Shell } from "../home/primitives";
import { TeamsConsole } from "../home/teams-console";

/**
 * /teams: honest about where Teams is. What each person can do today with Business Mode is live;
 * the team layer (workspace, templates, branding, attribution) is planned and marked as such.
 */

const TODAY = [
  { title: "Business Mode", line: "Role, company and a one-line pitch, separate from Personal." },
  { title: "Book a call", line: "Calendly or any booking link as the main action." },
  { title: "A private link", line: "A short business link with no username in it." },
  { title: "Connect, your call", line: "Everyone, in person only, or off. Per Mode." },
  { title: "Context that stays", line: "Each connection keeps where and when you met." },
];

const PLANNED = [
  { title: "Team workspace", line: "Everyone at your company, in one place." },
  { title: "Managed Business templates", line: "One approved Business Mode, worn by your people." },
  { title: "Company branding", line: "Your colour, logo and links on every profile." },
  { title: "Lead attribution by event", line: "Who met whom, and at which event." },
  { title: "Team connections", line: "Connections that stay with the company." },
];

export function TeamsPage() {
  return (
    <>
      <section aria-labelledby="teams-hero-title" className="overflow-hidden">
        <Shell className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 pb-16 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16 lg:pb-24 lg:pt-20">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3"><Label className="text-coral">For teams</Label><LaterTag>In development</LaterTag></div>
            <Display as="h1" className="text-[clamp(46px,7vw,112px)] leading-[0.88]"><span id="teams-hero-title">Built for people. Ready for&nbsp;teams.</span></Display>
            <p className="max-w-[30rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[21px]">Your company’s Business Mode, worn by your people. Start with your own today.</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
              <a className="inline-flex min-h-14 items-center justify-center rounded-full bg-ink px-7 text-[16px] font-semibold text-paper transition-colors hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" href="mailto:hello@setuvara.com?subject=Setuvara%20for%20Teams">Tell us about your team</a>
              <Link className="inline-flex min-h-11 items-center text-[16px] font-semibold underline decoration-[1.5px] underline-offset-[6px] hover:text-coral focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral" href="/signup">Start your Business Mode</Link>
            </div>
          </div>
          <TeamsConsole />
        </Shell>
      </section>

      <section aria-labelledby="today-title" className="bg-white">
        <Shell className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 py-16 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20 lg:py-36">
          <div className={`${nameFontClasses} order-2 flex justify-center lg:order-1`}>
            <div className="grid w-full max-w-[460px] place-items-center rounded-[2.5rem] bg-[#e3ebfb] px-6 py-10 sm:py-12">
              <div className="relative h-[476px] w-[230px] sm:h-[580px] sm:w-[280px]"><div className="absolute left-0 top-0 origin-top-left scale-[.82] sm:scale-100"><CastPhone slug="business" /></div></div>
            </div>
          </div>
          <div className="order-1 flex flex-col gap-6 lg:order-2">
            <div className="flex items-center gap-3"><Label>Works today</Label><span className="inline-flex items-center gap-1.5 font-label text-[10px] uppercase tracking-[0.14em]"><span aria-hidden="true" className="size-1.5 rounded-full bg-coral" />Live</span></div>
            <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id="today-title">Every person, their own Business Mode.</span></Display>
            <ul className="border-t border-ink/15">
              {TODAY.map((item) => (
                <li className="flex flex-col gap-0.5 border-b border-ink/15 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6" key={item.title}>
                  <span className="text-[16px] font-semibold">{item.title}</span>
                  <span className="text-[13.5px] text-ink/60 sm:text-right">{item.line}</span>
                </li>
              ))}
            </ul>
          </div>
        </Shell>
      </section>

      <section aria-labelledby="planned-title" className="bg-ink text-paper">
        <Shell className="flex flex-col gap-12 py-16 sm:gap-16 sm:py-28 lg:py-36">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
            <div className="flex flex-col gap-5">
              <Label className="text-coral">Coming for teams</Label>
              <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id="planned-title">One company. Every version of your people.</span></Display>
            </div>
            <p className="max-w-[26rem] text-[18px] leading-[1.45] text-paper/70 sm:text-[20px]">In development. Tell us what your team needs and we’ll build with you.</p>
          </div>
          <ol className="grid grid-cols-[minmax(0,1fr)] gap-px overflow-hidden rounded-[1.75rem] bg-paper/10 sm:grid-cols-2 lg:grid-cols-5">
            {PLANNED.map((item, index) => (
              <li className="flex min-h-[200px] flex-col justify-between gap-8 bg-ink p-6" key={item.title}>
                <div className="flex items-center justify-between"><span className="font-label text-[11px] tracking-[0.14em] text-paper/50">{String(index + 1).padStart(2, "0")}</span><span className="font-label text-[10px] uppercase tracking-[0.14em] text-paper/45">Planned</span></div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-display text-[22px] font-bold leading-tight tracking-[-0.035em]">{item.title}</h3>
                  <p className="text-[13.5px] leading-[1.5] text-paper/60">{item.line}</p>
                </div>
              </li>
            ))}
          </ol>
          <a className="inline-flex min-h-11 items-center gap-2 self-start text-[16px] font-semibold text-coral underline decoration-[1.5px] underline-offset-[6px] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral" href="mailto:hello@setuvara.com?subject=Setuvara%20for%20Teams">hello@setuvara.com <span aria-hidden="true">→</span></a>
        </Shell>
      </section>

      <FinalCta />
    </>
  );
}
