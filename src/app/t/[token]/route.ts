import { createClient } from "@/lib/supabase/server";
import {
  currentVisitorPassTokens,
  internalShareRedirect,
  parseResolvedEquippedShare,
  resolvedShareRedirect,
} from "@/lib/tap/resolution";
import { tapTokenPattern } from "@/lib/tap/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tapTokenPattern.test(token)) return internalShareRedirect("/t/unavailable");

  try {
    const currentPassTokens = await currentVisitorPassTokens();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("resolve_tap", {
      p_token: token,
      p_current_pass_tokens: currentPassTokens,
    });
    const resolved = error ? null : parseResolvedEquippedShare(data);
    return resolved
      ? await resolvedShareRedirect(resolved, "tap")
      : internalShareRedirect("/t/unavailable");
  } catch {
    return internalShareRedirect("/t/unavailable");
  }
}
