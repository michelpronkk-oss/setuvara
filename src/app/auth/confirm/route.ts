import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseConfig } from "@/lib/supabase/config";

const DEFAULT_NEXT_PATH = "/app/identity";

function getSafeNextPath(value: string | null, origin: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_NEXT_PATH;
  }

  try {
    const destination = new URL(value, origin);

    if (destination.origin !== origin) return DEFAULT_NEXT_PATH;

    return destination.pathname;
  } catch {
    return DEFAULT_NEXT_PATH;
  }
}

function redirectToPath(path: string) {
  const response = new NextResponse(null, { status: 307 });
  response.headers.set("Location", path);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function confirmationError() {
  return redirectToPath("/login?error=confirmation_failed");
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const otpType = request.nextUrl.searchParams.get("type");
  const supportedOtpTypes = new Set<EmailOtpType>([
    "email",
    "invite",
    "magiclink",
    "recovery",
    "email_change",
  ]);

  // Supabase's default email template links back with a PKCE `code` instead of
  // a token hash. Accept both so confirmation works with either template.
  const code = request.nextUrl.searchParams.get("code");
  const usesCode = !tokenHash && Boolean(code) && (code?.length ?? 0) <= 512;

  if (!usesCode && (!tokenHash || tokenHash.length > 512 || !otpType || !supportedOtpTypes.has(otpType as EmailOtpType))) {
    return confirmationError();
  }

  const config = getSupabaseConfig();
  if (!config) return confirmationError();

  const cookieMutations: Array<(response: NextResponse) => void> = [];
  const responseHeaders: Array<[string, string]> = [];
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          cookieMutations.push((response) => response.cookies.set(name, value, options));
        });
        Object.entries(headers).forEach(([name, value]) => responseHeaders.push([name, value]));
      },
    },
  });
  const { data, error } = usesCode
    ? await supabase.auth.exchangeCodeForSession(code as string)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash as string, type: otpType as EmailOtpType });

  if (error || !data.session) return confirmationError();

  const response = redirectToPath(
    getSafeNextPath(request.nextUrl.searchParams.get("next"), request.nextUrl.origin),
  );
  cookieMutations.forEach((applyCookie) => applyCookie(response));
  responseHeaders.forEach(([name, value]) => response.headers.set(name, value));
  return response;
}
