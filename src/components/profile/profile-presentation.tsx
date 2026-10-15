import type { CSSProperties, ReactNode, RefObject } from "react";
import { MemberBadge } from "@/components/app/status-badge";
import type { MemberTier } from "@/lib/billing/member-badge";
import type { PhotoSource } from "@/components/profile/photo-focus";
import type { ResolvedAppearance, SocialStyle, ScrollCue as CueId } from "@/components/profile/appearance";
import { INK, NAME_SCALE, PAPER, filmSubtitle, type AppearanceTheme } from "@/components/profile/appearance-theme";
import { nameTypeStyle, type NameType } from "@/components/profile/name-type";
import { estimateFace, immersiveMask, immersiveScrim, solveFaceSafe } from "@/components/profile/face-safe";
import type { PublicLiveContext, ProfileMode } from "@/components/profile/types";
import type { ResolvedLink } from "@/components/profile/appearance-parts";

export type Identity = { name: string; initials: string; username: string; roleLine: string };
type Copy = { photoOf: string; cueScroll: string; cueSwipe: string; cueMore: string; scrollMore: string; platforms: string; links: string; live: string; until: string; today: string };
type ImageProps = { src: string; alt?: string; className?: string; sizes?: string; style?: CSSProperties };
type SocialProps = { links: ResolvedLink[]; style: SocialStyle; theme: AppearanceTheme; align: "flex-start" | "center" | "flex-end"; size?: number; copy: { platforms: string; links: string } };
export type PhotoPresentationProps = { scene: Scene; alt?: string; sizes?: string; priority?: boolean; priorityMedia?: string; fill?: "frame" | "page"; frameAspect?: number; cover?: boolean; style?: CSSProperties; className?: string };
type PhotoProps = PhotoPresentationProps;
type Parts = { Image: (props: ImageProps) => ReactNode; Photo: (props: PhotoProps) => ReactNode; LiveContext: (props: { context: PublicLiveContext | null; copy: Copy; theme: AppearanceTheme }) => ReactNode; Socials: (props: SocialProps) => ReactNode; ConnectRow: (props: { align: "flex-start" | "center" | "flex-end"; children: ReactNode }) => ReactNode; FeaturedSound: (props: { accent: string; color: string; still: boolean; title: string }) => ReactNode };

function inkOn(hex: string) {
  const value = /^#([\da-f]{6})$/i.exec(hex)?.[1] ?? "FF5A4F";
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? INK : PAPER;
}

function aboutParagraphs(scene: Scene, bio = "") {
  const modeText = scene.mode.settings[scene.mode.slug === "event" ? "hereToMeet" : scene.mode.slug === "business" ? "description" : "note"];
  return [typeof modeText === "string" ? modeText.trim() : "", bio].filter((text, index, list) => text && list.indexOf(text) === index);
}

export type Scene = {
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
  marketingMediaPriority?: "high" | "normal";
  marketingPreview: boolean;
  nameAs: "h1" | "p";
  parts: Parts;
  frame: { width: number; height: number };
  frameRef?: RefObject<HTMLDivElement | null>;
};

function SceneImage({ scene, ...props }: ImageProps & { scene: Scene }) { const Image = scene.parts.Image; return <Image {...props} />; }
function ScenePhoto(props: PhotoProps) { const Photo = props.scene.parts.Photo; return <Photo {...props} />; }
function SceneLiveContext({ scene, ...props }: { scene: Scene; context: PublicLiveContext | null; copy: Copy; theme: AppearanceTheme }) { const Live = scene.parts.LiveContext; return <Live {...props} />; }
function SceneSocials({ scene, ...props }: { scene: Scene } & SocialProps) { const Socials = scene.parts.Socials; return <Socials {...props} />; }
function SceneConnectRow({ scene, ...props }: { scene: Scene; align: "flex-start" | "center" | "flex-end"; children: ReactNode }) { const Row = scene.parts.ConnectRow; return <Row {...props} />; }
function SceneFeaturedSound({ scene, ...props }: { scene: Scene; accent: string; color: string; still: boolean; title: string }) { const Sound = scene.parts.FeaturedSound; return <Sound {...props} />; }

// ---------------------------------------------------------------- Environment

const y = (px: number) => `calc(var(--sv-h) * ${+(px / 844).toFixed(4)})`;
const sized = (px: number) => `min(${px}px, ${y(px)})`;

/**
 * The photo atmosphere: one blurred layer of the same image (no second download, no seams),
 * pinned behind the page while it scrolls. Scene uses its environment; Clean has none.
 */
