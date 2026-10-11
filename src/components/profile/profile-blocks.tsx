"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useMediaFocus, useSoundtrack } from "@/components/profile/soundtrack";
import type { ProfileBlock } from "@/components/profile/types";
import { MUSIC_PROVIDER_NAMES, parseMusic, parseVideo, VIDEO_PROVIDER_NAMES, type MusicMedia, type VideoMedia } from "@/lib/blocks/media";
import { mediaFocus } from "@/lib/soundtrack/focus";
import { createSoundCloudPlayer, createSpotifyPlayer, spotifyUri, watchYouTubeIframe, type Player, type PlayerEvent } from "@/lib/soundtrack/players";

export type BlockTone = { bg: string; ink: string; sub: string; chip: string; line: string; dark: boolean };

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Renders a Mode's content blocks inside any profile layout. */
export function ProfileBlocks({ blocks, tone, accent, accentInk, className = "mt-7" }: { blocks?: ProfileBlock[]; tone: BlockTone; accent: string; accentInk: string; className?: string }) {
  const visible = (blocks ?? []).filter((block) => block.is_visible && !block.is_soundtrack);
  if (!visible.length) return null;
  return (
    <div className={`grid gap-3 text-left ${className}`}>
      {visible.map((block) => <Block accent={accent} accentInk={accentInk} block={block} key={block.id} tone={tone} />)}
    </div>
  );
}

