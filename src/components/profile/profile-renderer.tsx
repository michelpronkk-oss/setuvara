import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { LinkGlyph } from "@/components/links/provider-mark";
import { FocusedPhoto } from "@/components/profile/focused-photo";
import { ProfileBlocks, type BlockTone } from "@/components/profile/profile-blocks";
import { SoundtrackPresentation, SoundtrackProvider, type SoundtrackSkin } from "@/components/profile/soundtrack";
import { MemberBadge } from "@/components/app/status-badge";
import type { MemberTier } from "@/lib/billing/member-badge";
import type { PlanCode } from "@/lib/billing/catalog";
import { hasCapability } from "@/lib/billing/capabilities";
import { soundtrackBlock } from "@/lib/blocks/registry";
import { providerForLink, resolveStoredLink } from "@/lib/links/providers";
import { getMessages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/locale";
import { modeFocus } from "./photo-focus";
import { resolveAppearance, type ResolvedAppearance } from "./appearance";
import { PAPER, resolveSkin, type Skin } from "./profile-skin";
import type { ConnectionContext, ModeSlug, ProfileIdentity, ProfileLink, ProfileMode, ViewerState } from "./types";

/**
 * The one profile renderer. The public page, the editor preview and every thumbnail draw a Mode
 * through this component, following the approved Appearance design (ProfilePreview reference):
 *
 *   hero (Cover · Framed · Portrait · Poster · Index · Full Portrait) → mark → event card → Connect + secondary
 *   → About → links → soundtrack → media → attribution
 *
 * The composition answers to its own width (container queries), not the window: below 768px it
 * is the single-column phone layout; from 768px the hero becomes a full-height column (44%,
 * Portrait 50%) beside the body.
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
  /** Paid member status resolved server-side from billing. One badge beside the name; null for Free. */
  memberTier?: MemberTier | null;
  /** Server-resolved plan controls paid visual treatments while preserving saved choices. */
  plan?: PlanCode;
  /** Locale for Setuvara-owned profile chrome; member-authored fields stay unchanged. */
  locale?: Locale;
  /** Page chrome (logo, Edit profile) placed over the hero on phones and atop the body when wide. */
  chrome?: ReactNode;
  /** Extra content after the media (the public page's shared Passport stamp). */
  footer?: ReactNode;
  /** "Made with Setuvara" under the profile. */
  attribution?: boolean;
  /**
   * An unsaved look to draw instead of the plan-resolved one (the editor's preview-before-
   * upgrade). Never used by the public page.
   */
  previewLook?: ResolvedAppearance;
  className?: string;
};

type ResolvedLink = { link: ProfileLink; name: string; url: string; display: string; external: boolean; providerId: string; icon: ReturnType<typeof providerForLink>["icon"] };
type Copy = ReturnType<typeof getMessages>["profile"];

/** Booking providers become the Business "Book a call" action instead of a list row. */
export const BOOKING_PROVIDERS = ["calendly", "cal_com", "booking_link", "calendar"];
const MODE_NAMES: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business" };
/** Text on photos: always paper over the design's ink gradient. */
const ON_PHOTO = PAPER;
const ON_PHOTO_MUTED = "#F5F4EFD9";
/** Chips and cards collapse after this many links once a Mode has eight or more. */
const LINK_COLLAPSE_AT = 8;
const LINK_VISIBLE = 6;

/** Whether a Mode's hero runs its photo edge to edge (Cover with the Full image). */
export function isFullBleed(mode: ProfileMode, plan: PlanCode = "free") {
  const look = resolveAppearance(mode, plan);
  return look.family === "full-portrait" || Boolean(mode.image_url) && look.family === "cover" && look.imageTreatment === "full-bleed";
}

/** Background and darkness of a Mode's look, so a page can continue it past the profile. */
export function profileTone(mode: Pick<ProfileMode, "slug" | "appearance">, plan: PlanCode = "free") {
  const skin = resolveSkin(resolveAppearance(mode, plan));
  return { bg: skin.page, dark: skin.dark };
}

/** Single browser/page surface color derived from the same skin as the renderer. */
export function resolvedBrowserThemeColor(mode: Pick<ProfileMode, "slug" | "appearance">, plan: PlanCode = "free"): string {
  return profileTone(mode, plan).bg;
}

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
  // The public player only needs the URL. Keep editor-only titles/artwork out
  // of the public server payload while retaining the saved block in the editor.
  const playerBlock = isLive ? { ...track, data: { url: track.data.url } } : track;
  return <SoundtrackProvider block={playerBlock} key={`${mode.id}:${track.id}:${String(track.data.url)}`} premiumPresentation={premiumSoundtrack} preview={props.sound === "preview"}>{profile}</SoundtrackProvider>;
}

type Identity = {
  name: string;
  initials: string;
  eyebrow: string;
  role: string;
  roleShort: string;
  headline: string;
  posterMeta: string;
};

