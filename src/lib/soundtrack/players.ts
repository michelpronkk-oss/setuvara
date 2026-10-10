/**
 * Thin, promise-based wrappers around each music provider's official player
 * API, so the soundtrack and media blocks can play, pause and listen to the
 * same small set of events whatever the provider. Browser only.
 */

export type PlayerEvent = "playing" | "paused" | "ended" | "error" | "blocked";
export type PlayerListener = (event: PlayerEvent) => void;

export type Player = {
  play: () => void;
  pause: () => void;
  /** Back to the start and play: the soundtrack loops. */
  restart: () => void;
  destroy: () => void;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- third-party globals without published types */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    onSpotifyIframeApiReady?: (api: any) => void;
    SC?: any;
  }
}

const scripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const cached = scripts.get(src);
  if (cached) return cached;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => { scripts.delete(src); script.remove(); reject(new Error(`Could not load ${src}`)); };
    document.head.appendChild(script);
  });
  scripts.set(src, promise);
  return promise;
}

/** Rejects when a provider never answers, so a profile never waits on a dead player. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Player timed out")), ms);
    promise.then((value) => { window.clearTimeout(timer); resolve(value); }, (error) => { window.clearTimeout(timer); reject(error); });
  });
}

function mount(host: HTMLElement) {
  const target = document.createElement("div");
  target.style.width = "100%";
  target.style.height = "100%";
  host.appendChild(target);
  return target;
}

// ---------------------------------------------------------------- YouTube (YouTube Music + video blocks)

let youtube: Promise<any> | null = null;

function loadYouTube(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  youtube ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
    loadScript("https://www.youtube.com/iframe_api").catch((error) => { youtube = null; reject(error); });
  });
  return youtube;
}

function youtubeEvents(on: PlayerListener) {
  return {
    onStateChange: (event: { data: number }) => {
      if (event.data === 1) on("playing");
      else if (event.data === 2) on("paused");
      else if (event.data === 0) on("ended");
    },
    onError: () => on("error"),
  };
}

/** Creates a quiet YouTube player in `host` (controls hidden: the profile drives it). */
export function createYouTubePlayer(host: HTMLElement, videoId: string, on: PlayerListener): Promise<Player> {
  return withTimeout(loadYouTube().then((YT) => new Promise<Player>((resolve) => {
    const target = mount(host);
    let fade = 0;
    const player = new YT.Player(target, {
      host: "https://www.youtube-nocookie.com",
      videoId,
      width: "100%",
      height: "100%",
      playerVars: { playsinline: 1, rel: 0, controls: 0, disablekb: 1, modestbranding: 1, iv_load_policy: 3, origin: window.location.origin },
      events: {
        ...youtubeEvents(on),
        onReady: () => resolve({
          play: () => {
            window.clearInterval(fade);
            player.setVolume(0);
            player.playVideo();
            let volume = 0;
            fade = window.setInterval(() => { volume = Math.min(100, volume + 10); player.setVolume(volume); if (volume >= 100) window.clearInterval(fade); }, 60);
          },
          pause: () => { window.clearInterval(fade); player.pauseVideo(); },
          restart: () => { player.seekTo(0, true); player.playVideo(); },
          destroy: () => { window.clearInterval(fade); try { player.destroy(); } catch { /* already gone */ } target.remove(); },
        }),
      },
    });
  })), 10_000);
}

/** Listens to a YouTube iframe the page already rendered (its src needs enablejsapi=1). */
export function watchYouTubeIframe(iframe: HTMLIFrameElement, on: PlayerListener): Promise<Player> {
  return withTimeout(loadYouTube().then((YT) => new Promise<Player>((resolve) => {
    const player = new YT.Player(iframe, {
      events: {
        ...youtubeEvents(on),
        onReady: () => resolve({
          play: () => player.playVideo(),
          pause: () => player.pauseVideo(),
          restart: () => { player.seekTo(0, true); player.playVideo(); },
          destroy: () => { /* the iframe belongs to React */ },
        }),
      },
    });
  })), 10_000);
}

// ---------------------------------------------------------------- Spotify

let spotify: Promise<any> | null = null;

function loadSpotify(): Promise<any> {
  spotify ??= new Promise((resolve, reject) => {
    const previous = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => { previous?.(api); resolve(api); };
    loadScript("https://open.spotify.com/embed/iframe-api/v1").catch((error) => { spotify = null; reject(error); });
  });
  return spotify;
}

