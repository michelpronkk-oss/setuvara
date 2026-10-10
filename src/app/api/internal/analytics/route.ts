import { isSetuvaraInternalAnalyticsAdmin } from "@/lib/analytics/internal-auth";
import { getInternalAnalyticsAggregate } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}
function count(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
function field(row: Row, ...keys: string[]) {
  for (const key of keys) if (row[key] !== undefined) return row[key];
  return undefined;
}
function breakdown(value: unknown, labelKey: "source" | "mode") {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = record(item);
    const label = field(row, labelKey, `${labelKey}_slug`, "name");
    const total = count(field(row, "count", "total"));
    return typeof label === "string" && label.length <= 40 ? [{ [labelKey]: label, count: total }] : [];
  }).slice(0, 40);
}

export async function GET() {
  const noStore = { "Cache-Control": "private, no-store" };
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.id || !user.email_confirmed_at) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
    if (!isSetuvaraInternalAnalyticsAdmin(user.id)) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });

    const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const start = new Date(end.getTime() - 29 * 86_400_000);
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);
    const payload = await getInternalAnalyticsAggregate(from, to);
    const totals = record(payload.summary ?? payload.totals);
    const daily = Array.isArray(payload.daily) ? payload.daily.flatMap((item) => {
      const row = record(item);
      const date = field(row, "date", "day");
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
      return [{
        date,
        guestConnections: count(field(row, "guestConnections", "guest_connections")),
        claims: count(field(row, "claims", "guestClaims", "guest_claims")),
        identityCompleted: count(field(row, "identityCompleted", "identity_completed")),
        firstShares: count(field(row, "firstShares", "first_shares")),
        repeatShares: count(field(row, "repeatShares", "repeat_shares")),
      }];
    }).slice(0, 90) : [];

    return Response.json({
      range: { start: from, end: to },
      totals: {
        guestConnections: count(field(totals, "guestConnections", "guest_connections")),
        guestClaims: count(field(totals, "guestClaims", "guest_claims", "claims")),
        identitiesCreated: count(field(totals, "identitiesCreated", "identities_created")),
        identityCompleted: count(field(totals, "identityCompleted", "identity_completed")),
        firstShares: count(field(totals, "firstShares", "first_shares")),
        repeatShares: count(field(totals, "repeatShares", "repeat_shares")),
        newConnectionsAfterFirstShare: count(field(totals, "newConnectionsAfterFirstShare", "new_connections_after_first_share")),
      },
      sourceBreakdown: breakdown(field(payload, "sourceBreakdown", "source_breakdown", "sources"), "source"),
      modeBreakdown: breakdown(field(payload, "modeBreakdown", "mode_breakdown", "modes"), "mode"),
      daily,
    }, { headers: noStore });
  } catch {
    return Response.json({ error: "analytics_unavailable" }, { status: 503, headers: noStore });
  }
}
