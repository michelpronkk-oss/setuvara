import { QRCodeSVG } from "qrcode.react";

import { MeetMark, MeetMarkJoin } from "../brand";
import { person } from "./demo";
import { Display, Label, LaterTag, Shell } from "./primitives";

// The QR codes on this page are real and scannable. They open setuvara.com.
const qrValue = "https://setuvara.com/";

const channels = [
  { name: "QR code", detail: "Opens the Mode you’re sharing", live: true },
  { name: "Link", detail: "setuvara.com/you?mode=event", live: true },
  { name: "Native share", detail: "Messages, AirDrop, any app", live: true },
  { name: "Wallet pass", detail: "Your Setuvara in Apple and Google Wallet", live: false },
  { name: "NFC", detail: "Tap a phone or card to share", live: false },
];

function ShareQr({ size, label }: { size: number; label: string }) {
  return (
    <div className="relative grid place-items-center">
      <QRCodeSVG aria-label={label} bgColor="transparent" fgColor="#0d0d0d" level="Q" marginSize={0} role="img" size={size} value={qrValue} />
      <span aria-hidden="true" className="absolute grid size-11 place-items-center rounded-xl bg-coral text-ink shadow-[0_0_0_5px_#f5f4ef]"><MeetMark className="size-7" /></span>
    </div>
  );
}

export function Share() {
  return (
    <section aria-labelledby="share-title" className="scroll-mt-16" id="share">
      <Shell className="grid grid-cols-[minmax(0,1fr)] gap-10 py-16 sm:gap-12 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-20 lg:py-36">
        <div className="order-2 flex justify-center lg:order-1">
          <div className="reveal w-full max-w-[380px] rounded-[2rem] bg-ink p-5 text-paper sm:p-6">
            <div className="flex items-center justify-between">
              <Label className="text-paper/60">Share</Label>
              <Label className="text-coral">Event · Slush</Label>
            </div>
            <div aria-hidden="true" className="mt-5 grid grid-cols-3 rounded-full bg-white/10 p-1 text-center text-[12px] font-semibold">
              <span className="rounded-full py-2 text-paper/60">Personal</span>
              <span className="rounded-full bg-paper py-2 text-ink">Event</span>
              <span className="rounded-full py-2 text-paper/60">Business</span>
            </div>
            <div className="mt-5 rounded-[1.5rem] bg-paper p-6">
              <span className="sm:hidden"><ShareQr label="QR code that opens setuvara.com" size={176} /></span><span className="hidden sm:block"><ShareQr label="QR code that opens setuvara.com" size={232} /></span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3">
              <span className="truncate font-label text-[12px] text-paper/80">setuvara.com/{person.username}?mode=event</span>
              <span className="shrink-0 text-[12px] font-semibold text-coral">Copy</span>
            </div>
            <div className="mt-3 flex h-12 items-center justify-center rounded-full bg-coral text-[14px] font-semibold text-ink">Share Event Mode</div>
          </div>
        </div>

        <div className="order-1 flex flex-col gap-8 lg:order-2">
          <div className="flex flex-col gap-5">
            <Label className="text-coral">Share</Label>
            <Display className="text-[clamp(44px,5.6vw,88px)] leading-[0.9]"><span id="share-title">The right version, instantly.</span></Display>
            <p className="max-w-[32rem] text-[17px] leading-[1.5] text-ink/70 sm:text-[19px]">Pick a Mode. Share it. They see only that version.</p>
          </div>
          <ul className="border-t border-ink/15">
            {channels.map((channel) => (
              <li className={`flex items-center justify-between gap-4 border-b border-ink/15 py-3 sm:py-4 ${channel.live ? "" : "text-ink/55"}`} key={channel.name}>
                <span className="min-w-0">
                  <span className="block text-[17px] font-semibold text-current">{channel.name}</span>
                  <span className="mt-0.5 hidden truncate text-[13px] text-ink/55 sm:block">{channel.detail}</span>
                </span>
                {channel.live ? <span className="inline-flex shrink-0 items-center gap-1.5 font-label text-[10px] uppercase tracking-[0.14em] text-ink"><span aria-hidden="true" className="size-1.5 rounded-full bg-coral" />Live</span> : <LaterTag className="shrink-0" />}
              </li>
            ))}
          </ul>
        </div>
      </Shell>
    </section>
  );
}

