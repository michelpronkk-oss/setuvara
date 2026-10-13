import type { CSSProperties, ImgHTMLAttributes, ReactNode } from "react";
import type { SimpleIcon } from "simple-icons";

import type { PublicLiveContext, ProfileBlock } from "@/components/profile/types";
import type { MediaLayout, ScrollCue as CueId } from "@/components/profile/appearance";
import { brandColour, type AppearanceTheme } from "@/components/profile/appearance-theme";
import type { ResolvedLink } from "@/components/profile/appearance-parts";
export type { ResolvedLink };

export function PreviewImage({ src, alt = "", className = "", sizes, priority = false, fill = false, style, ...attributes }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  priority?: boolean;
  fill?: boolean;
}) {
  const fetchPriority = attributes.fetchPriority ?? (priority ? "high" : "low");
  const loading = attributes.loading ?? (priority ? "eager" : "lazy");
  return <img {...attributes} alt={alt} className={className} decoding="async" fetchPriority={fetchPriority} loading={loading} sizes={sizes} src={src} style={fill ? { position: "absolute", height: "100%", width: "100%", top: 0, right: 0, bottom: 0, left: 0, ...style } : style} />;
}

export type BlockTone = { bg: string; ink: string; sub: string; chip: string; line: string; dark: boolean };
const str = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function PreviewBlocks({ blocks, className = "mt-7", gallery = false, mediaLayout = "featured", tone }: { blocks?: ProfileBlock[]; className?: string; gallery?: boolean; mediaLayout?: MediaLayout; tone: BlockTone; accent: string; accentInk: string }) {
  const visible = (blocks ?? []).filter((block) => block.is_visible && !block.is_soundtrack);
  if (!visible.length) return null;
  if (!gallery) return <div className={`grid gap-3 text-left ${className}`}>{visible.map((block) => block.kind === "image" ? <PreviewFigure block={block} tone={tone} key={block.id} /> : null)}</div>;
  const runs: ProfileBlock[][] = [];
  for (const block of visible) {
    const last = runs.at(-1);
    if (block.kind === "image" && last?.[0]?.kind === "image") last.push(block);
    else runs.push([block]);
  }
  return <div className={`grid gap-3.5 text-left ${className}`}>{runs.map((run) => run[0].kind === "image" ? <div className="flex min-w-0 flex-col gap-3.5" data-media-layout={run.length === 1 ? "single" : mediaLayout === "stack" ? "stack" : "featured"} key={run[0].id}>{run.map((block) => <PreviewFigure block={block} tone={tone} key={block.id} />)}</div> : null)}</div>;
}

function PreviewFigure({ block, tone }: { block: ProfileBlock; tone: BlockTone }) {
  const url = str(block.data.image_url);
  if (!url) return null;
  const alt = str(block.data.alt);
  const caption = str(block.data.caption);
  const frame = { background: tone.dark ? "#0D0D0D" : "#E9E6E0", boxShadow: `inset 0 0 0 1px ${tone.line}, 0 28px 56px -36px ${tone.dark ? "#000000CC" : "#0D0D0D59"}` };
  return <figure className="flex flex-col gap-2.5"><div className="relative w-full overflow-hidden rounded-[22px]" data-featured-media style={{ background: frame.background }}><PreviewImage alt={alt} className="block h-auto w-full" sizes="(max-width: 480px) calc(100vw - 32px), (max-width: 768px) calc(100vw - 64px), 656px" src={url} /><span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ boxShadow: `inset 0 0 0 1px ${tone.line}` }} /></div>{caption && <figcaption className="px-1 text-[13px] leading-5" style={{ color: tone.sub }}>{caption}</figcaption>}</figure>;
}

export function PreviewLinkGlyph({ icon, url }: { icon?: SimpleIcon; url: string }) {
  const path = icon?.path ?? (/^mailto:/i.test(url)
    ? "M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Zm2.1.5L12 12.2 18.9 7H5.1ZM19 8.9l-6.4 4.8a1 1 0 0 1-1.2 0L5 8.9V17h14V8.9Z"
    : /^tel:/i.test(url) ? "M7.4 3.2a1.5 1.5 0 0 1 1.7.6l1.9 3a1.5 1.5 0 0 1-.3 1.9l-1.4 1.2a11 11 0 0 0 4.8 4.8l1.2-1.4a1.5 1.5 0 0 1 1.9-.3l3 1.9a1.5 1.5 0 0 1 .6 1.7l-.6 1.9A2.6 2.6 0 0 1 17.8 20C10.2 19.6 4.4 13.8 4 6.2a2.6 2.6 0 0 1 1.5-2.4l1.9-.6Z"
      : /^sms:/i.test(url) ? "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.4 3.5A1 1 0 0 1 4 18.7V5.5Z"
        : null);
  if (path) return <svg aria-hidden="true" className="size-3.5 shrink-0" fill="currentColor" focusable="false" viewBox="0 0 24 24"><path d={path} /></svg>;
  const host = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
  return host ? <img alt="" className="size-3.5 shrink-0 rounded-[3px]" loading="lazy" src={`/api/favicon?host=${encodeURIComponent(host)}`} /> : <span aria-hidden="true" className="size-3.5 shrink-0">↗</span>;
}

