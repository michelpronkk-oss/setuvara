import { lookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";

export const runtime = "nodejs";

const HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/i;
const MAX_HTML = 300_000;
const MAX_ICON = 150_000;
const TIMEOUT = 4_000;
const FOUND = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";
const MISSING = "public, max-age=3600, s-maxage=86400";

type Fetched = { status: number; type: string; body: Buffer; url: URL };

/**
 * Serves a site's own icon so links without a brand mark still look like
 * themselves. Only public hosts are fetched: every DNS answer is checked
 * at connect time, so redirects and rebinding can't reach private networks.
 */
export async function GET(request: Request) {
  const host = new URL(request.url).searchParams.get("host")?.trim().toLowerCase().replace(/\.$/, "") ?? "";
  if (!HOST_PATTERN.test(host) || isIP(host) || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(host)) return missing(400);

  const candidates: URL[] = [];
  try {
    const page = await get(new URL(`https://${host}/`), MAX_HTML);
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
      const icon = await get(candidate, MAX_ICON);
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

function missing(status: number) {
  return new Response(null, { status, headers: { "Cache-Control": MISSING } });
}

function iconsFromHtml(html: string, base: URL): URL[] {
  const end = html.search(/<\/head>/i);
  const head = end > 0 ? html.slice(0, end) : html;
  const found: { url: URL; score: number }[] = [];
  for (const [tag] of head.matchAll(/<link\b[^>]*>/gi)) {
    const attr = (name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find((value) => value !== undefined)?.trim();
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

const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    if (!addresses.length || addresses.some((entry) => isPrivate(entry.address))) return callback(new Error("Blocked address"), "", 4);
    if (options.all) return (callback as unknown as (error: null, list: typeof addresses) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

function get(url: URL, limit: number, redirects = 3): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    if ((url.protocol !== "https:" && url.protocol !== "http:") || isIP(url.hostname.replace(/^\[|\]$/g, ""))) return reject(new Error("Blocked URL"));
    if (url.port && url.port !== "443" && url.port !== "80") return reject(new Error("Blocked port"));
    const client = url.protocol === "https:" ? https : http;
    const request = client.get(url, { lookup: publicLookup, timeout: TIMEOUT, headers: { "User-Agent": "Mozilla/5.0 (compatible; SetuvaraIconBot/1.0; +https://setuvara.com)", Accept: "text/html,image/*;q=0.9,*/*;q=0.5" } }, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        response.resume();
        if (redirects <= 0) return reject(new Error("Too many redirects"));
        try { return resolve(get(new URL(location, url), limit, redirects - 1)); } catch (error) { return reject(error); }
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) {
          // HTML only needs its head; anything else that big isn't an icon.
          if (limit === MAX_HTML) { chunks.push(chunk); response.destroy(); finish(); } else { request.destroy(new Error("Too large")); }
          return;
        }
        chunks.push(chunk);
      });
      let done = false;
      const finish = () => { if (done) return; done = true; resolve({ status, type: String(response.headers["content-type"] ?? ""), body: Buffer.concat(chunks), url }); };
      response.on("end", finish);
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("Timed out")));
    request.on("error", reject);
  });
}

function isPrivate(address: string) {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const ip = mapped ? mapped[1] : address.toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  return ip === "::" || ip === "::1" || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith("64:ff9b:") || ip.startsWith("2001:db8");
}
