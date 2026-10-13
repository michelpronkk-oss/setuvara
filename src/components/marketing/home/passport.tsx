import { passportDisplay } from "@/app/app/passport/fonts";
import { MilestoneLine } from "@/components/passport/milestone-line";
import { PassportCover } from "@/components/passport/passport-cover";
import { PassportAheadStamp, PassportStamp } from "@/components/passport/passport-stamp";
import { QrFrame } from "@/components/profile/qr-frame";
import { PASSPORT_REWARDS, type PassportReward } from "@/lib/passport/rewards";
import { coverSerial, nextMilestone } from "@/lib/passport/view";

import { QRCodeSVG } from "qrcode.react";
import type { ReactNode } from "react";

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

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Label>Rewards</Label>
            <p className="text-[13px] text-ink/60">Earned, never bought. Worn on your identity.</p>
          </div>
          <div className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0">
            <RewardCard reward={reward("signal_accent")} tone="uncommon" visual={<AccentVisual />} />
            <RewardCard reward={reward("coral_qr_frame")} tone="signature" visual={<FrameVisual />} />
            <RewardCard reward={reward("thousand_cover")} tone="legendary" visual={<CoverVisual />} />
          </div>
        </div>
      </Shell>
    </section>
  );
}

const reward = (id: string) => PASSPORT_REWARDS.find((item) => item.id === id)!;

const RARITY = {
  uncommon: { card: "bg-paper text-ink", stage: "bg-white", chip: "bg-sky text-ink", muted: "text-ink/60" },
  signature: { card: "bg-coral text-ink", stage: "bg-ink", chip: "bg-ink text-paper", muted: "text-ink/70" },
  legendary: { card: "bg-ink text-paper shadow-[inset_0_0_0_1px_rgba(214,178,94,.45)]", stage: "bg-[radial-gradient(circle_at_50%_40%,#2a2418,#0d0d0d_70%)]", chip: "bg-[#d6b25e] text-ink", muted: "text-paper/60" },
};

function RewardCard({ reward: item, tone, visual }: { reward: PassportReward; tone: keyof typeof RARITY; visual: ReactNode }) {
  const style = RARITY[tone];
  const unlocked = item.milestone <= example.count;
  return (
    <article className={`reveal flex w-[80%] max-w-[360px] shrink-0 snap-start flex-col overflow-hidden rounded-[1.75rem] lg:w-auto lg:max-w-none ${style.card}`}>
      <div aria-hidden="true" className={`relative grid h-60 place-items-center overflow-hidden ${style.stage}`}>{visual}</div>
      <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className={`rounded-full px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.14em] ${style.chip}`}>{item.rarity}</span>
          <span className={`font-label text-[10px] uppercase tracking-[0.14em] ${style.muted}`}>{unlocked ? "Earned" : `At ${item.milestone} connections`}</span>
        </div>
        <p className="mt-2 font-display text-[28px] font-bold leading-none tracking-[-0.045em]">{item.name}</p>
        <p className={`text-[13px] leading-5 ${style.muted}`}>{item.description}</p>
      </div>
    </article>
  );
}

/** Signal Accent: the coral note on a public identity (name rule, link edge, Connect). */
function AccentVisual() {
  return (
    <div className="w-[74%] -rotate-3 rounded-[20px] bg-paper p-4 shadow-[0_22px_36px_-20px_rgba(13,13,13,.5)]">
      <p className="font-label text-[8px] uppercase tracking-[0.2em] text-coral">Personal</p>
      <p className="mt-2 font-display text-[30px] font-extrabold leading-none tracking-[-0.05em]">Aanya Rao</p>
      <span className="mt-2 block h-[3px] w-14 rounded-full bg-coral" />
      <div className="mt-3 flex h-8 items-center rounded-[10px] px-2.5 text-[10px] font-semibold shadow-[inset_0_0_0_1.5px_rgba(255,90,79,.55)]">Sunday run mix</div>
      <div className="mt-2 flex h-8 items-center justify-center rounded-full bg-coral text-[11px] font-semibold text-ink">Connect</div>
    </div>
  );
}

/** Coral Frame: the real QR frame from Share, around a real code. */
function FrameVisual() {
  return (
    <div className="w-[132px] rotate-2">
      <QrFrame accent="#FF5A4F" modeLabel="Personal" name="Aanya Rao" style="accent-frame">
        <QRCodeSVG bgColor="#ffffff" className="block h-auto w-full" fgColor="#0d0d0d" level="M" marginSize={0} size={120} value="https://setuvara.com/" />
      </QrFrame>
    </div>
  );
}

/** Thousand Cover: the real Passport cover in its Thousand look. */
function CoverVisual() {
  return (
    <div className="-rotate-6 [filter:drop-shadow(0_24px_30px_rgba(0,0,0,.7))]">
      <PassportCover connections={1000} handle={example.handle} idPrefix="home-thousand" look="thousand" name={example.name} serial={coverSerial(example.handle)} since={example.since} stamps={24} width="138px" />
    </div>
  );
}
