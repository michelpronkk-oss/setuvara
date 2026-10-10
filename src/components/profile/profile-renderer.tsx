import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { LinkGlyph } from "@/components/links/provider-mark";
import { PhotoGlow } from "@/components/profile/photo-glow";
import { ProfileBlocks } from "@/components/profile/profile-blocks";
import { SoundtrackCue, SoundtrackProvider } from "@/components/profile/soundtrack";
import { MeetMark } from "@/components/marketing/brand";
import { soundtrackBlock } from "@/lib/blocks/registry";
import { providerForLink, resolveStoredLink } from "@/lib/links/providers";
import { accentLuminance, inkOnAccent, resolveModeAccent } from "./appearance";
import type { ConnectionContext, ModeSlug, ProfileIdentity, ProfileLink, ProfileMode, ViewerState } from "./types";

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
  /** Public page on a phone: the Full Bleed photo runs to the screen edges. */
  bleed?: boolean;
  /**
   * Soundtrack handling. "preview" (editor previews): never starts on its own and leaves the
   * visitor's choice alone. "off" (thumbnails): no soundtrack at all.
   */
  sound?: "live" | "preview" | "off";
};

type Tone = { bg: string; ink: string; sub: string; chip: string; line: string; dark: boolean };
type ResolvedLink = { link: ProfileLink; name: string; url: string; display: string; external: boolean; providerId: string; icon: ReturnType<typeof providerForLink>["icon"] };

/** Booking providers become the Business "Book intro" action instead of a list row. */
export const BOOKING_PROVIDERS = ["calendly", "cal_com", "booking_link", "calendar"];
/** The 60° cut that runs through the Setuvara mark, applied to hero corners. */
const cutCorner = (size: number) => `polygon(0 0,100% 0,100% calc(100% - ${size}px),calc(100% - ${Math.round(size * 0.58)}px) 100%,0 100%)`;

const tones: Record<ProfileMode["appearance"]["theme"], Tone> = {
  dark: { bg: "#0D0D0D", ink: "#F5F4EF", sub: "rgba(245,244,239,.72)", chip: "#1C1C1C", line: "rgba(245,244,239,.16)", dark: true },
  light: { bg: "#FFFFFF", ink: "#0D0D0D", sub: "rgba(13,13,13,.62)", chip: "#F5F4EF", line: "rgba(13,13,13,.12)", dark: false },
  editorial: { bg: "#F5F4EF", ink: "#0D0D0D", sub: "rgba(13,13,13,.62)", chip: "#FFFFFF", line: "rgba(13,13,13,.14)", dark: false },
};

const modeLabel: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business" };

/** Whether a Mode renders the edge-to-edge Full Bleed photo layout. */
export function isFullBleed(mode: ProfileMode) {
  return mode.slug === "personal" && Boolean(mode.image_url) && mode.appearance.layout !== "portrait-editorial";
}

/** Background and darkness of a Mode's theme, so a page can continue it past the card. */
export function profileTone(mode: Pick<ProfileMode, "slug" | "appearance">) {
  const tone = tones[mode.appearance.theme] ?? (mode.slug === "personal" ? tones.dark : tones.light);
  return { bg: tone.bg, dark: tone.dark };
}

/** Single browser/page surface color derived from the same tone as the renderer. */
export function resolvedBrowserThemeColor(mode: Pick<ProfileMode, "slug" | "appearance">): string {
  return profileTone(mode).bg;
}

export function ProfileRenderer(props: ProfileRendererProps) {
  const { mode } = props;
  const isLive = props.sound !== "off" && props.sound !== "preview";
  const renderedMode = isLive
    ? { ...mode, blocks: mode.blocks?.filter((block) => !block.is_soundtrack) }
    : mode;
  const profileProps = { ...props, mode: renderedMode };
  const profile = mode.slug === "event" ? <EventProfile {...profileProps} /> : mode.slug === "business" ? <BusinessProfile {...profileProps} /> : <PersonalProfile {...profileProps} />;
  // No soundtrack: the profile renders exactly as it always has, with no sound UI at all.
  const track = props.sound === "off" ? null : soundtrackBlock(mode);
  if (!track) return profile;
  // The public player only needs the URL. Keep editor-only titles/artwork out
  // of the public server payload while retaining the saved block in the editor.
  const playerBlock = isLive ? { ...track, data: { url: track.data.url } } : track;
  return <SoundtrackProvider block={playerBlock} key={`${mode.id}:${track.id}:${String(track.data.url)}`} preview={props.sound === "preview"}>{profile}</SoundtrackProvider>;
}

