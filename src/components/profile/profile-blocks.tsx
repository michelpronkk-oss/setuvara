"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { ProfileImage } from "@/components/profile/profile-image";
import { useMediaFocus, useSoundtrack } from "@/components/profile/soundtrack";
import type { ProfileBlock } from "@/components/profile/types";
import type { MediaLayout } from "@/components/profile/appearance";
import { EMBED_PROVIDERS, parseEmbed, type EmbedMedia } from "@/lib/blocks/embeds";
import { MUSIC_PROVIDER_NAMES, parseMusic, parseVideo, VIDEO_PROVIDER_NAMES, type MusicMedia, type VideoMedia } from "@/lib/blocks/media";
import { allowMediaForSession, setConsent, useConsent } from "@/lib/consent";
import { mediaFocus } from "@/lib/soundtrack/focus";
import { createSoundCloudPlayer, createSpotifyPlayer, spotifyUri, watchYouTubeIframe, type Player, type PlayerEvent } from "@/lib/soundtrack/players";

export type BlockTone = { bg: string; ink: string; sub: string; chip: string; line: string; dark: boolean };

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Renders a Mode's content blocks inside any profile layout. */
export function ProfileBlocks({ blocks, tone, accent, accentInk, className = "mt-7", gallery = false, mediaLayout = "featured", embeds = false }: { blocks?: ProfileBlock[]; tone: BlockTone; accent: string; accentInk: string; className?: string; /** Appearance continuation: a run of images shows in the chosen picture layout. Order is kept. */ gallery?: boolean; mediaLayout?: MediaLayout; /** The owner's plan shows Embed blocks in place; otherwise they're link cards. */ embeds?: boolean }) {
  const visible = (blocks ?? []).filter((block) => block.is_visible && !block.is_soundtrack);
  if (!visible.length) return null;
  if (gallery) {
    const runs: ProfileBlock[][] = [];
    for (const block of visible) {
      const last = runs.at(-1);
      if (block.kind === "image" && last?.[0]?.kind === "image") last.push(block);
      else runs.push([block]);
    }
    return (
      <div className={`grid gap-3.5 text-left ${className}`}>
        {runs.map((run) => run[0].kind === "image"
          ? <ImageRun blocks={run} key={run[0].id} layout={mediaLayout} tone={tone} />
          : <Block accent={accent} accentInk={accentInk} block={run[0]} compact embeds={embeds} key={run[0].id} tone={tone} />)}
      </div>
    );
  }
  return (
    <div className={`grid gap-3 text-left ${className}`}>
      {visible.map((block) => <Block accent={accent} accentInk={accentInk} block={block} embeds={embeds} key={block.id} tone={tone} />)}
    </div>
  );
}

/** The frame every Appearance picture sits in: soft edge, a hairline and a long, quiet shadow. */
const mediaFrame = (tone: BlockTone) => ({ background: tone.dark ? "#0D0D0D" : "#E9E6E0", boxShadow: `inset 0 0 0 1px ${tone.line}, 0 28px 56px -36px ${tone.dark ? "#000000CC" : "#0D0D0D59"}` });

type RunImage = { id: string; url: string; alt: string; caption: string };

/**
 * Consecutive images in the owner's picture layout, in their saved order:
 * featured (the first large, the rest in a swipe row), stack (each full width), grid (two
 * columns; an odd first picture leads full width) or carousel (all in one swipe row).
 * A single picture always shows as it is.
 */
function ImageRun({ blocks, tone, layout }: { blocks: ProfileBlock[]; tone: BlockTone; layout: MediaLayout }) {
  const [failed, setFailed] = useState<string[]>([]);
  const images: RunImage[] = blocks.map((block) => ({ id: block.id, url: str(block.data.image_url), alt: str(block.data.alt), caption: str(block.data.caption) })).filter((image) => image.url && !failed.includes(image.url));
  if (!images.length) return null;
  const fail = (url: string) => setFailed((current) => [...current, url]);
  const whole = (image: RunImage) => (
    <figure className="flex flex-col gap-2.5" key={image.id}>
      <FeaturedImage alt={image.alt} onError={() => fail(image.url)} tone={tone} url={image.url} />
      {image.caption && <figcaption className="px-1 text-[13px] leading-5" style={{ color: tone.sub }}>{image.caption}</figcaption>}
    </figure>
  );
  if (images.length === 1 || layout === "stack") return <div className="flex min-w-0 flex-col gap-3.5" data-media-layout={images.length === 1 ? "single" : "stack"}>{images.map(whole)}</div>;
  if (layout === "grid") {
    const lead = images.length % 2 ? images[0] : null;
    return (
      <div className="flex min-w-0 flex-col gap-2.5" data-media-layout="grid">
        {lead && whole(lead)}
        <ul className="grid grid-cols-2 gap-2.5">
          {images.slice(lead ? 1 : 0).map((image) => <Tile className="aspect-[4/5] rounded-[18px]" image={image} key={image.id} onError={() => fail(image.url)} sizes="(max-width: 700px) calc(50vw - 25px), 328px" tone={tone} />)}
        </ul>
      </div>
    );
  }
  if (layout === "carousel") {
    return (
      <ul aria-label="Pictures" className="-mx-4 flex min-w-0 snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] @min-[700px]/profile:-mx-8 @min-[700px]/profile:px-8" data-media-carousel data-media-layout="carousel">
        {images.map((image) => <Tile className="aspect-[4/5] w-[min(78%,340px)] snap-center rounded-[20px]" image={image} key={image.id} onError={() => fail(image.url)} sizes="(max-width: 436px) 78vw, 340px" tone={tone} />)}
      </ul>
    );
  }
  const [first, ...rest] = images;
  return (
    <div className="flex min-w-0 flex-col gap-3.5" data-media-layout="featured">
      {whole(first)}
      <ul aria-label="More images" className="-mr-4 flex snap-x gap-2.5 overflow-x-auto pb-1 pr-4 [scrollbar-width:none]" data-media-carousel>
        {rest.map((image) => <Tile className="h-[156px] w-[124px] snap-start rounded-[16px]" image={image} key={image.id} onError={() => fail(image.url)} sizes="124px" tone={tone} />)}
      </ul>
    </div>
  );
}

