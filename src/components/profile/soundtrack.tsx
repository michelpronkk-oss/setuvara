"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import type { ProfileBlock } from "@/components/profile/types";
import { MUSIC_PROVIDER_NAMES, parseMusic, type MusicMedia } from "@/lib/blocks/media";
import { mediaFocus, readSoundPreference, soundPreferenceStore, soundtrackFocus, writeSoundPreference } from "@/lib/soundtrack/focus";
import { createAudioPlayer, createSoundCloudPlayer, createSpotifyPlayer, createYouTubePlayer, spotifyUri, type Player, type PlayerEvent } from "@/lib/soundtrack/players";

/**
 * Profile soundtrack: one music block per Mode can carry the atmosphere of
 * that Mode. Visitors choose Sound on or off once (remembered in their
 * browser); the soundtrack steps aside for videos and other music, pauses in
 * the background, and disappears entirely when a Mode has none.
 */

type Status = "loading" | "ready" | "playing" | "blocked" | "unavailable";

type SoundtrackApi = {
  blockId: string;
  media: MusicMedia;
  title: string;
  artwork: string | null;
  /** Editor preview: never starts on its own and never touches the visitor's choice. */
  preview: boolean;
  status: Status;
  /** The visitor wants sound (it may still be held for a video or a hidden tab). */
  on: boolean;
  /** First visit: show the Enter with sound / Continue muted choice. */
  asking: boolean;
  /** Sound is on but nothing plays yet: the browser is waiting for the visitor's tap. */
  waiting: boolean;
  /** Playback needed a tap and the tap didn't reach the provider's player. */
  needsDirectTap: boolean;
  /** The soundtrack's own music block renders the provider player that plays it. */
  hostsEmbed: boolean;
  soundOn: () => void;
  soundOff: () => void;
  continueMuted: () => void;
  setCueInView: (inView: boolean) => void;
};

const SoundtrackContext = createContext<SoundtrackApi | null>(null);
const SoundtrackHostContext = createContext<((element: HTMLElement | null) => void) | null>(null);

/** The soundtrack of the Mode being rendered, or null when it has none. */
export function useSoundtrack() {
  return useContext(SoundtrackContext);
}

