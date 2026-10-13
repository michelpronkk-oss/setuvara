import "server-only";

import type { CSSProperties, ReactNode } from "react";

import { MeetMark } from "@/components/marketing/brand";
import { FramedPhoto } from "@/components/profile/focused-photo";
import { MemberBadge } from "@/components/app/status-badge";
import type { MemberTier } from "@/lib/billing/member-badge";
import type { PlanCode } from "@/lib/billing/catalog";
import { hasCapability } from "@/lib/billing/capabilities";
import { providerForLink, resolveStoredLink } from "@/lib/links/providers";
import { getMessages } from "@/lib/i18n/messages";
import { legacySource, photoSource, type PhotoSource } from "@/components/profile/photo-focus";
import { extraSlideLimit, resolveAppearance, type ResolvedAppearance } from "@/components/profile/appearance";
import { appearanceTheme, BOOKING_PROVIDERS, brandColour, contentImages, filmSubtitle, FILM_GRAIN, heroSocials, INK, NAME_SCALE, PAPER, type AppearanceTheme } from "@/components/profile/appearance-theme";
import { nameType, nameTypeStyle, type NameType } from "@/components/profile/name-type";
import { estimateFace, immersiveMask, immersiveScrim, solveFaceSafe } from "@/components/profile/face-safe";
import { PreviewBlocks, PreviewConnectRow, PreviewImage, PreviewLinkGlyph, PreviewLiveContext, PreviewScrollCue, PreviewSocials, type ResolvedLink } from "./profile-preview-primitives";
import type { BlockTone } from "@/components/profile/profile-blocks";
import type { ConnectionContext, ModeSlug, ProfileIdentity, ProfileLink, ProfileMode, PublicLiveContext, SlideImage, ViewerState } from "@/components/profile/types";
import { AppearanceEnvironment, AppearanceHero, CUE_ROOM, NameBadge, WideHero, type Scene, type Identity, type PhotoPresentationProps } from "@/components/profile/profile-presentation";

export { BOOKING_PROVIDERS } from "@/components/profile/appearance-theme";

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
  /** Marketing previews can opt into first-screen priority without changing public profile defaults. */
  marketingMediaPriority?: "high" | "normal";
  marketingPreview?: boolean;
  /**
   * The element that carries the name. The public profile's name is its page heading; marketing
   * demos pass "p" so a page showing several phones keeps one h1 of its own. Looks identical.
   */
  nameAs?: "h1" | "p";
};

type Copy = ReturnType<typeof getMessages>["profile"];
const MODE_NAMES: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" };
const LINK_COLLAPSE_AT = 9;
const LINK_VISIBLE = 6;

type ProfileProps = ProfileRendererProps & { look: ResolvedAppearance; hasSoundtrack: boolean; marketingPreview?: boolean };

function identityFor(profile: ProfileIdentity, mode: ProfileMode): Identity {
  const name = profile.display_name.trim() || `@${profile.username}`;
  const initials = name.replace(/^@/, "").split(/\s+/).map((part) => [...part][0] ?? "").slice(0, 2).join("").toUpperCase();
  const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");
  const roleLine = mode.slug === "event" ? join(setting(mode, "role"), setting(mode, "city"))
    : mode.slug === "business" ? join(setting(mode, "role"), setting(mode, "company"), setting(mode, "city"))
      : join(setting(mode, "location"), setting(mode, "pronouns"));
  return { name, initials, username: profile.username, roleLine };
}

export function MarketingProfilePreview(props: ProfileRendererProps) {
  const { mode } = props;
  const plan = props.plan ?? "free";
  // The soundtrack block is presented by the Appearance, never as a media block.
  const renderedMode = { ...mode, blocks: mode.blocks?.filter((block) => !block.is_soundtrack) };
  const look = props.previewLook ?? resolveAppearance(mode, plan);
  return <Profile {...props} hasSoundtrack={false} look={look} mode={renderedMode} marketingPreview />;
}

