import { MemberBadge } from "@/components/app/status-badge";
import { MeetMark } from "@/components/marketing/brand";
import { PLAN_COUNTS } from "@/lib/billing/plan-copy";

import { BadgedName, Lede, Mono, SECTION, SECTION_PAD, SectionHead, SoonPill } from "./shared";

const CARD = "flex min-w-0 flex-col gap-6 rounded-[28px] p-[clamp(22px,2.6vw,36px)]";

export function ProShowcase() {
  return (
    <section aria-labelledby="pro-title" className="relative scroll-mt-16 overflow-hidden bg-ink text-paper" id="pro">
      <div className={`${SECTION} ${SECTION_PAD} gap-[clamp(36px,4vw,56px)]`}>
        <SectionHead lede={<Lede className="text-paper/70">The full picture of how your identity performs. More room for the work.</Lede>}>
          <div className="flex flex-col gap-5">
            <Mono className="flex items-center gap-2.5 tracking-[0.16em] text-[#e8d28a]"><MemberBadge decorative size={18} tier="pro" />Pro</Mono>
            <h2 className="m-0 font-display text-[clamp(36px,4.4vw,68px)] font-extrabold leading-[0.94] tracking-[-0.05em]" id="pro-title">Your identity,<br /><span className="text-[#d6b25e]">at work.</span></h2>
          </div>
        </SectionHead>

        <div className="flex flex-wrap gap-5">
          <article className={`${CARD} flex-[1_1_520px] bg-[#1a1a1a]`}>
            <Mono className="text-paper/65">07 · Photo slideshow</Mono>
            <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-4 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <Slideshow />
              <div className="flex flex-col gap-4">
                <ol aria-label="Slides" className="m-0 grid list-none grid-cols-4 gap-2 p-0 sm:grid-cols-2">
                  {SLIDES.map((slide, index) => (
                    <li className="relative aspect-[4/5] overflow-hidden rounded-[14px] shadow-[inset_0_0_0_1px_rgba(245,244,239,.1)]" key={slide.id}>
                      <SlideFace slide={slide} small />
                      <Mono className="absolute left-1.5 top-1.5 rounded-full bg-ink/70 px-1.5 py-0.5 text-[9px] text-paper">{index + 1}</Mono>
                    </li>
                  ))}
                </ol>
                <div className="mt-auto grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1 rounded-[14px] px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(245,244,239,.15)]"><Mono className="text-[10px] tracking-[0.12em] text-paper/65">Plus</Mono><span className="text-[13px]">{PLAN_COUNTS.plusSlides} photos</span></div>
                  <div className="flex flex-col gap-1 rounded-[14px] bg-[#d6b25e] px-3.5 py-3 text-ink"><Mono className="text-[10px] tracking-[0.12em]">Pro</Mono><span className="text-[13px] font-semibold">{PLAN_COUNTS.proSlides} photos</span></div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-paper/15 pt-5"><h3 className="m-0 font-display text-[clamp(20px,1.7vw,24px)] font-bold leading-[1.05] tracking-[-0.03em]">Show the work, not just the face.</h3><p className="m-0 text-[14px] leading-[1.5] text-paper/70">{`${PLAN_COUNTS.proSlides} photos per Mode, at your pace.`}</p></div>
          </article>

          <article className={`${CARD} flex-[1_1_480px] bg-[#1a1a1a]`}>
            <Mono className="text-paper/65">08 · Your numbers, your files</Mono>
            <div className="flex flex-col overflow-hidden rounded-3xl bg-ink shadow-[inset_0_0_0_1px_rgba(245,244,239,.1)]">
              <div className="flex items-center gap-3 border-b border-paper/10 px-[18px] py-3.5"><span aria-hidden="true" className="flex shrink-0 gap-1.5">{[0, 1, 2].map((dot) => <span className="size-2 rounded-full bg-paper/20" key={dot} />)}</span><span className="min-w-0 flex-1 truncate font-label text-[12px] text-paper/85">setuvara-analytics-2026-10-07-2026-10-10.csv</span><Mono className="shrink-0 rounded-full bg-[#d6b25e]/15 px-2 py-0.5 text-[9px] text-[#e8d28a]">CSV</Mono></div>
              <div className="grid grid-cols-[1.3fr_1.2fr_1fr_1.1fr] gap-x-3 overflow-hidden px-[18px] py-3 font-label text-[11px] leading-6 text-paper/80">
                {["date", "profile_views", "qr_scans", "connections", "2026-10-07", "64", "18", "3", "2026-10-08", "71", "22", "4", "2026-10-09", "58", "15", "2", "2026-10-10", "93", "31", "6"].map((cell, index) => <span className={`truncate ${index < 4 ? "text-paper/50" : ""}`} key={index}>{cell}</span>)}
              </div>
              <div aria-hidden="true" className="flex items-end gap-1.5 border-t border-paper/10 px-[18px] pb-4 pt-4">
                {[64, 71, 58, 93].map((value, index) => <span className={`flex-1 rounded-t-md ${index === 3 ? "bg-[#d6b25e]" : "bg-paper/15"}`} key={index} style={{ height: `${value * 0.5}px` }} />)}
                <span className="ml-3 flex h-9 shrink-0 items-center gap-1.5 self-center rounded-full bg-paper px-3.5 text-[12px] font-semibold text-ink"><svg className="size-3" fill="none" viewBox="0 0 12 12"><path d="M6 1.5v6M3.5 5 6 7.5 8.5 5M2 10.5h8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" /></svg>Export</span>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-2">
              <div className="flex flex-col gap-1 rounded-[14px] px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(245,244,239,.15)]"><Mono className="text-[10px] tracking-[0.12em] text-paper/65">Custom range</Mono><span className="text-[13px]">Any period, up to two years</span></div>
              <div className="flex flex-col gap-1 rounded-[14px] px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(245,244,239,.15)]"><Mono className="text-[10px] tracking-[0.12em] text-paper/65">Devices</Mono><span className="text-[13px]">Phone, desktop and tablet</span></div>
            </div>
            <div className="flex flex-col gap-2 border-t border-paper/15 pt-5"><h3 className="m-0 font-display text-[clamp(20px,1.7vw,24px)] font-bold leading-[1.05] tracking-[-0.03em]">Take the numbers with you.</h3><p className="m-0 text-[14px] leading-[1.5] text-paper/70">Any period, as CSV.</p></div>
          </article>

          <article className={`${CARD} flex-[1_1_100%] bg-paper text-ink`}>
            <Mono className="text-ink/65">09 · Pro at work</Mono>
            <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-5 md:grid-cols-3">
              <div className="flex flex-col gap-3.5 rounded-[22px] bg-white p-5">
                <div className="flex flex-col gap-1.5">
                  {[["Lucas Meyer", "Owner"], ["Ines Duarte", "Manager"], ["Tom Okafor", "Member"]].map(([name, role]) => (
                    <span className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]" key={name}><span className="text-[13px] font-semibold">{name}</span><span className="text-[12px] text-ink/60">{role}</span></span>
                  ))}
                </div>
                <h3 className="m-0 font-display text-[19px] font-bold leading-none tracking-[-0.03em]">A team on your Leads</h3>
                <p className="m-0 text-[13px] leading-[1.5] text-ink/65">Up to five teammates work your Business leads, as managers or members.</p>
              </div>
              <div className="flex flex-col gap-3.5 rounded-[22px] bg-white p-5">
                <div className="flex flex-col gap-1.5">
                  {["Stripe", "RevenueCat", "Paddle"].map((label, index) => <span className={`flex h-9 items-center justify-between rounded-full px-4 text-[13px] font-semibold ${index === 0 ? "bg-ink text-paper" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]"}`} key={label}>{label}<span className="font-label text-[10px] uppercase tracking-[0.12em] opacity-60">Verified</span></span>)}
                </div>
                <h3 className="m-0 font-display text-[19px] font-bold leading-none tracking-[-0.03em]">Revenue, verified</h3>
                <p className="m-0 text-[13px] leading-[1.5] text-ink/65">Three providers at once on Builder projects, with three years of history.</p>
              </div>
              <div className="flex flex-col gap-3.5 rounded-[22px] bg-white p-5">
                <div className="flex h-9 items-center gap-2 rounded-full bg-[#e6e4dc] px-3 font-label text-[12px] text-ink/70">
                  <svg aria-hidden="true" className="size-3 shrink-0" viewBox="0 0 16 16"><path d="M4 7V5a4 4 0 0 1 8 0v2M3 7h10v7H3z" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>yourname.com
                </div>
                <h3 className="m-0 font-display text-[19px] font-bold leading-none tracking-[-0.03em]">Your own domain, webhooks</h3>
                <p className="m-0 text-[13px] leading-[1.5] text-ink/65">Your domain for your Setuvara, and webhooks to your own tools. In development; each joins Pro when it ships.</p>
                <span className="mt-auto"><SoonPill /></span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

type Slide = { id: string; photo?: string; face?: string };

/** Lucas's Business Mode: two photos, then two pieces of work. */
const SLIDES: Slide[] = [
  { id: "portrait", photo: "/pricing/lucas-close.webp", face: "50% 38%" },
  { id: "wide", photo: "/pricing/lucas-wide.webp", face: "52% 24%" },
  { id: "launch" },
  { id: "event" },
];

function SlideFace({ slide, small = false }: { slide: Slide; small?: boolean }) {
  if (slide.photo) return <span className="absolute inset-0 bg-cover" style={{ backgroundImage: `url(${slide.photo})`, backgroundPosition: slide.face }} />;
  if (slide.id === "launch") {
    return (
      <span className={`absolute inset-0 flex flex-col gap-3 overflow-hidden bg-coral text-ink ${small ? "" : "px-[9%] pt-[16%]"}`}>
        <MeetMark className={`absolute opacity-90 ${small ? "-bottom-[18%] -right-[22%] w-[90%]" : "-right-[14%] bottom-[20%] w-[62%]"}`} />
        {small ? null : <><Mono className="relative text-[10px]">Launch · Lisbon</Mono><span className="relative max-w-[8ch] font-display text-[clamp(28px,3vw,40px)] font-extrabold leading-[0.88] tracking-[-0.05em]">Setuvara for Teams</span></>}
      </span>
    );
  }
  return (
    <span className={`absolute inset-0 flex flex-col bg-paper text-ink ${small ? "justify-end p-[10%]" : "gap-2 px-[9%] pt-[16%]"}`}>
      {small ? <span className="font-display text-[26px] font-extrabold leading-none tracking-[-0.05em]">14</span> : (
        <>
          <Mono className="text-[10px] text-ink/60">Slush 2026 · Helsinki</Mono>
          <span className="font-display text-[clamp(72px,8vw,112px)] font-extrabold leading-[0.8] tracking-[-0.06em]">14</span>
          <span className="text-[14px] font-semibold">teams met in two days</span>
        </>
      )}
    </span>
  );
}

/** A looping slideshow with story-style progress, as Business Mode plays it. Static under reduced motion. */
function Slideshow() {
  return (
    <div aria-label="Example Pro slideshow on Business Mode" className="pro-slideshow relative aspect-[4/5] overflow-hidden rounded-[22px] bg-ink shadow-[inset_0_0_0_1px_rgba(245,244,239,.1)]" role="img">
      {SLIDES.map((slide) => <span className="pro-slide absolute inset-0" key={slide.id}><SlideFace slide={slide} /></span>)}
      <span aria-hidden="true" className="absolute inset-x-3 top-3 z-10 flex gap-1">
        {SLIDES.map((slide, index) => <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-paper/35" key={slide.id}><span className={`pro-bar pro-bar-${index + 1} block h-full origin-left bg-paper`} /></span>)}
      </span>
      <span className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 bg-[linear-gradient(transparent,rgba(13,13,13,.82))] px-4 pb-4 pt-16">
        <Mono className="text-[10px] text-[#e8d28a]">Business</Mono>
        <BadgedName className="font-display text-[clamp(24px,2.4vw,32px)] font-extrabold leading-[0.95] tracking-[-0.045em] text-paper" name="Lucas Meyer" size={20} tier="pro" />
        <span className="text-[13px] text-paper/75">Partnerships Lead · Setuvara</span>
      </span>
    </div>
  );
}
