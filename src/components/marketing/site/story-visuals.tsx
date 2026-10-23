import type { ReactNode } from "react";

import { CastPhone, DEMO_PEOPLE, ModePhone } from "../home/mode-phone";
import { BrandMark } from "./brand-mark";
import { Avatar, Card, display, Glow, mono, Phone, Row, Stage } from "./link-visuals";
import { QrArt } from "./qr-art";
import { BannerVisual, type VisualKey } from "./visuals";

/**
 * Banners for blog posts (1200×800, 3:2) and a few use-case cards (1200×750), drawn with the same
 * pieces as the link cards: a Mode's ground, a real page on a phone, and the one idea of the
 * story beside it. Every person, place and figure is an example.
 */

const BANNER = 800;
const banner = "rounded-[24px] sm:rounded-[32px]";

const WARM = "radial-gradient(90% 90% at 100% 0%,#FFE5C2,transparent 60%),linear-gradient(160deg,#F6EBDD,#E9D8C4)";
const PAPER = "radial-gradient(90% 90% at 0% 0%,#FFFFFF,transparent 65%),linear-gradient(160deg,#EFEAE1,#E0D8CA)";
const BLUSH = "radial-gradient(90% 90% at 100% 0%,#FFE1DC,transparent 65%),linear-gradient(160deg,#FFF6F2,#F3E6DF)";
const NIGHT_LIME = "radial-gradient(80% 90% at 100% 10%,#3B4A12,transparent 65%),linear-gradient(160deg,#151515,#0D0D0D)";
const NIGHT_CORAL = "radial-gradient(80% 90% at 100% 0%,#3A1715,transparent 65%),linear-gradient(160deg,#171515,#0D0D0D)";

function Heading({ kicker, title, dark = false, className = "left-[70px] top-[70px]" }: { kicker: string; title: ReactNode; dark?: boolean; className?: string }) {
  return (
    <div className={`absolute ${className} ${dark ? "text-paper" : "text-ink"}`}>
      <p className={`${mono} text-[20px] opacity-55`}>{kicker}</p>
      <p className={`${display} mt-3 text-[96px] leading-[0.88]`}>{title}</p>
    </div>
  );
}

/* ───────────────────────── Blog banners ───────────────────────── */

/** What belongs in a bio link: three things, numbered, beside a page that does them. */
function BioScene() {
  const items = [["Your newest work", "One video, song or post, first."], ["One clear action", "Shop, book or subscribe. Pick one."], ["Where to find you", "Three platforms, not twelve."]];
  return (
    <Stage bg={WARM} className={banner} height={BANNER}>
      <Glow className="right-[80px] top-[80px] h-[520px] w-[420px] opacity-45" color="#F5A54A" />
      <Heading kicker="Link in bio" title={<>Three things,<br />not thirty.</>} />
      <div className="absolute left-[70px] top-[330px] w-[600px] space-y-4">
        {items.map(([title, sub], i) => (
          <div className="flex items-center gap-6 rounded-[28px] bg-white p-6 shadow-[0_40px_60px_-45px_rgba(13,13,13,.5)]" key={title}>
            <span className={`${display} grid size-[68px] shrink-0 place-items-center rounded-full bg-coral text-[40px]`}>{i + 1}</span>
            <div><p className="text-[30px] font-semibold leading-tight">{title}</p><p className="mt-1 text-[22px] opacity-55">{sub}</p></div>
          </div>
        ))}
      </div>
      <Phone h={680} left={790} rotate={4} top={70}><CastPhone slug="creator" /></Phone>
    </Stage>
  );
}

