import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
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
