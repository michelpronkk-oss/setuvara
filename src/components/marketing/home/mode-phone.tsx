import type { CSSProperties } from "react";

import { previewAppearance } from "@/components/profile/appearance";
import { appearanceTheme } from "@/components/profile/appearance-theme";
import { MarketingProfilePreview } from "@/components/marketing/profile-preview";
import type { AppearanceId, ModeSlug, ProfileBlock, ProfileIdentity, ProfileLink, ProfileMode, PublicLiveContext } from "@/components/profile/types";

import { person, type DemoMode } from "./demo";

/**
 * Setuvara's own device mockup: a phone at a fixed design size (280×580) that callers scale.
 * The screen is a server-rendered marketing-only preview using the same appearance data and
 * compositions as member profiles, without the profile application's client renderer.
 */

const CANVAS = { width: 390, height: 844 };
const SCREEN = 262;

type Demo = { appearance: AppearanceId; accent: string; settings: Record<string, string>; links: [string, string][] };
type Person = { name: string; username: string; photo: string; face: { x: number; y: number } };
/** Overrides a Mode's design-file look, e.g. the hero's front phone in Immersive with Impact type. */
type Look = { theme: AppearanceId; accent?: string; nameFont?: string; scrollCue?: string; namePosition?: string; /** Picture blocks, e.g. the photos Stack fans out behind the portrait. */ pictures?: string[] };

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
    settings: { role: "Partnerships Lead", company: "Setuvara", city: "Lisbon", description: "Helping teams meet better at every event." },
    links: [["linkedin", "LinkedIn"], ["calendly", "Book a 20-min intro"], ["url", "Setuvara"]],
  },
  creator: {
    appearance: "film",
    accent: "#E8A6FF",
    settings: { category: "Music · Live sessions", city: "Lagos", tagline: "Late-night sets, recorded live. New session every Friday." },
    links: [["youtube", "YouTube"], ["spotify", "Spotify"], ["instagram", "Instagram"], ["tiktok", "TikTok"]],
  },
};

const AANYA_CLOSE: Person = { name: person.name, username: person.username, photo: "/pricing/aanya-close.webp", face: { x: 45, y: 50 } };
export const DEMO_PEOPLE = {
  aanya: AANYA_CLOSE,
  theo: { name: "Theo Laurent", username: "theo", photo: "/pricing/theo-close.webp", face: { x: 47, y: 46 } },
  lucas: { name: "Lucas Meyer", username: "lucas", photo: "/pricing/lucas-wide.webp", face: { x: 52, y: 24 } },
  lucasClose: { name: "Lucas Meyer", username: "lucas", photo: "/pricing/lucas-close.webp", face: { x: 50, y: 38 } },
  sena: { name: "Sena Okafor", username: "sena", photo: "/pricing/sena-close.webp", face: { x: 50, y: 42 } },
  noor: { name: "Noor Haddad", username: "noor", photo: "/pricing/noor-close.webp", face: { x: 50, y: 42 } },
} satisfies Record<string, Person>;

/** Slush's own week, far enough ahead that the static page never shows it expired. */
const SLUSH: PublicLiveContext = { label: "Slush 2026", type: "event", expiresAt: "2099-11-20T17:00:00Z" };

/** The homepage cast, one person per Mode: the hero and the Modes section show the same three phones. */
export const CAST: Record<DemoMode["slug"], { who: Person; look: Look; live?: PublicLiveContext }> = {
  personal: { who: DEMO_PEOPLE.aanya, look: { theme: "stack", pictures: ["/pricing/aanya-wide.webp"] } },
  event: { who: DEMO_PEOPLE.theo, look: { theme: "immersive", nameFont: "impact", scrollCue: "swipe", namePosition: "bottom" }, live: SLUSH },
  business: { who: DEMO_PEOPLE.lucasClose, look: { theme: "glow" } },
  creator: { who: DEMO_PEOPLE.sena, look: { theme: "film" } },
};

/** Real provider hosts, so the hero shows each Mode's social icons the way a member's page does. */
const LINK_URLS: Record<string, string> = {
  instagram: "https://instagram.com/setuvara", spotify: "https://open.spotify.com/playlist/setuvara", whatsapp: "https://wa.me/351900000000",
  tiktok: "https://tiktok.com/@setuvara", linkedin: "https://linkedin.com/in/setuvara", calendly: "https://calendly.com/setuvara",
  youtube: "https://youtube.com/@setuvara",
};

