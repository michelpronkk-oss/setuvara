import { after } from "next/server";

import { classifyAnalyticsDevice, getAnalyticsProfileId, recordProductAnalyticsEvent } from "@/lib/analytics/events";
import { createClient } from "@/lib/supabase/server";
import {
  currentVisitorPassTokens,
  internalShareRedirect,
  parseResolvedEquippedShare,
  resolvedShareRedirect,
} from "@/lib/tap/resolution";
import { tapTokenPattern } from "@/lib/tap/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
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
    if (resolved) {
      const userAgent = request.headers.get("user-agent");
      const purpose = `${request.headers.get("purpose") ?? ""} ${request.headers.get("sec-purpose") ?? ""}`.toLowerCase();
      const isAutomatedPreview = /bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp/i.test(userAgent ?? "")
        || request.headers.has("next-router-prefetch") || /prefetch|prerender/.test(purpose);
      if (!isAutomatedPreview) {
        const deviceClass = classifyAnalyticsDevice(userAgent);
        after(async () => {
          const profileId = await getAnalyticsProfileId(resolved.username);
          if (profileId) await recordProductAnalyticsEvent({
            eventName: "quick_qr_scanned",
            ownerProfileId: profileId,
            mode: resolved.mode,
            source: "quick_qr",
            deviceClass,
          });
        });
      }
    }
    return resolved
      ? resolvedShareRedirect(resolved, "quick_qr")
      : internalShareRedirect("/q/unavailable");
  } catch {
    return internalShareRedirect("/q/unavailable");
  }
}
