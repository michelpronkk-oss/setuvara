import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { usernamePattern } from "@/lib/usernames";

/** The current username for an old one its owner kept. Published profiles only. */
export const renamedHandle = cache(async (handle: string) => {
  if (!usernamePattern.test(handle)) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("resolve_renamed_handle", { p_handle: handle });
    return !error && typeof data === "string" && usernamePattern.test(data) && data !== handle ? data : null;
  } catch {
    return null;
  }
});

/**
 * Sends an old username on to the owner's current one. Temporary (307), never permanent: the owner
 * can rename again or take the old name back. The target comes from the database, never the request.
 */
export async function redirectIfRenamed(handle: string, source?: string) {
  const current = await renamedHandle(handle);
  if (!current) return;
  const safeSource = source && /^[a-z_]{1,32}$/.test(source) ? `?source=${source}` : "";
  redirect(`/${current}${safeSource}`);
}
