import { toCsv } from "@/lib/actions/csv";
import { filterStages, LEAD_COLUMNS, LEAD_CSV_HEADER, LEAD_EXPORT_MAX, LEAD_READ_BATCH, leadCsvRow, parseLeadExport, type BusinessLimits, type Lead } from "@/lib/business/model";
import type { Workspace } from "@/lib/business/team";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * CSV of Business Mode leads, with the inbox's stage filter and search, for a plan with export.
 * The database answers the plan; rows come through the caller's own RLS-limited client, read in
 * pages until the export cap, so nobody can export another member's leads. `?business=` exports a
 * business the caller manages on a team, on that owner's plan.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return new Response("Sign in", { status: 401 });
  const params = new URL(request.url).searchParams;
  const asked = params.get("business");
  if (asked !== null && !UUID.test(asked)) return new Response("Not found", { status: 404 });
  const business = asked ?? userId;
  // A teammate's export follows the owner's plan and their role; the owner's follows their own plan.
  const workspace = asked && asked !== userId ? ((await supabase.rpc("business_workspace", { p_business_id: asked })).data as Workspace | null) : null;
  const limits = workspace ? workspace.limits : ((await supabase.rpc("my_business_limits")).data as BusinessLimits | null);
  if (limits?.can_export !== true) return new Response("Export comes with Plus.", { status: 403 });

  const { filter, query, days } = parseLeadExport(params);
  const stages = filterStages(filter);
  const since = days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
  const leads: Lead[] = [];
  for (let from = 0; from < LEAD_EXPORT_MAX; from += LEAD_READ_BATCH) {
    let page = supabase.from("business_leads").select(LEAD_COLUMNS).eq("profile_id", business);
    if (stages) page = page.in("stage", stages);
    if (query) page = page.or(`name.ilike.*${query}*,email.ilike.*${query}*`);
    if (since) page = page.gte("last_activity_at", since);
    const { data, error } = await page.order("last_activity_at", { ascending: false }).order("id").range(from, Math.min(from + LEAD_READ_BATCH, LEAD_EXPORT_MAX) - 1);
    if (error) return new Response("Export didn't go through. Try again.", { status: 500 });
    leads.push(...((data ?? []) as Lead[]));
    if ((data ?? []).length < LEAD_READ_BATCH) break;
  }

  const actionIds = [...new Set(leads.map((lead) => lead.source_action_id).filter((id): id is string => Boolean(id)))];
  // A teammate has no row access to the owner's Actions; the workspace carries their titles.
  const { data: actions } = workspace ? { data: workspace.actions } : actionIds.length ? await supabase.from("profile_actions").select("id, title").in("id", actionIds) : { data: [] };
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