/** A stack of reprinted paper cards against one tap that keeps working. */
function CardsScene() {
  return (
    <Stage bg={PAPER} className={banner} height={BANNER}>
      <Glow className="left-[600px] top-[180px] h-[440px] w-[440px] opacity-35" color="#FF5A4F" />
      <Heading kicker="Paper vs digital" title={<>Print once.<br />Edit forever.</>} />
      {[["-12deg", 0.55, 0], ["-7deg", 0.75, 22], ["-2deg", 1, 44]].map(([rotate, opacity, shift], i) => (
        <div className="absolute flex h-[260px] w-[440px] flex-col justify-between rounded-[22px] bg-[#FBF9F5] p-9 shadow-[0_40px_70px_-40px_rgba(13,13,13,.5)]" key={i} style={{ left: 80 + Number(shift), top: 360 + Number(shift), transform: `rotate(${rotate})`, opacity: Number(opacity) }}>
          <p className={`${display} text-[44px] leading-none`}>Lucas Meyer</p>
          <p className="text-[22px] opacity-55">{i === 2 ? "Founder · new title, new number" : "Founder · old title"}</p>
        </div>
      ))}
      <p className={`${mono} absolute left-[120px] top-[700px] text-[20px] text-[#a43d36]`}>Reprinted three times</p>
      <Phone h={640} left={760} rotate={4} top={90}><CastPhone slug="business" /></Phone>
      <div className="absolute left-[640px] top-[520px] flex h-[170px] w-[270px] rotate-[-10deg] flex-col justify-between rounded-[22px] bg-ink p-6 text-paper shadow-[0_40px_70px_-30px_rgba(13,13,13,.7)]">
        <svg aria-hidden="true" fill="#FF5A4F" height="34" viewBox="0 0 100 100" width="34"><path d="M66.62 10.38A26 26 0 1 0 37 52.89L43.25 56.49L52.25 40.91L46 37.3A8 8 0 1 1 57.15 26.78Z" /><path d="M33.38 89.62A26 26 0 1 0 63 47.11L56.75 43.51L47.75 59.09L54 62.7A8 8 0 1 1 42.85 73.22Z" /></svg>
        <p className={`${mono} text-[15px] opacity-60`}>Tap · any NFC card</p>
      </div>
    </Stage>
  );
}

/** The 48 hours after an event: met, messaged, booked, with the note that makes it possible. */
function FollowUpScene() {
  const days = [["Day 0", "Met, note saved"], ["Day 1", "Message sent"], ["Day 2", "Coffee booked"]];
  return (
    <Stage bg={NIGHT_LIME} className={banner} height={BANNER}>
      <Glow className="right-[100px] top-[120px] h-[480px] w-[440px] opacity-40" color="#C7FF4A" />
      <Heading dark kicker="Follow-up" title={<>Within<br />48 hours.</>} />
      <div className="absolute left-[70px] top-[400px] flex gap-4">
        {days.map(([day, what], i) => (
          <div className={`h-[210px] w-[188px] rounded-[26px] p-6 ${i === 2 ? "bg-[#C7FF4A] text-ink" : "bg-white/[0.07] text-paper"}`} key={day}>
            <p className={`${mono} text-[17px] opacity-60`}>{day}</p>
            <p className="mt-3 text-[27px] font-semibold leading-[1.15]">{what}</p>
          </div>
        ))}
      </div>
      <Card className="left-[710px] top-[150px] w-[430px]" dark>
        <div className="flex items-center gap-5"><Avatar size={84} src={DEMO_PEOPLE.noor.photo} /><div><p className="text-[32px] font-semibold leading-tight">Noor Haddad</p><p className="mt-1 text-[20px] opacity-55">Investor</p></div></div>
        <p className="mt-7 flex items-center gap-3 rounded-full bg-white/[0.07] px-5 py-3 text-[20px]"><span className="size-3 rounded-full bg-[#C7FF4A]" />Met at Slush · Helsinki · 14 Nov</p>
        <p className={`${mono} mt-7 text-[16px] opacity-50`}>Your note</p>
        <p className="mt-2 text-[26px] leading-snug">Raising in Q1. Wants an intro to two climate founders.</p>
        <p className="mt-7 rounded-[20px] bg-paper px-5 py-4 text-center text-[22px] font-semibold text-ink">Message Noor</p>
      </Card>
    </Stage>
  );
}