function Block({ block, tone, accent, accentInk }: { block: ProfileBlock; tone: BlockTone; accent: string; accentInk: string }) {
  const data = block.data;
  const surface = { background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}` };
  switch (block.kind) {
    case "video": return <VideoBlock accent={accent} accentInk={accentInk} data={data} id={block.id} tone={tone} />;
    case "music": return <MusicBlock accent={accent} accentInk={accentInk} block={block} tone={tone} />;
    case "feature": return <FeatureBlock data={data} tone={tone} />;
    case "image": return <ImageBlock data={data} tone={tone} />;
    case "services": {
      const items = (data.items as { name?: string; detail?: string; price?: string }[] | undefined) ?? [];
      return (
        <section className="overflow-hidden rounded-2xl" style={surface}>
          <p className="px-4 pt-4 font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: tone.sub }}>{str(data.heading) || "Services"}</p>
          <ul className="mt-2">
            {items.map((item, index) => (
              <li className="flex items-start justify-between gap-4 px-4 py-3" key={index} style={{ borderTop: index ? `1px solid ${tone.line}` : undefined }}>
                <span className="min-w-0"><span className="block text-[15px] font-semibold leading-snug">{item.name}</span>{item.detail && <span className="mt-0.5 block text-[13px] leading-5" style={{ color: tone.sub }}>{item.detail}</span>}</span>
                {item.price && <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: tone.bg }}>{item.price}</span>}
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case "highlights": {
      const items = (data.items as { value?: string; label?: string }[] | undefined) ?? [];
      return (
        <section className="grid rounded-2xl" style={{ ...surface, gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((item, index) => (
            <div className="min-w-0 px-3 py-4 text-center" key={index} style={{ borderLeft: index ? `1px solid ${tone.line}` : undefined }}>
              <p className="truncate font-display text-[1.65rem] font-extrabold leading-none tracking-[-0.05em]">{item.value}</p>
              <p className="mt-1.5 text-[12px] leading-4" style={{ color: tone.sub }}>{item.label}</p>
            </div>
          ))}
        </section>
      );
    }
    case "testimonial":
      return (
        <figure className="rounded-2xl px-5 pb-5 pt-4" style={surface}>
          <span aria-hidden="true" className="block font-display text-[2.6rem] font-extrabold leading-none" style={{ color: accent === tone.bg ? tone.ink : accent }}>“</span>
          <blockquote className="-mt-2 text-[16px] font-medium leading-[1.45]">{str(data.quote)}</blockquote>
          <figcaption className="mt-3 text-[13px]"><span className="font-semibold">{str(data.author)}</span>{str(data.role) && <span style={{ color: tone.sub }}> · {str(data.role)}</span>}</figcaption>
        </figure>
      );
  }
}

function VideoBlock({ id, data, tone, accent, accentInk }: { id: string; data: Record<string, unknown>; tone: BlockTone; accent: string; accentInk: string }) {
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
        <div className="overflow-hidden rounded-2xl bg-[#0D0D0D]">
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
      <div className={`relative overflow-hidden rounded-2xl ${frame}`} style={{ background: tone.dark ? "#1C1C1C" : "#0D0D0D" }}>
        {playing ? (
          focus.active ? <TrackedVideo key={media.embedUrl} focus={focus} media={media} onClose={close} title={title || `${VIDEO_PROVIDER_NAMES[media.provider]} video`} /> : (
            <iframe allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowFullScreen className="absolute inset-0 size-full" referrerPolicy="strict-origin-when-cross-origin" src={media.embedUrl} title={title || `${VIDEO_PROVIDER_NAMES[media.provider]} video`} />
          )
        ) : (
          <button aria-label={`Play ${title || "video"}`} className="group absolute inset-0 size-full" onClick={start} type="button">
            {/* eslint-disable-next-line @next/next/no-img-element -- third-party video thumbnail */}
            {thumbnail && <img alt="" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" referrerPolicy="no-referrer" src={thumbnail} />}
            <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <span className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,.6)] transition group-hover:scale-105" style={{ background: accent, color: accentInk }}>
              <svg aria-hidden="true" className="ml-1 size-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5L7 4.5Z" /></svg>
            </span>
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3.5 text-left text-white">
              <span className="min-w-0 truncate text-[14px] font-semibold drop-shadow">{title}</span>
              <span className="shrink-0 font-label text-[10px] uppercase tracking-[0.14em] text-white/80">{VIDEO_PROVIDER_NAMES[media.provider]}</span>
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
  const url = str(block.data.url);
  // Stable across renders: tracked players are created once per link.
  const media = useMemo(() => parseMusic(url), [url]);
  if (!media) return null;
  const title = str(block.data.title) || `${MUSIC_PROVIDER_NAMES[media.provider]} player`;
  let player: ReactNode;
  if (media.provider === "youtube_music") player = <YouTubeMusicCard accent={accent} accentInk={accentInk} block={block} media={media} tone={tone} />;
  else if (soundtrack && (media.provider === "spotify" || media.provider === "soundcloud")) player = <TrackedMusic media={media} title={title} tone={tone} trackId={block.id} />;
  else player = <MusicFrame media={media} title={title} tone={tone} untracked={soundtrack ? block.id : undefined} />;
  return player;
}

/** The provider's own embed, exactly as before. Marked when a soundtrack needs to notice it playing. */
function MusicFrame({ media, title, tone, untracked }: { media: MusicMedia; title: string; tone: BlockTone; untracked?: string }) {
  const focusId = untracked ? `untracked:${untracked}` : null;
  useEffect(() => () => { if (focusId) mediaFocus.release(focusId); }, [focusId]);
  return (
    <div data-sound-untracked={untracked}>
      <iframe
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        className="block w-full overflow-hidden rounded-2xl border-0"
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
  return <div className="overflow-hidden rounded-2xl" ref={host} style={{ minHeight: media.height, background: tone.chip }} />;
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
    <section className="flex items-center gap-3 rounded-2xl p-2.5" data-media style={{ background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}` }}>
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
    <a className="group block overflow-hidden rounded-2xl transition hover:opacity-95" href={url} rel="noopener noreferrer" style={{ background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}` }} target="_blank">
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

function ImageBlock({ data, tone }: { data: Record<string, unknown>; tone: BlockTone }) {
  const image = str(data.image_url);
  const [failedImage, setFailedImage] = useState("");
  const imageFailed = failedImage === image;
  if (!image || imageFailed) return null;

  return (
    <figure className="overflow-hidden rounded-2xl" style={{ background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- private Supabase signed content image */}
      <img alt={str(data.alt)} className="mx-auto block max-h-[80vh] max-w-full object-contain" decoding="async" loading="lazy" onError={() => setFailedImage(image)} src={image} />
      {str(data.caption) && <figcaption className="px-4 py-3 text-[13px] leading-5" style={{ color: tone.sub }}>{str(data.caption)}</figcaption>}
    </figure>
  );
}
