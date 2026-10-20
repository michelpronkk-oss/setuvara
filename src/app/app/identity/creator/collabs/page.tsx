import type { Metadata } from "next";

import { CollabsStudio, type InquiryContact } from "@/components/creator/collabs-studio";
import { StudioHead, StudioPage } from "@/components/creator/studio-ui";
import type { ModeSlug } from "@/components/profile/types";
import { connectChatEnabled } from "@/lib/chat/launch";
import { loadCreatorStudio } from "@/lib/creator/studio-server";
import { publicModePath } from "@/lib/share/mode-share";

export const metadata: Metadata = { title: "Collabs · Creator · Setuvara" };

export default async function CreatorCollabsPage({ searchParams }: { searchParams: Promise<{ inquiry?: string }> }) {
  const [studio, query] = await Promise.all([loadCreatorStudio("/app/identity/creator/collabs"), searchParams]);
  if (!studio.mode) return null;
  const { supabase, userId, inquiries } = studio;
  const senders = [...new Set(inquiries.map((item) => item.sender_user_id))];

  // Reply goes to Connect Chat when the two are connected; otherwise to the Mode they wrote from.
  const [{ data: connections }, { data: profiles }] = senders.length ? await Promise.all([
    supabase.from("connections").select("id, user_id, connected_user_id").or(`and(user_id.eq.${userId},connected_user_id.in.(${senders.join(",")})),and(connected_user_id.eq.${userId},user_id.in.(${senders.join(",")}))`),
    supabase.from("profiles").select("id, username").in("id", senders).eq("is_published", true),
  ]) : [{ data: [] }, { data: [] }];
  const chat = connectChatEnabled();
  const contacts: Record<string, InquiryContact> = Object.fromEntries(await Promise.all(inquiries.map(async (item) => {
    const connection = connections?.find((row) => row.user_id === item.sender_user_id || row.connected_user_id === item.sender_user_id);
    const sender = profiles?.find((row) => row.id === item.sender_user_id);
    const path = sender ? await publicModePath(sender.id, sender.username, item.sender_mode_slug as ModeSlug) : null;
    return [item.id, { replyHref: chat && connection ? `/app/connections/messages?connection=${connection.id}` : null, pageHref: path }] as const;
  })));
  const fresh = inquiries.filter((item) => item.status === "new").length;

  return (
    <StudioPage>
      <StudioHead sub={inquiries.length ? `${inquiries.length} ${inquiries.length === 1 ? "inquiry" : "inquiries"}${fresh ? ` · ${fresh} new` : ""}` : undefined} title="Collabs" />
      <CollabsStudio initialId={query.inquiry ?? null} collabsOpen={studio.settings.collabsOpen} contacts={contacts} inquiries={inquiries} rates={studio.kit.rates} />
    </StudioPage>
  );
}
