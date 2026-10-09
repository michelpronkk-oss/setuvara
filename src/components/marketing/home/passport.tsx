import { MILESTONES, PASSPORT_REWARDS, type PassportReward } from "@/lib/passport/rewards";

import { QRCodeSVG } from "qrcode.react";
import type { ReactNode } from "react";

import { MeetMark } from "../brand";
import { Display, Label, Shell } from "./primitives";

// Example Passport: 47 unique connections, so "In Motion" (25) is the latest
// milestone and "Signal 50" is next, straight from the real milestone ladder.
const example = { count: 47, cities: 9, events: 6, countries: 4 };
const nextMilestone = MILESTONES.find((milestone) => milestone.threshold > example.count)!;
const previousThreshold = [...MILESTONES].reverse().find((milestone) => milestone.threshold <= example.count)?.threshold ?? 0;
const progress = ((example.count - previousThreshold) / (nextMilestone.threshold - previousThreshold)) * 100;
const rewardById = (id: string) => PASSPORT_REWARDS.find((reward) => reward.id === id)!;

export function Passport() {
  return (
    <section aria-labelledby="passport-title" className="scroll-mt-16 bg-[#e8e2d4]" id="passport">
      <Shell className="flex flex-col gap-10 py-16 sm:gap-14 sm:py-28 lg:gap-20 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <div className="flex flex-col gap-5">
            <Label className="text-[#a43d36]">Passport</Label>
            <Display className="text-[clamp(40px,4.8vw,72px)] leading-[0.95]"><span id="passport-title">Every connection leaves a&nbsp;stamp.</span></Display>
          </div>
          <p className="max-w-[26rem] text-[18px] leading-[1.45] text-ink/70 sm:text-[20px] lg:text-[22px]">Milestones, events, cities, countries. Private, never a leaderboard.</p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8">
          <PassportCover />
          <Collection />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Label>Milestones</Label>
            <p className="text-[13px] text-ink/60">Unique people, counted once.</p>
          </div>
          <ol aria-label="Milestone ladder" className="grid grid-cols-4 gap-x-3 gap-y-6 sm:gap-x-6 lg:grid-cols-8">
            {MILESTONES.map((milestone) => <MilestoneCoin key={milestone.threshold} milestone={milestone} />)}
          </ol>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Label>Rewards</Label>
            <p className="text-[13px] text-ink/60">Earned, never bought. Worn on your identity.</p>
          </div>
          <div className="-mx-5 flex snap-x scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0">
            <RewardCard reward={rewardById("signal_accent")} tone="uncommon" visual={<AccentVisual />} />
            <RewardCard reward={rewardById("coral_qr_frame")} tone="signature" visual={<FrameVisual />} />
            <RewardCard reward={rewardById("thousand_cover")} tone="legendary" visual={<CoverVisual />} />
          </div>
        </div>
      </Shell>
    </section>
  );
}

function PassportCover() {
  return (
    <article aria-label="Example Passport" className="reveal relative flex flex-col overflow-hidden rounded-[2rem] bg-ink p-6 text-paper sm:p-9">
      <MeetMark className="pointer-events-none absolute -right-16 -top-10 size-64 text-white/[0.04]" />
      <Label className="!tracking-[0.24em] text-coral">Setuvara Passport</Label>
      <p className="mt-6 font-display text-[clamp(88px,11vw,148px)] font-extrabold leading-[0.8] tracking-[-0.07em]">{example.count}</p>
      <Label className="mt-3 text-paper/55">Unique connections</Label>

      <div className="mt-8 rounded-[1.5rem] border border-white/15 p-5">
        <Label className="!text-[10px] text-paper/55">Next milestone</Label>
        <p className="mt-2 text-[22px] font-semibold">{nextMilestone.threshold} · {nextMilestone.name}</p>
        <p className="mt-0.5 text-[13px] text-paper/55">{nextMilestone.threshold - example.count} to go</p>
        <div aria-label={`${example.count} of ${nextMilestone.threshold} connections to next milestone`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(progress)} className="mt-4 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar">
          <div className="progress-fill h-full rounded-full bg-coral" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-3 border-t border-white/15 pt-5">
        {([["Cities", example.cities], ["Events", example.events], ["Countries", example.countries]] as const).map(([label, value]) => (
          <div key={label}><dt className="sr-only">{label}</dt><dd><span className="block text-[28px] font-semibold tracking-tight">{value}</span><span aria-hidden="true" className="font-label text-[10px] uppercase tracking-[0.15em] text-paper/55">{label}</span></dd></div>
        ))}
      </dl>
    </article>
  );
}