/** Ref for the element the soundtrack's provider player lives in (inside its own music block). */
export function useSoundtrackHost() {
  return useContext(SoundtrackHostContext);
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const AUDIO_PREVIEW: MusicMedia["provider"][] = ["apple_music", "deezer"];

const noopSubscribe = () => () => {};

export function SoundtrackProvider({ block, preview = false, children }: { block: ProfileBlock; preview?: boolean; children: ReactNode }) {
  const media = useMemo(() => parseMusic(str(block.data.url))!, [block.data.url]);
  const owner = useId();
  const stored = useSyncExternalStore(preview ? noopSubscribe : soundPreferenceStore.subscribe, () => (preview ? null : readSoundPreference()), () => null);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const [status, setStatus] = useState<Status>("loading");
  // The visitor's choice on this page; until then, their remembered preference.
  const [choice, setChoice] = useState<boolean | null>(null);
  const on = choice ?? (!preview && stored === "on");
  const decided = choice !== null;
  const [needsDirectTap, setNeedsDirectTap] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [cueInView, setCueInView] = useState(false);
  const [source, setSource] = useState<{ title: string | null; artwork: string | null } | null>(null);

  const player = useRef<Player | null>(null);
  const want = useRef(false);
  const playing = useRef(false);
  const pending = useRef<"play" | "pause" | null>(null);
  const gestureTried = useRef(false);
  const [tapped, setTapped] = useState(false);
  const held = useSyncExternalStore(mediaFocus.subscribe, mediaFocus.busy, () => false);
  const timers = useRef({ blocked: 0, resume: 0 });

  const setOn = useCallback((value: boolean) => { want.current = value; setChoice(value); }, []);

  const start = useCallback((target: Player) => {
    pending.current = "play";
    target.play();
    window.clearTimeout(timers.current.blocked);
    timers.current.blocked = window.setTimeout(() => {
      if (playing.current || !want.current) return;
      pending.current = null;
      setStatus("blocked");
      if (gestureTried.current && !AUDIO_PREVIEW.includes(media.provider)) setNeedsDirectTap(true);
    }, 3500);
  }, [media.provider]);

  /** Plays or pauses to match: wanted, tab visible, nothing else playing. */
  const sync = useCallback(() => {
    const target = player.current;
    if (!target) return;
    const should = want.current && !document.hidden && !mediaFocus.busy();
    if (should && !playing.current && pending.current !== "play") start(target);
    else if (!should && (playing.current || pending.current === "play")) {
      window.clearTimeout(timers.current.blocked);
      pending.current = "pause";
      target.pause();
    }
  }, [start]);

  // A returning visitor's remembered Sound on applies as soon as it is known.
  useEffect(() => {
    if (want.current === on) return;
    want.current = on;
    sync();
  }, [on, sync]);

  const onEvent = useCallback((event: PlayerEvent) => {
    const target = player.current;
    if (event === "playing") {
      window.clearTimeout(timers.current.blocked);
      const fromVisitor = pending.current === null;
      if (pending.current === "play") pending.current = null;
      playing.current = true;
      setStatus("playing");
      setNeedsDirectTap(false);
      if (fromVisitor) {
        // Started from the provider's own play button: that's the visitor choosing it.
        setOn(true);
        mediaFocus.yield();
      }
      soundtrackFocus.take(owner);
      // A pause already on its way (a video started meanwhile) stays in charge.
      if (pending.current !== "pause") sync();
    } else if (event === "paused") {
      const ours = pending.current === "pause" || document.hidden;
      pending.current = null;
      playing.current = false;
      setStatus((current) => (current === "unavailable" ? current : "ready"));
      if (!ours && !mediaFocus.busy()) setOn(false);
    } else if (event === "ended") {
      playing.current = false;
      if (want.current && target) { pending.current = "play"; target.restart(); }
    } else if (event === "blocked") {
      window.clearTimeout(timers.current.blocked);
      pending.current = null;
      playing.current = false;
      setStatus("blocked");
    } else if (event === "error") {
      window.clearTimeout(timers.current.blocked);
      playing.current = false;
      want.current = false;
      setStatus("unavailable");
    }
  }, [owner, setOn, sync]);

  // Create the player: audio previews need no host; embeds live in the soundtrack block.
  const audioPreview = AUDIO_PREVIEW.includes(media.provider);
  useEffect(() => {
    if (!audioPreview && !host) return;
    let cancelled = false;
    let created: Player | null = null;
    const handle = (event: PlayerEvent) => { if (!cancelled) onEvent(event); };
    const title = str(block.data.title) || `${MUSIC_PROVIDER_NAMES[media.provider]} soundtrack`;
    const job: Promise<Player> = audioPreview
      ? fetch(`/api/soundtrack?url=${encodeURIComponent(media.url)}`)
        .then((response) => (response.ok ? response.json() as Promise<{ src: string; title: string | null; artwork: string | null }> : Promise.reject(new Error("No preview"))))
        .then((found) => { if (!cancelled) setSource({ title: found.title, artwork: found.artwork }); return createAudioPlayer(found.src, handle); })
      : media.provider === "spotify" ? createSpotifyPlayer(host!, spotifyUri(media.type, media.id), media.height, handle)
        : media.provider === "soundcloud" ? createSoundCloudPlayer(host!, media.embedUrl, media.height, title, handle)
          : createYouTubePlayer(host!, media.id, handle);
    job.then((ready) => {
      if (cancelled) { ready.destroy(); return; }
      created = ready;
      player.current = ready;
      setStatus("ready");
      sync();
    }).catch(() => { if (!cancelled) setStatus("unavailable"); });
    const pending_ = timers.current;
    return () => {
      cancelled = true;
      window.clearTimeout(pending_.blocked);
      window.clearTimeout(pending_.resume);
      created?.destroy();
      player.current = null;
      playing.current = false;
      pending.current = null;
    };
  }, [audioPreview, block.data.title, host, media, onEvent, sync]);

  // Step aside for videos and other music, come back shortly after they stop.
  useEffect(() => mediaFocus.subscribe(() => {
    window.clearTimeout(timers.current.resume);
    if (mediaFocus.busy()) sync();
    else timers.current.resume = window.setTimeout(sync, 900);
  }), [sync]);

  // Only one Mode soundtrack on the page.
  useEffect(() => soundtrackFocus.subscribe((other) => {
    if (other === owner) return;
    setOn(false);
    sync();
  }), [owner, setOn, sync]);

  // Never play in a background tab; pick up again on return if sound is still on.
  useEffect(() => {
    const onVisibility = () => sync();
    const onHide = () => { if (player.current && (playing.current || pending.current === "play")) { pending.current = "pause"; player.current.pause(); } };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onVisibility);
    };
  }, [sync]);

  // A provider iframe without a player API (Apple Music, Deezer, TikTok…) took focus: the visitor is playing it.
  useEffect(() => {
    const onBlur = () => window.setTimeout(() => {
      const active = document.activeElement;
      const holder = active instanceof HTMLIFrameElement ? active.closest<HTMLElement>("[data-sound-untracked]") : null;
      if (holder) mediaFocus.claim(`untracked:${holder.dataset.soundUntracked}`);
    }, 0);
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  // Sound is on but browsers want a tap before audio: the visitor's first tap on the page starts it.
  useEffect(() => {
    if ((status !== "blocked" && status !== "ready") || !on || preview) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("a, button, iframe, input, textarea, select, [data-media]")) return;
      if (!player.current || playing.current || mediaFocus.busy() || document.hidden) return;
      gestureTried.current = true;
      setTapped(true);
      start(player.current);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [on, preview, start, status]);

  const soundOn = useCallback(() => {
    if (!preview) writeSoundPreference("on");
    setOn(true);
    gestureTried.current = true;
    setTapped(true);
    mediaFocus.yield();
    soundtrackFocus.take(owner);
    window.clearTimeout(timers.current.resume);
    // Called from the visitor's tap, so the browser lets it play.
    if (player.current && !document.hidden) start(player.current);
    if (needsDirectTap) document.getElementById(`soundtrack-${block.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [block.id, needsDirectTap, owner, preview, setOn, start]);

  const soundOff = useCallback(() => {
    if (!preview) writeSoundPreference("off");
    setOn(false);
    setNeedsDirectTap(false);
    sync();
  }, [preview, setOn, sync]);

  const api = useMemo<SoundtrackApi>(() => ({
    blockId: block.id,
    media,
    title: str(block.data.title) || source?.title || `${MUSIC_PROVIDER_NAMES[media.provider]} track`,
    artwork: str(block.data.image) || media.artwork || source?.artwork || null,
    preview,
    status,
    on,
    asking: hydrated && !decided && (preview || stored === null) && status !== "loading" && status !== "unavailable" && status !== "playing",
    waiting: on && !held && (status === "blocked" || (status === "ready" && !tapped && !preview)),
    needsDirectTap,
    hostsEmbed: !audioPreview,
    soundOn,
    soundOff,
    continueMuted: soundOff,
    setCueInView,
  }), [audioPreview, block.data.image, block.data.title, block.id, decided, held, hydrated, media, needsDirectTap, on, preview, soundOff, soundOn, source, status, stored, tapped]);

  return (
    <SoundtrackContext.Provider value={api}>
      <SoundtrackHostContext.Provider value={setHost}>
        {children}
        <SoundPill api={api} hidden={cueInView} />
      </SoundtrackHostContext.Provider>
    </SoundtrackContext.Provider>
  );
}

// ---------------------------------------------------------------- Visitor UI

type CueTone = { ink: string; sub: string; chip: string; line: string; bg: string };

/**
 * Sits with the person's name: the first-visit choice, then a quiet line
 * naming the track. Renders nothing when the Mode has no soundtrack.
 */
export function SoundtrackCue({ tone, accent, accentInk, align = "left", className = "mt-5" }: { tone: CueTone; accent: string; accentInk: string; align?: "left" | "center"; className?: string }) {
  const api = useSoundtrack();
  const ref = useRef<HTMLDivElement>(null);
  const setCueInView = api?.setCueInView;
  const visible = Boolean(api && api.status !== "loading" && api.status !== "unavailable");

  useEffect(() => {
    const element = ref.current;
    if (!element || !setCueInView || !visible) return;
    const observer = new IntersectionObserver(([entry]) => setCueInView(entry.isIntersecting), { threshold: 0.6 });
    observer.observe(element);
    return () => { observer.disconnect(); setCueInView(false); };
  }, [setCueInView, visible]);

  if (!api || !visible) return null;
  const playing = api.status === "playing";

  if (api.asking) {
    return (
      <div className={`${className} [animation:sheet-up_.5s_cubic-bezier(.2,.8,.2,1)] text-left`} data-sound-ui ref={ref}>
        <div className="rounded-[22px] p-3" style={{ background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.line}` }}>
          <div className="flex items-center gap-3 px-0.5">
            <Artwork accent={accent} accentInk={accentInk} size={44} src={api.artwork} />
            <div className="min-w-0 flex-1">
              <p className="font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: tone.sub }}>{api.preview ? "Profile soundtrack · preview" : "Profile soundtrack"}</p>
              <p className="mt-0.5 truncate text-[15px] font-semibold leading-snug" title={api.title}>{api.title}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[1.2fr_1fr] gap-2">
            <button className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold transition active:scale-[.98]" onClick={api.soundOn} style={{ background: accent, color: accentInk }} type="button"><SpeakerIcon on className="size-[15px] shrink-0" />Enter with sound</button>
            <button className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold transition active:scale-[.98]" onClick={api.continueMuted} style={{ boxShadow: `inset 0 0 0 1.5px ${tone.line}`, color: tone.ink }} type="button">Continue muted</button>
          </div>
        </div>
      </div>
    );
  }

  const blocked = api.waiting;
  const label = blocked ? (api.needsDirectTap ? "Tap play on the track below" : "Tap to play soundtrack") : api.title;
  return (
    <div className={`${className} flex ${align === "center" ? "justify-center" : "justify-start"} [animation:fade-in_.4s_ease-out]`} data-sound-ui ref={ref}>
      <button aria-label={blocked ? `${label}: ${api.title}` : api.on ? `Sound off: pause ${api.title}` : `Sound on: play ${api.title}`} aria-pressed={api.on} className="group inline-flex min-h-10 max-w-full items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-left text-[13px] font-semibold transition hover:opacity-85" onClick={api.on && !blocked ? api.soundOff : api.soundOn} style={{ background: tone.chip, color: tone.ink, boxShadow: `inset 0 0 0 1px ${tone.line}` }} type="button">
        <Artwork accent={accent} accentInk={accentInk} size={32} src={api.artwork} />
        <span className="min-w-0 truncate">{label}</span>
        <span aria-hidden="true" className="ml-0.5 grid size-5 shrink-0 place-items-center" style={{ color: playing ? accent === tone.bg ? tone.ink : accent : tone.sub }}>
          <SpeakerIcon className="size-4" on={api.on} />
        </span>
      </button>
    </div>
  );
}