export function AppearanceEnvironment({ scene }: { scene: Scene }) {
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
        {source && <SceneImage scene={scene} alt="" className="absolute -inset-10 size-[calc(100%+80px)] max-w-none object-cover" sizes="320px" src={source} style={{ filter: `blur(var(--sv-env-blur)) saturate(${atmosphere.saturate}) brightness(${atmosphere.brightness})` }} />}
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
export const CUE_ROOM = 36;

/**
 * What covers the bottom of an edge-to-edge page, measured once per width (not while Safari's
 * toolbar collapses on scroll, so nothing jumps). `bar`: how far the small viewport (100svh, the
 * hero's height) reaches past what is actually visible, which iOS 26 Safari's floating toolbar
 * overlays; the hero ends above it. `foot`: the safe-area inset the hero's foot rises by when
 * nothing overlays (0 when the hero already ends above a toolbar). Both 0 on the server.
 */
function useBottomCover(on: boolean) { return on ? { bar: 0, foot: 0 } : { bar: 0, foot: 0 }; }

// ---------------------------------------------------------------- Hero (phones)

export function AppearanceHero({ scene }: { scene: Scene }) {
  const frame = scene.frame;
  const { look } = scene;
  return (
    <div className="relative h-[var(--sv-h)] overflow-hidden" data-hero={look.id} ref={scene.frameRef}>
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
      <SceneLiveContext scene={scene} context={scene.live} copy={copy} theme={theme} />
      <Name options={options} scene={scene} />
      <Meta align={flex} scene={scene} />
      {scene.sound === "featured" && <SceneFeaturedSound scene={scene} accent={look.accent} color={id.muted} still={scene.still} title={scene.soundTitle} />}
    </div>
  );
  const bottom = (
    <div className="flex flex-col gap-3 self-stretch" style={{ alignItems: flex }}>
      <SceneSocials scene={scene} align={flex} copy={copy} links={scene.socials} size={options.socialSize} style={look.socialStyle} theme={theme} />
      <SceneConnectRow scene={scene} align={flex}>{scene.actions}</SceneConnectRow>
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
  const { theme, who, memberTier, nameAs: NameTag } = scene;
  if (options.smallName) {
    return <NameTag className="break-words text-[22px] font-semibold leading-tight tracking-[-0.02em]">{who.name}<NameBadge size={18} tier={memberTier} /></NameTag>;
  }
  const id = theme.identity;
  return (
    <NameTag
      className="max-w-full break-words [overflow-wrap:anywhere] [text-wrap:balance]"
      data-name
      data-name-font={scene.look.nameFont}
      style={{ ...nameTypeStyle(scene.type), fontSize: options.nameSize, textShadow: id.shadow ?? undefined }}
    >
      {who.name}<NameBadge size={22} tier={memberTier} />
    </NameTag>
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
              <ScenePhoto alt={scene.copy.photoOf.replace("{name}", scene.who.name)} fill="page" frameAspect={frame.width / frame.height} priority scene={scene} />
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
          <ScenePhoto alt={scene.copy.photoOf.replace("{name}", who.name)} priority scene={scene} />
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
        <ScenePhoto cover frameAspect={1} scene={scene} sizes="200px" />
      </div>
      <div className="absolute left-1/2 overflow-hidden rounded-full" style={{ top: y(118), width: sized(300), height: sized(300), translate: "-50% 0", background: field, boxShadow: "0 0 0 6px #FFFFFF99, 0 40px 70px -30px #0D0D0D80" }}>
        <ScenePhoto alt={scene.copy.photoOf.replace("{name}", who.name)} cover frameAspect={1} priority scene={scene} sizes="300px" />
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
        <ScenePhoto alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} />
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
        <ScenePhoto alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} style={{ filter: "contrast(1.08) brightness(.9)" }} />
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
            : <ScenePhoto scene={scene} style={{ filter: "blur(10px) brightness(.55) saturate(1.2)", transform: "scale(1.35)" }} />}
        </div>
      </div>
      <div className="absolute left-5 overflow-hidden rounded-[24px]" style={{ top: y(cardTop), width: 150, height: sized(196), background: scene.photo ? "#2A2622" : scene.look.accent, boxShadow: "0 0 0 3px #F5F4EF, 0 30px 50px -20px #000000" }}>
        <ScenePhoto alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} sizes="300px" />
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
          <ScenePhoto alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} />
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
          {first ? <SceneImage scene={scene} alt="" className="absolute inset-0 size-full object-cover" sizes="196px" src={first} /> : scene.photo && <ScenePhoto scene={scene} sizes="200px" style={{ filter: "grayscale(1) contrast(1.1)", mixBlendMode: "multiply", opacity: 0.55 }} />}
        </div>
        <div className="absolute right-3 top-[108px] h-[262px] w-[196px] rotate-[8deg] overflow-hidden rounded-[20px] bg-[#333] shadow-[0_30px_50px_-24px_#000000]" data-stack-layer={second ? "content" : "accent"} style={card(second, `linear-gradient(200deg, #F5F4EF22, ${scene.look.accent}99)`)}>
          {second && <SceneImage scene={scene} alt="" className="absolute inset-0 size-full object-cover" sizes="196px" src={second} />}
        </div>
      </div>
      <div className="absolute left-1/2 top-0 h-[844px] w-[246px] origin-top" style={{ transform: `translateX(-50%) scale(${k})` }}>
        <div className="absolute inset-x-0 top-[74px] h-[328px] rotate-[-1.5deg] overflow-hidden rounded-[22px] shadow-[0_0_0_4px_#F5F4EF,0_40px_60px_-24px_#000000]" style={{ background: scene.photo ? "#2A2622" : scene.look.accent }}>
          <ScenePhoto alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} sizes="300px" />
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
        <ScenePhoto alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} />
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
          <ScenePhoto alt={scene.copy.photoOf.replace("{name}", scene.who.name)} priority scene={scene} style={{ filter: "sepia(.18) saturate(.85) contrast(1.06)" }} />
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

