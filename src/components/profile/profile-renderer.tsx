"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { LinkGlyph } from "@/components/links/provider-mark";
import { MeetMark } from "@/components/marketing/brand";
import { FramedPhoto } from "@/components/profile/focused-photo";
import { ProfileBlocks, type BlockTone } from "@/components/profile/profile-blocks";
import { SoundtrackProvider } from "@/components/profile/soundtrack";
import { MemberBadge } from "@/components/app/status-badge";
import type { MemberTier } from "@/lib/billing/member-badge";
import type { PlanCode } from "@/lib/billing/catalog";
import { hasCapability } from "@/lib/billing/capabilities";
import { soundtrackBlock } from "@/lib/blocks/registry";
import { providerForLink, resolveStoredLink } from "@/lib/links/providers";
import { getMessages } from "@/lib/i18n/messages";
import { legacySource, photoSource, type PhotoSource } from "./photo-focus";
import { extraSlideLimit, resolveAppearance, SLIDE_SECONDS, type ResolvedAppearance } from "./appearance";
import { appearanceTheme, BOOKING_PROVIDERS, brandColour, contentImages, filmSubtitle, FILM_GRAIN, heroSocials, INK, NAME_SCALE, PAPER, type AppearanceTheme } from "./appearance-theme";
import { nameType, nameTypeStyle, type NameType } from "./name-type";
import { estimateFace, immersiveMask, immersiveScrim, solveFaceSafe } from "./face-safe";
import { ScrollCue } from "./scroll-cue";
import { ConnectRow, FeaturedSoundLine, FloatingConnect, LiveContextPresentation, SocialPresentation, SoundControl, SoundGate, useFrame, type ResolvedLink } from "./appearance-parts";
import type { ConnectionContext, ModeSlug, ProfileIdentity, ProfileLink, ProfileMode, PublicLiveContext, SlideImage, ViewerState } from "./types";

export { BOOKING_PROVIDERS } from "./appearance-theme";

/**
 * The one profile renderer. The public page, the editor preview and every thumbnail draw a Mode
 * through this component, following the approved ViralProfile design: one of ten Appearances,
 * each composed from the same primitives (environment, hero, identity, Mode indicator, Live
 * Context, socials, Connect, content, sound, floating Connect).
 *
 * The composition answers to its own width (container queries), not the window: below 700px it
 * is the phone composition; from 700px it becomes a split (photo beside the identity).
 */

type ProfileRendererProps = {
  profile: ProfileIdentity;
  mode: ProfileMode;
  viewerState: ViewerState;
  previewAsVisitor?: boolean;
  visitorAction?: ReactNode;
  connectionHref?: string;
  connectionContext?: ConnectionContext | null;
  guestClaimHref?: string;
  onShare?: () => void;
  onEditMode?: () => void;
  selectedRewards?: Partial<Record<string, string>>;
  /**
   * Soundtrack handling. "preview" (editor previews): never starts on its own and leaves the
   * visitor's choice alone. "off" (thumbnails): no soundtrack at all.
   */
  sound?: "live" | "preview" | "off";
  /**
   * Editor previews only: show the first-visit "Enter with sound" gate. Off by default so the
   * owner sees their profile, not the gate; the editor offers it as a toggle.
   */
  soundGate?: boolean;
  /**
   * The page fills the phone screen edge to edge (the public profile). The hero then stays clear
   * of what covers the screen's bottom: it ends above iOS 26 Safari's floating toolbar, and its
   * foot rises above the home indicator.
   */
  edgeToEdge?: boolean;
  /** Paid member status resolved server-side from billing. One badge beside the name; null for Free. */
  memberTier?: MemberTier | null;
  /** Server-resolved plan controls paid visual treatments while preserving saved choices. */
  plan?: PlanCode;
  /** Page chrome (the owner's Edit profile) placed top-right over the hero. */
  chrome?: ReactNode;
  /** Extra content after the links (the public page's shared Passport stamp). */
  footer?: ReactNode;
  /** "Make yours on Setuvara" (Free) or the small Setuvara mark (Plus) at the end. */
  attribution?: boolean;
  /** The owner's currently effective Live Context, if any (public RPC). */
  liveContext?: PublicLiveContext | null;
  /**
   * An unsaved look to draw instead of the plan-resolved one (the editor's preview-before-
   * upgrade). Never used by the public page.
   */
  previewLook?: ResolvedAppearance;
  className?: string;
};

type Copy = ReturnType<typeof getMessages>["profile"];
const MODE_NAMES: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" };
const LINK_COLLAPSE_AT = 9;
const LINK_VISIBLE = 6;

export function ProfileRenderer(props: ProfileRendererProps) {
  const { mode } = props;
  const plan = props.plan ?? "free";
  const premiumSoundtrack = hasCapability(plan, "soundtrack.premium_treatment");
  const isLive = props.sound !== "off" && props.sound !== "preview";
  const track = props.sound === "off" ? null : soundtrackBlock(mode);
  // The soundtrack block is presented by the Appearance, never as a media block.
  const renderedMode = { ...mode, blocks: mode.blocks?.filter((block) => !block.is_soundtrack) };
  const look = props.previewLook ?? resolveAppearance(mode, plan);
  const profile = <Profile {...props} hasSoundtrack={Boolean(track)} look={look} mode={renderedMode} />;
  if (!track) return profile;
  // The public player only needs the URL. Keep editor-only titles/artwork out of the public
  // server payload. The provider sits above the Appearance, so changing look never restarts it.
  const playerBlock = isLive ? { ...track, data: { url: track.data.url } } : track;
  return <SoundtrackProvider block={playerBlock} gate={props.sound !== "preview" || Boolean(props.soundGate)} key={`${mode.id}:${track.id}:${String(track.data.url)}:${props.soundGate ? "gate" : ""}`} pill={false} premiumPresentation={premiumSoundtrack} preview={props.sound === "preview"}>{profile}</SoundtrackProvider>;
}

type Identity = { name: string; initials: string; username: string; roleLine: string };

function identityFor(profile: ProfileIdentity, mode: ProfileMode): Identity {
  const name = profile.display_name.trim() || `@${profile.username}`;
  const initials = name.replace(/^@/, "").split(/\s+/).map((part) => [...part][0] ?? "").slice(0, 2).join("").toUpperCase();
  const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");
  const roleLine = mode.slug === "event" ? join(setting(mode, "role"), setting(mode, "city"))
    : mode.slug === "business" ? join(setting(mode, "role"), setting(mode, "company"), setting(mode, "city"))
      : join(setting(mode, "location"), setting(mode, "pronouns"));
  return { name, initials, username: profile.username, roleLine };
}

type ProfileProps = ProfileRendererProps & { look: ResolvedAppearance; hasSoundtrack: boolean };

/** Everything a hero composition needs, resolved once. */
type Scene = {
  look: ResolvedAppearance;
  theme: AppearanceTheme;
  /** The name's display type: the chosen style, or the Appearance's own. */
  type: NameType;
  who: Identity;
  mode: ProfileMode;
  photo: string | null;
  /** The main photo as every surface frames it: the kept original and its crop, or the saved photo. */
  source: PhotoSource | null;
  /** The main photo first, then the slideshow photos the plan allows (one entry: no slideshow). */
  slides: PhotoSource[];
  images: string[];
  bio: string;
  copy: Copy;
  memberTier: MemberTier | null;
  treatment: boolean;
  still: boolean;
  drift: string | undefined;
  live: PublicLiveContext | null;
  sound: "ambient" | "minimal" | "featured" | null;
  socials: ResolvedLink[];
  secondary: boolean;
  actions: ReactNode;
  soundTitle: string;
  /** The hero's scroll cue (phone or wide), or nothing when it is off. */
  cue: (wide: boolean) => ReactNode;
  /** Pixels the hero's foot rises above the home indicator (0 off the public page). */
  foot: number;
};