/** Small control that follows the visitor down the page, whenever the cue is out of view. */
function SoundPill({ api, hidden }: { api: SoundtrackApi; hidden: boolean }) {
  const show = api.status !== "loading" && api.status !== "unavailable" && !hidden;
  const playing = api.status === "playing";
  const label = api.on ? "Sound on" : "Sound off";
  return (
    <div aria-hidden={!show} className="pointer-events-none sticky bottom-0 z-30 h-0" data-sound-ui>
      <div className={`absolute bottom-[max(16px,env(safe-area-inset-bottom))] right-3 transition duration-300 ${show ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
        <button
          aria-label={api.waiting ? `Tap to play soundtrack: ${api.title}` : api.on ? `Sound off: pause ${api.title}` : `Sound on: play ${api.title}`}
          aria-pressed={api.on}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full bg-[rgba(13,13,13,.62)] pl-3 pr-3.5 text-[12px] font-semibold text-[#F5F4EF] shadow-[0_14px_36px_-16px_rgba(0,0,0,.7),inset_0_0_0_1px_rgba(245,244,239,.14)] backdrop-blur-xl transition active:scale-[.97] ${show ? "pointer-events-auto" : ""}`}
          onClick={api.on && !api.waiting ? api.soundOff : api.soundOn}
          tabIndex={show ? 0 : -1}
          type="button"
        >
          <span className="relative grid size-4 place-items-center">
            <SpeakerIcon className="size-4" on={api.on} />
          </span>
          <span>{api.waiting ? "Tap to play" : api.preview && !api.on ? "Preview sound" : label}</span>
          {playing && <span aria-hidden="true" className="size-1.5 rounded-full bg-[#FF5A4F] [animation:sound-breathe_2.4s_ease-in-out_infinite]" />}
        </button>
      </div>
    </div>
  );
}

