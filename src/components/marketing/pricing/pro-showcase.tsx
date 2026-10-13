import { MemberBadge } from "@/components/app/status-badge";
import { MeetMark } from "@/components/marketing/brand";
import { PLAN_COUNTS } from "@/lib/billing/plan-copy";

import { BadgedName, Lede, Mono, Portrait, SECTION, SECTION_PAD, SectionHead, SoonPill } from "./shared";

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
            <div className="overflow-hidden rounded-[20px] bg-paper text-ink">
              <div className="grid grid-cols-4 gap-1.5 p-3">
                {(["michel", "studio", "aanya", "michel"] as const).map((who, index) => (
                  <div className="relative" key={index}>
                    <Portrait className={`aspect-[3/4] w-full rounded-xl ${index === 3 ? "grayscale" : ""}`} who={who} />
                    <Mono className="absolute left-2 top-2 rounded-full bg-paper/90 px-1.5 py-0.5 text-[9px]">{index + 1}</Mono>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-x-5 gap-y-1.5 px-[clamp(16px,2.4vw,24px)] pb-5 pt-2">
                <div className="flex min-w-[180px] flex-1 flex-col gap-1.5"><Mono className="text-[10px] text-[#a8843a]">Business Mode</Mono><BadgedName className="font-display text-[clamp(28px,3vw,40px)] font-extrabold leading-[0.95] tracking-[-0.045em]" name="Michel Pronk" size={22} tier="pro" /><span className="text-sm text-ink/70">Brand systems for ambitious companies.</span></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1 rounded-[14px] px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(245,244,239,.15)]"><Mono className="text-[10px] tracking-[0.12em] text-paper/65">Plus</Mono><span className="text-[13px]">{PLAN_COUNTS.plusSlides} photos</span></div>
              <div className="flex flex-col gap-1 rounded-[14px] bg-[#d6b25e] px-3.5 py-3 text-ink"><Mono className="text-[10px] tracking-[0.12em]">Pro</Mono><span className="text-[13px] font-semibold">{PLAN_COUNTS.proSlides} photos</span></div>
            </div>
            <div className="flex flex-col gap-2 border-t border-paper/15 pt-5"><h3 className="m-0 font-display text-[clamp(20px,1.7vw,24px)] font-bold leading-[1.05] tracking-[-0.03em]">Show the work, not just the face.</h3><p className="m-0 text-[14px] leading-[1.5] text-paper/70">{`${PLAN_COUNTS.proSlides} photos per Mode, at your pace.`}</p></div>
          </article>

          <article className={`${CARD} flex-[1_1_480px] bg-[#1a1a1a]`}>
            <Mono className="text-paper/65">08 · Your numbers, your files</Mono>
            <div className="flex flex-col overflow-hidden rounded-3xl bg-ink shadow-[inset_0_0_0_1px_rgba(245,244,239,.1)]">
              <div className="flex items-center justify-between gap-3 border-b border-paper/10 px-[18px] py-3.5"><span className="truncate font-label text-[12px]">setuvara-analytics-2026-10-07-2026-10-10.csv</span><Mono className="text-[9px] text-[#e8d28a]">CSV</Mono></div>
              <div className="grid grid-cols-[1.3fr_1.2fr_1fr_1.1fr] gap-x-3 overflow-hidden px-[18px] py-3 font-label text-[11px] leading-6 text-paper/80">
                {["date", "profile_views", "qr_scans", "connections", "2026-10-07", "64", "18", "3", "2026-10-08", "71", "22", "4", "2026-10-09", "58", "15", "2", "2026-10-10", "93", "31", "6"].map((cell, index) => <span className={`truncate ${index < 4 ? "text-paper/50" : ""}`} key={index}>{cell}</span>)}
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-2">
              <div className="flex flex-col gap-1 rounded-[14px] px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(245,244,239,.15)]"><Mono className="text-[10px] tracking-[0.12em] text-paper/65">Custom range</Mono><span className="text-[13px]">Any period, up to two years</span></div>
              <div className="flex flex-col gap-1 rounded-[14px] px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(245,244,239,.15)]"><Mono className="text-[10px] tracking-[0.12em] text-paper/65">Devices</Mono><span className="text-[13px]">Phone, desktop and tablet</span></div>
            </div>
            <div className="flex flex-col gap-2 border-t border-paper/15 pt-5"><h3 className="m-0 font-display text-[clamp(20px,1.7vw,24px)] font-bold leading-[1.05] tracking-[-0.03em]">Take the numbers with you.</h3><p className="m-0 text-[14px] leading-[1.5] text-paper/70">Any period, as CSV.</p></div>
          </article>

          <article className={`${CARD} flex-[1_1_100%] bg-paper text-ink`}>
            <div className="flex flex-wrap items-center justify-between gap-3"><Mono className="text-ink/65">09 · Next for Pro</Mono><SoonPill>In development</SoonPill></div>
            <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-5 md:grid-cols-3">
              <div className="flex flex-col gap-3.5 rounded-[22px] bg-white p-5">
                <div className="flex h-9 items-center gap-2 rounded-full bg-[#e6e4dc] px-3 font-label text-[12px] text-ink/70">
                  <svg aria-hidden="true" className="size-3 shrink-0" viewBox="0 0 16 16"><path d="M4 7V5a4 4 0 0 1 8 0v2M3 7h10v7H3z" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>michelpronk.com
                </div>
                <h3 className="m-0 font-display text-[19px] font-bold leading-none tracking-[-0.03em]">Your own domain</h3>
                <p className="m-0 text-[13px] leading-[1.5] text-ink/65">Your domain, your Setuvara.</p>
                <span className="mt-auto"><SoonPill /></span>
              </div>
              <div className="flex flex-col gap-3.5 rounded-[22px] bg-white p-5">
                <div className="flex flex-col gap-1.5">
                  {["Request an intro", "RSVP", "Book a call"].map((label, index) => <span className={`flex h-9 items-center rounded-full px-4 text-[13px] font-semibold ${index === 0 ? "bg-ink text-paper" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]"}`} key={label}>{label}</span>)}
                </div>
                <h3 className="m-0 font-display text-[19px] font-bold leading-none tracking-[-0.03em]">Advanced actions</h3>
                <p className="m-0 text-[13px] leading-[1.5] text-ink/65">A main button that does more, per Mode.</p>
                <span className="mt-auto"><SoonPill /></span>
              </div>
              <div className="flex flex-col gap-3.5 rounded-[22px] bg-white p-5">
                <div className="flex flex-col gap-1.5">
                  {[["Lead capture", "Structured, with source"], ["Webhooks", "Send to your tools"], ["Integrations", "CRM and calendar"]].map(([title, line]) => (
                    <span className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]" key={title}><span className="text-[13px] font-semibold">{title}</span><span className="text-[12px] text-ink/60">{line}</span></span>
                  ))}
                </div>
                <h3 className="m-0 font-display text-[19px] font-bold leading-none tracking-[-0.03em]">Leads and integrations</h3>
                <p className="m-0 text-[13px] leading-[1.5] text-ink/65">Only for actions you set up.</p>
                <span className="mt-auto"><SoonPill /></span>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-ink/15 pt-5"><h3 className="m-0 flex items-center gap-2 font-display text-[clamp(20px,1.7vw,24px)] font-bold leading-[1.05] tracking-[-0.03em]"><MeetMark className="size-5 text-[#a8843a]" />Coming to Pro.</h3><p className="m-0 max-w-[560px] text-[14px] leading-[1.5] text-ink/65">Not part of Pro today. Each one joins when it ships.</p></div>
          </article>
        </div>
      </div>
    </section>
  );
}
