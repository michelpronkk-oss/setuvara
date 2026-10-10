import { analyticsCapabilities } from "@/lib/analytics/capabilities";
import { resolveAnalyticsQuery } from "@/lib/analytics/range";
import { getProfileAnalyticsReport, getProfileIdForUser } from "@/lib/analytics/server";
import { getConfirmedBillingUser } from "@/lib/billing/auth";
import { getUserBillingState } from "@/lib/billing/service";

export const dynamic = "force-dynamic";

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const user = await getConfirmedBillingUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  try {
    const billing = await getUserBillingState(user.id);
    const capabilities = analyticsCapabilities(billing.plan);
    if (!capabilities.exports) return Response.json({ error: "analytics_plan_required" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    const resolved = resolveAnalyticsQuery(new URL(request.url).searchParams, capabilities);
    if (!resolved.ok) return Response.json({ error: resolved.reason === "upgrade" ? "analytics_plan_required" : "invalid_analytics_query" }, { status: resolved.reason === "upgrade" ? 403 : 400, headers: { "Cache-Control": "private, no-store" } });
    const profileId = await getProfileIdForUser(user.id);
    if (!profileId) return Response.json({ error: "analytics_unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    const report = await getProfileAnalyticsReport({ profileId, plan: billing.plan, query: resolved.data });
    const lines = [
      ["date", "profile_views", "qr_scans", "quick_qr_scans", "tap_scans", "connections"],
      ...report.daily.map((row) => [row.date, row.profileViews, row.qrScans, row.quickQrScans, row.tapScans, row.connections]),
    ];
    const csv = `\uFEFF${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
    return new Response(csv, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="setuvara-analytics-${resolved.data.startDate}-${resolved.data.endDate}.csv"`,
      },
    });
  } catch {
    return Response.json({ error: "analytics_unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
