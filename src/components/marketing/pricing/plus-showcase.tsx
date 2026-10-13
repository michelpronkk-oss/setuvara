"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState, type ReactNode } from "react";

import { MemberBadge } from "@/components/app/status-badge";
import { MeetMark } from "@/components/marketing/brand";
import { PassportCover } from "@/components/passport/passport-cover";
import { QrFrame } from "@/components/profile/qr-frame";
import { PLAN_COUNTS } from "@/lib/billing/plan-copy";

import { Equalizer } from "./same-you";
import { BadgedName, H2, Lede, Mono, Pill, Portrait, SECTION, SECTION_PAD, SectionHead } from "./shared";

const CARD = "flex min-w-0 flex-col gap-7 rounded-[32px] p-[clamp(24px,3vw,40px)]";

function CardFoot({ title, children, dark = false }: { title: string; children: string; dark?: boolean }) {
  return (
    <div className={`flex flex-col gap-2 border-t pt-5 ${dark ? "border-paper/15" : "border-ink/10"}`}>
      <h3 className="m-0 font-display text-[30px] font-bold leading-none tracking-[-0.035em]">{title}</h3>
      <p className={`m-0 max-w-[640px] text-[15px] leading-[1.5] ${dark ? "text-paper/70" : "text-ink/70"}`}>{children}</p>
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
        <SectionHead lede={<Lede>Plus is everything people notice when they open your Setuvara, and a clear view of how they use it. The badge, the look, the QR they scan, the Passport you carry.</Lede>}>
          <div className="flex flex-col gap-5">
            <Mono className="flex items-center gap-2.5 text-[12px] tracking-[0.16em]"><MemberBadge decorative size={20} tier="plus" />What you get with Plus</Mono>
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
            <CardFoot title="A badge that’s yours, not a blue tick.">Premium Setuvara status, cut from the same 30° angle as the mark in Signal Coral. It shows you’re a Plus member, not that anyone checked an ID. It sits next to your name on your profile and on your home.</CardFoot>
          </article>

          <article className={`${CARD} relative flex-[1_1_400px] overflow-hidden bg-ink text-paper`}>
            <div className="flex items-center justify-between gap-3"><Mono className="text-paper/65">02 · Pro status</Mono><Pill className="bg-[#d6b25e] text-ink">Pro</Pill></div>
            <div className="relative flex min-h-[240px] flex-1 items-center justify-center rounded-3xl bg-[radial-gradient(circle_at_50%_45%,#2a2418,#0d0d0d_70%)] shadow-[inset_0_0_0_1px_rgba(214,178,94,.2)]">
              <MemberBadge decorative size={150} tier="pro" />
              <Mono className="absolute bottom-3.5 left-4 text-[10px] text-[#e8d28a]">24 points · two golds</Mono>
            </div>
            <div className="flex flex-col gap-2"><h3 className="m-0 font-display text-[30px] font-bold leading-none tracking-[-0.035em]">Finer cut. Built for work.</h3><p className="m-0 text-[15px] leading-[1.5] text-paper/70">Two champagne layers offset by 15°, for people who use Setuvara professionally. Richer at 16 px without getting louder.</p></div>
            <div className="grid grid-cols-2 gap-3.5 border-t border-paper/15 pt-[18px]">
              <div className="flex flex-col gap-1.5"><Mono className="text-[#e8d28a]">Membership</Mono><span className="text-[13px] leading-[1.45] text-paper/80">Plus and Pro badges come with a plan.</span></div>
              <div className="flex flex-col gap-1.5"><Mono className="flex items-center gap-1.5 text-paper/65"><MeetMark className="size-3 text-[#e9e5da]" />Recognition</Mono><span className="text-[13px] leading-[1.45] text-paper/80">The Setuvara Mark is awarded, never sold.</span></div>
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
                <span className="text-[13px] leading-[1.45] text-ink/70">Every stamp, milestone and earned cover, on every plan.</span>
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
            <CardFoot title="Stamps are earned. Plus changes how they’re worn.">Every stamp still comes from people you actually met. Plus adds the Member finish to your cover and lets you feature an earned stamp on your profile as flair. Pro has the same finish. Downgrade, and your stamps stay yours.</CardFoot>
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
            <CardFoot title="Beautiful, and still scans first time.">{`${PLAN_COUNTS.qrStyles - 1} more styles in your Mode’s accent: a frame, an identity label, inverse or rounded. The code itself always stays dark on a white field with its quiet zone, so every style scans. Pro has the same styles.`}</CardFoot>
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
            <CardFoot dark title="The mood, before the hello.">Free keeps your soundtrack. Plus unlocks its presentation styles and the member treatment on the sound controls. It plays only when visitors choose sound on.</CardFoot>
          </article>

          <article className={`${CARD} flex-[1_1_100%] bg-white`}>
            <div className="flex items-center justify-between gap-3"><Mono className="text-ink/65">06 · Appearances</Mono><Pill className="bg-coral">Plus</Pill></div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Look name="Clean" tag="Free">
                <div className="box-border flex h-full flex-col gap-2.5 bg-paper p-4">
                  <div className="flex items-end gap-2.5"><Portrait className="h-16 w-[52px] rounded-[10px]" /><div className="flex flex-1 flex-col gap-[5px]"><div className="h-2.5 w-4/5 rounded-[3px] bg-ink" /><div className="h-1.5 w-3/5 rounded-[3px] bg-ink/25" /></div></div>
                  <div className="h-[26px] rounded-full bg-ink" />
                  {[0, 1, 2].map((i) => <div className="h-[26px] rounded-[9px] bg-white" key={i} />)}
                </div>
              </Look>
              <Look name="Film" tag="Plus">
                <div className="relative h-full bg-ink">
                  <Portrait className="absolute inset-x-0 top-0 h-[64%]" who="studio" />
                  <div className="absolute inset-x-0 top-[40%] h-[24%] bg-gradient-to-b from-ink/0 to-ink" />
                  <div className="absolute inset-x-3 bottom-4 flex flex-col items-center gap-2"><span className="font-serif-display text-[22px] italic leading-none text-paper">Michel</span><div className="h-1.5 w-3/5 rounded-[3px] bg-paper/40" /><div className="mt-1 h-[24px] w-full rounded-full bg-coral" /></div>
                </div>
              </Look>
              <Look name="Frame" tag="Plus">
                <div className="box-border flex h-full flex-col items-center gap-2.5 bg-[#e8e2d4] p-4">
                  <div className="w-full bg-white p-2 shadow-[0_8px_20px_-12px_rgba(13,13,13,.5)]"><Portrait className="aspect-[4/5] w-full" who="aanya" /></div>
                  <div className="h-2.5 w-3/5 rounded-[3px] bg-ink" />
                  <div className="mt-auto h-[24px] w-full rounded-full bg-ink" />
                </div>
              </Look>
              <Look name="Glow" tag="Plus">
                <div className="relative box-border flex h-full flex-col justify-end gap-2 overflow-hidden bg-ink p-4">
                  <div className="absolute -top-6 left-1/2 size-40 -translate-x-1/2 rounded-full bg-coral/45 blur-3xl" />
                  <Portrait className="absolute left-1/2 top-[14%] size-24 -translate-x-1/2 rounded-full" who="aanya" />
                  <div className="relative mx-auto h-2.5 w-3/5 rounded-[3px] bg-paper" />
                  <div className="relative h-[24px] rounded-full bg-coral" />
                  <div className="relative h-[24px] rounded-[9px] bg-paper/10" />
                </div>
              </Look>
            </div>
            <CardFoot title="Looks with a point of view.">{`${PLAN_COUNTS.appearances} Appearances, from Film to Frame. Free has Immersive and Clean. Plus unlocks all ${PLAN_COUNTS.appearances}, ${PLAN_COUNTS.nameFonts - PLAN_COUNTS.freeNameFonts} more name fonts, scroll cues, and card and link styles. Each Mode can wear its own.`}</CardFoot>
          </article>
        </div>
      </div>
    </section>
  );
}

function Look({ name, tag, children }: { name: string; tag: "Free" | "Plus"; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div aria-hidden="true" className="aspect-[.56] overflow-hidden rounded-3xl shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">{children}</div>
      <span className="flex justify-between text-sm font-semibold">{name}<Mono className={`text-[10px] tracking-[0.12em] ${tag === "Plus" ? "text-coral" : "text-ink/65"}`}>{tag}</Mono></span>
    </div>
  );
}