function Artwork({ src, size, accent, accentInk }: { src: string | null; size: number; accent: string; accentInk: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-full" style={{ width: size, height: size, background: accent, color: accentInk }}>
      {src && !failed
        // eslint-disable-next-line @next/next/no-img-element -- third-party cover art
        ? <img alt="" className="absolute inset-0 size-full object-cover" onError={() => setFailed(true)} referrerPolicy="no-referrer" src={src} />
        : <svg aria-hidden="true" className="size-[45%]" fill="currentColor" viewBox="0 0 24 24"><path d="M9 18.5a2.5 2.5 0 1 1-2.5-2.5c.4 0 .8.1 1 .2V5.8l11-2.3v11.9a2.5 2.5 0 1 1-2.5-2.4c.4 0 .7.1 1 .2V7.1L9 8.8v9.7Z" /></svg>}
    </span>
  );
}

export function SpeakerIcon({ on, className }: { on: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" stroke="none" />
      {on ? <><path d="M15.5 9.2a4 4 0 0 1 0 5.6" /><path d="M18.2 6.6a7.6 7.6 0 0 1 0 10.8" /></> : <path d="m16 9.5 5 5m0-5-5 5" />}
    </svg>
  );
}

// ---------------------------------------------------------------- Media blocks

/**
 * Lets a video or music block claim the visitor's ears while it plays.
 * Only active when the Mode has a soundtrack; otherwise a no-op.
 */
export function useMediaFocus(id: string) {
  const active = Boolean(useSoundtrack());
  useEffect(() => () => mediaFocus.release(id), [id]);
  return useMemo(() => ({
    active,
    claim: (pause?: () => void) => { if (active) mediaFocus.claim(id, pause); },
    release: () => mediaFocus.release(id),
  }), [active, id]);
}