function Collection() {
  return (
    <div aria-label="Example Collection of stamps" className="relative grid grid-cols-2 gap-4 rounded-[2rem] bg-paper p-4 sm:gap-5 sm:p-6" role="group">
      <Label className="col-span-2 px-1 pt-1 text-ink/55">Collection · Recent stamps</Label>

      {/* Event stamp: a ticket with a perforated stub. */}
      <div className="stamp-rotate col-span-2 flex overflow-hidden rounded-[1.25rem] bg-coral text-ink [--stamp-rotate:-1.5deg] sm:col-span-1">
        <div className="flex flex-1 flex-col justify-between gap-6 p-5">
          <Label className="!text-[10px]">Event stamp</Label>
          <div>
            <p className="font-display text-[40px] font-extrabold leading-[0.85] tracking-[-0.06em]">SLUSH</p>
            <p className="mt-2 text-[12px] font-semibold">Helsinki · Nov 2025</p>
          </div>
        </div>
        <div className="flex w-16 flex-col items-center justify-center border-l-2 border-dashed border-ink/40 font-label text-[10px] uppercase tracking-[0.2em] [writing-mode:vertical-rl]">Admit · 1</div>
      </div>

      {/* City stamp: a round postmark. */}
      <div className="stamp-rotate grid place-items-center [--stamp-rotate:6deg]">
        <div className="relative grid aspect-square w-full max-w-[230px] place-items-center rounded-full border-[3px] border-ink text-ink">
          <svg aria-hidden="true" className="absolute inset-0 size-full" viewBox="0 0 200 200">
            <circle cx="100" cy="100" fill="none" r="70" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" />
            <defs><path d="M100,100 m-82,0 a82,82 0 1,1 164,0 a82,82 0 1,1 -164,0" id="city-ring" /></defs>
            <text className="fill-current font-label text-[11px] uppercase" letterSpacing="3.2"><textPath href="#city-ring">City stamp · Netherlands · City stamp · 2026 ·</textPath></text>
          </svg>
          <div className="text-center">
            <p className="font-display text-[clamp(15px,3.6vw,21px)] font-extrabold leading-none tracking-[-0.03em]">AMSTERDAM</p>
            <p className="mt-1 font-label text-[10px] uppercase tracking-[0.2em] text-ink/60">Jun 2026</p>
          </div>
        </div>
      </div>

      {/* Country stamp: a double-ruled rectangle. */}
      <div className="stamp-rotate flex flex-col justify-between gap-5 rounded-lg border-[3px] border-double border-ink p-4 text-ink outline outline-[1.5px] outline-offset-[3px] outline-ink/30 [--stamp-rotate:-4deg]">
        <Label className="!text-[10px]">Country stamp</Label>
        <div>
          <p className="font-display text-[44px] font-extrabold leading-none tracking-[-0.05em]">PT</p>
          <p className="mt-1 text-[12px] font-semibold">Portugal</p>
        </div>
      </div>

      {/* Milestone stamp. */}
      <div className="stamp-rotate col-span-2 flex flex-col justify-between gap-5 rounded-[1.25rem] bg-ink p-4 text-paper [--stamp-rotate:2deg] sm:col-span-1">
        <Label className="!text-[10px] text-coral">Milestone</Label>
        <div>
          <p className="font-display text-[44px] font-extrabold leading-none tracking-[-0.05em]">25</p>
          <p className="mt-1 font-label text-[10px] uppercase tracking-[0.16em] text-paper/70">In Motion</p>
        </div>
      </div>
    </div>
  );
}