/** A media kit brands can read in ten seconds, with the deals it brings in. */
function MediaKitScene() {
  const deals = [["Audio brand · sponsored session", "New"], ["Festival · live set", "Talking"], ["Streaming service · playlist", "Paid"]];
  return (
    <Stage bg={WARM} className={banner} height={BANNER}>
      <Glow className="left-[420px] top-[160px] h-[460px] w-[460px] opacity-40" color="#F5A54A" />
      <Heading kicker="Media kit" title={<>Ten seconds<br />to yes.</>} />
      <Card className="left-[70px] top-[340px] w-[560px]" dark={false}>
        <div className="flex items-center gap-5"><Avatar size={76} src={DEMO_PEOPLE.sena.photo} /><div><p className="text-[30px] font-semibold leading-tight">Sena Okafor</p><p className="mt-1 text-[20px] opacity-55">Music · live sessions · Lagos</p></div></div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {([["48k", "youtube"], ["31k", "instagram"], ["120k", "tiktok"]] as const).map(([n, brand]) => <div className="rounded-[22px] bg-ink/[0.04] p-5" key={brand}><BrandMark brand={brand} plain size={30} /><p className={`${display} mt-3 text-[50px] leading-none`}>{n}</p></div>)}
        </div>
      </Card>
      <div className="absolute left-[690px] top-[150px] w-[440px] space-y-4">
        <p className={`${mono} text-[18px] opacity-55`}>Deals</p>
        {deals.map(([name, stage]) => (
          <div className={`flex items-center justify-between gap-4 rounded-[24px] px-6 py-5 text-[23px] font-semibold ${stage === "Talking" ? "bg-ink text-paper" : "bg-white/80"}`} key={name}>
            <span className="truncate">{name}</span>
            <span className={`${mono} shrink-0 text-[15px] ${stage === "Talking" ? "text-coral" : "opacity-55"}`}>{stage}</span>
          </div>
        ))}
        <p className="pt-2 text-[20px] opacity-55">Example numbers. Brands reach you through a Collab Action.</p>
      </div>
    </Stage>
  );
}

/** Size by distance, contrast and a quiet zone: the three rules that make a code scan. */
function QrPrintScene() {
  const sizes = [[110, "2 cm", "Card · 20 cm away"], [170, "5 cm", "Flyer · 50 cm"], [250, "30 cm", "Poster · 3 m"]] as const;
  return (
    <Stage bg={BLUSH} className={banner} height={BANNER}>
      <Glow className="left-[500px] top-[260px] h-[420px] w-[460px] opacity-30" color="#FF5A4F" />
      <Heading kicker="Print a QR code" title="Size it by distance." />
      <div className="absolute bottom-[80px] left-[70px] flex items-end gap-9">
        {sizes.map(([px, size, use]) => (
          <div key={size}>
            <div className="rounded-[24px] bg-white p-5 shadow-[0_40px_60px_-40px_rgba(13,13,13,.5)]"><QrArt size={px} /></div>
            <p className={`${display} mt-5 text-[46px] leading-none`}>{size}</p>
            <p className="mt-2 text-[21px] opacity-55">{use}</p>
          </div>
        ))}
      </div>
      <div className="absolute right-[60px] top-[300px] w-[290px] space-y-4">
        {[["High contrast", true], ["Quiet zone", true], ["Pale colours", false]].map(([label, ok]) => (
          <div className="flex items-center gap-4 rounded-[22px] bg-white p-5 shadow-[0_30px_50px_-40px_rgba(13,13,13,.5)]" key={String(label)}>
            <span className={`grid size-[46px] shrink-0 place-items-center rounded-full text-[22px] font-bold ${ok ? "bg-[#EEF7E4] text-[#3E6B12]" : "bg-[#FFF1EF] text-[#a43d36]"}`}>{ok ? "✓" : "✕"}</span>
            <span className="text-[25px] font-semibold">{label}</span>
          </div>
        ))}
      </div>
    </Stage>
  );
}

/** People kept with where, when and why you met. */
function RememberScene() {
  const people = [
    { who: DEMO_PEOPLE.noor, sub: "Café Lisboa · March · “wants climate intros”" },
    { who: DEMO_PEOPLE.theo, sub: "Slush, Helsinki · November · speaker" },
    { who: DEMO_PEOPLE.sena, sub: "Paradiso, Amsterdam · July · live sessions" },
  ];
  return (
    <Stage bg={BLUSH} className={banner} height={BANNER}>
      <Glow className="right-[90px] top-[90px] h-[520px] w-[420px] opacity-45" color="#FF5A4F" />
      <Heading kicker="Connections" title={<>Where, when<br />and why.</>} />
      <Card className="left-[70px] top-[340px] w-[640px]" dark={false}>
        <div className="mb-5 flex items-center justify-between"><p className={`${mono} text-[18px] opacity-55`}>People you met</p><span className="rounded-full bg-ink/[0.06] px-4 py-1.5 text-[18px] font-semibold">Search “Slush”</span></div>
        <div className="space-y-3">{people.map((p) => <Row avatar={p.who.photo} dark={false} key={p.who.name} sub={p.sub} title={p.who.name} />)}</div>
      </Card>
      <Phone h={680} left={800} rotate={4} top={70}><CastPhone slug="personal" /></Phone>
    </Stage>
  );
}

