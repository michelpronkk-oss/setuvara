import Link from "next/link";

import { nameFontClasses } from "@/components/profile/name-fonts";

import { FinalCta } from "../home/closing";
import { HeroModes } from "../home/hero-modes";
import { CAST, CastPhone } from "../home/mode-phone";
import { PhoneStage } from "../home/phone-stage";
import { ClaimForm, Display, Label, Shell } from "../home/primitives";
import type { DemoMode } from "../home/demo";
import { ConnectChoice, Looks } from "../pricing/looks";

/**
 * /modes: Personal, Event and Business in depth. Every claim maps to a live feature: per-Mode
 * fields (public-profile.ts), links, Appearances, opaque /s/ links for Event and Business,
 * connect_policy, Live Context, Save contact, and the Mode never being named publicly.
 */

type Chapter = {
  slug: DemoMode["slug"];
  index: string;
  name: string;
  title: string;
  line: string;
  fields: [string, string][];
  share: string;
  tone: string;
};

const CHAPTERS: Chapter[] = [
  {
    slug: "personal",
    index: "01",
    name: "Personal",
    title: "The you your friends know.",
    line: "Your bio, your city, your music and the links you actually use. The Mode for the people you choose.",
    fields: [["Bio", "A line or two, in your words"], ["Based in", "Lisbon"], ["Soundtrack", "A song that plays when they open it"], ["Links", "Instagram, Spotify, WhatsApp"]],
    share: "setuvara.com/aanya",
    tone: "bg-white",
  },
  {
    slug: "event",
    index: "02",
    name: "Event",
    title: "The you that belongs in this room.",
    line: "The event, the city, your role and who you’re here to meet. Go Live while you’re there, and it ends by itself.",
    fields: [["Event", "Slush · Helsinki"], ["When", "November"], ["Role", "Partnerships"], ["Here to meet", "Climate founders and grid operators"]],
    share: "setuvara.com/s/k7Qx2mPa",
    tone: "bg-paper",
  },
  {
    slug: "business",
    index: "03",
    name: "Business",
    title: "The you that closes the meeting.",
    line: "Role, company, city and what you do. Add a booking link and it gets its own button, so the next step is one tap.",
    fields: [["Role", "Partnerships Lead"], ["Company", "Setuvara"], ["City", "Lisbon"], ["Booking", "Book a 20-min intro"]],
    share: "setuvara.com/s/R3vT9wLe",
    tone: "bg-white",
  },
];

export function ModesPage() {
  return (
    <>
      <Hero />
      <Index />
      {CHAPTERS.map((chapter, index) => <ModeChapter chapter={chapter} flip={index % 2 === 1} key={chapter.slug} />)}
      <Separate />
      <Looks />
      <ConnectChoice />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section aria-labelledby="modes-hero-title" className="relative overflow-hidden">
      <Shell className="flex flex-col items-center pb-14 pt-10 text-center sm:pt-16 lg:pb-20 lg:pt-20">
        <Label className="text-coral">Modes</Label>
        <Display as="h1" className="mt-5 text-[clamp(46px,8vw,124px)] leading-[0.88] sm:mt-6">
          <span id="modes-hero-title">One identity.<br />Three ways to meet.</span>
        </Display>
        <p className="mt-5 max-w-[24rem] text-[18px] leading-[1.4] text-ink/70 sm:mt-7 sm:max-w-[34rem] sm:text-[21px]">Personal, Event and Business. Each with its own links, look, link and QR. They only ever see the one you share.</p>
        <div className="mt-8 flex w-full flex-col items-center gap-3 sm:mt-10"><ClaimForm id="modes-claim" /></div>
        <div className={`${nameFontClasses} mt-8 w-full max-w-[880px] sm:mt-12`}>
          <HeroModes
            cards={[<CastPhone key="personal" slug="personal" />, <CastPhone key="event" slug="event" />, <CastPhone key="business" slug="business" />]}
            caption="Three people · Three Modes"
          />
        </div>
      </Shell>
    </section>
  );
}