function Profile(props: ProfileProps) {
  const { profile, mode, look, viewerState, previewAsVisitor, selectedRewards = {}, memberTier = null, chrome, footer, attribution = false, className = "" } = props;
  const copy = getMessages("en").profile;
  const source = photoSource(mode);
  const photo = source ? mode.image_url ?? source.url : null;
  const lookTheme = appearanceTheme(look.id, look.accent, Boolean(photo));
  // A chosen alignment moves the identity and the About text together; Auto keeps the look's own.
  const theme = look.align === "auto" ? lookTheme : { ...lookTheme, bioAlign: look.align, identity: { ...lookTheme.identity, align: look.align } };
  const who = identityFor(profile, mode);
  const owner = viewerState === "owner" && !previewAsVisitor;
  const connected = viewerState === "visitor_connected" && !previewAsVisitor;
  const all = resolveLinks(mode.links);
  const booking = mode.slug === "business" && !owner ? all.find((item) => BOOKING_PROVIDERS.includes(item.providerId)) : undefined;
  const links = all.filter((item) => item !== booking);
  const still = look.motion === "off";
  const full = look.motion === "full" || look.id === "motion";
  const cover = useBottomCover(Boolean(props.edgeToEdge));
  const scene: Scene = {
    look, theme, who, mode, photo, source, copy, memberTier,
    type: nameType(look.nameFont, theme.identity, theme.name.charWidth),
    slides: source ? [source, ...(mode.slide_urls ?? []).slice(0, extraSlideLimit(props.plan ?? "free")).map((slide: SlideImage) => legacySource(slide.url, { x: slide.x, y: slide.y }))] : [],
    images: contentImages(mode.blocks).map((image) => image.url),
    bio: profile.bio ?? "",
    treatment: Boolean(selectedRewards.profile_treatment),
    still,
    drift: still ? undefined : `sv-drift ${full ? 22 : 34}s ease-in-out infinite alternate`,
    live: props.liveContext ?? null,
    sound: props.hasSoundtrack ? look.soundPresentation : null,
    socials: heroSocials(mode.slug, links),
    secondary: owner || Boolean(booking),
    actions: <Actions {...props} booking={booking} connected={connected} copy={copy} owner={owner} theme={theme} />,
    // Mode stays internal: the public page never names it.
    soundTitle: copy.soundtrack,
    foot: cover.foot,
    cue: (wide) => {
      if (!look.scrollCue) return null;
      // The cue marks the fold: the foot of the first screen (inside Social's card on phones).
      const inCard = look.id === "social" && !wide;
      const word = look.scrollCue === "swipe" ? (wide ? copy.cueScroll : copy.cueSwipe) : look.scrollCue === "credits" ? copy.cueMore : copy.cueScroll;
      // Thumbnails (no sound) show the cue still, so ten pickers do not all move at once.
      return <ScrollCue accent={look.accent} up={!wide} animated={look.scrollCueMotion && props.sound !== "off"} bottom={wide ? 22 : inCard ? 26 : 8} color={inCard ? "#F5F4EF" : look.id === "film" ? "#F7E9B8" : theme.fg} cue={look.scrollCue} label={copy.scrollMore} text={word} />;
    },
  };
  const connect = theme.connect;
  const connectVars = {
    "--sv-connect-fill": connect.bg,
    "--sv-connect-ink": connect.fg,
    "--sv-connect-edge": [connect.edge !== "none" ? connect.edge : "", connect.shadow ?? ""].filter(Boolean).join(",") || "none",
    "--sv-connect-radius": "999px",
    "--sv-connect-h": "52px",
    "--sv-connect-px": "26px",
    "--sv-connect-w": connect.full ? "100%" : "auto",
    "--sv-connect-dot": connect.dot ?? "transparent",
    "--sv-connect-dot-display": connect.dot ? "block" : "none",
    "--sv-connect-sheen": connect.sheen && !still ? "sv-sheen 5s 1.4s ease-in-out infinite" : "none",
    "--sv-connect-sheen-display": connect.sheen && !still ? "block" : "none",
    "--sv-focus": theme.identity.fg,
  };
  const blockTone: BlockTone = { bg: theme.base, ink: theme.fg, sub: theme.muted, chip: theme.card.bg, line: theme.card.edge, dark: !theme.light };
  const branded = !hasCapability(props.plan ?? "free", "identity.remove_attribution");
  const soundTop = look.id === "clean" || look.id === "social" ? 28 : 18;
  const soundRight = look.id === "clean" || look.id === "social" ? 28 : 16;
  const floating = !owner && !connected && Boolean(props.visitorAction);

  return (
    <article
      className={`@container/profile relative isolate w-full overflow-clip font-brand ${className}`}
      data-appearance={look.id}
      data-motion={look.motion}
      data-profile-mode={look.slug}
      data-foot={props.edgeToEdge ? `${cover.foot}` : undefined}
      data-sound-presentation={scene.sound ?? "none"}
      style={{
        background: theme.base,
        color: theme.fg,
        // The hero is one screen: the small viewport, less what Safari's overlaid toolbar covers.
        "--sv-h": `clamp(560px, calc(var(--profile-vh, 100svh) - ${cover.bar}px), 1000px)`,
        "--sv-card-r": `${theme.radius}px`,
        // The public page runs edge to edge (viewport-fit=cover). Where Safari's toolbar overlays
        // the page, the hero already ends above it; elsewhere its foot (identity, Connect, cue)
        // rises above the home indicator.
        "--sv-foot": props.edgeToEdge && !cover.bar ? "env(safe-area-inset-bottom, 0px)" : "0px",
        "--sv-cue-room": look.scrollCue ? `${CUE_ROOM}px` : "0px",
        "--sv-card-r-small": `${theme.radiusSmall}px`,
        ...connectVars,
      } as CSSProperties}
    >
      <AppearanceEnvironment scene={scene} />
      {theme.grain && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2] opacity-40 mix-blend-overlay" data-film-grain style={{ backgroundImage: FILM_GRAIN }} />}
      {scene.sound && <SoundControl copy={copy} presentation={scene.sound} right={soundRight} theme={theme} title={scene.soundTitle} top={soundTop} />}
      {chrome && <div className="absolute z-20 [&_a]:shadow-none" data-profile-chrome style={{ top: soundTop, right: scene.sound ? soundRight + 52 : soundRight, color: theme.pill.fg, "--sv-chrome-chip-bg": theme.pill.bg, "--sv-chrome-chip-fg": theme.pill.fg } as CSSProperties}>{chrome}</div>}
      {scene.sound && <SoundGate accent={look.accent} copy={copy} initials={who.initials} name={who.name} photo={photo} theme={theme} />}

      <div className="relative z-[3] @min-[900px]/profile:hidden" data-profile-hero-mobile>
        <AppearanceHero scene={scene} />
      </div>
      <div className="relative z-[3] hidden @min-[900px]/profile:block" data-profile-hero-wide>
        <WideHero scene={scene} />
      </div>

      <AppearanceContent attribution={attribution} blockTone={blockTone} copy={copy} footer={footer} links={links} owner={owner} branded={branded} profile={profile} rewards={selectedRewards} scene={scene} />
      {floating && <FloatingConnect dot={connect.dot} label={copy.connect} style={{ background: connect.bg, color: connect.fg, boxShadow: [connect.edge !== "none" ? connect.edge : "", "0 14px 34px -12px #0D0D0D99"].filter(Boolean).join(","), outlineColor: theme.identity.fg }} />}
    </article>
  );
}

// ---------------------------------------------------------------- Environment

const y = (px: number) => `calc(var(--sv-h) * ${+(px / 844).toFixed(4)})`;
const sized = (px: number) => `min(${px}px, ${y(px)})`;

/**
 * The photo atmosphere: one blurred layer of the same image (no second download, no seams),
 * pinned behind the page while it scrolls. Scene uses its environment; Clean has none.
 */
