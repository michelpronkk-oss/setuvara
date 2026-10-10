import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { passTokenPattern, profilePath, visitorPassCookie } from "@/lib/connections/access";
import { createClient } from "@/lib/supabase/server";
import { tapModes, tapTokenPattern, type TapIntent, type TapMode } from "@/lib/tap/server";

type ResolvedTap = {
  username: string;
  mode: TapMode;
  intent: TapIntent;
  connection_pass?: string | null;
  pass_expires_at?: string | null;
};

const unavailablePath = "/t/unavailable";
const maxAgeSeconds = 60 * 60 * 24;

function parseResolvedTap(value: unknown): ResolvedTap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.username !== "string" || !/^[a-z0-9_]{3,24}$/.test(row.username)) return null;
  if (typeof row.mode !== "string" || !tapModes.includes(row.mode as TapMode)) return null;
  if (row.intent !== "view_profile" && row.intent !== "connect_in_person") return null;
  return {
    username: row.username,
    mode: row.mode as TapMode,
    intent: row.intent,
    connection_pass: typeof row.connection_pass === "string" ? row.connection_pass : null,
    pass_expires_at: typeof row.pass_expires_at === "string" ? row.pass_expires_at : null,
  };
}

function unavailableResponse() {
  return internalRedirect(unavailablePath);
}

function internalRedirect(path: string) {
  const response = new NextResponse(null, { status: 303, headers: { Location: path } });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tapTokenPattern.test(token)) return unavailableResponse();

  let resolved: ResolvedTap | null = null;
  try {
    const cookieStore = await cookies();
    const currentPassTokens = cookieStore.getAll()
      .filter(({ name, value }) => /^sv-pass-[a-z0-9_]{3,24}-(personal|event|business)$/.test(name) && passTokenPattern.test(value))
      .slice(0, 32)
      .map(({ value }) => value);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("resolve_tap", {
      p_token: token,
      p_current_pass_tokens: currentPassTokens,
    });
    if (!error) resolved = parseResolvedTap(data);
  } catch {
    resolved = null;
  }

  if (!resolved) return unavailableResponse();

  const profileUrl = new URL(profilePath(resolved.username, resolved.mode), "https://setuvara.com");
  profileUrl.searchParams.set("mode", resolved.mode);
  profileUrl.searchParams.set("source", "tap");
  const response = internalRedirect(`${profileUrl.pathname}${profileUrl.search}`);
  const connectionPass = resolved.connection_pass;
  if (resolved.intent === "connect_in_person" && connectionPass && passTokenPattern.test(connectionPass)) {
    const cookieName = visitorPassCookie(resolved.username, resolved.mode);
    const responseAge = resolved.pass_expires_at
      ? Math.max(0, Math.min(maxAgeSeconds, Math.floor((Date.parse(resolved.pass_expires_at) - Date.now()) / 1000)))
      : maxAgeSeconds;
    response.cookies.set(cookieName, connectionPass, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: responseAge,
    });
  }
  return response;
}
