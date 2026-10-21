import Link from "next/link";
import { notFound } from "next/navigation";

import { coralButton, EmptyState, Mono, StudioPage } from "@/components/creator/studio-ui";
import type { ModeSlug } from "@/components/profile/types";
import { ACTION_KIND_NAME, ACTION_KINDS, ACTION_STATUS_LABEL, isConfirmedKind, NEEDS_ATTENTION, starterAction, THANKS_COLUMNS, type ActionInsights, type ActionKind, type ActionThanksRow, type ProfileAction, type PublicAction } from "@/lib/actions/model";
import { creatorActionsEnabled } from "@/lib/actions/server";
import { actionsBase, actionsListHref, loadModeActions, newActionHref, type ModeActions } from "@/lib/actions/studio-server";
import { audienceHref } from "@/lib/audience/studio-server";
import { connectChatEnabled } from "@/lib/chat/launch";
import { loadCreatorStudio } from "@/lib/creator/studio-server";
import { isWorkBlock } from "@/lib/creator/studio";
import { ActionEditor } from "./action-editor";
import { ActionInbox, GiveawayEntries } from "./action-inbox";
import { ActionInsightsView } from "./action-insights";
import type { PreviewSource } from "./action-phone";
import { ActionsList } from "./actions-list";
import { ActionsOffNote } from "./actions-off-note";
import { KindPicker, KindTile } from "./kind-picker";

const MODE_NAME: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" };
const daysAgo = (days: number) => Date.now() - days * 24 * 60 * 60 * 1000;
const counts = (action: Pick<ProfileAction, "kind">, status: string) => (action.kind === "giveaway" ? status === "entered" : action.kind === "newsletter" ? status === "subscribed" : status !== "spam" && status !== "pending_verification");
const firstNameOf = (name: string) => name.split(/\s+/)[0] || name;

