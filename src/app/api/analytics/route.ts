import { analyticsCapabilities } from "@/lib/analytics/capabilities";
import { resolveAnalyticsQuery } from "@/lib/analytics/range";
import { getProfileAnalyticsReport, getProfileIdForUser } from "@/lib/analytics/server";
import { getConfirmedBillingUser } from "@/lib/billing/auth";
import { getUserBillingState } from "@/lib/billing/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getConfirmedBillingUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });

  try {
    const billing = await getUserBillingState(user.id);
    const capabilities = analyticsCapabilities(billing.plan);
    const resolved = resolveAnalyticsQuery(new URL(request.url).searchParams, capabilities);
    if (!resolved.ok) {
      const status = resolved.reason === "upgrade" ? 403 : 400;
      return Response.json({ error: resolved.reason === "upgrade" ? "analytics_plan_required" : "invalid_analytics_query" }, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    const profileId = await getProfileIdForUser(user.id);
    if (!profileId) return Response.json({ error: "analytics_unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    const report = await getProfileAnalyticsReport({ profileId, plan: billing.plan, query: resolved.data });
    return Response.json({
      ...report,
      capabilities: {
        historyDays: capabilities.maxHistoryDays,
        availableRanges: capabilities.availableRanges,
        sourceBreakdown: capabilities.sourceBreakdown,
        modeBreakdown: capabilities.modeBreakdown,
        deviceInsights: capabilities.deviceInsights,
        conversion: capabilities.conversion,
        funnels: capabilities.funnels,
        customRange: capabilities.customRange,
        exports: capabilities.exports,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "analytics_unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
