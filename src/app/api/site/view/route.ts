import { after } from "next/server";

import { classifyReferrer, sectionForPath } from "@/lib/analytics/site-pages";
import { recordSiteVisit } from "@/lib/analytics/site";
import { clientIp, createRateLimit, sameOrigin } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keeps one browser from inflating the counts; the address is held in memory only.
const limit = createRateLimit({ windowMs: 10 * 60 * 1000, perIp: 60, perWindow: 1_000_000 });

/**
 * Counts one view of a public site page for admin traffic. The body carries the path, the
 * referring URL and utm_source; the referrer is reduced to a class ("google", "chatgpt") here and
 * the URL itself is never stored.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  let body: { path?: unknown; referrer?: unknown; utm?: unknown };
  try { body = (await request.json()) as typeof body; } catch { return new Response(null, { status: 400 }); }
  const path = typeof body.path === "string" && body.path.length <= 200 ? (body.path.replace(/\/+$/, "") || "/") : null;
  const section = path ? sectionForPath(path) : null;
  if (!path || !section) return new Response(null, { status: 204 });

  const ip = clientIp(request);
  if (!limit.allowed(ip)) return new Response(null, { status: 204 });
  limit.record(ip);

  const referrer = classifyReferrer(
    typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null,
    typeof body.utm === "string" ? body.utm.slice(0, 60) : null,
  );
  const headers = new Headers(request.headers);
  after(() => recordSiteVisit({ path, section, referrer }, headers));
  return new Response(null, { status: 204 });
}
