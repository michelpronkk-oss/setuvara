"use client";

/* eslint-disable @next/next/no-img-element -- artwork comes from the music services' own CDNs */
import { useEffect, useRef, useState } from "react";

import { parseMusic, type MusicMedia } from "@/lib/blocks/media";
import { allowMediaForSession } from "@/lib/consent";
import { createAudioPlayer, createSoundCloudPlayer, createSpotifyPlayer, createYouTubePlayer, spotifyUri, type Player, type PlayerEvent } from "@/lib/soundtrack/players";

import { BrandMark, type Brand } from "./brand-mark";

/**
 * Try the profile soundtrack: paste a link and it plays through the same players members' pages
 * use (Spotify, SoundCloud and YouTube embeds; Apple Music's preview clip), with the real song
 * name. Nothing loads until Play: pressing it allows media for this visit, as turning sound on
 * does on a member's page.
 */

const BRAND: Record<MusicMedia["provider"], Brand | null> = { spotify: "spotify", apple_music: "applemusic", soundcloud: "soundcloud", youtube_music: "youtube", deezer: null };
const NAME: Record<MusicMedia["provider"], string> = { spotify: "Spotify", apple_music: "Apple Music", soundcloud: "SoundCloud", youtube_music: "YouTube", deezer: "Deezer" };
const SOURCES: Brand[] = ["spotify", "applemusic", "soundcloud", "youtube"];
const SOURCE_NAME: Record<string, string> = { spotify: "Spotify", applemusic: "Apple Music", soundcloud: "SoundCloud", youtube: "YouTube" };
const EXAMPLE = "https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO";

type Info = { title: string | null; artist: string | null; artwork: string | null };
type Status = "idle" | "loading" | "playing" | "paused" | "muted" | "error";

/** A YouTube video link plays like a YouTube Music track. */
function read(value: string): MusicMedia | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const direct = parseMusic(trimmed);
  if (direct) return direct.soundtrack ? direct : null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^(www\.|m\.)/, "");
    const id = host === "youtu.be" ? url.pathname.slice(1) : host === "youtube.com" ? url.searchParams.get("v") : null;
    return id ? parseMusic(`https://music.youtube.com/watch?v=${id}`) : null;
  } catch { return null; }
}