function AppearanceEnvironment({ scene }: { scene: Scene }) {
  const { theme, photo, look } = scene;
  const atmosphere = theme.atmosphere;
  if (!atmosphere.on) return null;
  // The hero's own image (the kept original when there is one), reused from cache.
  const source = look.id === "scene" ? scene.images[0] ?? scene.source?.url ?? photo : scene.source?.url ?? photo;
  const field = photo ? "#2A2622" : theme.light ? look.accent : "#1E1B18";
  return (
    <div aria-hidden="true" className="pointer-events-none sticky top-0 -z-10 h-0" data-appearance-environment>
      {/* Beside a wide hero the atmosphere must read as colour, never as a second face. */}
      <div className="absolute inset-x-0 top-0 h-[100lvh] [--sv-env-blur:18px] @min-[900px]/profile:[--sv-env-blur:72px] min-h-[var(--sv-h)] overflow-hidden" style={{ background: field }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the hero's own image, reused from cache */}
        {source && <img alt="" className="absolute -inset-10 size-[calc(100%+80px)] max-w-none object-cover" decoding="async" src={source} style={{ filter: `blur(var(--sv-env-blur)) saturate(${atmosphere.saturate}) brightness(${atmosphere.brightness})` }} />}
        <div className="absolute inset-0" style={{ background: atmosphere.veil }} />
      </div>
    </div>
  );
}

/** The atmosphere filter for frames where even the original runs out: the Appearance's own. */
function atmosphereFilter(theme: AppearanceTheme) {
  const { saturate, brightness } = theme.atmosphere.on ? theme.atmosphere : { saturate: 1.15, brightness: 0.8 };
  return `blur(26px) saturate(${saturate}) brightness(${brightness})`;
}

/**
 * The Mode photo in its frame, framed from the kept original at the Appearance's zoom. `fill`
 * "page" leaves uncovered space to the page atmosphere already behind the frame (Immersive).
 */
function Photo({ scene, alt = "", sizes = "100vw", priority = false, fill = "frame", frameAspect, style, className = "" }: { scene: Scene; alt?: string; sizes?: string; priority?: boolean; fill?: "frame" | "page"; frameAspect?: number; style?: CSSProperties; className?: string }) {
  if (!scene.source) return null;
  const { look, theme } = scene;
  const atmosphere = fill === "page" && theme.atmosphere.on ? "none" : atmosphereFilter(theme);
  const frame = (source: PhotoSource, extra?: CSSProperties) => <FramedPhoto alt={alt} className={className} fill={atmosphere} frameAspect={frameAspect} priority={priority} sizes={sizes} source={source} style={{ ...style, ...extra }} zoom={look.zoom / 100} />;
  // The slideshow belongs to the main photo only, never to decorative copies of it.
  return !priority || scene.slides.length < 2 ? frame(scene.source) : <Slides render={frame} scene={scene} />;
}

/** Plus/Pro slideshow: the Mode's photos cross-fade at the chosen pace. Motion off or reduced motion holds the first. */
function Slides({ scene, render }: { scene: Scene; render: (source: PhotoSource, extra?: CSSProperties) => ReactNode }) {
  const [index, setIndex] = useState(0);
  const count = scene.slides.length;
  const seconds = SLIDE_SECONDS[scene.look.slideSpeed];
  useEffect(() => {
    if (scene.still || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), seconds * 1000);
    return () => window.clearInterval(timer);
  }, [count, seconds, scene.still]);
  return (
    <span className="absolute inset-0 block" data-slide-active={index} data-slide-count={count} data-slides={scene.look.slideSpeed}>
      {scene.slides.map((slide, at) => (
        <span className="absolute inset-0 block transition-opacity duration-[1400ms] ease-in-out" data-slide={at} key={at} style={{ opacity: at === index ? 1 : 0 }}>
          {render(slide)}
        </span>
      ))}
    </span>
  );
}

/** Initials on the accent when a Mode has no photo; never a broken frame. */
function Initials({ scene, size, color, className = "" }: { scene: Scene; size: number | string; color?: string; className?: string }) {
  if (scene.photo) return null;
  return <span aria-hidden="true" className={`pointer-events-none absolute inset-0 flex items-center justify-center font-display font-extrabold leading-none tracking-[-0.06em] ${className}`} data-initials style={{ fontSize: size, color: color ?? (scene.theme.light ? "#0D0D0D" : scene.look.accent) }}>{scene.who.initials}</span>;
}

function Treatment({ scene }: { scene: Scene }) {
  if (!scene.treatment) return null;
  return <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_3px_#FF5A4F73]" data-earned-treatment />;
}

/** Room the identity keeps free above the cue, which sits at the foot of the first screen. */
const CUE_ROOM = 36;

/**
 * What covers the bottom of an edge-to-edge page, measured once per width (not while Safari's
 * toolbar collapses on scroll, so nothing jumps). `bar`: how far the small viewport (100svh, the
 * hero's height) reaches past what is actually visible, which iOS 26 Safari's floating toolbar
 * overlays; the hero ends above it. `foot`: the safe-area inset the hero's foot rises by when
 * nothing overlays (0 when the hero already ends above a toolbar). Both 0 on the server.
 */
function useBottomCover(on: boolean) {
  const [cover, setCover] = useState({ bar: 0, foot: 0 });
  useEffect(() => {
    if (!on) return;
    const probe = (css: string) => {
      const node = document.createElement("div");
      node.style.cssText = `position:fixed;left:0;width:0;visibility:hidden;pointer-events:none;${css}`;
      document.body.appendChild(node);
      return node;
    };
    const inset = probe("bottom:0;height:env(safe-area-inset-bottom,0px)");
    const small = probe("top:0;height:100svh");
    const fixed = probe("top:0;bottom:0");
    let width = 0;
    const measure = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      const visible = Math.min(fixed.getBoundingClientRect().height, window.innerHeight, window.visualViewport?.height ?? Infinity);
      const measured = Math.max(0, Math.round(small.getBoundingClientRect().height - visible));
      // iOS 26 Safari reports a small viewport that already ends above its toolbar (svh = innerHeight
      // on an iPhone 16 Pro), so only a measured overlap is taken off; never a guessed one.
      const bar = measured;
      const next = { bar, foot: bar ? 0 : Math.round(inset.getBoundingClientRect().height) };
      setCover(next);
      if (new URLSearchParams(window.location.search).has("svdebug")) {
        console.info("setuvara foot", { ...next, measured, small: small.getBoundingClientRect().height, fixed: fixed.getBoundingClientRect().height, innerHeight: window.innerHeight, visual: window.visualViewport?.height, inset: inset.getBoundingClientRect().height, ua: navigator.userAgent });
        const note = document.getElementById("sv-foot-debug") ?? document.body.appendChild(Object.assign(document.createElement("pre"), { id: "sv-foot-debug" }));
        note.style.cssText = "position:fixed;top:60px;left:8px;z-index:999;margin:0;padding:6px 8px;border-radius:8px;background:#000c;color:#fff;font:11px/1.4 ui-monospace,monospace;white-space:pre-wrap;max-width:90vw";
        note.textContent = `bar ${bar} m ${measured} svh ${Math.round(small.getBoundingClientRect().height)} fix ${Math.round(fixed.getBoundingClientRect().height)} ih ${window.innerHeight} vv ${Math.round(window.visualViewport?.height ?? 0)} in ${Math.round(inset.getBoundingClientRect().height)}\n${navigator.userAgent}`;
      }
    };
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", measure); [inset, small, fixed].forEach((node) => node.remove()); };
  }, [on]);
  return on ? cover : { bar: 0, foot: 0 };
}

// ---------------------------------------------------------------- Hero (phones)

function AppearanceHero({ scene }: { scene: Scene }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useFrame(ref);
  const { look } = scene;
  return (
    <div className="relative h-[var(--sv-h)] overflow-hidden" data-hero={look.id} ref={ref}>
      {look.id === "immersive" && <ImmersiveHero frame={frame} scene={scene} />}
      {look.id === "motion" && <MotionHero scene={scene} />}
      {look.id === "aura" && <AuraHero scene={scene} />}
      {look.id === "clean" && <CleanHero scene={scene} />}
      {look.id === "glow" && <GlowHero scene={scene} />}
      {look.id === "scene" && <SceneHero scene={scene} />}
      {look.id === "frame" && <FrameHero scene={scene} />}
      {look.id === "stack" && <StackHero frame={frame} scene={scene} />}
      {look.id === "social" && <SocialHero scene={scene} />}
      {look.id === "film" && <FilmHero scene={scene} />}
      <HeroFoot scene={scene} />
      {scene.cue(false)}
    </div>
  );
}

/**
 * The hero dissolves into the page: its last stretch eases into the Appearance base, so the
 * photo and atmosphere never end on a hard edge, wherever the page is shown (a phone, a full
 * page capture, the editor preview). It sits under the identity, so Connect stays on top.
 */
