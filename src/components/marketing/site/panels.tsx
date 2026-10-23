import type { ReactNode } from "react";

import { DEMO_PEOPLE } from "../home/mode-phone";

/**
 * Product moments for the Mode pages: each tool drawn as the working panel it is in the app,
 * filled with the example cast (Aanya, Theo, Lucas, Sena, Noor). Every figure is an example and
 * every panel carries its plan line, so nothing here promises more than the product does.
 */

type Person = (typeof DEMO_PEOPLE)[keyof typeof DEMO_PEOPLE];

const mono = "font-label text-[10px] font-medium uppercase tracking-[0.16em]";

export function Avatar({ who, size = 38, className = "" }: { who: Person; size?: number; className?: string }) {
  return <span aria-hidden="true" className={`block shrink-0 rounded-full bg-cover ${className}`} style={{ width: size, height: size, backgroundImage: `url(${who.photo})`, backgroundPosition: `${who.face.x}% ${who.face.y}%` }} />;
}

/**
 * A tool's card: the tool itself on a lit stage (its own ground, glow and depth), then its name,
 * plan line and one sentence. Phones put the stage first so the visual leads; wide panels with an
 * aside set the text beside a stage that holds both.
 */
const STAGES = {
  ink: "bg-[radial-gradient(90%_80%_at_85%_0%,rgba(255,90,79,.28),transparent_60%),radial-gradient(120%_120%_at_0%_100%,#262626,#0D0D0D_70%)]",
  white: "bg-[radial-gradient(90%_90%_at_100%_0%,#FFFFFF,transparent_70%),radial-gradient(120%_120%_at_0%_100%,#E7E3D9,#F1EEE7_75%)]",
  coral: "bg-[radial-gradient(80%_80%_at_20%_0%,#FFC2BC,transparent_65%),radial-gradient(120%_120%_at_100%_100%,#FF3B2F,#FF5A4F_70%)]",
} as const;

export function ToolPanel({ title, tag, body, tone = "white", aside, children, className = "" }: { title: string; tag: string; body?: string; tone?: "ink" | "white" | "coral"; aside?: ReactNode; children?: ReactNode; className?: string }) {
  const skin = { ink: "bg-ink text-paper", white: "bg-white text-ink", coral: "bg-coral text-ink" }[tone];
  const muted = tone === "ink" ? "text-paper/60" : tone === "coral" ? "text-ink/70" : "text-ink/62";
  const stage = (children || aside) ? (
    <div className={`relative overflow-hidden rounded-[22px] p-3 sm:rounded-[26px] sm:p-8 ${STAGES[tone]}`}>
      <span aria-hidden="true" className={`pointer-events-none absolute inset-0 rounded-[inherit] ${tone === "ink" ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.05)]"}`} />
      <div className={`relative flex h-full flex-col justify-center gap-5 [&>*]:drop-shadow-[0_24px_30px_rgba(13,13,13,.18)] ${aside ? "lg:flex-row lg:items-center lg:[&>*]:flex-1" : ""}`}>
        {children ? <div className={`min-w-0 ${aside ? "max-lg:hidden" : ""}`}>{children}</div> : null}
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </div>
  ) : null;
  return (
    <article className={`flex flex-col overflow-hidden rounded-[28px] p-2.5 shadow-[0_50px_100px_-60px_rgba(13,13,13,.6)] sm:rounded-[34px] sm:p-3 ${skin} ${className}`}>
      {stage ? <div className="flex flex-1 flex-col [&>*]:flex-1">{stage}</div> : null}
      <div className="flex flex-col px-3.5 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h3 className="font-display text-[30px] font-extrabold leading-none tracking-[-0.055em] sm:text-[38px]">{title}</h3>
          <span className={`${mono} sm:shrink-0 sm:text-right ${tone === "ink" ? "text-paper/45" : "text-ink/50"}`}>{tag}</span>
        </div>
        {body ? <p className={`mt-3 max-w-[34rem] text-[15px] leading-[1.6] sm:text-[16px] ${muted}`}>{body}</p> : null}
      </div>
    </article>
  );
}

const STAGE_TONE = { New: "text-coral", Contacted: "text-[#AFCBFF]", Won: "text-[#C7FF4A]" } as const;