/** A cropped picture tile for rows and grids; a caption sits on a soft shade at its foot. */
function Tile({ image, tone, className, onError, sizes }: { image: RunImage; tone: BlockTone; className: string; onError: () => void; sizes: string }) {
  return (
    <li className={`relative shrink-0 overflow-hidden ${className}`} data-media-tile style={mediaFrame(tone)}>
      <ProfileImage alt={image.alt} className="absolute inset-0 size-full object-cover" deferUntilLcp onError={onError} sizes={sizes} src={image.url} />
      {image.caption && (
        <>
          <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,#0D0D0D00_55%,#0D0D0DB3_100%)]" />
          <span className="absolute inset-x-2.5 bottom-2.5 line-clamp-2 text-[12px] font-semibold text-[#F5F4EF]">{image.caption}</span>
        </>
      )}
    </li>
  );
}

/**
 * The picture as it is: its own aspect ratio, edge to edge, never letterboxed. Only a very tall
 * picture (beyond 4:5) is trimmed top and bottom, from the centre, so one photo never fills a phone.
 */
function FeaturedImage({ url, alt, tone, onError }: { url: string; alt: string; tone: BlockTone; onError: () => void }) {
  const ref = useRef<HTMLImageElement>(null);
  const [tall, setTall] = useState(false);
  const measure = (image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth) setTall(image.naturalHeight / image.naturalWidth > 1.25);
  };
  // A cached picture can finish loading before hydration, so measure on mount too.
  useEffect(() => measure(ref.current), [url]);
  return (
    <div className="relative w-full overflow-hidden rounded-[22px] @min-[1100px]/profile:max-h-[min(82vh,760px)]" data-featured-media style={{ aspectRatio: tall ? "4 / 5" : undefined, background: mediaFrame(tone).background }}>
      <ProfileImage alt={alt} className={`block w-full ${tall ? "h-full object-cover object-[50%_30%]" : "h-auto"}`} onError={onError} onLoad={(event) => measure(event.currentTarget)} ref={ref} sizes="(max-width: 480px) 100vw, (max-width: 768px) calc(100vw - 64px), (max-width: 1100px) 656px, 960px" src={url} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ boxShadow: `inset 0 0 0 1px ${tone.line}` }} />
    </div>
  );
}