/** Creates the regular Spotify embed in `host`, driven through Spotify's iFrame API. */
export function createSpotifyPlayer(host: HTMLElement, uri: string, height: number, on: PlayerListener): Promise<Player> {
  return withTimeout(loadSpotify().then((api) => new Promise<Player>((resolve) => {
    const target = mount(host);
    api.createController(target, { uri, width: "100%", height }, (controller: any) => {
      let started = false;
      let paused = true;
      controller.addListener("playback_update", (event: { data: { isPaused: boolean; isBuffering?: boolean; position: number; duration: number } }) => {
        const { isPaused, isBuffering, position, duration } = event.data;
        if (!isPaused && !isBuffering) {
          started = true;
          if (paused) { paused = false; on("playing"); }
        } else if (isPaused && !paused) {
          paused = true;
          on(duration > 0 && position >= duration - 1500 ? "ended" : "paused");
        }
      });
      const iframe = host.querySelector("iframe");
      iframe?.setAttribute("allow", "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture");
      iframe?.classList.add("rounded-2xl");
      controller.addListener("ready", () => resolve({
        play: () => (started ? controller.resume() : controller.play()),
        pause: () => controller.pause(),
        restart: () => { controller.seek(0); controller.resume(); },
        destroy: () => { try { controller.destroy(); } catch { /* already gone */ } host.replaceChildren(); },
      }));
    });
  })), 12_000);
}

export const spotifyUri = (type: string, id: string) => `spotify:${type}:${id}`;

// ---------------------------------------------------------------- SoundCloud

function loadSoundCloud(): Promise<any> {
  if (window.SC?.Widget) return Promise.resolve(window.SC);
  return loadScript("https://w.soundcloud.com/player/api.js").then(() => window.SC);
}

/** Drives a SoundCloud player iframe through the SoundCloud Widget API. */
export function watchSoundCloudIframe(iframe: HTMLIFrameElement, on: PlayerListener): Promise<Player> {
  return withTimeout(loadSoundCloud().then((SC) => new Promise<Player>((resolve) => {
    const widget = SC.Widget(iframe);
    const events = SC.Widget.Events;
    let fade = 0;
    widget.bind(events.PLAY, () => on("playing"));
    widget.bind(events.PAUSE, () => on("paused"));
    widget.bind(events.FINISH, () => on("ended"));
    widget.bind(events.ERROR, () => on("error"));
    widget.bind(events.READY, () => resolve({
      play: () => {
        window.clearInterval(fade);
        widget.setVolume(0);
        widget.play();
        let volume = 0;
        fade = window.setInterval(() => { volume = Math.min(100, volume + 10); widget.setVolume(volume); if (volume >= 100) window.clearInterval(fade); }, 60);
      },
      pause: () => { window.clearInterval(fade); widget.pause(); },
      restart: () => { widget.seekTo(0); widget.play(); },
      destroy: () => { window.clearInterval(fade); try { Object.values(events).forEach((name) => widget.unbind(name)); } catch { /* already gone */ } },
    }));
  })), 10_000);
}

/** Creates a SoundCloud player iframe in `host` and drives it. */
export function createSoundCloudPlayer(host: HTMLElement, embedUrl: string, height: number, title: string, on: PlayerListener): Promise<Player> {
  const iframe = document.createElement("iframe");
  iframe.src = embedUrl;
  iframe.title = title;
  iframe.height = String(height);
  iframe.allow = "autoplay; encrypted-media";
  iframe.className = "w-full overflow-hidden rounded-2xl border-0";
  host.appendChild(iframe);
  return watchSoundCloudIframe(iframe, on).then((player) => ({ ...player, destroy: () => { player.destroy(); iframe.remove(); } }));
}

// ---------------------------------------------------------------- Audio previews (Apple Music, Deezer)

/** Plays a provider's official preview clip in a plain audio element. */
export function createAudioPlayer(src: string, on: PlayerListener): Promise<Player> {
  const audio = new Audio();
  audio.preload = "auto";
  audio.loop = true;
  audio.src = src;
  let fade = 0;
  audio.addEventListener("playing", () => on("playing"));
  audio.addEventListener("pause", () => on("paused"));
  audio.addEventListener("error", () => on("error"));
  return Promise.resolve({
    play: () => {
      window.clearInterval(fade);
      audio.volume = 0;
      audio.play().catch((error: Error) => on(error.name === "NotAllowedError" ? "blocked" : "error"));
      fade = window.setInterval(() => { audio.volume = Math.min(1, audio.volume + 0.1); if (audio.volume >= 1) window.clearInterval(fade); }, 60);
    },
    pause: () => { window.clearInterval(fade); audio.pause(); },
    restart: () => { audio.currentTime = 0; void audio.play().catch(() => on("blocked")); },
    destroy: () => { window.clearInterval(fade); audio.pause(); audio.removeAttribute("src"); audio.load(); },
  });
}