function PersonalProfile(props: ProfileRendererProps) {
  if (isFullBleed(props.mode)) return <PersonalBleed {...props} />;
  return <PersonalPortrait {...props} />;
}

/** Links that read well as a lone icon: brands plus email/phone. Everything else keeps its title. */
const isIconLink = (item: ResolvedLink) => Boolean(item.icon) || ["email", "phone", "sms"].includes(item.providerId);

/** Full Bleed: edge-to-edge photo that fades into a centred name and a row of round icons. */
function PersonalBleed({ profile, mode, viewerState, previewAsVisitor, visitorAction, connectionHref, connectionContext, guestClaimHref, onShare, onEditMode, selectedRewards = {}, bleed = false }: ProfileRendererProps) {
  const tone = tones[mode.appearance.theme] ?? tones.dark;
  const owner = viewerState === "owner" && !previewAsVisitor;
  const accent = resolveModeAccent(mode);
  const editorialName = mode.appearance.theme === "editorial" && accentLuminance(accent) < 0.55;
  const links = resolveLinks(mode.links);
  const icons = links.filter(isIconLink);
  const rows = links.filter((item) => !isIconLink(item));
  const treatment = mode.appearance.imageTreatment;
  const aspect = treatment === "compact" ? "aspect-[4/3]" : treatment === "portrait" ? "aspect-square" : "aspect-[4/5]";
  const meta = [setting(mode, "location"), setting(mode, "pronouns")].filter(Boolean).join(" · ");
  const mark = earnedMark(selectedRewards);

  return (
    <article className={`relative isolate w-full overflow-hidden ${bleed ? "max-sm:rounded-none sm:rounded-[28px]" : "rounded-[28px]"} ${treatmentClass(selectedRewards)}`} style={{ background: tone.bg, color: tone.ink }}>
      <div className={`relative w-full ${aspect}`}>
        <Image alt={profile.display_name} className="object-cover" fill priority sizes="(max-width: 640px) 100vw, 440px" src={mode.image_url!} unoptimized />
        <div className="absolute inset-x-0 top-0 h-28" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.38), transparent)" }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${tone.bg} 0%, ${hexAlpha(tone.bg, 0.92)} 14%, ${hexAlpha(tone.bg, 0.45)} 32%, transparent 52%)` }} />
        {!bleed && <TopBar tone={tone} label="PERSONAL" overlay />}
      </div>

      <div className="relative -mt-24 pb-8 text-center">
        <PhotoGlow dark={tone.dark} src={mode.image_url!} />
        <div className="relative px-6">
        {(owner || mark) && <p className="mb-2 font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: accent }}>{owner ? "Viewing your profile" : mark}</p>}
        <h1 className="break-words font-display text-[clamp(2.4rem,10.5vw,3.2rem)] font-extrabold leading-[0.92] tracking-[-0.055em]" style={{ color: editorialName ? accent : tone.ink }}>{profile.display_name}</h1>
        <p className="mt-1.5 font-label text-[12px] tracking-[0.04em]" style={{ color: tone.sub }}>@{profile.username}</p>
        {(meta || profile.bio) && <p className="mx-auto mt-3 max-w-[34ch] text-[15px] leading-[1.45]" style={{ color: tone.sub }}>{[meta, profile.bio].filter(Boolean).join(" · ")}</p>}
        <SoundtrackCue accent={accent} accentInk={inkOnAccent(accent)} align="center" className="mx-auto mt-4 max-w-[360px]" tone={tone} />

        {icons.length > 0 && (
          <ul aria-label="Links" className="mt-5 flex flex-wrap justify-center gap-2.5">
            {icons.map((item) => (
              <li key={item.link.id}>
                <a aria-label={item.link.title} className="grid size-12 place-items-center rounded-full transition hover:scale-105 [&>svg]:size-5" href={item.url} rel={item.external ? "noopener noreferrer" : undefined} style={{ background: tone.chip, color: tone.ink, boxShadow: `inset 0 0 0 1px ${tone.line}` }} target={item.external ? "_blank" : undefined} title={item.link.title}>
                  <ProviderGlyph item={item} />
                </a>
              </li>
            ))}
          </ul>
        )}

        {setting(mode, "note") && <p className="mx-auto mt-5 max-w-[36ch] text-sm leading-6" style={{ color: tone.sub }}>{setting(mode, "note")}</p>}

        <div className="text-left">
          <OwnerOrVisitorActions accent={accent} accentInk={inkOnAccent(accent)} editLabel="Edit Personal Mode" mode={mode} onEditMode={onEditMode} onShare={onShare} owner={owner} tone={tone} visitorAction={visitorAction} />
          {viewerState === "visitor_connected" && !previewAsVisitor && <ConnectedCard connectionContext={connectionContext} connectionHref={connectionHref} guestClaimHref={guestClaimHref} mode={mode} tone={tone} />}
        </div>

        <ProfileBlocks accent={accent} accentInk={inkOnAccent(accent)} blocks={mode.blocks} className="mt-6" tone={tone} />

        {rows.length > 0 && (
          <ul className="mt-6 grid gap-2.5 text-left">
            {rows.map((item) => (
              <li key={item.link.id}>
                <a className="flex min-h-14 items-center gap-3 rounded-2xl px-3.5 transition hover:opacity-85" href={item.url} rel={item.external ? "noopener noreferrer" : undefined} style={{ background: tone.chip, color: tone.ink, boxShadow: `inset 0 0 0 1px ${tone.line}` }} target={item.external ? "_blank" : undefined}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg [&>img]:size-[18px] [&>svg]:size-4" style={{ background: tone.bg }}><ProviderGlyph item={item} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{item.link.title}</span><span className="block truncate text-[12px]" style={{ color: tone.sub }}>{item.display}</span></span>
                  <span aria-hidden="true" className="text-base" style={{ color: tone.sub }}>↗</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {links.length === 0 && !hasBlocks(mode) && <div className="text-left"><EmptyLinks tone={tone} text="No links shared in this Mode yet." /></div>}
        </div>
      </div>
    </article>
  );
}

function PersonalPortrait({ profile, mode, viewerState, previewAsVisitor, visitorAction, connectionHref, connectionContext, guestClaimHref, onShare, onEditMode, selectedRewards = {} }: ProfileRendererProps) {
  const tone = tones[mode.appearance.theme] ?? tones.dark;
  const owner = viewerState === "owner" && !previewAsVisitor;
  const accent = resolveModeAccent(mode);
  const editorialName = mode.appearance.theme === "editorial" && accentLuminance(accent) < 0.55;
  const links = resolveLinks(mode.links);
  const portrait = mode.appearance.layout === "portrait-editorial";
  const heroHeight = { "full-bleed": portrait ? 340 : 400, portrait: portrait ? 300 : 330, compact: 190 }[mode.appearance.imageTreatment] ?? 340;
  const meta = [setting(mode, "location"), setting(mode, "pronouns")].filter(Boolean).join(" · ");
  const mark = earnedMark(selectedRewards);

  return (
    <article className={`relative isolate w-full overflow-hidden rounded-[28px] ${treatmentClass(selectedRewards)}`} style={{ background: tone.bg, color: tone.ink }}>
      {mode.image_url ? (
        <div className="relative" style={{ height: heroHeight, margin: portrait ? "14px 14px 0" : 0 }}>
          <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: portrait ? 22 : 0, clipPath: mode.appearance.imageTreatment === "compact" ? undefined : cutCorner(portrait ? 52 : 64) }}>
            <Image alt={profile.display_name} className="object-cover" fill priority sizes="(max-width: 768px) 100vw, 440px" src={mode.image_url} unoptimized />
            {!portrait && <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${tone.bg} 0%, ${hexAlpha(tone.bg, 0.55)} 22%, transparent 55%)` }} />}
          </div>
          <TopBar tone={tone} label="PERSONAL" overlay />
        </div>
      ) : (
        <div className="relative h-24"><TopBar tone={tone} label="PERSONAL" /></div>
      )}

      <div className={`relative px-6 pb-7 ${mode.image_url && !portrait ? "-mt-16" : "pt-4"}`}>
        {(owner || mark) && <p className="mb-2 font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: accent }}>{owner ? "Viewing your profile · Personal Mode" : mark}</p>}
        <h1 className="break-words font-display text-[clamp(2.6rem,11vw,3.4rem)] font-extrabold leading-[0.9] tracking-[-0.055em]" style={{ color: editorialName ? accent : tone.ink }}>{profile.display_name}</h1>
        {(meta || profile.bio) && <p className="mt-3 max-w-[34ch] text-[15px] leading-[1.45]" style={{ color: tone.sub }}>{[meta, profile.bio].filter(Boolean).join(" · ")}</p>}
        {setting(mode, "note") && <p className="mt-3 max-w-[36ch] text-sm leading-6" style={{ color: tone.sub }}>{setting(mode, "note")}</p>}
        <SoundtrackCue accent={accent} accentInk={inkOnAccent(accent)} className="mt-4" tone={tone} />

        <OwnerOrVisitorActions accent={accent} accentInk={inkOnAccent(accent)} editLabel="Edit Personal Mode" mode={mode} onEditMode={onEditMode} onShare={onShare} owner={owner} tone={tone} visitorAction={visitorAction} />
        {viewerState === "visitor_connected" && !previewAsVisitor && <ConnectedCard connectionContext={connectionContext} connectionHref={connectionHref} guestClaimHref={guestClaimHref} mode={mode} tone={tone} />}

        {links.length > 0 ? (
          <ul className="mt-8 flex flex-wrap gap-2">
            {links.map((item) => (
              <li key={item.link.id}>
                <a className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition hover:opacity-80" href={item.url} rel={item.external ? "noopener noreferrer" : undefined} style={{ background: tone.chip, color: tone.ink }} target={item.external ? "_blank" : undefined}>
                  <ProviderGlyph item={item} />
                  <span className="truncate">{item.link.title}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : !hasBlocks(mode) && <EmptyLinks tone={tone} text="No links shared in this Mode yet." />}
        <ProfileBlocks accent={accent} accentInk={inkOnAccent(accent)} blocks={mode.blocks} tone={tone} />
      </div>
    </article>
  );
}

function EventProfile({ profile, mode, viewerState, previewAsVisitor, visitorAction, connectionHref, connectionContext, guestClaimHref, onShare, onEditMode, selectedRewards = {} }: ProfileRendererProps) {
  const tone = tones[mode.appearance.theme] ?? tones.light;
  const owner = viewerState === "owner" && !previewAsVisitor;
  const accent = resolveModeAccent(mode);
  const bandInk = inkOnAccent(accent);
  const poster = mode.appearance.layout !== "conference-card";
  const eventName = setting(mode, "eventName");
  const where = [setting(mode, "city"), setting(mode, "dateLabel")].filter(Boolean).join(" · ");
  const links = resolveLinks(mode.links);
  const imageSize = mode.appearance.imageTreatment === "compact" ? { width: 72, height: 72 } : mode.appearance.imageTreatment === "full-bleed" ? { width: 120, height: 150 } : { width: 96, height: 120 };

  return (
    <article className={`relative isolate w-full overflow-hidden rounded-[28px] ${treatmentClass(selectedRewards)}`} style={{ background: tone.bg, color: tone.ink }}>
      <header className={`relative px-6 ${poster ? "pb-8 pt-6" : "pb-5 pt-5"}`} style={{ background: accent, color: bandInk, clipPath: cutCorner(poster ? 34 : 24) }}>
        <div className="flex items-start justify-between gap-3">
          <p className="font-label text-[10px] uppercase tracking-[0.16em]">{owner ? "Your Event Mode" : "Event Mode"}</p>
          <MeetMark className="size-5 shrink-0" />
        </div>
        <h1 className={`mt-2 break-words font-display font-extrabold leading-[0.88] tracking-[-0.055em] ${poster ? "text-[clamp(2.6rem,12vw,3.5rem)]" : "text-[2.1rem]"}`}>{eventName || (owner ? "Your next event" : profile.display_name)}</h1>
        {where && <p className="mt-2 text-[13px] font-semibold">{where}</p>}
      </header>

      <div className="px-6 pb-7 pt-6">
        <div className="flex items-end gap-4">
          {mode.image_url && <div className="relative shrink-0 overflow-hidden rounded-2xl" style={{ ...imageSize, clipPath: cutCorner(22) }}><Image alt={profile.display_name} className="object-cover" fill sizes="120px" src={mode.image_url} unoptimized /></div>}
          <div className="min-w-0 pb-1">
            <p className="break-words font-display text-[1.75rem] font-bold leading-[0.95] tracking-[-0.045em]">{profile.display_name}</p>
            {setting(mode, "role") && <p className="mt-1.5 text-[13px]" style={{ color: tone.sub }}>{setting(mode, "role")}</p>}
          </div>
        </div>
        <SoundtrackCue accent={accent} accentInk={inkOnAccent(accent)} className="mt-4" tone={tone} />
        {setting(mode, "hereToMeet") && (
          <div className="mt-5 border-t-2 pt-4" style={{ borderColor: tone.ink }}>
            <p className="font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: tone.sub }}>Here to meet</p>
            <p className="mt-1.5 text-[15px] font-semibold leading-snug">{setting(mode, "hereToMeet")}</p>
          </div>
        )}

        <OwnerOrVisitorActions accent={tone.ink} accentInk={tone.bg} editLabel="Edit Event Mode" mode={mode} onEditMode={onEditMode} onShare={onShare} owner={owner} tone={tone} visitorAction={visitorAction} />
        {!owner && eventName && viewerState !== "visitor_connected" && <p className="mt-2.5 text-center text-[11px]" style={{ color: tone.sub }}>{[eventName, setting(mode, "city"), "the time"].filter(Boolean).join(", ").replace(/, the time$/, " and the time")} are saved to the connection.</p>}
        {viewerState === "visitor_connected" && !previewAsVisitor && <ConnectedCard connectionContext={connectionContext} connectionHref={connectionHref} guestClaimHref={guestClaimHref} mode={mode} tone={tone} />}

        {links.length > 0 ? (
          <ul className="mt-7 grid grid-cols-2 gap-2">
            {links.map((item) => (
              <li className="min-w-0" key={item.link.id}>
                <a className="flex min-h-14 flex-col justify-center rounded-xl px-3 py-2 transition hover:opacity-80" href={item.url} rel={item.external ? "noopener noreferrer" : undefined} style={{ background: tone.chip, color: tone.ink }} target={item.external ? "_blank" : undefined}>
                  <span className="truncate text-[13px] font-semibold">{item.link.title}</span>
                  <span className="truncate text-[11px]" style={{ color: tone.sub }}>{metaFor(item)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : !hasBlocks(mode) && <EmptyLinks tone={tone} text={eventName ? "No links shared in this Mode yet." : "Event Mode is ready when you are."} />}
        <ProfileBlocks accent={accent} accentInk={inkOnAccent(accent)} blocks={mode.blocks} tone={tone} />
      </div>
    </article>
  );
}

function BusinessProfile({ profile, mode, viewerState, previewAsVisitor, visitorAction, connectionHref, connectionContext, guestClaimHref, onShare, onEditMode, selectedRewards = {} }: ProfileRendererProps) {
  const tone = tones[mode.appearance.theme] ?? tones.light;
  const owner = viewerState === "owner" && !previewAsVisitor;
  const accent = resolveModeAccent(mode);
  const structured = mode.appearance.layout !== "editorial-business";
  const all = resolveLinks(mode.links);
  const booking = all.find((item) => BOOKING_PROVIDERS.includes(item.providerId));
  const links = all.filter((item) => item !== booking);
  const facts = [["Role", setting(mode, "role")], ["Company", setting(mode, "company")], ["City", setting(mode, "city")]].filter((fact): fact is [string, string] => Boolean(fact[1]));
  const imageSize = mode.appearance.imageTreatment === "compact" ? { width: 64, height: 64 } : mode.appearance.imageTreatment === "full-bleed" ? { width: 132, height: 164 } : { width: 104, height: 130 };

  return (
    <article className={`relative isolate w-full overflow-hidden rounded-[28px] ${treatmentClass(selectedRewards)}`} style={{ background: tone.bg, color: tone.ink, boxShadow: tone.dark ? undefined : `inset 0 0 0 1px ${tone.line}` }}>
      <div className="px-6 pb-7 pt-6">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5"><MeetMark className="size-[18px]" /><span className="font-display text-[15px] font-bold tracking-[-0.04em]">setuvara</span></span>
          <span className="font-label text-[10px]" style={{ color: tone.sub }}>/{profile.username}</span>
        </div>

        <div className={`mt-7 flex ${structured ? "items-end" : "flex-col items-start"} gap-4`}>
          {mode.image_url && <div className="relative shrink-0 overflow-hidden rounded-2xl" style={{ ...imageSize, clipPath: cutCorner(22) }}><Image alt={profile.display_name} className="object-cover" fill sizes="132px" src={mode.image_url} unoptimized /></div>}
          <div className="min-w-0">
            {owner && <p className="mb-1.5 font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: accent === "#F5F4EF" ? tone.sub : accent }}>Viewing your profile</p>}
            <h1 className={`break-words font-display font-extrabold leading-[0.92] tracking-[-0.05em] ${structured ? "text-[2.1rem]" : "text-[clamp(2.4rem,10vw,3.1rem)]"}`}>{profile.display_name}</h1>
          </div>
        </div>

        {facts.length > 0 && (structured ? (
          <dl className="mt-5 grid border-y-2" style={{ borderColor: tone.ink, gridTemplateColumns: `repeat(${facts.length}, minmax(0, auto))` }}>
            {facts.map(([label, value], index) => (
              <div className="min-w-0 py-2.5 pr-3" key={label} style={{ borderLeft: index ? `1px solid ${tone.line}` : undefined, paddingLeft: index ? 10 : 0 }}>
                <dt className="font-label text-[9px] uppercase tracking-[0.14em]" style={{ color: tone.sub }}>{label}</dt>
                <dd className="mt-0.5 truncate text-[13px] font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="mt-3 text-[15px] font-semibold leading-snug">{facts.map(([, value]) => value).join(" · ")}</p>)}
        {setting(mode, "description") && <p className="mt-4 text-sm leading-6" style={{ color: tone.sub }}>{setting(mode, "description")}</p>}
        <SoundtrackCue accent={tone.ink} accentInk={tone.bg} className="mt-4" tone={tone} />

        {owner ? (
          <OwnerOrVisitorActions accent={tone.ink} accentInk={tone.bg} editLabel="Edit Business Mode" mode={mode} onEditMode={onEditMode} onShare={onShare} owner tone={tone} />
        ) : (
          <div className={`mt-6 grid gap-2 ${booking ? "grid-cols-2" : "grid-cols-1"}`}>
            {visitorAction && <div className="min-w-0 [&>button]:mt-0">{visitorAction}</div>}
            {booking && <a className="inline-flex min-h-12 items-center justify-center rounded-full px-4 text-sm font-semibold" href={booking.url} rel="noopener noreferrer" style={{ boxShadow: `inset 0 0 0 1.5px ${tone.ink}` }} target="_blank">{booking.link.title.length > 18 ? "Book intro" : booking.link.title}</a>}
          </div>
        )}
        {!owner && <a className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition hover:opacity-75" download href={`/${profile.username}/contact`} style={{ color: tone.ink }}><svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a1 1 0 0 1 1 1v9.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 1.4-1.4l3.3 3.3V4a1 1 0 0 1 1-1ZM5 19h14a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2Z" /></svg>Save contact</a>}
        {viewerState === "visitor_connected" && !previewAsVisitor && <ConnectedCard connectionContext={connectionContext} connectionHref={connectionHref} guestClaimHref={guestClaimHref} mode={mode} tone={tone} />}

        <ProfileBlocks accent={tone.ink} accentInk={tone.bg} blocks={mode.blocks} tone={tone} />

        {(owner ? all : links).length > 0 ? (
          <ul className="mt-7 overflow-hidden rounded-2xl" style={{ background: tone.chip }}>
            {(owner ? all : links).map((item, index) => (
              <li key={item.link.id} style={{ borderTop: index ? `1px solid ${tone.line}` : undefined }}>
                <a className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 transition hover:opacity-75" href={item.url} rel={item.external ? "noopener noreferrer" : undefined} target={item.external ? "_blank" : undefined}>
                  <span className="min-w-0 truncate text-[13px] font-semibold">{item.link.title}</span>
                  <span className="max-w-[45%] shrink-0 truncate text-[11px]" style={{ color: tone.sub }}>{metaFor(item)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : !hasBlocks(mode) && <EmptyLinks tone={tone} text="No links shared in this Mode yet." />}
      </div>
    </article>
  );
}

function TopBar({ tone, label, overlay = false }: { tone: Tone; label: string; overlay?: boolean }) {
  return (
    <div className={`absolute inset-x-0 top-0 flex items-center justify-between px-6 pt-5`} style={{ color: overlay ? "#F5F4EF" : tone.ink, textShadow: overlay ? "0 1px 12px rgba(0,0,0,.35)" : undefined }}>
      <MeetMark className="size-5" />
      <span className="font-label text-[10px] tracking-[0.16em]" style={{ opacity: 0.8 }}>{label}</span>
    </div>
  );
}

function OwnerOrVisitorActions({ owner, visitorAction, onShare, onEditMode, mode, tone, accent, accentInk, editLabel }: { owner: boolean; visitorAction?: ReactNode; onShare?: () => void; onEditMode?: () => void; mode: ProfileMode; tone: Tone; accent: string; accentInk: string; editLabel: string }) {
  if (!owner) return visitorAction ? <div className="mt-6 [&>button]:mt-0">{visitorAction}</div> : null;
  const share = `/app/identity?mode=${mode.slug}&section=share`;
  const edit = `/app/identity?mode=${mode.slug}&section=profile`;
  return (
    <div className="mt-6">
      <div className="flex gap-2">
        <a className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold" href={share} onClick={onShare ? (event) => { event.preventDefault(); onShare(); } : undefined} style={{ background: accent, color: accentInk }}>Share {modeLabel[mode.slug]} Mode</a>
        <a aria-label="Show QR code" className="inline-flex min-h-12 items-center justify-center rounded-full px-4 text-sm font-semibold" href={share} onClick={onShare ? (event) => { event.preventDefault(); onShare(); } : undefined} style={{ boxShadow: `inset 0 0 0 1.5px ${tone.ink}` }}>QR</a>
      </div>
      <a className="mt-3 inline-flex min-h-8 items-center text-xs font-semibold underline underline-offset-4" href={edit} onClick={onEditMode ? (event) => { event.preventDefault(); onEditMode(); } : undefined}>{editLabel}</a>
    </div>
  );
}

function ConnectedCard({ connectionContext, connectionHref, guestClaimHref, mode, tone }: { connectionContext?: ConnectionContext | null; connectionHref?: string; guestClaimHref?: string; mode: ProfileMode; tone: Tone }) {
  const accent = resolveModeAccent(mode);
  const where = [connectionContext?.event, connectionContext?.city].filter(Boolean);
  return (
    <section aria-label="Connection status" className="mt-4">
      <div className="flex items-center gap-2">
        <span aria-live="polite" className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full px-4 text-[13px] font-semibold" style={{ boxShadow: `inset 0 0 0 1.5px ${tone.ink}` }}>Connected <span aria-hidden="true" className="ml-1">✓</span></span>
        {connectionHref && <Link className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full px-4 text-[13px] font-semibold" href={connectionHref} style={{ background: tone.ink, color: tone.bg }}>View connection</Link>}
      </div>
      {(where.length > 0 || connectionContext?.dateLabel) && (
        <div className="mt-3 rounded-2xl bg-[#0D0D0D] px-4 py-3.5 text-[#F5F4EF]" style={{ boxShadow: tone.dark ? "inset 0 0 0 1px rgba(245,244,239,.16)" : undefined }}>
          <div className="flex justify-between font-label text-[9px] uppercase tracking-[0.14em]"><span style={{ color: accent === "#F5F4EF" ? "#C7FF4A" : accent }}>You met</span>{connectionContext?.mode && <span className="text-white/55">{connectionContext.mode} Mode shared</span>}</div>
          {where.length > 0 && <p className="mt-1.5 font-display text-xl font-bold tracking-[-0.03em]">{where[0]}{where[1] && <span className="ml-2 font-brand text-xs font-medium"><span className="mr-1.5 text-[#FF5A4F]">/</span>{where[1]}</span>}</p>}
          {connectionContext?.dateLabel && <p className="mt-1 text-[11px] text-white/60">{connectionContext.dateLabel}</p>}
        </div>
      )}
      {guestClaimHref && <div className="mt-3"><Link className="inline-flex min-h-11 items-center rounded-full bg-[#FF5A4F] px-4 text-xs font-semibold text-[#0D0D0D]" href={guestClaimHref}>Claim your Setuvara</Link><p className="mt-1.5 text-[11px] leading-5" style={{ color: tone.sub }}>Keep this connection, create your identity, and share yours next time.</p></div>}
    </section>
  );
}

const hasBlocks = (mode: ProfileMode) => Boolean(mode.blocks?.some((block) => block.is_visible && !block.is_soundtrack));

function EmptyLinks({ tone, text }: { tone: Tone; text: string }) {
  return <p className="mt-8 rounded-2xl px-4 py-4 text-[13px]" style={{ color: tone.sub, boxShadow: `inset 0 0 0 1px ${tone.line}` }}>{text}</p>;
}

function ProviderGlyph({ item }: { item: ResolvedLink }) {
  return <LinkGlyph icon={item.icon} url={item.url} />;
}

function resolveLinks(links: ProfileLink[]): ResolvedLink[] {
  return links.filter((link) => link.is_visible).flatMap((link) => {
    const provider = providerForLink(link.link_type);
    const destination = resolveStoredLink(provider.id, link.url);
    if (!destination) return [];
    return [{ link, name: provider.name === "Custom Link" ? "Link" : provider.name, url: destination.url, display: destination.displayValue, external: /^https?:/i.test(destination.url), providerId: provider.id, icon: provider.icon }];
  });
}

/** Secondary text for a link: the provider, unless the title already says it. */
function metaFor(item: ResolvedLink) {
  if (["email", "phone", "sms", "whatsapp"].includes(item.providerId)) return item.display;
  return item.link.title.trim().toLowerCase() === item.name.toLowerCase() ? item.display : item.name;
}

function setting(mode: ProfileMode, key: string) {
  const value = mode.settings[key];
  return typeof value === "string" ? value.trim() : "";
}

function earnedMark(rewards: Partial<Record<string, string>>) {
  return rewards.profile_mark === "signal_50_mark" ? "Signal 50" : rewards.profile_mark === "thousand_mark" ? "Thousand met" : null;
}

function treatmentClass(rewards: Partial<Record<string, string>>) {
  if (rewards.profile_treatment === "editorial_profile" || rewards.profile_treatment === "century_profile") return "shadow-[inset_0_0_0_2px_rgba(255,90,79,.45)]";
  if (rewards.profile_treatment === "connector_treatment") return "shadow-[inset_0_0_0_1px_rgba(255,90,79,.45)]";
  return "";
}

function hexAlpha(hex: string, alpha: number) {
  const value = /^#([\da-f]{6})$/i.exec(hex)?.[1] ?? "000000";
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

