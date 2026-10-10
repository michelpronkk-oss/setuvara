import { parseMusic } from "@/lib/blocks/media";
import { safeGet } from "@/lib/net/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_JSON = 200_000;

type SoundtrackSource = { src: string };

/**
 * Resolves the official preview clip for providers whose embeds can't be
 * driven from the page (Apple Music, Deezer), so a soundtrack plays in a
 * plain audio element. Public: visitors need it. Only Apple's and Deezer's
 * own APIs are ever called, built from ids the music parser accepted.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  const media = raw.length <= 500 ? parseMusic(raw) : null;
  if (!media?.soundtrack || (media.provider !== "apple_music" && media.provider !== "deezer")) return Response.json({ error: "No preview for this link." }, { status: 400 });

  try {
    const source = media.provider === "apple_music" ? await apple(media.type, media.id, media.url) : await deezer(media.type, media.id);
    if (!source) return Response.json({ error: "No preview for this track." }, { status: 404, headers: { "Cache-Control": "public, s-maxage=300" } });
    // Deezer preview links are signed and expire, so the answer is only cached briefly.
    return Response.json(source, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
  } catch {
    return Response.json({ error: "The music service didn’t answer." }, { status: 502 });
  }
}

async function json(url: string) {
  const response = await safeGet(new URL(url), MAX_JSON, { accept: "application/json" });
  if (response.status !== 200) return null;
  return JSON.parse(response.body.toString("utf8")) as Record<string, unknown>;
}

const https = (value: unknown) => (typeof value === "string" && /^https:\/\//i.test(value) && value.length <= 1000 ? value : null);

async function apple(type: string, id: string, url: string): Promise<SoundtrackSource | null> {
  const country = /^https:\/\/music\.apple\.com\/([a-z]{2})\//.exec(url)?.[1] ?? "us";
  const data = await json(`https://itunes.apple.com/lookup?id=${id}&country=${country}${type === "song" ? "" : "&entity=song&limit=1"}`);
  const results = Array.isArray(data?.results) ? (data.results as Record<string, unknown>[]) : [];
  const song = results.find((item) => https(item.previewUrl));
  if (!song) return null;
  return { src: https(song.previewUrl)! };
}

async function deezer(type: string, id: string): Promise<SoundtrackSource | null> {
  const data = await json(`https://api.deezer.com/${type}/${id}`);
  if (!data || data.error) return null;
  const tracks = (data.tracks as { data?: Record<string, unknown>[] } | undefined)?.data ?? [];
  const track = type === "track" ? data : tracks.find((item) => https(item.preview));
  if (!track || !https(track.preview)) return null;
  return { src: https(track.preview)! };
}
