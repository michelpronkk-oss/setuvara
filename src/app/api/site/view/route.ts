import { after } from "next/server";

import { sitePageForPath } from "@/lib/analytics/site-pages";
import { recordSitePageView } from "@/lib/analytics/site";
import { clientIp, createRateLimit, sameOrigin } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keeps one browser from inflating the counts; the address is held in memory only.
const limit = createRateLimit({ windowMs: 10 * 60 * 1000, perIp: 60, perWindow: 1_000_000 });

/** Counts one view of a public site page for admin traffic. The body carries only the path. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  let path: unknown;
  try { path = ((await request.json()) as { path?: unknown }).path; } catch { return new Response(null, { status: 400 }); }
  const page = typeof path === "string" && path.length <= 200 ? sitePageForPath(path) : null;
  if (!page) return new Response(null, { status: 204 });

  const ip = clientIp(request);
  if (!limit.allowed(ip)) return new Response(null, { status: 204 });
  limit.record(ip);

  const headers = new Headers(request.headers);
  after(() => recordSitePageView(page, headers));
  return new Response(null, { status: 204 });
}
