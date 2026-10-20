import { notFound, redirect } from "next/navigation";

import { creatorActionsEnabled } from "@/lib/actions/server";
import { createClient } from "@/lib/supabase/server";
import { resolveModeShare } from "../resolve";

type Props = { params: Promise<{ token: string }> };

/** Old Work with me links open the creator's live Collaboration Action, or their page. */
export default async function CollabPage({ params }: Props) {
  const { token } = await params;
  const target = await resolveModeShare(token);
  if (!target || target.slug !== "creator") notFound();
  if (!creatorActionsEnabled()) redirect(`/s/${token}`);
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_profile_actions", { p_username: target.username, p_mode: "creator" });
  const collab = (Array.isArray(data) ? data : []).find((item: { kind?: string }) => item.kind === "collab") as { id: string } | undefined;
  redirect(collab ? `/s/${token}/a/${collab.id}` : `/s/${token}`);
}
