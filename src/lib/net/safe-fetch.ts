import { lookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";

/**
 * Fetches from the public internet only. Every DNS answer is checked at
 * connect time, so redirects and DNS rebinding can't reach private networks.
 * Bodies are size-capped, redirects are followed manually and re-checked.
 */

const HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/i;
const TIMEOUT = 4_000;

export type Fetched = { status: number; type: string; body: Buffer; url: URL };

export function isPublicHostname(host: string) {
  return HOST_PATTERN.test(host) && !isIP(host) && !/(^|\.)(localhost|local|internal|lan|home|corp)$/.test(host);
}

const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) return callback(new Error("Blocked address"), "", 4);
    if (options.all) return (callback as unknown as (error: null, list: typeof addresses) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

/**
 * GET a public URL. With `truncate`, a body over `limit` is cut there (enough
 * for an HTML head); otherwise an oversized body rejects.
 */
export function safeGet(url: URL, limit: number, { truncate = false, accept = "text/html,image/*;q=0.9,*/*;q=0.5", redirects = 3 }: { truncate?: boolean; accept?: string; redirects?: number } = {}): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    if ((url.protocol !== "https:" && url.protocol !== "http:") || isIP(url.hostname.replace(/^\[|\]$/g, ""))) return reject(new Error("Blocked URL"));
    if (url.port && url.port !== "443" && url.port !== "80") return reject(new Error("Blocked port"));
    const client = url.protocol === "https:" ? https : http;
    const request = client.get(url, { lookup: publicLookup, timeout: TIMEOUT, headers: { "User-Agent": "Mozilla/5.0 (compatible; SetuvaraBot/1.0; +https://setuvara.com)", Accept: accept, "Accept-Language": "en;q=0.9,*;q=0.5" } }, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        response.resume();
        if (redirects <= 0) return reject(new Error("Too many redirects"));
        try { return resolve(safeGet(new URL(location, url), limit, { truncate, accept, redirects: redirects - 1 })); } catch (error) { return reject(error); }
      }
      const chunks: Buffer[] = [];
      let size = 0;
      let done = false;
      const finish = () => { if (done) return; done = true; resolve({ status, type: String(response.headers["content-type"] ?? ""), body: Buffer.concat(chunks), url }); };
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) {
          if (truncate) { chunks.push(chunk); response.destroy(); finish(); } else { request.destroy(new Error("Too large")); }
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", finish);
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("Timed out")));
    request.on("error", reject);
  });
}

export function isPrivateAddress(address: string) {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const ip = mapped ? mapped[1] : address.toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  return ip === "::" || ip === "::1" || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith("64:ff9b:") || ip.startsWith("2001:db8");
}

/** Reads one attribute from a single HTML tag string. */
export function tagAttr(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find((value) => value !== undefined)?.trim();
}

/** The <head> of an HTML document, or the whole fragment if it has none. */
export function htmlHead(html: string) {
  const end = html.search(/<\/head>/i);
  return end > 0 ? html.slice(0, end) : html;
}
