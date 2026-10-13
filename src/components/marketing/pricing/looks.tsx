"use client";

import { useState, type CSSProperties } from "react";

import { APPEARANCE_NAMES, APPEARANCES, FREE_APPEARANCES, previewAppearance } from "@/components/profile/appearance";
import { appearanceTheme } from "@/components/profile/appearance-theme";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import type { AppearanceId, ProfileIdentity, ProfileMode } from "@/components/profile/types";

import { H2, Lede, Mono, SECTION, SECTION_PAD } from "./shared";

/**
 * Real profiles on the pricing page: every phone here is the same ProfileRenderer the public page
 * uses, at thumbnail scale, so what we sell is exactly what members get.
 */

const CANVAS = { width: 390, height: 844 };

type Person = { key: string; name: string; username: string; line: string; accent: string };
const PEOPLE: Record<string, Person> = {
  aanya: { key: "aanya", name: "Aanya Rao", username: "aanya", line: "Lisbon", accent: "#FF5A4F" },
  theo: { key: "theo", name: "Theo Laurent", username: "theo", line: "Paris", accent: "#C7FF4A" },
  noor: { key: "noor", name: "Noor Haddad", username: "noor", line: "Amsterdam", accent: "#AFCBFF" },
  lucas: { key: "lucas", name: "Lucas Meyer", username: "lucas", line: "Rotterdam", accent: "#FF5A4F" },
  sena: { key: "sena", name: "Sena Okafor", username: "sena", line: "London", accent: "#FF5A4F" },
};

/** Each person has a close and a wide portrait; the face point (0–100) keeps every crop on the face. */
type Shot = "close" | "wide";
const FACES: Record<string, Record<Shot, { x: number; y: number }>> = {
  aanya: { close: { x: 45, y: 50 }, wide: { x: 49, y: 24 } },
  theo: { close: { x: 47, y: 46 }, wide: { x: 45, y: 17 } },
  noor: { close: { x: 47, y: 38 }, wide: { x: 50, y: 34 } },
  lucas: { close: { x: 50, y: 38 }, wide: { x: 52, y: 24 } },
  sena: { close: { x: 47, y: 30 }, wide: { x: 57, y: 34 } },
};

/** Close crops fill the tall, photo-led looks; wide crops sit inside the framed ones. */
const CAST: Record<AppearanceId, { who: keyof typeof PEOPLE; shot: Shot }> = {
  immersive: { who: "aanya", shot: "close" }, film: { who: "lucas", shot: "close" },
  aura: { who: "noor", shot: "close" }, glow: { who: "sena", shot: "close" },
  motion: { who: "theo", shot: "close" }, frame: { who: "noor", shot: "wide" },
  clean: { who: "lucas", shot: "wide" }, scene: { who: "aanya", shot: "wide" },
  stack: { who: "theo", shot: "wide" }, social: { who: "sena", shot: "wide" },
};

const LINKS = [
  { id: "l1", title: "Instagram", url: "https://instagram.com/setuvara", link_type: "instagram", is_visible: true, sort_order: 0 },
  { id: "l2", title: "TikTok", url: "https://tiktok.com/@setuvara", link_type: "tiktok", is_visible: true, sort_order: 1 },
  { id: "l3", title: "Spotify", url: "https://open.spotify.com", link_type: "spotify", is_visible: true, sort_order: 2 },
  { id: "l4", title: "Portfolio", url: "https://setuvara.com", link_type: "url", is_visible: true, sort_order: 3 },
];

function demo(person: Person, shot: Shot, appearance: AppearanceId): { profile: ProfileIdentity; mode: ProfileMode } {
  const url = `/pricing/${person.key}-${shot}.webp`;
  const face = FACES[person.key][shot];
  return {
    profile: { id: `demo-${person.key}`, username: person.username, display_name: person.name, bio: "", is_published: true },
    mode: {
      id: `demo-${person.key}-${appearance}`,
      slug: "personal",
      label: "Personal",
      is_enabled: true,
      settings: { location: person.line },
      appearance: { theme: appearance, accent: person.accent },
      image_path: url,
      image_url: url,
      image_focus_x: face.x,
      image_focus_y: face.y,
      links: LINKS,
      blocks: [],
    },
  };
}

/** Mirrors ConnectFlow's trigger so the demo wears each Appearance's own Connect. */
function DemoConnect() {
  return (
    <span className="relative isolate inline-flex h-[var(--sv-connect-h,52px)] w-[var(--sv-connect-w,100%)] min-w-11 items-center gap-2.5 overflow-hidden rounded-[var(--sv-connect-radius,999px)] bg-[var(--sv-connect-bg)] px-[var(--sv-connect-px,20px)] text-[16px] font-semibold text-[var(--sv-connect-fg)] shadow-[var(--sv-connect-edge,none)] after:content-[var(--sv-connect-arrow,none)]" style={{ justifyContent: "var(--sv-connect-justify, center)", "--sv-connect-bg": "var(--sv-connect-fill, #FF5A4F)", "--sv-connect-fg": "var(--sv-connect-ink, #0D0D0D)" } as CSSProperties}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[var(--sv-connect-dot,transparent)] [display:var(--sv-connect-dot-display,none)]" />
      <span>Connect</span>
    </span>
  );
}

