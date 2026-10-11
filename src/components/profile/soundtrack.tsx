"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import type { ProfileBlock } from "@/components/profile/types";
import { parseMusic, type MusicMedia } from "@/lib/blocks/media";
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
  status: Status;
  /** Cosmetic tier treatment is derived from billing on the server; sound itself stays Free. */
  premiumPresentation: boolean;
  /** The visitor wants sound (it may still be held for a video or a hidden tab). */
  on: boolean;
  /** First visit: show the Enter with sound / Continue muted choice. */
  asking: boolean;
  /** Sound is on but nothing plays yet: the browser is waiting for the visitor's tap. */
  waiting: boolean;
  soundOn: () => void;
  soundOff: () => void;
  continueMuted: () => void;
};

const SoundtrackContext = createContext<SoundtrackApi | null>(null);

/** The soundtrack of the Mode being rendered, or null when it has none. */
export function useSoundtrack() {
  return useContext(SoundtrackContext);
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const AUDIO_PREVIEW: MusicMedia["provider"][] = ["apple_music", "deezer"];

const noopSubscribe = () => () => {};
// Iframe providers do not return a play() promise. This one-shot timeout moves
// an unacknowledged request to a waiting state; it never retries playback.
const PLAYBACK_ACK_TIMEOUT_MS = 3500;
const bumpPlaybackGeneration = (generation: { current: number }) => { generation.current += 1; };

export function SoundtrackProvider({ block, preview = false, premiumPresentation = false, children }: { block: ProfileBlock; preview?: boolean; premiumPresentation?: boolean; children: ReactNode }) {
  const media = useMemo(() => parseMusic(str(block.data.url))!, [block.data.url]);
  const sourceKey = `${block.id}:${media.provider}:${media.url}`;
  const owner = useId();
  const stored = useSyncExternalStore(preview ? noopSubscribe : soundPreferenceStore.subscribe, () => (preview ? null : readSoundPreference()), () => null);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const [status, setStatus] = useState<Status>("loading");
  // The visitor's choice on this page; until then, their remembered preference.
  const [choice, setChoice] = useState<boolean | null>(null);
  const on = choice ?? (!preview && stored === "on");
  const decided = choice !== null;
  const [host, setHost] = useState<HTMLElement | null>(null);

  const player = useRef<Player | null>(null);
  const playerSource = useRef<string | null>(null);
  const want = useRef(false);
  const playing = useRef(false);
  const pending = useRef<"play" | "pause" | null>(null);
  const ended = useRef(false);
  const unavailable = useRef(false);
  const blockedAttempt = useRef(false);
  const abortRecoveryUsed = useRef(false);
  const playbackGeneration = useRef(0);
  const inFlight = useRef<{ player: Player; source: string } | null>(null);
  const pageSuspended = useRef(false);
  const gestureCleanup = useRef<(() => void) | null>(null);
  const [tapped, setTapped] = useState(false);
  const held = useSyncExternalStore(mediaFocus.subscribe, mediaFocus.busy, () => false);
  const blockedTimer = useRef(0);
  const startRef = useRef<((target: Player, fromGesture?: boolean) => void) | null>(null);
  const syncRef = useRef<(() => void) | null>(null);

  const clearGestureRetry = useCallback(() => {
    gestureCleanup.current?.();
    gestureCleanup.current = null;
  }, []);

  const shouldPlayNow = useCallback((target: Player | null = player.current) => Boolean(
    target
    && target === player.current
    && playerSource.current === sourceKey
    && !preview
    && !unavailable.current
    && want.current
    && !document.hidden
    && !pageSuspended.current
    && !mediaFocus.busy()
  ), [preview, sourceKey]);

  const setOn = useCallback((value: boolean) => {
    want.current = value;
    if (!value) {
      blockedAttempt.current = false;
      clearGestureRetry();
    }
    setChoice(value);
  }, [clearGestureRetry]);

  const installGestureRetry = useCallback(() => {
    if (preview || gestureCleanup.current) return;
    const retry = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("a, button, iframe, input, textarea, select, [data-media]")) return;
      const current = player.current;
      const awaitingProviderAck = pending.current === "play" && current?.isPlaying?.() === false;
      if ((!blockedAttempt.current && !awaitingProviderAck) || !shouldPlayNow(current) || !current) return;
      clearGestureRetry();
      blockedAttempt.current = false;
      setTapped(true);
      startRef.current?.(current, true);
    };
    const names = ["pointerdown", "touchend", "click", "keydown"] as const;
    names.forEach((name) => document.addEventListener(name, retry, true));
    gestureCleanup.current = () => names.forEach((name) => document.removeEventListener(name, retry, true));
  }, [clearGestureRetry, preview, shouldPlayNow]);

  const scheduleBlockedState = useCallback((target: Player, source: string, generation: number) => {
    window.clearTimeout(blockedTimer.current);
    blockedTimer.current = window.setTimeout(() => {
      if (generation !== playbackGeneration.current || target !== player.current || source !== playerSource.current || playing.current || pending.current !== "play" || !shouldPlayNow(target)) return;
      pending.current = null;
      blockedAttempt.current = true;
      setStatus("blocked");
      installGestureRetry();
    }, PLAYBACK_ACK_TIMEOUT_MS);
  }, [installGestureRetry, shouldPlayNow]);

  const pauseTarget = useCallback((target: Player) => {
    try {
      const result = target.pause();
      if (result && typeof (result as Promise<void>).then === "function") {
        void Promise.resolve(result).catch((error: unknown) => {
          if (target !== player.current || (error as { name?: string })?.name === "AbortError") return;
          unavailable.current = true;
          setStatus("unavailable");
        });
      }
    } catch (error) {
      if ((error as { name?: string })?.name !== "AbortError" && target === player.current) {
        unavailable.current = true;
        setStatus("unavailable");
      }
    }
  }, []);

  const start = useCallback((target: Player, fromGesture = false) => {
    if (fromGesture && pending.current === "play" && target.isPlaying?.() === false) {
      // A remembered autoplay may still be unacknowledged when the visitor taps.
      // Invalidate that iframe request and retry synchronously in this gesture.
      window.clearTimeout(blockedTimer.current);
      bumpPlaybackGeneration(playbackGeneration);
      pending.current = null;
      inFlight.current = null;
    }
    if (!shouldPlayNow(target) || (!fromGesture && blockedAttempt.current) || playing.current || pending.current === "play" || pending.current === "pause") return;
    clearGestureRetry();
    blockedAttempt.current = false;
    const source = playerSource.current;
    const generation = ++playbackGeneration.current;
    const shouldRestart = ended.current;
    pending.current = "play";
    inFlight.current = { player: target, source: sourceKey };
    scheduleBlockedState(target, sourceKey, generation);

    const handleFailure = (error: unknown) => {
      if (inFlight.current?.player === target && inFlight.current.source === sourceKey) inFlight.current = null;
      const errorName = (error as { name?: string })?.name;
      if (target !== player.current || source !== playerSource.current) {
        pauseTarget(target);
        return;
      }
      if (generation !== playbackGeneration.current) {
        if (pending.current === "pause") pending.current = null;
        if (errorName === "NotAllowedError") {
          blockedAttempt.current = true;
          setStatus("blocked");
          installGestureRetry();
        } else if (shouldPlayNow(target)) {
          syncRef.current?.();
        }
        return;
      }
      window.clearTimeout(blockedTimer.current);
      pending.current = null;
      playing.current = false;
      if (errorName === "NotAllowedError") {
        // Autoplay was denied: retain the desired state and wait for one real gesture.
        blockedAttempt.current = true;
        setStatus("blocked");
        installGestureRetry();
      } else if (errorName === "AbortError") {
        // A source/play transition interrupted this request. Do not retry in a loop.
        if (shouldPlayNow(target) && !abortRecoveryUsed.current) {
          abortRecoveryUsed.current = true;
          setStatus("ready");
          syncRef.current?.();
        } else {
          blockedAttempt.current = true;
          setStatus("blocked");
          installGestureRetry();
        }
      } else {
        unavailable.current = true;
        setStatus("unavailable");
      }
    };

    try {
      // Invoke synchronously so a legitimate button gesture remains available to the browser.
      const result = shouldRestart ? target.restart() : target.play();
      const hasPlayPromise = result && typeof (result as Promise<void>).then === "function";
      if (!hasPlayPromise && !fromGesture && pending.current === "play" && !playing.current) installGestureRetry();
      void Promise.resolve(result).then(() => {
        if (inFlight.current?.player === target && inFlight.current.source === sourceKey) inFlight.current = null;
        if (target !== player.current || source !== playerSource.current) {
          pauseTarget(target);
          return;
        }
        if (generation === playbackGeneration.current) {
          if (!shouldPlayNow(target)) syncRef.current?.();
          return;
        }
        // The blocker may have appeared and cleared while play() was pending. Adopt
        // the same request when it is now valid instead of issuing a duplicate play.
        if (shouldPlayNow(target) && !playing.current && pending.current !== "play") {
          const adoptedGeneration = ++playbackGeneration.current;
          pending.current = "play";
          scheduleBlockedState(target, sourceKey, adoptedGeneration);
        } else if (!shouldPlayNow(target)) {
          pauseTarget(target);
          if (target.isPlaying?.() === false && pending.current === "pause") pending.current = null;
        }
      }).catch(handleFailure);
    } catch (error) {
      handleFailure(error);
    }
  }, [clearGestureRetry, installGestureRetry, pauseTarget, scheduleBlockedState, shouldPlayNow, sourceKey]);

  /** Reconcile desired playback with the actual player and all active blockers. */
  const sync = useCallback(() => {
    const target = player.current;
    if (!target || playerSource.current !== sourceKey) return;
    if (shouldPlayNow(target)) {
      if (pending.current === "pause") return;
      if (playing.current || pending.current === "play") return;
      if (inFlight.current?.player === target && inFlight.current.source === sourceKey) return;
      if (!blockedAttempt.current) start(target);
    } else if (playing.current || pending.current === "play") {
      const wasPlaying = target.isPlaying?.() ?? playing.current;
      bumpPlaybackGeneration(playbackGeneration);
      window.clearTimeout(blockedTimer.current);
      clearGestureRetry();
      pending.current = "pause";
      pauseTarget(target);
      // A request that never reached real playback need not wait for a pause event.
      // Any late playing event is still guarded by the desired-state check below.
      if (!wasPlaying) pending.current = null;
    }
  }, [clearGestureRetry, pauseTarget, shouldPlayNow, sourceKey, start]);

  useEffect(() => {
    startRef.current = start;
    syncRef.current = sync;
    return () => {
      if (startRef.current === start) startRef.current = null;
      if (syncRef.current === sync) syncRef.current = null;
    };
  }, [start, sync]);

  // A returning visitor's remembered Sound on applies as soon as it is known.
  useEffect(() => {
    want.current = on;
    if (!on) {
      blockedAttempt.current = false;
      clearGestureRetry();
    }
    sync();
  }, [clearGestureRetry, on, sync]);

  const onEvent = useCallback((event: PlayerEvent, target: Player | null) => {
    if (!target || target !== player.current || playerSource.current !== sourceKey) return;
    if (event === "playing") {
      window.clearTimeout(blockedTimer.current);
      clearGestureRetry();
      const wasPauseRequested = pending.current === "pause";
      pending.current = null;
      playing.current = true;
      ended.current = false;
      abortRecoveryUsed.current = false;
      if (!wasPauseRequested && shouldPlayNow(target)) setStatus("playing");
      soundtrackFocus.take(owner);
      // A play event can arrive after a newer pause request; immediately re-apply
      // the current arbitration result so it never overlaps blocking media.
      if (wasPauseRequested || !shouldPlayNow(target)) {
        playing.current = true;
        pending.current = "pause";
        pauseTarget(target);
      } else {
        setStatus("playing");
      }
    } else if (event === "paused") {
      const ours = pending.current === "pause" || document.hidden || pageSuspended.current || mediaFocus.busy();
      pending.current = null;
      playing.current = false;
      if (!unavailable.current) setStatus("ready");
      if (!ours) setOn(false);
      if (shouldPlayNow(target)) syncRef.current?.();
    } else if (event === "ended") {
      playing.current = false;
      pending.current = null;
      ended.current = true;
      if (!unavailable.current) setStatus("ready");
      syncRef.current?.();
    } else if (event === "blocked") {
      window.clearTimeout(blockedTimer.current);
      pending.current = null;
      playing.current = false;
      blockedAttempt.current = true;
      setStatus("blocked");
      installGestureRetry();
    } else if (event === "error") {
      window.clearTimeout(blockedTimer.current);
      bumpPlaybackGeneration(playbackGeneration);
      playing.current = false;
      pending.current = null;
      unavailable.current = true;
      setStatus("unavailable");
    }
  }, [clearGestureRetry, installGestureRetry, owner, pauseTarget, setOn, shouldPlayNow, sourceKey]);

  // Create the player: audio previews need no host; embeds live in the soundtrack block.
  const audioPreview = AUDIO_PREVIEW.includes(media.provider);
  useEffect(() => {
    if (!audioPreview && !host) return;
    let cancelled = false;
    let created: Player | null = null;
    let readyForEvents = false;
    const handle = (event: PlayerEvent) => { if (!cancelled && readyForEvents) onEvent(event, created); };
    const job: Promise<Player> = audioPreview
      ? fetch(`/api/soundtrack?url=${encodeURIComponent(media.url)}`)
        .then((response) => (response.ok ? response.json() as Promise<{ src: string }> : Promise.reject(new Error("No preview"))))
        .then((found) => createAudioPlayer(found.src, handle))
      : media.provider === "spotify" ? createSpotifyPlayer(host!, spotifyUri(media.type, media.id), media.height, handle)
        : media.provider === "soundcloud" ? createSoundCloudPlayer(host!, media.embedUrl, media.height, "Setuvara soundtrack", handle)
          : createYouTubePlayer(host!, media.id, handle);
    job.then((ready) => {
      if (cancelled) { ready.destroy(); return; }
      created = ready;
      player.current = ready;
      playerSource.current = sourceKey;
      unavailable.current = false;
      playing.current = false;
      pending.current = null;
      ended.current = false;
      blockedAttempt.current = false;
      setStatus("ready");
      readyForEvents = true;
      syncRef.current?.();
    }).catch(() => {
      if (!cancelled) {
        unavailable.current = true;
        setStatus("unavailable");
      }
    });
    return () => {
      cancelled = true;
      bumpPlaybackGeneration(playbackGeneration);
      window.clearTimeout(blockedTimer.current);
      clearGestureRetry();
      inFlight.current = null;
      created?.destroy();
      if (player.current === created) {
        player.current = null;
        playerSource.current = null;
        playing.current = false;
        pending.current = null;
      }
    };
  }, [audioPreview, clearGestureRetry, host, media, onEvent, sourceKey]);

  // Every blocker change reconciles immediately; multiple active media IDs keep
  // the soundtrack paused until the final real pause/end/unmount release.
  useEffect(() => mediaFocus.subscribe(() => syncRef.current?.()), []);

  // Only one Mode soundtrack on the page.
  useEffect(() => soundtrackFocus.subscribe((other) => {
    if (other === owner) return;
    setOn(false);
    syncRef.current?.();
  }), [owner, setOn]);

  // Never play in a background tab; pick up again on return if sound is still on.
  useEffect(() => {
    const onVisibility = () => syncRef.current?.();
    const onHide = () => { pageSuspended.current = true; syncRef.current?.(); };
    const onShow = () => { pageSuspended.current = false; syncRef.current?.(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

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

  const soundOn = useCallback(() => {
    if (!preview) writeSoundPreference("on");
    setOn(true);
    setTapped(true);
    blockedAttempt.current = false;
    mediaFocus.yield();
    soundtrackFocus.take(owner);
    const current = player.current;
    if (current && shouldPlayNow(current)) start(current, true);
  }, [owner, preview, setOn, shouldPlayNow, start]);

  const soundOff = useCallback(() => {
    if (!preview) writeSoundPreference("off");
    setOn(false);
    syncRef.current?.();
  }, [preview, setOn]);

  useEffect(() => () => {
    clearGestureRetry();
    window.clearTimeout(blockedTimer.current);
  }, [clearGestureRetry]);

  const api = useMemo<SoundtrackApi>(() => ({
    status,
    premiumPresentation,
    on,
    asking: hydrated && !decided && (preview || stored === null) && status !== "loading" && status !== "unavailable" && status !== "playing",
    waiting: on && !held && (status === "blocked" || (status === "ready" && !tapped && !preview)),
    soundOn,
    soundOff,
    continueMuted: soundOff,
  }), [decided, held, hydrated, on, premiumPresentation, preview, soundOff, soundOn, status, stored, tapped]);

  return (
    <SoundtrackContext.Provider value={api}>
      {children}
      {!audioPreview && <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0 w-[300px] overflow-hidden opacity-0" data-soundtrack-player inert ref={setHost} style={{ height: media.height }} />}
      <SoundPill api={api} />
    </SoundtrackContext.Provider>
  );
}

// ---------------------------------------------------------------- Visitor UI

type CueTone = { ink: string; sub: string; chip: string; line: string; bg: string };

/**
 * A first-visit sound choice within the identity composition. Never names or
 * previews the provider, track, or artwork.
 */
export function SoundtrackCue({ tone, accent, accentInk, align = "left", className = "mt-5" }: { tone: CueTone; accent: string; accentInk: string; align?: "left" | "center"; className?: string }) {
  const api = useSoundtrack();
  const visible = Boolean(api && api.status !== "loading" && api.status !== "unavailable");
  if (!api || !visible || !api.asking) return null;
  return (
    <div className={`${className} flex ${align === "center" ? "justify-center" : "justify-start"} [animation:fade-in_.4s_ease-out]`} data-premium-sound={api.premiumPresentation ? "true" : undefined} data-sound-ui>
      <div className="flex flex-wrap items-center gap-2">
        <button className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${api.premiumPresentation ? "shadow-[0_0_0_2px_#FF5A4F,0_0_0_4px_rgba(255,90,79,.15)]" : ""}`} onClick={api.soundOn} style={{ background: accent, color: accentInk }} type="button"><SpeakerIcon on className="size-[15px] shrink-0" />Enter with sound</button>
        <button className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={api.continueMuted} style={{ background: tone.chip, boxShadow: `inset 0 0 0 1.5px ${tone.line}`, color: tone.ink }} type="button">Continue muted</button>
      </div>
    </div>
  );
}

export type SoundtrackSkin = {
  fg: string;
  page: string;
  muted: string;
  border: string;
  accent: string;
  onAccent: string;
  cardRadius: string;
  artRadius: string;
  strip: { background: string; color: string };
};

export type SoundtrackCopy = { soundOn: string; soundOff: string; soundtrack: string; nowPlaying: string; onRepeat: string; title: string };

/**
 * The soundtrack as part of the Appearance (Core, Strip, Disc, Poster). Presentation only: it
 * drives the same provider API as the floating control and never names the provider, track or
 * artwork, which stay out of the public payload.
 */
export function SoundtrackPresentation({ style, skin, copy }: { style: "core" | "strip" | "disc" | "poster"; skin: SoundtrackSkin; copy: SoundtrackCopy }) {
  const api = useSoundtrack();
  if (!api || api.status === "unavailable") return null;
  const playing = api.status === "playing";
  const toggle = api.on && !api.waiting ? api.soundOff : api.soundOn;
  const action = api.on && !api.waiting ? copy.soundOff : copy.soundOn;
  const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  const motion = (animation: string) => (playing ? { animation } : undefined);
  const data = { "data-sound-ui": true, "data-soundtrack-style": style, "data-premium-sound": api.premiumPresentation ? "true" : undefined };

  if (style === "strip") {
    return (
      <button {...data} aria-pressed={api.on} className={`flex w-full items-center gap-3 p-2.5 text-left transition active:scale-[.99] ${focus}`} onClick={toggle} style={{ ...skin.strip, borderRadius: skin.cardRadius, outlineColor: skin.fg }} type="button">
        <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center" style={{ background: skin.accent, color: skin.onAccent, borderRadius: skin.artRadius }}><SpeakerIcon className="size-5" on={api.on} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-label text-[9.5px] uppercase tracking-[0.16em] opacity-80">{playing ? copy.nowPlaying : copy.soundtrack}</span>
          <span className="truncate text-[15px] font-bold">{copy.title}</span>
          <span className="text-[12px] opacity-75">{action}</span>
        </span>
        <span aria-hidden="true" className="flex h-[22px] items-end gap-[3px] pr-2">
          {[0.6, 1, 0.4, 0.75].map((height, index) => <span className="w-[3px] origin-bottom rounded-[2px]" data-sv-motion key={index} style={{ height: `${height * 100}%`, background: skin.accent, ...motion(`sv-eq ${0.9 + index * 0.17}s ease-in-out ${index * -0.2}s infinite`) }} />)}
        </span>
      </button>
    );
  }

  if (style === "disc") {
    return (
      <button {...data} aria-pressed={api.on} className={`flex min-h-11 w-full items-center gap-4 rounded-[18px] py-1 text-left ${focus}`} onClick={toggle} style={{ outlineColor: skin.fg }} type="button">
        <span aria-hidden="true" className="grid size-24 shrink-0 place-items-center rounded-full" data-sv-motion style={{ background: "#0D0D0D", boxShadow: `inset 0 0 0 30px ${skin.accent}, inset 0 0 0 31px #0D0D0D`, ...motion("sv-disc 6s linear infinite") }}><span className="size-2.5 rounded-full" style={{ background: skin.page }} /></span>
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="font-label text-[10px] uppercase tracking-[0.16em]" style={{ color: skin.muted }}>{copy.onRepeat}</span>
          <span className="font-display text-[24px] font-extrabold leading-none tracking-[-0.03em]">{copy.title}</span>
          <span className="text-[13px]" style={{ color: skin.muted }}>{action}</span>
        </span>
      </button>
    );
  }

  if (style === "poster") {
    return (
      <button {...data} aria-pressed={api.on} className={`flex min-h-[150px] w-full flex-col justify-between gap-[22px] p-[18px] text-left transition active:scale-[.99] ${focus}`} onClick={toggle} style={{ background: skin.accent, color: skin.onAccent, borderRadius: skin.cardRadius, outlineColor: skin.fg }} type="button">
        <span className="flex w-full justify-between font-label text-[10px] uppercase tracking-[0.16em]"><span>{copy.soundtrack}</span><span>{api.on && !api.waiting ? "■" : "▶"} {action}</span></span>
        <span className="font-display text-[40px] font-extrabold leading-[0.9] tracking-[-0.05em]">{copy.title}</span>
      </button>
    );
  }

  return (
    <div {...data} className="flex min-h-11 items-center gap-2.5 rounded-full px-1.5 text-[13.5px]" style={{ boxShadow: `inset 0 0 0 1px ${skin.border}` }}>
      <button aria-pressed={api.on} className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition active:scale-[.98] ${focus} relative after:absolute after:-inset-1.5 after:content-['']`} onClick={toggle} style={{ background: skin.fg, color: skin.page, outlineColor: skin.fg }} type="button"><SpeakerIcon className="size-3.5" on={api.on} />{action}</button>
      <span className="truncate" style={{ color: skin.muted }}>{copy.title}</span>
    </div>
  );
}

/** An icon-only control remains after the visitor makes a sound choice. */
function SoundPill({ api }: { api: SoundtrackApi }) {
  const show = api.status !== "loading" && api.status !== "unavailable" && !api.asking;
  const playing = api.status === "playing";
  return (
    <div aria-hidden={!show} className="pointer-events-none sticky bottom-0 z-30 h-0" data-premium-sound={api.premiumPresentation ? "true" : undefined} data-sound-ui>
      <div className={`absolute bottom-[max(16px,env(safe-area-inset-bottom))] right-3 transition duration-300 ${show ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
        <button
          aria-label={api.waiting ? "Tap to play sound" : api.on ? "Sound on. Mute." : "Muted. Turn sound on."}
          aria-pressed={api.on}
          className={`grid size-11 place-items-center rounded-full bg-[rgba(13,13,13,.68)] text-[#F5F4EF] shadow-[0_14px_36px_-16px_rgba(0,0,0,.7),inset_0_0_0_1px_rgba(245,244,239,.16)] backdrop-blur-xl transition active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5A4F] ${api.premiumPresentation ? "ring-2 ring-[#FF5A4F] ring-offset-2 ring-offset-[#0D0D0D]" : ""} ${show ? "pointer-events-auto" : ""}`}
          onClick={api.on && !api.waiting ? api.soundOff : api.soundOn}
          tabIndex={show ? 0 : -1}
          title={api.waiting ? "Tap to play sound" : api.on ? "Sound on" : "Muted"}
          type="button"
        >
          <span aria-hidden="true" className="relative grid size-4 place-items-center">
            <SpeakerIcon className="size-4" on={api.on} />
            {playing && <span className="absolute -right-1 -top-1 size-1.5 rounded-full bg-[#FF5A4F] [animation:sound-breathe_2.4s_ease-in-out_infinite]" />}
          </span>
        </button>
      </div>
    </div>
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
