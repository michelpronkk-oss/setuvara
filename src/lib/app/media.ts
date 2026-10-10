import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Hosted Storage supports transforms; the local stack can run without imgproxy. */
export async function signHomeImage(supabase: SupabaseClient, path: string | null | undefined, thumbnail = false) {
  if (!path) return null;
  const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1").hostname;
  const local = hostname === "127.0.0.1" || hostname === "localhost";
  const bucket = supabase.storage.from("profile-media");
  const transform = thumbnail ? { width: 96, height: 96, resize: "cover" as const } : { width: 1600, quality: 72 };
  const { data, error } = await bucket.createSignedUrl(path, 3600, local ? undefined : { transform });
  if (!error) return data?.signedUrl ?? null;
  if (local) return null;
  const fallback = await bucket.createSignedUrl(path, 3600);
  return fallback.data?.signedUrl ?? null;
}