export function LookPhone({ appearance, width, connect = true, className = "" }: { appearance: AppearanceId; width: number; connect?: boolean; className?: string }) {
  const { who, shot } = CAST[appearance];
  const { profile, mode } = demo(PEOPLE[who], shot, appearance);
  const look = previewAppearance(mode);
  const zoom = width / CANVAS.width;
  const free = FREE_APPEARANCES.includes(appearance);
  return (
    <div aria-hidden="true" className={`pointer-events-none relative shrink-0 overflow-hidden ${className}`} inert style={{ width, height: Math.round(CANVAS.height * zoom), background: appearanceTheme(look.id, look.accent).base }}>
      <div style={{ width: CANVAS.width, zoom, "--profile-vh": `${CANVAS.height}px` } as CSSProperties}>
        <ProfileRenderer attribution={free} memberTier={free ? null : "plus"} mode={mode} plan="pro" previewLook={look} profile={profile} sound="off" viewerState="visitor_unconnected" visitorAction={connect ? <DemoConnect /> : undefined} />
      </div>
    </div>
  );
}

const ORDER: AppearanceId[] = ["immersive", "film", "aura", "glow", "frame", "clean", "motion", "scene", "stack", "social"];

export function Looks() {
  return (
    <section aria-labelledby="looks-title" className="overflow-hidden bg-ink text-paper">
      <div className={`${SECTION} pb-[clamp(28px,3vw,40px)] pt-[clamp(64px,8vw,120px)]`}>
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-4">
          <div className="flex flex-col gap-4">
            <Mono className="text-coral">{APPEARANCES.length} Appearances</Mono>
            <H2 id="looks-title">Ten looks.<br />One you.</H2>
          </div>
          <Lede className="text-paper/70">Two are free. Plus unlocks all ten, per Mode.</Lede>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1440px] pb-[clamp(64px,8vw,120px)]">
        <ul className="m-0 flex list-none snap-x snap-mandatory scroll-pl-5 gap-4 overflow-x-auto px-5 pb-4 sm:scroll-pl-8 lg:scroll-pl-14 [scrollbar-width:none] sm:px-8 lg:px-14 [&::-webkit-scrollbar]:hidden" aria-label="Appearances" tabIndex={0}>
          {ORDER.map((id) => {
            const free = FREE_APPEARANCES.includes(id);
            return (
              <li className="flex shrink-0 snap-start flex-col gap-3" key={id}>
                <LookPhone appearance={id} className="rounded-[28px] shadow-[0_0_0_1px_rgba(245,244,239,.1)]" width={216} />
                <span className="flex items-center justify-between px-1 text-[13px] font-semibold">{APPEARANCE_NAMES[id]}<Mono className={`text-[10px] ${free ? "text-paper/55" : "text-coral"}`}>{free ? "Free" : "Plus"}</Mono></span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const POLICIES = [
  { id: "anyone", label: "Everyone", line: "Anyone who opens this Mode can connect." },
  { id: "direct_only", label: "In person", line: "Shows only when you share it yourself, for 24 hours." },
  { id: "nobody", label: "Off", line: "View only. Your existing Connections stay." },
] as const;

export function ConnectChoice() {
  const [policy, setPolicy] = useState<(typeof POLICIES)[number]["id"]>("anyone");
  const current = POLICIES.find((item) => item.id === policy)!;
  return (
    <section aria-labelledby="connect-title" className="bg-paper">
      <div className={`${SECTION} ${SECTION_PAD}`}>
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-16 gap-y-12 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Mono className="text-ink/60">Every plan</Mono>
            <H2 id="connect-title">Connect.<br />Your call.</H2>
            <Lede>Show it, keep it for in person, or switch it off. Per Mode, whenever you like.</Lede>
            <div aria-label="Who sees Connect" className="flex w-fit gap-1 rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" role="radiogroup">
              {POLICIES.map((item) => (
                <button aria-checked={policy === item.id} className={`h-10 rounded-full px-4 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${policy === item.id ? "bg-ink text-paper" : "text-ink/70 hover:text-ink"}`} key={item.id} onClick={() => setPolicy(item.id)} role="radio" type="button">{item.label}</button>
              ))}
            </div>
            <p aria-live="polite" className="m-0 min-h-5 text-[14px] text-ink/60">{current.line}</p>
          </div>
          <div className="flex justify-center">
            <LookPhone appearance="immersive" className="rounded-[34px] shadow-[0_40px_80px_-40px_rgba(13,13,13,.55),0_0_0_8px_#0d0d0d]" connect={policy === "anyone"} width={260} />
          </div>
        </div>
      </div>
    </section>
  );
}
