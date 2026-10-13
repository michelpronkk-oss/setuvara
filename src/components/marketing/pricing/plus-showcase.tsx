"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

import { MemberBadge } from "@/components/app/status-badge";
import { MeetMark } from "@/components/marketing/brand";
import { PassportCover } from "@/components/passport/passport-cover";
import { QrFrame } from "@/components/profile/qr-frame";
import { PLAN_COUNTS } from "@/lib/billing/plan-copy";

import { BadgedName, H2, Lede, Mono, Pill, SECTION, SECTION_PAD, SectionHead } from "./shared";

function Equalizer({ height = 16 }: { height?: number }) {
  return (
    <div aria-hidden="true" className="flex shrink-0 items-end gap-[3px]" style={{ height }}>
      {[0, 1, 2, 3].map((i) => <span className="pricing-eq h-full w-[3px] origin-bottom rounded-sm bg-coral" key={i} style={{ animationDuration: `${0.9 + i * 0.17}s`, animationDelay: `${i * 0.12}s` }} />)}
    </div>
  );
}

const CARD = "flex min-w-0 flex-col gap-6 rounded-[28px] p-[clamp(22px,2.6vw,36px)]";

function CardFoot({ title, children, dark = false }: { title: string; children: string; dark?: boolean }) {
  return (
    <div className={`flex flex-col gap-2 border-t pt-5 ${dark ? "border-paper/15" : "border-ink/10"}`}>
      <h3 className="m-0 font-display text-[clamp(20px,1.7vw,24px)] font-bold leading-[1.05] tracking-[-0.03em]">{title}</h3>
      <p className={`m-0 max-w-[520px] text-[14px] leading-[1.5] ${dark ? "text-paper/70" : "text-ink/70"}`}>{children}</p>
    </div>
  );
}

const QR_CHOICES = [
  { style: "accent-frame", label: "Accent frame" },
  { style: "label", label: "Identity label" },
  { style: "inverse", label: "Inverse" },
  { style: "rounded", label: "Rounded" },
] as const;

