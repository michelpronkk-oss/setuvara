import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { ADMIN_ROUTE_PREFIX, isAdminHost } from "@/lib/admin/host";
import { crawlerFor, crawlerSection, recordCrawlerVisit } from "@/lib/analytics/crawlers";
import { updateSession } from "@/lib/supabase/proxy";
import { isReservedUsername } from "@/lib/usernames";

const ADMIN_RESPONSE_HEADERS: Record<string, string> = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, no-store",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function notFound() {
  return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

function isAdminPath(pathname: string) {
  return pathname === ADMIN_ROUTE_PREFIX || pathname.startsWith(`${ADMIN_ROUTE_PREFIX}/`) || pathname.startsWith("/api/admin/");
}

/**
 * admin.setuvara.com serves only the Admin Control Center: every page path is rewritten into the
 * /admin route tree and only /api/admin/* is reachable. On every other host the admin tree 404s.
 */
async function adminProxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let response: NextResponse;

  if (pathname.startsWith("/api/")) {
    if (!pathname.startsWith("/api/admin/")) return notFound();
    response = await updateSession(request);
  } else if (pathname === ADMIN_ROUTE_PREFIX || pathname.startsWith(`${ADMIN_ROUTE_PREFIX}/`)) {
    // Admin URLs never carry the internal prefix.
    const destination = request.nextUrl.clone();
    destination.pathname = pathname.slice(ADMIN_ROUTE_PREFIX.length) || "/";
    return NextResponse.redirect(destination, 308);
  } else {
    const destination = request.nextUrl.clone();
    destination.pathname = pathname === "/" ? ADMIN_ROUTE_PREFIX : `${ADMIN_ROUTE_PREFIX}${pathname}`;
    response = await updateSession(request, new Headers(request.headers), destination);
  }

  for (const [name, value] of Object.entries(ADMIN_RESPONSE_HEADERS)) response.headers.set(name, value);
  return response;
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;

  if (isAdminHost(request.headers.get("host"))) return adminProxy(request);
  if (isAdminPath(pathname)) return notFound();

  // Search and AI crawlers: one daily counter per bot and section, written after the response.
  const bot = crawlerFor(request.headers.get("user-agent"));
  const section = bot ? crawlerSection(pathname) : null;
  if (bot && section) event.waitUntil(recordCrawlerVisit(bot, section));

  // setuvara.com/@aanya is an alias of the canonical setuvara.com/aanya.
  const handleAlias = /^\/(?:@|%40)([A-Za-z0-9_]{3,24})\/?$/.exec(pathname);
  if (handleAlias && !isReservedUsername(handleAlias[1])) {
    const destination = request.nextUrl.clone();
    destination.pathname = `/${handleAlias[1].toLowerCase()}`;
    return NextResponse.redirect(destination, 308);
  }

  if (pathname === "/nl" || pathname.startsWith("/nl/")) {
    const destination = request.nextUrl.clone();
    destination.pathname = pathname === "/nl" ? "/" : pathname.slice(3);
    return NextResponse.redirect(destination, 308);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health/supabase|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