const blur = { backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" } as const;
export function PreviewLiveContext({ context, theme, copy }: { context: PublicLiveContext | null | undefined; theme: AppearanceTheme; copy: { live: string; until: string; today: string } }) {
  if (!context || !Number.isFinite(Date.parse(context.expiresAt)) || Date.now() >= Date.parse(context.expiresAt)) return null;
  const end = new Date(context.expiresAt);
  const time = end.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return <p className="inline-flex h-[30px] max-w-full items-center gap-2 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium" data-live-context style={{ background: theme.light ? theme.pill.bg : "#0D0D0D59", color: theme.pill.fg, ...blur }}><span aria-hidden="true" className="size-[7px] shrink-0 rounded-full [animation:sv-pulse_2.2s_ease-in-out_infinite]" data-sv-motion style={{ background: theme.liveDot, boxShadow: `0 0 0 3px ${theme.liveDot}40` }} /><span className="truncate"><b className="font-bold">{copy.live}</b> · {context.label} · {copy.until.replace("{time}", time)}</span></p>;
}

export function PreviewSocials({ links, style, theme, align, size = 42, copy }: { links: ResolvedLink[]; style: "rail" | "row" | "compact" | "hidden"; theme: AppearanceTheme; align: "flex-start" | "center" | "flex-end"; size?: number; copy: { platforms: string; links: string } }) {
  if (!links.length || style === "hidden") return null;
  const brand = theme.id === "social";
  const anchor = (item: ResolvedLink) => ({ href: item.url, rel: item.external ? "noopener noreferrer" : undefined, target: item.external ? "_blank" : undefined, "aria-label": item.name, title: item.name });
  if (style === "compact") return <div className="inline-flex h-10 items-center gap-0.5 rounded-full pl-1.5 pr-3.5" data-social-style="compact" style={{ background: theme.pill.bg, color: theme.pill.fg, ...blur }}><ul className="flex items-center">{links.map((item) => <li key={item.link.id}><a {...anchor(item)} className="grid size-8 place-items-center rounded-full [&_img]:size-[17px] [&_svg]:size-[17px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: theme.identity.fg }}><PreviewLinkGlyph icon={item.icon} url={item.url} /></a></li>)}</ul><span className="pl-1.5 text-[12px] font-semibold">{copy.platforms.replace("{count}", String(links.length))}</span></div>;
  if (style === "row") return <ul className="-mx-[11px] flex flex-wrap" data-social-style="row" style={{ justifyContent: align, color: theme.identity.fg }}>{links.map((item) => <li key={item.link.id}><a {...anchor(item)} className="grid size-11 place-items-center rounded-full [&_img]:size-[22px] [&_svg]:size-[22px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: theme.identity.fg }}><PreviewLinkGlyph icon={item.icon} url={item.url} /></a></li>)}</ul>;
  const glass = theme.light ? "#FFFFFFB3" : "#F5F4EF1F";
  return <ul className="flex flex-wrap gap-2" data-social-style="rail" style={{ justifyContent: align }}>{links.map((item) => <li key={item.link.id}><a {...anchor(item)} className="grid place-items-center rounded-full transition hover:scale-105 [&_img]:size-[19px] [&_svg]:size-[19px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" data-brand={brand ? item.providerId : undefined} style={{ width: size, height: size, background: brand ? "#FFFFFF" : theme.id === "clean" ? "transparent" : glass, color: brand ? brandColour(item.providerId) : theme.light ? theme.fg : "#F5F4EF", boxShadow: theme.id === "clean" ? "inset 0 0 0 1.5px #0D0D0D26" : undefined, outlineColor: theme.identity.fg, ...(theme.id === "clean" ? {} : blur) }}><PreviewLinkGlyph icon={item.icon} url={item.url} /></a></li>)}</ul>;
}

export function PreviewConnectRow({ children, align }: { children: ReactNode; align: "flex-start" | "center" | "flex-end" }) {
  return <div className="mt-1 flex flex-wrap items-center gap-2.5 self-stretch" data-hero-connect style={{ justifyContent: align }}>{children}</div>;
}

export function PreviewScrollCue({ cue, animated, color, accent, label, text, up = true, bottom }: { cue: CueId; animated: boolean; color: string; accent: string; label: string; up?: boolean; text: string; bottom?: number }) {
  return <div aria-hidden="true" className={`${bottom === undefined ? "relative mx-auto mt-1 items-start" : "absolute left-1/2 -translate-x-1/2 items-end"} z-[4] flex min-h-8 min-w-16 justify-center px-3`} data-scroll-cue={cue} data-scroll-cue-motion={animated ? "loop" : "still"} style={{ bottom: bottom === undefined ? undefined : `calc(${bottom}px + var(--sv-foot, 0px))`, color, outlineColor: color }}><span className="block [animation:sv-cue-in_.8s_.6s_both]" data-sv-cue><PreviewCueGlyph accent={accent} animated={animated} cue={cue} text={text} up={up} /></span></div>;
}

function PreviewCueGlyph({ cue, animated, accent, text, up }: { cue: CueId; animated: boolean; accent: string; text: string; up: boolean }) {
  const loop = (value: string): CSSProperties => animated ? { animation: value } : {};
  const Chevron = ({ size = 18, style }: { size?: number; style?: CSSProperties }) => <svg aria-hidden="true" fill="none" height={size * 0.6} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} style={{ display: "block", ...style }} viewBox="0 0 20 12" width={size}><path d="M2 2l8 8 8-8" /></svg>;
  switch (cue) {
    case "glide": return <Chevron size={22} style={loop("sv-cue-glide 2.2s ease-in-out infinite")} />;
    case "rail": return <span className="relative block h-5 w-[2px] overflow-hidden rounded-full" style={{ background: "currentColor", opacity: 0.9 }}><span className="absolute inset-x-0 top-0 block h-2.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}`, transform: animated ? undefined : "translateY(6px)", ...loop("sv-cue-rail 1.6s cubic-bezier(.6,0,.4,1) infinite") }} /></span>;
    case "orb": return <span className="block size-3 rounded-full" style={{ background: accent, boxShadow: `0 0 14px 4px ${accent}99`, ...loop("sv-cue-orb 2.8s ease-in-out infinite") }} />;
    case "mouse": return <span className="relative block h-[22px] w-[15px] rounded-full border-[1.5px] border-current opacity-80"><span className="absolute left-1/2 top-[4px] block h-[4px] w-[2px] -translate-x-1/2 rounded-full bg-current" style={loop("sv-cue-wheel 1.8s ease-in-out infinite")} /></span>;
    case "beam": return <Chevron size={20} style={{ color: accent, filter: `drop-shadow(0 0 6px ${accent})`, ...loop("sv-cue-beam 2.4s ease-in-out infinite") }} />;
    case "cascade": return <span className="flex flex-col items-center -space-y-[3px]">{[0, 1, 2].map((step) => <Chevron key={step} size={14} style={{ opacity: animated ? 0.4 : 0.35 + step * 0.3, ...loop(`sv-cue-cascade 1.8s ${step * 0.2}s ease-in-out infinite`) }} />)}</span>;
    case "caption": return <span className="flex flex-col items-center gap-1.5"><span className="font-label text-[9px] font-semibold uppercase tracking-[0.32em] opacity-85">{text}</span><span className="block h-px w-6 origin-center bg-current" style={loop("sv-cue-caption 2.6s ease-in-out infinite")} /></span>;
    case "cards": return <span className="flex flex-col items-center gap-[3px]">{[22, 16, 10].map((width, step) => <span className="block h-[3px] rounded-full bg-current" key={width} style={{ width, opacity: 0.9 - step * 0.25, ...loop(`sv-cue-card 1.8s ${step * 0.18}s ease-in-out infinite`) }} />)}</span>;
    case "swipe": return <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold tracking-[-0.01em] backdrop-blur-md" style={{ background: "color-mix(in srgb, currentColor 15%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, currentColor 22%, transparent)" }}><svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} style={{ rotate: up ? undefined : "180deg", ...loop("sv-cue-swipe 1.5s ease-in-out infinite") }} viewBox="0 0 12 12" width="12"><path d="M6 10.5V1.5M2 5l4-3.5L10 5" /></svg>{text}</span>;
    case "credits": return <span className="flex flex-col items-center gap-1"><span className="font-label text-[9px] uppercase tracking-[0.42em]" style={loop("sv-cue-flicker 3.2s steps(1, end) infinite")}>{text}</span><svg aria-hidden="true" height="5" viewBox="0 0 8 5" width="8"><path d="M0 0h8L4 5z" fill="currentColor" /></svg></span>;
  }
}
