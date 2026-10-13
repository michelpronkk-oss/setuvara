import type { CSSProperties } from "react";

import { previewAppearance } from "@/components/profile/appearance";
import { appearanceTheme } from "@/components/profile/appearance-theme";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import type { AppearanceId, ModeSlug, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";

import { person, type DemoMode } from "./demo";

/**
 * Setuvara's own device mockup: a phone at a fixed design size (280×580) that callers scale.
 * The screen is the real ProfileRenderer, the same one the public page uses, so the homepage
 * always shows today's Appearances and Modes.
 */

const CANVAS = { width: 390, height: 844 };
const SCREEN = 262;

type Demo = { appearance: AppearanceId; accent: string; settings: Record<string, string>; links: [string, string][] };
type Person = { name: string; username: string; photo: string; face: { x: number; y: number } };
/** Overrides a Mode's design-file look, e.g. the hero's front phone in Immersive with Impact type. */
type Look = { theme: AppearanceId; accent?: string } & Partial<Record<"nameFont" | "scrollCue", string>>;

/** What each Mode carries, following the design file's pairing: Personal Immersive, Event Motion, Business Clean. */
const DEMOS: Record<DemoMode["slug"], Demo> = {
  personal: {
    appearance: "immersive",
    accent: "#FF5A4F",
    settings: { location: "Lisbon" },
    links: [["instagram", "Instagram"], ["spotify", "Sunday run mix"], ["whatsapp", "WhatsApp"], ["tiktok", "TikTok"]],
  },
  event: {
    appearance: "motion",
    accent: "#C7FF4A",
    settings: { eventName: "Slush", city: "Helsinki", dateLabel: "November", role: "Partnerships · Lumen Labs", hereToMeet: "Climate founders and grid operators." },
    links: [["linkedin", "LinkedIn"], ["instagram", "Instagram"], ["url", "Pitch deck"]],
  },
  business: {
    appearance: "clean",
    accent: "#FF5A4F",
    settings: { role: "Partnerships Lead", company: "Lumen Labs", city: "Lisbon", description: "Grid-storage pilots with utilities across Europe." },
    links: [["linkedin", "LinkedIn"], ["calendly", "Book a 20-min intro"], ["url", "Lumen Labs"]],
  },
};

const AANYA_CLOSE: Person = { name: person.name, username: person.username, photo: "/pricing/aanya-close.webp", face: { x: 45, y: 50 } };
export const DEMO_PEOPLE = {
  aanya: AANYA_CLOSE,
  aanyaWide: { ...AANYA_CLOSE, photo: "/pricing/aanya-wide.webp", face: { x: 49, y: 24 } },
  theo: { name: "Theo Laurent", username: "theo", photo: "/pricing/theo-close.webp", face: { x: 47, y: 46 } },
  lucas: { name: "Lucas Meyer", username: "lucas", photo: "/pricing/lucas-wide.webp", face: { x: 52, y: 24 } },
  lucasClose: { name: "Lucas Meyer", username: "lucas", photo: "/pricing/lucas-close.webp", face: { x: 50, y: 38 } },
} satisfies Record<string, Person>;

/** One person across all three Modes (the Modes section): close crops for Personal and Event, wide for Business. */
const SAME_PERSON: Record<DemoMode["slug"], Person> = { personal: DEMO_PEOPLE.aanya, event: DEMO_PEOPLE.aanya, business: DEMO_PEOPLE.aanyaWide };

function demo(slug: ModeSlug & DemoMode["slug"], who: Person, override?: Look): { profile: ProfileIdentity; mode: ProfileMode } {
  const d = DEMOS[slug];
  const links: ProfileLink[] = d.links.map(([type, title], index) => ({ id: `${slug}-${index}`, title, url: "https://setuvara.com", link_type: type, is_visible: true, sort_order: index }));
  return {
    profile: { id: `demo-${who.username}`, username: who.username, display_name: who.name, bio: "", is_published: true },
    mode: {
      id: `demo-${who.username}-${slug}`,
      slug,
      label: slug[0].toUpperCase() + slug.slice(1),
      is_enabled: true,
      settings: d.settings,
      appearance: { theme: d.appearance, accent: d.accent, ...override } as ProfileMode["appearance"],
      image_path: who.photo,
      image_url: who.photo,
      image_focus_x: who.face.x,
      image_focus_y: who.face.y,
      links,
      blocks: [],
    },
  };
}

/** Mirrors ConnectFlow's trigger so each Appearance draws its own Connect. */
function DemoConnect() {
  return (
    <span className="relative isolate inline-flex h-[var(--sv-connect-h,52px)] w-[var(--sv-connect-w,100%)] min-w-11 items-center gap-2.5 overflow-hidden rounded-[var(--sv-connect-radius,999px)] bg-[var(--sv-connect-bg)] px-[var(--sv-connect-px,20px)] text-[16px] font-semibold text-[var(--sv-connect-fg)] shadow-[var(--sv-connect-edge,none)] after:content-[var(--sv-connect-arrow,none)]" style={{ justifyContent: "var(--sv-connect-justify, center)", "--sv-connect-bg": "var(--sv-connect-fill, #FF5A4F)", "--sv-connect-fg": "var(--sv-connect-ink, #0D0D0D)" } as CSSProperties}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[var(--sv-connect-dot,transparent)] [display:var(--sv-connect-dot-display,none)]" />
      <span>Connect</span>
    </span>
  );
}

export function ModePhone({ slug, label, who, look: override }: { slug: DemoMode["slug"]; label?: string; who?: Person; look?: Look }) {
  const owner = who ?? SAME_PERSON[slug];
  const { profile, mode } = demo(slug, owner, override);
  const look = previewAppearance(mode);
  const zoom = SCREEN / CANVAS.width;
  // A real 390×844 phone viewport, scaled into the frame: exactly what a visitor sees first.
  return (
    <div aria-label={label ?? `${owner.name}, ${slug} Mode`} className="relative h-[580px] w-[280px] rounded-[46px] bg-[#1b1b1b] p-[9px] text-left shadow-[0_40px_70px_-30px_rgba(13,13,13,.55),inset_0_0_0_1.5px_rgba(255,255,255,.08)]" role="img">
      <span aria-hidden="true" className="absolute -left-[3px] top-[118px] h-12 w-[3px] rounded-l bg-[#1b1b1b]" />
      <span aria-hidden="true" className="absolute -right-[3px] top-[150px] h-16 w-[3px] rounded-r bg-[#1b1b1b]" />
      <div aria-hidden="true" className="pointer-events-none relative h-full w-full overflow-hidden rounded-[38px]" inert style={{ background: appearanceTheme(look.id, look.accent).base }}>
        <div style={{ width: CANVAS.width, zoom, "--profile-vh": `${CANVAS.height}px` } as CSSProperties}>
          <ProfileRenderer memberTier="plus" mode={mode} plan="pro" previewLook={look} profile={profile} sound="off" viewerState="visitor_unconnected" visitorAction={<DemoConnect />} />
        </div>
        <span className="absolute left-1/2 top-2.5 h-[26px] w-[84px] -translate-x-1/2 rounded-full bg-[#0a0a0a]" />
      </div>
    </div>
  );
}
