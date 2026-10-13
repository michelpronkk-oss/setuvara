import Link from "next/link";
import type { ReactNode } from "react";

import { MeetMark, Wordmark } from "../brand";
import { FinalCta } from "../home/closing";
import { Display, Label, Shell } from "../home/primitives";
import { PersonPhoto, TEAM_ORDER } from "../home/team-people";

/**
 * /roadmap: Live, Next and Later, in the homepage's style. Live items link to where they are
 * shown; Next and Later are clearly not available yet.
 */

type Item = { title: string; line: string; href?: string; glyph: ReactNode };

const g = "size-5";
const LIVE: Item[] = [
  { title: "Identity", line: "One identity built around you.", href: "/#modes", glyph: <MeetMark className={g} /> },
  { title: "Personal, Event & Business", line: "The right version of you for the moment.", href: "/#modes", glyph: <svg className={g} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 20 20"><rect height="14" rx="3" width="9" x="2" y="3" /><rect height="14" rx="3" width="9" x="9" y="3" /></svg> },
  { title: "Quick QR", line: "One QR that follows what you have Equipped.", href: "/#share", glyph: <svg className={g} fill="currentColor" viewBox="0 0 20 20"><path d="M2 2h7v7H2zm2 2v3h3V4zm7-2h7v7h-7zm2 2v3h3V4zM2 11h7v7H2zm2 2v3h3v-3zm7-2h3v3h-3zm4 0h3v3h-3zm-4 4h3v3h-3zm4 0h3v3h-3z" /></svg> },
  { title: "Setuvara Tap", line: "A tap that opens your Equipped identity.", href: "/#share", glyph: <svg className={g} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 20 20"><path d="M7 6a5 5 0 0 1 0 8M10 3.5a8.5 8.5 0 0 1 0 13M4 8.3a2.2 2.2 0 0 1 0 3.4" /></svg> },
  { title: "Connections", line: "Meet once. Keep the context.", href: "/#connections", glyph: <svg className={g} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 20 20"><circle cx="7" cy="10" r="4.5" /><circle cx="13" cy="10" r="4.5" /></svg> },
  { title: "Passport", line: "Stamps and milestones, earned by meeting.", href: "/#passport", glyph: <svg className={g} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 20 20"><rect height="16" rx="2.5" width="13" x="3.5" y="2" /><circle cx="10" cy="9" r="3" /><path d="M7 14.5h6" /></svg> },
  { title: "Analytics", line: "What happens after you share.", href: "/pricing", glyph: <svg className={g} fill="currentColor" viewBox="0 0 20 20"><rect height="6" rx="1" width="3" x="3" y="11" /><rect height="10" rx="1" width="3" x="8.5" y="7" /><rect height="14" rx="1" width="3" x="14" y="3" /></svg> },
];

export function RoadmapPage() {
  return (
    <>
      <Hero />
      <Live />
      <Next />
      <Later />
      <FinalCta />
    </>
  );
}

function Hero() {
  const counts = [
    { label: "Live", detail: "Here today", count: LIVE.length, dot: "bg-[#8fdc4e]" },
    { label: "Next", detail: "In progress", count: 4, dot: "bg-sky" },
    { label: "Later", detail: "Exploring", count: 1, dot: "bg-ink/30" },
  ];
  return (
    <section aria-labelledby="roadmap-title" className="relative isolate overflow-hidden">
      <span aria-hidden="true" className="absolute -right-40 -top-32 -z-10 size-[560px] rounded-full bg-[#c5ff47]/30 blur-[130px]" />
      <span aria-hidden="true" className="absolute -left-40 top-40 -z-10 size-[420px] rounded-full bg-sky/40 blur-[130px]" />
      <Shell className="grid grid-cols-[minmax(0,1fr)] gap-12 pb-16 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end lg:gap-16 lg:pb-24 lg:pt-24">
        <div className="flex flex-col gap-6">
          <Label className="text-coral">Roadmap</Label>
          <Display as="h1" className="text-[clamp(46px,7vw,112px)] leading-[0.88]"><span id="roadmap-title">Built around the moments that&nbsp;matter.</span></Display>
          <p className="max-w-[30rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[21px]">Built in the open. What’s live, what’s next, and what we’re exploring.</p>
        </div>
        <dl className="grid grid-cols-3 border-t-[1.5px] border-ink lg:grid-cols-1">
          {counts.map((item) => (
            <div className="flex flex-col gap-1 border-ink/15 py-4 pr-3 lg:flex-row lg:items-center lg:justify-between lg:border-b lg:pr-0" key={item.label}>
              <dt className="flex items-center gap-2 font-label text-[11px] uppercase tracking-[0.16em]"><span aria-hidden="true" className={`size-2 rounded-full ${item.dot}`} />{item.label}<span className="hidden text-ink/45 sm:inline">· {item.detail}</span></dt>
              <dd className="font-display text-[44px] font-extrabold leading-none tracking-[-0.06em] lg:text-[56px]">{item.count}</dd>
            </div>
          ))}
        </dl>
      </Shell>
    </section>
  );
}

function StageHead({ index, label, detail, title, tone, id }: { index: string; label: string; detail: string; title: string; tone: string; id: string }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Label className={tone}>{index} · {label}</Label>
        <span className="h-px flex-1 bg-current opacity-15" />
        <span className="font-label text-[11px] uppercase tracking-[0.16em] opacity-55">{detail}</span>
      </div>
      <Display className="max-w-[16ch] text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id={id}>{title}</span></Display>
    </div>
  );
}

function Live() {
  return (
    <section aria-labelledby="live-title" className="bg-white">
      <Shell className="flex flex-col gap-12 py-16 sm:gap-14 sm:py-28 lg:py-32">
        <StageHead detail="Here today" id="live-title" index="01" label="Live" title="Everything here works today." tone="text-[#4c8f1f]" />
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {LIVE.map((item, index) => (
            <li className={index === 0 ? "sm:col-span-2 lg:col-span-1 lg:row-span-2" : ""} key={item.title}>
              <Link className={`reveal group flex h-full flex-col justify-between gap-8 rounded-[1.75rem] p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink ${index === 0 ? "bg-ink text-paper hover:shadow-[0_30px_60px_-30px_rgba(13,13,13,.7)]" : "bg-paper hover:shadow-[0_24px_50px_-30px_rgba(13,13,13,.45)]"}`} href={item.href!}>
                <div className="flex items-center justify-between">
                  <span className={`grid size-11 place-items-center rounded-2xl ${index === 0 ? "bg-coral text-ink" : "bg-white text-ink shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]"}`}>{item.glyph}</span>
                  <span className={`inline-flex items-center gap-1.5 font-label text-[10px] uppercase tracking-[0.14em] ${index === 0 ? "text-paper/60" : "text-ink/50"}`}><span className="size-1.5 rounded-full bg-[#8fdc4e] [animation:sv-pulse_2.4s_ease-in-out_infinite]" />Live</span>
                </div>
                {index === 0 ? <MeetMark className="mx-auto hidden w-[62%] text-coral lg:block" /> : null}
                <div className="flex flex-col gap-1.5">
                  <h3 className={`font-display font-bold leading-[1.02] tracking-[-0.045em] ${index === 0 ? "text-[32px] sm:text-[40px]" : "text-[24px]"}`}>{item.title}</h3>
                  <p className={`text-[14px] leading-[1.5] ${index === 0 ? "text-paper/65" : "text-ink/60"}`}>{item.line}</p>
                  <span aria-hidden="true" className={`mt-3 text-[13px] font-semibold transition-transform duration-300 group-hover:translate-x-1 ${index === 0 ? "text-coral" : "text-ink"}`}>See it →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Shell>
    </section>
  );
}

function Next() {
  return (
    <section aria-labelledby="next-title" className="relative isolate overflow-hidden bg-ink text-paper">
      <span aria-hidden="true" className="absolute -right-40 top-0 -z-10 size-[600px] rounded-full bg-sky/15 blur-[140px]" />
      <span aria-hidden="true" className="absolute -bottom-60 -left-20 -z-10 size-[520px] rounded-full bg-coral/15 blur-[140px]" />
      <Shell className="flex flex-col gap-12 py-16 sm:gap-14 sm:py-28 lg:py-32">
        <StageHead detail="In progress" id="next-title" index="02" label="Next" title="What we’re building now." tone="text-sky" />
        <ol className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-5">
          <NextCard className="lg:col-span-3" line="Carry your identity in Apple and Google Wallet. The pass follows what you have Equipped." title="Apple & Google Wallet" visual={<WalletVisual />} />
          <NextCard className="lg:col-span-3" href="/teams" line="Your company’s Business Mode, worn by your people. In development." title="Setuvara for Teams" visual={<TeamsVisual />} />
          <NextCard className="lg:col-span-3" line="More ways to make your identity feel like yours." title="Identity expression" visual={<ExpressionVisual />} />
          <NextCard className="lg:col-span-3" line="Making sharing, connecting and remembering faster and more effortless." title="Product refinement" visual={<RefineVisual />} />
        </ol>
      </Shell>
    </section>
  );
}

function NextCard({ title, line, visual, href, className = "" }: { title: string; line: string; visual: ReactNode; href?: string; className?: string }) {
  const body = (
    <>
      <div aria-hidden="true" className="relative grid h-52 place-items-center overflow-hidden border-b border-paper/[0.07] bg-[radial-gradient(120%_90%_at_50%_0%,rgba(245,244,239,.07),transparent_70%)] sm:h-60">{visual}</div>
      <div className="flex flex-1 flex-col gap-2 p-6">
        <span className="font-label text-[10px] uppercase tracking-[0.16em] text-sky">In progress</span>
        <h3 className="mt-1 font-display text-[26px] font-bold leading-[1.02] tracking-[-0.045em] sm:text-[30px]">{title}</h3>
        <p className="text-[14px] leading-[1.5] text-paper/60">{line}</p>
        {href ? <span aria-hidden="true" className="mt-2 text-[13px] font-semibold text-coral transition-transform duration-300 group-hover:translate-x-1">Learn more →</span> : null}
      </div>
    </>
  );
  const shell = "reveal group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white/[0.045] shadow-[inset_0_0_0_1px_rgba(245,244,239,.08)] transition-colors duration-500 hover:bg-white/[0.07]";
  return <li className={className}>{href ? <Link className={`${shell} focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral`} href={href}>{body}</Link> : <div className={shell}>{body}</div>}</li>;
}

function WalletVisual() {
  return (
    <div className="relative h-44 w-[280px]">
      <div className="absolute left-2 top-6 h-36 w-[200px] -rotate-6 rounded-[18px] bg-[#232323] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]" />
      <div className="absolute right-2 top-1 w-[220px] rotate-3 rounded-[18px] bg-paper p-4 text-ink shadow-[0_30px_50px_-20px_rgba(0,0,0,.8)] transition-transform duration-500 group-hover:rotate-0">
        <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><MeetMark className="size-5 text-coral" /><Wordmark className="text-[15px]" /></span><span className="font-label text-[8px] uppercase tracking-[0.14em] text-ink/50">Event</span></div>
        <p className="mt-5 font-display text-[22px] font-bold leading-none tracking-[-0.04em]">Theo Laurent</p>
        <p className="mt-1 text-[10px] text-ink/55">Slush · Helsinki</p>
        <div className="mt-3 flex items-end justify-between"><span className="h-1.5 w-16 rounded-full bg-coral" /><span className="grid size-10 grid-cols-4 gap-px rounded-md bg-ink p-1">{Array.from({ length: 16 }, (_, i) => <span className={`rounded-[1px] ${[0, 3, 5, 6, 9, 10, 12, 15].includes(i) ? "bg-paper" : ""}`} key={i} />)}</span></div>
      </div>
    </div>
  );
}

function TeamsVisual() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex">
        {TEAM_ORDER.map((id) => <PersonPhoto className="-ml-3 size-[60px] rounded-full shadow-[0_0_0_3px_#151515] transition-transform duration-500 first:ml-0 group-hover:-translate-y-1" id={id} key={id} />)}
      </div>
      <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3.5 py-1.5 text-[12px] font-semibold shadow-[inset_0_0_0_1px_rgba(245,244,239,.1)]"><span className="grid size-5 place-items-center rounded-full bg-coral"><MeetMark className="size-3 text-ink" /></span>One Business Mode · 5 people</span>
    </div>
  );
}

function ExpressionVisual() {
  const swatches = ["#FF5A4F", "#C7FF4A", "#AFCBFF", "#E8A6FF", "#F5C66E"];
  return (
    <div className="flex items-center gap-3">
      {swatches.map((hex, index) => (
        <span className="h-28 w-11 rounded-full shadow-[0_20px_30px_-16px_rgba(0,0,0,.8)] transition-transform duration-500 group-hover:-translate-y-2" key={hex} style={{ background: hex, transform: `translateY(${[8, -6, 4, -10, 6][index]}px)`, transitionDelay: `${index * 40}ms` }} />
      ))}
    </div>
  );
}

function RefineVisual() {
  return (
    <div className="flex w-[240px] flex-col gap-2.5">
      {["Share", "Connect", "Remember"].map((step, index) => (
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(245,244,239,.06)]" key={step}>
          <span className="grid size-6 place-items-center rounded-full bg-coral font-label text-[10px] text-ink">{index + 1}</span>
          <span className="flex-1 text-[13px] font-semibold">{step}</span>
          <span className="h-1 w-12 overflow-hidden rounded-full bg-paper/10"><span className="block h-full w-2/3 rounded-full bg-sky" /></span>
        </div>
      ))}
    </div>
  );
}

function Later() {
  return (
    <section aria-labelledby="later-title" className="bg-[#e8e2d4]">
      <Shell className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 py-16 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20 lg:py-32">
        <div className="flex flex-col gap-6">
          <StageHead detail="Exploring" id="later-title" index="03" label="Later" title="Physical Setuvara." tone="text-[#a43d36]" />
          <p className="max-w-[28rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[20px]">A physical way to tap or scan your identity. Always the latest you, wherever you carry it.</p>
          <a className="inline-flex min-h-11 items-center gap-2 self-start text-[16px] font-semibold underline decoration-[1.5px] underline-offset-[6px] hover:text-coral focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral" href="mailto:hello@setuvara.com?subject=Setuvara%20roadmap">Tell us what to build next <span aria-hidden="true">→</span></a>
        </div>
        <div aria-hidden="true" className="reveal relative mx-auto aspect-[1.586] w-full max-w-[460px] -rotate-6 overflow-hidden rounded-[1.6rem] bg-[#141414] text-paper shadow-[inset_0_0_0_1px_rgba(245,244,239,.12),0_50px_90px_-30px_rgba(13,13,13,.7)]">
          <MeetMark className="absolute -right-[12%] -top-[18%] w-[72%] text-coral" />
          <span className="absolute left-6 top-6 inline-flex items-center rounded-full border border-paper/30 px-2 py-0.5 font-label text-[10px] uppercase tracking-[0.14em] text-paper/60">Exploring</span>
          <Wordmark className="absolute bottom-5 left-6 text-[30px]" />
          <svg className="absolute bottom-6 right-6 size-7 text-paper/50" fill="none" viewBox="0 0 24 24"><path d="M8.5 7.5a6 6 0 0 1 0 9M12 5a9.5 9.5 0 0 1 0 14M5 10a2.6 2.6 0 0 1 0 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" /></svg>
        </div>
      </Shell>
    </section>
  );
}
