import { getSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getSupabaseConfig();

  if (!config) {
    return Response.json(
      { status: "not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const healthUrl = new URL("/auth/v1/health", config.url);
    const response = await fetch(healthUrl, {
      headers: { apikey: config.publishableKey },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    return Response.json(
      { status: response.ok ? "connected" : "unavailable" },
      {
        status: response.ok ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