function HeroFoot({ scene, className = "" }: { scene: Scene; className?: string }) {
  if (!scene.theme.atmosphere.on) return null;
  const base = scene.theme.base;
  return <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[30%] ${className}`} data-hero-foot style={{ background: `linear-gradient(180deg,${base}00 0%,${base}24 22%,${base}73 48%,${base}C7 72%,${base}F2 88%,${base} 100%)` }} />;
}

type IdentityOptions = {
  align?: "left" | "center" | "right";
  nameSize: string;
  /** Motion: the real heading is the small name under the marquee. */
  smallName?: boolean;
  split?: boolean;
  style?: CSSProperties;
  socialSize?: number;
  connectFull?: boolean;
};

/** Name, meta, Live Context, sound line, socials and Connect, in source order. */
function IdentityLayer({ scene, options }: { scene: Scene; options: IdentityOptions }) {
  const { theme, look, copy } = scene;
  const align = options.align ?? theme.identity.align;
  const flex = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
  const id = theme.identity;
  // A bottom-anchored identity rises above the covered foot and, with a cue, above the cue's room.
  const lifted = typeof options.style?.bottom === "number" ? { bottom: `calc(${options.style.bottom}px + var(--sv-foot, 0px) + var(--sv-cue-room, 0px))` } : {};
  const top = (
    <div className="flex flex-col gap-3 self-stretch" style={{ alignItems: flex }}>
      <LiveContextPresentation context={scene.live} copy={copy} theme={theme} />
      <Name options={options} scene={scene} />
      <Meta align={flex} scene={scene} />
    </div>
  );
  const bottom = (
    <div className="flex flex-col gap-3 self-stretch" style={{ alignItems: flex }}>
      {scene.sound === "featured" && <FeaturedSoundLine accent={look.accent} color={id.muted} still={scene.still} title={scene.soundTitle} />}
      <SocialPresentation align={flex} copy={copy} links={scene.socials} size={options.socialSize} style={look.socialStyle} theme={theme} />
      <ConnectRow align={flex}>{scene.actions}</ConnectRow>
    </div>
  );
  return (
    <div
      className="absolute z-[3] flex flex-col gap-3"
      data-identity-align={align}
      style={{ color: id.fg, textAlign: align, alignItems: flex, justifyContent: options.split ? "space-between" : "flex-start", animation: look.id === "motion" && !scene.still ? "sv-rise .9s .25s both" : undefined, ...options.style, ...lifted }}
    >
      {top}
      {bottom}
    </div>
  );
}

function Name({ scene, options }: { scene: Scene; options: IdentityOptions }) {
  const { theme, who, memberTier } = scene;
  if (options.smallName) {
    return <h1 className="break-words text-[22px] font-semibold leading-tight tracking-[-0.02em]">{who.name}<NameBadge size={18} tier={memberTier} /></h1>;
  }
  const id = theme.identity;
  return (
    <h1
      className="max-w-full break-words [overflow-wrap:anywhere] [text-wrap:balance]"
      data-name
      data-name-font={scene.look.nameFont}
      style={{ ...nameTypeStyle(scene.type), fontSize: options.nameSize, textShadow: id.shadow ?? undefined }}
    >
      {who.name}<NameBadge size={22} tier={memberTier} />
    </h1>
  );
}

function Meta({ scene, align }: { scene: Scene; align: string }) {
  const { who, look, theme } = scene;
  if (!look.showUsername && !who.roleLine) return null;
  return (
    <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[15px]" data-meta style={{ color: theme.identity.muted, justifyContent: align }}>
      {look.showUsername && <span className="font-semibold" style={{ color: theme.identity.fg }}>@{who.username}</span>}
      {who.roleLine && <span>{who.roleLine}</span>}
    </p>
  );
}

/** CSS name size for the non-solved heroes: the Appearance base, scaled, fitted to the width. */
function nameSizeCss(scene: Scene, base: number, fitWidth = "calc(100cqw - 44px)") {
  const name = scene.who.name.trim();
  const longest = Math.max(1, ...name.split(/\s+/).map((part) => [...part].length));
  const factor = [...name].length > 22 ? 0.8 : 1;
  const scale = NAME_SCALE[scene.look.nameSize] * scene.type.scale;
  return `calc(min(${+(base * scale).toFixed(2)}px, ${fitWidth} / ${+(scene.type.charWidth * longest).toFixed(3)}) * ${factor})`;
}

function ImmersiveHero({ scene, frame }: { scene: Scene; frame: { width: number; height: number } }) {
  const { look, theme } = scene;
  // The identity rises by the covered foot and the cue's room: keep both free of the face.
  const lift = scene.foot + (look.scrollCue ? CUE_ROOM : 0);
  const layout = solveFaceSafe({
    frame,
    focus: scene.source ? scene.source.focus : null,
    source: scene.source,
    zoom: look.zoom / 100,
    name: scene.who.name,
    nameBase: theme.name.base,
    nameScale: NAME_SCALE[look.nameSize] * scene.type.scale,
    nameCharWidth: scene.type.charWidth,
    nameLeading: scene.type.leading,
    namePosition: look.namePosition,
    liveContext: Boolean(scene.live),
    meta: Boolean(look.showUsername || scene.who.roleLine),
    featuredSound: scene.sound === "featured",
    socialStyle: scene.socials.length ? look.socialStyle : "hidden",
    secondary: scene.secondary,
    bottomInset: lift,
  });
  const percent = (value: number) => `${((value / frame.height) * 100).toFixed(2)}%`;
  const position: CSSProperties = layout.strategy === "split" ? { top: 66, bottom: 34 } : layout.strategy === "top" ? { top: 66 } : { bottom: 34 };
  const mask = scene.photo ? immersiveMask(layout, frame.height).replace(/(-?\d+)px/g, (_, px) => percent(Number(px))) : undefined;
  const scrimOpacity = look.readability === "soft" ? 0.72 : 1;
  return (
    <>
      {scene.photo && (
        <div className="absolute inset-0 overflow-hidden" data-face-strategy={layout.strategy} data-face-shift={layout.shiftY} style={{ maskImage: mask, WebkitMaskImage: mask }}>
          <div className="absolute inset-0" data-sv-motion style={{ animation: scene.drift }}>
            <div className="absolute inset-0" style={{ transform: `translateY(${percent(layout.shiftY)})` }}>
              <Photo alt={scene.copy.photoOf.replace("{name}", scene.who.name)} fill="page" frameAspect={frame.width / frame.height} priority scene={scene} />
            </div>
          </div>
        </div>
      )}
      <Initials className="-translate-y-[12%]" scene={scene} size={150} />
      {scene.photo && <div aria-hidden="true" className="absolute inset-0" style={{ background: immersiveScrim(layout.strategy, look.readability), opacity: scrimOpacity }} />}
      {scene.photo && look.readability === "deep" && layout.strategy !== "bottom" && <div aria-hidden="true" className="absolute inset-0 bg-[#0D0D0D33]" />}
      <Treatment scene={scene} />
      <IdentityLayer options={{ align: look.align === "auto" ? layout.align : look.align, nameSize: `${layout.nameSize}px`, split: layout.strategy === "split", style: { left: 20, right: 20, ...position } }} scene={scene} />
    </>
  );
}

function MotionHero({ scene }: { scene: Scene }) {
  const { look, who } = scene;
  // The marquee band sits below the chin inside the 640px photo frame.
  const chinFraction = scene.source ? estimateFace(scene.source, { width: 390, height: 640 }, { zoom: look.zoom / 100 }).chin / 640 : 0;
  const band = `max(${y(404)}, calc(var(--sv-h) * ${+(0.7583 * chinFraction).toFixed(4)} + 14px))`;
  const marquee = Math.round(94 * NAME_SCALE[look.nameSize]);
  return (
    <>
      <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: y(640), maskImage: "linear-gradient(#000 58%,#0000 100%)", WebkitMaskImage: "linear-gradient(#000 58%,#0000 100%)" }}>
        <div className="absolute inset-0 scale-[1.06]" data-sv-motion style={{ animation: scene.drift }}>
          <Photo alt={scene.copy.photoOf.replace("{name}", who.name)} priority scene={scene} />
        </div>
        <Initials scene={scene} size={150} />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 overflow-hidden whitespace-nowrap" data-motion-marquee style={{ top: band }}>
        <div className="inline-flex" data-sv-marquee data-sv-motion style={{ animation: scene.still ? undefined : "sv-marquee 30s linear infinite", transform: scene.still ? "translateX(-4%)" : undefined }}>
          {[0, 1, 2, 3].map((copy) => (
            <span className="pr-[.3em] text-[#F5F4EF]" key={copy} style={{ ...marqueeType(scene), fontSize: marquee }}>{who.name}<span className="pl-[.3em]" style={{ color: look.accent }}>/</span></span>
          ))}
        </div>
      </div>
      <Treatment scene={scene} />
      <IdentityLayer options={{ nameSize: "22px", smallName: true, connectFull: true, style: { left: 20, right: 20, top: `calc(${band} + ${Math.round(marquee * 1.02) + 12}px)` } }} scene={scene} />
    </>
  );
}

function AuraHero({ scene }: { scene: Scene }) {
  const { who } = scene;
  const field = scene.photo ? "#2A2622" : scene.look.accent;
  return (
    <>
      <div aria-hidden="true" className="absolute left-1/2 overflow-hidden rounded-full opacity-85" data-sv-motion style={{ top: y(86), width: sized(390), height: sized(390), translate: "-50% 0", background: field, filter: "blur(22px) saturate(2.2)", animation: scene.still ? undefined : "sv-float 9s ease-in-out infinite" }}>
        <Photo scene={scene} sizes="200px" />
      </div>
      <div className="absolute left-1/2 overflow-hidden rounded-full" style={{ top: y(118), width: sized(300), height: sized(300), translate: "-50% 0", background: field, boxShadow: "0 0 0 6px #FFFFFF99, 0 40px 70px -30px #0D0D0D80" }}>
        <Photo alt={scene.copy.photoOf.replace("{name}", who.name)} priority scene={scene} sizes="300px" />
        <Initials color={scene.photo ? undefined : "#0D0D0D"} scene={scene} size={110} />
        <Treatment scene={scene} />
      </div>
      <IdentityLayer options={{ nameSize: nameSizeCss(scene, 40), style: { left: 20, right: 20, top: y(462) } }} scene={scene} />
    </>
  );
}

function CleanHero({ scene }: { scene: Scene }) {
  // The identity hangs under the photo, so the photo gives up the cue's room to keep it on screen.
  const photo = scene.look.scrollCue ? `calc(${y(548)} - ${CUE_ROOM}px)` : y(548);
  return (
    <>
      <div className="absolute inset-x-2.5 top-2.5 overflow-hidden rounded-[30px]" style={{ height: photo, background: scene.photo ? "#2A2622" : scene.look.accent }}>
        <Photo alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} />
        <Initials color={scene.photo ? undefined : inkOn(scene.look.accent)} scene={scene} size={150} />
        {scene.photo && <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,#0D0D0D40_0%,#0D0D0D00_22%,#0D0D0D00_75%,#0D0D0D59_100%)]" />}
        <Treatment scene={scene} />
      </div>
      <IdentityLayer options={{ nameSize: nameSizeCss(scene, 44), style: { left: 20, right: 20, top: `calc(${photo} + 30px)` } }} scene={scene} />
    </>
  );
}

function GlowHero({ scene }: { scene: Scene }) {
  const tall = !(scene.live || scene.secondary);
  return (
    <>
      <div aria-hidden="true" className="absolute inset-x-10 rounded-full opacity-[.42] blur-[50px]" style={{ top: y(150), height: y(460), background: scene.look.accent }} />
      <div className="absolute inset-x-[30px] overflow-hidden rounded-[200px_200px_30px_30px]" style={{ top: y(70), height: `calc(${y(tall ? 500 : 470)} - ${scene.look.scrollCue ? CUE_ROOM : 0}px)`, background: scene.photo ? "#2A2622" : "#1E1B18", boxShadow: `0 0 0 1px ${scene.look.accent}80, 0 30px 80px -30px ${scene.look.accent}` }}>
        <Photo alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} style={{ filter: "contrast(1.08) brightness(.9)" }} />
        <Initials scene={scene} size={130} />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,#07070A00_55%,#07070AB3_100%)]" />
        <Treatment scene={scene} />
      </div>
      <IdentityLayer options={{ nameSize: nameSizeCss(scene, 40), style: { left: 20, right: 20, bottom: 34 } }} scene={scene} />
    </>
  );
}

function SceneHero({ scene }: { scene: Scene }) {
  // The environment is the Mode's own first image (or video poster); otherwise the portrait itself.
  const environment = scene.images[0] ?? null;
  const cardTop = scene.live || scene.secondary ? 250 : 290;
  return (
    <>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 overflow-hidden" data-scene-environment={environment ? "content" : scene.photo ? "portrait" : "accent"} style={{ height: y(660), maskImage: "linear-gradient(#000 62%,#0000 100%)", WebkitMaskImage: "linear-gradient(#000 62%,#0000 100%)", background: scene.photo || environment ? "#222" : `linear-gradient(160deg, ${scene.look.accent}, #120F0D 75%)` }}>
        <div className="absolute inset-0" data-sv-motion style={{ animation: scene.drift }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the Mode's own content image */}
          {environment ? <img alt="" className="absolute inset-0 size-full object-cover" decoding="async" src={environment} style={{ filter: "brightness(.62) saturate(1.1)" }} />
            : <Photo scene={scene} style={{ filter: "blur(10px) brightness(.55) saturate(1.2)", transform: "scale(1.35)" }} />}
        </div>
      </div>
      <div className="absolute left-5 overflow-hidden rounded-[24px]" style={{ top: y(cardTop), width: 150, height: sized(196), background: scene.photo ? "#2A2622" : scene.look.accent, boxShadow: "0 0 0 3px #F5F4EF, 0 30px 50px -20px #000000" }}>
        <Photo alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} sizes="300px" />
        <Initials color={scene.photo ? undefined : inkOn(scene.look.accent)} scene={scene} size={56} />
        <Treatment scene={scene} />
      </div>
      <IdentityLayer options={{ align: scene.look.align === "auto" ? "left" : scene.look.align, nameSize: nameSizeCss(scene, 34, "196px"), style: { left: 20, right: 20, bottom: 34 } }} scene={scene} />
    </>
  );
}

