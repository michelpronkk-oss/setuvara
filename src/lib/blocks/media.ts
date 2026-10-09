/**
 * Recognises video and music URLs and turns them into privacy-friendly
 * embed URLs. Pure functions: shared by the editor, the preview route and
 * the public profile.
 */

export type VideoProvider = "youtube" | "vimeo" | "tiktok" | "loom" | "instagram";
export type MusicProvider = "spotify" | "apple_music" | "soundcloud";

export type VideoMedia = {
  provider: VideoProvider;
  id: string;
  /** Canonical page URL people can open outside the profile. */
  url: string;
  embedUrl: string;
  /** Known without a network call (YouTube only). */
  thumbnail: string | null;
  vertical: boolean;
};

export type MusicMedia = {
  provider: MusicProvider;
  url: string;
  embedUrl: string;
  height: number;
};

export const VIDEO_PROVIDER_NAMES: Record<VideoProvider, string> = { youtube: "YouTube", vimeo: "Vimeo", tiktok: "TikTok", loom: "Loom", instagram: "Instagram" };
export const MUSIC_PROVIDER_NAMES: Record<MusicProvider, string> = { spotify: "Spotify", apple_music: "Apple Music", soundcloud: "SoundCloud" };

function toUrl(input: string): URL | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

const host = (url: URL) => url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
const ID = /^[A-Za-z0-9_-]{6,64}$/;

export function parseVideo(input: string): VideoMedia | null {
  const url = toUrl(input);
  if (!url) return null;
  const h = host(url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (h === "youtube.com" || h === "youtu.be" || h === "youtube-nocookie.com" || h === "music.youtube.com") {
    let id: string | null = null;
    let vertical = false;
    if (h === "youtu.be") id = parts[0] ?? null;
    else if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (["shorts", "embed", "live", "v"].includes(parts[0] ?? "")) { id = parts[1] ?? null; vertical = parts[0] === "shorts"; }
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    const start = Number.parseInt(url.searchParams.get("t") ?? url.searchParams.get("start") ?? "", 10);
    const startParam = Number.isFinite(start) && start > 0 ? `&start=${start}` : "";
    return {
      provider: "youtube",
      id,
      url: vertical ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1${startParam}`,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      vertical,
    };
  }

  if (h === "vimeo.com" || h === "player.vimeo.com") {
    const index = parts.findIndex((part) => /^\d{6,12}$/.test(part));
    if (index < 0) return null;
    const id = parts[index];
    const hash = url.searchParams.get("h") ?? (parts[index + 1] && /^[a-f0-9]{6,20}$/i.test(parts[index + 1]) ? parts[index + 1] : null);
    return { provider: "vimeo", id, url: `https://vimeo.com/${id}${hash ? `/${hash}` : ""}`, embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1${hash ? `&h=${hash}` : ""}`, thumbnail: null, vertical: false };
  }

  if (h === "tiktok.com") {
    const index = parts.indexOf("video");
    const id = index >= 0 ? parts[index + 1] : null;
    if (!id || !/^\d{8,25}$/.test(id)) return null;
    const user = parts[0]?.startsWith("@") ? parts[0] : "@";
    return { provider: "tiktok", id, url: `https://www.tiktok.com/${user}/video/${id}`, embedUrl: `https://www.tiktok.com/player/v1/${id}?autoplay=1&music_info=1&description=1`, thumbnail: null, vertical: true };
  }

  if (h === "loom.com") {
    const id = parts[0] === "share" || parts[0] === "embed" ? parts[1] : null;
    if (!id || !/^[a-f0-9]{16,40}$/i.test(id)) return null;
    return { provider: "loom", id, url: `https://www.loom.com/share/${id}`, embedUrl: `https://www.loom.com/embed/${id}?autoplay=1&hide_owner=true&hide_share=true`, thumbnail: `https://cdn.loom.com/sessions/thumbnails/${id}-with-play.gif`, vertical: false };
  }

  if (h === "instagram.com") {
    const kind = parts[0];
    const id = parts[1];
    if (!["reel", "reels", "p", "tv"].includes(kind ?? "") || !id || !ID.test(id)) return null;
    const path = kind === "p" ? "p" : "reel";
    return { provider: "instagram", id, url: `https://www.instagram.com/${path}/${id}/`, embedUrl: `https://www.instagram.com/${path}/${id}/embed/`, thumbnail: null, vertical: true };
  }

  return null;
}

export function parseMusic(input: string): MusicMedia | null {
  const url = toUrl(input);
  if (!url) return null;
  const h = host(url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (h === "open.spotify.com" || h === "spotify.com") {
    const clean = parts[0]?.startsWith("intl-") ? parts.slice(1) : parts;
    const [type, id] = clean[0] === "embed" ? clean.slice(1) : clean;
    if (!["track", "album", "playlist", "artist", "episode", "show"].includes(type ?? "") || !id || !/^[A-Za-z0-9]{10,32}$/.test(id)) return null;
    return { provider: "spotify", url: `https://open.spotify.com/${type}/${id}`, embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=setuvara`, height: type === "track" || type === "episode" ? 152 : 352 };
  }

  if (h === "music.apple.com" || h === "embed.music.apple.com") {
    if (parts.length < 3 || !/^[a-z]{2}$/.test(parts[0])) return null;
    const path = `${url.pathname}${url.search}`;
    const song = url.searchParams.has("i") || parts[1] === "song";
    return { provider: "apple_music", url: `https://music.apple.com${path}`, embedUrl: `https://embed.music.apple.com${path}`, height: song ? 175 : 450 };
  }

  if (h === "soundcloud.com" || h === "on.soundcloud.com") {
    if (!parts.length) return null;
    const canonical = `https://soundcloud.com/${parts.join("/")}`;
    const set = parts[1] === "sets";
    return { provider: "soundcloud", url: canonical, embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(canonical)}&color=%23ff5a4f&auto_play=false&hide_related=true&show_comments=false&show_reposts=false&visual=false`, height: set ? 300 : 166 };
  }

  return null;
}

/** oEmbed endpoint for title/thumbnail lookup, if the provider has one. */
export function oembedEndpoint(url: string): string | null {
  const video = parseVideo(url);
  if (video?.provider === "youtube") return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(video.url)}`;
  if (video?.provider === "vimeo") return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(video.url)}`;
  if (video?.provider === "tiktok") return `https://www.tiktok.com/oembed?url=${encodeURIComponent(video.url)}`;
  if (video?.provider === "loom") return `https://www.loom.com/v1/oembed?url=${encodeURIComponent(video.url)}`;
  const music = parseMusic(url);
  if (music?.provider === "spotify") return `https://open.spotify.com/oembed?url=${encodeURIComponent(music.url)}`;
  if (music?.provider === "soundcloud") return `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(music.url)}`;
  return null;
}

/** What /api/link-preview returns for a pasted link. */
export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  kind: "video" | "music" | "page";
};
