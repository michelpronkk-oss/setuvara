import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveRegion } from "./locale";
import type { CountryCode } from "./countries";

export async function resolveRequestRegion(options: {
  supabase?: SupabaseClient;
  userId?: string | null;
} = {}): Promise<CountryCode | null> {
  if (!options.supabase || !options.userId) return null;
  const { data } = await options.supabase
    .from("account_preferences")
    .select("region_code")
    .eq("user_id", options.userId)
    .maybeSingle();
  return resolveRegion(data?.region_code);
}
