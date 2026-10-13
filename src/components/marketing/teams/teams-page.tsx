import Link from "next/link";
import type { ReactNode } from "react";


import { nameFontClasses } from "@/components/profile/name-fonts";

import { FinalCta } from "../home/closing";
import { CastPhone } from "../home/mode-phone";
import { PhoneStage } from "../home/phone-stage";
import { Display, Label, LaterTag, Shell } from "../home/primitives";
import { PersonPhoto, SetuvaraTile, TEAM_ORDER, TEAM_PEOPLE } from "../home/team-people";
import { TeamsConsole } from "../home/teams-console";
import { TeamInquiry } from "./team-inquiry";

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
              <TeamInquiry className="inline-flex min-h-14 items-center justify-center rounded-full bg-ink px-7 text-[16px] font-semibold text-paper transition-colors hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" />
              <Link className="inline-flex min-h-11 items-center text-[16px] font-semibold underline decoration-[1.5px] underline-offset-[6px] hover:text-coral focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral" href="/signup">Start your Business Mode</Link>
            </div>
          </div>
          <TeamsConsole />
        </Shell>
      </section>

      <section aria-labelledby="today-title" className="bg-white">
        <Shell className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 py-16 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20 lg:py-36">
          <div className={`${nameFontClasses} order-2 flex justify-center lg:order-1`}>
            <PhoneStage className="w-full max-w-[460px] rounded-[2.5rem] px-6 py-10 sm:py-12" slug="business">
              <div className="relative h-[476px] w-[230px] sm:h-[580px] sm:w-[280px]"><div className="absolute left-0 top-0 origin-top-left scale-[.82] sm:scale-100"><CastPhone slug="business" /></div></div>
            </PhoneStage>
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

      <Planned />

      <FinalCta />
    </>
  );
}

/** The team layer, all planned: a bento of five, each drawn as the idea it stands for. */
function Planned() {
  return (
    <section aria-labelledby="planned-title" className="relative isolate overflow-hidden bg-ink text-paper">
      <span aria-hidden="true" className="absolute -right-40 -top-40 -z-10 size-[620px] rounded-full bg-coral/20 blur-[140px]" />
      <span aria-hidden="true" className="absolute -bottom-60 -left-40 -z-10 size-[560px] rounded-full bg-sky/10 blur-[140px]" />
      <Shell className="flex flex-col gap-12 py-16 sm:gap-16 sm:py-28 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3"><Label className="text-coral">Coming for teams</Label><LaterTag className="text-paper/60">Planned</LaterTag></div>
            <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id="planned-title">One company. Every version of your people.</span></Display>
          </div>
          <p className="max-w-[26rem] text-[18px] leading-[1.45] text-paper/70 sm:text-[20px]">Five things we’re building next. None of them are live yet.</p>
        </div>

        <ol className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-5">
          <Feature className="lg:col-span-3" index={1} line="Everyone at your company, in one place." title="Team workspace" visual={<WorkspaceVisual />} />
          <Feature className="lg:col-span-3" index={2} line="One approved Business Mode, worn by your people." title="Managed templates" visual={<TemplateVisual />} />
          <Feature className="lg:col-span-2" index={3} line="Your colour, logo and links on every profile." title="Company branding" visual={<BrandVisual />} />
          <Feature className="lg:col-span-2" index={4} line="Who met whom, and at which event." title="Lead attribution" visual={<AttributionVisual />} />
          <Feature className="sm:col-span-2 lg:col-span-2" index={5} line="Connections that stay with the company." title="Team connections" visual={<ConnectionsVisual />} />
        </ol>

        <div className="flex flex-col gap-6 rounded-[2rem] bg-coral p-6 text-ink sm:flex-row sm:items-center sm:justify-between sm:p-8 lg:p-10">
          <div className="flex flex-col gap-2">
            <p className="font-display text-[clamp(28px,3.2vw,44px)] font-extrabold leading-[0.95] tracking-[-0.05em]">Shape Teams with us.</p>
            <p className="text-[15px] text-ink/75 sm:text-[16px]">Tell us what your team needs. We read every note.</p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end"><TeamInquiry className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ink px-7 text-[16px] font-semibold text-paper transition-colors hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">Tell us about your team <span aria-hidden="true">→</span></TeamInquiry><a className="text-[13px] font-medium text-ink/70 underline underline-offset-4 hover:text-ink" href="mailto:hello@setuvara.com?subject=Setuvara%20for%20Teams">or hello@setuvara.com</a></div>
        </div>
      </Shell>
    </section>
  );
}

function Feature({ index, title, line, visual, className = "" }: { index: number; title: string; line: string; visual: ReactNode; className?: string }) {
  return (
    <li className={`reveal group flex flex-col overflow-hidden rounded-[1.75rem] bg-white/[0.045] shadow-[inset_0_0_0_1px_rgba(245,244,239,.08)] transition-colors duration-500 hover:bg-white/[0.07] ${className}`}>
      <div aria-hidden="true" className="relative grid h-52 place-items-center overflow-hidden border-b border-paper/[0.07] bg-[radial-gradient(120%_90%_at_50%_0%,rgba(245,244,239,.07),transparent_70%)]">{visual}</div>
      <div className="flex flex-1 flex-col gap-2 p-6">
        <div className="flex items-center justify-between font-label text-[10px] uppercase tracking-[0.16em] text-paper/45"><span>{String(index).padStart(2, "0")}</span><span>Planned</span></div>
        <h3 className="mt-2 font-display text-[26px] font-bold leading-[1.02] tracking-[-0.045em] sm:text-[28px]">{title}</h3>
        <p className="text-[14px] leading-[1.5] text-paper/60">{line}</p>
      </div>
    </li>
  );
}

