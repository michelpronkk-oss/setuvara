import type { ReactNode } from "react";

import { DEMO_PEOPLE } from "../home/mode-phone";
import { Avatar } from "./panels";
import { QrArt } from "./qr-art";

/**
 * The "What's in it" cards on the feature pages: each capability drawn as the small piece of the
 * app it is, above its plan line and sentence. Every figure is an example; nothing here shows a
 * feature the product does not ship (the Wallet pass cards say Coming soon on the card itself).
 */

const mono = "font-label text-[10px] font-medium uppercase tracking-[0.16em]";
const { aanya, theo, lucas } = DEMO_PEOPLE;

function Field({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <span className={`flex h-9 items-center rounded-[10px] px-3 text-[13px] ${dark ? "bg-paper/[0.08] text-paper/55" : "bg-paper text-ink/45"}`}>{children}</span>;
}

function Bars({ values, accent = values.length - 1, dark = false }: { values: number[]; accent?: number; dark?: boolean }) {
  return (
    <div aria-hidden="true" className="flex h-[78px] items-end gap-1.5">
      {values.map((v, i) => <span className={`flex-1 rounded-t-[4px] ${i === accent ? "bg-coral" : dark ? "bg-paper/20" : "bg-ink/15"}`} key={i} style={{ height: `${v}%` }} />)}
    </div>
  );
}

function Pill({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "coral" | "paper" }) {
  const skin = { ink: "bg-ink text-paper", coral: "bg-coral text-ink", paper: "bg-paper text-ink" }[tone];
  return <span className={`inline-flex h-8 items-center rounded-full px-3.5 text-[12.5px] font-semibold ${skin}`}>{children}</span>;
}

function Pass({ premium = false }: { premium?: boolean }) {
  return (
    <div className={`w-[200px] rounded-[16px] p-4 shadow-[0_24px_40px_-24px_rgba(13,13,13,.6)] ${premium ? "bg-coral text-ink" : "bg-ink text-paper"}`}>
      <div className="flex items-center justify-between"><span className="text-[12px] font-semibold">setuvara</span><span className={`${mono} ${premium ? "text-ink/60" : "text-paper/50"}`}>{premium ? "Plus" : "Free"}</span></div>
      <div className="mt-3 flex items-center gap-2"><Avatar size={26} who={aanya} /><span className="text-[13px] font-semibold">Aanya Rao</span></div>
      <div className="mt-3 flex justify-center rounded-[10px] bg-white p-2"><QrArt size={58} /></div>
    </div>
  );
}

/** Each capability, by its title in features-content.ts. */
const SCENES: Record<string, { tone: "paper" | "ink" | "coral"; scene: ReactNode }> = {
  Newsletter: { tone: "paper", scene: (
    <div className="w-full max-w-[260px] rounded-[16px] bg-white p-4">
      <span className={`${mono} text-coral`}>Sunday run club</span>
      <div className="mt-3 flex gap-2"><span className="flex-1"><Field>you@email.com</Field></span><Pill>Join</Pill></div>
      <p className="mt-3 text-[12px] text-ink/55">✓ 1,284 confirmed</p>
    </div>
  ) },
  Form: { tone: "ink", scene: (
    <div className="flex w-full max-w-[260px] flex-col gap-2 rounded-[16px] bg-[#1B1B1B] p-4 text-paper">
      <span className={`${mono} text-paper/50`}>RSVP · Founder dinner</span>
      <Field dark>Name</Field><Field dark>Company</Field>
      <span className="mt-1 flex h-9 items-center justify-center rounded-full bg-coral text-[13px] font-semibold text-ink">Send</span>
    </div>
  ) },
  Booking: { tone: "paper", scene: (
    <div className="w-full max-w-[260px] rounded-[16px] bg-white p-4">
      <div className="grid grid-cols-3 gap-1.5">{[["Tue", "12"], ["Thu", "14"], ["Fri", "15"]].map(([d, n], i) => <span className={`rounded-[10px] py-1.5 text-center text-[11px] ${i === 1 ? "bg-ink text-paper" : "bg-paper"}`} key={d}>{d}<b className="block text-[15px]">{n}</b></span>)}</div>
      <div className="mt-2 flex gap-1.5">{["09:00", "10:30", "14:00"].map((t, i) => <span className={`rounded-full px-2.5 py-1 text-[11px] ${i === 1 ? "shadow-[inset_0_0_0_1.5px_#0D0D0D]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.15)]"}`} key={t}>{t}</span>)}</div>
    </div>
  ) },
  Questions: { tone: "coral", scene: (
    <div className="flex w-full max-w-[260px] flex-col gap-2">
      {["Which shoes for a first half?", "Can I join mid-season?"].map((q, i) => <span className={`flex items-center gap-2 rounded-[14px] bg-white px-3 py-2.5 text-[13px] ${i ? "ml-6" : ""}`} key={q}><Avatar size={22} who={i ? lucas : theo} />{q}</span>)}
    </div>
  ) },
  "Collaboration requests": { tone: "ink", scene: (
    <div className="w-full max-w-[260px] rounded-[16px] bg-white p-4">
      <div className="flex items-center justify-between"><span className="text-[14px] font-semibold">Northwind Audio</span><span className={`${mono} text-coral`}>New</span></div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]"><div><dt className="text-ink/45">Budget</dt><dd className="font-semibold">$1,500</dd></div><div><dt className="text-ink/45">Deliverable</dt><dd className="font-semibold">1 video</dd></div></dl>
    </div>
  ) },
  Giveaway: { tone: "coral", scene: (
    <div className="w-full max-w-[240px] rounded-[16px] bg-ink p-4 text-paper">
      <span className={`${mono} text-coral`}>Giveaway · ends Fri</span>
      <p className="mt-2 font-display text-[22px] font-extrabold leading-none tracking-[-0.05em]">Win a session pack</p>
      <p className="mt-3 text-[12px] text-paper/55">412 entries · one per email</p>
    </div>
  ) },

  Projects: { tone: "paper", scene: (
    <div className="flex w-full max-w-[260px] items-center gap-3 rounded-[16px] bg-white p-4">
      <span className="flex size-10 items-center justify-center rounded-[12px] bg-ink font-display text-[18px] font-extrabold text-coral">S</span>
      <div className="min-w-0 flex-1"><p className="text-[14px] font-semibold">Setuvara Teams</p><p className="text-[12px] text-ink/50">SaaS · since Mar 2026</p></div>
      <span className="rounded-full bg-[#E8F7D4] px-2 py-1 text-[11px] font-semibold">Live</span>
    </div>
  ) },
  "Public roadmap": { tone: "ink", scene: (
    <div className="grid w-full max-w-[270px] grid-cols-3 gap-1.5 text-[11px]">
      {[["Planned", "Badges", 96], ["Now", "Leads inbox", 128], ["Shipped", "Quick QR", 0]].map(([col, item, votes]) => (
        <div className="flex flex-col gap-1.5" key={String(col)}><span className={`${mono} ${col === "Now" ? "text-coral" : "text-paper/45"}`}>{col}</span><span className={`rounded-[10px] p-2 ${col === "Now" ? "bg-paper text-ink" : "bg-[#1B1B1B] text-paper"}`}>{item}{votes ? <b className="mt-1 block">▲ {votes}</b> : <span className="mt-1 block opacity-50">✓ 12 Oct</span>}</span></div>
      ))}
    </div>
  ) },
  "Feature suggestions": { tone: "coral", scene: (
    <div className="w-full max-w-[260px] rounded-[16px] bg-white p-4">
      <span className={`${mono} text-ink/45`}>Suggest a feature</span>
      <div className="mt-2"><Field>Calendar sync for bookings</Field></div>
      <div className="mt-2 flex items-center justify-between"><span className="flex items-center gap-1.5 text-[12px]"><Avatar size={20} who={theo} />Theo</span><Pill>Suggest</Pill></div>
    </div>
  ) },
  "Verified revenue": { tone: "ink", scene: (
    <div className="w-full max-w-[260px] text-paper">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-paper/[0.08] px-2.5 py-1 text-[11px]"><span className="size-1.5 rounded-full bg-[#7ED321]" />Verified · Stripe</span>
      <p className="mt-3 flex items-baseline gap-2"><span className="font-display text-[48px] font-extrabold leading-[0.85] tracking-[-0.06em]">$48.2k</span><span className="text-[12px] text-paper/50">MRR</span></p>
      <p className="mt-2 text-[12px] text-paper/50">Read daily from the provider</p>
    </div>
  ) },
  "Revenue history": { tone: "paper", scene: (
    <div className="w-full max-w-[260px] rounded-[16px] bg-white p-4">
      <div className="flex justify-between"><span className={`${mono} text-ink/45`}>12 months</span><span className="text-[12px] font-semibold">+18% vs Sep</span></div>
      <div className="mt-3"><Bars values={[30, 34, 36, 42, 45, 52, 56, 62, 68, 74, 82, 96]} /></div>
    </div>
  ) },
  Updates: { tone: "coral", scene: (
    <ul className="w-full max-w-[260px] rounded-[16px] bg-white p-4 text-[13px]">
      {[["12 Oct", "Quick QR shipped"], ["28 Sep", "Guest Connect is live"]].map(([d, t]) => <li className="flex gap-3 border-b border-ink/10 py-2 last:border-0" key={t}><span className={`${mono} w-12 shrink-0 pt-0.5 text-coral`}>{d}</span>{t}</li>)}
    </ul>
  ) },

  "Views, scans and connections": { tone: "ink", scene: (
    <div className="grid w-full max-w-[270px] grid-cols-3 gap-2 text-paper">
      {[["Views", "2,418"], ["Scans", "312"], ["Connections", "86"]].map(([k, v], i) => <div className={`rounded-[14px] p-3 ${i === 2 ? "bg-coral text-ink" : "bg-[#1B1B1B]"}`} key={k}><span className={`${mono} text-[9px] ${i === 2 ? "text-ink/60" : "text-paper/45"}`}>{k}</span><p className="mt-1 font-display text-[22px] font-extrabold tracking-[-0.05em]">{v}</p></div>)}
    </div>
  ) },
  "Link taps": { tone: "paper", scene: (
    <ul className="flex w-full max-w-[260px] flex-col gap-2 rounded-[16px] bg-white p-4 text-[12.5px]">
      {[["Book a call", 92], ["Portfolio", 64], ["Instagram", 38]].map(([l, w]) => <li key={l}><span className="flex justify-between"><span>{l}</span><b>{w}</b></span><span className="mt-1 block h-1.5 rounded-full bg-paper"><span className="block h-full rounded-full bg-ink" style={{ width: `${w}%` }} /></span></li>)}
    </ul>
  ) },
  "Sources and Modes": { tone: "coral", scene: (
    <div className="w-full max-w-[260px] rounded-[16px] bg-white p-4">
      <div className="flex h-3 overflow-hidden rounded-full">{[["bg-ink", 48], ["bg-coral", 38], ["bg-[#AFCBFF]", 14]].map(([c, w]) => <span className={String(c)} key={String(c)} style={{ width: `${w}%` }} />)}</div>
      <ul className="mt-3 flex flex-col gap-1 text-[12px]">{[["bg-ink", "QR code", "48%"], ["bg-coral", "Link in bio", "38%"], ["bg-[#AFCBFF]", "Tap", "14%"]].map(([c, l, v]) => <li className="flex items-center gap-2" key={l}><span className={`size-2 rounded-full ${c}`} />{l}<b className="ml-auto">{v}</b></li>)}</ul>
    </div>
  ) },
  Conversion: { tone: "ink", scene: (
    <div className="w-full max-w-[260px] text-paper">
      <span className={`${mono} text-paper/45`}>View to Connection</span>
      <p className="mt-2 font-display text-[52px] font-extrabold leading-[0.85] tracking-[-0.06em]">3.6<span className="text-coral">%</span></p>
      <div className="mt-3 flex gap-1">{[100, 42, 9].map((w, i) => <span className={`h-2 rounded-full ${i === 2 ? "bg-coral" : "bg-paper/25"}`} key={w} style={{ flex: w }} />)}</div>
    </div>
  ) },
  "Then and now": { tone: "paper", scene: (
    <div className="w-full max-w-[260px] rounded-[16px] bg-white p-4">
      <div className="flex justify-between text-[12px]"><span className="text-ink/50">This month vs last</span><b>+22%</b></div>
      <svg aria-hidden="true" className="mt-3 block h-[70px] w-full" preserveAspectRatio="none" viewBox="0 0 200 70">
        <path d="M0 55 L40 50 L80 52 L120 44 L160 46 L200 40" fill="none" stroke="rgba(13,13,13,.25)" strokeDasharray="4 4" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d="M0 50 L40 42 L80 40 L120 28 L160 22 L200 10" fill="none" stroke="#FF5A4F" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  ) },
  "Devices, funnel and CSV": { tone: "coral", scene: (
    <div className="w-full max-w-[260px] rounded-[16px] bg-ink p-4 text-paper">
      <ul className="flex flex-col gap-1.5 text-[12px]">{[["iPhone", 81], ["Android", 15], ["Desktop", 4]].map(([l, w]) => <li className="flex items-center gap-2" key={l}><span className="w-14">{l}</span><span className="h-1.5 flex-1 rounded-full bg-paper/15"><span className="block h-full rounded-full bg-coral" style={{ width: `${w}%` }} /></span><b className="w-8 text-right">{w}%</b></li>)}</ul>
      <span className="mt-3 inline-flex rounded-full bg-paper px-3 py-1 text-[11.5px] font-semibold text-ink">↓ Export CSV</span>
    </div>
  ) },

  "A QR for every Mode": { tone: "ink", scene: (
    <div className="flex items-center gap-3">
      <div className="rounded-[14px] bg-white p-3"><QrArt size={88} /></div>
      <ul className="flex flex-col gap-1.5">{["Personal", "Event", "Business"].map((m, i) => <li className={`rounded-full px-3 py-1 text-[12px] font-semibold ${i === 1 ? "bg-coral text-ink" : "bg-[#1B1B1B] text-paper/60"}`} key={m}>{m}</li>)}</ul>
    </div>
  ) },
  "Five QR styles": { tone: "paper", scene: (
    <div className="flex items-center gap-2">
      {["bg-white", "bg-coral", "bg-ink", "bg-[#AFCBFF]", "bg-white shadow-[inset_0_0_0_3px_#0D0D0D]"].map((c, i) => <span className={`rounded-[12px] p-1.5 ${c}`} key={i}><span className="block rounded-[6px] bg-white p-1"><QrArt size={30} /></span></span>)}
    </div>
  ) },
  "Quick QR": { tone: "coral", scene: (
    <div className="w-[150px] rounded-[26px] bg-ink p-3 text-center text-paper shadow-[0_24px_40px_-24px_rgba(13,13,13,.7)]">
      <span className={`${mono} text-paper/50`}>Event Mode</span>
      <div className="mx-auto mt-2 w-fit rounded-[12px] bg-white p-2"><QrArt size={92} /></div>
      <p className="mt-2 text-[12px] font-semibold">Scan to connect</p>
    </div>
  ) },
  "Setuvara Tap": { tone: "ink", scene: (
    <div className="relative flex items-center gap-4">
      <div className="flex h-[96px] w-[150px] flex-col justify-between rounded-[14px] bg-coral p-3 text-ink shadow-[0_24px_40px_-24px_rgba(0,0,0,.8)]"><span className="text-[12px] font-semibold">setuvara</span><span className={mono}>Tap · NFC</span></div>
      <span aria-hidden="true" className="flex gap-1 text-paper/60">{[0, 1, 2].map((i) => <span className="h-8 w-2 rounded-r-full border-r-2 border-current" key={i} style={{ height: 16 + i * 10, opacity: 1 - i * 0.25 }} />)}</span>
    </div>
  ) },
  "Connect on the spot": { tone: "paper", scene: (
    <div className="flex w-full max-w-[270px] items-center gap-3 rounded-[18px] bg-white p-3.5 pr-4 shadow-[0_30px_60px_-30px_rgba(13,13,13,.5)]">
      <Avatar size={38} who={lucas} />
      <div className="min-w-0"><p className="flex justify-between gap-6"><span className={`${mono} text-coral`}>Connected</span><span className={`${mono} text-ink/40`}>Now</span></p><p className="text-[14px] font-semibold">Lucas Meyer</p><p className="truncate text-[12px] text-ink/55">Web Summit · Lisbon</p></div>
    </div>
  ) },
  "Scan insights": { tone: "coral", scene: (
    <div className="w-full max-w-[240px] rounded-[16px] bg-white p-4">
      <div className="flex items-baseline justify-between"><span className="font-display text-[34px] font-extrabold tracking-[-0.05em]">312</span><span className="text-[12px] text-ink/50">scans this week</span></div>
      <div className="mt-2"><Bars values={[20, 28, 24, 40, 88, 64, 30]} accent={4} /></div>
    </div>
  ) },
  Content: { tone: "paper", scene: (
    <div className="w-full max-w-[260px] rounded-[16px] bg-white p-4">
      <div className="flex items-center gap-2.5"><Avatar size={34} who={aanya} /><div><p className="text-[14px] font-semibold">Aanya Rao</p><p className="text-[11.5px] text-ink/50">Lisbon · Personal</p></div></div>
      <div className="mt-3 flex flex-col gap-1.5">{["Sunday run mix", "Book a coffee"].map((l) => <span className="flex h-8 items-center justify-between rounded-full bg-paper px-3 text-[12px] font-semibold" key={l}>{l}<span className="text-ink/35">→</span></span>)}</div>
    </div>
  ) },
  Looks: { tone: "ink", scene: (
    <div className="flex items-end gap-2">
      {[["#120F0D", "#FF5A4F"], ["#F4F2EE", "#0D0D0D"], ["#07070A", "#C7FF4A"], ["#F1ECEA", "#E8A6FF"]].map(([bg, dot], i) => (
        <span className={`relative block w-[52px] overflow-hidden rounded-[12px] shadow-[0_0_0_1px_rgba(255,255,255,.08)] ${i === 2 ? "h-[96px]" : "h-[80px]"}`} key={bg} style={{ background: bg }}>
          <span className="absolute inset-x-[16%] bottom-0 top-[22%] rounded-t-full bg-cover opacity-90" style={{ backgroundImage: `url(${aanya.photo})`, backgroundPosition: `${aanya.face.x}% ${aanya.face.y}%` }} />
          <span className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: `linear-gradient(to top, ${bg}, transparent)` }} />
          <span className="absolute bottom-2 left-1/2 h-1 w-1/3 -translate-x-1/2 rounded-full" style={{ background: dot }} />
        </span>
      ))}
    </div>
  ) },
  "Name style": { tone: "coral", scene: (
    <div className="grid w-full max-w-[250px] grid-cols-3 gap-1.5">
      {[["Aa", "font-display font-extrabold tracking-[-0.05em]"], ["Aa", "font-serif italic"], ["AA", "font-sans font-semibold tracking-[0.04em]"], ["Aa", "font-sans font-extrabold italic"], ["Aa", "font-sans font-bold"], ["Aa", "font-display font-bold"]].map(([t, c], i) => <span className={`flex h-[52px] items-center justify-center rounded-[12px] text-[24px] ${i === 3 ? "bg-ink text-paper" : "bg-white"} ${c}`} key={i}>{t}</span>)}
    </div>
  ) },
  Accent: { tone: "paper", scene: (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-2">{["#FF5A4F", "#C7FF4A", "#AFCBFF", "#E8A6FF", "#F5C66E"].map((c, i) => <span className={`size-9 rounded-full ${i === 0 ? "shadow-[0_0_0_2px_#FFFFFF,0_0_0_4px_#0D0D0D]" : ""}`} key={c} style={{ background: c }} />)}</div>
      <span className="flex h-11 w-[200px] items-center justify-center rounded-full bg-coral text-[14px] font-semibold">Connect</span>
    </div>
  ) },
  "Scroll cue": { tone: "ink", scene: (
    <div className="flex items-end gap-6 text-paper">
      <span className="flex flex-col items-center gap-1.5"><span className="flex h-9 w-6 justify-center rounded-full border-2 border-paper/70 pt-1.5"><span className="h-2 w-1 rounded-full bg-paper" /></span><span className={`${mono} text-paper/45`}>Mouse</span></span>
      <span className="flex flex-col items-center gap-1.5"><span className="flex h-9 flex-col items-center justify-end gap-0.5">{[0.3, 0.6, 1].map((o) => <span className="block h-1.5 w-3 rotate-45 border-b-2 border-r-2 border-coral" key={o} style={{ opacity: o }} />)}</span><span className={`${mono} text-paper/45`}>Cascade</span></span>
      <span className="flex flex-col items-center gap-1.5"><span className="flex h-9 items-end"><span className="h-8 w-[2px] rounded-full bg-gradient-to-b from-transparent to-coral" /></span><span className={`${mono} text-paper/45`}>Beam</span></span>
    </div>
  ) },
  "Profile soundtrack": { tone: "coral", scene: (
    <div className="flex w-full max-w-[260px] items-center gap-3 rounded-[18px] bg-ink p-3.5 text-paper">
      <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-[radial-gradient(circle_at_30%_30%,#FF5A4F,#2A2A2A_75%)]"><span className="flex h-5 items-end gap-[3px]">{[10, 18, 13, 20].map((h, i) => <span className="w-[3px] rounded-full bg-paper" key={i} style={{ height: h }} />)}</span></span>
      <span className="min-w-0 flex-1"><span className={`${mono} block text-paper/45`}>Now playing</span><span className="block truncate text-[14px] font-semibold">Sunday run mix</span></span>
      <span className="grid size-9 place-items-center rounded-full bg-paper text-[12px] text-ink">▶</span>
    </div>
  ) },
  "Standard pass": { tone: "paper", scene: <div className="flex flex-col items-center gap-3"><Pass /><span className={`${mono} text-ink/45`}>Coming soon</span></div> },
  "Premium pass": { tone: "ink", scene: <div className="flex flex-col items-center gap-3"><Pass premium /><span className={`${mono} text-paper/45`}>Coming soon</span></div> },
};

const GROUND = {
  paper: "bg-[radial-gradient(120%_120%_at_0%_0%,#FFFFFF_0%,#EDEAE1_70%)]",
  ink: "bg-[radial-gradient(120%_120%_at_100%_0%,#2A2A2A_0%,#0D0D0D_70%)]",
  coral: "bg-[radial-gradient(120%_120%_at_0%_100%,#FFB3AC_0%,#FF5A4F_75%)]",
} as const;

export type Capability = { title: string; body: string; tag?: string };

/** The "What's in it" grid: product scene, plan line, title, one sentence. */
export function CapabilityGrid({ items }: { items: Capability[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {items.map((item) => {
        const scene = SCENES[item.title];
        return (
          <li className="flex flex-col rounded-[24px] bg-white p-3 shadow-[0_40px_80px_-60px_rgba(13,13,13,.5)] sm:rounded-[28px]" key={item.title}>
            {scene ? <div aria-hidden="true" className={`flex h-[210px] items-center justify-center overflow-hidden rounded-[18px] px-5 sm:rounded-[20px] ${GROUND[scene.tone]}`} inert>{scene.scene}</div> : null}
            <div className="px-4 pb-5 pt-6 sm:px-5">
              {item.tag ? <span className={`${mono} ${item.tag === "Every plan" || item.tag === "Live today" ? "text-ink/45" : "text-coral"}`}>{item.tag}</span> : null}
              <h3 className="mt-2.5 font-display text-[28px] font-extrabold leading-none tracking-[-0.05em]">{item.title}</h3>
              <p className="mt-2.5 text-[15px] leading-[1.6] text-ink/62">{item.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
