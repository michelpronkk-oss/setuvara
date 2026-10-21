import { toCsv } from "@/lib/actions/csv";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODE_NAME: Record<string, string> = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" };

/**
 * Everyone confirmed on the owner's lists, one row per address, for a plan with export. Rows come
 * through the owner's own RLS-limited client.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") return new Response("Sign in", { status: 401 });
  const { data: limits } = await supabase.rpc("my_action_limits");
  if ((limits as { can_export?: boolean } | null)?.can_export !== true) return new Response("Export comes with Plus.", { status: 403 });
  const { data: lists } = await supabase.from("profile_actions").select("id, title, profile_modes(slug)").eq("kind", "newsletter");
  const listName = new Map((lists ?? []).map((item) => [item.id as string, { title: item.title as string, mode: (item.profile_modes as unknown as { slug: string } | null)?.slug ?? "" }]));
  const { data: rows } = await supabase.from("action_submissions").select("action_id, name, email, verified_at").eq("kind", "newsletter").eq("status", "subscribed").order("verified_at").limit(50000);
  const people = new Map<string, { name: string; email: string; lists: Set<string>; modes: Set<string>; since: string }>();
  for (const row of rows ?? []) {
    if (!row.email) continue;
    const key = row.email.toLowerCase();
    const entry = people.get(key) ?? { name: row.name, email: row.email, lists: new Set<string>(), modes: new Set<string>(), since: row.verified_at ?? "" };
    const list = listName.get(row.action_id);
    if (list) { entry.lists.add(list.title); entry.modes.add(MODE_NAME[list.mode] ?? list.mode); }
    if (!entry.name && row.name) entry.name = row.name;
    people.set(key, entry);
  }
  const body = toCsv(["Email", "Name", "Lists", "Modes", "Subscribed since"], [...people.values()].map((item) => [item.email, item.name, [...item.lists].join("; "), [...item.modes].join("; "), item.since]));
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audience-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