function demo(slug: ModeSlug & DemoMode["slug"], who: Person, override?: Look): { profile: ProfileIdentity; mode: ProfileMode } {
  const d = DEMOS[slug];
  const { pictures = [], ...look } = override ?? {};
  const blocks: ProfileBlock[] = pictures.map((url, index) => ({ id: `${slug}-picture-${index}`, kind: "image", data: { image_url: url }, is_visible: true, sort_order: index }));
  const links: ProfileLink[] = d.links.map(([type, title], index) => ({ id: `${slug}-${index}`, title, url: LINK_URLS[type] ?? "https://setuvara.com", link_type: type, is_visible: true, sort_order: index }));
  return {
    profile: { id: `demo-${who.username}`, username: who.username, display_name: who.name, bio: "", is_published: true },
    mode: {
      id: `demo-${who.username}-${slug}`,
      slug,
      label: slug[0].toUpperCase() + slug.slice(1),
      is_enabled: true,
      settings: d.settings,
      appearance: { theme: d.appearance, accent: d.accent, ...look } as ProfileMode["appearance"],
      image_path: who.photo,
      image_url: who.photo,
      image_focus_x: who.face.x,
      image_focus_y: who.face.y,
      links,
      blocks,
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

/** A cast member's phone for a Mode, exactly as the hero shows it. */
export function CastPhone({ slug, mediaPriority = "normal" }: { slug: DemoMode["slug"]; mediaPriority?: "high" | "normal" }) {
  const { who, look, live } = CAST[slug];
  return <ModePhone live={live} look={look} mediaPriority={mediaPriority} slug={slug} who={who} />;
}

export function ModePhone({ slug, label, who, look: override, live, mediaPriority = "normal" }: { slug: DemoMode["slug"]; label?: string; who: Person; look?: Look; /** A Live Context, the pill an Event page shows while you are there. */ live?: PublicLiveContext; mediaPriority?: "high" | "normal" }) {
  const { profile, mode } = demo(slug, who, override);
  const look = previewAppearance(mode);
  const zoom = SCREEN / CANVAS.width;
  // A real 390×844 phone viewport, scaled into the frame: exactly what a visitor sees first.
  return (
    <div aria-label={label ?? `${who.name}, ${slug} Mode`} className="relative h-[580px] w-[280px] rounded-[46px] bg-[#1b1b1b] p-[9px] text-left shadow-[0_40px_70px_-30px_rgba(13,13,13,.55),inset_0_0_0_1.5px_rgba(255,255,255,.08)]" role="img">
      <span aria-hidden="true" className="absolute -left-[3px] top-[118px] h-12 w-[3px] rounded-l bg-[#1b1b1b]" />
      <span aria-hidden="true" className="absolute -right-[3px] top-[150px] h-16 w-[3px] rounded-r bg-[#1b1b1b]" />
      <div aria-hidden="true" className="pointer-events-none relative h-full w-full overflow-hidden rounded-[38px] [&_[data-floating-connect]]:hidden" inert style={{ background: appearanceTheme(look.id, look.accent).base }}>
        <div style={{ width: CANVAS.width, zoom, "--profile-vh": `${CANVAS.height}px` } as CSSProperties}>
          <MarketingProfilePreview liveContext={live} marketingMediaPriority={mediaPriority} nameAs="p" memberTier="plus" mode={mode} plan="pro" previewLook={look} profile={profile} sound="off" viewerState="visitor_unconnected" visitorAction={<DemoConnect />} />
        </div>
        <span className="absolute left-1/2 top-2.5 h-[26px] w-[84px] -translate-x-1/2 rounded-full bg-[#0a0a0a]" />
      </div>
    </div>
  );
}

const DESKTOP = { width: 1280, height: 800 };

/**
 * The same cast member's page as a desktop visitor sees it: drawn at a real 1280px window (the
 * Appearance's wide hero) and scaled into the frame. `scale` sets the drawn size; `scales` instead
 * gives Tailwind classes that set --z per breakpoint, so one drawing serves every width. Its photos
 * never preload: drawings sit below the fold or only show on wide screens.
 */
export function ModeDesktop({ slug, who, look: override, live, scale = 0.5, scales, label }: { slug: DemoMode["slug"]; who?: Person; look?: Look; live?: PublicLiveContext; scale?: number; scales?: string; label?: string }) {
  const cast = CAST[slug];
  const person = who ?? cast.who;
  const { profile, mode } = demo(slug, person, override ?? cast.look);
  const look = previewAppearance(mode);
  return (
    <div aria-label={label ?? `${person.name}'s ${slug} page on a desktop`} className={`relative overflow-hidden ${scales ?? ""}`} role="img" style={{ ...(scales ? { width: `calc(${DESKTOP.width}px * var(--z))`, height: `calc(${DESKTOP.height}px * var(--z))` } : { width: DESKTOP.width * scale, height: DESKTOP.height * scale }), background: appearanceTheme(look.id, look.accent).base }}>
      <div aria-hidden="true" className="pointer-events-none [&_[data-floating-connect]]:hidden" inert style={{ width: DESKTOP.width, zoom: scales ? "var(--z)" : scale, "--profile-vh": `${DESKTOP.height}px` } as CSSProperties}>
        <MarketingProfilePreview liveContext={live ?? cast.live} marketingMediaPriority="normal" nameAs="p" memberTier="plus" mode={mode} plan="pro" previewLook={look} profile={profile} sound="off" viewerState="visitor_unconnected" visitorAction={<DemoConnect />} />
      </div>
    </div>
  );
}