function FrameHero({ scene }: { scene: Scene }) {
  const short = scene.live || scene.secondary;
  return (
    <>
      <div className="absolute left-1/2 w-[min(calc(100%-80px),400px)] -translate-x-1/2 bg-[#F5F4EF] p-3 shadow-[0_50px_80px_-30px_#000000D9,inset_0_2px_0_#FFFFFF]" data-frame-print style={{ top: y(84), height: `calc(${y(short ? 410 : 440)} - ${scene.look.scrollCue ? CUE_ROOM : 0}px)` }}>
        <div className="relative size-full overflow-hidden" style={{ background: scene.photo ? "#2A2622" : scene.look.accent }}>
          <Photo alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} />
          <Initials color={scene.photo ? undefined : inkOn(scene.look.accent)} scene={scene} size={120} />
          <Treatment scene={scene} />
        </div>
      </div>
      <IdentityLayer options={{ nameSize: nameSizeCss(scene, 44), style: { left: 20, right: 20, bottom: 34 } }} scene={scene} />
    </>
  );
}

function StackHero({ scene, frame }: { scene: Scene; frame: { width: number; height: number } }) {
  // Up to two of the Mode's existing images fan out behind the portrait; never invented.
  const [first, second] = scene.images;
  const k = Math.min(1, frame.height / 844);
  const card = (image: string | undefined, fallback: string): CSSProperties => (image ? {} : { background: fallback });
  return (
    <>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 origin-top" style={{ height: 844, transform: `scale(${k})` }}>
        <div className="absolute left-3 top-[126px] h-[262px] w-[196px] rotate-[-9deg] overflow-hidden rounded-[20px] bg-[#333] shadow-[0_30px_50px_-24px_#000000]" data-stack-layer={first ? "content" : "accent"} style={card(first, `linear-gradient(150deg, ${scene.look.accent}, ${scene.look.accent}55)`)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the Mode's own content image */}
          {first ? <img alt="" className="absolute inset-0 size-full object-cover" decoding="async" src={first} /> : scene.photo && <Photo scene={scene} sizes="200px" style={{ filter: "grayscale(1) contrast(1.1)", mixBlendMode: "multiply", opacity: 0.55 }} />}
        </div>
        <div className="absolute right-3 top-[108px] h-[262px] w-[196px] rotate-[8deg] overflow-hidden rounded-[20px] bg-[#333] shadow-[0_30px_50px_-24px_#000000]" data-stack-layer={second ? "content" : "accent"} style={card(second, `linear-gradient(200deg, #F5F4EF22, ${scene.look.accent}99)`)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the Mode's own content image */}
          {second && <img alt="" className="absolute inset-0 size-full object-cover" decoding="async" src={second} />}
        </div>
      </div>
      <div className="absolute left-1/2 top-0 h-[844px] w-[246px] origin-top" style={{ transform: `translateX(-50%) scale(${k})` }}>
        <div className="absolute inset-x-0 top-[74px] h-[328px] rotate-[-1.5deg] overflow-hidden rounded-[22px] shadow-[0_0_0_4px_#F5F4EF,0_40px_60px_-24px_#000000]" style={{ background: scene.photo ? "#2A2622" : scene.look.accent }}>
          <Photo alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} sizes="300px" />
          <Initials color={scene.photo ? undefined : inkOn(scene.look.accent)} scene={scene} size={96} />
          <Treatment scene={scene} />
        </div>
      </div>
      <IdentityLayer options={{ nameSize: nameSizeCss(scene, 46), style: { left: 20, right: 20, bottom: 34 } }} scene={scene} />
    </>
  );
}

function SocialHero({ scene }: { scene: Scene }) {
  // One story card fills the hero; the identity sits inside its lower edge. The Mode's pictures
  // show once, below, and the scroll cue (Swipe) says there is more instead of a duplicate peek.
  return (
    <>
      <div className="absolute inset-x-3.5 top-3.5 overflow-hidden rounded-[30px]" style={{ height: "calc(var(--sv-h) - 28px)", background: scene.photo ? "#2A2622" : scene.look.accent }}>
        <Photo alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} />
        <Initials color={scene.photo ? undefined : inkOn(scene.look.accent)} scene={scene} size={130} className="-translate-y-[18%]" />
        <div aria-hidden="true" className={`absolute inset-0 bg-[linear-gradient(180deg,#0D0D0D00_38%,#0D0D0DD9_100%)]`} />
        <Treatment scene={scene} />
      </div>
      <IdentityLayer options={{ nameSize: nameSizeCss(scene, 36), style: { left: 30, right: 30, bottom: 44 } }} scene={scene} />
    </>
  );
}

