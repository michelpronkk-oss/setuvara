import Link from "next/link";
import type { ReactNode } from "react";

import { CharacterAvatar } from "@/components/avatar/character-avatar";

import { nameFontClasses } from "@/components/profile/name-fonts";

import { FinalCta } from "../home/closing";
import { CastPhone } from "../home/mode-phone";
import { PhoneStage } from "../home/phone-stage";
import { Display, Label, LaterTag, Shell } from "../home/primitives";
import { Lettermark, TeamsConsole } from "../home/teams-console";

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

const TEAM = ["Aanya Rao", "Jonas Berg", "Mei Tanaka", "Ravi Menon", "Lena Fischer"];

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
          <a className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-ink px-7 text-[16px] font-semibold text-paper transition-colors hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink sm:self-auto" href="mailto:hello@setuvara.com?subject=Setuvara%20for%20Teams">hello@setuvara.com <span aria-hidden="true">→</span></a>
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
        <Lettermark className="size-8 text-[16px]" />
        <span className="text-[13px] font-semibold">Lumen Labs</span>
        <span className="font-label text-[9px] uppercase tracking-[0.14em] text-paper/45">24 people</span>
      </div>
      <div className="flex">
        {TEAM.map((name) => <CharacterAvatar className="-ml-3 size-14 rounded-full shadow-[0_0_0_3px_#0d0d0d] transition-transform duration-500 first:ml-0 group-hover:-translate-y-1" key={name} seed={name} />)}
        <span className="-ml-3 grid size-14 place-items-center rounded-full bg-paper/10 font-label text-[11px] text-paper/70 shadow-[0_0_0_3px_#0d0d0d]">+19</span>
      </div>
    </div>
  );
}

function TemplateVisual() {
  return (
    <div className="relative h-36 w-[240px]">
      {TEAM.slice(0, 3).map((name, index) => (
        <div className="absolute left-1/2 top-1/2 w-[150px] rounded-[18px] bg-paper p-3 text-ink shadow-[0_20px_30px_-16px_rgba(0,0,0,.7)] transition-transform duration-500" key={name} style={{ transform: `translate(calc(-50% + ${(index - 1) * 56}px), calc(-50% + ${Math.abs(index - 1) * 10}px)) rotate(${(index - 1) * 8}deg)`, zIndex: index === 1 ? 2 : 1 }}>
          <div className="flex items-center gap-2"><CharacterAvatar className="size-7 rounded-full" seed={name} /><Lettermark className="ml-auto size-5 rounded-[6px] text-[10px]" /></div>
          <p className="mt-2 truncate text-[12px] font-bold leading-tight">{name}</p>
          <p className="font-label text-[8px] uppercase tracking-[0.14em] text-ink/50">Lumen Labs</p>
          <span className="mt-2 block h-5 rounded-full bg-coral" />
        </div>
      ))}
    </div>
  );
}

function BrandVisual() {
  return (
    <div className="flex items-center gap-4">
      <Lettermark className="size-16 rounded-[18px] text-[32px] shadow-[0_18px_30px_-14px_rgba(175,203,255,.6)]" />
      <div className="flex flex-col gap-2">
        {["#AFCBFF", "#FF5A4F", "#F5F4EF"].map((hex) => <span className="h-3.5 rounded-full" key={hex} style={{ background: hex, width: hex === "#AFCBFF" ? 88 : hex === "#FF5A4F" ? 56 : 72 }} />)}
      </div>
    </div>
  );
}

function AttributionVisual() {
  return (
    <div className="flex w-[220px] flex-col gap-2.5">
      {[["Slush", 14], ["Web Summit", 9], ["SaaStock", 6]].map(([event, met]) => (
        <div className="flex items-center gap-3 text-[12px]" key={event}>
          <span className="w-[74px] shrink-0 truncate font-semibold">{event}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper/10"><span className="block h-full rounded-full bg-coral transition-[width] duration-700" style={{ width: `${(Number(met) / 14) * 100}%` }} /></span>
          <span className="w-5 text-right font-label text-[10px] text-paper/60">{met}</span>
        </div>
      ))}
    </div>
  );
}

function ConnectionsVisual() {
  return (
    <div className="flex items-center">
      <CharacterAvatar className="size-12 rounded-full shadow-[0_0_0_3px_#0d0d0d]" seed="Elif Demir" />
      <span className="h-px w-10 bg-gradient-to-r from-paper/20 to-coral" />
      <Lettermark className="size-14 rounded-[16px] text-[26px] shadow-[0_0_0_6px_rgba(255,90,79,.15)]" />
      <span className="h-px w-10 bg-gradient-to-r from-coral to-paper/20" />
      <div className="flex">
        {TEAM.slice(0, 3).map((name) => <CharacterAvatar className="-ml-2.5 size-12 rounded-full shadow-[0_0_0_3px_#0d0d0d] first:ml-0" key={name} seed={name} />)}
      </div>
    </div>
  );
}
