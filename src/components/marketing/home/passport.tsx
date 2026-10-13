import { passportDisplay } from "@/app/app/passport/fonts";
import { MilestoneLine } from "@/components/passport/milestone-line";
import { PassportCover } from "@/components/passport/passport-cover";
import { PassportAheadStamp, PassportStamp } from "@/components/passport/passport-stamp";
import { coverSerial, nextMilestone } from "@/lib/passport/view";

import { Display, Label, Shell } from "./primitives";

// Example Passport, drawn with the real Passport cover and stamps from /app/passport.
// 87 unique connections: Signal 50 is the latest milestone, Century (100) is next.
const example = { name: "Aanya Rao", handle: "aanya", since: "03 · 25", count: 87, stamps: 11 };
const next = nextMilestone(example.count)!;

const STAMPS = [
  { type: "milestone", title: "Signal 50", threshold: 50, sub: "OCT · 2026", caption: "Signal 50", meta: "Milestone", rotation: -6 },
  { type: "city", title: "Lisbon", code: "PT", sub: "2026", caption: "Lisbon", meta: "City", rotation: 5 },
  { type: "event", title: "Slush", sub: "HELSINKI · 2026", caption: "Slush", meta: "Event", rotation: -4 },
  { type: "country", title: "FI", code: "FI", sub: "2026", caption: "Finland", meta: "Country", rotation: 7 },
] as const;

const RULES = [
  { title: "Earned, never bought", detail: "Every stamp, milestone and cover, on every plan." },
  { title: "Only real encounters", detail: "Places come from the event or city you met in. Never GPS." },
  { title: "Yours alone", detail: "Private by default. No streaks, ranks or leaderboards." },
];

export function Passport() {
  return (
    <section aria-labelledby="passport-title" className={`${passportDisplay.variable} scroll-mt-16 overflow-hidden bg-[#e8e2d4]`} id="passport">
      <Shell className="flex flex-col gap-14 py-16 sm:gap-20 sm:py-28 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              <Label className="text-[#a43d36]">Passport</Label>
              <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id="passport-title">What you’ve built, kept.</span></Display>
              <p className="max-w-[28rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[20px] lg:text-[22px]">A book you keep, not a dashboard. Every real connection presses a stamp, and nothing ever expires.</p>
            </div>
            <ul className="border-t border-ink/15">
              {RULES.map((rule) => (
                <li className="flex flex-col gap-0.5 border-b border-ink/15 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6" key={rule.title}>
                  <span className="text-[16px] font-semibold">{rule.title}</span>
                  <span className="text-[13.5px] text-ink/60 sm:text-right">{rule.detail}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* The object: an earned Paper cover with the Plus Member finish, the standard cover beneath it. */}
          <div aria-hidden="true" className="reveal relative mx-auto flex w-full max-w-[460px] justify-center py-6 sm:py-10">
            <div className="absolute left-1/2 top-1/2 -translate-x-[6%] -translate-y-1/2 rotate-[8deg] sm:-translate-x-[18%] opacity-95 [filter:drop-shadow(0_30px_40px_rgba(13,13,13,.25))]">
              <PassportCover connections={example.count} handle={example.handle} idPrefix="home-standard" look="standard" name={example.name} serial={coverSerial(example.handle)} since={example.since} stamps={example.stamps} width="min(270px, 56vw)" />
            </div>
            <div className="relative -translate-x-[16%] -rotate-[4deg] sm:-translate-x-[14%] [filter:drop-shadow(0_40px_50px_rgba(13,13,13,.32))]">
              <PassportCover
                connections={example.count}
                featured={<PassportStamp rotation={-9} sub="OCT · 2026" threshold={50} title="Signal 50" type="milestone" />}
                featuredDisc={false}
                handle={example.handle}
                idPrefix="home-paper"
                look="paper"
                member
                name={example.name}
                serial={coverSerial(example.handle)}
                since={example.since}
                stamps={example.stamps}
                width="min(290px, 60vw)"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8 rounded-[2rem] bg-paper p-6 shadow-[0_30px_60px_-40px_rgba(13,13,13,.35)] sm:p-10 lg:p-12">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Label>Stamps</Label>
            <p className="text-[13px] text-ink/60">Four kinds. Pressed as you meet people.</p>
          </div>
          <ul aria-label="Example stamps" className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {STAMPS.map((stamp) => (
              <li className="flex flex-col items-center gap-3 text-center" key={stamp.caption}>
                <span className="block size-[clamp(112px,26vw,148px)]"><PassportStamp code={"code" in stamp ? stamp.code : null} label={`${stamp.meta} stamp: ${stamp.caption}`} rotation={stamp.rotation} sub={stamp.sub} threshold={"threshold" in stamp ? stamp.threshold : null} title={stamp.title} type={stamp.type} /></span>
                <span className="flex flex-col gap-0.5"><span className="text-[15px] font-semibold">{stamp.caption}</span><span className="font-label text-[10px] uppercase tracking-[0.14em] text-ink/55">{stamp.meta}</span></span>
              </li>
            ))}
            <li className="col-span-2 flex flex-col items-center gap-3 text-center sm:col-span-1">
              <span className="block size-[clamp(112px,26vw,148px)]"><PassportAheadStamp count={example.count} label={`Next milestone: ${next.name}, ${example.count} of ${next.threshold}`} state="progress" threshold={next.threshold} /></span>
              <span className="flex flex-col gap-0.5"><span className="text-[15px] font-semibold">{next.name}</span><span className="font-label text-[10px] uppercase tracking-[0.14em] text-[#a43d36]">{next.threshold - example.count} to go</span></span>
            </li>
          </ul>

          <div className="flex flex-col gap-4 border-t border-ink/10 pt-7">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <Label>Milestones · Next {next.name} at {next.threshold}</Label>
              <p className="text-[13px] text-ink/60">Unique people, counted once.</p>
            </div>
            <MilestoneLine count={example.count} />
          </div>
        </div>
      </Shell>
    </section>
  );
}
