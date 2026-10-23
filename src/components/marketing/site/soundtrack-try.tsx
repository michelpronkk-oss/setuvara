"use client";

import { useState } from "react";

import { BrandMark, type Brand } from "./brand-mark";

/**
 * Try the profile soundtrack: paste a link, see which service it is, and play the preview the way
 * a visitor would, with mute. It is a preview of the player: no audio loads here, and nothing is
 * sent anywhere. On a member's page the real track plays, and only after a tap.
 */

const SOURCES: { brand: Brand; name: string; test: RegExp }[] = [
  { brand: "spotify", name: "Spotify", test: /(^|\.)spotify\.com$|^spotify\.link$/ },
  { brand: "applemusic", name: "Apple Music", test: /^music\.apple\.com$/ },
  { brand: "soundcloud", name: "SoundCloud", test: /(^|\.)soundcloud\.com$|^on\.soundcloud\.com$/ },
  { brand: "youtube", name: "YouTube", test: /(^|\.)youtube\.com$|^youtu\.be$/ },
];
const EXAMPLE = "https://open.spotify.com/playlist/late-sets-vol-3";

function detect(value: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    return SOURCES.find((source) => source.test.test(url.hostname.replace(/^www\./, ""))) ?? null;
  } catch { return null; }
}

function Bars({ live, count = 5, className = "" }: { live: boolean; count?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`flex h-5 items-end gap-[3px] ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <span className="h-full w-[3px] origin-bottom rounded-full bg-current" key={i} style={live ? { animation: `sv-eq ${0.7 + (i % 3) * 0.18}s ease-in-out ${i * 0.09}s infinite` } : { transform: `scaleY(${[0.4, 0.7, 0.5, 0.8, 0.45][i % 5]})`, opacity: 0.45 }} />
      ))}
    </span>
  );
}

export function SoundtrackTry() {
  const [link, setLink] = useState(EXAMPLE);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const source = detect(link);
  const live = playing && !muted && Boolean(source);

  return (
    <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-4 rounded-[32px] bg-ink p-4 text-paper sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8 lg:p-8">
      <div className="flex min-w-0 flex-col gap-4 p-2 sm:p-3">
        <p className="font-label text-[11px] uppercase tracking-[0.16em] text-coral">Try it</p>
        <p className="font-display text-[clamp(28px,3vw,40px)] font-extrabold leading-[0.95] tracking-[-0.05em]">Paste a song or playlist.</p>
        <label className="sr-only" htmlFor="soundtrack-link">Song or playlist link</label>
        <div className="flex items-center gap-3 rounded-full bg-white/[0.08] py-1.5 pl-4 pr-1.5 shadow-[inset_0_0_0_1px_rgba(245,244,239,.1)] focus-within:outline-2 focus-within:outline-coral">
          {source ? <BrandMark brand={source.brand} plain size={20} /> : <span aria-hidden="true" className="size-5 shrink-0 rounded-full bg-white/15" />}
          <input autoComplete="off" className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-paper/40" id="soundtrack-link" inputMode="url" onChange={(event) => { setLink(event.target.value); setPlaying(false); }} placeholder="open.spotify.com/…" value={link} />
          {link && <button className="min-h-10 shrink-0 rounded-full px-3 text-[13px] font-semibold text-paper/60 hover:text-paper" onClick={() => { setLink(""); setPlaying(false); }} type="button">Clear</button>}
        </div>
        <p aria-live="polite" className="min-h-5 text-[13px] text-paper/60">{source ? `${source.name} link: it shows as the player on your page.` : link ? "Paste a Spotify, Apple Music, SoundCloud or YouTube link." : "Spotify, Apple Music, SoundCloud or YouTube."}</p>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((item) => <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${source?.brand === item.brand ? "bg-paper text-ink" : "bg-white/[0.06] text-paper/70"}`} key={item.brand}><BrandMark brand={item.brand} plain size={14} />{item.name}</span>)}
        </div>
      </div>

      <div className="relative isolate min-w-0 overflow-hidden rounded-[24px] bg-cover p-4 sm:p-5" style={{ backgroundImage: `url(/pricing/sena-close.webp)`, backgroundPosition: "50% 30%" }}>
        <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/45 to-[#0D0D0D]/10" />
        <div className="flex min-h-[260px] flex-col justify-between gap-16 sm:min-h-[300px]">
          <div className={`flex items-center gap-3 rounded-[18px] bg-black/50 p-2.5 pr-3 backdrop-blur transition-opacity ${source ? "" : "opacity-50"}`}>
            <span aria-hidden="true" className="relative grid size-14 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle,#2A2A2A_0_22%,#0D0D0D_23%_100%)] shadow-[inset_0_0_0_6px_#FF5A4F]" style={live ? { animation: "sv-spin 4s linear infinite" } : undefined}><span className="size-3 rounded-full bg-paper" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-label text-[10px] uppercase tracking-[0.14em] text-paper/55">{!source ? "No track yet" : !playing ? "Tap to listen" : muted ? "Muted" : "Now playing"}</span>
              <span className="mt-0.5 flex items-center gap-2 truncate text-[15px] font-semibold">{source ? <><BrandMark brand={source.brand} plain size={14} />Late sets, vol. 3</> : "Your song"}</span>
            </span>
            <Bars className="text-[#C7FF4A]" live={live} />
          </div>
          <div className="flex items-end justify-between gap-3">
            <p className="font-serif text-[30px] italic leading-none sm:text-[36px]">Sena Okafor</p>
            <div className="flex shrink-0 gap-2">
              <button aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} className="grid size-12 place-items-center rounded-full bg-black/50 backdrop-blur transition-colors hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-coral disabled:opacity-40" disabled={!playing || !source} onClick={() => setMuted((value) => !value)} type="button">
                <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24" width="20"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />{muted ? <path d="m16 9.5 5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}</svg>
              </button>
              <button aria-label={playing ? "Pause" : "Play"} className="grid size-12 place-items-center rounded-full bg-paper text-ink transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-coral disabled:opacity-40" disabled={!source} onClick={() => { setPlaying((value) => !value); setMuted(false); }} type="button">
                {playing ? <svg aria-hidden="true" fill="currentColor" height="16" viewBox="0 0 16 16" width="16"><rect height="12" rx="1" width="3.5" x="3" y="2" /><rect height="12" rx="1" width="3.5" x="9.5" y="2" /></svg> : <svg aria-hidden="true" fill="currentColor" height="16" viewBox="0 0 16 16" width="16"><path d="M4 2.5v11l9-5.5z" /></svg>}
              </button>
            </div>
          </div>
        </div>
        <p className="mt-4 text-[12px] text-paper/50">A preview of the player: no sound loads here. On your page the real track plays after a tap.</p>
      </div>
    </div>
  );
}
