import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/app/identity";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(getSafeNextPath(url.searchParams.get("next")), url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback", url.origin));
}