function Index() {
  return (
    <section aria-label="The three Modes" className="border-y border-ink/10 bg-white">
      <Shell className="grid grid-cols-[minmax(0,1fr)] divide-y divide-ink/10 md:grid-cols-3 md:divide-x md:divide-y-0">
        {CHAPTERS.map((chapter) => {
          const { who } = CAST[chapter.slug];
          return (
            <Link className="group flex items-center gap-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink md:px-6 md:py-7 md:first:pl-0 md:last:pr-0" href={`#${chapter.slug}`} key={chapter.slug}>
              <span aria-hidden="true" className="size-12 shrink-0 rounded-full bg-cover shadow-[0_0_0_1px_rgba(13,13,13,.08)]" style={{ backgroundImage: `url(${who.photo})`, backgroundPosition: `${who.face.x}% ${who.face.y}%` }} />
              <span className="min-w-0 flex-1">
                <span className="block font-label text-[10px] uppercase tracking-[0.16em] text-ink/50">{chapter.index}</span>
                <span className="block font-display text-[24px] font-bold leading-tight tracking-[-0.04em]">{chapter.name}</span>
              </span>
              <span aria-hidden="true" className="text-[18px] text-ink/40 transition-transform group-hover:translate-y-0.5 group-hover:text-coral">↓</span>
            </Link>
          );
        })}
      </Shell>
    </section>
  );
}