const POST_SCENES = {
  "link-in-bio": BioScene,
  "paper-vs-digital": CardsScene,
  "follow-up": FollowUpScene,
  "media-kit": MediaKitScene,
  "qr-print": QrPrintScene,
  "remember-people": RememberScene,
} as const;

export type PostVisualKey = VisualKey | keyof typeof POST_SCENES;

/** A post's banner: a feature's own visual, or the scene drawn for its story. */
export function PostVisual({ name, className = "" }: { name: PostVisualKey; className?: string }) {
  if (name in POST_SCENES) {
    const Scene = POST_SCENES[name as keyof typeof POST_SCENES];
    return <div className={className}><Scene /></div>;
  }
  return <BannerVisual className={className} name={name as VisualKey} />;
}

/* ───────────────────────── Use-case cards ───────────────────────── */

/** An NFC card meeting a phone, with the page it opens. */
export function NfcScene() {
  return (
    <Stage bg={NIGHT_CORAL}>
      <Glow className="right-[80px] top-[60px] h-[520px] w-[420px] opacity-45" color="#FF5A4F" />
      <Heading dark kicker="Business Mode" title={<>NFC<br />card</>} className="left-[64px] top-[60px]" />
      {[220, 300, 380].map((size, i) => <span aria-hidden="true" className="absolute rounded-full border-2 border-coral" key={size} style={{ left: 470 - size / 2, top: 470 - size / 2, width: size, height: size, opacity: 0.5 - i * 0.14 }} />)}
      <div className="absolute left-[150px] top-[400px] flex h-[230px] w-[370px] rotate-[-14deg] flex-col justify-between rounded-[26px] bg-[#1F1F1F] p-8 text-paper shadow-[inset_0_0_0_1.5px_rgba(255,255,255,.08),0_50px_80px_-30px_rgba(0,0,0,.9)]">
        <svg aria-hidden="true" fill="#FF5A4F" height="42" viewBox="0 0 100 100" width="42"><path d="M66.62 10.38A26 26 0 1 0 37 52.89L43.25 56.49L52.25 40.91L46 37.3A8 8 0 1 1 57.15 26.78Z" /><path d="M33.38 89.62A26 26 0 1 0 63 47.11L56.75 43.51L47.75 59.09L54 62.7A8 8 0 1 1 42.85 73.22Z" /></svg>
        <div><p className={`${display} text-[44px] leading-none`}>Lucas Meyer</p><p className={`${mono} mt-3 text-[15px] opacity-55`}>Tap · opens Business</p></div>
      </div>
      <Phone h={640} left={770} rotate={4} top={55}><CastPhone slug="business" /></Phone>
    </Stage>
  );
}