function Block({ block, tone, accent, accentInk, compact = false, embeds = false }: { block: ProfileBlock; tone: BlockTone; accent: string; accentInk: string; /** Appearance content: link previews read as a compact row. */ compact?: boolean; embeds?: boolean }) {
  const data = block.data;
  const surface = { background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}` };
  switch (block.kind) {
    case "video": return <VideoBlock accent={accent} data={data} id={block.id} tone={tone} />;
    case "music": return <MusicBlock accent={accent} accentInk={accentInk} block={block} tone={tone} />;
    case "feature": return compact ? <FeatureRow data={data} tone={tone} /> : <FeatureBlock data={data} tone={tone} />;
    case "image": return <ImageBlock data={data} tone={tone} />;
    case "services": {
      const items = (data.items as { name?: string; detail?: string; price?: string }[] | undefined) ?? [];
      return (
        <section className="overflow-hidden rounded-[var(--sv-card-r,16px)] @min-[1100px]/profile:!overflow-visible @min-[1100px]/profile:!rounded-none @min-[1100px]/profile:!bg-transparent @min-[1100px]/profile:!shadow-none" data-block-services style={surface}>
          <p className="px-4 pt-4 font-label text-[10px] uppercase tracking-[0.16em] @min-[1100px]/profile:!px-0 @min-[1100px]/profile:!pt-0 @min-[1100px]/profile:!text-[11px] @min-[1100px]/profile:!tracking-[0.22em]" style={{ color: tone.sub }}>{str(data.heading) || "Services"}</p>
          <ul className="mt-2 @min-[1100px]/profile:!mt-5">
            {items.map((item, index) => (
              <li className="flex items-start justify-between gap-4 px-4 py-3 @min-[1100px]/profile:!items-baseline @min-[1100px]/profile:!gap-8 @min-[1100px]/profile:!px-0 @min-[1100px]/profile:!py-[clamp(18px,1.6cqw,26px)] @min-[1100px]/profile:!border-t" key={index} style={{ borderTop: index ? `1px solid ${tone.line}` : undefined, borderColor: tone.line }}>
                <span className="min-w-0"><span className="block text-[15px] font-semibold leading-snug @min-[1100px]/profile:!text-[clamp(19px,1.5cqw,24px)] @min-[1100px]/profile:!tracking-[-0.02em]">{item.name}</span>{item.detail && <span className="mt-0.5 block text-[13px] leading-5 @min-[1100px]/profile:!mt-1.5 @min-[1100px]/profile:!text-[15px] @min-[1100px]/profile:!leading-6" style={{ color: tone.sub }}>{item.detail}</span>}</span>
                {item.price && <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold @min-[1100px]/profile:!rounded-none @min-[1100px]/profile:!bg-transparent @min-[1100px]/profile:!px-0 @min-[1100px]/profile:!py-0 @min-[1100px]/profile:!text-[15px] @min-[1100px]/profile:!tabular-nums" style={{ background: tone.bg }}>{item.price}</span>}
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case "highlights": {
      const items = (data.items as { value?: string; label?: string }[] | undefined) ?? [];
      return (
        <section className="grid rounded-[var(--sv-card-r,16px)] @min-[1100px]/profile:!gap-x-[clamp(24px,2.6cqw,48px)] @min-[1100px]/profile:!rounded-none @min-[1100px]/profile:!bg-transparent @min-[1100px]/profile:!shadow-none" data-block-highlights style={{ ...surface, gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((item, index) => (
            <div className="min-w-0 px-3 py-4 text-center @min-[1100px]/profile:!border-l-0 @min-[1100px]/profile:!border-t @min-[1100px]/profile:!px-0 @min-[1100px]/profile:!pb-0 @min-[1100px]/profile:!pt-6 @min-[1100px]/profile:!text-left" key={index} style={{ borderLeft: index ? `1px solid ${tone.line}` : undefined, borderColor: tone.line }}>
              <p className="truncate font-display text-[1.65rem] font-extrabold leading-none tracking-[-0.05em] @min-[1100px]/profile:!text-[clamp(44px,4.6cqw,76px)] @min-[1100px]/profile:!tracking-[-0.055em] @min-[1100px]/profile:[font-family:var(--sv-name-family,inherit)] @min-[1100px]/profile:[font-style:var(--sv-name-style,normal)] @min-[1100px]/profile:[font-weight:var(--sv-name-weight,800)]">{item.value}</p>
              <p className="mt-1.5 text-[12px] leading-4 @min-[1100px]/profile:!mt-3 @min-[1100px]/profile:!text-[15px] @min-[1100px]/profile:!leading-5" style={{ color: tone.sub }}>{item.label}</p>
            </div>
          ))}
        </section>
      );
    }
    case "text":
      return (
        <section data-block-text>
          {str(data.heading) && <h2 className="font-display text-[1.5rem] font-extrabold leading-[1.05] tracking-[-0.045em] @min-[1100px]/profile:!text-[clamp(30px,2.6cqw,44px)] @min-[1100px]/profile:[font-family:var(--sv-name-family,inherit)] @min-[1100px]/profile:[font-weight:var(--sv-name-weight,800)]">{str(data.heading)}</h2>}
          <div className={`${str(data.heading) ? "mt-3" : ""} space-y-3 text-[15.5px] leading-[1.6] @min-[1100px]/profile:!mt-5 @min-[1100px]/profile:!text-[clamp(17px,1.3cqw,20px)] @min-[1100px]/profile:!leading-[1.65] @min-[1100px]/profile:max-w-[62ch]`} style={{ color: tone.sub }}>
            {str(data.body).split(/\n{2,}/).map((paragraph, index) => <p className="whitespace-pre-line [text-wrap:pretty]" key={index}>{paragraph}</p>)}
          </div>
        </section>
      );
    case "section":
      return (
        <div className="mt-4 flex items-end justify-between gap-4 border-b pb-2.5 @min-[1100px]/profile:!mt-8 @min-[1100px]/profile:!pb-4" data-block-section style={{ borderColor: tone.line }}>
          <h2 className="font-display text-[1.35rem] font-extrabold leading-none tracking-[-0.045em] @min-[1100px]/profile:!text-[clamp(28px,2.4cqw,40px)] @min-[1100px]/profile:[font-family:var(--sv-name-family,inherit)] @min-[1100px]/profile:[font-weight:var(--sv-name-weight,800)]">{str(data.title)}</h2>
          {str(data.kicker) && <span className="shrink-0 font-label text-[10px] uppercase tracking-[0.18em] @min-[1100px]/profile:!text-[11px]" style={{ color: tone.sub }}>{str(data.kicker)}</span>}
        </div>
      );
    case "faq": {
      const items = (data.items as { q?: string; a?: string }[] | undefined) ?? [];
      return (
        <section className="rounded-[var(--sv-card-r,16px)] @min-[1100px]/profile:!rounded-none @min-[1100px]/profile:!bg-transparent @min-[1100px]/profile:!shadow-none" data-block-faq style={surface}>
          {str(data.heading) && <p className="px-4 pt-4 font-label text-[10px] uppercase tracking-[0.16em] @min-[1100px]/profile:!px-0 @min-[1100px]/profile:!pt-0 @min-[1100px]/profile:!text-[11px] @min-[1100px]/profile:!tracking-[0.22em]" style={{ color: tone.sub }}>{str(data.heading)}</p>}
          <div className={str(data.heading) ? "mt-1 @min-[1100px]/profile:!mt-4" : ""}>
            {items.map((item, index) => (
              <details className="group px-4 @min-[1100px]/profile:!border-t @min-[1100px]/profile:!px-0" key={index} style={{ borderTop: index ? `1px solid ${tone.line}` : undefined, borderColor: tone.line }}>
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-semibold leading-snug [&::-webkit-details-marker]:hidden @min-[1100px]/profile:!min-h-[72px] @min-[1100px]/profile:!text-[clamp(18px,1.4cqw,22px)]">
                  <span>{item.q}</span>
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full text-[17px] leading-none transition-transform group-open:rotate-45" style={{ background: tone.bg }}>+</span>
                </summary>
                <p className="-mt-1 whitespace-pre-line pb-4 text-[14.5px] leading-[1.6] @min-[1100px]/profile:!pb-6 @min-[1100px]/profile:!text-[clamp(16px,1.2cqw,19px)] @min-[1100px]/profile:max-w-[62ch]" style={{ color: tone.sub }}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      );
    }
    case "location": return <LocationBlock data={data} surface={surface} tone={tone} />;
    case "countdown": return <CountdownBlock accent={accent} accentInk={accentInk} data={data} surface={surface} tone={tone} />;
    case "embed": return <EmbedBlock accent={accent} accentInk={accentInk} data={data} inPlace={embeds} tone={tone} />;
    case "testimonial":
      return (
        <figure className="rounded-[var(--sv-card-r,16px)] px-5 pb-5 pt-4 @min-[1100px]/profile:!rounded-none @min-[1100px]/profile:!bg-transparent @min-[1100px]/profile:!px-0 @min-[1100px]/profile:!pb-0 @min-[1100px]/profile:!pt-0 @min-[1100px]/profile:!shadow-none" style={surface}>
          <span aria-hidden="true" className="block font-display text-[2.6rem] font-extrabold leading-none" style={{ color: accent === tone.bg ? tone.ink : accent }}>“</span>
          <blockquote className="-mt-2 text-[16px] font-medium leading-[1.45] @min-[1100px]/profile:!text-[clamp(24px,2.1cqw,34px)] @min-[1100px]/profile:!leading-[1.28] @min-[1100px]/profile:!tracking-[-0.02em] @min-[1100px]/profile:[text-wrap:pretty]">{str(data.quote)}</blockquote>
          <figcaption className="mt-3 text-[13px]"><span className="font-semibold">{str(data.author)}</span>{str(data.role) && <span style={{ color: tone.sub }}> · {str(data.role)}</span>}</figcaption>
        </figure>
      );
  }
}

function VideoBlock({ id, data, tone, accent }: { id: string; data: Record<string, unknown>; tone: BlockTone; accent: string }) {
  const [playing, setPlaying] = useState(false);
  const media = parseVideo(str(data.url));
  const focus = useMediaFocus(`video:${id}`);
  const uploadedVideo = data.source === "upload" || typeof data.video_path === "string";
  const uploadedVideoRef = useRef<HTMLVideoElement>(null);
  const videoUrl = str(data.video_url);
  const title = str(data.title);
  const caption = str(data.caption);
  useEffect(() => {
    if (uploadedVideo && videoUrl) uploadedVideoRef.current?.load();
  }, [uploadedVideo, videoUrl, data.video_mime_type]);
  useEffect(() => () => focus.release(), [focus, videoUrl]);
  if (uploadedVideo) {
    if (!videoUrl) return null;
    return (
      <figure>
        {title && <p className="mb-2 px-1 text-[14px] font-semibold leading-snug">{title}</p>}
        <div className="overflow-hidden rounded-[22px] bg-[#0D0D0D]" data-media-frame style={{ boxShadow: `inset 0 0 0 1px ${tone.line}` }}>
          <video
            aria-label={title || "Uploaded video"}
            className="block max-h-[80vh] w-full object-contain"
            controls
            key={videoUrl}
            playsInline
            preload="metadata"
            ref={uploadedVideoRef}
            onPlay={() => focus.claim(() => uploadedVideoRef.current?.pause())}
            onPause={() => focus.release()}
            onEnded={() => focus.release()}
          >
            <source src={videoUrl} type={str(data.video_mime_type) || undefined} />
          </video>
        </div>
        {caption && <figcaption className="mt-2 px-1 text-[13px] leading-5" style={{ color: tone.sub }}>{caption}</figcaption>}
      </figure>
    );
  }
  if (!media) return null;
  const start = () => { setPlaying(true); };
  const close = () => { setPlaying(false); focus.release(); };
  const thumbnail = str(data.thumbnail) || media.thumbnail;
  const frame = media.vertical ? "mx-auto aspect-[9/16] w-full max-w-[300px]" : "aspect-video w-full";
  return (
    <figure>
      <div className={`relative overflow-hidden rounded-[22px] ${frame}`} style={mediaFrame({ ...tone, dark: true })}>
        {playing ? (
          focus.active ? <TrackedVideo key={media.embedUrl} focus={focus} media={media} onClose={close} title={title || `${VIDEO_PROVIDER_NAMES[media.provider]} video`} /> : (
            <iframe allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowFullScreen className="absolute inset-0 size-full" referrerPolicy="strict-origin-when-cross-origin" src={media.embedUrl} title={title || `${VIDEO_PROVIDER_NAMES[media.provider]} video`} />
          )
        ) : (
          <button aria-label={`Play ${title || "video"}`} className="group absolute inset-0 size-full" onClick={start} type="button">
            {/* eslint-disable-next-line @next/next/no-img-element -- third-party video thumbnail */}
            {thumbnail && <img alt="" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" referrerPolicy="no-referrer" src={thumbnail} />}
            <span className="absolute inset-0 bg-[linear-gradient(180deg,#0D0D0D00_45%,#0D0D0DB3_100%)]" />
            {/* A quiet glass play control; the accent stays a small detail, never a big disc. */}
            <span className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#FFFFFF29] text-white shadow-[0_12px_32px_-12px_#000000B3,inset_0_0_0_1px_#FFFFFF4D] backdrop-blur-md transition group-hover:scale-105 group-hover:bg-[#FFFFFF3D]">
              <svg aria-hidden="true" className="ml-0.5 size-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5L7 4.5Z" /></svg>
            </span>
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-3.5 text-left text-white">
              <span className="min-w-0 truncate text-[14px] font-semibold">{title}</span>
              <span className="flex shrink-0 items-center gap-1.5 font-label text-[10px] uppercase tracking-[0.14em] text-white/75"><span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: accent }} />{VIDEO_PROVIDER_NAMES[media.provider]}</span>
            </span>
          </button>
        )}
      </div>
      {caption && <figcaption className="mt-2 px-1 text-[13px] leading-5" style={{ color: tone.sub }}>{caption}</figcaption>}
    </figure>
  );
}

/**
 * A video that started while the Mode has a soundtrack: it holds the
 * soundtrack while it plays and hands it back when it pauses, ends or closes.
 */
function TrackedVideo({ media, title, onClose, focus }: { media: VideoMedia; title: string; onClose: () => void; focus: ReturnType<typeof useMediaFocus> }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const youtube = media.provider === "youtube";
  const vimeo = media.provider === "vimeo";
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const src = youtube ? `${media.embedUrl}&enablejsapi=1&origin=${encodeURIComponent(origin)}` : vimeo ? `${media.embedUrl}&api=1` : media.embedUrl;

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let player: Player | null = null;
    let cancelled = false;
    const on = (event: PlayerEvent) => {
      if (event === "playing") focus.claim(() => player?.pause());
      else if (event === "paused" || event === "ended") focus.release();
    };
    if (youtube) {
      watchYouTubeIframe(iframe, (event) => { if (!cancelled) on(event); }).then((ready) => { player = ready; if (cancelled) ready.destroy(); }).catch(() => { /* close button still releases */ });
      return () => { cancelled = true; player?.destroy(); focus.release(); };
    }
    if (vimeo) {
      const post = (method: string, value?: string) => iframe.contentWindow?.postMessage(JSON.stringify(value ? { method, value } : { method }), "https://player.vimeo.com");
      player = { play: () => post("play"), pause: () => post("pause"), restart: () => post("setCurrentTime", "0"), destroy: () => {} };
      const onLoad = () => ["play", "pause", "finish"].forEach((name) => post("addEventListener", name));
      const onMessage = (message: MessageEvent) => {
        if (message.origin !== "https://player.vimeo.com" || message.source !== iframe.contentWindow) return;
        let data: { event?: string } = {};
        try { data = typeof message.data === "string" ? JSON.parse(message.data) : message.data; } catch { return; }
        if (data.event === "ready") onLoad();
        else if (data.event === "play") on("playing");
        else if (data.event === "pause") on("paused");
        else if (data.event === "finish") on("ended");
      };
      iframe.addEventListener("load", onLoad);
      window.addEventListener("message", onMessage);
      return () => { iframe.removeEventListener("load", onLoad); window.removeEventListener("message", onMessage); focus.release(); };
    }
  }, [focus, src, vimeo, youtube]);

  return (
    <>
      <iframe allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowFullScreen className="absolute inset-0 size-full" ref={ref} referrerPolicy="strict-origin-when-cross-origin" src={src} title={title} />
      <button aria-label="Close video" className="absolute right-2.5 top-2.5 z-10 grid size-9 place-items-center rounded-full bg-black/55 text-lg leading-none text-white backdrop-blur-md transition hover:bg-black/75" onClick={onClose} type="button">×</button>
    </>
  );
}

function MusicBlock({ block, tone, accent, accentInk }: { block: ProfileBlock; tone: BlockTone; accent: string; accentInk: string }) {
  const soundtrack = useSoundtrack();
  const { mediaAllowed } = useConsent();
  const url = str(block.data.url);
  // Stable across renders: tracked players are created once per link.
  const media = useMemo(() => parseMusic(url), [url]);
  if (!media) return null;
  const title = str(block.data.title) || `${MUSIC_PROVIDER_NAMES[media.provider]} player`;
  let player: ReactNode;
  // Provider players set their own cookies, so they wait for the visitor's consent; YouTube Music already loads on tap.
  if (!mediaAllowed && media.provider !== "youtube_music") player = <MusicConsentCard accent={accent} accentInk={accentInk} media={media} title={title} tone={tone} />;
  else if (media.provider === "youtube_music") player = <YouTubeMusicCard accent={accent} accentInk={accentInk} block={block} media={media} tone={tone} />;
  else if (soundtrack && (media.provider === "spotify" || media.provider === "soundcloud")) player = <TrackedMusic media={media} title={title} tone={tone} trackId={block.id} />;
  else player = <MusicFrame media={media} title={title} tone={tone} untracked={soundtrack ? block.id : undefined} />;
  return player;
}

/** Stands in for a provider player until the visitor allows media players, once or always. */
function MusicConsentCard({ media, title, tone, accent, accentInk }: { media: MusicMedia; title: string; tone: BlockTone; accent: string; accentInk: string }) {
  const provider = MUSIC_PROVIDER_NAMES[media.provider];
  return (
    <section className="flex items-center gap-3 rounded-[var(--sv-card-r,16px)] p-3" data-media style={{ background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}`, minHeight: Math.min(media.height, 96) }}>
      <div className="min-w-0 flex-1">
        <p className="font-label text-[10px] uppercase tracking-[0.14em]" style={{ color: tone.sub }}>{provider}</p>
        <p className="mt-0.5 truncate text-[14px] font-semibold leading-snug">{title}</p>
        <button className="mt-1 text-[12px] underline underline-offset-2" onClick={() => setConsent("media")} style={{ color: tone.sub }} type="button">Always allow players</button>
      </div>
      <button aria-label={`Load ${provider} player: ${title}`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition hover:scale-[1.03]" onClick={allowMediaForSession} style={{ background: accent, color: accentInk }} type="button">
        <svg aria-hidden="true" className="ml-0.5 size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5L7 4.5Z" /></svg>Load player
      </button>
    </section>
  );
}

