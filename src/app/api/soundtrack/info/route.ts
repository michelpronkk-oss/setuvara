import { oembedEndpoint, parseMusic } from "@/lib/blocks/media";
import { safeGet } from "@/lib/net/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_JSON = 120_000;

export type SoundtrackInfo = { title: string | null; artist: string | null; artwork: string | null };

/**
 * The name, artist and artwork of a pasted music link, for the soundtrack try-it on /product.
 * Public, like /api/soundtrack: only the providers' own oEmbed or lookup APIs are called, built
 * from ids the music parser accepted, so no visitor-supplied host is ever fetched.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  const media = raw.length <= 500 ? parseMusic(raw) : null;
  if (!media?.soundtrack) return Response.json({ error: "Not a song or playlist link." }, { status: 400 });

  try {
    const info = media.provider === "apple_music" ? await apple(media.type, media.id, media.url) : await oembed(media.url);
    return Response.json(info ?? { title: null, artist: null, artwork: media.artwork }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
  } catch {
    return Response.json({ title: null, artist: null, artwork: media.artwork }, { headers: { "Cache-Control": "public, s-maxage=300" } });
  }
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 140) : null);
const https = (value: unknown) => (typeof value === "string" && /^https:\/\//i.test(value) && value.length <= 1000 ? value : null);

async function json(url: string) {
  const response = await safeGet(new URL(url), MAX_JSON, { accept: "application/json" });
  if (response.status !== 200) return null;
  return JSON.parse(response.body.toString("utf8")) as Record<string, unknown>;
}

async function oembed(url: string): Promise<SoundtrackInfo | null> {
  const endpoint = oembedEndpoint(url);
  const data = endpoint ? await json(endpoint) : null;
  if (!data) return null;
  // YouTube and SoundCloud put the artist in author_name; Spotify's title is the whole name.
  return { title: text(data.title), artist: text(data.author_name), artwork: https(data.thumbnail_url) };
}

async function apple(type: string, id: string, url: string): Promise<SoundtrackInfo | null> {
  const country = /^https:\/\/music\.apple\.com\/([a-z]{2})\//.exec(url)?.[1] ?? "us";
  const data = await json(`https://itunes.apple.com/lookup?id=${id}&country=${country}`);
  const item = Array.isArray(data?.results) ? (data.results as Record<string, unknown>[])[0] : null;
  if (!item) return null;
  return { title: text(type === "song" ? item.trackName : item.collectionName), artist: text(item.artistName), artwork: https(item.artworkUrl100)?.replace("100x100", "300x300") ?? null };
}
