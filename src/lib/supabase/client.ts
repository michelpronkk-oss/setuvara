import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "./config";

export function createClient() {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return createBrowserClient(config.url, config.publishableKey);
}
