"use client";

import { useState } from "react";

import type { ProfileBlock } from "@/components/profile/types";
import { MUSIC_PROVIDER_NAMES, parseMusic, parseVideo, VIDEO_PROVIDER_NAMES } from "@/lib/blocks/media";

export type BlockTone = { bg: string; ink: string; sub: string; chip: string; line: string; dark: boolean };

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Renders a Mode's content blocks inside any profile layout. */
export function ProfileBlocks({ blocks, tone, accent, accentInk, className = "mt-7" }: { blocks?: ProfileBlock[]; tone: BlockTone; accent: string; accentInk: string; className?: string }) {
  const visible = (blocks ?? []).filter((block) => block.is_visible);
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
    case "video": return <VideoBlock accent={accent} accentInk={accentInk} data={data} tone={tone} />;
    case "music": return <MusicBlock data={data} tone={tone} />;
    case "feature": return <FeatureBlock data={data} tone={tone} />;
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

function VideoBlock({ data, tone, accent, accentInk }: { data: Record<string, unknown>; tone: BlockTone; accent: string; accentInk: string }) {
  const [playing, setPlaying] = useState(false);
  const media = parseVideo(str(data.url));
  if (!media) return null;
  const thumbnail = str(data.thumbnail) || media.thumbnail;
  const title = str(data.title);
  const caption = str(data.caption);
  const frame = media.vertical ? "mx-auto aspect-[9/16] w-full max-w-[300px]" : "aspect-video w-full";
  return (
    <figure>
      <div className={`relative overflow-hidden rounded-2xl ${frame}`} style={{ background: tone.dark ? "#1C1C1C" : "#0D0D0D" }}>
        {playing ? (
          <iframe allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowFullScreen className="absolute inset-0 size-full" referrerPolicy="strict-origin-when-cross-origin" src={media.embedUrl} title={title || `${VIDEO_PROVIDER_NAMES[media.provider]} video`} />
        ) : (
          <button aria-label={`Play ${title || "video"}`} className="group absolute inset-0 size-full" onClick={() => setPlaying(true)} type="button">
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

function MusicBlock({ data, tone }: { data: Record<string, unknown>; tone: BlockTone }) {
  const media = parseMusic(str(data.url));
  if (!media) return null;
  return (
    <iframe
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      className="w-full overflow-hidden rounded-2xl border-0"
      height={media.height}
      loading="lazy"
      src={media.embedUrl}
      style={{ colorScheme: "normal", background: tone.chip }}
      title={str(data.title) || `${MUSIC_PROVIDER_NAMES[media.provider]} player`}
    />
  );
}

function FeatureBlock({ data, tone }: { data: Record<string, unknown>; tone: BlockTone }) {
  const [imageFailed, setImageFailed] = useState(false);
  const url = str(data.url);
  const image = str(data.image);
  let site = str(data.siteName);
  if (!site) { try { site = new URL(url).hostname.replace(/^www\./, ""); } catch { site = ""; } }
  return (
    <a className="group block overflow-hidden rounded-2xl transition hover:opacity-95" href={url} rel="noopener noreferrer" style={{ background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}` }} target="_blank">
      {image && !imageFailed && (
        <span className="relative block aspect-[1.91/1] w-full overflow-hidden" style={{ background: tone.bg }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- third-party link preview image */}
          <img alt="" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.02]" loading="lazy" onError={() => setImageFailed(true)} referrerPolicy="no-referrer" src={image} />
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
