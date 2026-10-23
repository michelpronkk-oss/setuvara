import { htmlHead, tagAttr } from "@/lib/net/safe-fetch";
import { metaContent } from "@/lib/tools/link-check";

/**
 * Reads a public link-in-bio page (Linktree, Beacons, Carrd or any site) into the few things a
 * Setuvara page starts from: a name, a line, a picture and the outbound links. Plain HTML in,
 * plain data out, so it can be tested without fetching. Nothing is stored.
 */

export type ImportedPage = { name: string; bio: string; image: string | null; links: { title: string; url: string }[] };

export const MAX_LINKS = 8;
const SKIP_TEXT = /^(privacy|terms|cookie|report|sign ?up|log ?in|get started|explore|discover|home|create your|join)\b/i;

const decode = (text: string) => text
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
const clean = (text: string) => decode(text.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/** "Aanya Rao | Linktree" and "@aanya | Beacons" → "Aanya Rao", "@aanya". */
function nameFrom(title: string) {
  return title.split(/\s[|·•–—-]\s/)[0].replace(/^@/, "").trim().slice(0, 40);
}

export function readPage(html: string, finalUrl: URL): ImportedPage {
  const head = htmlHead(html);
  const title = clean(metaContent(head, "og:title") ?? head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "");
  const bio = clean(metaContent(head, "og:description") ?? metaContent(head, "description") ?? "").slice(0, 120);
  const rawImage = metaContent(head, "og:image") ?? metaContent(head, "twitter:image");
  let image: string | null = null;
  try { if (rawImage) { const url = new URL(rawImage, finalUrl); if (url.protocol === "https:" || url.protocol === "http:") image = url.href; } } catch { /* no picture */ }

  const seen = new Set<string>();
  const links: ImportedPage["links"] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = tagAttr(match[1], "href");
    if (!href) continue;
    let url: URL;
    try { url = new URL(href, finalUrl); } catch { continue; }
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.hostname === finalUrl.hostname) continue;
    const key = `${url.hostname}${url.pathname}`.replace(/\/$/, "");
    const text = clean(match[2]).slice(0, 40);
    if (seen.has(key) || SKIP_TEXT.test(text)) continue;
    seen.add(key);
    links.push({ title: text || url.hostname.replace(/^www\./, ""), url: url.href });
    if (links.length === MAX_LINKS) break;
  }
  return { name: nameFrom(title) || finalUrl.pathname.split("/").filter(Boolean).pop() || "", bio, image, links };
}
