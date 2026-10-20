import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isSocialProvider, type SocialProvider } from "./model";

export const STATE_COOKIE = "sv-social-oauth";
export const SETTINGS_PATH = "/app/identity/creator/settings?tab=accounts";

/** The signed-in member and a known provider, or null. */
export async function socialRequest(params: Promise<{ provider: string }>): Promise<{ userId: string; provider: SocialProvider } | null> {
  const { provider } = await params;
  if (!isSocialProvider(provider)) return null;
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  return error || !userId ? null : { userId, provider };
}
