import Link from "next/link";

import { CharacterAvatar } from "@/components/avatar/character-avatar";
import { PassportStamp } from "@/components/passport/passport-stamp";
import { nameFontClasses } from "@/components/profile/name-fonts";

import { FinalCta } from "../home/closing";
import { CastPhone } from "../home/mode-phone";
import { ClaimForm, Display, Label, Shell } from "../home/primitives";
import { ConnectChoice } from "../pricing/looks";

/**
 * /events: everything Event Mode does today, in the homepage's style. Every claim maps to a live
 * feature (Event Mode settings, Live Context, opaque /s/ links, connect_policy, encounter context,
 * Connections search, Passport event stamps).
 */

const FIELDS = [
  ["Event", "Slush"],
  ["City", "Helsinki"],
  ["When", "November"],
  ["Role", "Partnerships · Lumen Labs"],
  ["Here to meet", "Climate founders and grid operators"],
] as const;

export function EventsPage() {
  return (
    <>
      <Hero />
      <Before />
      <InTheRoom />
      <ConnectChoice />
      <After />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section aria-labelledby="events-hero-title" className="overflow-hidden">
      <Shell className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 pb-16 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:pb-24 lg:pt-20">
        <div className="flex flex-col gap-6">
          <Label className="text-coral">For events</Label>
          <Display as="h1" className="text-[clamp(46px,7vw,112px)] leading-[0.88]"><span id="events-hero-title">Your identity for this&nbsp;moment.</span></Display>
          <p className="max-w-[30rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[21px]">Set Event Mode before. Share it in the room. Remember everyone after.</p>
          <div className="mt-2 flex w-full flex-col gap-3"><ClaimForm id="events-claim" /></div>
        </div>
        <div className={`${nameFontClasses} flex justify-center`}>
          <div className="grid w-full max-w-[460px] place-items-center rounded-[2.5rem] bg-coral px-6 py-10 sm:py-12">
            <div className="relative h-[476px] w-[230px] sm:h-[580px] sm:w-[280px]"><div className="absolute left-0 top-0 origin-top-left scale-[.82] sm:scale-100"><CastPhone slug="event" /></div></div>
          </div>
        </div>
      </Shell>
    </section>
  );
}

