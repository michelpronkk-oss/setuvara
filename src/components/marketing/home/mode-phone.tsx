import type { ReactNode } from "react";

import { ProviderMark } from "@/components/links/provider-mark";
import { providerForLink } from "@/lib/links/providers";

import { MeetMark } from "../brand";
import { person, type DemoMode } from "./demo";

/**
 * Setuvara's own device mockup: a phone at a fixed design size (280×580) that
 * callers scale. Each Mode gets a screen designed after the real public profile.
 */
export function ModePhone({ slug, label }: { slug: DemoMode["slug"]; label?: string }) {
  const screen = slug === "personal" ? <PersonalScreen /> : slug === "event" ? <EventScreen /> : <BusinessScreen />;
  const dark = slug === "personal";
  return (
    <div aria-label={label ?? `${person.name}, ${slug} Mode`} className="relative h-[580px] w-[280px] rounded-[46px] bg-[#1b1b1b] p-[9px] text-left shadow-[0_40px_70px_-30px_rgba(13,13,13,.55),inset_0_0_0_1.5px_rgba(255,255,255,.08)]" role="img">
      <span aria-hidden="true" className="absolute -left-[3px] top-[118px] h-12 w-[3px] rounded-l bg-[#1b1b1b]" />
      <span aria-hidden="true" className="absolute -right-[3px] top-[150px] h-16 w-[3px] rounded-r bg-[#1b1b1b]" />
      <div aria-hidden="true" className="relative h-full w-full overflow-hidden rounded-[38px]">
        {screen}
        <StatusBar dark={dark} />
        <span className={`absolute bottom-2 left-1/2 h-[4px] w-24 -translate-x-1/2 rounded-full ${dark ? "bg-paper/70" : "bg-ink/70"}`} />
      </div>
    </div>
  );
}

function StatusBar({ dark }: { dark: boolean }) {
  return (
    <div className={`absolute inset-x-0 top-0 flex h-11 items-center justify-between px-6 text-[12px] font-semibold ${dark ? "text-paper" : "text-ink"}`}>
      <span>9:41</span>
      <span className="absolute left-1/2 top-2.5 h-[26px] w-[84px] -translate-x-1/2 rounded-full bg-[#0a0a0a]" />
      <span className="flex items-center gap-1">
        <svg className="h-[10px] w-[16px]" fill="currentColor" viewBox="0 0 16 10"><rect height="4" rx="1" width="3" y="6" /><rect height="6" rx="1" width="3" x="4.3" y="4" /><rect height="8" rx="1" width="3" x="8.6" y="2" /><rect height="10" rx="1" width="3" x="13" /></svg>
        <svg className="h-[11px] w-[22px]" fill="none" viewBox="0 0 22 11"><rect height="10" rx="3" stroke="currentColor" strokeOpacity=".4" width="19" x=".5" y=".5" /><rect fill="currentColor" height="7" rx="1.6" width="15" x="2" y="2" /><path d="M21 4v3" stroke="currentColor" strokeLinecap="round" strokeOpacity=".4" /></svg>
      </span>
    </div>
  );
}

function Url({ mode, dark }: { mode: string; dark: boolean }) {
  return <p className={`mt-12 text-center font-label text-[9px] tracking-[0.08em] ${dark ? "text-paper/45" : "text-ink/45"}`}>setuvara.com/{person.username}?mode={mode}</p>;
}

function Row({ provider, title, tone }: { provider: string; title: string; tone: "dark" | "coral" | "light" }) {
  const p = providerForLink(provider);
  const surface = tone === "dark" ? "bg-white/[0.08]" : tone === "coral" ? "bg-paper/80" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]";
  return (
    <div className={`flex h-11 items-center gap-2.5 rounded-[14px] px-2 ${surface}`}>
      <ProviderMark className={`!size-7 !rounded-[9px] ${tone === "dark" ? "!bg-white/10 !text-paper" : ""}`} icon={p.icon} label={p.name} />
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{title}</span>
      <span className="pr-1 text-[11px] opacity-40">↗</span>
    </div>
  );
}

function ConnectButton({ className, children = "Connect" }: { className: string; children?: ReactNode }) {
  return <span className={`flex h-11 items-center justify-center gap-2 rounded-full text-[13px] font-semibold ${className}`}>{children}</span>;
}