export function LeadsList() {
  const rows: { who: Person; name: string; line: string; stage: keyof typeof STAGE_TONE; date: string }[] = [
    { who: DEMO_PEOPLE.theo, name: "Theo Laurent", line: "Lumen Labs · Slush · Helsinki", stage: "New", date: "19 Nov" },
    { who: DEMO_PEOPLE.noor, name: "Noor Haddad", line: "Booked a 20-min intro · QR at the stand", stage: "Contacted", date: "14 Nov" },
    { who: DEMO_PEOPLE.aanya, name: "Aanya Rao", line: "Page inquiry · Studio retainer", stage: "Won", date: "2 Nov" },
  ];
  const funnel = [{ label: "New 12", w: 12, c: "bg-paper/85" }, { label: "7", w: 7, c: "bg-paper/45" }, { label: "4", w: 4, c: "bg-paper/25" }, { label: "3", w: 3, c: "bg-[#C7FF4A]" }];
  return (
    <div>
      <div className="rounded-[20px] bg-[#1B1B1B] p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">{["All 26", "New 12", "Contacted 7", "Won 3"].map((chip, index) => <span className={`rounded-full px-3 py-1.5 text-[13px] ${index === 0 ? "bg-paper font-semibold text-ink" : "bg-paper/[0.08]"} ${index === 2 ? "max-sm:hidden" : ""}`} key={chip}>{chip}</span>)}</div>
        <ul className="mt-2">
          {rows.map((row) => (
            <li className="flex items-center gap-3 border-b border-paper/[0.08] py-3.5 last:border-0" key={row.name}>
              <Avatar who={row.who} />
              <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold">{row.name}</p><p className="truncate text-[12.5px] text-paper/55">{row.line}</p></div>
              <span className={`${mono} hidden sm:inline ${STAGE_TONE[row.stage]}`}>{row.stage}</span>
              <span className={`${mono} hidden text-paper/40 md:inline`}>{row.date}</span>
            </li>
          ))}
        </ul>
      </div>
      <div aria-hidden="true" className="mt-5 flex gap-1">
        {funnel.map((step) => <div className="flex flex-col gap-2" key={step.label} style={{ flex: step.w }}><span className={`h-1.5 rounded-full ${step.c}`} /><span className={`${mono} text-paper/45 max-sm:hidden`}>{step.label}</span></div>)}
      </div>
    </div>
  );
}