function MilestoneCoin({ milestone }: { milestone: (typeof MILESTONES)[number] }) {
  const earned = milestone.threshold <= example.count;
  const next = milestone.threshold === nextMilestone.threshold;
  const coin = earned
    ? "bg-ink text-paper shadow-[inset_0_0_0_3px_#0d0d0d,inset_0_0_0_5px_rgba(255,90,79,.7),0_10px_20px_-12px_rgba(13,13,13,.8)]"
    : next
      ? "bg-coral text-ink shadow-[0_0_0_4px_#e8e2d4,0_0_0_6px_#ff5a4f]"
      : "border-[1.5px] border-dashed border-ink/25 text-ink/30";
  return (
    <li className="flex flex-col items-center gap-2 text-center">
      <span className={`stamp-rotate relative grid aspect-square w-full max-w-[96px] place-items-center rounded-full ${coin}`}>
        <span className={`font-display font-extrabold leading-none tracking-[-0.06em] ${milestone.threshold >= 1000 ? "text-[clamp(18px,5vw,28px)]" : "text-[clamp(22px,6vw,34px)]"}`}>{milestone.threshold}</span>
        {earned ? <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-coral text-[10px] font-bold text-ink">✓</span> : null}
      </span>
      <span className={`font-label text-[9px] uppercase leading-tight tracking-[0.12em] sm:text-[10px] ${earned || next ? "text-ink" : "text-ink/45"}`}>{milestone.name}</span>
      <span className={`text-[11px] ${next ? "font-semibold text-[#a43d36]" : "text-ink/50"}`}>{earned ? "Earned" : next ? `${nextMilestone.threshold - example.count} to go` : "Locked"}</span>
    </li>
  );
}

const rarityStyles = {
  uncommon: { card: "bg-paper text-ink", chip: "bg-sky text-ink", muted: "text-ink/60" },
  signature: { card: "bg-coral text-ink", chip: "bg-ink text-paper", muted: "text-ink/70" },
  legendary: { card: "bg-ink text-paper shadow-[inset_0_0_0_1px_rgba(255,90,79,.5)]", chip: "bg-lime text-ink", muted: "text-paper/60" },
};

function RewardCard({ reward, tone, visual }: { reward: PassportReward; tone: keyof typeof rarityStyles; visual: ReactNode }) {
  const style = rarityStyles[tone];
  const unlocked = reward.milestone <= example.count;
  return (
    <article className={`reveal flex w-[80%] max-w-[360px] shrink-0 snap-start flex-col overflow-hidden rounded-[1.75rem] lg:w-auto lg:max-w-none ${style.card}`}>
      <div aria-hidden="true" className="relative h-52 overflow-hidden">{visual}</div>
      <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className={`rounded-full px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.14em] ${style.chip}`}>{reward.rarity}</span>
          <span className={`font-label text-[10px] uppercase tracking-[0.14em] ${style.muted}`}>{unlocked ? "Unlocked" : `Unlocks at ${reward.milestone}`}</span>
        </div>
        <p className="mt-2 font-display text-[28px] font-bold leading-none tracking-[-0.045em]">{reward.name}</p>
        <p className={`text-[13px] leading-5 ${style.muted}`}>{reward.description}</p>
      </div>
    </article>
  );
}

function AccentVisual() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-white">
      <div className="w-[72%] -rotate-3 rounded-[18px] bg-paper p-4 shadow-[0_18px_30px_-18px_rgba(13,13,13,.45)]">
        <p className="font-label text-[8px] uppercase tracking-[0.2em] text-coral">Personal</p>
        <p className="mt-2 font-display text-[30px] font-extrabold leading-none tracking-[-0.05em]">Aanya</p>
        <span className="mt-2 block h-[3px] w-14 rounded-full bg-coral" />
        <div className="mt-3 flex h-8 items-center rounded-[10px] px-2 text-[10px] font-semibold shadow-[inset_0_0_0_1.5px_rgba(255,90,79,.55)]">Sunday run mix</div>
      </div>
      <span className="absolute right-6 top-6 size-8 rounded-full bg-coral shadow-[0_0_0_6px_rgba(255,90,79,.18)]" />
    </div>
  );
}

function FrameVisual() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-ink">
      <div className="relative rotate-2 rounded-[22px] bg-coral p-2.5 shadow-[0_20px_40px_-16px_rgba(255,90,79,.6)]">
        <div className="rounded-[14px] bg-paper p-3">
          <QRCodeSVG bgColor="transparent" fgColor="#0d0d0d" level="M" marginSize={0} size={112} value="https://setuvara.com/" />
        </div>
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink px-2 py-0.5 font-label text-[8px] uppercase tracking-[0.18em] text-coral">Coral frame</span>
      </div>
    </div>
  );
}

function CoverVisual() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#151515]">
      <div className="relative h-[176px] w-[128px] -rotate-6 overflow-hidden rounded-[14px] bg-ink shadow-[0_24px_40px_-14px_rgba(0,0,0,.9),inset_0_0_0_2px_#ff5a4f,inset_0_0_0_6px_#0d0d0d,inset_0_0_0_7px_rgba(255,90,79,.45)]">
        <MeetMark className="absolute -right-8 -top-6 size-32 text-coral/15" />
        <span className="foil-sheen absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-4">
          <span className="font-label text-[7px] uppercase tracking-[0.22em] text-coral">Setuvara Passport</span>
          <span>
            <span className="block font-display text-[40px] font-extrabold leading-none tracking-[-0.07em] text-paper">1000</span>
            <span className="mt-1 block font-label text-[7px] uppercase tracking-[0.2em] text-lime">Thousand Met</span>
          </span>
        </div>
      </div>
    </div>
  );
}
