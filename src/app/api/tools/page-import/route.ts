import { isPublicHostname, safeGet } from "@/lib/net/safe-fetch";
import { MAX_BYTES } from "@/lib/tools/link-check";
import { readPage } from "@/lib/tools/page-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best effort per instance: enough to stop a loop, not a quota.
const WINDOW_MS = 60_000;
const PER_WINDOW = 6;
const MAX_IMAGE = 700_000;
const recent = new Map<string, number[]>();

function limited(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5000) recent.delete(recent.keys().next().value!);
  return hits.length > PER_WINDOW;
}

/**
 * "Bring your link in bio": reads a public page once through safeGet (public addresses only,
 * re-checked on each redirect, size- and time-capped) and returns its name, line, links and
 * picture. The picture comes back inline, so the visitor's browser never calls the other site.
 * Nothing is stored.
 */
export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return Response.json({ error: "Too many tries. Give it a minute." }, { status: 429 });

  const raw = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  let target: URL;
  try {
    target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return Response.json({ error: "That doesn’t look like a link." }, { status: 400 });
  }
  if (raw.length > 1000 || !isPublicHostname(target.hostname.toLowerCase())) return Response.json({ error: "That link can’t be read." }, { status: 400 });
  if (/(^|\.)instagram\.com$|(^|\.)tiktok\.com$/i.test(target.hostname)) return Response.json({ error: "Instagram and TikTok don’t share profiles with other sites. Paste the link in your bio instead (Linktree, Beacons, your site)." }, { status: 422 });

  try {
    const page = await safeGet(target, MAX_BYTES, { truncate: true, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" });
    if (!/html/i.test(page.type)) return Response.json({ error: "That link opens a file, not a page." }, { status: 422 });
    const found = readPage(page.body.toString("utf8"), page.url);
    let image: string | null = null;
    if (found.image) {
      try {
        const picture = await safeGet(new URL(found.image), MAX_IMAGE, { accept: "image/avif,image/webp,image/png,image/jpeg;q=0.9" });
        if (/^image\/(png|jpe?g|webp|avif|gif)$/i.test(picture.type.split(";")[0])) image = `data:${picture.type.split(";")[0]};base64,${picture.body.toString("base64")}`;
      } catch { /* no picture is fine */ }
    }
    if (!found.links.length && !found.name) return Response.json({ error: "We couldn’t find links on that page." }, { status: 422 });
    return Response.json({ ...found, image }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "We couldn’t open that page. Check the link and try again." }, { status: 422 });
  }
}