function WorkspaceVisual() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2.5 rounded-full bg-white/[0.07] py-1.5 pl-1.5 pr-4 shadow-[inset_0_0_0_1px_rgba(245,244,239,.1)]">
        <SetuvaraTile className="size-8 rounded-full" />
        <span className="text-[13px] font-semibold">Setuvara</span>
        <span className="font-label text-[9px] uppercase tracking-[0.14em] text-paper/45">24 people</span>
      </div>
      <div className="flex">
        {TEAM_ORDER.map((id, index) => <PersonPhoto className="-ml-3 size-14 rounded-full shadow-[0_0_0_3px_#151515] transition-transform duration-500 first:ml-0 group-hover:-translate-y-1" id={id} key={id} style={{ transitionDelay: `${index * 40}ms` }} />)}
        <span className="-ml-3 grid size-14 place-items-center rounded-full bg-[#2a2a2a] font-label text-[11px] text-paper/70 shadow-[0_0_0_3px_#151515]">+19</span>
      </div>
    </div>
  );
}

function TemplateVisual() {
  const fan = ["aanya", "sena", "noor"] as const;
  return (
    <div className="relative h-44 w-[260px]">
      {fan.map((id, index) => (
        <div className="absolute left-1/2 top-1/2 w-[128px] overflow-hidden rounded-[18px] bg-paper text-ink shadow-[0_24px_34px_-18px_rgba(0,0,0,.8)] transition-transform duration-500" key={id} style={{ transform: `translate(calc(-50% + ${(index - 1) * 74}px), calc(-50% + ${Math.abs(index - 1) * 12}px)) rotate(${(index - 1) * 7}deg)`, zIndex: index === 1 ? 2 : 1 }}>
          <PersonPhoto className="h-[84px] w-full" id={id} zoom="cover" />
          <div className="flex flex-col gap-1 p-2.5">
            <p className="truncate text-[11.5px] font-bold leading-tight">{TEAM_PEOPLE[id].name}</p>
            <p className="flex items-center gap-1 font-label text-[7.5px] uppercase tracking-[0.12em] text-ink/55"><SetuvaraTile className="size-3 rounded-[3px]" />Setuvara</p>
            <span className="mt-1 grid h-5 place-items-center rounded-full bg-coral text-[8.5px] font-semibold">Connect</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BrandVisual() {
  return (
    <div className="flex items-center gap-5">
      <SetuvaraTile className="size-[72px] rounded-[20px] shadow-[0_18px_40px_-12px_rgba(255,90,79,.6)]" />
      <div className="flex flex-col gap-2.5">
        <span className="font-display text-[26px] font-bold lowercase leading-none tracking-[-0.05em]">setuvara</span>
        <div className="flex gap-1.5">
          {["#FF5A4F", "#F5F4EF", "#C7FF4A", "#AFCBFF"].map((hex) => <span className="size-5 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,.15)]" key={hex} style={{ background: hex }} />)}
        </div>
      </div>
    </div>
  );
}

function AttributionVisual() {
  const rows = [{ event: "Slush", met: 14, who: "aanya" }, { event: "Web Summit", met: 9, who: "theo" }, { event: "SaaStock", met: 6, who: "noor" }] as const;
  return (
    <div className="flex w-[232px] flex-col gap-3">
      {rows.map((row) => (
        <div className="flex items-center gap-2.5 text-[12px]" key={row.event}>
          <PersonPhoto className="size-7 rounded-full" id={row.who} />
          <span className="w-[70px] shrink-0 truncate font-semibold">{row.event}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper/10"><span className="block h-full rounded-full bg-coral" style={{ width: `${(row.met / 14) * 100}%` }} /></span>
          <span className="w-5 text-right font-label text-[10px] text-paper/60">{row.met}</span>
        </div>
      ))}
    </div>
  );
}

function ConnectionsVisual() {
  return (
    <div className="flex items-center">
      <span className="flex flex-col items-center gap-1.5"><PersonPhoto className="size-12 rounded-full shadow-[0_0_0_3px_#151515]" id="lucas" /><span className="font-label text-[8px] uppercase tracking-[0.14em] text-paper/45">Met</span></span>
      <span className="mb-4 h-px w-8 bg-gradient-to-r from-paper/20 to-coral sm:w-10" />
      <SetuvaraTile className="mb-4 size-14 rounded-[16px] shadow-[0_0_0_6px_rgba(255,90,79,.15)]" />
      <span className="mb-4 h-px w-8 bg-gradient-to-r from-coral to-paper/20 sm:w-10" />
      <span className="flex flex-col items-center gap-1.5">
        <span className="flex">{(["aanya", "theo", "sena"] as const).map((id) => <PersonPhoto className="-ml-2.5 size-12 rounded-full shadow-[0_0_0_3px_#151515] first:ml-0" id={id} key={id} />)}</span>
        <span className="font-label text-[8px] uppercase tracking-[0.14em] text-paper/45">Your team</span>
      </span>
    </div>
  );
}
