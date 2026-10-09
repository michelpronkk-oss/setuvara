import { MILESTONES, PASSPORT_REWARDS } from "@/lib/passport/rewards";

import { MeetMark } from "../brand";
import { Display, Label, Shell } from "./primitives";

// Example Passport: 47 unique connections, so "In Motion" (25) is the latest
// milestone and "Signal 50" is next — straight from the real milestone ladder.
const example = { count: 47, cities: 9, events: 6, countries: 4 };
const nextMilestone = MILESTONES.find((milestone) => milestone.threshold > example.count)!;
const previousThreshold = [...MILESTONES].reverse().find((milestone) => milestone.threshold <= example.count)?.threshold ?? 0;
const progress = ((example.count - previousThreshold) / (nextMilestone.threshold - previousThreshold)) * 100;
const featuredRewards = ["signal_accent", "coral_qr_frame", "thousand_cover"].map((id) => PASSPORT_REWARDS.find((reward) => reward.id === id)!);

export function Passport() {
  return (
    <section aria-labelledby="passport-title" className="scroll-mt-16 bg-[#e8e2d4]" id="passport">
      <Shell className="flex flex-col gap-14 py-20 sm:py-28 lg:gap-20 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 lg:items-end lg:gap-16">
          <div className="flex flex-col gap-5">
            <Label className="text-[#a43d36]">Passport</Label>
            <Display className="text-[clamp(44px,6vw,96px)] leading-[0.88]"><span id="passport-title">A record of where you’ve been — and who you met there.</span></Display>
          </div>
          <p className="max-w-[30rem] text-[17px] leading-[1.55] text-ink/70 sm:text-[19px]">Real connections earn milestones and stamps for the events, cities and countries behind them. Not a leaderboard: your Passport is private, and the rewards become part of your identity.</p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8">
          <PassportCover />
          <Collection />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Label>Milestones</Label>
            <p className="text-[13px] text-ink/60">Unique connections, counted once per person.</p>
          </div>
          <ol aria-label="Milestone ladder" className="-mx-5 flex snap-x gap-px overflow-x-auto bg-ink/15 px-0 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-hidden sm:rounded-[1.5rem] lg:grid-cols-8" tabIndex={0}>
            {MILESTONES.map((milestone) => {
              const earned = milestone.threshold <= example.count;
              const next = milestone.threshold === nextMilestone.threshold;
              return (
                <li className={`flex min-h-32 w-[38%] shrink-0 snap-start flex-col justify-between gap-4 p-4 sm:w-auto ${earned ? "bg-ink text-paper" : next ? "bg-coral text-ink" : "bg-[#efeadf] text-ink/55"}`} key={milestone.threshold}>
                  <span className="font-display text-[34px] font-extrabold leading-none tracking-[-0.05em]">{milestone.threshold}</span>
                  <span>
                    <span className="block font-label text-[10px] uppercase tracking-[0.14em]">{milestone.name}</span>
                    <span className={`mt-1 block text-[11px] ${earned ? "text-paper/55" : "text-current"}`}>{earned ? "Earned ✓" : next ? `${nextMilestone.threshold - example.count} to go` : "Ahead"}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {featuredRewards.map((reward) => {
            const unlocked = reward.milestone <= example.count;
            return (
              <article className="flex flex-col gap-3 rounded-[1.5rem] bg-paper p-5" key={reward.id}>
                <div className="flex items-start justify-between gap-3">
                  <Label className="!text-[10px] text-ink/55">{reward.rarity}</Label>
                  <span className={`font-label text-[10px] uppercase tracking-[0.14em] ${unlocked ? "text-ink" : "text-ink/45"}`}>{unlocked ? "Unlocked" : `At ${reward.milestone}`}</span>
                </div>
                <p className="font-display text-[24px] font-bold tracking-[-0.04em]">{reward.name}</p>
                <p className="text-[13px] leading-5 text-ink/60">{reward.description}</p>
              </article>
            );
          })}
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
