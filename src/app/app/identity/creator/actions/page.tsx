import type { Metadata } from "next";
import Link from "next/link";

import { ActionsList } from "@/components/actions/actions-list";
import { ActionsOffNote } from "@/components/actions/actions-off-note";
import { KindPicker } from "@/components/actions/kind-picker";
import { coralButton, EmptyState, Mono, StudioHead, StudioPage } from "@/components/creator/studio-ui";
import { NEEDS_ATTENTION } from "@/lib/actions/model";
import { creatorActionsEnabled } from "@/lib/actions/server";
import { loadCreatorStudio } from "@/lib/creator/studio-server";

export const metadata: Metadata = { title: "Actions · Creator · Setuvara" };

const daysAgo = (days: number) => Date.now() - days * 24 * 60 * 60 * 1000;

export default async function CreatorActionsPage() {
  const studio = await loadCreatorStudio("/app/identity/creator/actions");
  if (!studio.mode) return null;
  if (!studio.actionsReady) {
    return <StudioPage><StudioHead title="Actions" /><EmptyState body="Actions need a database update that hasn't reached this site yet." title="Not ready yet." /></StudioPage>;
  }
  const { actions, submissions, limits } = studio;
  const rows = actions.map((action) => {
    const mine = submissions.filter((item) => item.action_id === action.id);
    return {
      ...action,
      responses: mine.filter((item) => (action.kind === "giveaway" ? item.status === "entered" : item.status !== "spam")).length,
      fresh: mine.filter((item) => NEEDS_ATTENTION.includes(item.status)).length,
    };
  });
  const live = actions.filter((item) => item.status === "published").length;
  const giveaways = actions.filter((item) => item.kind === "giveaway" && item.status === "published").length;
  const needs = submissions.filter((item) => NEEDS_ATTENTION.includes(item.status)).length;
  const week = daysAgo(7);
  const thisWeek = submissions.filter((item) => item.status !== "pending_verification" && item.status !== "spam" && new Date(item.created_at).getTime() >= week).length;
  const cards = [
    { label: "Live", value: `${live}`, note: `of ${limits.published_actions} on ${limits.plan === "free" ? "Free" : limits.plan === "plus" ? "Plus" : "Pro"}` },
    { label: "Needs you", value: `${needs}`, note: needs ? "new responses" : "all caught up", hot: needs > 0 },
    { label: "Giveaways open", value: `${giveaways}`, note: limits.open_giveaways ? `of ${limits.open_giveaways}` : "with Plus" },
    { label: "This week", value: `${thisWeek}`, note: "responses and entries" },
  ];

  return (
    <StudioPage>
      <StudioHead action={actions.length ? <Link className={coralButton} href="/app/identity/creator/actions/new">New Action</Link> : undefined} sub={actions.length ? `${live} live${needs ? ` · ${needs} new` : ""}` : undefined} title="Actions" />
      {!creatorActionsEnabled() && <ActionsOffNote />}
      {actions.length ? (
        <>
          <dl className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4">
            {cards.map((card) => (
              <div className="rounded-[22px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)] md:p-5" key={card.label}>
                <dt><Mono className="text-black/55">{card.label}</Mono></dt>
                <dd className={`mt-2 font-display text-[36px] font-bold leading-none tracking-[-0.05em] md:text-[44px] ${card.hot ? "text-[#FF5A4F]" : ""}`}>{card.value}</dd>
                <dd className="mt-1 text-[13px] text-black/60">{card.note}</dd>
              </div>
            ))}
          </dl>
          <ActionsList profileId={studio.userId} rows={rows} />
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-10">
          <div>
            <h2 className="font-display text-[30px] font-bold leading-[1] tracking-[-0.05em] md:text-[36px]">Give visitors something to do.</h2>
            <p className="mt-3 max-w-[40ch] text-[15px] leading-[1.5] text-black/70">Each Action is a card on your Creator page with its own form. Responses land here. None of them opens your chat.</p>
          </div>
          <KindPicker limits={limits} />
        </div>
      )}
    </StudioPage>
  );
}