/** The provider's own embed, exactly as before. Marked when a soundtrack needs to notice it playing. */
function MusicFrame({ media, title, tone, untracked }: { media: MusicMedia; title: string; tone: BlockTone; untracked?: string }) {
  const focusId = untracked ? `untracked:${untracked}` : null;
  useEffect(() => () => { if (focusId) mediaFocus.release(focusId); }, [focusId]);
  return (
    <div data-sound-untracked={untracked}>
      <iframe
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        className="block w-full overflow-hidden rounded-[var(--sv-card-r,16px)] border-0"
        height={media.height}
        loading="lazy"
        src={media.embedUrl}
        style={{ colorScheme: "normal", background: tone.chip }}
        title={title}
      />
    </div>
  );
}

/** Spotify or SoundCloud on a Mode with a soundtrack: same embed, but the soundtrack hears it play. */
function TrackedMusic({ media, title, tone, trackId }: { media: MusicMedia; title: string; tone: BlockTone; trackId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const focus = useMediaFocus(`music:${trackId}`);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let player: Player | null = null;
    let cancelled = false;
    const on = (event: PlayerEvent) => {
      if (cancelled) return;
      if (event === "playing") focus.claim(() => player?.pause());
      else if (event !== "blocked") focus.release();
    };
    const job = media.provider === "spotify" ? createSpotifyPlayer(element, spotifyUri(media.type, media.id), media.height, on) : createSoundCloudPlayer(element, media.embedUrl, media.height, title, on);
    job.then((ready) => { if (cancelled) ready.destroy(); else player = ready; }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; player?.destroy(); element.replaceChildren(); focus.release(); };
  }, [focus, media, title]);

  if (failed) return <MusicFrame media={media} title={title} tone={tone} untracked={trackId} />;
  return <div className="overflow-hidden rounded-[var(--sv-card-r,16px)]" ref={host} style={{ minHeight: media.height, background: tone.chip }} />;
}

