import { createCommerceServiceClient } from "@/lib/commerce/server";
import { syncConnection } from "@/lib/revenue/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily Verified Revenue sync, called by Supabase Cron with a bearer secret kept in Vault.
 * Each due connection is read with its own key and recorded as one snapshot per currency;
 * a lease keeps runs from overlapping and every run is logged in commerce_job_runs.
 */
export async function GET(request: Request) {
  const token = /^Bearer ([A-Za-z0-9]{32,128})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return Response.json({ error: "Not found." }, { status: 404 });
  const service = createCommerceServiceClient();
  const { data: valid } = await service.rpc("revenue_cron_token_valid", { p_token: token });
  if (valid !== true) return Response.json({ error: "Not found." }, { status: 404 });
  const { data: runId } = await service.rpc("commerce_job_begin", { p_job: "revenue_sync", p_lease_seconds: 120 });
  if (!runId) return Response.json({ skipped: "another run is active" }, { status: 409 });
  const report = { connections: 0, ok: 0, failed: 0 };
  const deadline = Date.now() + 45_000;
  const { data: due } = await service.rpc("revenue_due_connections", { p_limit: 40 });
  for (const connection of (due ?? []) as { id: string; provider: string }[]) {
    if (Date.now() > deadline) break;
    report.connections += 1;
    if (await syncConnection(service, connection)) report.ok += 1; else report.failed += 1;
  }
  await service.rpc("commerce_job_finish", { p_run_id: runId, p_ok: report.failed === 0, p_report: report, p_error: null });
  return Response.json(report);
}
