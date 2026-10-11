import { redirect } from "next/navigation";

import { LiveContextEditor } from "./live-context-editor";
import { getActiveLiveContext, getRecentLiveContexts, type LiveContext } from "@/lib/live-context/model";
import { createClient } from "@/lib/supabase/server";
import { listLiveContexts } from "@/lib/live-context/queries";

export const metadata = { title: "Live Context" };

export default async function LiveContextPage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = !error && typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) redirect("/login?next=/app/context");

  const contexts = await listLiveContexts(supabase, userId, 100);
  const now = new Date();
  const active = getActiveLiveContext(contexts, userId, now);
  const expiredActive = contexts.find((context) => context.is_active && Date.parse(context.expires_at) <= now.getTime()) ?? null;
  const recent = getRecentLiveContexts(contexts, userId, 8);

  return <LiveContextEditor active={active as LiveContext | null} expiredActive={expiredActive} recent={recent} />;
}