function ModeChapter({ chapter, flip }: { chapter: Chapter; flip: boolean }) {
  const titleId = `${chapter.slug}-title`;
  return (
    <section aria-labelledby={titleId} className={`scroll-mt-16 ${chapter.tone}`} id={chapter.slug}>
      <Shell className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 py-16 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20 lg:py-36">
        <div className={`flex flex-col gap-6 ${flip ? "lg:order-2" : ""}`}>
          <Label>{chapter.index} · {chapter.name} Mode</Label>
          <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id={titleId}>{chapter.title}</span></Display>
          <p className="max-w-[28rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[20px]">{chapter.line}</p>
          <dl className="border-t border-ink/15">
            {chapter.fields.map(([term, value]) => (
              <div className="flex flex-col gap-0.5 border-b border-ink/15 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6" key={term}>
                <dt className="text-[16px] font-semibold">{term}</dt>
                <dd className="text-[13.5px] text-ink/60 sm:text-right">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="flex min-w-0 items-center gap-3 self-start rounded-full bg-ink py-1.5 pl-4 pr-1.5 text-paper">
            <span className="truncate font-label text-[12px] text-paper/85">{chapter.share}</span>
            <span className="shrink-0 rounded-full bg-coral px-3 py-1 text-[12px] font-semibold text-ink">QR</span>
          </p>
        </div>
        <div className={`${nameFontClasses} flex justify-center ${flip ? "lg:order-1" : ""}`}>
          <PhoneStage className="w-full max-w-[460px] rounded-[2.5rem] px-6 py-10 sm:py-12" slug={chapter.slug}>
            <div className="relative h-[476px] w-[230px] sm:h-[580px] sm:w-[280px]"><div className="absolute left-0 top-0 origin-top-left scale-[.82] sm:scale-100"><CastPhone slug={chapter.slug} /></div></div>
          </PhoneStage>
        </div>
      </Shell>
    </section>
  );
}

const SEPARATE = [
  { title: "Its own links", line: "60 providers, or your own. Pitch deck in Event, playlist in Personal.", visual: <LinkChips /> },
  { title: "Its own look", line: "Pick an Appearance per Mode. Clean for business, Immersive for friends.", visual: <LookDots /> },
  { title: "Its own link and QR", line: "Event and Business get a private short link with no username in it. Make a new one any time.", visual: <ShareRows /> },
  { title: "Never labelled", line: "Visitors never see the word Mode. They just see you, the way you chose.", visual: <NoLabel /> },
];

function Separate() {
  return (
    <section aria-labelledby="separate-title" className="bg-ink text-paper">
      <Shell className="flex flex-col gap-12 py-16 sm:gap-16 sm:py-28 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <div className="flex flex-col gap-5">
            <Label className="text-coral">Kept apart</Label>
            <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id="separate-title">What one Mode shows, the others don’t.</span></Display>
          </div>
          <p className="max-w-[26rem] text-[18px] leading-[1.45] text-paper/70 sm:text-[20px]">Change one, the others stay as they are.</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 lg:gap-6 xl:grid-cols-4">
          {SEPARATE.map((item) => (
            <article className="reveal flex flex-col gap-6 rounded-[1.75rem] bg-white/[0.06] p-6 shadow-[inset_0_0_0_1px_rgba(245,244,239,.08)]" key={item.title}>
              <div aria-hidden="true" className="flex h-36 items-center justify-center">{item.visual}</div>
              <div className="flex flex-col gap-1.5 border-t border-paper/15 pt-5">
                <h3 className="font-display text-[24px] font-bold leading-tight tracking-[-0.035em]">{item.title}</h3>
                <p className="text-[14px] leading-[1.5] text-paper/65">{item.line}</p>
              </div>
            </article>
          ))}
        </div>
      </Shell>
    </section>
  );
}

function LinkChips() {
  return (
    <div className="flex w-full flex-col gap-2">
      {[["Personal", "Sunday run mix"], ["Event", "Pitch deck"], ["Business", "Book a 20-min intro"]].map(([mode, link], index) => (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.08] px-3.5 py-2.5" key={mode}>
          <span className="truncate text-[13px] font-semibold">{link}</span>
          <span className={`shrink-0 font-label text-[9px] uppercase tracking-[0.14em] ${index === 1 ? "text-coral" : "text-paper/45"}`}>{mode}</span>
        </div>
      ))}
    </div>
  );
}

function LookDots() {
  return (
    <div className="flex items-end gap-3">
      {[["#0d0d0d", "#ff5a4f", "Immersive"], ["#f5f4ef", "#0d0d0d", "Clean"], ["#1c1033", "#c7ff4a", "Glow"]].map(([base, accent, name], index) => (
        <span className={`flex flex-col items-center gap-2 ${index === 1 ? "-translate-y-3" : ""}`} key={name}>
          <span className="relative h-24 w-14 overflow-hidden rounded-[14px] shadow-[0_0_0_1px_rgba(245,244,239,.15)]" style={{ background: base }}>
            <span className="absolute inset-x-2 bottom-2 h-1.5 rounded-full" style={{ background: accent }} />
            <span className="absolute inset-x-2 bottom-5 h-1 w-6 rounded-full opacity-50" style={{ background: accent }} />
          </span>
          <span className="font-label text-[9px] uppercase tracking-[0.14em] text-paper/55">{name}</span>
        </span>
      ))}
    </div>
  );
}

function ShareRows() {
  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3">
        <span className="truncate font-label text-[12px] text-paper/85">setuvara.com/s/k7Qx2mPa</span>
        <span className="shrink-0 text-[12px] font-semibold text-coral">Copy</span>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl px-4 py-2 text-[12px] text-paper/50 shadow-[inset_0_0_0_1px_rgba(245,244,239,.1)]">
        <span>No username</span><span className="font-semibold text-paper/80">New link</span>
      </div>
    </div>
  );
}

function NoLabel() {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <span className="text-[13px] text-paper/40 line-through decoration-coral decoration-2">Event Mode</span>
      <span className="font-display text-[26px] font-bold tracking-[-0.04em]">Theo Laurent</span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-[12px] shadow-[inset_0_0_0_1px_rgba(245,244,239,.12)]"><span className="size-1.5 rounded-full bg-coral" />Live · Slush 2026</span>
    </div>
  );
}