export function MeetConnect() {
  return (
    <section aria-labelledby="how-title" className="scroll-mt-16 bg-ink text-paper" id="how">
      <Shell className="flex flex-col gap-10 py-16 sm:gap-14 sm:py-28 lg:gap-20 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end">
          <Display className="text-[clamp(56px,8.4vw,136px)] leading-[0.84]"><span id="how-title">Meet.<br /><span className="text-coral">Connect.</span><br />Remember.</span></Display>
          <p className="max-w-[30rem] text-[17px] leading-[1.5] text-paper/70 sm:text-[19px]">Scan. Tap. Saved — with where and when.</p>
        </div>

        <ol className="grid gap-10 lg:grid-cols-3 lg:gap-8">
          <li className="reveal flex flex-col gap-4">
            <Label className="text-paper/55"><span className="text-coral">01</span> · Aanya opens Share</Label>
            <div className="flex flex-1 items-center gap-5 rounded-[1.75rem] bg-[#1a1a1a] p-5 lg:flex-col lg:items-stretch">
              <div className="grid shrink-0 place-items-center rounded-[1.25rem] bg-paper p-3 lg:order-2 lg:p-5">
                <span className="lg:hidden"><ShareQr label="QR code that opens setuvara.com" size={104} /></span>
                <span className="hidden lg:block"><ShareQr label="QR code that opens setuvara.com" size={172} /></span>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5 lg:order-1 lg:flex-row lg:items-center lg:justify-between">
                <span className="font-display text-[22px] font-bold tracking-[-0.04em]">{person.name}</span>
                <Label className="!text-[10px] text-coral">Event Mode</Label>
              </div>
              <p className="hidden text-center text-[13px] text-paper/60 lg:order-3 lg:block">Scan the QR or open the link</p>
            </div>
          </li>

          <li className="reveal flex flex-col gap-4">
            <Label className="text-paper/55"><span className="text-coral">02</span> · Lena connects as a guest</Label>
            <div className="flex flex-1 flex-col overflow-hidden rounded-[1.75rem] bg-paper text-ink">
              <div className="bg-coral px-5 pb-6 pt-5 [clip-path:polygon(0_0,100%_0,100%_calc(100%-22px),calc(100%-13px)_100%,0_100%)]">
                <Label className="!text-[10px]">Event Mode</Label>
                <p className="mt-1 font-display text-[34px] font-extrabold leading-[0.95] tracking-[-0.05em]">{person.name}</p>
                <p className="mt-1 text-[13px] font-medium">Partnerships · Lumen Labs · Slush</p>
              </div>
              <div aria-hidden="true" className="flex flex-1 flex-col gap-3 p-5">
                <Label className="!text-[10px] text-ink/50">Connect with {person.username}</Label>
                <div className="rounded-xl border border-ink/15 bg-white px-4 py-2.5"><span className="block text-[11px] text-ink/50">Name</span><span className="text-[14px] font-medium">Lena Fischer</span></div>
                <div className="rounded-xl border border-ink/15 bg-white px-4 py-2.5"><span className="block text-[11px] text-ink/50">Email</span><span className="text-[14px] font-medium">lena@ateliernord.studio</span></div>
                <span className="mt-1 flex h-12 items-center justify-center rounded-full bg-coral text-[14px] font-semibold">Connect</span>
                <p className="text-center text-[11px] leading-5 text-ink/55">No signup needed. You can claim your Setuvara after connecting.</p>
              </div>
            </div>
          </li>

          <li className="reveal flex flex-col gap-4">
            <Label className="text-paper/55"><span className="text-coral">03</span> · Saved with context</Label>
            <div className="flex flex-1 flex-col gap-6 rounded-[1.75rem] bg-coral p-6 text-ink">
              <MeetMarkJoin className="size-16" />
              <div>
                <p className="font-display text-[34px] font-extrabold leading-[0.95] tracking-[-0.045em]">You’re connected.</p>
                <p className="mt-2 text-[14px] font-medium">Remembered for both of you.</p>
              </div>
              <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 border-t-[1.5px] border-ink pt-4 text-[14px]">
                <dt className="font-label text-[11px] uppercase tracking-[0.12em] leading-5">Event</dt><dd className="font-semibold">Slush</dd>
                <dt className="font-label text-[11px] uppercase tracking-[0.12em] leading-5">City</dt><dd className="font-semibold">Helsinki</dd>
                <dt className="font-label text-[11px] uppercase tracking-[0.12em] leading-5">Mode</dt><dd className="font-semibold">Event</dd>
                <dt className="font-label text-[11px] uppercase tracking-[0.12em] leading-5">When</dt><dd className="font-semibold">19 Nov 2025 · 14:32</dd>
              </dl>
            </div>
          </li>
        </ol>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 border-t border-paper/15 pt-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
          <p className="font-display text-[clamp(30px,3.6vw,52px)] font-bold leading-[1] tracking-[-0.045em]">They don’t need an&nbsp;account.</p>
          <p className="text-[16px] leading-[1.5] text-paper/70 sm:text-[17px]">Guests connect with a name and email. If they join later, the connection is already waiting.</p>
        </div>
      </Shell>
    </section>
  );
}
