import type { ReactNode } from "react";

import { MeetMark } from "@/components/marketing/brand";

import { BadgedName, H2, Lede, Mono, Portrait, SECTION, SECTION_PAD, SectionHead } from "./shared";

function Phone({ children, className = "", screen = "bg-paper", height }: { children: ReactNode; className?: string; screen?: string; height: string }) {
  return (
    <div className={`box-border w-full max-w-[320px] rounded-[44px] bg-ink p-2 ${className}`} style={{ height }}>
      <div className={`flex h-full flex-col overflow-hidden rounded-[36px] ${screen}`}>{children}</div>
    </div>
  );
}

function Caption({ tag, line, tone }: { tag: string; line: string; tone: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <Mono className={tone}>{tag}</Mono>
      <span className="text-[15px] font-semibold">{line}</span>
    </div>
  );
}

function Equalizer({ height = 16 }: { height?: number }) {
  return (
    <div aria-hidden="true" className="flex shrink-0 items-end gap-[3px]" style={{ height }}>
      {[0, 1, 2, 3].map((i) => <span className="pricing-eq h-full w-[3px] origin-bottom rounded-sm bg-coral" key={i} style={{ animationDuration: `${0.9 + i * 0.17}s`, animationDelay: `${i * 0.12}s` }} />)}
    </div>
  );
}

export { Equalizer };