export function WideHero({ scene }: { scene: Scene }) {
  const { theme, look, who, copy } = scene;
  const name = who.name.trim();
  const longest = Math.max(1, ...name.split(/\s+/).map((part) => [...part].length));
  const charWidth = scene.type.charWidth;
  const scale = NAME_SCALE[look.nameSize] * scene.type.scale;
  // Fitted to the column, and capped so a very wide window never turns the name into a billboard.
  const nameSize = `min(max(${Math.round((look.id === "film" ? 66 : 57) * scale)}px, ${+((look.id === "film" ? 8.333 : 7.222) * scale).toFixed(3)}cqw), ${+(42 / (charWidth * longest)).toFixed(3)}cqw, ${Math.round((look.id === "film" ? 156 : 144) * scale)}px)`;
  const inset = theme.wide.inset;
  const centered = look.align === "center";
  const align = centered ? "center" : "flex-start";
  const { eyebrow, meta } = wideIdentityLines(scene);
  return (
    <div className="relative grid h-[var(--sv-h)] grid-cols-2 @min-[1100px]/profile:grid-cols-[56%_1fr]" data-wide-hero={look.id}>
      <HeroFoot className="!h-[22%]" scene={scene} />
      {STAGED.has(look.id) ? <WideStage scene={scene} /> : (
        <div className="relative overflow-hidden" style={{ margin: inset, borderRadius: theme.wide.radius, maskImage: theme.wide.mask ? "linear-gradient(90deg,#000 72%,#0000)" : undefined, WebkitMaskImage: theme.wide.mask ? "linear-gradient(90deg,#000 72%,#0000)" : undefined, background: scene.photo ? "#2A2622" : theme.light ? look.accent : "#1E1B18" }}>
          <div className="absolute inset-0" data-sv-motion style={{ animation: scene.drift }}>
            <ScenePhoto alt={copy.photoOf.replace("{name}", who.name)} priority priorityMedia="(min-width: 900px)" scene={scene} sizes="56vw" />
          </div>
          <Initials scene={scene} size="clamp(120px,14cqw,200px)" />
          <Treatment scene={scene} />
          {look.id === "motion" && <WideMarquee scene={scene} />}
        </div>
      )}
      <div className="relative z-[2] flex min-w-0 flex-col justify-center pl-[max(31px,3.89cqw)] pr-[max(44px,5.56cqw)]" style={{ color: theme.fg, alignItems: align, textAlign: centered ? "center" : undefined }}>
        {/* One reading order: where (Live or the Mode's context), who, what they are about, then the actions. */}
        <div className="flex w-full max-w-[600px] flex-col gap-[clamp(11px,1.39cqw,20px)]" data-wide-identity style={{ alignItems: align }}>
          <SceneLiveContext scene={scene} context={scene.live} copy={copy} theme={theme} />
          {eyebrow && !scene.live && (
            <p className="-mb-1 flex items-center gap-2 font-label text-[11.5px] uppercase tracking-[0.2em]" data-wide-eyebrow style={{ color: theme.muted }}>
              {look.slug === "event" && <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: look.accent }} />}
              {eyebrow}
            </p>
          )}
          <scene.nameAs className="max-w-full break-words [overflow-wrap:anywhere] [text-wrap:balance]" data-name data-name-font={look.nameFont} style={{ ...nameTypeStyle(scene.type), lineHeight: scene.type.leading - 0.02, fontSize: nameSize, textShadow: theme.identity.shadow ?? undefined }}>{who.name}<NameBadge size={30} tier={scene.memberTier} /></scene.nameAs>
          {meta && <p className="text-[clamp(15px,1.18cqw,18px)]" data-wide-meta style={{ color: theme.muted }}>{meta}</p>}
          {scene.sound === "featured" && <SceneFeaturedSound scene={scene} accent={look.accent} color={theme.muted} still={scene.still} title={scene.soundTitle} />}
          <WideBio scene={scene} />
          <div className="mt-[clamp(6px,.7cqw,12px)] flex flex-wrap items-center gap-2.5 [--sv-connect-h:54px] [--sv-connect-px:30px] [--sv-connect-w:auto]" data-wide-connect style={{ justifyContent: align }}>{scene.actions}</div>
          <SceneSocials scene={scene} align={align} copy={copy} links={scene.socials} size={40} style={look.socialStyle === "hidden" ? "hidden" : "rail"} theme={theme} />
        </div>
        {/* Under the identity column, never across the photo. */}
        {scene.cue(true)}
      </div>
    </div>
  );
}