/**
 * YouTube Music reads as a track, not a video: cover, title and one play
 * button. Click to play like any music block; as a soundtrack, the button
 * is the soundtrack's own Sound on / off.
 */
function YouTubeMusicCard({ block, media, tone, accent, accentInk }: { block: ProfileBlock; media: MusicMedia; tone: BlockTone; accent: string; accentInk: string }) {
  const focus = useMediaFocus(`music:${block.id}`);
  const [open, setOpen] = useState(false);
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const frame = useRef<HTMLIFrameElement>(null);
  const title = str(block.data.title) || "YouTube Music";
  const cover = str(block.data.image) || media.artwork;
  const playing = open;

  useEffect(() => {
    const iframe = frame.current;
    if (!open || !iframe || !focus.active) return;
    let cancelled = false;
    let player: Player | null = null;
    watchYouTubeIframe(iframe, (event) => {
      if (cancelled) return;
      if (event === "playing") focus.claim(() => player?.pause());
      else if (event === "paused") focus.release();
      else if (event === "ended") { focus.release(); setOpen(false); }
    }).then((ready) => { player = ready; }).catch(() => { /* Stop still releases */ });
    return () => { cancelled = true; };
  }, [focus, media.embedUrl, open]);

  const toggle = () => {
    if (open) { setOpen(false); focus.release(); } else setOpen(true);
  };

  return (
    <section className="flex items-center gap-3 rounded-[var(--sv-card-r,16px)] p-2.5" data-media style={{ background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}` }}>
      <div className="relative aspect-video w-[118px] shrink-0 overflow-hidden rounded-xl bg-[#0D0D0D]">
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube cover art */}
        {cover && <img alt="" className="absolute inset-0 size-full object-cover" loading="lazy" referrerPolicy="no-referrer" src={cover} />}
        {open && <iframe allow="autoplay; encrypted-media" className="pointer-events-none absolute inset-0 size-full" ref={frame} referrerPolicy="strict-origin-when-cross-origin" src={`${media.embedUrl}${focus.active ? `&enablejsapi=1&origin=${encodeURIComponent(origin)}` : ""}`} title={title} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-label text-[10px] uppercase tracking-[0.14em]" style={{ color: tone.sub }}>YouTube Music</p>
        <p className="mt-0.5 line-clamp-2 text-[14px] font-semibold leading-snug">{title}</p>
      </div>
      <button aria-label={playing ? `Pause ${title}` : `Play ${title}`} className="grid size-11 shrink-0 place-items-center rounded-full transition hover:scale-105" onClick={toggle} style={{ background: accent, color: accentInk }} type="button">
        {playing
          ? <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
          : <svg aria-hidden="true" className="ml-0.5 size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5L7 4.5Z" /></svg>}
      </button>
    </section>
  );
}

function FeatureBlock({ data, tone }: { data: Record<string, unknown>; tone: BlockTone }) {
  const [failedImage, setFailedImage] = useState("");
  const url = str(data.url);
  const image = str(data.image_url) || str(data.image);
  const imageFailed = failedImage === image;
  let site = str(data.siteName);
  if (!site) { try { site = new URL(url).hostname.replace(/^www\./, ""); } catch { site = ""; } }
  return (
    <a className="group block overflow-hidden rounded-[var(--sv-card-r,16px)] transition hover:opacity-95" data-media-frame href={url} rel="noopener noreferrer" style={{ background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}` }} target="_blank">
      {image && !imageFailed && (
        <span className="relative block aspect-[1.91/1] w-full overflow-hidden" style={{ background: tone.bg }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- third-party link preview image */}
          <img alt="" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.02]" loading="lazy" onError={() => setFailedImage(image)} referrerPolicy="no-referrer" src={image} />
        </span>
      )}
      <span className="block px-4 pb-4 pt-3.5">
        {site && <span className="block font-label text-[10px] uppercase tracking-[0.14em]" style={{ color: tone.sub }}>{site}</span>}
        <span className="mt-1 block font-display text-[1.2rem] font-bold leading-tight tracking-[-0.03em]">{str(data.title)}</span>
        {str(data.description) && <span className="mt-1 line-clamp-2 block text-[13px] leading-5" style={{ color: tone.sub }}>{str(data.description)}</span>}
        <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold">{str(data.cta) || "Open"} <span aria-hidden="true" className="transition group-hover:translate-x-0.5">↗</span></span>
      </span>
    </a>
  );
}