function identityFor(profile: ProfileIdentity, mode: ProfileMode): Identity {
  const name = profile.display_name.trim() || `@${profile.username}`;
  const initials = name.replace(/^@/, "").split(/\s+/).map((part) => part[0] ?? "").slice(0, 2).join("").toUpperCase();
  const eventName = setting(mode, "eventName");
  const city = setting(mode, "city");
  const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");
  const shared = { name, initials };
  if (mode.slug === "event") {
    const role = setting(mode, "role");
    return { ...shared, eyebrow: join("EVENT", eventName.toUpperCase()), role: join(role, city), roleShort: role.split(/[·,]/)[0].trim().toUpperCase(), headline: eventName || name, posterMeta: join(city, setting(mode, "dateLabel")).toUpperCase() || "EVENT" };
  }
  if (mode.slug === "business") {
    const role = setting(mode, "role");
    const company = setting(mode, "company");
    return { ...shared, eyebrow: "BUSINESS", role: join(role, company, city), roleShort: role.toUpperCase(), headline: company || name, posterMeta: join(role, city).toUpperCase() || "BUSINESS" };
  }
  const location = setting(mode, "location");
  return { ...shared, eyebrow: "PERSONAL", role: join(location, setting(mode, "pronouns")), roleShort: location.toUpperCase(), headline: name, posterMeta: join("PERSONAL", location.toUpperCase()) };
}

type ProfileProps = ProfileRendererProps & { look: ResolvedAppearance; hasSoundtrack: boolean };