export function SameYou() {
  return (
    <section aria-labelledby="same-you" className="bg-white">
      <div className={`${SECTION} ${SECTION_PAD} gap-[clamp(40px,5vw,72px)]`}>
        <SectionHead lede={<Lede>Free gives you a complete identity. Plus changes how it looks and how it’s received. Pro shows you, in depth, what it does for you.</Lede>}>
          <H2 id="same-you">Same you.<br />More presence.</H2>
        </SectionHead>

        <div className="grid grid-cols-[minmax(0,1fr)] items-end gap-6 md:grid-cols-3">
          <div className="flex flex-col items-center gap-[18px]">
            <Phone height="620px">
              <div className="flex h-full flex-col gap-4 px-5 pb-4 pt-[18px]">
                <div className="flex justify-between text-[12px] font-semibold"><span>9:41</span><span className="font-label text-[10px] text-ink/60">setuvara.com/michel</span></div>
                <div className="mt-1.5 flex items-end gap-3.5">
                  <Portrait className="h-[120px] w-24 shrink-0 rounded-[14px]" />
                  <div className="flex flex-col gap-1"><span className="font-display text-[28px] font-bold leading-[0.95] tracking-[-0.04em]">Michel Pronk</span><span className="text-[12px] text-ink/70">Creative Director · Atelier Nord</span></div>
                </div>
                <span className="flex h-11 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper">Connect</span>
                <div className="flex flex-col gap-2">
                  {["Instagram", "Portfolio"].map((label) => <span className="rounded-[14px] bg-white px-3.5 py-3 text-[13px] font-semibold" key={label}>{label}</span>)}
                  <span className="flex justify-between rounded-[14px] bg-white px-3.5 py-3 text-[13px] font-semibold">Soundtrack<span className="font-medium text-ink/60">Sound on</span></span>
                </div>
                <span className="mt-auto flex items-center justify-center gap-1.5 text-[11px] text-ink/60"><MeetMark className="size-3" />Made with Setuvara</span>
              </div>
            </Phone>
            <Caption line="Complete, clear, ready to share." tag="Free · Clean Appearance" tone="text-ink/65" />
          </div>

          <div className="flex flex-col items-center gap-[18px]">
            <Phone className="shadow-[0_30px_60px_-30px_#ff5a4f]" height="660px">
              <div className="relative h-[300px] shrink-0 [clip-path:polygon(0_0,100%_0,100%_calc(100%-44px),calc(100%-26px)_100%,0_100%)]">
                <Portrait className="absolute inset-0" who="studio" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/0 via-55% to-ink/0" />
                <div className="absolute inset-x-[18px] top-4 flex justify-between text-[12px] font-semibold text-paper"><span>9:41</span><Mono className="text-[10px] tracking-[0.12em]">Personal</Mono></div>
                <div className="absolute bottom-5 left-[18px] flex flex-col gap-1 text-paper">
                  <BadgedName className="font-display text-[34px] font-extrabold leading-[0.92] tracking-[-0.05em]" name="Michel Pronk" size={20} tier="plus" />
                  <span className="text-[12px] text-paper/80">Creative Director · Lyon</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 px-[18px] pb-[18px] pt-3.5">
                <div className="flex items-center gap-3 rounded-2xl bg-ink p-2.5 text-paper">
                  <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[10px] bg-coral text-ink"><MeetMark className="size-[22px]" /></div>
                  <div className="flex min-w-0 flex-1 flex-col"><span className="text-[13px] font-semibold">Holocene</span><span className="text-[11px] text-paper/65">Bon Iver</span></div>
                  <Equalizer />
                </div>
                <div className="flex gap-2">
                  <span className="flex h-11 flex-1 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper">Connect</span>
                  <span className="flex h-11 flex-1 items-center justify-center rounded-full text-sm font-semibold shadow-[inset_0_0_0_1.5px_#0d0d0d]">Save</span>
                </div>
                <div className="flex flex-col border-t-[1.5px] border-ink">
                  <span className="flex justify-between border-b border-ink/10 px-0.5 py-[11px] text-[13px] font-semibold">Instagram<span className="text-coral">↗</span></span>
                  <span className="flex justify-between px-0.5 py-[11px] text-[13px] font-semibold">Portfolio<span className="text-coral">↗</span></span>
                </div>
              </div>
            </Phone>
            <Caption line="Plus badge, premium look, no attribution." tag="Plus · Premium Appearance" tone="text-coral" />
          </div>

          <div className="flex flex-col items-center gap-[18px]">
            <Phone className="shadow-[inset_0_0_0_1px_rgba(214,178,94,.33)]" height="620px" screen="bg-ink text-paper shadow-[inset_0_0_0_1px_rgba(245,244,239,.08)]">
              <div className="flex h-full flex-col gap-3.5 px-[18px] py-4">
                <div className="flex justify-between text-[12px] font-semibold"><span>9:41</span><span className="font-label text-[10px] text-paper/60">setuvara.com/michel</span></div>
                <div className="relative mt-1">
                  <Portrait className="h-[180px] w-full rounded-[18px] [clip-path:polygon(0_0,100%_0,100%_calc(100%-32px),calc(100%-18px)_100%,0_100%)]" />
                  <div aria-hidden="true" className="absolute inset-x-0 top-2.5 flex justify-center gap-1">
                    {[0, 1, 2, 3].map((i) => <span className={`h-[3px] w-6 rounded-full ${i === 0 ? "bg-ink" : "bg-ink/25"}`} key={i} />)}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Mono className="text-[9px] text-[#e8d28a]">Business</Mono>
                  <BadgedName className="font-display text-[28px] font-bold leading-[0.95] tracking-[-0.04em]" name="Michel Pronk" size={18} tier="pro" />
                  <span className="text-[12px] text-paper/70">Founder · Atelier Nord</span>
                </div>
                <div className="flex gap-2">
                  <span className="flex h-[46px] flex-1 items-center justify-center rounded-full bg-[#d6b25e] text-sm font-semibold text-ink">Connect</span>
                  <span className="flex h-[46px] flex-1 items-center justify-center rounded-full text-sm font-semibold shadow-[inset_0_0_0_1px_rgba(245,244,239,.3)]">Save</span>
                </div>
                <div className="mt-auto grid grid-cols-2 gap-2">
                  {["Case studies", "LinkedIn", "Portfolio", "Email"].map((label) => <span className="rounded-xl bg-[#1a1a1a] px-3 py-[11px] text-[12px] font-semibold" key={label}>{label}</span>)}
                </div>
              </div>
            </Phone>
            <Caption line="Pro badge, four-photo slideshow, deep numbers." tag="Pro · Business Mode" tone="text-[#a8843a]" />
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] border-t-[1.5px] border-ink sm:grid-cols-2 lg:grid-cols-4">
          {[
            { tag: "Identity", tone: "text-ink/65", line: "Every Mode, profile and Connection. Free." },
            { tag: "Status & expression", tone: "text-coral", line: "Badge, Appearances, QR and Passport finish. Plus." },
            { tag: "Insight", tone: "text-coral", line: "Sources, Modes and conversion over 30 or 90 days. Plus." },
            { tag: "Depth", tone: "text-[#a8843a]", line: "Custom ranges, funnel, devices and CSV. Pro." },
          ].map((item) => (
            <div className="flex flex-col gap-1.5 pr-6 pt-[22px]" key={item.tag}><Mono className={item.tone}>{item.tag}</Mono><span className="text-[15px] leading-[1.45]">{item.line}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}