/** The page head: kind or Mode, the title, a quiet line under it, and the main button. */
export function Head({ eyebrow, title, sub, action, back }: { eyebrow: React.ReactNode; title: string; sub?: React.ReactNode; action?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6 md:mb-8">
      {back && <Link className="mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-full text-[14px] font-semibold text-black/55 transition hover:text-black" href={back.href}><span aria-hidden="true">←</span>{back.label}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 text-[14px] font-semibold text-black/55">{eyebrow}</div>
          <h1 className="mt-2 text-balance font-display text-[40px] font-bold leading-[0.95] tracking-[-0.05em] md:text-[56px]">{title}</h1>
          {sub && <p className="mt-3 text-[15px] text-black/60 md:text-base">{sub}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

async function previewFor(data: ModeActions): Promise<PreviewSource> {
  const covers = new Map(data.covers.map((cover) => [cover.id, cover.imageUrl]));
  const others = data.actions.filter((item) => item.status === "published").map((item) => ({ action: item as PublicAction, coverUrl: item.cover_block_id ? covers.get(item.cover_block_id) ?? null : null, sort: item.sort_order }));
  const base = { profile: data.profile, plan: data.plan, memberTier: data.memberTier, others };
  if (data.mode.slug !== "creator") return { ...base, mode: data.mode };
  // Creator pages lead with the work: image and video blocks render as Featured and Work.
  const studio = await loadCreatorStudio("/app/identity/creator/actions");
  if (!studio.mode) return { ...base, mode: data.mode };
  return { ...base, mode: { ...data.mode, blocks: data.mode.blocks?.filter((block) => !isWorkBlock(block)) }, creator: { settings: studio.settings, work: studio.work, offers: studio.offers } };
}

/** A Mode's Actions: what's live, what needs you, and the list in page order. */
export async function ActionsIndex({ slug }: { slug: ModeSlug }) {
  const data = await loadModeActions(slug, actionsListHref(slug));
  if (!data.mode) notFound();
  const base = actionsBase(slug);
  if (!data.actionsReady) {
    return <StudioPage><Head eyebrow={`${MODE_NAME[slug]} Mode`} title="Actions" /><EmptyState body="Actions need a database update that hasn't reached this site yet." title="Not ready yet." /></StudioPage>;
  }
  const { actions, submissions, limits } = data;
  const rows = actions.map((action) => {
    const mine = submissions.filter((item) => item.action_id === action.id);
    return { ...action, responses: mine.filter((item) => counts(action, item.status)).length, fresh: mine.filter((item) => NEEDS_ATTENTION.includes(item.status)).length };
  });
  const live = actions.filter((item) => item.status === "published").length;
  const subscribers = submissions.filter((item) => item.status === "subscribed").length;
  const needs = submissions.filter((item) => NEEDS_ATTENTION.includes(item.status)).length;
  const week = daysAgo(7);
  const thisWeek = submissions.filter((item) => item.status !== "pending_verification" && item.status !== "spam" && new Date(item.created_at).getTime() >= week).length;
  const cards = [
    { label: "Live", value: `${live}`, note: `of ${limits.published_actions} across your Modes on ${limits.plan === "free" ? "Free" : limits.plan === "plus" ? "Plus" : "Pro"}` },
    { label: "Needs you", value: `${needs}`, note: needs ? "new responses" : "all caught up", hot: needs > 0 },
    { label: "Subscribers", value: `${subscribers}`, note: "confirmed by email" },
    { label: "This week", value: `${thisWeek}`, note: "responses, entries and signups" },
  ];

  return (
    <StudioPage>
      <Head
        action={actions.length ? <Link className={coralButton} href={newActionHref(slug)}><span aria-hidden="true">+</span>New Action</Link> : undefined}
        eyebrow={<><span aria-hidden="true" className="size-2 rounded-full" style={{ background: { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF", creator: "#E8A6FF" }[slug] }} />{MODE_NAME[slug]} Mode</>}
        sub={actions.length ? `${live} live${needs ? ` · ${needs} new` : ""}` : "Forms, newsletters, giveaways and questions on your page."}
        title="Actions"
      />
      {!creatorActionsEnabled() && <ActionsOffNote />}
      {actions.length ? (
        <>
          <dl className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {cards.map((card) => {
              const audience = card.label === "Subscribers";
              return (
                <div className="relative rounded-[24px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)] transition has-[a:hover]:shadow-[inset_0_0_0_1.5px_#0D0D0D] md:p-5" key={card.label}>
                  <dt><Mono className="text-black/55">{card.label}</Mono></dt>
                  <dd className={`mt-2 font-display text-[36px] font-bold leading-none tracking-[-0.05em] md:text-[44px] ${card.hot ? "text-[#FF5A4F]" : ""}`}>{card.value}</dd>
                  <dd className="mt-1 text-[13px] text-black/60">{audience ? <Link className="font-semibold text-[#0D0D0D] after:absolute after:inset-0 after:rounded-[24px]" href={audienceHref(slug)}>Open Audience →</Link> : card.note}</dd>
                </div>
              );
            })}
          </dl>
          <ActionsList base={base} profileId={data.userId} rows={rows} />
        </>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-12">
          <div>
            <h2 className="font-display text-[30px] font-bold leading-[1] tracking-[-0.05em] md:text-[38px]">Give visitors something to do.</h2>
            <p className="mt-3 max-w-[40ch] text-[15px] leading-[1.5] text-black/70">Each Action is a card on your {MODE_NAME[slug]} page with its own form, in your Appearance. Responses land here. None of them opens your chat.</p>
          </div>
          <KindPicker hrefFor={(kind) => newActionHref(slug, kind)} limits={limits} slug={slug} />
        </div>
      )}
    </StudioPage>
  );
}

/** Pick a kind, then edit its starter beside the phone. */
export async function NewAction({ slug, kind: rawKind }: { slug: ModeSlug; kind?: string }) {
  const data = await loadModeActions(slug, newActionHref(slug));
  if (!data.mode) notFound();
  const kind = (ACTION_KINDS as readonly string[]).includes(rawKind ?? "") ? rawKind as ActionKind : null;
  const firstName = firstNameOf(data.profile.display_name);
  const eyebrow = <><span aria-hidden="true" className="size-2 rounded-full bg-black/30" />{MODE_NAME[slug]} Mode · New Action</>;
  if (!kind) {
    return <StudioPage><Head back={{ href: actionsListHref(slug), label: "Actions" }} eyebrow={eyebrow} title="What should people do?" /><KindPicker hrefFor={(item) => newActionHref(slug, item)} limits={data.limits} slug={slug} /></StudioPage>;
  }
  const starter = starterAction(kind, firstName, slug);
  return (
    <StudioPage>
      <Head back={{ href: newActionHref(slug), label: "All kinds" }} eyebrow={<><KindTile kind={kind} size={22} />{ACTION_KIND_NAME[kind]} · Draft</>} title={`New ${ACTION_KIND_NAME[kind].toLowerCase()}`} />
      <ActionEditor
        base={actionsBase(slug)}
        coverHint={slug === "creator" ? "From your Work" : "From this Mode's pictures"}
        covers={data.covers}
        firstName={firstName}
        initial={null}
        kind={kind}
        limits={data.limits}
        listHref={actionsListHref(slug)}
        locked={false}
        modeId={data.mode.id}
        nextSortOrder={Math.min(1000, Math.max(-1, ...data.actions.map((item) => item.sort_order)) + 1)}
        preview={await previewFor(data)}
        profileId={data.userId}
        starter={{ title: starter.title, intro: starter.intro, cta_label: starter.cta_label, config: starter.config, cover_block_id: null, starts_at: null, ends_at: kind === "giveaway" ? new Date(daysAgo(-14)).toISOString() : null }}
      />
    </StudioPage>
  );
}

/** One Action: its responses (or entries, or subscribers) and its editor. */
export async function ActionDetail({ slug, id, query }: { slug: ModeSlug; id: string; query: { tab?: string; response?: string; days?: string } }) {
  const data = await loadModeActions(slug, `${actionsBase(slug)}/${id}`);
  if (!data.mode) notFound();
  const action = data.actions.find((item) => item.id === id);
  if (!action) notFound();
  const submissions = data.submissions.filter((item) => item.action_id === id);
  const tab = query.tab === "insights" ? "insights" : query.tab === "edit" || (query.tab !== "responses" && !submissions.length) ? "edit" : "responses";
  const firstName = firstNameOf(data.profile.display_name);
  const pageHref = data.pageUrl && action.status === "published" && creatorActionsEnabled() ? `${data.pageUrl}/a/${action.id}` : null;

  // Connect Chat is offered only for members the owner is already connected with.
  const members = [...new Set(submissions.map((item) => item.submitter_user_id).filter((value): value is string => Boolean(value)))];
  const chatLinks: Record<string, string> = {};
  if (tab === "responses" && members.length && connectChatEnabled()) {
    const { data: connections } = await data.supabase.from("connections").select("id, user_id, connected_user_id")
      .or(`and(user_id.eq.${data.userId},connected_user_id.in.(${members.join(",")})),and(connected_user_id.eq.${data.userId},user_id.in.(${members.join(",")}))`);
    for (const item of submissions) {
      const connection = item.submitter_user_id ? connections?.find((row) => row.user_id === item.submitter_user_id || row.connected_user_id === item.submitter_user_id) : null;
      if (connection) chatLinks[item.id] = `/app/connections/messages?connection=${connection.id}`;
    }
  }
  const thanksRow = tab === "edit"
    ? (await data.supabase.from("action_thanks").select(THANKS_COLUMNS).eq("action_id", id).maybeSingle()).data as ActionThanksRow | null
    : null;
  const insights = tab === "insights"
    ? (await data.supabase.rpc("my_action_insights", { p_days: Number(query.days) || 30, p_action_id: id })).data as ActionInsights | null
    : null;
  const creatorStudio = slug === "creator" ? await loadCreatorStudio(`${actionsBase(slug)}/${id}`) : null;
  const rates = creatorStudio?.mode ? creatorStudio.kit.rates : [];

  const count = submissions.filter((item) => counts(action, item.status)).length;
  const tabLabel = action.kind === "giveaway" ? "Entries" : action.kind === "newsletter" ? "Subscribers" : "Responses";
  const tabClass = (on: boolean) => `inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "text-black/60 hover:text-black"}`;
  const statusTone = action.status === "published" ? "bg-[#C7FF4A]" : action.status === "draft" ? "bg-[#FFE7B8]" : "bg-black/[0.06]";
  return (
    <StudioPage>
      <Head
        action={pageHref ? <a className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[15px] font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] transition hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]" href={pageHref} rel="noreferrer" target="_blank">View on page<span aria-hidden="true">↗</span></a> : undefined}
        back={{ href: actionsListHref(slug), label: "Actions" }}
        eyebrow={<><KindTile kind={action.kind} size={22} />{ACTION_KIND_NAME[action.kind]}<span className={`rounded-full px-2 py-0.5 font-label text-[10px] uppercase tracking-[0.12em] text-[#0D0D0D] ${statusTone}`}>{ACTION_STATUS_LABEL[action.status]}</span></>}
        title={action.title}
      />
      {!creatorActionsEnabled() && <ActionsOffNote />}
      <nav aria-label="Action" className="mb-7 inline-flex gap-1 rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]">
        <Link aria-current={tab === "responses" ? "page" : undefined} className={tabClass(tab === "responses")} href="?tab=responses" scroll={false}>{tabLabel}<span className="font-label text-[11px] opacity-70">{count}</span></Link>
        <Link aria-current={tab === "insights" ? "page" : undefined} className={tabClass(tab === "insights")} href="?tab=insights" scroll={false}>Insights</Link>
        <Link aria-current={tab === "edit" ? "page" : undefined} className={tabClass(tab === "edit")} href="?tab=edit" scroll={false}>Edit</Link>
      </nav>
      {tab === "insights" ? <ActionInsightsView insights={insights} kind={action.kind} /> : tab === "edit" ? (
        <ActionEditor
          base={actionsBase(slug)}
          coverHint={slug === "creator" ? "From your Work" : "From this Mode's pictures"}
          covers={data.covers}
          firstName={firstName}
          initial={action}
          key={action.updated_at}
          kind={action.kind}
          limits={data.limits}
          listHref={actionsListHref(slug)}
          locked={action.kind === "giveaway" && submissions.length > 0}
          modeId={data.mode.id}
          nextSortOrder={action.sort_order}
          preview={await previewFor(data)}
          profileId={data.userId}
          starter={{ title: action.title, intro: action.intro, cta_label: action.cta_label, config: action.config, cover_block_id: action.cover_block_id, starts_at: action.starts_at, ends_at: action.ends_at }}
          thanks={thanksRow}
        />
      ) : isConfirmedKind(action.kind)
        ? <GiveawayEntries action={action} canExport={data.limits.can_export} submissions={submissions} />
        : <ActionInbox action={action} chatLinks={chatLinks} initialId={query.response ?? null} rates={rates} submissions={submissions} />}
    </StudioPage>
  );
}
