import { toCsv } from "@/lib/actions/csv";
import { filterStages, LEAD_COLUMNS, LEAD_CSV_HEADER, LEAD_EXPORT_MAX, LEAD_READ_BATCH, leadCsvRow, parseLeadExport, type BusinessLimits, type Lead } from "@/lib/business/model";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CSV of Business Mode leads, with the inbox's stage filter and search, for a plan with export.
 * The database answers the plan; rows come through the owner's own RLS-limited client, read in
 * pages until the export cap, so nobody can export another member's leads.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") return new Response("Sign in", { status: 401 });
  const { data: limits } = await supabase.rpc("my_business_limits");
  if ((limits as BusinessLimits | null)?.can_export !== true) return new Response("Export comes with Plus.", { status: 403 });

  const { filter, query, days } = parseLeadExport(new URL(request.url).searchParams);
  const stages = filterStages(filter);
  const since = days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
  const leads: Lead[] = [];
  for (let from = 0; from < LEAD_EXPORT_MAX; from += LEAD_READ_BATCH) {
    let page = supabase.from("business_leads").select(LEAD_COLUMNS);
    if (stages) page = page.in("stage", stages);
    if (query) page = page.or(`name.ilike.*${query}*,email.ilike.*${query}*`);
    if (since) page = page.gte("last_activity_at", since);
    const { data, error } = await page.order("last_activity_at", { ascending: false }).order("id").range(from, Math.min(from + LEAD_READ_BATCH, LEAD_EXPORT_MAX) - 1);
    if (error) return new Response("Export didn't go through. Try again.", { status: 500 });
    leads.push(...((data ?? []) as Lead[]));
    if ((data ?? []).length < LEAD_READ_BATCH) break;
  }

  const actionIds = [...new Set(leads.map((lead) => lead.source_action_id).filter((id): id is string => Boolean(id)))];
  const { data: actions } = actionIds.length ? await supabase.from("profile_actions").select("id, title").in("id", actionIds) : { data: [] };
  const titles = new Map((actions ?? []).map((row) => [row.id as string, row.title as string]));
  const body = toCsv(LEAD_CSV_HEADER, leads.map((lead) => leadCsvRow(lead, (id) => (id ? titles.get(id) ?? "" : ""))));
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${filter}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