function PersonalScreen() {
  return (
    <div className="flex h-full flex-col bg-ink px-5 pb-6 text-paper">
      <Url dark mode="personal" />
      <div className="mt-5 flex items-center gap-3">
        <span className="relative grid size-[62px] shrink-0 place-items-center overflow-hidden rounded-full bg-coral">
          <span className="absolute -bottom-3 -right-2 size-10 rounded-full bg-sky" />
          <span className="relative font-display text-[24px] font-extrabold tracking-[-0.05em] text-ink">A</span>
        </span>
        <span className="flex flex-col">
          <span className="font-label text-[8px] uppercase tracking-[0.2em] text-coral">Personal</span>
          <span className="mt-1 text-[11px] text-paper/55">@{person.username} · Lisbon</span>
        </span>
      </div>
      <p className="mt-4 font-display text-[44px] font-extrabold leading-[0.9] tracking-[-0.055em]">Aanya</p>
      <p className="mt-2 text-[12px] leading-[1.45] text-paper/60">Designer. Distance runner. Hunting Lisbon’s best bica.</p>
      <div className="mt-4 flex gap-2">
        {["instagram", "spotify", "whatsapp", "tiktok"].map((id) => {
          const p = providerForLink(id);
          return <ProviderMark className="!size-9 !rounded-full !bg-white/10 !text-paper" icon={p.icon} key={id} label={p.name} />;
        })}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Row provider="spotify" title="Sunday run mix" tone="dark" />
        <Row provider="instagram" title="Film photos" tone="dark" />
      </div>
      <ConnectButton className="mt-auto bg-coral text-ink">Connect with Aanya</ConnectButton>
    </div>
  );
}

function EventScreen() {
  return (
    <div className="flex h-full flex-col bg-coral text-ink">
      <div className="px-5">
        <Url dark={false} mode="event" />
        <p className="mt-4 font-label text-[8px] uppercase tracking-[0.2em]">Event Mode</p>
        <p className="-ml-0.5 mt-1 font-display text-[78px] font-extrabold leading-[0.8] tracking-[-0.07em]">SLUSH</p>
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
          <span>Helsinki</span><span>November</span>
        </div>
      </div>
      <div className="relative mt-4 border-t-2 border-dashed border-ink/35">
        <span className="absolute -left-3 -top-3 size-6 rounded-full bg-[#1b1b1b]" />
        <span className="absolute -right-3 -top-3 size-6 rounded-full bg-[#1b1b1b]" />
      </div>
      <div className="flex flex-1 flex-col px-5 pb-6 pt-4">
        <p className="font-display text-[26px] font-bold leading-none tracking-[-0.045em]">{person.name}</p>
        <p className="mt-1.5 text-[11px] font-medium">Partnerships · Lumen Labs</p>
        <div className="mt-3 rounded-[12px] bg-ink px-3 py-2 text-paper">
          <p className="font-label text-[8px] uppercase tracking-[0.18em] text-coral">Here to meet</p>
          <p className="mt-0.5 text-[11px] font-medium">Climate founders · Grid operators</p>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Row provider="linkedin" title="LinkedIn" tone="coral" />
          <Row provider="schedule" title="Find me Thursday" tone="coral" />
        </div>
        <ConnectButton className="mt-auto bg-ink text-paper">Connect at Slush</ConnectButton>
      </div>
    </div>
  );
}

function BusinessScreen() {
  return (
    <div className="flex h-full flex-col bg-paper px-5 pb-6 text-ink">
      <Url dark={false} mode="business" />
      <div className="mt-5 flex items-start justify-between">
        <span className="grid size-[68px] place-items-center rounded-[16px] bg-sky font-display text-[24px] font-bold tracking-[-0.04em] [clip-path:polygon(0_0,100%_0,100%_calc(100%-20px),calc(100%-12px)_100%,0_100%)]">AR</span>
        <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]"><MeetMark className="size-3" /><span className="font-label text-[8px] uppercase tracking-[0.16em]">Business</span></span>
      </div>
      <p className="mt-4 font-display text-[32px] font-bold leading-[0.95] tracking-[-0.05em]">Aanya Rao</p>
      <div className="mt-3 grid grid-cols-2 border-y border-ink/15">
        <div className="py-2 pr-2"><p className="font-label text-[7px] uppercase tracking-[0.16em] text-ink/50">Role</p><p className="mt-0.5 text-[11px] font-semibold">Partnerships Lead</p></div>
        <div className="border-l border-ink/15 py-2 pl-2.5"><p className="font-label text-[7px] uppercase tracking-[0.16em] text-ink/50">Company</p><p className="mt-0.5 text-[11px] font-semibold">Lumen Labs</p></div>
      </div>
      <p className="mt-3 text-[11px] leading-[1.45] text-ink/60">Energy-storage pilots with utilities across Europe.</p>
      <div className="mt-3 flex flex-col gap-2">
        <Row provider="linkedin" title="LinkedIn" tone="light" />
        <Row provider="company_website" title="Company website" tone="light" />
      </div>
      <ConnectButton className="mt-auto bg-ink text-paper">Book a 20-min intro</ConnectButton>
    </div>
  );
}