/**
 * The wide hero's context lines. Each Mode leads with its own frame: an Event names where you
 * are (when no Live Context already does), Business names the company, Personal is just you.
 */
export function wideIdentityLines(scene: Scene) {
  const { mode, look, who } = scene;
  const get = (key: string) => { const value = mode.settings[key]; return typeof value === "string" ? value.trim() : ""; };
  const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");
  const handle = look.showUsername ? `@${who.username}` : "";
  if (mode.slug === "event") return { eyebrow: join(get("eventName"), get("dateLabel")), meta: join(handle, who.roleLine) };
  if (mode.slug === "business" && get("company")) return { eyebrow: get("company"), meta: join(handle, get("role"), get("city")) };
  return { eyebrow: "", meta: join(handle, who.roleLine) };
}

/** Appearances whose wide hero is a composition on the page rather than a full photo panel. */
const STAGED = new Set(["aura", "glow", "scene", "frame", "stack", "film"]);

/** The wide (tablet and desktop) left half for composed Appearances, mirroring each phone hero. */
function WideStage({ scene }: { scene: Scene }) {
  const { look, who, copy } = scene;
  const alt = copy.photoOf.replace("{name}", who.name);
  const field = scene.photo ? "#2A2622" : look.accent;
  const portrait = (sizes: string, style?: CSSProperties, cover = false) => (
    <>
      <ScenePhoto alt={alt} cover={cover} priority scene={scene} sizes={sizes} style={style} />
      <Initials color={scene.photo ? undefined : inkOn(look.accent)} scene={scene} size="clamp(80px,10cqw,160px)" />
      <Treatment scene={scene} />
    </>
  );
  const box = "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";
  switch (look.id) {
    case "aura":
      return (
        <div className="relative" data-wide-stage="aura">
          <div aria-hidden="true" className={`${box} aspect-square w-[min(84%,calc(var(--sv-h)*.7))] overflow-hidden rounded-full opacity-85`} data-sv-motion style={{ background: field, filter: "blur(30px) saturate(2.2)" }}><ScenePhoto cover frameAspect={1} scene={scene} sizes="300px" /></div>
          <div className={`${box} aspect-square w-[min(66%,calc(var(--sv-h)*.56))] overflow-hidden rounded-full`} style={{ background: field, boxShadow: "0 0 0 8px #FFFFFF99, 0 50px 90px -40px #0D0D0D80" }}>{portrait("40vw", undefined, true)}</div>
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
              : <ScenePhoto scene={scene} style={{ filter: "blur(14px) brightness(.55) saturate(1.2)", transform: "scale(1.3)" }} />}
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
              <ScenePhoto alt={alt} priority scene={scene} sizes="56vw" style={{ filter: "sepia(.18) saturate(.85) contrast(1.06)" }} />
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
  return <p className="max-w-[480px] whitespace-pre-line text-[clamp(16px,1.25cqw,19px)] leading-[1.5] opacity-90 [text-wrap:pretty]" data-wide-bio style={{ color: scene.theme.fg }}>{text}</p>;
}

// ---------------------------------------------------------------- Identity helpers

/** Member status beside the person's name (Plus coral, Pro champagne). Derived from billing only. */
export function NameBadge({ tier, size, decorative = false }: { tier: MemberTier | null; size: number; decorative?: boolean }) {
  if (!tier) return null;
  return <span className="ml-[0.2em] inline-block align-middle leading-none" data-name-badge={tier}><MemberBadge decorative={decorative} size={size} tier={tier} /></span>;
}