function Profile(props: ProfileProps) {
  const { profile, mode, look, viewerState, previewAsVisitor, selectedRewards = {}, memberTier = null, locale = "en", chrome, footer, attribution = false, className = "" } = props;
  if (look.family === "full-portrait") return <FullPortraitProfile {...props} />;
  const skin = resolveSkin(look);
  const copy = getMessages(locale).profile;
  const who = identityFor(profile, mode);
  const owner = viewerState === "owner" && !previewAsVisitor;
  const photo = mode.image_url ?? null;
  const treatment = Boolean(selectedRewards.profile_treatment);
  const family = look.family;
  const overlay = family === "cover" || family === "portrait";
  const all = resolveLinks(mode.links);
  const booking = mode.slug === "business" && !owner ? all.find((item) => BOOKING_PROVIDERS.includes(item.providerId)) : undefined;
  const links = all.filter((item) => item !== booking);
  const blockTone: BlockTone = { bg: skin.page, ink: skin.fg, sub: skin.muted, chip: skin.chip.background, line: skin.border, dark: skin.dark };
  const style = { background: skin.page, color: skin.fg, "--sv-card-r": `${skin.radius}px`, ...skin.connectVars } as CSSProperties;
  // Chrome over a photo reads paper; with no photo, the accent field carries it.
  const heroInk = photo ? ON_PHOTO : skin.onAccent;
  const chromeTone = (onHero: boolean) => ({
    color: onHero ? heroInk : skin.fg,
    "--sv-chrome-chip-bg": onHero ? "rgba(13,13,13,.45)" : skin.fg,
    "--sv-chrome-chip-fg": onHero ? PAPER : skin.page,
    textShadow: onHero && photo ? "0 1px 12px rgba(0,0,0,.35)" : undefined,
  }) as CSSProperties;

  return (
    <article
      className={`@container/profile relative isolate w-full font-brand ${className}`}
      data-image-treatment={look.imageTreatment}
      data-profile-family={family}
      data-profile-intensity={look.intensity}
      data-profile-layout={look.layout}
      data-profile-mode={look.slug}
      data-profile-theme={look.theme}
      style={style}
    >
      <div className="flex min-h-[inherit] flex-col @3xl/profile:flex-row">
        <WideHero copy={copy} look={look} memberTier={memberTier} mode={mode} photo={photo} skin={skin} treatment={treatment} who={who} />

        <div className="relative flex min-w-0 flex-1 flex-col">
          {chrome && (
            <>
              <div className={`z-20 @3xl/profile:hidden ${overlay ? "absolute inset-x-0 top-0" : "relative"}`} data-profile-chrome="mobile" style={chromeTone(overlay)}>{chrome}</div>
              <div className="hidden @3xl/profile:block" data-profile-chrome="wide" style={chromeTone(false)}>{chrome}</div>
            </>
          )}
          <MobileHero chrome={Boolean(chrome)} look={look} memberTier={memberTier} mode={mode} photo={photo} skin={skin} treatment={treatment} who={who} />

          <div className="flex flex-1 flex-col gap-4 px-[22px] pb-6 pt-[18px] @3xl/profile:gap-[22px] @3xl/profile:px-[clamp(32px,5cqw,72px)] @3xl/profile:pb-10 @3xl/profile:pt-[clamp(36px,4.4cqw,64px)]">
            <div className="flex w-full max-w-[680px] flex-1 flex-col gap-[inherit]">
              {!overlay && <WideIdentity memberTier={memberTier} skin={skin} who={who} />}
              {overlay && <WideIdentity hiddenOnWide memberTier={memberTier} skin={skin} who={who} />}
              <EarnedMark copy={copy} rewards={selectedRewards} skin={skin} />
              {mode.slug === "event" && family !== "poster" && setting(mode, "eventName") && <EventCard copy={copy} mode={mode} skin={skin} />}
              <Actions {...props} booking={booking} copy={copy} owner={owner} skin={skin} />
              <About copy={copy} mode={mode} profile={profile} skin={skin} />
              <Links copy={copy} links={links} skin={skin} />
              {props.hasSoundtrack && <SoundtrackPresentation copy={{ soundOn: copy.soundOn, soundOff: copy.soundOff, soundtrack: copy.soundtrack, nowPlaying: copy.nowPlaying, onRepeat: copy.onRepeat, title: copy.soundtrackOf.replace("{mode}", MODE_NAMES[mode.slug]) }} skin={soundtrackSkin(skin)} style={look.soundStyle} />}
              <ProfileBlocks accent={skin.accent} accentInk={skin.onAccent} blocks={mode.blocks} className="" tone={blockTone} />
              {owner && links.length === 0 && !hasBlocks(mode) && <p className="px-4 py-4 text-[13px]" style={{ color: skin.muted, borderRadius: `${skin.radius}px`, boxShadow: `inset 0 0 0 1px ${skin.border}` }}>{copy.noLinks}</p>}
              {footer}
              {attribution && <p className="mt-auto self-center pt-2 font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: skin.muted }}>{copy.madeWith}</p>}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/** One portrait composition for the public page and every editor preview. */
function FullPortraitProfile(props: ProfileProps) {
  const { profile, mode, look, viewerState, previewAsVisitor, selectedRewards = {}, memberTier = null, locale = "en", chrome, footer, attribution = false, className = "" } = props;
  const skin = resolveSkin(look);
  const copy = getMessages(locale).profile;
  const who = identityFor(profile, mode);
  const owner = viewerState === "owner" && !previewAsVisitor;
  const photo = mode.image_url;
  const focus = modeFocus(mode);
  const zoom = look.portraitZoom / 100;
  const all = resolveLinks(mode.links);
  const booking = mode.slug === "business" && !owner ? all.find((item) => BOOKING_PROVIDERS.includes(item.providerId)) : undefined;
  const links = all.filter((item) => item !== booking);
  const blockTone: BlockTone = { bg: skin.page, ink: skin.fg, sub: skin.muted, chip: skin.chip.background, line: skin.border, dark: skin.dark };
  const nameSize = { compact: "clamp(32px,8cqw,42px)", standard: "clamp(40px,11cqw,52px)", large: "clamp(48px,12cqw,62px)", statement: "clamp(56px,14cqw,72px)" }[look.portraitNameSize];
  const photoStyle: CSSProperties = { transform: `scale(${zoom})`, transformOrigin: `${focus.x}% ${focus.y}%` };
  return (
    <article className={`@container/profile relative isolate w-full bg-[#0D0D0D] font-brand text-[#F5F4EF] ${className}`} data-image-treatment={look.imageTreatment} data-portrait-zoom={look.portraitZoom} data-profile-photo={photo ? "full-portrait" : "none"} data-profile-family="full-portrait" data-profile-layout={look.layout} data-profile-mode={look.slug} data-profile-theme={look.theme} style={{ "--sv-card-r": `${skin.radius}px`, ...skin.connectVars } as CSSProperties}>
      <div className="mx-auto w-full max-w-[480px]">
        <div className="relative isolate flex flex-col justify-end overflow-hidden px-6 pb-7 pt-28 text-center" data-profile-hero="full-portrait" style={{ minHeight: photo ? "min(830px,var(--profile-vh,100svh))" : "min(460px,75svh)" }}>
          {photo && <>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" style={{ maskImage: "linear-gradient(to bottom, transparent 42%, #000 61%, #000 76%, transparent 98%)" }}><FocusedPhoto alt="" className="!blur-[16px]" focus={focus} priority sizes="(max-width: 480px) 100vw, 480px" src={photo} style={{ ...photoStyle, transform: `scale(${zoom * 1.06})` }} /></div>
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" style={{ maskImage: "linear-gradient(to bottom, #000 0%, #000 51%, transparent 79%)" }}><FocusedPhoto alt={`${who.name} portrait`} focus={focus} priority sizes="(max-width: 480px) 100vw, 480px" src={photo} style={photoStyle} /></div>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10" style={{ background: "linear-gradient(to bottom, rgba(13,13,13,.66) 0%, transparent 22%, transparent 40%, rgba(13,13,13,.36) 58%, rgba(13,13,13,.85) 75%, #0D0D0D 100%)" }} />
          </>}
          {!photo && <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-1/3 -z-10 h-px bg-white/15" />}
          {selectedRewards.profile_treatment && <span aria-hidden="true" className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_3px_#FF5A4F73]" data-earned-treatment />}
          {chrome ? <div className="absolute inset-x-0 top-0 z-20 text-left" style={{ color: PAPER, "--sv-chrome-chip-bg": "rgba(13,13,13,.55)", "--sv-chrome-chip-fg": PAPER } as CSSProperties}>{chrome}</div> : <span className="absolute left-6 top-6 font-label text-[11px] font-semibold lowercase tracking-[0.12em]">setuvara</span>}
          <span className={`absolute right-6 font-label text-[10px] font-semibold uppercase tracking-[0.16em] [text-shadow:0_1px_12px_rgba(0,0,0,.6)] ${chrome ? "top-16" : "top-6"}`}>{mode.slug}</span>
          <div className="mx-auto w-full max-w-[38rem]">
            {owner && <p className="mb-2 font-label text-[10px] uppercase tracking-[0.16em] text-white/75">{copy.viewingProfile}</p>}
            <h1 className="mx-auto max-w-[16ch] break-words font-display font-extrabold leading-[0.9] tracking-[-0.06em] [text-wrap:balance]" style={{ fontSize: who.name.length > 32 ? "clamp(30px,8cqw,42px)" : nameSize, textShadow: photo ? "0 2px 24px rgba(0,0,0,.52)" : undefined }}>{who.name}<NameBadge size={22} tier={memberTier} /></h1>
            {look.portraitShowUsername && <p className="mt-2 font-label text-[12px] tracking-[0.06em] text-white/85">@{profile.username}</p>}
            {who.role && <p className="mx-auto mt-4 max-w-[34ch] text-[14px] font-medium leading-5 text-white/85">{who.role}</p>}
            <div className="mt-6 text-left"><Actions {...props} booking={booking} copy={copy} owner={owner} skin={skin} /></div>
          </div>
        </div>
        <div className="flex flex-col gap-4 px-6 pb-10 pt-5">
          <EarnedMark copy={copy} rewards={selectedRewards} skin={skin} />
          {mode.slug === "event" && setting(mode, "eventName") && <EventCard copy={copy} mode={mode} skin={skin} />}
          <About copy={copy} mode={mode} profile={profile} skin={skin} />
          <Links copy={copy} links={links} skin={skin} />
          {props.hasSoundtrack && <SoundtrackPresentation copy={{ soundOn: copy.soundOn, soundOff: copy.soundOff, soundtrack: copy.soundtrack, nowPlaying: copy.nowPlaying, onRepeat: copy.onRepeat, title: copy.soundtrackOf.replace("{mode}", MODE_NAMES[mode.slug]) }} skin={soundtrackSkin(skin)} style={look.soundStyle} />}
          <ProfileBlocks accent={skin.accent} accentInk={skin.onAccent} blocks={mode.blocks} tone={blockTone} />
          {owner && links.length === 0 && !hasBlocks(mode) && <p className="px-4 py-4 text-[13px]" style={{ color: skin.muted, borderRadius: `${skin.radius}px`, boxShadow: `inset 0 0 0 1px ${skin.border}` }}>{copy.noLinks}</p>}
          {footer}
          {attribution && <p className="self-center pt-2 font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: skin.muted }}>{copy.madeWith}</p>}
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- Hero

type HeroProps = { look: ResolvedAppearance; skin: Skin; who: Identity; mode: ProfileMode; photo: string | null; treatment: boolean; memberTier: MemberTier | null };

/** Big image surfaces never become ovals: Compact (the circle) applies to tiles only. */
const surfaceRadius = (skin: Skin, look: ResolvedAppearance) => (look.imageTreatment === "compact" ? `${skin.radius}px` : skin.image.radius);

function MobileHero({ look, skin, who, mode, photo, treatment, memberTier, chrome }: HeroProps & { chrome: boolean }) {
  const display = { fontWeight: skin.displayWeight } as const;
  const long = who.name.length > 18;

  if (look.family === "cover") {
    const full = look.imageTreatment === "full-bleed";
    const inset = full ? 0 : 14;
    return (
      <div className="@3xl/profile:hidden" data-profile-hero="cover" style={{ padding: `${inset}px ${inset}px 0` }}>
        <div className="relative overflow-hidden" style={{ height: full ? 470 : 430, borderRadius: surfaceRadius(skin, look), boxShadow: skin.image.frame, background: skin.accent }}>
          <HeroImage initials={who.initials} initialsStyle={{ fontSize: 150, paddingBottom: 90 }} mode={mode} name={who.name} photo={photo} priority sizes="100vw" skin={skin} treatment={treatment} />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[58%]" style={{ background: "linear-gradient(#0D0D0D00,#0D0D0DB8)" }} />
          <div className="absolute inset-x-[22px] bottom-5 flex flex-col gap-[7px]" style={{ color: ON_PHOTO }}>
            <Eyebrow size={11} text={who.eyebrow} />
            <h1 className="break-words font-display leading-[0.92] tracking-[-0.05em] [text-wrap:balance]" style={{ ...display, fontSize: long ? 32 : 44 }}>{who.name}<NameBadge size={22} tier={memberTier} /></h1>
            {who.role && <p className="text-[15px]" style={{ color: ON_PHOTO_MUTED }}>{who.role}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (look.family === "portrait") {
    return (
      <div className="relative @3xl/profile:hidden" data-profile-hero="portrait" style={{ height: "calc(var(--profile-vh, 100svh) * .72)", background: skin.accent, boxShadow: skin.image.frame }}>
        <HeroImage initials={who.initials} initialsStyle={{ fontSize: 180, paddingBottom: 120 }} mode={mode} name={who.name} photo={photo} priority sizes="100vw" skin={skin} treatment={treatment} />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(#0D0D0D00,#0D0D0DCC)" }} />
        <div className="absolute inset-x-[22px] bottom-[26px] flex flex-col gap-2" style={{ color: ON_PHOTO }}>
          <h1 className="break-words font-display font-extrabold leading-[0.86] tracking-[-0.06em] [text-wrap:balance]" style={{ fontSize: long ? 40 : 60 }}>{who.name}<NameBadge size={24} tier={memberTier} /></h1>
          <p className="font-label text-[11px] uppercase tracking-[0.14em]" style={{ color: ON_PHOTO_MUTED }}>{[who.eyebrow, who.roleShort].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
    );
  }

  if (look.family === "framed") {
    const compact = look.imageTreatment === "compact";
    return (
      <div className={`flex items-end gap-[18px] px-[22px] pb-1 @3xl/profile:hidden ${chrome ? "pt-3" : "pt-7"}`} data-profile-hero="framed">
        <Tile height={compact ? 116 : 146} initialsSize={44} look={look} mode={mode} name={who.name} initials={who.initials} photo={photo} skin={skin} treatment={treatment} width={116} />
        <div className="flex min-w-0 flex-col gap-[7px] pb-1">
          <Eyebrow color={skin.muted} size={11} text={who.eyebrow} />
          <h1 className="break-words font-display leading-[0.95] tracking-[-0.045em] [text-wrap:balance]" style={{ ...display, fontSize: long ? 26 : 34 }}>{who.name}<NameBadge size={18} tier={memberTier} /></h1>
          {who.role && <p className="text-[14px] leading-[1.35]" style={{ color: skin.muted }}>{who.role}</p>}
        </div>
      </div>
    );
  }

  if (look.family === "poster") {
    return (
      <div className={`flex flex-col gap-4 px-[18px] @3xl/profile:hidden ${chrome ? "pt-2" : "pt-[22px]"}`} data-profile-hero="poster">
        <PosterBlock skin={skin} who={who} />
        <div className="flex items-center gap-3.5 px-1">
          <Tile height={72} initialsSize={28} look={look} mode={mode} name={who.name} initials={who.initials} photo={photo} skin={skin} treatment={treatment} width={72} />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="break-words font-display text-[24px] font-extrabold leading-none tracking-[-0.04em]">{who.name}<NameBadge size={16} tier={memberTier} /></h1>
            {who.role && <p className="text-[13.5px]" style={{ color: skin.muted }}>{who.role}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3.5 px-[22px] @3xl/profile:hidden ${chrome ? "pt-3" : "pt-[26px]"}`} data-profile-hero="index">
      <div className="relative size-[60px] shrink-0 overflow-hidden rounded-full" style={{ background: skin.accent }}>
        <HeroImage initials={who.initials} initialsStyle={{ fontSize: 22 }} mode={mode} name={who.name} photo={photo} sizes="60px" skin={skin} treatment={false} />
      </div>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <h1 className="break-words font-display text-[24px] leading-none tracking-[-0.04em]" style={display}>{who.name}<NameBadge size={16} tier={memberTier} /></h1>
        {who.role && <p className="text-[13.5px]" style={{ color: skin.muted }}>{who.role}</p>}
      </div>
    </div>
  );
}

/** From 768px: the hero is a full-height column beside the body (44%, Portrait 50%). */
function WideHero({ look, skin, who, mode, photo, treatment, memberTier }: HeroProps & { copy: Copy }) {
  const overlay = look.family === "cover" || look.family === "portrait";
  const inset = look.imageTreatment === "full-bleed" ? 0 : 28;
  return (
    <div className={`sticky top-0 hidden h-[var(--profile-vh,100dvh)] shrink-0 flex-col gap-[22px] @3xl/profile:flex ${look.family === "portrait" ? "w-1/2" : "w-[44%]"}`} data-profile-hero-wide={look.family} style={{ padding: inset }}>
      {look.family === "poster" && <PosterBlock skin={skin} who={who} wide />}
      <div className="relative min-h-0 flex-1 overflow-hidden" style={{ borderRadius: surfaceRadius(skin, look), boxShadow: skin.image.frame, background: skin.accent }}>
        <HeroImage initials={who.initials} initialsStyle={{ fontSize: "clamp(120px,14cqw,200px)" }} mode={mode} name={who.name} photo={photo} priority sizes="50vw" skin={skin} treatment={treatment} />
        {overlay && (
          <>
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[55%]" style={{ background: "linear-gradient(#0D0D0D00,#0D0D0DB8)" }} />
            <div className="absolute inset-x-8 bottom-[30px] flex flex-col gap-2.5" style={{ color: ON_PHOTO }}>
              <Eyebrow size={12} text={who.eyebrow} />
              <p aria-hidden="true" className="break-words font-display leading-[0.92] tracking-[-0.05em] [text-wrap:balance]" style={{ fontWeight: skin.displayWeight, fontSize: who.name.length > 18 ? "clamp(36px,4.2cqw,60px)" : "clamp(44px,5.8cqw,84px)" }}>{who.name}<NameBadge decorative size={30} tier={memberTier} /></p>
              {who.role && <p className="text-[17px]" style={{ color: ON_PHOTO_MUTED }}>{who.role}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The name block in the body. Wide Framed/Poster/Index show it here; Cover/Portrait carry the
 * name on the photo, so for them this is the accessible heading on wide screens only.
 */
function WideIdentity({ skin, who, memberTier, hiddenOnWide = false }: { skin: Skin; who: Identity; memberTier: MemberTier | null; hiddenOnWide?: boolean }) {
  if (hiddenOnWide) {
    return <h1 className="sr-only hidden @3xl/profile:block">{who.name}<NameBadge size={16} tier={memberTier} /></h1>;
  }
  return (
    <div className="hidden flex-col gap-2.5 @3xl/profile:flex" data-profile-identity="wide">
      <Eyebrow color={skin.muted} size={12} text={who.eyebrow} />
      <h1 className="break-words font-display leading-[0.92] tracking-[-0.05em] [text-wrap:balance]" style={{ fontWeight: skin.displayWeight, fontSize: who.name.length > 18 ? "clamp(36px,4.2cqw,60px)" : "clamp(44px,5.8cqw,84px)" }}>{who.name}<NameBadge size={28} tier={memberTier} /></h1>
      {who.role && <p className="text-[17px]" style={{ color: skin.muted }}>{who.role}</p>}
    </div>
  );
}

function PosterBlock({ skin, who, wide = false }: { skin: Skin; who: Identity; wide?: boolean }) {
  const filled = skin.poster.filled;
  return (
    <div className={`flex flex-col ${wide ? "gap-2.5" : "gap-3"}`} data-poster-filled={filled} style={{ background: skin.poster.background, color: skin.poster.color, padding: filled ? "18px 18px 20px" : "4px 4px 0", borderRadius: `${skin.radius}px` }}>
      <Eyebrow size={wide ? 12 : 11} text={who.posterMeta} />
      <p className="break-words font-display font-extrabold leading-[0.84] tracking-[-0.06em] [text-wrap:balance]" style={{ fontSize: wide ? "clamp(52px,5.8cqw,84px)" : who.headline.length > 12 ? "min(58px,15cqw)" : "min(72px,18.5cqw)" }}>{who.headline}</p>
    </div>
  );
}

function Tile({ width, height, initialsSize, look, skin, mode, photo, name, initials, treatment }: { width: number; height: number; initialsSize: number; look: ResolvedAppearance; skin: Skin; mode: ProfileMode; photo: string | null; name: string; initials: string; treatment: boolean }) {
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ width, height, borderRadius: skin.image.radius, boxShadow: skin.image.frame, background: skin.accent }}>
      <HeroImage frameAspect={width / height} initials={initials} initialsStyle={{ fontSize: initialsSize }} mode={mode} name={name} photo={photo} priority sizes={`${width * 2}px`} skin={skin} treatment={treatment && look.imageTreatment !== "compact"} />
    </div>
  );
}

function HeroImage({ photo, mode, name, initials, initialsStyle, skin, treatment, priority, sizes, frameAspect }: { photo: string | null; mode: ProfileMode; name: string; initials: string; initialsStyle: CSSProperties; skin: Skin; treatment: boolean; priority?: boolean; sizes: string; frameAspect?: number }) {
  return (
    <>
      {photo
        ? <FocusedPhoto alt={name} focus={modeFocus(mode)} frameAspect={frameAspect} priority={priority} sizes={sizes} src={photo} />
        : <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-display font-extrabold leading-none tracking-[-0.06em]" style={{ color: skin.onAccent, ...initialsStyle }}>{initials}</span>}
      {/* Earned profile treatment: a quiet coral ring on the image. */}
      {treatment && <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_3px_#FF5A4F73]" data-earned-treatment />}
    </>
  );
}

function Eyebrow({ text, size, color }: { text: string; size: number; color?: string }) {
  if (!text) return null;
  return <p className="font-label uppercase tracking-[0.16em]" style={{ fontSize: size, color }}>{text}</p>;
}

/** Member status beside the person's name (Plus coral, Pro champagne). */
function NameBadge({ tier, size, decorative = false }: { tier: MemberTier | null; size: number; decorative?: boolean }) {
  if (!tier) return null;
  return <span className="ml-[0.2em] inline-block align-middle leading-none" data-name-badge={tier}><MemberBadge decorative={decorative} size={size} tier={tier} /></span>;
}

// ---------------------------------------------------------------- Body

function EarnedMark({ rewards, skin, copy }: { rewards: Partial<Record<string, string>>; skin: Skin; copy: Copy }) {
  const mark = rewards.profile_mark === "signal_50_mark" ? { badge: "50", label: "Signal 50" } : rewards.profile_mark === "thousand_mark" ? { badge: "1K", label: "Thousand met" } : null;
  if (!mark) return null;
  return (
    <p aria-label={`${copy.profileMark}: ${mark.label}`} className="flex h-7 items-center gap-[7px] self-start rounded-full pl-1.5 pr-[11px] font-label text-[10.5px] uppercase tracking-[0.14em]" data-profile-mark style={{ boxShadow: `inset 0 0 0 1px ${skin.border}` }}>
      <span aria-hidden="true" className="flex size-4 items-center justify-center rounded-full border-[1.5px] border-current text-[7px]">{mark.badge}</span>{mark.label}
    </p>
  );
}

function EventCard({ mode, skin, copy }: { mode: ProfileMode; skin: Skin; copy: Copy }) {
  const where = [setting(mode, "city"), setting(mode, "dateLabel")].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5" data-event-card style={{ background: skin.eventCard.background, color: skin.eventCard.color, borderRadius: `${skin.radius}px` }}>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="font-label text-[10px] uppercase tracking-[0.16em]">{copy.atTheEvent}</span>
        <span className="break-words text-[16px] font-bold">{setting(mode, "eventName")}</span>
      </div>
      {where && <span className="shrink-0 text-right font-label text-[10.5px] uppercase tracking-[0.08em]">{where}</span>}
    </div>
  );
}

function Actions({ profile, mode, owner, skin, copy, visitorAction, viewerState, previewAsVisitor, connectionContext, connectionHref, guestClaimHref, onShare, booking }: ProfileProps & { owner: boolean; skin: Skin; copy: Copy; booking?: ResolvedLink }) {
  const connected = viewerState === "visitor_connected" && !previewAsVisitor;
  const share = `/app/identity?mode=${mode.slug}&section=share`;
  const onShareClick = onShare ? (event: { preventDefault: () => void }) => { event.preventDefault(); onShare(); } : undefined;
  const primary = { height: skin.button.height, borderRadius: skin.button.radius, background: skin.connect.background, color: skin.connect.color, boxShadow: skin.connect.edge, justifyContent: skin.button.arrow ? "space-between" : "center" } as CSSProperties;
  const secondaryStyle = { height: skin.button.secondaryHeight, borderRadius: skin.button.radius, boxShadow: skin.secondary.edge, color: skin.secondary.color, justifyContent: skin.button.arrow ? "space-between" : "center", textDecoration: skin.secondary.underline ? "underline" : undefined, textUnderlineOffset: 4 } as CSSProperties;
  const button = "flex w-full items-center gap-2.5 px-5 font-semibold transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  const focus = { outlineColor: skin.fg };
  const arrow = skin.button.arrow ? <span aria-hidden="true">→</span> : null;
  const eventName = setting(mode, "eventName");

  let first: ReactNode;
  if (owner) {
    first = <a className={`${button} text-[16px]`} data-profile-action="share" href={share} onClick={onShareClick} style={{ ...primary, ...focus }}><span>{copy.shareMode.replace("{mode}", MODE_NAMES[mode.slug])}</span>{arrow}</a>;
  } else if (connected) {
    const since = [connectionContext?.event, connectionContext?.dateLabel].filter(Boolean).join(" · ");
    const label = <span className="truncate">{copy.connected}{since ? ` · ${since}` : ""}</span>;
    const connectedStyle = { ...primary, background: "transparent", color: skin.fg, boxShadow: `inset 0 0 0 1.5px ${skin.fg}`, ...focus };
    first = connectionHref
      ? <Link aria-label={`${copy.connected}. ${copy.viewConnection}`} className={`${button} text-[16px]`} data-profile-action="connected" href={connectionHref} style={connectedStyle}>{label}{arrow}</Link>
      : <p aria-live="polite" className={`${button} text-[16px]`} data-profile-action="connected" style={connectedStyle}>{label}</p>;
  } else {
    first = visitorAction ?? null;
  }

  let second: ReactNode;
  if (owner) {
    second = <a className={`${button} text-[15px]`} data-profile-action="qr" href={share} onClick={onShareClick} style={{ ...secondaryStyle, ...focus }}><span>{copy.showMyQr}</span></a>;
  } else if (booking) {
    second = <a className={`${button} text-[15px]`} data-profile-action="book" href={booking.url} rel="noopener noreferrer" style={{ ...secondaryStyle, ...focus }} target="_blank"><span>{copy.bookCall}</span>{arrow && <span aria-hidden="true">↗</span>}</a>;
  } else {
    second = <a className={`${button} text-[15px]`} data-profile-action="save-contact" download href={`/${encodeURIComponent(profile.username)}/contact?mode=${mode.slug}`} style={{ ...secondaryStyle, ...focus }}><span>{copy.saveContact}</span></a>;
  }

  return (
    <div className="flex flex-col gap-2" data-profile-actions>
      {first}
      {second}
      {!owner && !connected && first && mode.slug === "event" && eventName && <p className="text-center text-[11px]" style={{ color: skin.muted }}>{copy.eventSaved.replace("{event}", eventName)}</p>}
      {connected && guestClaimHref && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link className="inline-flex min-h-11 items-center rounded-full bg-[#FF5A4F] px-4 text-xs font-semibold text-[#0D0D0D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" href={guestClaimHref} style={focus}>{copy.claimSetuvara}</Link>
          <p className="text-[11px] leading-5" style={{ color: skin.muted }}>{copy.keepConnection}</p>
        </div>
      )}
    </div>
  );
}

function About({ profile, mode, skin, copy }: { profile: ProfileIdentity; mode: ProfileMode; skin: Skin; copy: Copy }) {
  const modeText = setting(mode, mode.slug === "event" ? "hereToMeet" : mode.slug === "business" ? "description" : "note");
  const bio = profile.bio?.trim() ?? "";
  const paragraphs = [modeText, bio].filter((text, index, list) => text && list.indexOf(text) === index);
  if (!paragraphs.length) return null;
  const label = mode.slug === "event" && modeText ? copy.hereToMeet : copy.about;
  return (
    <section aria-label={label} className="flex flex-col gap-1.5" data-profile-about style={{ ...skin.card.style, color: skin.card.color }}>
      <h2 className="font-label text-[10.5px] font-normal uppercase tracking-[0.16em]" style={{ color: skin.card.muted }}>{label}</h2>
      {paragraphs.map((text) => <p className="max-w-[560px] whitespace-pre-line text-[15px] leading-[1.5] [text-wrap:pretty] @3xl/profile:text-[17px]" key={text}>{text}</p>)}
    </section>
  );
}

function Links({ links, skin, copy }: { links: ResolvedLink[]; skin: Skin; copy: Copy }) {
  if (!links.length) return null;
  const style = skin.links;
  const collapse = (style === "chips" || style === "cards") && links.length >= LINK_COLLAPSE_AT;
  const shown = collapse ? links.slice(0, LINK_VISIBLE) : links;
  const rest = collapse ? links.slice(LINK_VISIBLE) : [];
  const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  const anchor = (item: ResolvedLink) => ({ href: item.url, rel: item.external ? "noopener noreferrer" : undefined, target: item.external ? "_blank" : undefined, style: { outlineColor: skin.fg } });

  const list = (items: ResolvedLink[]) => (
    <ul className="flex flex-col" data-links-style="list" style={{ color: skin.fg }}>
      {items.map((item) => (
        <li key={item.link.id} style={{ borderTop: `1px solid ${skin.rule}` }}>
          <a {...anchor(item)} className={`flex min-h-[50px] items-center justify-between gap-3 transition hover:opacity-75 ${focus}`}>
            <span className="flex min-w-0 items-center gap-3 [&>img]:size-[18px] [&>svg]:size-[18px]"><LinkGlyph icon={item.icon} url={item.url} /><span className="min-w-0 truncate text-[16px] font-semibold">{item.link.title}</span></span>
            <span className="max-w-[48%] shrink-0 truncate font-label text-[11px]" style={{ color: skin.muted }}>{item.display} <span aria-hidden="true">↗</span></span>
          </a>
        </li>
      ))}
    </ul>
  );

  let body: ReactNode;
  if (style === "list") {
    body = list(shown);
  } else if (style === "icons") {
    body = (
      <ul className="flex flex-wrap gap-2.5" data-links-style="icons">
        {shown.map((item) => (
          <li key={item.link.id}>
            <a {...anchor(item)} aria-label={item.link.title} className={`grid size-12 place-items-center rounded-full transition hover:scale-105 [&>img]:size-5 [&>svg]:size-5 ${focus}`} style={{ ...anchor(item).style, background: skin.icon.background, color: skin.icon.color, boxShadow: skin.icon.edge }} title={item.link.title}>
              <LinkGlyph icon={item.icon} url={item.url} />
            </a>
          </li>
        ))}
      </ul>
    );
  } else if (style === "chips") {
    body = (
      <ul className="flex flex-wrap gap-2" data-links-style="chips">
        {shown.map((item) => (
          <li className="min-w-0 max-w-full" key={item.link.id}>
            <a {...anchor(item)} className={`flex h-11 max-w-full items-center gap-2 rounded-full pl-3.5 pr-4 text-[14px] font-semibold transition hover:opacity-80 [&>img]:size-4 [&>svg]:size-4 ${focus}`} style={{ ...anchor(item).style, background: skin.chip.background, color: skin.chip.color }}><LinkGlyph icon={item.icon} url={item.url} /><span className="truncate">{item.link.title}</span></a>
          </li>
        ))}
      </ul>
    );
  } else {
    body = (
      <ul className="grid grid-cols-2 gap-2" data-links-style="cards">
        {shown.map((item) => (
          <li className="min-w-0" key={item.link.id}>
            <a {...anchor(item)} className={`flex min-h-[72px] flex-col justify-between gap-1.5 px-3.5 py-3 transition hover:opacity-85 ${focus}`} style={{ ...anchor(item).style, borderRadius: `${skin.radius}px`, background: skin.card.style.background === "transparent" ? "transparent" : skin.card.style.background, boxShadow: skin.card.edge, color: skin.card.color }}>
              <span className="flex min-w-0 items-center justify-between gap-2 [&>img]:size-[18px] [&>svg]:size-[18px]"><LinkGlyph icon={item.icon} url={item.url} /><span className="min-w-0 truncate font-label text-[10px]" style={{ color: skin.card.muted }}>{item.display}</span></span>
              <span className="truncate text-[15px] font-semibold">{item.link.title}</span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <nav aria-label={copy.links} className="flex flex-col gap-2" data-profile-links>
      {body}
      {rest.length > 0 && (
        <details className="group">
          <summary className={`flex h-11 cursor-pointer list-none items-center justify-center rounded-full text-[14px] font-semibold [&::-webkit-details-marker]:hidden ${focus}`} style={{ boxShadow: `inset 0 0 0 1.5px ${skin.border}`, outlineColor: skin.fg }}>{copy.allLinks} · {links.length}</summary>
          <div className="mt-2">{list(rest)}</div>
        </details>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------- Helpers

function soundtrackSkin(skin: Skin): SoundtrackSkin {
  return { fg: skin.fg, page: skin.page, muted: skin.muted, border: skin.border, accent: skin.accent, onAccent: skin.onAccent, cardRadius: `${skin.radius}px`, artRadius: `${skin.artRadius}px`, strip: skin.strip };
}

const hasBlocks = (mode: ProfileMode) => Boolean(mode.blocks?.some((block) => block.is_visible && !block.is_soundtrack));

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
