import { QRCodeSVG } from "qrcode.react";

import { MeetMark, Wordmark } from "@/components/marketing/brand";

import { H2, Lede, Mono, PlusInkBadge, SECTION, SECTION_PAD, SectionHead, SoonPill } from "./shared";

function Status({ live }: { live: boolean }) {
  return live
    ? <span className="flex items-center gap-2 font-label text-[10px] tracking-[0.12em] text-lime"><span className="size-[7px] rounded-full bg-lime" />LIVE</span>
    : <span className="flex items-center gap-2 font-label text-[10px] tracking-[0.12em] text-paper/60"><span className="size-[7px] rounded-full bg-paper/40" />SOON</span>;
}

function PassQr() {
  return <QRCodeSVG aria-hidden="true" className="block h-auto w-full" fgColor="#0D0D0D" level="M" marginSize={0} size={120} value="https://setuvara.com" />;
}

export function Tap() {
  return (
    <section aria-labelledby="tap-title" className="scroll-mt-16 bg-paper" id="tap">
      <div className={`${SECTION} ${SECTION_PAD} gap-[clamp(36px,4vw,56px)]`}>
        <SectionHead lede={<Lede>Equip a Mode once. Quick QR follows today, your card and Wallet pass when they launch.</Lede>}>
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3"><Mono className="text-coral">Setuvara Tap</Mono><SoonPill>Card and Wallet coming soon</SoonPill></div>
            <H2 id="tap-title">Your identity,<br />off the screen.</H2>
          </div>
        </SectionHead>

        <div className="flex flex-wrap gap-5">
          <article className="flex min-w-0 flex-[1_1_320px] flex-col gap-[18px] rounded-[28px] bg-ink p-[clamp(24px,3vw,36px)] text-paper">
            <Mono className="flex items-center gap-2 text-lime"><span className="size-2 rounded-full bg-lime" />Equipped</Mono>
            <div className="flex flex-col gap-1.5"><span className="font-display text-[clamp(40px,4vw,52px)] font-extrabold leading-[0.88] tracking-[-0.055em]">Personal</span><span className="text-lg font-semibold text-coral">Connect in person</span></div>
            <div className="mt-auto flex flex-col">
              {[["Quick QR", true], ["NFC card", false], ["Wallet pass", false]].map(([label, live]) => (
                <div className="flex items-center justify-between border-t border-paper/10 py-3 text-[15px] font-semibold" key={label as string}><span>{label}</span><Status live={live as boolean} /></div>
              ))}
            </div>
            <span className="text-[13px] text-paper/60">Change it once. Everything follows.</span>
          </article>

          <article className="flex min-w-0 flex-[1_1_420px] flex-col gap-6 rounded-[28px] bg-[#e6e4dc] p-[clamp(24px,3vw,36px)]">
            <Mono className="text-ink/65">NFC card · Concept</Mono>
            <div className="flex min-h-[240px] flex-1 items-center justify-center">
              <div className="relative aspect-[1.586] w-[min(360px,100%)] -rotate-[4deg] overflow-hidden rounded-[20px] bg-ink shadow-[0_36px_50px_-26px_rgba(13,13,13,.7),inset_0_0_0_1px_rgba(245,244,239,.12)]">
                <MeetMark className="absolute -right-[16%] -top-[22%] w-4/5 text-paper opacity-5" />
                <MeetMark className="absolute left-[22px] top-5 size-[30px] text-coral" />
                <svg aria-hidden="true" className="absolute bottom-[18px] right-5 size-[34px] text-paper opacity-55" viewBox="0 0 40 40"><path d="M14 12a12 12 0 0 1 0 16M20 8a18 18 0 0 1 0 24M26 4a24 24 0 0 1 0 32" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" /></svg>
                <span className="absolute bottom-5 left-[22px] font-label text-[10px] tracking-[0.24em] text-paper/50">TAP</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5"><h3 className="m-0 font-display text-[clamp(20px,1.7vw,24px)] font-bold leading-[1.05] tracking-[-0.03em]">Nothing printed but the mark.</h3><p className="m-0 text-[14px] leading-[1.5] text-ink/65">Tap a phone. Your Mode opens.</p></div>
          </article>

          <article className="flex min-w-0 flex-[1_1_420px] flex-col gap-6 rounded-[28px] bg-white p-[clamp(24px,3vw,36px)]">
            <Mono className="text-ink/65">Wallet pass · Standard vs Plus</Mono>
            <div className="grid grid-cols-2 items-end gap-3.5">
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-3 rounded-[18px] bg-paper p-3.5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]">
                  <div className="flex items-center gap-1.5"><MeetMark className="size-4" /><Wordmark className="text-sm" /></div>
                  <div className="flex flex-col gap-0.5"><Mono className="text-[8px] text-ink/65">Personal</Mono><span className="font-display text-lg font-bold leading-none tracking-[-0.03em]">Aanya Rao</span></div>
                  <div className="rounded-[10px] bg-white p-2"><PassQr /></div>
                </div>
                <Mono className="text-[10px] tracking-[0.12em] text-ink/65">Free · Core pass</Mono>
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="relative flex flex-col gap-3 overflow-hidden rounded-[18px] bg-coral p-3.5 shadow-[0_24px_40px_-24px_#ff5a4f]">
                  <MeetMark className="absolute -right-[30px] -top-6 size-[110px] text-ink opacity-10" />
                  <div className="relative flex items-center gap-1.5"><MeetMark className="size-4" /><Mono className="text-[8px]">Connect in person</Mono></div>
                  <div className="relative flex flex-col gap-0.5"><Mono className="text-[8px]">Personal</Mono><span className="whitespace-nowrap font-display text-lg font-extrabold leading-none tracking-[-0.03em]">Aanya Rao <PlusInkBadge size={13} /></span></div>
                  <div className="relative rounded-[10px] bg-paper p-2"><PassQr /></div>
                </div>
                <Mono className="text-[10px] tracking-[0.12em] text-coral">Plus · Premium pass</Mono>
              </div>
            </div>
            <div className="flex flex-col gap-1.5"><h3 className="m-0 font-display text-[clamp(20px,1.7vw,24px)] font-bold leading-[1.05] tracking-[-0.03em]">Free pass. Plus makes it premium.</h3><p className="m-0 text-[14px] leading-[1.5] text-ink/65">Same equipped Mode as your Quick QR.</p></div>
          </article>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] border-t-[1.5px] border-ink md:grid-cols-3">
          {[
            { tag: "Free", tone: "text-ink/65", line: "Quick QR today. Core card and pass at launch." },
            { tag: "Plus", tone: "text-coral", line: "A premium pass look, at launch." },
            { tag: "Pro", tone: "text-[#a8843a]", line: "Tap and device insights, live now." },
          ].map((item) => <div className="flex flex-col gap-1.5 pr-6 pt-[22px]" key={item.tag}><Mono className={item.tone}>{item.tag}</Mono><span className="text-[14px] leading-[1.45] text-ink/75">{item.line}</span></div>)}
        </div>
      </div>
    </section>
  );
}