/** A link preview as one refined row: a small picture, the title and where it goes. */
function FeatureRow({ data, tone }: { data: Record<string, unknown>; tone: BlockTone }) {
  const [failedImage, setFailedImage] = useState("");
  const url = str(data.url);
  const image = str(data.image_url) || str(data.image);
  let site = str(data.siteName);
  if (!site) { try { site = new URL(url).hostname.replace(/^www\./, ""); } catch { site = ""; } }
  const description = str(data.description);
  return (
    <a className="group flex min-h-[92px] items-center gap-3.5 rounded-[20px] p-2.5 pr-4 transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" data-feature-row href={url} rel="noopener noreferrer" style={{ background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}` }} target="_blank">
      <span className="relative size-[72px] shrink-0 overflow-hidden rounded-[14px]" style={{ background: tone.bg, boxShadow: `inset 0 0 0 1px ${tone.line}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- third-party link preview image */}
        {image && failedImage !== image && <img alt="" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.04]" loading="lazy" onError={() => setFailedImage(image)} referrerPolicy="no-referrer" src={image} />}
        {(!image || failedImage === image) && <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-display text-[24px] font-bold" style={{ color: tone.sub }}>{(str(data.title) || site || "·").slice(0, 1).toUpperCase()}</span>}
      </span>
      <span className="min-w-0 flex-1">
        {site && <span className="block truncate font-label text-[10px] uppercase tracking-[0.14em]" style={{ color: tone.sub }}>{site}</span>}
        <span className="mt-0.5 block truncate text-[16px] font-semibold leading-snug">{str(data.title) || site}</span>
        {description && <span className="mt-0.5 line-clamp-1 block text-[13px] leading-5" style={{ color: tone.sub }}>{description}</span>}
      </span>
      <span aria-hidden="true" className="shrink-0 text-[15px] transition group-hover:translate-x-0.5" style={{ color: tone.sub }}>↗</span>
    </a>
  );
}

function ImageBlock({ data, tone }: { data: Record<string, unknown>; tone: BlockTone }) {
  const image = str(data.image_url);
  const [failedImage, setFailedImage] = useState("");
  const imageFailed = failedImage === image;
  if (!image || imageFailed) return null;

  return (
    <figure className="overflow-hidden rounded-[var(--sv-card-r,16px)]" style={{ background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}` }}>
      <ProfileImage alt={str(data.alt)} className="mx-auto block max-h-[80vh] max-w-full object-contain" onError={() => setFailedImage(image)} sizes="(max-width: 480px) calc(100vw - 32px), (max-width: 768px) calc(100vw - 64px), 656px" src={image} />
      {str(data.caption) && <figcaption className="px-4 py-3 text-[13px] leading-5" style={{ color: tone.sub }}>{str(data.caption)}</figcaption>}
    </figure>
  );
}

/** Address with opening hours and two map links. No map is embedded, so nothing loads from a map provider until a visitor taps. */
function LocationBlock({ data, tone, surface }: { data: Record<string, unknown>; tone: BlockTone; surface: CSSProperties }) {
  const address = str(data.address);
  const hours = ((data.hours as { days?: string; time?: string }[] | undefined) ?? []).filter((row) => str(row.days) && str(row.time));
  const query = encodeURIComponent([str(data.name), address].filter(Boolean).join(", "));
  const pill = "inline-flex min-h-10 items-center rounded-full px-4 text-[13.5px] font-semibold transition hover:opacity-80";
  return (
    <section className="rounded-[var(--sv-card-r,16px)] p-4 @min-[1100px]/profile:!grid @min-[1100px]/profile:!grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @min-[1100px]/profile:!gap-10 @min-[1100px]/profile:!p-[clamp(24px,2.2cqw,36px)]" data-block-location style={surface}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: tone.sub }}><svg aria-hidden="true" className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.5a7 7 0 0 1 7 7c0 5.2-7 12-7 12s-7-6.8-7-12a7 7 0 0 1 7-7Zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" /></svg>Find us</p>
        {str(data.name) && <p className="mt-3 font-display text-[1.3rem] font-extrabold leading-tight tracking-[-0.04em] @min-[1100px]/profile:!text-[clamp(24px,2cqw,32px)]">{str(data.name)}</p>}
        <p className={`${str(data.name) ? "mt-1" : "mt-3"} whitespace-pre-line text-[15px] leading-[1.5]`}>{address}</p>
        {str(data.note) && <p className="mt-2 text-[13.5px] leading-5" style={{ color: tone.sub }}>{str(data.note)}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <a className={pill} href={`https://www.google.com/maps/search/?api=1&query=${query}`} rel="noopener noreferrer" style={{ background: tone.ink, color: tone.bg }} target="_blank">Open in Google Maps</a>
          <a className={pill} href={`https://maps.apple.com/?q=${query}`} rel="noopener noreferrer" style={{ boxShadow: `inset 0 0 0 1.5px ${tone.line}` }} target="_blank">Apple Maps</a>
        </div>
      </div>
      {hours.length > 0 && (
        <dl className="mt-5 border-t pt-3 text-[14px] @min-[1100px]/profile:!mt-0 @min-[1100px]/profile:!border-t-0 @min-[1100px]/profile:!pt-0" style={{ borderColor: tone.line }}>
          {hours.map((row, index) => (
            <div className="flex justify-between gap-4 py-1.5 @min-[1100px]/profile:!border-b @min-[1100px]/profile:!py-3 @min-[1100px]/profile:!text-[16px]" key={index} style={{ borderColor: tone.line }}>
              <dt style={{ color: tone.sub }}>{str(row.days)}</dt>
              <dd className="font-semibold tabular-nums">{str(row.time)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

const DATE_LABEL = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** Days, hours and minutes to a moment. The first render shows only the date, so server and browser agree. */
function CountdownBlock({ data, tone, accent, accentInk, surface }: { data: Record<string, unknown>; tone: BlockTone; accent: string; accentInk: string; surface: CSSProperties }) {
  const ends = Date.parse(str(data.ends_at));
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  const left = now === null || Number.isNaN(ends) ? null : Math.max(0, ends - now);
  const done = left === 0;
  const parts = left === null ? null : [
    { value: Math.floor(left / 86_400_000), label: "days" },
    { value: Math.floor((left % 86_400_000) / 3_600_000), label: "hours" },
    { value: Math.floor((left % 3_600_000) / 60_000), label: "min" },
  ];
  const url = str(data.url);
  return (
    <section className="rounded-[var(--sv-card-r,16px)] p-4 @min-[1100px]/profile:!p-[clamp(24px,2.2cqw,36px)]" data-block-countdown style={surface}>
      <p className="font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: tone.sub }}>{done ? "It’s here" : "Coming up"}</p>
      <p className="mt-2 font-display text-[1.3rem] font-extrabold leading-tight tracking-[-0.04em] @min-[1100px]/profile:!text-[clamp(24px,2cqw,34px)]">{done && str(data.after) ? str(data.after) : str(data.title)}</p>
      {!done && (
        <div className="mt-4 grid grid-cols-3 gap-2" suppressHydrationWarning>
          {(parts ?? [{ value: null, label: "days" }, { value: null, label: "hours" }, { value: null, label: "min" }]).map((part) => (
            <div className="rounded-[var(--sv-card-r-small,14px)] px-2 py-3 text-center @min-[1100px]/profile:!py-5" key={part.label} style={{ background: tone.bg }}>
              <p className="font-display text-[2rem] font-extrabold leading-none tracking-[-0.05em] tabular-nums @min-[1100px]/profile:!text-[clamp(40px,3.6cqw,60px)]">{part.value === null ? "–" : String(part.value).padStart(2, "0")}</p>
              <p className="mt-1.5 font-label text-[10px] uppercase tracking-[0.14em]" style={{ color: tone.sub }}>{part.label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: tone.sub }} suppressHydrationWarning>{Number.isNaN(ends) ? "" : now === null ? new Date(ends).toISOString().slice(0, 10) : DATE_LABEL.format(ends)}</p>
        {url && <a className="inline-flex min-h-10 items-center rounded-full px-4 text-[13.5px] font-semibold transition hover:opacity-85" href={url} rel="noopener noreferrer" style={{ background: accent, color: accentInk }} target="_blank">{str(data.cta) || (done ? "Open" : "Get notified")}</a>}
      </div>
    </section>
  );
}

/**
 * A booking page, form or newsletter sign-up from an approved provider. The provider's frame sets
 * its own cookies, so it waits for the visitor's media consent like a music player. Without Plus
 * (or before consent) it is a plain link card to the same page.
 */
function EmbedBlock({ data, tone, accent, accentInk, inPlace }: { data: Record<string, unknown>; tone: BlockTone; accent: string; accentInk: string; inPlace: boolean }) {
  const { mediaAllowed } = useConsent();
  const media = useMemo(() => parseEmbed(str(data.url)), [data.url]);
  if (!media) return null;
  const provider = EMBED_PROVIDERS[media.provider];
  const title = str(data.title) || `${provider.kind} on ${provider.name}`;
  if (!inPlace) return <EmbedLink media={media} title={title} tone={tone} />;
  if (!mediaAllowed) return <EmbedConsentCard accent={accent} accentInk={accentInk} media={media} title={title} tone={tone} />;
  return (
    <section data-block-embed={media.provider} data-media>
      {str(data.title) && <p className="mb-2.5 px-1 font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: tone.sub }}>{str(data.title)}</p>}
      {/* Providers draw on white; a hairline keeps the frame inside the Look. */}
      <div className="overflow-hidden rounded-[var(--sv-card-r,16px)] bg-white" style={{ boxShadow: `0 0 0 1px ${tone.line}` }}>
        <iframe allow="payment; clipboard-write" className="block w-full border-0" height={media.height} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" src={media.embedUrl} title={title} />
      </div>
    </section>
  );
}

function EmbedLink({ media, title, tone }: { media: EmbedMedia; title: string; tone: BlockTone }) {
  const provider = EMBED_PROVIDERS[media.provider];
  return (
    <a className="group flex min-h-[72px] items-center gap-3.5 rounded-[var(--sv-card-r,16px)] p-3 pr-4 transition hover:opacity-95" data-block-embed-link href={media.url} rel="noopener noreferrer" style={{ background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}` }} target="_blank">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[12px] font-display text-[18px] font-bold" style={{ background: tone.bg, boxShadow: `inset 0 0 0 1px ${tone.line}` }}>{provider.name.slice(0, 1)}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-label text-[10px] uppercase tracking-[0.14em]" style={{ color: tone.sub }}>{provider.name}</span>
        <span className="mt-0.5 block truncate text-[15px] font-semibold leading-snug">{title}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 transition group-hover:translate-x-0.5" style={{ color: tone.sub }}>↗</span>
    </a>
  );
}

/** Stands in for the provider's frame until the visitor allows embedded content, once or always. */
function EmbedConsentCard({ media, title, tone, accent, accentInk }: { media: EmbedMedia; title: string; tone: BlockTone; accent: string; accentInk: string }) {
  const provider = EMBED_PROVIDERS[media.provider];
  return (
    <section className="rounded-[var(--sv-card-r,16px)] p-4" data-block-embed-consent data-media style={{ background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}` }}>
      <p className="font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: tone.sub }}>{provider.kind} · {provider.name}</p>
      <p className="mt-2 font-display text-[1.25rem] font-extrabold leading-tight tracking-[-0.04em]">{title}</p>
      <p className="mt-1.5 text-[13px] leading-5" style={{ color: tone.sub }}>Shown here from {provider.name}, which may set its own cookies.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button aria-label={`Show ${provider.name}: ${title}`} className="inline-flex min-h-10 items-center rounded-full px-4 text-[13.5px] font-semibold transition hover:scale-[1.03]" onClick={allowMediaForSession} style={{ background: accent, color: accentInk }} type="button">Show it here</button>
        <a className="inline-flex min-h-10 items-center rounded-full px-4 text-[13.5px] font-semibold transition hover:opacity-80" href={media.url} rel="noopener noreferrer" style={{ boxShadow: `inset 0 0 0 1.5px ${tone.line}` }} target="_blank">Open on {provider.name} ↗</a>
        <button className="ml-auto text-[12px] underline underline-offset-2" onClick={() => setConsent("media")} style={{ color: tone.sub }} type="button">Always allow</button>
      </div>
    </section>
  );
}
