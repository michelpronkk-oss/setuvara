import { oembedEndpoint, parseMusic, parseVideo, type LinkPreview } from "@/lib/blocks/media";
import { htmlHead, isPublicHostname, safeGet, tagAttr } from "@/lib/net/safe-fetch";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HTML = 400_000;
const MAX_JSON = 60_000;

/**
 * Looks up a link's title, description and image for the editor, so a
 * pasted link becomes a finished card. Signed-in owners only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to fetch link details." }, { status: 401 });

  const raw = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  let target: URL;
  try {
    target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return Response.json({ error: "That doesn’t look like a link." }, { status: 400 });
  }
  if (!isPublicHostname(target.hostname.toLowerCase()) || raw.length > 1000) return Response.json({ error: "That link can’t be previewed." }, { status: 400 });

  const video = parseVideo(target.href);
  const music = video ? null : parseMusic(target.href);
  const kind: LinkPreview["kind"] = video ? "video" : music ? "music" : "page";
  const canonical = video?.url ?? music?.url ?? target.href;
  const preview: LinkPreview = { url: canonical, title: null, description: null, image: video?.thumbnail ?? null, siteName: null, kind };

  const oembed = oembedEndpoint(canonical);
  if (oembed) {
    try {
      const response = await safeGet(new URL(oembed), MAX_JSON, { accept: "application/json" });
      if (response.status === 200) {
        const data = JSON.parse(response.body.toString("utf8")) as Record<string, unknown>;
        preview.title = clean(data.title, 120);
        preview.siteName = clean(data.provider_name, 80);
        preview.image = httpsUrl(data.thumbnail_url) ?? preview.image;
        if (!preview.description && typeof data.author_name === "string") preview.description = clean(data.author_name, 240);
      }
    } catch {
      // Fall back to the page's own meta tags.
    }
  }

  if (!preview.title || (!preview.image && kind === "page")) {
    try {
      const page = await safeGet(new URL(canonical), MAX_HTML, { truncate: true, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" });
      if (page.status < 400 && /html/i.test(page.type)) Object.assign(preview, fromHtml(page.body.toString("utf8"), page.url, preview));
    } catch {
      // A preview is a convenience: the owner can still fill the fields in.
    }
  }

  return Response.json(preview, { headers: { "Cache-Control": "private, max-age=600" } });
}

function fromHtml(html: string, base: URL, current: LinkPreview): Partial<LinkPreview> {
  const head = htmlHead(html);
  const meta = new Map<string, string>();
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (tagAttr(tag, "property") ?? tagAttr(tag, "name") ?? "").toLowerCase();
    const content = tagAttr(tag, "content");
    if (key && content && !meta.has(key)) meta.set(key, decode(content));
  }
  const titleTag = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const image = meta.get("og:image:secure_url") ?? meta.get("og:image") ?? meta.get("twitter:image") ?? meta.get("twitter:image:src");
  let imageUrl: string | null = null;
  if (image) {
    try { imageUrl = httpsUrl(new URL(image, base).href); } catch { imageUrl = null; }
  }
  return {
    title: current.title ?? clean(meta.get("og:title") ?? meta.get("twitter:title") ?? (titleTag ? decode(titleTag) : null), 120),
    description: current.description ?? clean(meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"), 240),
    image: current.image ?? imageUrl,
    siteName: current.siteName ?? clean(meta.get("og:site_name") ?? base.hostname.replace(/^www\./, ""), 80),
  };
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function httpsUrl(value: unknown) {
  return typeof value === "string" && /^https:\/\//i.test(value) && value.length <= 1000 ? value : null;
}

function decode(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
