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
  if (!tapTokenPattern.test(token)) return internalShareRedirect("/q/unavailable");

  try {
    const currentPassTokens = await currentVisitorPassTokens();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("resolve_quick_share", {
      p_token: token,
      p_current_pass_tokens: currentPassTokens,
    });
    const resolved = error ? null : parseResolvedEquippedShare(data);
    return resolved
      ? resolvedShareRedirect(resolved, "quick_qr")
      : internalShareRedirect("/q/unavailable");
  } catch {
    return internalShareRedirect("/q/unavailable");
  }
}
