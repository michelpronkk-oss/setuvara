import "server-only";

import { cookies, headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import { LOCALE_COOKIE, resolveLocale, resolveRegion, type Locale } from "./locale";
import type { CountryCode } from "./countries";

export async function resolveRequestLocale(options: {
  supabase?: SupabaseClient;
  userId?: string | null;
} = {}): Promise<Locale> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  let preferredLocale: unknown;

  if (options.supabase && options.userId) {
    const { data } = await options.supabase
      .from("account_preferences")
      .select("preferred_locale")
      .eq("user_id", options.userId)
      .maybeSingle();
    preferredLocale = data?.preferred_locale;
  }

  return resolveLocale({
    authenticated: Boolean(options.userId),
    preferredLocale,
    cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: requestHeaders.get("accept-language"),
  });
}

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
