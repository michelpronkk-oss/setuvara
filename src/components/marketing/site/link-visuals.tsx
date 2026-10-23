/* eslint-disable @next/next/no-img-element -- static example portraits inside fixed illustrations */
import type { ReactNode } from "react";

import { nameFontClasses } from "@/components/profile/name-fonts";
import { PRICES } from "@/lib/marketing/facts";
import { findTemplate } from "@/lib/marketing/templates-content";

import { CAST, CastPhone, DEMO_PEOPLE, ModePhone } from "../home/mode-phone";
import { FitCanvas } from "./fit-canvas";
import { QrArt } from "./qr-art";

/**
 * One visual per destination for the link cards: Pricing draws the plans, each Mode its own tool
 * beside its page, a template its own Look, a tool what it does. Drawn on a 1200×750 canvas (the
 * card's 16:10) and scaled to fit, so type is set large enough to read on a phone. Every person
 * and figure is an example.
 */

export type ModeSlug = "personal" | "event" | "business" | "creator";

const W = 1200;
const H = 750;
const mono = "font-label font-medium uppercase tracking-[0.16em]";
const display = "font-display font-extrabold tracking-[-0.055em]";

function Stage({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <FitCanvas className="rounded-[20px]" height={H} width={W}>
      <div className={`${nameFontClasses} relative isolate h-full w-full overflow-hidden text-ink`} style={{ background: bg }}>{children}</div>
    </FitCanvas>
  );
}

function Glow({ color, className }: { color: string; className: string }) {
  return <span aria-hidden="true" className={`absolute rounded-full blur-[110px] ${className}`} style={{ background: color }} />;
}

