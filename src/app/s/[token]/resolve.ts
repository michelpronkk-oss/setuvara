import { cache } from "react";

import { modeShareTokenPattern, parseResolvedModeShare } from "@/lib/share/mode-share";
import { createClient } from "@/lib/supabase/server";

// The opaque token resolves server-side to one published profile and one
// enabled Mode. It is a pointer only: Connection Access is still decided by
// the profile page for that exact profile and Mode.
export const resolveModeShare = cache(async (token: string) => {
  if (!modeShareTokenPattern.test(token)) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("resolve_mode_share", { p_token: token });
    const resolved = error ? null : parseResolvedModeShare(data);
    return resolved ? { username: resolved.username, slug: resolved.mode, shareToken: token } : null;
  } catch {
    return null;
  }
});