export function PlusShowcase() {
  const [finish, setFinish] = useState(true);
  const [qr, setQr] = useState(1);
  const choice = QR_CHOICES[qr];

  return (
    <section aria-labelledby="plus-title" className="scroll-mt-16 bg-paper" id="plus">
      <div className={`${SECTION} ${SECTION_PAD} gap-[clamp(36px,4vw,56px)]`}>
        <SectionHead lede={<Lede>The badge, the look, the QR, the Passport. Everything people notice.</Lede>}>
          <div className="flex flex-col gap-5">
            <Mono className="flex items-center gap-2.5 tracking-[0.16em]"><MemberBadge decorative size={18} tier="plus" />Plus</Mono>
            <H2 id="plus-title">Made to be<br />remembered.</H2>
          </div>
        </SectionHead>

        <div className="flex flex-wrap gap-5">
          <article className={`${CARD} flex-[1_1_560px] bg-white`}>
            <div className="flex items-center justify-between gap-3"><Mono className="text-ink/65">01 · Plus badge</Mono><Pill className="bg-coral">Plus</Pill></div>
            <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-7 sm:grid-cols-2">
              <div className="relative flex aspect-square w-full max-w-[260px] items-center justify-center justify-self-center overflow-hidden rounded-[28px] bg-[#fff1ef]">
                <MemberBadge decorative size={150} tier="plus" />
                <Mono className="absolute bottom-3.5 left-4 text-[10px] text-[#a43d36]">12 facets · 30°</Mono>
              </div>
              <div className="flex flex-col gap-4">
                <BadgedName className="font-display text-[15px] font-bold" name="Aanya Rao" size={14} tier="plus" />
                <BadgedName className="font-display text-[22px] font-bold tracking-[-0.03em]" name="Aanya Rao" size={17} tier="plus" />
                <BadgedName className="font-display text-[38px] font-extrabold leading-none tracking-[-0.045em]" name="Aanya Rao" size={24} tier="plus" />
                <div className="inline-flex items-center gap-2.5 self-start rounded-xl bg-ink py-2.5 pl-[11px] pr-3.5 text-paper">
                  <MemberBadge decorative size={20} tier="plus" />
                  <span className="flex flex-col gap-px"><span className="text-[13px] font-semibold">Setuvara Plus</span><span className="text-[11px] text-paper/70">Plus member</span></span>
                </div>
              </div>
            </div>
            <CardFoot title="Status, not a blue tick.">Cut at the mark’s own 30°, in Signal Coral. Beside your name, everywhere.</CardFoot>
          </article>

          <article className={`${CARD} relative flex-[1_1_400px] overflow-hidden bg-ink text-paper`}>
            <div className="flex items-center justify-between gap-3"><Mono className="text-paper/65">02 · Pro status</Mono><Pill className="bg-[#d6b25e] text-ink">Pro</Pill></div>
            <div className="relative flex min-h-[240px] flex-1 items-center justify-center rounded-3xl bg-[radial-gradient(circle_at_50%_45%,#2a2418,#0d0d0d_70%)] shadow-[inset_0_0_0_1px_rgba(214,178,94,.2)]">
              <MemberBadge decorative size={150} tier="pro" />
              <Mono className="absolute bottom-3.5 left-4 text-[10px] text-[#e8d28a]">24 points · two golds</Mono>
            </div>
            <div className="flex flex-col gap-2"><h3 className="m-0 font-display text-[clamp(20px,1.7vw,24px)] font-bold leading-[1.05] tracking-[-0.03em]">Finer cut. Built for work.</h3><p className="m-0 text-[14px] leading-[1.5] text-paper/70">Two champagne layers, offset 15°.</p></div>
            <div className="grid grid-cols-2 gap-3.5 border-t border-paper/15 pt-[18px]">
              <div className="flex flex-col gap-1.5"><Mono className="text-[#e8d28a]">Membership</Mono><span className="text-[13px] leading-[1.45] text-paper/75">Comes with a plan.</span></div>
              <div className="flex flex-col gap-1.5"><Mono className="flex items-center gap-1.5 text-paper/65"><MeetMark className="size-3 text-[#e9e5da]" />Recognition</Mono><span className="text-[13px] leading-[1.45] text-paper/75">The Mark is awarded, never sold.</span></div>
            </div>
          </article>

          <article className={`${CARD} flex-[1_1_100%] bg-[#e8e2d4]`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Mono className="text-ink/65">03 · Passport · Standard vs Plus</Mono>
              <div aria-label="Passport finish" className="flex gap-1.5" role="group">
                {[{ on: false, label: "Standard" }, { on: true, label: "Member finish" }].map((item) => (
                  <button aria-pressed={finish === item.on} className={`flex h-10 items-center gap-2 rounded-full pl-2 pr-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${finish === item.on ? "bg-ink text-paper" : "bg-paper text-ink"}`} key={item.label} onClick={() => setFinish(item.on)} type="button">
                    <span className={`size-6 rounded-full shadow-[inset_0_0_0_1px_rgba(13,13,13,.15)] ${item.on ? "bg-[linear-gradient(135deg,#ff8a80,#ff5a4f_50%,#e0443a)]" : "bg-ink"}`} />{item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-7 md:grid-cols-3">
              <div className="flex w-full max-w-[300px] flex-col gap-3.5 justify-self-center rounded-3xl bg-paper p-[18px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
                <Mono className="text-ink/65">Earned on every plan</Mono>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-full shadow-[inset_0_0_0_2px_#0d0d0d]"><span className="font-display text-[12px] font-extrabold tracking-[-0.02em]">AMSTERDAM</span><span className="font-label text-[8px] tracking-[0.16em]">JUN 2026</span></div>
                  <div className="flex flex-col justify-between rounded-xl p-3 shadow-[inset_0_0_0_2px_#0d0d0d]"><span className="font-label text-[8px] tracking-[0.14em]">MILESTONE</span><span className="font-display text-[30px] font-extrabold leading-none tracking-[-0.05em]">25</span></div>
                </div>
                <span className="text-[13px] leading-[1.45] text-ink/65">Stamps and milestones, every plan.</span>
              </div>
              <div className="flex justify-center md:col-span-2">
                <div className="-rotate-3 transition-transform duration-500">
                  <PassportCover
                    connections={47}
                    handle="michel"
                    idPrefix="pricing-cover"
                    label={`Setuvara Passport cover${finish ? ", Member edition" : ""}`}
                    look="standard"
                    member={finish}
                    name="Michel Pronk"
                    serial="SV-0047"
                    since="2026"
                    stamps={12}
                    width="min(260px, 70vw)"
                  />
                </div>
              </div>
            </div>
            <CardFoot title="Stamps are earned. Plus changes how they’re worn.">The Member finish on your cover, and a stamp on your profile as flair.</CardFoot>
          </article>

          <article className={`${CARD} flex-[1_1_600px] bg-white`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Mono className="text-ink/65">04 · QR styles</Mono>
              <div aria-label="QR style" className="flex flex-wrap gap-1.5" role="group">
                {QR_CHOICES.map((item, index) => (
                  <button aria-pressed={qr === index} className={`h-9 rounded-full px-3 text-[12px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${qr === index ? "bg-ink text-paper" : "bg-paper text-ink"}`} key={item.style} onClick={() => setQr(index)} type="button">{item.label}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)] items-end gap-6 sm:grid-cols-2">
              <div className="flex flex-col items-center gap-3">
                <QrFrame accent="#FF5A4F" className="w-full max-w-[220px]" modeLabel="Personal" name="Michel" style="standard">
                  <QRCodeSVG className="h-auto w-full" fgColor="#0D0D0D" level="M" marginSize={0} size={180} title="Example QR code for setuvara.com" value="https://setuvara.com" />
                </QrFrame>
                <Mono className="text-ink/65">Free · Standard</Mono>
              </div>
              <div className="flex flex-col items-center gap-3">
                <QrFrame accent="#FF5A4F" className="w-full max-w-[240px] rotate-[1.5deg]" modeLabel="Personal" name="Meet Michel" style={choice.style}>
                  <QRCodeSVG className="h-auto w-full" fgColor="#0D0D0D" level="M" marginSize={0} size={180} title="Example QR code for setuvara.com" value="https://setuvara.com" />
                </QrFrame>
                <Mono className="text-coral">Plus · {choice.label}</Mono>
              </div>
            </div>
            <CardFoot title="Beautiful. Still scans first time.">{`${PLAN_COUNTS.qrStyles - 1} more styles in your Mode’s accent. The code stays dark on white, so every one scans.`}</CardFoot>
          </article>

          <article className={`${CARD} flex-[1_1_380px] bg-ink text-paper`}>
            <div className="flex items-center justify-between gap-3"><Mono className="text-paper/65">05 · Soundtrack</Mono><Pill className="bg-coral text-ink">Plus</Pill></div>
            <div className="flex flex-1 flex-col justify-center gap-3">
              <div className="flex items-center justify-between rounded-[14px] px-3.5 py-3 text-[13px] text-paper/70 shadow-[inset_0_0_0_1px_rgba(245,244,239,.15)]">
                <span className="flex items-center gap-2.5"><span className="rounded-full bg-paper/10 px-2.5 py-1 text-[11px] font-semibold text-paper">Sound on</span>Holocene</span>
                <Mono className="text-[10px] tracking-[0.12em]">Free · Standard</Mono>
              </div>
              <div className="flex flex-col gap-4 rounded-3xl bg-[#1a1a1a] p-4 shadow-[0_30px_60px_-30px_rgba(255,90,79,.55)]">
                <div className="flex items-center gap-3.5">
                  <div className="relative size-[84px] shrink-0 overflow-hidden rounded-[14px] bg-coral text-ink"><MeetMark className="absolute -bottom-[22px] -right-[22px] size-24" /></div>
                  <div className="flex min-w-0 flex-1 flex-col gap-[3px]"><Mono className="text-[9px] text-coral">Now playing</Mono><span className="font-display text-2xl font-bold leading-none tracking-[-0.03em]">Holocene</span><span className="text-[13px] text-paper/70">Bon Iver <span className="text-paper/40">· via Spotify</span></span></div>
                  <Equalizer height={26} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="relative h-[3px] rounded-sm bg-paper/15"><div className="absolute inset-y-0 left-0 w-[38%] rounded-sm bg-paper" /></div>
                  <div className="flex justify-between font-label text-[10px] text-paper/50"><span>2:04</span><span>5:36</span></div>
                </div>
              </div>
            </div>
            <CardFoot dark title="The mood, before the hello.">Every plan has a soundtrack. Plus unlocks its premium presentations.</CardFoot>
          </article>

        </div>
      </div>
    </section>
  );
}