function FilmHero({ scene }: { scene: Scene }) {
  // The subtitle is the bio's first sentence; no bio means no subtitle (no new field).
  const subtitle = filmSubtitle(scene.bio);
  return (
    <>
      <div className="absolute inset-x-0 overflow-hidden" style={{ top: y(56), height: y(534), background: scene.photo ? "#2A2622" : "#1E1B18" }}>
        <div className="absolute inset-0 scale-[1.04]" data-sv-motion style={{ animation: scene.drift }}>
          <Photo alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} style={{ filter: "sepia(.18) saturate(.85) contrast(1.06)" }} />
        </div>
        <Initials scene={scene} size={140} />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,#0B0A0900_60%,#0B0A09A6_100%)]" />
        <Treatment scene={scene} />
      </div>
      {subtitle && <p className="absolute inset-x-6 line-clamp-3 text-center text-[16px] leading-[1.35] text-[#F7E9B8] [text-shadow:0_1px_2px_#000,0_0_12px_#000]" data-film-subtitle style={{ top: y(496) }}>{subtitle}</p>}
      <IdentityLayer options={{ nameSize: nameSizeCss(scene, 44), style: { left: 20, right: 20, bottom: 28 } }} scene={scene} />
    </>
  );
}

// ---------------------------------------------------------------- Wide (≥700px)

function WideHero({ scene }: { scene: Scene }) {
  const { theme, look, who, copy } = scene;
  const name = who.name.trim();
  const longest = Math.max(1, ...name.split(/\s+/).map((part) => [...part].length));
  const charWidth = scene.type.charWidth;
  const scale = NAME_SCALE[look.nameSize] * scene.type.scale;
  const nameSize = `min(max(${Math.round((look.id === "film" ? 66 : 57) * scale)}px, ${+((look.id === "film" ? 8.333 : 7.222) * scale).toFixed(3)}cqw), ${+(42 / (charWidth * longest)).toFixed(3)}cqw)`;
  const inset = theme.wide.inset;
  const centered = look.align === "center";
  const align = centered ? "center" : "flex-start";
  return (
    <div className="relative grid h-[var(--sv-h)] grid-cols-2 @min-[1100px]/profile:grid-cols-[56%_1fr]" data-wide-hero={look.id}>
      <HeroFoot className="!h-[22%]" scene={scene} />
      {STAGED.has(look.id) ? <WideStage scene={scene} /> : (
        <div className="relative overflow-hidden" style={{ margin: inset, borderRadius: theme.wide.radius, maskImage: theme.wide.mask ? "linear-gradient(90deg,#000 72%,#0000)" : undefined, WebkitMaskImage: theme.wide.mask ? "linear-gradient(90deg,#000 72%,#0000)" : undefined, background: scene.photo ? "#2A2622" : theme.light ? look.accent : "#1E1B18" }}>
          <div className="absolute inset-0" data-sv-motion style={{ animation: scene.drift }}>
            <Photo alt={copy.photoOf.replace("{name}", who.name)} priority scene={scene} sizes="56vw" />
          </div>
          <Initials scene={scene} size="clamp(120px,14cqw,200px)" />
          <Treatment scene={scene} />
          {look.id === "motion" && <WideMarquee scene={scene} />}
        </div>
      )}
      <div className="relative z-[2] flex min-w-0 flex-col justify-center gap-[max(11px,1.39cqw)] pl-[max(31px,3.89cqw)] pr-[max(44px,5.56cqw)]" style={{ color: theme.fg, alignItems: align, textAlign: centered ? "center" : undefined }}>
        <LiveContextPresentation context={scene.live} copy={copy} theme={theme} />
        <h1 className="max-w-full break-words [overflow-wrap:anywhere] [text-wrap:balance]" data-name data-name-font={look.nameFont} style={{ ...nameTypeStyle(scene.type), lineHeight: scene.type.leading - 0.02, fontSize: nameSize, textShadow: theme.identity.shadow ?? undefined }}>{who.name}<NameBadge size={30} tier={scene.memberTier} /></h1>
        {(look.showUsername || who.roleLine) && <p className="text-[max(14px,1.18cqw)]" style={{ color: theme.muted }}>{[look.showUsername ? `@${who.username}` : "", who.roleLine].filter(Boolean).join(" · ")}</p>}
        {scene.sound === "featured" && <FeaturedSoundLine accent={look.accent} color={theme.muted} still={scene.still} title={scene.soundTitle} />}
        <SocialPresentation align={align} copy={copy} links={scene.socials} size={44} style={look.socialStyle === "hidden" ? "hidden" : "rail"} theme={theme} />
        <div className="flex flex-wrap items-center gap-2.5 [--sv-connect-h:54px] [--sv-connect-px:30px] [--sv-connect-w:auto]" data-wide-connect>{scene.actions}</div>
        <WideBio scene={scene} />
        {/* Under the identity column, never across the photo. */}
        {scene.cue(true)}
      </div>
    </div>
  );
}

/** Appearances whose wide hero is a composition on the page rather than a full photo panel. */
const STAGED = new Set(["aura", "glow", "scene", "frame", "stack", "film"]);

