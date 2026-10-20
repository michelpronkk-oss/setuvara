import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionEditor } from "@/components/actions/action-editor";
import { ActionInbox, GiveawayEntries } from "@/components/actions/action-inbox";
import { ActionsOffNote } from "@/components/actions/actions-off-note";
import { KindTile } from "@/components/actions/kind-picker";
import { StudioHead, StudioPage } from "@/components/creator/studio-ui";
import { ACTION_KIND_NAME, ACTION_STATUS_LABEL } from "@/lib/actions/model";
import { creatorActionsEnabled } from "@/lib/actions/server";
import { connectChatEnabled } from "@/lib/chat/launch";
import { loadCreatorStudio } from "@/lib/creator/studio-server";

export const metadata: Metadata = { title: "Action · Creator · Setuvara" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ActionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; response?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!uuid.test(id)) notFound();
  const studio = await loadCreatorStudio(`/app/identity/creator/actions/${id}`);
  if (!studio.mode) return null;
  const action = studio.actions.find((item) => item.id === id);
  if (!action) notFound();
  const submissions = studio.submissions.filter((item) => item.action_id === id);
  const tab = query.tab === "edit" || (query.tab !== "responses" && !submissions.length) ? "edit" : "responses";
  const firstName = studio.profile.display_name.split(/\s+/)[0] || studio.profile.display_name;
  const pageHref = studio.shareUrl && action.status === "published" && creatorActionsEnabled() ? `${studio.shareUrl}/a/${action.id}` : null;

  // Connect Chat is offered only for members the creator is already connected with.
  const members = [...new Set(submissions.map((item) => item.submitter_user_id).filter((value): value is string => Boolean(value)))];
  const chatLinks: Record<string, string> = {};
  if (tab === "responses" && members.length && connectChatEnabled()) {
    const { data: connections } = await studio.supabase.from("connections").select("id, user_id, connected_user_id")
      .or(`and(user_id.eq.${studio.userId},connected_user_id.in.(${members.join(",")})),and(connected_user_id.eq.${studio.userId},user_id.in.(${members.join(",")}))`);
    for (const item of submissions) {
      const connection = item.submitter_user_id ? connections?.find((row) => row.user_id === item.submitter_user_id || row.connected_user_id === item.submitter_user_id) : null;
      if (connection) chatLinks[item.id] = `/app/connections/messages?connection=${connection.id}`;
    }
  }

  const tabClass = (on: boolean) => `inline-flex min-h-10 items-center rounded-full px-4 text-[15px] font-semibold ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "hover:bg-black/[0.05]"}`;
  const count = action.kind === "giveaway" ? submissions.filter((item) => item.status === "entered").length : submissions.filter((item) => item.status !== "spam").length;
  return (
    <StudioPage>
      <Link className="mb-3 inline-flex min-h-10 items-center text-[14px] font-semibold text-black/60 hover:text-black" href="/app/identity/creator/actions">← Actions</Link>
      <StudioHead
        action={pageHref ? <a className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[15px] font-semibold hover:text-[#FF5A4F]" href={pageHref} rel="noreferrer" target="_blank">View on page<span aria-hidden="true">↗</span></a> : undefined}
        sub={<span className="inline-flex items-center gap-2"><KindTile kind={action.kind} size={22} />{ACTION_KIND_NAME[action.kind]} · {ACTION_STATUS_LABEL[action.status]}</span>}
        title={action.title}
      />
      {!creatorActionsEnabled() && <ActionsOffNote />}
      <nav aria-label="Action" className="mb-6 flex gap-1">
        <Link aria-current={tab === "responses" ? "page" : undefined} className={tabClass(tab === "responses")} href="?tab=responses" scroll={false}>{action.kind === "giveaway" ? "Entries" : "Responses"}<span className="ml-1.5 font-label text-[11px] opacity-70">{count}</span></Link>
        <Link aria-current={tab === "edit" ? "page" : undefined} className={tabClass(tab === "edit")} href="?tab=edit" scroll={false}>Edit</Link>
      </nav>
      {tab === "edit" ? (
        <ActionEditor
          covers={studio.work.filter((item) => item.kind === "image").map((item) => ({ id: item.id, imageUrl: item.imageUrl, title: item.title }))}
          firstName={firstName}
          initial={action}
          key={action.updated_at}
          kind={action.kind}
          limits={studio.limits}
          locked={action.kind === "giveaway" && submissions.length > 0}
          modeId={studio.mode.id}
          nextSortOrder={action.sort_order}
          profileId={studio.userId}
          starter={{ title: action.title, intro: action.intro, cta_label: action.cta_label, config: action.config, cover_block_id: action.cover_block_id, starts_at: action.starts_at, ends_at: action.ends_at }}
        />
      ) : action.kind === "giveaway"
        ? <GiveawayEntries action={action} canExport={studio.limits.can_export} submissions={submissions} />
        : <ActionInbox action={action} chatLinks={chatLinks} initialId={query.response ?? null} rates={studio.kit.rates} submissions={submissions} />}
    </StudioPage>
  );
}
