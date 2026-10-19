import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest, forwardedHeaders = new Headers(request.headers), rewriteTo?: URL) {
  const config = getSupabaseConfig();

  const next = () => {
    const headers = new Headers(forwardedHeaders);
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) headers.set("cookie", cookieHeader);
    else headers.delete("cookie");
    return rewriteTo
      ? NextResponse.rewrite(rewriteTo, { request: { headers } })
      : NextResponse.next({ request: { headers } });
  };

  if (!config) {
    return next();
  }

  let response = next();

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = next();

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  await supabase.auth.getClaims();

  return response;
}