/** The wide (tablet and desktop) left half for composed Appearances, mirroring each phone hero. */
function WideStage({ scene }: { scene: Scene }) {
  const { look, who, copy } = scene;
  const alt = copy.photoOf.replace("{name}", who.name);
  const field = scene.photo ? "#2A2622" : look.accent;
  const portrait = (sizes: string, style?: CSSProperties) => (
    <>
      <Photo alt={alt} priority scene={scene} sizes={sizes} style={style} />
      <Initials color={scene.photo ? undefined : inkOn(look.accent)} scene={scene} size="clamp(80px,10cqw,160px)" />
      <Treatment scene={scene} />
    </>
  );
  const box = "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";
  switch (look.id) {
    case "aura":
      return (
        <div className="relative" data-wide-stage="aura">
          <div aria-hidden="true" className={`${box} aspect-square w-[min(84%,calc(var(--sv-h)*.7))] overflow-hidden rounded-full opacity-85`} data-sv-motion style={{ background: field, filter: "blur(30px) saturate(2.2)" }}><Photo scene={scene} sizes="300px" /></div>
          <div className={`${box} aspect-square w-[min(66%,calc(var(--sv-h)*.56))] overflow-hidden rounded-full`} style={{ background: field, boxShadow: "0 0 0 8px #FFFFFF99, 0 50px 90px -40px #0D0D0D80" }}>{portrait("40vw")}</div>
        </div>
      );
    case "glow":
      return (
        <div className="relative" data-wide-stage="glow">
          <div aria-hidden="true" className={`${box} h-[66%] w-[52%] rounded-full opacity-[.42] blur-[70px]`} style={{ background: look.accent }} />
          <div className={`${box} aspect-[4/5] h-[min(80%,calc(var(--sv-h)*.8))] max-w-[78%] overflow-hidden rounded-[999px_999px_36px_36px]`} style={{ background: scene.photo ? "#2A2622" : "#1E1B18", boxShadow: `0 0 0 1px ${look.accent}80, 0 40px 100px -30px ${look.accent}` }}>
            {portrait("40vw", { filter: "contrast(1.08) brightness(.9)" })}
          </div>
        </div>
      );
    case "frame":
      return (
        <div className="relative" data-wide-stage="frame">
          <div className={`${box} aspect-[4/5] h-[min(76%,calc(var(--sv-h)*.76))] max-w-[80%] bg-[#F5F4EF] p-[clamp(10px,1.2cqw,18px)] shadow-[0_60px_90px_-34px_#000000D9,inset_0_2px_0_#FFFFFF]`} data-frame-print>
            <div className="relative size-full overflow-hidden" style={{ background: field }}>{portrait("40vw")}</div>
          </div>
        </div>
      );
    case "stack": {
      const [first, second] = scene.images;
      const layer = "absolute top-1/2 aspect-[3/4] h-[min(56%,calc(var(--sv-h)*.56))] overflow-hidden rounded-[22px] bg-[#333] shadow-[0_30px_60px_-24px_#000000]";
      return (
        <div className="relative" data-wide-stage="stack">
          <div aria-hidden="true" className={`${layer} left-[14%] -translate-y-[54%] rotate-[-9deg]`} data-stack-layer={first ? "content" : "accent"} style={first ? undefined : { background: `linear-gradient(150deg, ${look.accent}, ${look.accent}55)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the Mode's own content image */}
            {first && <img alt="" className="absolute inset-0 size-full object-cover" decoding="async" src={first} />}
          </div>
          <div aria-hidden="true" className={`${layer} right-[14%] -translate-y-[58%] rotate-[8deg]`} data-stack-layer={second ? "content" : "accent"} style={second ? undefined : { background: `linear-gradient(200deg, #F5F4EF22, ${look.accent}99)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the Mode's own content image */}
            {second && <img alt="" className="absolute inset-0 size-full object-cover" decoding="async" src={second} />}
          </div>
          <div className={`${box} aspect-[3/4] h-[min(66%,calc(var(--sv-h)*.66))] rotate-[-1.5deg] overflow-hidden rounded-[24px] shadow-[0_0_0_5px_#F5F4EF,0_50px_70px_-28px_#000000]`} style={{ background: field }}>{portrait("30vw")}</div>
        </div>
      );
    }
    case "scene": {
      const environment = scene.images[0] ?? null;
      return (
        <div className="relative m-5 overflow-hidden rounded-[28px]" data-scene-environment={environment ? "content" : scene.photo ? "portrait" : "accent"} data-wide-stage="scene" style={{ background: scene.photo || environment ? "#222" : `linear-gradient(160deg, ${look.accent}, #120F0D 75%)` }}>
          <div aria-hidden="true" className="absolute inset-0" data-sv-motion style={{ animation: scene.drift }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the Mode's own content image */}
            {environment ? <img alt="" className="absolute inset-0 size-full object-cover" decoding="async" src={environment} style={{ filter: "brightness(.66) saturate(1.1)" }} />
              : <Photo scene={scene} style={{ filter: "blur(14px) brightness(.55) saturate(1.2)", transform: "scale(1.3)" }} />}
          </div>
          <div className="absolute bottom-[7%] left-[7%] aspect-[3/4] h-[min(48%,calc(var(--sv-h)*.46))] overflow-hidden rounded-[24px]" style={{ background: field, boxShadow: "0 0 0 4px #F5F4EF, 0 40px 60px -20px #000000" }}>{portrait("25vw")}</div>
        </div>
      );
    }
    default: {
      // Film: letterboxed, warm, with the bio's first sentence as a subtitle.
      const subtitle = filmSubtitle(scene.bio);
      return (
        <div className="relative overflow-hidden bg-[#050404]" data-wide-stage="film">
          <div className="absolute inset-x-0 top-[11%] bottom-[11%] overflow-hidden" style={{ background: scene.photo ? "#2A2622" : "#1E1B18" }}>
            <div className="absolute inset-0 scale-[1.04]" data-sv-motion style={{ animation: scene.drift }}>
              <Photo alt={alt} priority scene={scene} sizes="56vw" style={{ filter: "sepia(.18) saturate(.85) contrast(1.06)" }} />
            </div>
            <Initials scene={scene} size="clamp(100px,12cqw,180px)" />
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,#0B0A0900_60%,#0B0A09A6_100%)]" />
            <Treatment scene={scene} />
            {subtitle && <p className="absolute inset-x-[8%] bottom-[7%] line-clamp-2 text-center text-[max(16px,1.4cqw)] leading-[1.35] text-[#F7E9B8] [text-shadow:0_1px_2px_#000,0_0_12px_#000]" data-film-subtitle>{subtitle}</p>}
          </div>
        </div>
      );
    }
  }
}

/** Motion's marquee: the signature's heavy cut, or the chosen name style. */
function marqueeType(scene: Scene): CSSProperties {
  return scene.look.nameFont === "setuvara"
    ? { fontFamily: "var(--font-bricolage), ui-sans-serif, system-ui, sans-serif", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1.02 }
    : { ...nameTypeStyle(scene.type), lineHeight: 1.02 };
}

/** Motion's name band, running across the bottom of the wide photo. */
function WideMarquee({ scene }: { scene: Scene }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[6%] overflow-hidden whitespace-nowrap" data-motion-marquee>
      <div className="inline-flex" data-sv-marquee data-sv-motion style={{ animation: scene.still ? undefined : "sv-marquee 30s linear infinite", transform: scene.still ? "translateX(-4%)" : undefined }}>
        {[0, 1, 2, 3].map((copy) => (
          <span className="pr-[.3em] text-[clamp(64px,8cqw,128px)] text-[#F5F4EF]" key={copy} style={marqueeType(scene)}>{scene.who.name}<span className="pl-[.3em]" style={{ color: scene.look.accent }}>/</span></span>
        ))}
      </div>
    </div>
  );
}

function WideBio({ scene }: { scene: Scene }) {
  const text = aboutParagraphs(scene, scene.bio ?? "")[0];
  if (!text) return null;
  return <p className="max-w-[460px] whitespace-pre-line text-[max(15px,1.25cqw)] leading-[1.45] [text-wrap:pretty]" style={{ color: scene.theme.fg }}>{text}</p>;
}

// ---------------------------------------------------------------- Identity helpers

/** Member status beside the person's name (Plus coral, Pro champagne). Derived from billing only. */
function NameBadge({ tier, size, decorative = false }: { tier: MemberTier | null; size: number; decorative?: boolean }) {
  if (!tier) return null;
  return <span className="ml-[0.2em] inline-block align-middle leading-none" data-name-badge={tier}><MemberBadge decorative={decorative} size={size} tier={tier} /></span>;
}

function inkOn(hex: string) {
  const value = /^#([\da-f]{6})$/i.exec(hex)?.[1] ?? "FF5A4F";
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? INK : PAPER;
}

// ---------------------------------------------------------------- Actions

function Actions({ mode, owner, connected, theme, copy, visitorAction, connectionContext, connectionHref, guestClaimHref, onShare, booking }: ProfileProps & { owner: boolean; connected: boolean; theme: AppearanceTheme; copy: Copy; booking?: ResolvedLink }) {
  const share = `/app/identity?mode=${mode.slug}&section=share`;
  const onShareClick = onShare ? (event: { preventDefault: () => void }) => { event.preventDefault(); onShare(); } : undefined;
  const id = theme.identity;
  const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  const primary = `inline-flex h-[var(--sv-connect-h,52px)] w-[var(--sv-connect-w,auto)] items-center justify-center gap-2.5 whitespace-nowrap rounded-full px-[var(--sv-connect-px,26px)] text-[16px] font-semibold transition hover:brightness-95 ${focus}`;
  const secondary = `inline-flex h-[var(--sv-connect-h,52px)] items-center justify-center whitespace-nowrap rounded-full px-[18px] text-[15px] font-semibold transition hover:opacity-80 ${focus}`;
  const fill = { background: "var(--sv-connect-fill)", color: "var(--sv-connect-ink)", boxShadow: "var(--sv-connect-edge)", outlineColor: id.fg } as CSSProperties;
  const line = { boxShadow: `inset 0 0 0 1.5px ${id.line}`, color: id.fg, outlineColor: id.fg } as CSSProperties;
  const dot = theme.connect.dot ? <span aria-hidden="true" className="size-2 rounded-full" style={{ background: theme.connect.dot }} /> : null;
  const eventName = setting(mode, "eventName");

  if (owner) {
    return (
      <>
        <a className={primary} data-profile-action="share" href={share} onClick={onShareClick} style={fill}>{dot}{copy.shareMode.replace("{mode}", MODE_NAMES[mode.slug])}</a>
        <a className={secondary} data-profile-action="qr" href={share} onClick={onShareClick} style={line}>{copy.showMyQr}</a>
      </>
    );
  }
  if (connected) {
    const since = [connectionContext?.event, connectionContext?.dateLabel].filter(Boolean).join(" · ");
    const label = <span className="truncate">{copy.connected}{since ? ` · ${since}` : ""}</span>;
    return (
      <>
        {connectionHref
          ? <Link aria-label={`${copy.connected}. ${copy.viewConnection}`} className={`${primary} max-w-full`} data-profile-action="connected" href={connectionHref} style={line}>{label}</Link>
          : <p aria-live="polite" className={`${primary} max-w-full`} data-profile-action="connected" style={line}>{label}</p>}
        {guestClaimHref && <Link className={`inline-flex min-h-11 items-center rounded-full bg-[#FF5A4F] px-4 text-xs font-semibold text-[#0D0D0D] ${focus}`} href={guestClaimHref} style={{ outlineColor: id.fg }}>{copy.claimSetuvara}</Link>}
      </>
    );
  }
  // No access: no fake disabled button. Only a real booking link adds a secondary action.
  return (
    <>
      {visitorAction}
      {booking && <a className={secondary} data-profile-action="book" href={booking.url} rel="noopener noreferrer" style={line} target="_blank">{copy.bookCall}</a>}
      {visitorAction && mode.slug === "event" && eventName && <p className="basis-full text-[11px]" style={{ color: id.muted }}>{copy.eventSaved.replace("{event}", eventName)}</p>}
    </>
  );
}

// ---------------------------------------------------------------- Content continuation

function aboutParagraphs(scene: Scene, bio = "") {
  const mode = scene.mode;
  const modeText = setting(mode, mode.slug === "event" ? "hereToMeet" : mode.slug === "business" ? "description" : "note");
  return [modeText, bio].filter((text, index, list) => text && list.indexOf(text) === index);
}

function AppearanceContent({ scene, profile, links, owner, footer, attribution, branded, rewards, blockTone, copy }: { scene: Scene; profile: ProfileIdentity; links: ResolvedLink[]; owner: boolean; footer?: ReactNode; attribution: boolean; branded: boolean; rewards: Partial<Record<string, string>>; blockTone: BlockTone; copy: Copy }) {
  const { theme, mode, look } = scene;
  const bio = profile.bio?.trim() ?? "";
  const paragraphs = aboutParagraphs(scene, bio);
  const hasBlocks = Boolean(mode.blocks?.some((block) => block.is_visible && !block.is_soundtrack));
  return (
    <div className="relative z-[3]" data-appearance-page style={{ background: theme.base }}>
    {/* Phones end the hero mid-pixel; the page reaches up under the fade so no hairline of the photo shows. */}
    {theme.atmosphere.on && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-[3px] h-[3px]" data-hero-seam style={{ background: theme.base }} />}
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3.5 px-4 pb-[120px] pt-1.5 @min-[700px]/profile:px-8 @min-[700px]/profile:pt-10" data-appearance-content>
      {paragraphs.length > 0 && (
        <section aria-label={copy.about} className="mb-2 flex flex-col gap-3" data-profile-about>
          {paragraphs.map((text, index) => (
            <p className={`whitespace-pre-line text-[19px] leading-[1.42] [text-wrap:pretty] ${index === 0 ? "@min-[900px]/profile:hidden" : ""}`} key={text} style={{ color: theme.fg, textAlign: theme.bioAlign }}>{text}</p>
          ))}
        </section>
      )}
      <EarnedMark copy={copy} rewards={rewards} theme={theme} />
      {mode.slug === "event" && setting(mode, "eventName") && <EventCard copy={copy} mode={mode} theme={theme} />}
      <ProfileBlocks accent={look.accent} accentInk={inkOn(look.accent)} blocks={mode.blocks} className="" gallery mediaLayout={look.mediaLayout} tone={blockTone} />
      {/* Under name: the rows skip what the name shows. In links and Both: every row stays. */}
      <Links copy={copy} links={look.socialPlacement === "name" ? links.filter((item) => !scene.socials.includes(item)) : links} scene={scene} />
      {owner && links.length === 0 && !hasBlocks && <p className="rounded-[18px] px-4 py-4 text-[13px]" style={{ color: theme.muted, boxShadow: `inset 0 0 0 1px ${theme.card.edge}` }}>{copy.noLinks}</p>}
      {footer}
      {attribution && branded && (
        <footer className="mt-10 flex flex-col items-center gap-3.5" data-attribution="setuvara">
          <span aria-hidden="true" className="h-px w-16" style={{ background: `linear-gradient(90deg,transparent,${theme.card.edge},transparent)` }} />
          <Link aria-label={copy.makeYours} className="group flex min-h-11 flex-col items-center gap-1.5 rounded-[14px] px-4 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" href={`/signup?appearance=${look.id}`} style={{ color: theme.fg, outlineColor: theme.fg }}>
            <span className="flex items-center gap-[7px] text-[15px] font-semibold tracking-[-0.02em] opacity-90 transition group-hover:opacity-100"><MeetMark className="size-4" />setuvara</span>
            <span className="flex items-center gap-1 font-label text-[9.5px] uppercase tracking-[0.22em] transition group-hover:opacity-100" style={{ color: theme.muted }}>{copy.makeYoursShort}<span aria-hidden="true">↗</span></span>
          </Link>
        </footer>
      )}
    </div>
    </div>
  );
}

function EarnedMark({ rewards, theme, copy }: { rewards: Partial<Record<string, string>>; theme: AppearanceTheme; copy: Copy }) {
  const mark = rewards.profile_mark === "signal_50_mark" ? { badge: "50", label: "Signal 50" } : rewards.profile_mark === "thousand_mark" ? { badge: "1K", label: "Thousand met" } : null;
  if (!mark) return null;
  return (
    <p aria-label={`${copy.profileMark}: ${mark.label}`} className="flex h-7 items-center gap-[7px] self-start rounded-full pl-1.5 pr-[11px] font-label text-[10.5px] uppercase tracking-[0.14em]" data-profile-mark style={{ boxShadow: `inset 0 0 0 1px ${theme.card.edge}` }}>
      <span aria-hidden="true" className="flex size-4 items-center justify-center rounded-full border-[1.5px] border-current text-[7px]">{mark.badge}</span>{mark.label}
    </p>
  );
}

function EventCard({ mode, theme, copy }: { mode: ProfileMode; theme: AppearanceTheme; copy: Copy }) {
  const where = [setting(mode, "city"), setting(mode, "dateLabel")].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] px-4 py-3.5" data-event-card style={{ background: theme.card.bg, boxShadow: `inset 0 0 0 1px ${theme.card.edge}` }}>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: theme.muted }}>{copy.atTheEvent}</span>
        <span className="break-words text-[16px] font-bold">{setting(mode, "eventName")}</span>
      </div>
      {where && <span className="shrink-0 text-right font-label text-[10.5px] uppercase tracking-[0.08em]" style={{ color: theme.muted }}>{where}</span>}
    </div>
  );
}

/** Compact link rows (62px) in their stored order. Social shows brand colour discs. */
function Links({ links, scene, copy }: { links: ResolvedLink[]; scene: Scene; copy: Copy }) {
  if (!links.length) return null;
  const { theme } = scene;
  const brand = theme.id === "social";
  const collapse = links.length >= LINK_COLLAPSE_AT;
  const shown = collapse ? links.slice(0, LINK_VISIBLE) : links;
  const rest = collapse ? links.slice(LINK_VISIBLE) : [];
  const row = (item: ResolvedLink) => (
    <li key={item.link.id}>
      <a className="flex h-[62px] items-center gap-3 rounded-[var(--sv-card-r-small,18px)] pl-2.5 pr-4 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" href={item.url} rel={item.external ? "noopener noreferrer" : undefined} style={{ background: theme.card.bg, boxShadow: `inset 0 0 0 1px ${theme.card.edge}`, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", outlineColor: theme.fg }} target={item.external ? "_blank" : undefined}>
        <span aria-hidden="true" className="grid size-[42px] shrink-0 place-items-center rounded-full [&_img]:size-[19px] [&_svg]:size-[19px]" style={{ background: brand ? brandColour(item.providerId) : theme.light ? "#0D0D0D0D" : "#F5F4EF14", color: brand ? "#FFFFFF" : theme.fg }}><LinkGlyph icon={item.icon} url={item.url} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-[15.5px] font-semibold">{item.link.title}</span>
          <span className="truncate text-[12.5px]" style={{ color: theme.muted }}>{item.display}</span>
        </span>
        <span aria-hidden="true" style={{ color: theme.muted }}>↗</span>
      </a>
    </li>
  );
  return (
    <nav aria-label={copy.links} className="mt-1.5 flex flex-col gap-2 scroll-mt-6" data-profile-links id="profile-links">
      <ul className="flex flex-col gap-2">{shown.map(row)}</ul>
      {rest.length > 0 && (
        <details className="group">
          <summary className="flex h-11 cursor-pointer list-none items-center justify-center rounded-full text-[14px] font-semibold [&::-webkit-details-marker]:hidden" style={{ boxShadow: `inset 0 0 0 1.5px ${theme.card.edge}` }}>{copy.allLinks} · {links.length}</summary>
          <ul className="mt-2 flex flex-col gap-2">{rest.map(row)}</ul>
        </details>
      )}
    </nav>
  );
}


// ---------------------------------------------------------------- Helpers

function resolveLinks(links: ProfileLink[]): ResolvedLink[] {
  return links.filter((link) => link.is_visible).flatMap((link) => {
    const provider = providerForLink(link.link_type);
    const destination = resolveStoredLink(provider.id, link.url);
    if (!destination) return [];
    return [{ link, name: provider.name === "Custom Link" ? "Link" : provider.name, url: destination.url, display: destination.displayValue, external: /^https?:/i.test(destination.url), providerId: provider.id, icon: provider.icon }];
  });
}

function setting(mode: ProfileMode, key: string) {
  const value = mode.settings[key];
  return typeof value === "string" ? value.trim() : "";
}