export function RevenueCard({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const points = [70, 66, 67, 58, 56, 48, 44, 37, 33, 26, 19, 10];
  const path = points.map((y, i) => `${i === 0 ? "M" : "L"}${(i * 400) / (points.length - 1)} ${y}`).join(" ");
  return (
    <div className={dark ? "text-paper" : ""}>
      <div className="flex items-center justify-between gap-3"><span className="text-[14px] font-semibold">Setuvara Teams</span><span className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] ${dark ? "bg-paper/[0.08]" : "bg-paper"}`}><span className="size-1.5 rounded-full bg-[#7ED321]" />Verified · Stripe</span></div>
      <div className="mt-4 flex items-baseline gap-2"><span className={`font-display font-extrabold leading-[0.85] tracking-[-0.06em] ${compact ? "text-[40px] sm:text-[48px]" : "text-[64px]"}`}>$48.2k</span><span className={`text-[13px] ${dark ? "text-paper/55" : "text-ink/50"}`}>MRR</span><span className="ml-auto whitespace-nowrap text-[13px] font-semibold">+18%<span className="max-sm:hidden"> vs Sep</span></span></div>
      <svg aria-hidden="true" className="mt-4 block h-[90px] w-full" preserveAspectRatio="none" viewBox="0 0 400 80">
        <path d={`${path} L400 80 L0 80 Z`} fill={dark ? "rgba(255,90,79,.18)" : "rgba(255,90,79,.1)"} />
        <path d={path} fill="none" stroke={dark ? "#FF5A4F" : "#0D0D0D"} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className={`mt-2 ${mono} max-sm:hidden ${dark ? "text-paper/40" : "text-ink/40"}`}>Example project · read daily from the provider</p>
    </div>
  );
}

export function RoadmapRows({ dark = false }: { dark?: boolean }) {
  return (
    <ul className={`mt-5 border-t pt-3 ${dark ? "border-paper/10" : "border-ink/10"}`}>
      {[["Now", "Team leads inbox", 128], ["Next", "Shared event pages", 214]].map(([when, title, votes]) => (
        <li className="flex items-center gap-3 py-1.5 text-[14px]" key={String(title)}><span className={`${mono} w-9 ${when === "Now" ? "text-coral" : dark ? "text-paper/40" : "text-ink/40"}`}>{when}</span><span className="flex-1">{title}</span><span className={dark ? "text-paper/55" : "text-ink/55"}>▲ {votes}</span></li>
      ))}
    </ul>
  );
}

export function Quote({ text, who, role }: { text: string; who: Person; role: string }) {
  return (
    <figure className="flex flex-1 flex-col justify-end">
      <blockquote className="font-display text-[26px] sm:text-[clamp(30px,3vw,40px)] font-extrabold leading-[0.95] tracking-[-0.05em]">“{text}”</blockquote>
      <figcaption className="mt-6 flex items-center gap-3"><Avatar size={34} who={who} /><span className="text-[14px]"><b className="font-semibold">{who.name}</b> <span className="text-ink/65 max-sm:hidden">· {role}</span></span></figcaption>
    </figure>
  );
}

export function BookingCard({ owner = "Lucas" }: { owner?: string }) {
  return (
    <div className="rounded-[20px] bg-paper p-5">
      <p className={`${mono} text-ink/45`}>On {owner}’s page</p>
      <p className="mt-2 text-[17px] font-semibold">Book a 20-min intro</p>
      <div className="mt-4 grid grid-cols-3 gap-2">{[["Tue", "12"], ["Thu", "14"], ["Fri", "15"]].map(([d, n], index) => <span className={`rounded-[12px] py-2 text-center text-[12px] ${index === 1 ? "bg-ink text-paper" : "bg-white"}`} key={d}>{d}<b className="block text-[16px]">{n}</b></span>)}</div>
      <div className="mt-2.5 flex gap-1.5">{["09:00", "10:30", "14:00"].map((t, index) => <span className={`rounded-full px-2.5 py-1 text-[12px] ${index === 1 ? "shadow-[inset_0_0_0_1.5px_#0D0D0D]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.15)]"}`} key={t}>{t}</span>)}</div>
      <p className="mt-4 rounded-full bg-coral py-2.5 text-center text-[14px] font-semibold">Request Thu 14 · 10:30</p>
    </div>
  );
}

export function SubRows({ rows }: { rows: [string, string][] }) {
  return (
    <ul className="mt-6 border-t border-ink/10">
      {rows.map(([name, tag]) => <li className="flex items-center justify-between gap-3 border-b border-ink/10 py-3.5 last:border-0" key={name}><span className="text-[15px] font-semibold">{name}</span><span className={`${mono} text-ink/45`}>{tag}</span></li>)}
    </ul>
  );
}

export function NewsletterCard() {
  return (
    <div className="rounded-[20px] bg-paper p-5">
      <div className="flex justify-between gap-3"><span className={`${mono} text-coral`}>Newsletter</span><span className={`${mono} text-ink/40 max-sm:hidden`}>On Aanya’s page</span></div>
      <p className="mt-3 font-display text-[22px] font-extrabold leading-[0.95] tracking-[-0.05em] sm:text-[26px]">Sunday run club, every week.</p>
      <div className="mt-4 flex gap-2"><span className="flex h-11 flex-1 items-center rounded-[12px] bg-white px-3 text-[14px] text-ink/45">you@email.com</span><span className="flex h-11 items-center rounded-full bg-ink px-4 text-[14px] font-semibold text-paper">Join</span></div>
    </div>
  );
}

export function ConnectionRows({ dark = true, rows }: { dark?: boolean; rows: { who: Person; name: string; where: string; when: string }[] }) {
  return (
    <ul className={`rounded-[20px] p-3 sm:p-4 ${dark ? "bg-[#1B1B1B]" : "bg-paper"}`}>
      {rows.map((row) => (
        <li className={`flex items-center gap-3 border-b py-3.5 last:border-0 ${dark ? "border-paper/[0.08]" : "border-ink/[0.08]"}`} key={row.name}>
          <Avatar who={row.who} />
          <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold">{row.name}</p><p className={`truncate text-[12.5px] ${dark ? "text-paper/55" : "text-ink/55"}`}>{row.where}</p></div>
          <span className={`${mono} ${dark ? "text-paper/40" : "text-ink/40"}`}>{row.when}</span>
        </li>
      ))}
    </ul>
  );
}

export function Stamps({ items }: { items: { title: string; line: string }[] }) {
  return (
    <ul className="grid grid-cols-3 gap-1.5 sm:gap-3">
      {items.map((stamp, index) => (
        <li className={`flex aspect-square flex-col items-center justify-center rounded-full border-[1.5px] border-dashed border-ink p-2 text-center ${index === 1 ? "rotate-[-8deg] bg-ink text-coral" : index === 2 ? "rotate-[6deg]" : ""}`} key={stamp.title}>
          <span className="font-display text-[13px] font-extrabold leading-none tracking-[-0.04em] sm:text-[clamp(15px,1.5vw,19px)]">{stamp.title}</span>
          <span className={`mt-1 ${mono} text-[7.5px] tracking-[0.08em] sm:text-[8.5px] sm:tracking-[0.16em] ${stamp.line.length > 8 ? "max-sm:hidden" : ""}`}>{stamp.line}</span>
        </li>
      ))}
    </ul>
  );
}

export function EventCard() {
  return (
    <div className="rounded-[20px] bg-[#1B1B1B] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className={`${mono} text-paper/45`}>Thu 19 Nov<span className="max-sm:hidden"> · Helsinki</span></p><p className="mt-2 font-display text-[20px] font-extrabold leading-[1] tracking-[-0.045em] sm:text-[26px] sm:leading-[0.95] sm:tracking-[-0.05em]"><span className="sm:hidden">Founders breakfast</span><span className="max-sm:hidden">Climate founders breakfast</span></p></div>
        <span className="shrink-0 rounded-full bg-[#C7FF4A] px-3 py-1 text-[12px] font-semibold text-ink">Open</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[["38", "Going", "Going"], ["6", "Waitlist", "Wait"], ["24", "Checked in", "In"]].map(([n, l, short]) => <div className="rounded-[14px] bg-paper/[0.06] py-3" key={l}><p className="font-display text-[22px] font-extrabold leading-none tracking-[-0.05em] sm:text-[26px]">{n}</p><p className="mt-1.5 text-[11px] text-paper/50 sm:font-label sm:text-[10px] sm:uppercase sm:tracking-[0.16em]"><span className="sm:hidden">{short}</span><span className="max-sm:hidden">{l}</span></p></div>)}
      </div>
      <div className="mt-4 flex items-center gap-2"><span className="flex -space-x-2">{[DEMO_PEOPLE.aanya, DEMO_PEOPLE.lucasClose, DEMO_PEOPLE.sena, DEMO_PEOPLE.noor].map((who) => <Avatar className="ring-2 ring-[#1B1B1B]" key={who.name} size={30} who={who} />)}</span><span className="text-[13px] text-paper/55"><span className="sm:hidden">+34 going</span><span className="max-sm:hidden">Guest list · door scanner on your phone</span></span></div>
    </div>
  );
}

/** Theo's page while he is at Slush: the photo, the Live pill and who he is there to meet. */
export function LivePill() {
  const theo = DEMO_PEOPLE.theo;
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[300px] overflow-hidden rounded-[26px] bg-cover text-paper shadow-[0_40px_70px_-30px_rgba(13,13,13,.7)]" style={{ backgroundImage: `url(${theo.photo})`, backgroundPosition: `${theo.face.x}% ${theo.face.y}%` }}>
      <span className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/25 to-transparent" />
      <p className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-ink/80 px-3 py-1.5 text-[12.5px] backdrop-blur"><span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-[#C7FF4A] opacity-70" /><span className="relative size-2 rounded-full bg-[#C7FF4A]" /></span><b className="font-semibold">Live</b> · Slush 2026</p>
      <div className="absolute inset-x-5 bottom-5">
        <p className="font-display text-[30px] font-extrabold leading-none tracking-[-0.05em]">Theo Laurent</p>
        <p className="mt-2 text-[13px] text-paper/75">Here to meet <b className="text-paper">climate founders</b></p>
        <p className={`mt-3 ${mono} text-[#C7FF4A]`}>Ends by itself on 20 Nov</p>
      </div>
    </div>
  );
}

export function StoreList() {
  const items = [["Live session pack", "Digital download", "$12", "38 sold"], ["Mixing notes", "PDF guide", "$8", "21 sold"], ["1:1 feedback call", "30 minutes", "$45", "6 booked"]];
  return (
    <div className="rounded-[20px] bg-[#1B1B1B] p-3 sm:p-4">
      <ul>
        {items.map(([name, kind, price, sold]) => (
          <li className="flex items-center gap-3 border-b border-paper/[0.08] py-3.5 last:border-0 max-sm:[&:nth-child(3)]:hidden" key={name}>
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[#E8A6FF] font-display text-[15px] font-extrabold text-ink">{name[0]}</span>
            <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold">{name}</p><p className="text-[12.5px] text-paper/55">{kind}</p></div>
            <span className={`${mono} hidden text-paper/40 sm:inline`}>{sold}</span>
            <span className="text-[15px] font-semibold">{price}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center justify-between border-t border-paper/[0.08] px-1 pt-3 text-[13px]"><span className="text-paper/55">New order<span className="max-sm:hidden"> · Live session pack</span></span><span className="font-semibold text-[#C7FF4A]">+$12</span></p>
    </div>
  );
}

export function MediaKitCard() {
  return (
    <div className="rounded-[20px] bg-paper p-5">
      <div className="flex items-center gap-3"><Avatar size={44} who={DEMO_PEOPLE.sena} /><div className="min-w-0"><p className="text-[16px] font-semibold">Sena Okafor</p><p className="truncate text-[13px] text-ink/55">Music · Lagos</p></div></div>
      <ul className="mt-4 grid grid-cols-3 gap-2">{[["48K", "YouTube"], ["31K", "Instagram"], ["120K", "TikTok"]].map(([n, p]) => <li className="min-w-0 rounded-[12px] bg-white px-1.5 py-2.5 text-center sm:p-3 sm:text-left" key={p}><p className="font-display text-[19px] font-extrabold leading-none tracking-[-0.05em] sm:text-[22px]">{n}</p><p className="mt-1 text-[10px] font-semibold tracking-[-0.01em] sm:text-[11px]">{p}</p></li>)}</ul>
      <p className={`mt-4 ${mono} text-ink/45 max-sm:hidden`}>Example numbers · shared by link</p>
    </div>
  );
}

export function DealStages() {
  return (
    <ul className="mt-auto flex flex-col gap-2">
      {[["New", "Audio brand · sponsored session", false], ["Talking", "Festival · live set", true], ["Paid", "Streaming service · playlist", false]].map(([stage, line, active]) => (
        <li className={`flex items-center justify-between gap-3 rounded-[16px] px-4 py-3 ${active ? "bg-ink text-paper" : "bg-paper/40"}`} key={String(stage)}><span className="min-w-0 truncate text-[14px]">{String(line).split(" · ")[0]}<span className="max-sm:hidden"> · {String(line).split(" · ")[1]}</span></span><span className={`${mono} ${active ? "text-coral" : "text-ink/60"}`}>{stage}</span></li>
      ))}
    </ul>
  );
}

export function AudienceRows({ count = "1,284", subject = "New session this Friday." }: { count?: string; subject?: string }) {
  return (
    <div className="rounded-[20px] bg-paper p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><p className="font-display text-[40px] font-extrabold leading-none tracking-[-0.06em] sm:text-[44px]">{count}</p><span className={`${mono} text-ink/45`}>Subscribers</span></div>
      <p className="mt-4 rounded-[14px] bg-white p-4 text-[14px] leading-[1.5]"><b className="font-semibold">{subject}</b> <span className="text-ink/60">Sent to {count}<span className="max-sm:hidden"> subscribers</span></span></p>
      <p className={`mt-4 ${mono} text-ink/45 max-sm:hidden`}>Example · email on Plus (2,500 a month) and Pro (20,000)</p>
    </div>
  );
}
