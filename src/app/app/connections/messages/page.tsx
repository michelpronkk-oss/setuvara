import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { connectChatEnabled } from "@/lib/chat/launch";
import type { ChatTarget } from "@/lib/chat/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function MessagesPage({ searchParams }: {
  searchParams: Promise<{ conversation?: string; connection?: string }>;
}) {
  if (!connectChatEnabled()) notFound();
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const viewerId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !viewerId) redirect("/login?next=/app/connections/messages");
  const params = await searchParams;
  const selectedId = params.conversation && uuid.test(params.conversation) ? params.conversation : null;
  let target: ChatTarget | null = null;

  if (params.connection) {
    if (!uuid.test(params.connection)) notFound();
    const { data: connection } = await supabase.from("connections")
      .select("id,user_id,connected_user_id,user_display_name_snapshot,connected_display_name_snapshot")
      .eq("id", params.connection).maybeSingle();
    if (!connection || !connection.connected_user_id
      || (connection.user_id !== viewerId && connection.connected_user_id !== viewerId)) notFound();
    const targetId = connection.user_id === viewerId ? connection.connected_user_id : connection.user_id;
    const name = connection.user_id === viewerId
      ? connection.connected_display_name_snapshot : connection.user_display_name_snapshot;
    const low = viewerId < targetId ? viewerId : targetId;
    const high = viewerId < targetId ? targetId : viewerId;
    const { data: existing } = await supabase.from("chat_conversations")
      .select("id").eq("user_low_id", low).eq("user_high_id", high).maybeSingle();
    if (existing) redirect(`/app/connections/messages?conversation=${existing.id}`);
    target = { id: targetId, name, connectionId: connection.id };
  }

  return <ChatWorkspace initialConversationId={selectedId} key={selectedId ?? target?.connectionId ?? "inbox"} target={target} viewerId={viewerId} />;
}
