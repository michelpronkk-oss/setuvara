import "server-only";

import { createHmac } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Public Action forms stay closed until this is set, so merging never opens them by itself. */
export function creatorActionsEnabled() {
  return process.env.CREATOR_ACTIONS_ENABLED === "true";
}

/**
 * The service client for the two narrow Action RPCs (submit, confirm) and platform accounts.
 * Server routes only; the key never reaches a browser.
 */
export function createActionsServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("actions_database_unavailable");
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
}

/** A salted hash of the visitor's IP, for flood limits. The IP itself is never stored. */
export function hashIp(ip: string) {
  const secret = process.env.ACTIONS_HASH_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "setuvara-actions";
  return createHmac("sha256", secret).update(`ip:${ip}`).digest("hex");
}
