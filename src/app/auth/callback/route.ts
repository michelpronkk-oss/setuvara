import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

function getSafeNextUrl(value: string | null, origin: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return new URL("/app/identity", origin);
  }

  try {
    const destination = new URL(value, origin);
    return destination.origin === origin
      ? new URL(destination.pathname, origin)
      : new URL("/app/identity", origin);
  } catch {
    return new URL("/app/identity", origin);
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(getSafeNextUrl(url.searchParams.get("next"), url.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback", url.origin));
}
