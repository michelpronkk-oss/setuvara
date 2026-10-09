import { htmlHead, isPublicHostname, safeGet, tagAttr, type Fetched } from "@/lib/net/safe-fetch";

export const runtime = "nodejs";

const MAX_HTML = 300_000;
const MAX_ICON = 150_000;
const FOUND = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";
const MISSING = "public, max-age=3600, s-maxage=86400";

/**
 * Serves a site's own icon so links without a brand mark still look like
 * themselves. Fetching goes through safeGet, which only reaches public hosts.
 */
export async function GET(request: Request) {
  // Slow sites never hold a page's icons hostage: give up after a few seconds.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<Response>((resolve) => { timer = setTimeout(() => resolve(missing(404, "public, max-age=600, s-maxage=3600")), 6_000); });
  try {
    return await Promise.race([findIcon(request), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function findIcon(request: Request) {
  const host = new URL(request.url).searchParams.get("host")?.trim().toLowerCase().replace(/\.$/, "") ?? "";
  if (!isPublicHostname(host)) return missing(400);

  const candidates: URL[] = [];
  try {
    const page = await safeGet(new URL(`https://${host}/`), MAX_HTML, { truncate: true });
    if (page.status === 200 && /html/i.test(page.type)) candidates.push(...iconsFromHtml(page.body.toString("utf8"), page.url));
    candidates.push(new URL("/favicon.ico", page.url));
  } catch {
    candidates.push(new URL(`https://${host}/favicon.ico`));
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.href) || seen.size >= 4) continue;
    seen.add(candidate.href);
    try {
      const icon = await safeGet(candidate, MAX_ICON);
      const type = imageType(icon);
      if (icon.status !== 200 || !type || icon.body.length < 16) continue;
      return new Response(new Uint8Array(icon.body), {
        headers: {
          "Content-Type": type,
          "Cache-Control": FOUND,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        },
      });
    } catch {
      // Try the next candidate.
    }
  }
  return missing(404);
}

function missing(status: number, cache = MISSING) {
  return new Response(null, { status, headers: { "Cache-Control": cache } });
}

function iconsFromHtml(html: string, base: URL): URL[] {
  const head = htmlHead(html);
  const found: { url: URL; score: number }[] = [];
  for (const [tag] of head.matchAll(/<link\b[^>]*>/gi)) {
    const attr = (name: string) => tagAttr(tag, name);
    const rel = attr("rel")?.toLowerCase() ?? "";
    const href = attr("href");
    if (!href || !/(^|\s)(icon|apple-touch-icon(-precomposed)?)(\s|$)/.test(rel) || rel.includes("mask-icon")) continue;
    let url: URL;
    try { url = new URL(href.replace(/&amp;/g, "&"), base); } catch { continue; }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    const size = Math.max(0, ...(attr("sizes") ?? "").split(/\s+/).map((value) => Number.parseInt(value, 10)).filter(Number.isFinite));
    const svg = /\.svg(\?|$)/i.test(url.pathname) || attr("type") === "image/svg+xml";
    // Prefer something crisp at 40px without pulling a huge file.
    const px = svg ? 128 : size || (rel.includes("apple") ? 180 : 32);
    found.push({ url, score: px > 256 ? 256 - (px - 256) / 10 : px });
  }
  return found.sort((a, b) => b.score - a.score).map((item) => item.url);
}

function imageType({ type, body, url }: Fetched) {
  const declared = type.split(";")[0].trim().toLowerCase();
  if (/^image\/(png|jpeg|gif|webp|avif|svg\+xml|x-icon|vnd\.microsoft\.icon)$/.test(declared)) return declared;
  // Plenty of servers send favicon.ico as text/plain or octet-stream.
  if (body.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) return "image/x-icon";
  if (body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (/\.svg$/i.test(url.pathname) && /<svg[\s>]/i.test(body.subarray(0, 1000).toString("utf8"))) return "image/svg+xml";
  return null;
}
