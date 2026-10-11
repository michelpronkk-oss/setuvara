import { type NextRequest } from "next/server";

import { resolveLocale } from "@/lib/i18n/locale";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const englishMarketingPaths = new Set(["/", "/pricing", "/events", "/teams", "/roadmap"]);
  const localizedLocale = pathname === "/nl" || pathname.startsWith("/nl/")
    ? "nl"
    : englishMarketingPaths.has(pathname)
      ? "en"
      : resolveLocale({
        cookieLocale: request.cookies.get("sv-locale")?.value,
        acceptLanguage: request.headers.get("accept-language"),
      });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-setuvara-locale", localizedLocale);
  return updateSession(request, requestHeaders);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health/supabase|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
