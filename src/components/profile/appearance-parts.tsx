"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { LinkGlyph } from "@/components/links/provider-mark";
import { SpeakerIcon, useSoundtrack } from "@/components/profile/soundtrack";
import type { providerForLink } from "@/lib/links/providers";
import { brandColour, PAPER, type AppearanceTheme } from "./appearance-theme";
import type { SocialStyle } from "./appearance";
import type { PublicLiveContext } from "./types";

/**
 * Shared Appearance primitives. Every Appearance is composed from these; none of them stores or
 * decides anything about access (Connect stays server-authoritative, sound stays in the engine).
 */

export type ResolvedLink = { link: { id: string; title: string; sort_order: number }; name: string; url: string; display: string; external: boolean; providerId: string; icon: ReturnType<typeof providerForLink>["icon"] };

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
export const DESIGN_FRAME = { width: 390, height: 844 };

/** The rendered size of a hero, for the face-safe solver. The server assumes the 390×844 design frame. */
export function useFrame(ref: RefObject<HTMLElement | null>) {
  const [frame, setFrame] = useState(DESIGN_FRAME);
  useIsoLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const width = Math.round(node.clientWidth);
      const height = Math.round(node.clientHeight);
      if (width > 0 && height > 0) setFrame((current) => (current.width === width && current.height === height ? current : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return frame;
}

const blur = { backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" } as const;

/**
 * Temporary Live Context ("Live · Founders Night · until 23:00"). Times are the visitor's own
 * clock, shown after hydration; the pill disappears the moment the context expires.
 */
export function LiveContextPresentation({ context, theme, copy }: { context: PublicLiveContext | null | undefined; theme: AppearanceTheme; copy: { live: string; until: string; today: string } }) {
  const expiresAt = context ? Date.parse(context.expiresAt) : NaN;
  const [now, setNow] = useState<number | null>(null);
  const [renderedAt] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    if (!Number.isFinite(expiresAt)) return;
    const wait = expiresAt - Date.now();
    if (wait <= 0 || wait > 2 ** 31 - 1) return;
    const timer = window.setTimeout(tick, wait + 50);
    return () => window.clearTimeout(timer);
  }, [expiresAt]);
  // Expired contexts never render, on the server either (the public RPC already filters them).
  if (!context || !Number.isFinite(expiresAt) || (now ?? renderedAt) >= expiresAt) return null;
  let until = "";
  if (now !== null) {
    const end = new Date(expiresAt);
    const sameDay = end.toDateString() === new Date(now).toDateString();
    const time = sameDay
      ? end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : end.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    until = copy.until.replace("{time}", time);
  }
  return (
    <p className="inline-flex h-[30px] max-w-full items-center gap-2 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium" data-live-context style={{ background: theme.light ? theme.pill.bg : "#0D0D0D59", color: theme.pill.fg, ...blur }}>
      <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full [animation:sv-pulse_2.2s_ease-in-out_infinite]" data-sv-motion style={{ background: theme.liveDot, boxShadow: `0 0 0 3px ${theme.liveDot}40` }} />
      <span className="truncate"><b className="font-bold">{copy.live}</b> · {context.label}{until ? ` · ${until}` : ""}</span>
    </p>
  );
}

/** Hero platforms (up to five, Mode priority). Rail, row, compact pill or hidden. */
export function SocialPresentation({ links, style, theme, align, size = 42, copy }: { links: ResolvedLink[]; style: SocialStyle; theme: AppearanceTheme; align: "flex-start" | "center" | "flex-end"; size?: number; copy: { platforms: string; links: string } }) {
  if (!links.length || style === "hidden") return null;
  const brand = theme.id === "social";
  const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  const anchor = (item: ResolvedLink) => ({ href: item.url, rel: item.external ? "noopener noreferrer" : undefined, target: item.external ? "_blank" : undefined, "aria-label": item.name, title: item.name });
  if (style === "compact") {
    // One glass pill; each glyph opens its platform (these platforms are not repeated in the link rows).
    return (
      <div className="inline-flex h-10 items-center gap-0.5 rounded-full pl-1.5 pr-3.5" data-social-style="compact" style={{ background: theme.pill.bg, color: theme.pill.fg, ...blur }}>
        <ul className="flex items-center">
          {links.map((item) => (
            <li key={item.link.id}>
              <a {...anchor(item)} className={`grid size-8 place-items-center rounded-full [&_img]:size-[17px] [&_svg]:size-[17px] ${focus}`} style={{ outlineColor: theme.identity.fg }}><LinkGlyph icon={item.icon} url={item.url} /></a>
            </li>
          ))}
        </ul>
        <span className="pl-1.5 text-[12px] font-semibold">{copy.platforms.replace("{count}", String(links.length))}</span>
      </div>
    );
  }
  if (style === "row") {
    return (
      <ul className="-mx-[11px] flex flex-wrap" data-social-style="row" style={{ justifyContent: align, color: theme.identity.fg }}>
        {links.map((item) => (
          <li key={item.link.id}>
            <a {...anchor(item)} className={`grid size-11 place-items-center rounded-full [&_img]:size-[22px] [&_svg]:size-[22px] ${focus}`} style={{ outlineColor: theme.identity.fg }}><LinkGlyph icon={item.icon} url={item.url} /></a>
          </li>
        ))}
      </ul>
    );
  }
  const glass = theme.light ? "#FFFFFFB3" : "#F5F4EF1F";
  return (
    <ul className="flex flex-wrap gap-2" data-social-style="rail" style={{ justifyContent: align }}>
      {links.map((item) => (
        <li key={item.link.id}>
          <a
            {...anchor(item)}
            className={`grid place-items-center rounded-full transition hover:scale-105 [&_img]:size-[19px] [&_svg]:size-[19px] ${focus}`}
            data-brand={brand ? item.providerId : undefined}
            style={{
              width: size, height: size,
              background: brand ? "#FFFFFF" : theme.id === "clean" ? "transparent" : glass,
              color: brand ? brandColour(item.providerId) : theme.light ? theme.fg : PAPER,
              boxShadow: theme.id === "clean" ? "inset 0 0 0 1.5px #0D0D0D26" : undefined,
              outlineColor: theme.identity.fg,
              ...(theme.id === "clean" ? {} : blur),
            }}
          >
            <LinkGlyph icon={item.icon} url={item.url} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Featured soundtrack (Plus): a subtle line in the identity, never a card. Names no track. */
export function FeaturedSoundLine({ title, accent, color, still }: { title: string; accent: string; color: string; still: boolean }) {
  const api = useSoundtrack();
  if (!api || api.status === "loading" || api.status === "unavailable") return null;
  const playing = api.status === "playing" && !still;
  return (
    <p className="flex items-center gap-[7px] text-[13px]" data-sound-presentation="featured" style={{ color }}>
      <span aria-hidden="true" className="flex h-3 items-center gap-0.5">
        {[0, 0.2, 0.4].map((delay) => <span className="h-3 w-0.5" data-sv-motion key={delay} style={{ background: accent, animation: playing ? `sv-bar 1.2s ${delay}s ease-in-out infinite` : undefined, transform: playing ? undefined : "scaleY(.5)" }} />)}
      </span>
      {title}
    </p>
  );
}

/**
 * The one sound control: 44px, labelled, pinned top-right while the profile scrolls so it is
 * reachable whenever audio is active. Minimal adds the soundtrack label; Ambient is icon-only.
 */
export function SoundControl({ theme, presentation, title, copy, top, right }: { theme: AppearanceTheme; presentation: "ambient" | "minimal" | "featured"; title: string; copy: { muteSoundtrack: string; playSoundtrack: string; tapToPlay: string }; top: number; right: number }) {
  const api = useSoundtrack();
  if (!api || api.status === "loading" || api.status === "unavailable" || api.asking) return null;
  const on = api.on && !api.waiting;
  const minimal = presentation === "minimal";
  return (
    <div aria-hidden={false} className="pointer-events-none sticky top-0 z-30 h-0" data-sound-ui>
      <button
        aria-label={api.waiting ? copy.tapToPlay : api.on ? copy.muteSoundtrack : copy.playSoundtrack}
        aria-pressed={api.on}
        className="pointer-events-auto absolute flex h-11 min-w-11 max-w-[230px] items-center justify-center gap-2 rounded-full text-[12px] font-medium transition active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        data-sound-control={presentation}
        onClick={on ? api.soundOff : api.soundOn}
        style={{ top, right, padding: minimal ? "0 14px 0 12px" : 0, background: theme.pill.bg, color: theme.pill.fg, outlineColor: theme.pill.fg, ...blur }}
        type="button"
      >
        <SpeakerIcon className="size-[18px] shrink-0" on={on} />
        {minimal && <span className="truncate">{title}</span>}
      </button>
    </div>
  );
}

/** First visit: "Enter with sound" or "Continue muted", over the hero. Never names the track. */
export function SoundGate({ theme, name, photo, copy, initials, accent }: { theme: AppearanceTheme; name: string; photo: string | null; initials: string; accent: string; copy: { hasSoundtrack: string; enterWithSound: string; continueMuted: string } }) {
  const api = useSoundtrack();
  if (!api || !api.asking) return null;
  const light = theme.light;
  return (
    <div className="absolute inset-x-0 top-0 z-[35] flex h-[var(--sv-h)] flex-col items-center justify-end gap-4 px-[26px] pb-[46px] text-center [animation:fade-in_.4s_ease-out]" data-sound-gate role="region" aria-label={copy.hasSoundtrack} style={{ background: light ? "#F5F4EFCC" : "#0D0D0DB3", color: light ? "#0D0D0D" : PAPER, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
      <span aria-hidden="true" className="mb-1.5 grid size-28 place-items-center overflow-hidden rounded-full bg-cover bg-center font-display text-[40px] font-extrabold" style={{ backgroundImage: photo ? `url("${photo}")` : undefined, backgroundColor: photo ? "#2A2622" : accent, boxShadow: "0 0 0 4px #FFFFFF59", color: light ? "#0D0D0D" : PAPER }}>{photo ? null : initials}</span>
      <p className="break-words font-display text-[34px] font-bold leading-none tracking-[-0.04em]">{name}</p>
      <p className="text-[15px] opacity-85">{copy.hasSoundtrack}</p>
      <div className="mt-2.5 flex w-full max-w-[420px] flex-col gap-2">
        <button className="flex h-14 items-center justify-center gap-2.5 rounded-full text-[16px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={api.soundOn} style={{ background: light ? "#0D0D0D" : PAPER, color: light ? PAPER : "#0D0D0D", outlineColor: light ? "#0D0D0D" : PAPER }} type="button"><SpeakerIcon className="size-[18px]" on />{copy.enterWithSound}</button>
        <button className="h-12 text-[15px] font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2" onClick={api.continueMuted} type="button">{copy.continueMuted}</button>
      </div>
    </div>
  );
}

/**
 * One floating Connect once the hero's Connect has scrolled away (phones). It opens the very same
 * ConnectFlow as the hero button, so access, passes and state stay identical. Never opens itself.
 */
export function FloatingConnect({ label, style, dot }: { label: string; style: CSSProperties; dot: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const article = host.current?.closest("article");
    const anchor = article?.querySelector<HTMLElement>("[data-hero-connect]");
    if (!anchor) return;
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);
  const open = () => {
    const article = host.current?.closest("article");
    const trigger = Array.from(article?.querySelectorAll<HTMLElement>("[data-hero-connect] [data-connect-trigger]") ?? []).find((node) => node.offsetParent !== null);
    trigger?.click();
  };
  return (
    <div className="pointer-events-none sticky bottom-0 z-30 h-0 @min-[900px]/profile:hidden" ref={host}>
      <div className={`absolute bottom-[max(22px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 transition duration-300 ${show ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>
        <button
          aria-hidden={!show}
          className={`flex h-[54px] items-center gap-[9px] whitespace-nowrap rounded-full px-[30px] text-[16px] font-semibold shadow-[0_14px_34px_-12px_#0D0D0D99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${show ? "pointer-events-auto" : ""}`}
          data-floating-connect
          data-visible={show}
          onClick={open}
          style={style}
          tabIndex={show ? 0 : -1}
          type="button"
        >
          {dot && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: dot }} />}
          {label}
        </button>
      </div>
    </div>
  );
}

/** Hero Connect row wrapper: marks where the floating Connect takes over. */
export function ConnectRow({ children, align, className = "" }: { children: ReactNode; align: "flex-start" | "center" | "flex-end"; className?: string }) {
  return <div className={`mt-1 flex flex-wrap items-center gap-2.5 self-stretch ${className}`} data-hero-connect style={{ justifyContent: align }}>{children}</div>;
}