function Bars({ live }: { live: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-5 items-end gap-[3px] text-[#C7FF4A]">
      {[0, 1, 2, 3, 4].map((i) => <span className="h-full w-[3px] origin-bottom rounded-full bg-current" key={i} style={live ? { animation: `sv-eq ${0.7 + (i % 3) * 0.18}s ease-in-out ${i * 0.09}s infinite` } : { transform: `scaleY(${[0.4, 0.7, 0.5, 0.8, 0.45][i]})`, opacity: 0.45 }} />)}
    </span>
  );
}

export function SoundtrackTry() {
  const [link, setLink] = useState(EXAMPLE);
  const [info, setInfo] = useState<{ url: string; data: Info } | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const media = read(link);
  const key = media?.url ?? "";
  const brand = media ? BRAND[media.provider] : null;
  const current = info?.url === key ? info.data : null;

  // The song's own name and artwork, looked up once the link reads as a track or playlist.
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/soundtrack/info?url=${encodeURIComponent(key)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() as Promise<Info> : null))
        .then((data) => { if (data) setInfo({ url: key, data }); })
        .catch(() => {});
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [key]);

  // A new link stops whatever was playing.
  useEffect(() => () => { player.current?.destroy(); player.current = null; }, [key]);

  function onEvent(event: PlayerEvent) {
    if (event === "playing") setStatus((value) => (value === "muted" ? value : "playing"));
    else if (event === "ended") { player.current?.restart(); }
    else if (event === "error" || event === "blocked") setStatus(event === "blocked" ? "paused" : "error");
  }

  async function start() {
    if (!media) return;
    if (player.current) { await player.current.play(); setStatus("playing"); return; }
    setStatus("loading");
    // Some tracks can't be embedded: if nothing has started after a while, offer the service instead.
    window.setTimeout(() => setStatus((value) => (value === "loading" ? "error" : value)), 15000);
    try {
      let created: Player;
      if (media.provider === "apple_music" || media.provider === "deezer") {
        const response = await fetch(`/api/soundtrack?url=${encodeURIComponent(media.url)}`);
        if (!response.ok) throw new Error("No preview");
        created = await createAudioPlayer(((await response.json()) as { src: string }).src, onEvent);
      } else {
        // Provider players set their own cookies: pressing Play allows media for this visit.
        allowMediaForSession();
        host.current!.replaceChildren();
        const mount = document.createElement("div");
        host.current!.append(mount);
        created = media.provider === "spotify" ? await createSpotifyPlayer(mount, spotifyUri(media.type, media.id), media.height, onEvent)
          : media.provider === "soundcloud" ? await createSoundCloudPlayer(mount, media.embedUrl, media.height, "Setuvara soundtrack preview", onEvent)
            : await createYouTubePlayer(mount, media.id, onEvent);
      }
      player.current = created;
      await created.play();
      setStatus("playing");
    } catch { setStatus("error"); }
  }

  function pause() { player.current?.pause(); setStatus("paused"); }
  function toggleMute() {
    if (status === "muted") { player.current?.play(); setStatus("playing"); }
    else { player.current?.pause(); setStatus("muted"); }
  }
  function change(value: string) { player.current?.destroy(); player.current = null; setStatus("idle"); setLink(value); }

  const live = status === "playing";
  const title = current?.title ?? (media ? `${NAME[media.provider]} ${media.type}` : "Your song");
  const label = !media ? "No track yet" : status === "loading" ? "Loading" : status === "playing" ? "Now playing" : status === "muted" ? "Muted" : status === "error" ? "Couldn’t play this one" : status === "paused" ? "Paused" : "Tap play to listen";

  return (
    <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-4 rounded-[32px] bg-ink p-4 text-paper sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8 lg:p-8">
      <div className="flex min-w-0 flex-col gap-4 p-2 sm:p-3">
        <p className="font-label text-[11px] uppercase tracking-[0.16em] text-coral">Try it</p>
        <p className="font-display text-[clamp(28px,3vw,40px)] font-extrabold leading-[0.95] tracking-[-0.05em]">Paste a song or playlist.</p>
        <label className="sr-only" htmlFor="soundtrack-link">Song or playlist link</label>
        <div className="flex items-center gap-3 rounded-full bg-white/[0.08] py-1.5 pl-4 pr-1.5 shadow-[inset_0_0_0_1px_rgba(245,244,239,.1)] focus-within:outline-2 focus-within:outline-coral">
          {brand ? <BrandMark brand={brand} plain size={20} /> : <span aria-hidden="true" className="size-5 shrink-0 rounded-full bg-white/15" />}
          <input autoComplete="off" className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-paper/40" id="soundtrack-link" inputMode="url" onChange={(event) => change(event.target.value)} placeholder="open.spotify.com/track/…" value={link} />
          {link && <button className="min-h-10 shrink-0 rounded-full px-3 text-[13px] font-semibold text-paper/60 hover:text-paper" onClick={() => change("")} type="button">Clear</button>}
        </div>
        <p aria-live="polite" className="min-h-5 text-[13px] text-paper/60">{media ? `${NAME[media.provider]} ${media.type}: press play to hear it the way visitors do.` : link ? "Paste a track, album or playlist from Spotify, Apple Music, SoundCloud or YouTube." : "Spotify, Apple Music, SoundCloud or YouTube."}</p>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((item) => <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${brand === item ? "bg-paper text-ink" : "bg-white/[0.06] text-paper/70"}`} key={item}><BrandMark brand={item} plain size={14} />{SOURCE_NAME[item]}</span>)}
        </div>
      </div>

      <div className="relative isolate min-w-0 overflow-hidden rounded-[24px] bg-cover p-4 sm:p-5" style={{ backgroundImage: "url(/pricing/sena-close.webp)", backgroundPosition: "50% 30%" }}>
        <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/45 to-[#0D0D0D]/10" />
        <div className="flex min-h-[260px] flex-col justify-between gap-16 sm:min-h-[300px]">
          <div className={`flex items-center gap-3 rounded-[18px] bg-black/55 p-2.5 pr-3 backdrop-blur transition-opacity ${media ? "" : "opacity-50"}`}>
            <span aria-hidden="true" className="relative size-14 shrink-0 overflow-hidden rounded-full shadow-[inset_0_0_0_6px_#FF5A4F]" style={live ? { animation: "sv-spin 6s linear infinite" } : undefined}>
              {current?.artwork ? <img alt="" className="size-full object-cover" src={current.artwork} /> : <span className="grid size-full place-items-center bg-[radial-gradient(circle,#2A2A2A_0_22%,#0D0D0D_23%_100%)]"><span className="size-3 rounded-full bg-paper" /></span>}
              <span className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow-[0_0_0_2px_rgba(245,244,239,.8)]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-label text-[10px] uppercase tracking-[0.14em] text-paper/55">{label}</span>
              <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[15px] font-semibold">{brand ? <BrandMark brand={brand} plain size={14} /> : null}<span className="truncate">{title}</span></span>
              {current?.artist && <span className="block truncate text-[12px] text-paper/60">{current.artist}</span>}
            </span>
            <Bars live={live} />
          </div>
          <div className="flex items-end justify-between gap-3">
            <p className="font-serif text-[30px] italic leading-none sm:text-[36px]">Sena Okafor</p>
            <div className="flex shrink-0 gap-2">
              <button aria-label={status === "muted" ? "Unmute" : "Mute"} aria-pressed={status === "muted"} className="grid size-12 place-items-center rounded-full bg-black/50 backdrop-blur transition-colors hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-coral disabled:opacity-40" disabled={status !== "playing" && status !== "muted"} onClick={toggleMute} type="button">
                <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24" width="20"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />{status === "muted" ? <path d="m16 9.5 5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}</svg>
              </button>
              <button aria-label={live ? "Pause" : "Play"} className="grid size-12 place-items-center rounded-full bg-paper text-ink transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-coral disabled:opacity-40" disabled={!media || status === "loading"} onClick={() => (live ? pause() : void start())} type="button">
                {status === "loading" ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-ink/25 border-t-ink" /> : live ? <svg aria-hidden="true" fill="currentColor" height="16" viewBox="0 0 16 16" width="16"><rect height="12" rx="1" width="3.5" x="3" y="2" /><rect height="12" rx="1" width="3.5" x="9.5" y="2" /></svg> : <svg aria-hidden="true" fill="currentColor" height="16" viewBox="0 0 16 16" width="16"><path d="M4 2.5v11l9-5.5z" /></svg>}
              </button>
            </div>
          </div>
        </div>
        {status === "error" && media && <a className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-paper px-4 text-[13px] font-semibold text-ink" href={media.url} rel="noopener noreferrer" target="_blank">Open in {NAME[media.provider]}<span aria-hidden="true">↗</span></a>}
        <p className="mt-4 text-[12px] text-paper/50">Plays through {media ? NAME[media.provider] : "the service"}&apos;s own player, as on a member&apos;s page. Never autoplays.</p>
        {/* The provider's player lives off-screen: the card above is the control. */}
        <div aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0 h-[360px] w-[320px] overflow-hidden" ref={host} />
      </div>
    </div>
  );
}