function Before() {
  return (
    <section aria-labelledby="before-title" className="bg-white">
      <Shell className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 py-16 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20 lg:py-36">
        <div className="flex flex-col gap-6">
          <Label>01 · Before</Label>
          <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id="before-title">Set it before you arrive.</span></Display>
          <p className="max-w-[28rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[20px]">Event Mode carries the event, your role and who you’re here to meet. Your Personal Mode stays yours.</p>
          <ul className="border-t border-ink/15">
            {[["Its own look", "Pick an Appearance just for this event."], ["Its own links", "Pitch deck in, playlist out."], ["Its own QR", "A code that opens Event Mode only."]].map(([title, line]) => (
              <li className="flex flex-col gap-0.5 border-b border-ink/15 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6" key={title}>
                <span className="text-[16px] font-semibold">{title}</span>
                <span className="text-[13.5px] text-ink/60">{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div aria-hidden="true" className="reveal rounded-[2rem] bg-paper p-5 shadow-[0_40px_80px_-50px_rgba(13,13,13,.45)] sm:p-7">
          <div className="flex items-center justify-between pb-4">
            <span className="font-display text-[22px] font-bold tracking-[-0.03em]">Event Mode</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 font-label text-[10px] uppercase tracking-[0.14em] text-paper"><span className="size-1.5 rounded-full bg-lime" />On</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {FIELDS.map(([label, value]) => (
              <div className="rounded-2xl border border-ink/12 bg-white px-4 py-3" key={label}>
                <span className="block font-label text-[10px] uppercase tracking-[0.14em] text-ink/50">{label}</span>
                <span className="mt-0.5 block text-[15px] font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </Shell>
    </section>
  );
}

function InTheRoom() {
  return (
    <section aria-labelledby="room-title" className="bg-ink text-paper">
      <Shell className="flex flex-col gap-12 py-16 sm:gap-16 sm:py-28 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <div className="flex flex-col gap-5">
            <Label className="text-coral">02 · In the room</Label>
            <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id="room-title">Share the version that fits the room.</span></Display>
          </div>
          <p className="max-w-[26rem] text-[18px] leading-[1.45] text-paper/70 sm:text-[20px]">They see Event Mode. Nothing else.</p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3 lg:gap-6">
          <article className="reveal flex flex-col gap-6 rounded-[1.75rem] bg-white/[0.06] p-6 shadow-[inset_0_0_0_1px_rgba(245,244,239,.08)]">
            <div aria-hidden="true" className="grid h-40 place-items-center">
              <p className="inline-flex h-9 items-center gap-2 rounded-full bg-black/40 px-4 text-[13.5px] font-medium shadow-[inset_0_0_0_1px_rgba(245,244,239,.12)]">
                <span className="size-2 rounded-full bg-coral shadow-[0_0_0_3px_rgba(255,90,79,.3)] [animation:sv-pulse_2.2s_ease-in-out_infinite]" />
                <b className="font-bold">Live</b> · Slush 2026 · until 18:00
              </p>
            </div>
            <Card title="Live Context" line="Say where you are. It shows on your profile while you’re there, then ends by itself." />
          </article>
          <article className="reveal flex flex-col gap-6 rounded-[1.75rem] bg-white/[0.06] p-6 shadow-[inset_0_0_0_1px_rgba(245,244,239,.08)]">
            <div aria-hidden="true" className="flex h-40 flex-col justify-center gap-2.5">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3">
                <span className="truncate font-label text-[12px] text-paper/85">setuvara.com/s/k7Qx2mPa</span>
                <span className="shrink-0 text-[12px] font-semibold text-coral">Copy</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl px-4 py-2 text-[12px] text-paper/50 shadow-[inset_0_0_0_1px_rgba(245,244,239,.1)]">
                <span>No username in the link</span><span className="font-semibold text-paper/80">New link</span>
              </div>
            </div>
            <Card title="A private link" line="Event Mode gets its own short link. Make a new one whenever you like." />
          </article>
          <article className="reveal flex flex-col gap-6 rounded-[1.75rem] bg-white/[0.06] p-6 shadow-[inset_0_0_0_1px_rgba(245,244,239,.08)]">
            <div aria-hidden="true" className="flex h-40 items-center justify-center gap-2">
              {["QR", "AirDrop", "Messages"].map((item, index) => (
                <span className={`rounded-full px-4 py-2 text-[13px] font-semibold ${index === 0 ? "bg-coral text-ink" : "bg-white/10 text-paper/80"}`} key={item}>{item}</span>
              ))}
            </div>
            <Card title="Any way they like" line="Show your QR, or send it to any app with native share." />
          </article>
        </div>
      </Shell>
    </section>
  );
}

function Card({ title, line }: { title: string; line: string }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-paper/15 pt-5">
      <h3 className="font-display text-[24px] font-bold leading-tight tracking-[-0.035em]">{title}</h3>
      <p className="text-[14px] leading-[1.5] text-paper/65">{line}</p>
    </div>
  );
}

const PEOPLE = [
  { name: "Lena Fischer", role: "Product Designer · Atelier Nord", when: "Thu 14:20" },
  { name: "Elif Demir", role: "Founder · Kestrel Grid", when: "Thu 16:05" },
  { name: "Jonas Berg", role: "Talent · Lumen Labs", when: "Fri 10:40" },
];

function After() {
  return (
    <section aria-labelledby="after-title" className="bg-[#ffe1dc]">
      <Shell className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 py-16 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20 lg:py-36">
        <div className="flex flex-col gap-6">
          <Label>03 · After</Label>
          <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id="after-title">Remember everyone from Slush.</span></Display>
          <p className="max-w-[28rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[20px]">Every connection keeps the event, the city and the time you met. Search Connections by event, and your Passport gets the stamp.</p>
          <Link className="inline-flex min-h-11 items-center gap-2 self-start text-[16px] font-semibold underline decoration-[1.5px] underline-offset-[6px] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" href="/#passport">See the Passport <span aria-hidden="true">→</span></Link>
        </div>
        <div aria-hidden="true" className="reveal relative">
          <div className="rounded-[2rem] bg-paper p-5 shadow-[0_40px_80px_-40px_rgba(13,13,13,.5)] sm:p-6">
            <div className="flex h-11 items-center rounded-full bg-white px-4 text-[14px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]"><span className="text-ink">Slush</span><span className="ml-auto font-label text-[10px] uppercase tracking-[0.14em] text-ink/50">3 people</span></div>
            <ul className="mt-2">
              {PEOPLE.map((person) => (
                <li className="flex items-center gap-3 border-b border-ink/10 py-3.5 last:border-0" key={person.name}>
                  <CharacterAvatar className="size-10 shrink-0 rounded-full" seed={person.name} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{person.name}</span><span className="block truncate text-[12px] text-ink/55">{person.role}</span></span>
                  <span className="shrink-0 text-right font-label text-[10px] uppercase leading-4 tracking-[0.12em] text-ink/55">Slush · Helsinki<br />{person.when}</span>
                </li>
              ))}
            </ul>
          </div>
          <span className="absolute -right-3 -top-10 block size-[132px] sm:-right-8 sm:size-[150px]"><PassportStamp rotation={8} sub="HELSINKI · 2026" title="Slush" type="event" /></span>
        </div>
      </Shell>
    </section>
  );
}
