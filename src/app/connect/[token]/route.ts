import { NextResponse, type NextRequest } from "next/server";

import type { ModeSlug } from "@/components/profile/types";
import { passTokenPattern, profilePath, visitorPassCookie } from "@/lib/connections/access";
import { createClient } from "@/lib/supabase/server";

type ResolvedPass = { username: string; mode: ModeSlug; valid: boolean };

const PASS_MAX_AGE = 60 * 60 * 24;

// Connection Pass entry: validate server-side, keep the pass in an HttpOnly
// cookie for this exact profile and Mode, then land on the clean public URL.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Redirect on the host the visitor used, so the pass cookie lands on that host.
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? request.nextUrl.protocol.replace(":", "");
  const origin = host ? `${protocol}://${host}` : request.nextUrl.origin;
  let resolved: ResolvedPass | null = null;
  if (passTokenPattern.test(token)) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.rpc("resolve_connection_pass", { p_token: token });
      resolved = data as ResolvedPass | null;
    } catch {
      resolved = null;
    }
  }

  // Unknown passes, or passes for a profile that isn't live, have nowhere to land.
  const response = NextResponse.redirect(new URL(resolved ? profilePath(resolved.username, resolved.mode) : "/", origin), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (!resolved) return response;

  const cookie = visitorPassCookie(resolved.username, resolved.mode);
  if (resolved.valid) {
    response.cookies.set(cookie, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: PASS_MAX_AGE,
    });
  } else {
    // Expired or revoked: the profile still opens, just without Connect.
    response.cookies.delete(cookie);
  }
  return response;
}
