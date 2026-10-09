import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

import { MeetMark, Wordmark } from "../brand";
import { person } from "./demo";
import { Display, Label, LaterTag, Shell } from "./primitives";

export function Physical() {
  return (
    <section aria-labelledby="physical-title" className="overflow-hidden bg-ink text-paper">
      <Shell className="grid grid-cols-[minmax(0,1fr)] gap-10 py-16 sm:gap-14 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-20 lg:py-36">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3"><Label className="text-paper/60">Wallet & NFC</Label><LaterTag className="text-coral">Coming later</LaterTag></div>
          <Display className="text-[clamp(44px,6vw,100px)] leading-[0.88]"><span id="physical-title">Digital by default. <span className="text-coral">Physical when you want it.</span></span></Display>
          <p className="max-w-[30rem] text-[17px] leading-[1.5] text-paper/70">QR, link and share today. Wallet pass and NFC card next — always pointing to the latest you.</p>
        </div>

        <div aria-hidden="true" className="relative mx-auto flex min-h-[360px] w-full max-w-[560px] items-center justify-center sm:min-h-[460px]">
          <div className="reveal absolute left-0 top-4 w-[64%] max-w-[300px] rounded-[1.4rem] bg-[#1c1c1c] p-5 shadow-[0_30px_60px_-30px_rgba(0,0,0,.8)] [clip-path:polygon(0_0,calc(100%-18px)_0,100%_30px,100%_100%,0_100%)] sm:p-6">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><MeetMark className="size-6 text-coral" /><Wordmark className="text-[18px]" /></span>
              <LaterTag className="text-paper/60">Wallet</LaterTag>
            </div>
            <Label className="mt-8 !text-[9px] text-coral">Event Mode · Slush</Label>
            <p className="mt-1 font-display text-[28px] font-bold leading-none tracking-[-0.04em]">{person.name}</p>
            <p className="mt-1.5 text-[12px] text-paper/60">Partnerships · Lumen Labs</p>
            <div className="mt-6 grid place-items-center rounded-xl bg-paper p-3">
              <QRCodeSVG bgColor="transparent" fgColor="#0d0d0d" level="M" marginSize={0} size={120} value="https://setuvara.com/" />
            </div>
          </div>

          <div className="reveal absolute bottom-2 right-0 aspect-[1.586] w-[60%] max-w-[380px] sm:w-[70%] overflow-hidden rounded-[1.25rem] bg-[#141414] shadow-[inset_0_0_0_1px_rgba(245,244,239,.12),0_40px_80px_-30px_rgba(0,0,0,.9)]">
            <MeetMark className="absolute -right-[12%] -top-[18%] w-[72%] text-coral" />
            <div className="absolute left-5 top-5"><LaterTag className="text-paper/60">NFC card</LaterTag></div>
            <Wordmark className="absolute bottom-4 left-5 text-[24px] text-paper" />
            <svg className="absolute bottom-5 right-5 size-6 text-paper/50" fill="none" viewBox="0 0 24 24"><path d="M8.5 7.5a6 6 0 0 1 0 9M12 5a9.5 9.5 0 0 1 0 14M5 10a2.6 2.6 0 0 1 0 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" /></svg>
          </div>
        </div>
      </Shell>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden bg-coral">
      <MeetMark className="pointer-events-none absolute -bottom-[12%] -right-[16%] w-[min(50vw,460px)] text-ink lg:-bottom-[16%] lg:-right-[6%] lg:w-[min(44vw,680px)]" />
      <Shell className="relative flex flex-col gap-8 pb-[min(44vw,440px)] pt-24 sm:pt-32 lg:py-44">
        <Label>Create your Setuvara</Label>
        <Display className="max-w-[12ch] text-[clamp(56px,9vw,152px)] leading-[0.84]"><span id="cta-title">Meet once. Stay connected.</span></Display>
        <p className="max-w-[30rem] font-display text-[22px] font-bold leading-tight tracking-[-0.03em] sm:text-[26px]">One identity. Every version of you.</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link className="inline-flex min-h-14 items-center justify-center rounded-full bg-ink px-7 text-[16px] font-semibold text-paper transition-colors hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" href="/signup">Get Setuvara</Link>
          <Link className="inline-flex min-h-11 items-center text-[16px] font-semibold underline decoration-[1.5px] underline-offset-[6px] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" href="/login">Log in</Link>
        </div>
      </Shell>
    </section>
  );
}