/** Founders: the company and what it's building, with a way to book an intro. */
export function FoundersScene() {
  const roadmap = [["Now", "Team inbox", "▲ 128"], ["Next", "Calendar sync", "▲ 96"], ["Shipped", "Quick QR", "✓"]];
  return (
    <Stage bg={NIGHT_CORAL}>
      <Glow className="right-[60px] top-[60px] h-[520px] w-[420px] opacity-45" color="#FF5A4F" />
      <Heading dark kicker="Business Mode" title="Founders" className="left-[64px] top-[60px]" />
      <Card className="left-[60px] top-[250px] w-[580px]" dark>
        <div className="flex items-center gap-5">
          <span className={`${display} grid size-[72px] place-items-center rounded-[20px] bg-coral text-[40px] text-ink`}>N</span>
          <div><p className="text-[30px] font-semibold leading-tight">Northwind</p><p className="mt-1 text-[20px] opacity-55">Seed · Berlin · 12 people</p></div>
        </div>
        <div className="mt-6 space-y-2.5">
          {roadmap.map(([when, what, votes]) => (
            <div className="flex items-center gap-4 rounded-[18px] bg-white/[0.05] px-5 py-3.5" key={when}>
              <span className={`${mono} w-[96px] text-[15px] ${when === "Now" ? "text-coral" : "opacity-50"}`}>{when}</span>
              <span className="flex-1 text-[23px] font-semibold">{what}</span>
              <span className="text-[19px] opacity-60">{votes}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          <span className="flex-1 rounded-full bg-coral py-3.5 text-center text-[21px] font-semibold text-ink">Book an intro</span>
          <span className="flex-1 rounded-full py-3.5 text-center text-[21px] font-semibold shadow-[inset_0_0_0_2px_rgba(255,255,255,.18)]">Save contact</span>
        </div>
      </Card>
      <Phone h={640} left={770} rotate={4} top={55}><CastPhone slug="business" /></Phone>
    </Stage>
  );
}

const AGENT_GREEN = "#1F5C4A";

/** Agents: a light, calm page in a deep green, with open viewing slots and a client's word. */
export function AgentsScene() {
  const slots = [["10:00", "2 left", "open"], ["11:30", "Booked", "full"], ["14:00", "1 left", "picked"]] as const;
  return (
    <Stage bg="radial-gradient(90% 90% at 100% 0%,#E4EDE6,transparent 65%),linear-gradient(160deg,#F7F4EE,#E9E3D8)">
      <Glow className="right-[80px] top-[80px] h-[500px] w-[420px] opacity-35" color="#7FB59B" />
      <Heading kicker="Business Mode" title="Agents" className="left-[64px] top-[60px]" />
      <Card className="left-[60px] top-[240px] w-[470px]" dark={false}>
        <div className="mb-5 flex items-center justify-between"><p className={`${mono} text-[18px] opacity-55`}>Open viewings</p><span className="text-[19px] font-semibold opacity-55">Sat 16 Nov</span></div>
        <div className="space-y-3">
          {slots.map(([time, note, state]) => (
            <div className={`flex items-center justify-between rounded-[20px] px-6 py-4 ${state === "picked" ? "text-white" : state === "full" ? "bg-ink/[0.03] opacity-45" : "bg-ink/[0.04]"}`} key={time} style={state === "picked" ? { background: AGENT_GREEN } : undefined}>
              <span className={`${display} text-[38px] leading-none`}>{time}</span>
              <span className="text-[20px] font-semibold">{note}</span>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[20px] opacity-55">Requests land in Leads.</p>
      </Card>
      <div className="absolute left-[500px] top-[500px] w-[300px] rotate-[3deg] rounded-[26px] bg-white p-6 shadow-[0_40px_60px_-40px_rgba(13,13,13,.5)]">
        <p className={`${display} text-[30px] leading-[1.05]`} style={{ color: AGENT_GREEN }}>“We found our flat in a week.”</p>
        <p className="mt-3 text-[17px] opacity-55">Example client</p>
      </div>
      <Phone h={640} left={790} rotate={3} top={55}><ModePhone look={{ theme: "clean", accent: AGENT_GREEN }} slug="business" who={DEMO_PEOPLE.noor} /></Phone>
    </Stage>
  );
}

const COACH_VIOLET = "#7C5CFF";

/** Coaches: proof first, then the next free session, on a soft violet page. */
export function CoachesScene() {
  return (
    <Stage bg="radial-gradient(90% 90% at 100% 0%,#E9E1FF,transparent 65%),linear-gradient(160deg,#F7F3FF,#ECE5F7)">
      <Glow className="right-[80px] top-[60px] h-[520px] w-[420px] opacity-40" color={COACH_VIOLET} />
      <Heading kicker="Business Mode" title="Coaches" className="left-[64px] top-[60px]" />
      <div className="absolute left-[60px] top-[250px] w-[560px] rounded-[34px] p-9 text-white shadow-[0_50px_80px_-40px_rgba(60,30,140,.6)]" style={{ background: COACH_VIOLET }}>
        <p className={`${display} text-[44px] leading-[1.02]`}>“Three sessions in, I finally have a plan.”</p>
        <p className="mt-5 text-[19px] opacity-75">Example client · one of 24 shown on Plus</p>
      </div>
      <Card className="left-[100px] top-[520px] w-[520px]" dark={false}>
        <div className="flex items-center justify-between gap-4">
          <div><p className={`${mono} text-[16px] opacity-55`}>Next free session</p><p className="mt-2 text-[28px] font-semibold">Tue 11 · 09:30 · 45 min</p></div>
          <span className="rounded-full px-6 py-3 text-[21px] font-semibold text-white" style={{ background: COACH_VIOLET }}>Book</span>
        </div>
      </Card>
      <Phone h={640} left={790} rotate={4} top={55}><ModePhone look={{ theme: "aura", accent: COACH_VIOLET }} slug="business" who={DEMO_PEOPLE.aanya} /></Phone>
    </Stage>
  );
}
