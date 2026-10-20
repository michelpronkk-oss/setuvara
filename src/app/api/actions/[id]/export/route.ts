import { toCsv } from "@/lib/actions/csv";
import { SUBMISSION_STATUS_LABEL, type Submission } from "@/lib/actions/model";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * CSV of an Action's submissions, for its owner on a plan with export. Rows come through the owner's
 * own RLS-limited client, so nobody can export another creator's data.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") return new Response("Sign in", { status: 401 });
  const { data: allowed } = await supabase.rpc("can_export_action", { p_action_id: id });
  if (allowed !== true) return new Response("Export comes with Plus.", { status: 403 });
  const [{ data: action }, { data: rows }] = await Promise.all([
    supabase.from("profile_actions").select("title, kind, config").eq("id", id).maybeSingle(),
    supabase.from("action_submissions").select("name, email, answers, status, verified_at, created_at").eq("action_id", id).order("created_at"),
  ]);
  if (!action) return new Response("Not found", { status: 404 });
  const questions = ((action.config as { questions?: { id: string; label: string }[] }).questions ?? []);
  const builtIn = ["collabType", "budget", "company", "website", "timeline", "preferredDates", "message"].filter((key) => (rows ?? []).some((row) => key in ((row.answers as Record<string, string>) ?? {})));
  const header = ["Submitted", "Status", "Confirmed", "Name", "Email", ...builtIn, ...questions.map((q) => q.label)];
  const body = toCsv(header, (rows ?? []).map((row) => {
    const answers = (row.answers ?? {}) as Record<string, string>;
    return [row.created_at, SUBMISSION_STATUS_LABEL[row.status as Submission["status"]] ?? row.status, row.verified_at ?? "", row.name, row.email ?? "", ...builtIn.map((key) => answers[key] ?? ""), ...questions.map((q) => answers[q.id] ?? "")];
  }));
  const file = `${action.title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "action"}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