function MarketingPhoto({ scene, alt = "", sizes = "100vw", priority = false, priorityMedia, fill = "frame", frameAspect, cover = false, style, className = "" }: PhotoPresentationProps) {
  if (!scene.source) return null;
  const atmosphere = fill === "page" && scene.theme.atmosphere.on ? "none" : `blur(26px) saturate(${scene.theme.atmosphere.on ? scene.theme.atmosphere.saturate : 1.15}) brightness(${scene.theme.atmosphere.on ? scene.theme.atmosphere.brightness : 0.8})`;
  const source = scene.source;
  const activeHero = priority && scene.marketingMediaPriority !== "normal";
  const mediaPrioritizedHero = activeHero && Boolean(priorityMedia);
  return <FramedPhoto alt={alt} className={className} cover={cover} fill={atmosphere} fetchPriority={mediaPrioritizedHero ? "auto" : activeHero ? "high" : "low"} frameAspect={frameAspect} preloadMedia={mediaPrioritizedHero ? priorityMedia : undefined} priority={activeHero && !mediaPrioritizedHero} sizes={sizes} source={source} style={style} zoom={scene.look.zoom / 100} />;
}

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
  const cover = { bar: 0, foot: 0 };
  const frame = { width: 390, height: 844 };
  const scene: Scene = {
    look, theme, who, mode, photo, source, copy, memberTier,
    marketingMediaPriority: props.marketingMediaPriority,
    nameAs: props.nameAs ?? "h1",
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
    marketingPreview: Boolean(props.marketingPreview),
    frame,
    parts: {
      Image: PreviewImage,
      Photo: MarketingPhoto,
      LiveContext: PreviewLiveContext,
      Socials: PreviewSocials,
      ConnectRow: PreviewConnectRow,
      FeaturedSound: () => null,
    },
    cue: (wide) => {
      if (!look.scrollCue) return null;
      // The cue marks the fold: the foot of the first screen (inside Social's card on phones).
      const inCard = look.id === "social" && !wide;
      const word = look.scrollCue === "swipe" ? (wide ? copy.cueScroll : copy.cueSwipe) : look.scrollCue === "credits" ? copy.cueMore : copy.cueScroll;
      // Thumbnails (no sound) show the cue still, so ten pickers do not all move at once.
      return <PreviewScrollCue accent={look.accent} up={!wide} animated={look.scrollCueMotion && props.sound !== "off"} bottom={wide ? 22 : inCard ? 26 : 8} color={inCard ? "#F5F4EF" : look.id === "film" ? "#F7E9B8" : theme.fg} cue={look.scrollCue} label={copy.scrollMore} text={word} />;
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
      {chrome && <div className="absolute z-20 [&_a]:shadow-none" data-profile-chrome style={{ top: soundTop, right: scene.sound ? soundRight + 52 : soundRight, color: theme.pill.fg, "--sv-chrome-chip-bg": theme.pill.bg, "--sv-chrome-chip-fg": theme.pill.fg } as CSSProperties}>{chrome}</div>}

      <div className="relative z-[3] @min-[900px]/profile:hidden" data-profile-hero-mobile>
        <AppearanceHero scene={scene} />
      </div>
      <div className="relative z-[3] hidden @min-[900px]/profile:block" data-profile-hero-wide>
        <WideHero scene={scene} />
      </div>

      <AppearanceContent attribution={attribution} blockTone={blockTone} copy={copy} footer={footer} links={links} owner={owner} branded={branded} profile={profile} rewards={selectedRewards} scene={scene} />
      {floating && !props.marketingPreview && <div className="@min-[900px]/profile:hidden" data-floating-connect />}
    </article>
  );
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
          ? <a aria-label={`${copy.connected}. ${copy.viewConnection}`} className={`${primary} max-w-full`} data-profile-action="connected" href={connectionHref} style={line}>{label}</a>
          : <p aria-live="polite" className={`${primary} max-w-full`} data-profile-action="connected" style={line}>{label}</p>}
        {guestClaimHref && <a className={`inline-flex min-h-11 items-center rounded-full bg-[#FF5A4F] px-4 text-xs font-semibold text-[#0D0D0D] ${focus}`} href={guestClaimHref} style={{ outlineColor: id.fg }}>{copy.claimSetuvara}</a>}
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
      <PreviewBlocks accent={look.accent} accentInk={inkOn(look.accent)} blocks={mode.blocks} className="" gallery mediaLayout={look.mediaLayout} tone={blockTone} />
      {/* Under name: the rows skip what the name shows. In links and Both: every row stays. */}
      <Links copy={copy} links={look.socialPlacement === "name" ? links.filter((item) => !scene.socials.includes(item)) : links} scene={scene} />
      {owner && links.length === 0 && !hasBlocks && <p className="rounded-[18px] px-4 py-4 text-[13px]" style={{ color: theme.muted, boxShadow: `inset 0 0 0 1px ${theme.card.edge}` }}>{copy.noLinks}</p>}
      {footer}
      {attribution && branded && (
        <footer className="mt-10 flex flex-col items-center gap-3.5" data-attribution="setuvara">
          <span aria-hidden="true" className="h-px w-16" style={{ background: `linear-gradient(90deg,transparent,${theme.card.edge},transparent)` }} />
          <a aria-label={copy.makeYours} className="group flex min-h-11 flex-col items-center gap-1.5 rounded-[14px] px-4 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" href={`/signup?appearance=${look.id}`} style={{ color: theme.fg, outlineColor: theme.fg }}>
            <span className="flex items-center gap-[7px] text-[15px] font-semibold tracking-[-0.02em] opacity-90 transition group-hover:opacity-100"><MeetMark className="size-4" />setuvara</span>
            <span className="flex items-center gap-1 font-label text-[9.5px] uppercase tracking-[0.22em] transition group-hover:opacity-100" style={{ color: theme.muted }}>{copy.makeYoursShort}<span aria-hidden="true">↗</span></span>
          </a>
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
        <span aria-hidden="true" className="grid size-[42px] shrink-0 place-items-center rounded-full [&_img]:size-[19px] [&_svg]:size-[19px]" style={{ background: brand ? brandColour(item.providerId) : theme.light ? "#0D0D0D0D" : "#F5F4EF14", color: brand ? "#FFFFFF" : theme.fg }}><PreviewLinkGlyph icon={item.icon} url={item.url} /></span>
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
