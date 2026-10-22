import { isPublicHostname, safeGet } from "@/lib/net/safe-fetch";
import { checkPage, MAX_BYTES, scoreOf } from "@/lib/tools/link-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best effort per instance: enough to stop a loop, not a quota.
const WINDOW_MS = 60_000;
const PER_WINDOW = 8;
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
 * The free link-in-bio checker. Public, so every fetch goes through safeGet (public addresses
 * only, re-checked on each redirect and at connect time, size- and time-capped). Only the
 * verdicts go back, never the fetched page.
 */
export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return Response.json({ error: "Too many checks. Try again in a minute." }, { status: 429 });

  const raw = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  let target: URL;
  try {
    target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return Response.json({ error: "That doesn’t look like a link." }, { status: 400 });
  }
  if (raw.length > 1000 || !isPublicHostname(target.hostname.toLowerCase())) return Response.json({ error: "That link can’t be checked." }, { status: 400 });

  const started = Date.now();
  try {
    const page = await safeGet(target, MAX_BYTES, { truncate: true, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" });
    const ms = Date.now() - started;
    if (!/html/i.test(page.type)) return Response.json({ error: "That link opens a file, not a page." }, { status: 422 });
    const checks = checkPage({ html: page.body.toString("utf8"), finalUrl: page.url, status: page.status, ms, truncated: page.body.length > MAX_BYTES });
    return Response.json({ url: page.url.href, score: scoreOf(checks), checks }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "We couldn’t open that page. Check the link and try again." }, { status: 422 });
  }
}