/** A 280×580 page drawn at height h, absolutely placed. */
function Phone({ children, left, top, h, rotate = 0, className = "" }: { children: ReactNode; left: number; top: number; h: number; rotate?: number; className?: string }) {
  const scale = h / 580;
  return (
    <div className={`absolute ${className}`} style={{ left, top, width: 280 * scale, height: h, transform: `rotate(${rotate}deg)`, filter: "drop-shadow(0 50px 60px rgba(13,13,13,.45))" }}>
      <div className="origin-top-left" style={{ width: 280, transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}

function Avatar({ src, size = 64 }: { src: string; size?: number }) {
  return <img alt="" className="shrink-0 rounded-full object-cover" src={src} style={{ width: size, height: size }} />;
}

/* ───────────────────────── Pricing ───────────────────────── */

export function PricingScene() {
  const plans = [
    { name: "Free", price: "$0", note: "Forever", rows: ["All four Modes", "2 Looks"], tone: "bg-white text-ink", y: 110, x: 60, r: 0 },
    { name: "Plus", price: PRICES.plus.monthly, note: "a month", rows: ["All 10 Looks", "No “Made with”"], tone: "bg-coral text-ink", y: 70, x: 430, r: 0 },
    { name: "Pro", price: PRICES.pro.monthly, note: "a month", rows: ["4-photo slideshow", "Pro badge"], tone: "bg-ink text-paper", y: 110, x: 800, r: 0 },
  ];
  return (
    <Stage bg="radial-gradient(80% 90% at 50% 0%,#FFFFFF,transparent 70%),linear-gradient(180deg,#F3EFE7,#E8E2D6)">
      <Glow className="left-[380px] top-[120px] h-[420px] w-[440px] opacity-40" color="#FF5A4F" />
      {plans.map((p) => (
        <div className={`absolute w-[340px] rounded-[40px] p-10 shadow-[0_60px_90px_-40px_rgba(13,13,13,.55)] ${p.tone}`} key={p.name} style={{ left: p.x, top: p.y, transform: `rotate(${p.r}deg)` }}>
          <p className={`${mono} text-[20px] opacity-60`}>{p.name}</p>
          <p className={`${display} mt-6 text-[92px] leading-[0.85]`}>{p.price}</p>
          <p className="mt-3 text-[24px] opacity-60">{p.note}</p>
          <div className="mt-9 space-y-4">
            {p.rows.map((row) => <p className="flex items-center gap-4 text-[26px] font-semibold" key={row}><span className="grid size-9 place-items-center rounded-full bg-current/15 text-[20px]">✓</span>{row}</p>)}
          </div>
        </div>
      ))}
    </Stage>
  );
}

/* ───────────────────────── Modes ───────────────────────── */

const MODE_BG: Record<ModeSlug, string> = {
  personal: "radial-gradient(90% 90% at 100% 0%,#FFE1DC,transparent 65%),linear-gradient(160deg,#FFF6F2,#F3E6DF)",
  event: "radial-gradient(80% 90% at 100% 10%,#3B4A12,transparent 65%),linear-gradient(160deg,#151515,#0D0D0D)",
  business: "radial-gradient(80% 90% at 100% 0%,#3A1715,transparent 65%),linear-gradient(160deg,#171515,#0D0D0D)",
  creator: "radial-gradient(90% 90% at 100% 0%,#FFE5C2,transparent 60%),linear-gradient(160deg,#F6EBDD,#E9D8C4)",
};
const MODE_GLOW: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#FF5A4F", creator: "#F5A54A" };
const DARK: Record<ModeSlug, boolean> = { personal: false, event: true, business: true, creator: false };

function Card({ dark, className = "", children }: { dark: boolean; className?: string; children: ReactNode }) {
  return <div className={`absolute rounded-[34px] p-8 shadow-[0_50px_80px_-40px_rgba(0,0,0,.6)] ${dark ? "bg-[#1C1C1C] text-paper shadow-[inset_0_0_0_1.5px_rgba(255,255,255,.07),0_50px_80px_-40px_rgba(0,0,0,.8)]" : "bg-white text-ink"} ${className}`}>{children}</div>;
}

function Row({ avatar, title, sub, tag, dark }: { avatar?: string; title: string; sub: string; tag?: string; dark: boolean }) {
  return (
    <div className={`flex items-center gap-5 rounded-[22px] p-4 ${dark ? "bg-white/[0.05]" : "bg-ink/[0.04]"}`}>
      {avatar ? <Avatar size={62} src={avatar} /> : null}
      <div className="min-w-0 flex-1"><p className="truncate text-[25px] font-semibold leading-tight">{title}</p><p className="mt-1 truncate text-[19px] opacity-55">{sub}</p></div>
      {tag ? <span className="rounded-full bg-coral px-4 py-2 text-[17px] font-semibold text-ink">{tag}</span> : null}
    </div>
  );
}

type Tool = "leads" | "booking" | "store" | "work" | "kit" | "live" | "met" | "links";
const MODE_TOOL: Record<ModeSlug, Tool> = { personal: "links", event: "live", business: "leads", creator: "store" };

/** What a Mode adds, drawn as the panel beside its page. */
function ModeTool({ tool, dark }: { tool: Tool; dark: boolean }) {
  const head = (label: string, aside?: ReactNode) => <div className="mb-6 flex items-center justify-between"><p className={`${mono} text-[18px] opacity-55`}>{label}</p>{aside}</div>;
  const box = "left-[60px] top-[250px] w-[560px]";
  const tile = (from: string, to: string) => ({ background: `radial-gradient(circle at 30% 30%,${from},${to} 75%)` });
  switch (tool) {
    case "leads":
      return (
        <Card className={box} dark={dark}>
          {head("Leads", <span className="rounded-full bg-coral px-4 py-1.5 text-[17px] font-semibold text-ink">3 new</span>)}
          <div className="space-y-3">
            <Row avatar={DEMO_PEOPLE.noor.photo} dark={dark} sub="Booked a call · Thu 14:00" tag="Booking" title="Noor Haddad" />
            <Row avatar={DEMO_PEOPLE.theo.photo} dark={dark} sub="Met at Slush · wants a demo" title="Theo Laurent" />
            <Row avatar={DEMO_PEOPLE.sena.photo} dark={dark} sub="Left a testimonial" title="Sena Okafor" />
          </div>
        </Card>
      );
    case "booking":
      return (
        <Card className={box} dark={dark}>
          {head("Book a call", <span className="text-[19px] font-semibold opacity-55">30 min</span>)}
          <div className="grid grid-cols-5 gap-3 text-center">
            {[["Mon", "10"], ["Tue", "11"], ["Wed", "12"], ["Thu", "13"], ["Fri", "14"]].map(([d, n]) => <div className={`rounded-[20px] py-4 ${n === "13" ? "bg-coral text-ink" : "bg-white/[0.05]"}`} key={d}><p className="text-[17px] opacity-60">{d}</p><p className={`${display} text-[40px] leading-none`}>{n}</p></div>)}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {["09:30", "14:00", "16:30"].map((t) => <span className={`rounded-full py-3 text-center text-[22px] font-semibold ${t === "14:00" ? "bg-paper text-ink" : "bg-white/[0.05]"}`} key={t}>{t}</span>)}
          </div>
        </Card>
      );
    case "store":
      return (
        <Card className={box} dark={dark}>
          {head("Store", <span className="text-[19px] font-semibold opacity-55">0% fees</span>)}
          <div className="grid grid-cols-2 gap-4">
            {[["Late sets, vol. 3", "€12", "#6B4A3A", "#2A1A14"], ["Tour poster", "€24", "#FFB0A8", "#FF5A4F"]].map(([name, price, from, to]) => (
              <div key={name}>
                <div className="h-[150px] rounded-[22px]" style={tile(from, to)} />
                <p className="mt-3 truncate text-[23px] font-semibold">{name}</p>
                <p className="text-[21px] opacity-55">{price}</p>
              </div>
            ))}
          </div>
        </Card>
      );
    case "work":
      return (
        <Card className={box} dark={dark}>
          {head("Latest work")}
          <div className="grid grid-cols-3 gap-3">
            {[["#FFB0A8", "#FF5A4F", "Live at Paradiso"], ["#6B4A3A", "#2A1A14", "Studio diary"], ["#F5D08A", "#C98A2E", "Tour film"]].map(([from, to, name]) => (
              <div key={name}><div className="relative h-[170px] rounded-[20px]" style={tile(from, to)}><span className="absolute bottom-3 left-3 grid size-10 place-items-center rounded-full bg-white/85 text-[16px]">▶</span></div><p className="mt-3 truncate text-[20px] font-semibold">{name}</p></div>
            ))}
          </div>
        </Card>
      );
    case "kit":
      return (
        <Card className={box} dark={dark}>
          {head("Media kit", <span className="text-[19px] font-semibold opacity-55">Updated today</span>)}
          <div className="grid grid-cols-3 gap-3">
            {[["48k", "Instagram"], ["21k", "TikTok"], ["9k", "YouTube"]].map(([n, l]) => <div className="rounded-[22px] bg-ink/[0.04] p-5" key={l}><p className={`${display} text-[54px] leading-none`}>{n}</p><p className="mt-2 text-[19px] opacity-55">{l}</p></div>)}
          </div>
          <p className="mt-5 flex items-center justify-between rounded-[20px] bg-ink px-5 py-4 text-[21px] font-semibold text-paper">Work with Sena<span className="text-coral">→</span></p>
        </Card>
      );
    case "live":
      return (
        <Card className={box} dark={dark}>
          {head("Live Context", <span className="flex items-center gap-2 text-[18px] font-semibold text-[#C7FF4A]"><span className="size-3 rounded-full bg-[#C7FF4A]" />Now</span>)}
          <p className={`${display} text-[56px] leading-none`}>Slush 2026</p>
          <p className="mt-3 text-[22px] opacity-55">Helsinki · until 20 Nov</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {["Here for: seed investors", "Speaker", "Stage 2"].map((t) => <span className="rounded-full bg-white/[0.07] px-5 py-2.5 text-[20px] font-semibold" key={t}>{t}</span>)}
          </div>
        </Card>
      );
    case "met":
      return (
        <Card className={box} dark={dark}>
          {head("Met at Slush", <span className="text-[19px] font-semibold opacity-55">12 today</span>)}
          <div className="space-y-3">
            <Row avatar={DEMO_PEOPLE.noor.photo} dark={dark} sub="Investor · talk about seed round" title="Noor Haddad" />
            <Row avatar={DEMO_PEOPLE.lucasClose.photo} dark={dark} sub="Founder · coffee on Friday" title="Lucas Meyer" />
            <Row avatar={DEMO_PEOPLE.sena.photo} dark={dark} sub="Speaker · Stage 2, 15:30" title="Sena Okafor" />
          </div>
        </Card>
      );
    default:
      return (
        <Card className={box} dark={dark}>
          {head("For friends")}
          <div className="space-y-3">
            {[["Instagram", "@aanya", "#E1306C"], ["Spotify", "Sunday run mix", "#1DB954"], ["WhatsApp", "Message me", "#25D366"]].map(([name, sub, color]) => (
              <div className="flex items-center gap-5 rounded-[22px] bg-ink/[0.04] p-4" key={name}>
                <span className="size-[62px] shrink-0 rounded-[18px]" style={{ background: color }} />
                <div className="min-w-0 flex-1"><p className="text-[25px] font-semibold leading-tight">{name}</p><p className="mt-1 text-[19px] opacity-55">{sub}</p></div>
                <span className="text-[26px] opacity-40">→</span>
              </div>
            ))}
          </div>
        </Card>
      );
  }
}

const MODE_NAME: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" };

/** A Mode's page with one of its tools beside it; title and tool change for a use case. */
export function ModeScene({ slug, title, tool = MODE_TOOL[slug] }: { slug: ModeSlug; title?: string; tool?: Tool }) {
  const dark = DARK[slug];
  return (
    <Stage bg={MODE_BG[slug]}>
      <Glow className="right-[60px] top-[60px] h-[520px] w-[420px] opacity-45" color={MODE_GLOW[slug]} />
      <div className={`absolute left-[64px] top-[60px] ${dark ? "text-paper" : "text-ink"}`}>
        <p className={`${mono} text-[20px] opacity-55`}>{title ? `${MODE_NAME[slug]} Mode` : "Mode"}</p>
        <p className={`${display} mt-3 text-[104px] leading-[0.9]`}>{title ?? MODE_NAME[slug]}</p>
      </div>
      <ModeTool dark={dark} tool={tool} />
      <Phone h={640} left={770} rotate={4} top={55}><CastPhone slug={slug} /></Phone>
    </Stage>
  );
}

/** All four Modes, fanned: one identity, four pages. */
export function ModesScene() {
  const order: ModeSlug[] = ["personal", "event", "business", "creator"];
  return (
    <Stage bg="radial-gradient(90% 80% at 50% 0%,#FFFFFF,transparent 70%),linear-gradient(180deg,#F3EFE7,#E6DFD2)">
      <Glow className="left-[340px] top-[160px] h-[420px] w-[520px] opacity-35" color="#FF5A4F" />
      {order.map((slug, i) => <Phone h={560} key={slug} left={90 + i * 255} rotate={(i - 1.5) * 5} top={120 + Math.abs(i - 1.5) * 30}><CastPhone slug={slug} /></Phone>)}
    </Stage>
  );
}

/* ───────────────────────── Templates ───────────────────────── */

export function TemplateScene({ slug }: { slug: string }) {
  const template = findTemplate(slug);
  if (!template) return <ModesScene />;
  const look = template.kind === "look" ? { theme: template.slug, pictures: template.pictures } : CAST[template.mode].look;
  const who = template.kind === "look" ? template.who : CAST[template.mode].who;
  const live = template.kind === "mode" ? CAST[template.mode].live : undefined;
  return (
    <Stage bg="radial-gradient(70% 90% at 70% 20%,#3A2422,transparent 70%),linear-gradient(160deg,#171515,#0D0D0D)">
      <Glow className="right-[120px] top-[100px] h-[460px] w-[380px] opacity-40" color="#FF5A4F" />
      <div className="absolute left-[64px] top-[64px] text-paper">
        <p className={`${mono} text-[20px] opacity-55`}>{template.kind === "look" ? (template.free ? "Look · Free" : "Look · Plus") : "Template"}</p>
        <p className={`${display} mt-3 text-[110px] leading-[0.88]`}>{template.name.replace(" Mode", "")}</p>
        <p className="mt-6 max-w-[440px] text-[26px] leading-[1.35] text-paper/60">{template.line}</p>
      </div>
      <Phone h={640} left={740} rotate={3} top={55}><ModePhone live={live} look={look} slug={template.mode} who={who} /></Phone>
    </Stage>
  );
}

/* ───────────────────────── Tools ───────────────────────── */

export function QrToolScene() {
  const styles = [["#0D0D0D", "#FFFFFF"], ["#FF5A4F", "#FFF1EF"], ["#C7FF4A", "#0D0D0D"]];
  return (
    <Stage bg="radial-gradient(80% 90% at 30% 20%,#2A2A2A,transparent 70%),linear-gradient(160deg,#151515,#0D0D0D)">
      <Glow className="left-[200px] top-[160px] h-[420px] w-[420px] opacity-35" color="#C7FF4A" />
      <div className="absolute left-[110px] top-[95px] rotate-[-4deg] rounded-[48px] bg-white p-12 shadow-[0_60px_90px_-30px_rgba(0,0,0,.9)]">
        <QrArt size={420} />
        <p className={`${mono} mt-8 text-center text-[20px] text-ink/50`}>setuvara.com/aanya</p>
      </div>
      <div className="absolute left-[720px] top-[110px] text-paper">
        <p className={`${mono} text-[20px] opacity-55`}>Free tool</p>
        <p className={`${display} mt-3 text-[96px] leading-[0.9]`}>QR code<br />generator</p>
        <div className="mt-10 flex gap-5">
          {styles.map(([fg, bg]) => <span className="grid size-[92px] place-items-center rounded-[24px] shadow-[inset_0_0_0_2px_rgba(255,255,255,.12)]" key={fg} style={{ background: bg }}><span className="size-[44px] rounded-[10px]" style={{ background: fg }} /></span>)}
        </div>
      </div>
    </Stage>
  );
}

export function CheckerScene() {
  const checks = [["Secure link (HTTPS)", "pass"], ["Fast first response", "pass"], ["Preview image", "fail"], ["Made for phones", "warn"]] as const;
  return (
    <Stage bg="radial-gradient(90% 90% at 100% 0%,#FFE1DC,transparent 65%),linear-gradient(160deg,#FBF8F3,#EFE9DF)">
      <Glow className="left-[80px] top-[300px] h-[360px] w-[360px] opacity-35" color="#FF5A4F" />
      <div className="absolute left-[64px] top-[70px] w-[1072px] rounded-full bg-white px-10 py-7 text-[32px] shadow-[0_40px_70px_-40px_rgba(13,13,13,.5)]">
        <span className="opacity-40">https://</span>your-link-in-bio.com<span className="float-right rounded-full bg-ink px-7 py-1 text-[26px] font-semibold text-paper">Check</span>
      </div>
      <div className="absolute left-[90px] top-[250px] grid size-[400px] place-items-center rounded-full" style={{ background: "conic-gradient(#FF5A4F 0 72%, rgba(13,13,13,.08) 72% 100%)" }}>
        <div className="grid size-[320px] place-items-center rounded-full bg-[#FBF8F3] text-center"><div><p className={`${display} text-[140px] leading-none`}>72</p><p className={`${mono} mt-2 text-[20px] opacity-50`}>out of 100</p></div></div>
      </div>
      <div className="absolute left-[560px] top-[250px] w-[580px] space-y-4">
        {checks.map(([label, status]) => (
          <div className="flex items-center gap-5 rounded-[26px] bg-white p-6 shadow-[0_30px_50px_-40px_rgba(13,13,13,.5)]" key={label}>
            <span className={`grid size-[52px] shrink-0 place-items-center rounded-full text-[26px] font-bold ${status === "pass" ? "bg-[#EEF7E4] text-[#3E6B12]" : status === "warn" ? "bg-[#FFF5DC] text-[#8A5A00]" : "bg-[#FFF1EF] text-[#a43d36]"}`}>{status === "pass" ? "✓" : status === "warn" ? "!" : "✕"}</span>
            <span className="text-[28px] font-semibold">{label}</span>
          </div>
        ))}
      </div>
    </Stage>
  );
}

/** A printed card whose QR opens a page you keep editing. */
export function PrintCardScene() {
  return (
    <Stage bg="radial-gradient(90% 90% at 0% 0%,#FFFFFF,transparent 65%),linear-gradient(160deg,#EFEAE1,#E0D8CA)">
      <Glow className="left-[520px] top-[140px] h-[420px] w-[420px] opacity-35" color="#FF5A4F" />
      <div className="absolute left-[70px] top-[170px] flex h-[400px] w-[640px] rotate-[-7deg] justify-between rounded-[30px] bg-[#FBF9F5] p-12 shadow-[0_60px_90px_-40px_rgba(13,13,13,.55)]">
        <div className="flex flex-col">
          <svg aria-hidden="true" fill="#FF5A4F" height="56" viewBox="0 0 100 100" width="56"><path d="M66.62 10.38A26 26 0 1 0 37 52.89L43.25 56.49L52.25 40.91L46 37.3A8 8 0 1 1 57.15 26.78Z" /><path d="M33.38 89.62A26 26 0 1 0 63 47.11L56.75 43.51L47.75 59.09L54 62.7A8 8 0 1 1 42.85 73.22Z" /></svg>
          <p className={`${display} mt-auto text-[56px] leading-[0.95]`}>Lucas<br />Meyer</p>
          <p className="mt-3 text-[22px] opacity-55">Founder</p>
        </div>
        <div className="self-end rounded-[20px] bg-white p-4 shadow-[inset_0_0_0_2px_rgba(13,13,13,.06)]"><QrArt size={190} value="https://setuvara.com/lucas" /></div>
      </div>
      <Phone h={620} left={790} rotate={5} top={65}><CastPhone slug="business" /></Phone>
    </Stage>
  );
}
