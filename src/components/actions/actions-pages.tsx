import Link from "next/link";
import { notFound } from "next/navigation";

import { coralButton, EmptyState, lineButton, Mono, StudioPage } from "@/components/creator/studio-ui";
import type { ModeSlug } from "@/components/profile/types";
import { ACTION_KIND_NAME, ACTION_KINDS, ACTION_STATUS_LABEL, isConfirmedKind, NEEDS_ATTENTION, starterAction, THANKS_COLUMNS, type ActionInsights, type ActionKind, type ActionThanksRow, type ProfileAction, type PublicAction } from "@/lib/actions/model";
import { creatorActionsEnabled } from "@/lib/actions/server";
import { actionsBase, actionsListHref, loadModeActions, newActionHref, type ModeActions } from "@/lib/actions/studio-server";
import { audienceHref } from "@/lib/audience/studio-server";
import { connectChatEnabled } from "@/lib/chat/launch";
import { loadCreatorStudio } from "@/lib/creator/studio-server";
import { isWorkBlock } from "@/lib/creator/studio";
import { BookingTimes } from "@/components/business/booking-times";
import { AVAILABILITY_COLUMNS, BOOKING_COLUMNS, defaultAvailability, type Booking, type BookingAvailability } from "@/lib/business/bookings";
import { DEFAULT_BUSINESS_LIMITS, type BusinessLimits } from "@/lib/business/model";
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

/** A Booking Action's saved hours, its held and confirmed times, and the plan's booking horizon. */
async function loadTimes(supabase: ModeActions["supabase"], id: string) {
  const [saved, bookings, limits] = await Promise.all([
    supabase.from("booking_availability").select(AVAILABILITY_COLUMNS).eq("action_id", id).maybeSingle(),
    supabase.from("business_bookings").select(BOOKING_COLUMNS).eq("action_id", id).gte("ends_at", new Date().toISOString()).order("starts_at").limit(200),
    supabase.rpc("my_business_limits"),
  ]);
  return {
    saved: (saved.data as BookingAvailability | null) ?? null,
    bookings: (bookings.data ?? []) as Booking[],
    limits: ((limits.data as BusinessLimits | null) ?? DEFAULT_BUSINESS_LIMITS) as BusinessLimits & { booking_horizon_days?: number },
  };
}

/**
 * The page head of every Mode tool: a dark stage with a soft glow, the Mode, a big title, one
 * line, and the main button. Shared by Actions, Leads, Testimonials, Team, Events and Audience.
 */
export type HeadStat = { label: string; value: string; note?: React.ReactNode; hot?: boolean };

export function Head({ eyebrow, title, sub, action, back, tone = "#FF5A4F", stats }: { eyebrow: React.ReactNode; title: string; sub?: React.ReactNode; action?: React.ReactNode; back?: { href: string; label: string }; tone?: string; /** Figures on the stage under the title. */ stats?: HeadStat[] }) {
  return (
    <div className="mb-6 md:mb-8">
      {back && <Link className="mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-full text-[14px] font-semibold text-black/55 transition hover:text-black" href={back.href}><span aria-hidden="true">←</span>{back.label}</Link>}
      <header className="relative isolate overflow-hidden rounded-[28px] bg-[#0D0D0D] px-5 pb-6 pt-5 text-[#F5F4EF] shadow-[0_30px_60px_-40px_#0D0D0D] md:rounded-[32px] md:px-9 md:pb-9 md:pt-8" data-tool-head>
        <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 -z-10 size-[420px] rounded-full opacity-90 blur-2xl" style={{ background: `radial-gradient(circle, ${tone}80, transparent 65%)` }} />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-40 left-1/3 -z-10 size-[360px] rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, #C7FF4A33, transparent 65%)" }} />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:radial-gradient(#F5F4EF_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 font-label text-[11px] uppercase tracking-[0.16em] text-[#F5F4EF]/60">{eyebrow}</div>
            <h1 className="mt-3 text-balance font-display text-[38px] font-bold leading-[0.92] tracking-[-0.05em] md:text-[64px]">{title}</h1>
            {sub && <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.45] text-[#F5F4EF]/70 md:text-[16px]">{sub}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2.5">{action}</div>}
        </div>
        {stats && stats.length > 0 && (
          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[#F5F4EF]/10 pt-6 md:grid-cols-4" data-head-stats>
            {stats.map((stat) => (
              <div className="relative min-w-0" key={stat.label}>
                <dt className="font-label text-[10.5px] uppercase tracking-[0.16em] text-[#F5F4EF]/50">{stat.label}</dt>
                <dd className="mt-1.5 font-display text-[40px] font-bold leading-none tracking-[-0.05em] tabular-nums md:text-[48px]" style={stat.hot ? { color: tone } : undefined}>{stat.value}</dd>
                {stat.note && <dd className="mt-1.5 text-[12.5px] text-[#F5F4EF]/55">{stat.note}</dd>}
              </div>
            ))}
          </dl>
        )}
      </header>
    </div>
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

  const accent = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF", creator: "#E8A6FF" }[slug];

  return (
    <StudioPage className="max-w-[1180px] pb-12">
      <Head
        tone={accent}
        stats={actions.length ? cards.map((card) => ({ label: card.label, value: card.value, hot: card.hot, note: card.label === "Subscribers" ? <Link className="font-semibold text-[#F5F4EF] underline-offset-4 hover:underline" href={audienceHref(slug)}>Open Audience →</Link> : card.note })) : undefined}
        action={actions.length ? <div className="flex flex-wrap gap-2">{slug === "creator" && <Link className={lineButton} href="/app/identity/creator/collabs">Deals</Link>}<Link className={lineButton} href={`/app/identity/goals?mode=${slug}`}>Start from a goal</Link><Link className={coralButton} href={newActionHref(slug)}><span aria-hidden="true">+</span>New Action</Link></div> : undefined}
        eyebrow={<><span aria-hidden="true" className="size-2 rounded-full" style={{ background: accent }} />{MODE_NAME[slug]} Mode</>}
        sub={actions.length ? `${live} live${needs ? ` · ${needs} new` : ""}` : undefined}
        title="Actions"
      />
      {!creatorActionsEnabled() && <ActionsOffNote />}
      {actions.length ? (
        <>
          <section aria-labelledby="sv-actions-list">
            <h2 className="mb-3 px-1 font-display text-[22px] font-bold tracking-[-0.035em]" id="sv-actions-list">On your page</h2>
            <div className="rounded-[24px] bg-white px-4 py-1 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] md:px-5">
              <ActionsList base={base} profileId={data.userId} rows={rows} />
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="relative mb-10 overflow-hidden rounded-[28px] bg-[#0D0D0D] p-6 text-[#F5F4EF] md:p-9">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 size-[360px] rounded-full opacity-[0.12] blur-3xl" style={{ background: accent }} />
            <Mono className="relative" style={{ color: accent }}>Actions</Mono>
            <h2 className="relative mt-3 max-w-[16ch] font-display text-[36px] font-bold leading-[0.98] tracking-[-0.05em] md:text-[48px]">Give visitors something to do.</h2>
            <p className="relative mt-3 max-w-[52ch] text-[15px] leading-[1.55] text-[#F5F4EF]/70">Each Action is a card on your {MODE_NAME[slug]} page with its own form, in your Appearance. Responses land here, never in your chat.</p>
            <Link className="relative mt-6 inline-flex min-h-11 items-center rounded-full px-5 text-[14px] font-semibold shadow-[inset_0_0_0_1.5px_rgba(245,244,239,.3)] transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[#F5F4EF]" href={`/app/identity/goals?mode=${slug}`}>Or start from a goal →</Link>
          </section>
          <h2 className="mb-3 px-1 font-display text-[22px] font-bold tracking-[-0.035em]">Choose what people do</h2>
          <KindPicker hrefFor={(kind) => newActionHref(slug, kind)} limits={limits} slug={slug} />
        </>
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
  const schedulable = action.kind === "booking" && action.config.offering !== "application";
  const tab = query.tab === "insights" ? "insights" : query.tab === "times" && schedulable ? "times" : query.tab === "edit" || (query.tab !== "responses" && !submissions.length) ? "edit" : "responses";
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
  const times = tab === "times" ? await loadTimes(data.supabase, id) : null;
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
        {schedulable && <Link aria-current={tab === "times" ? "page" : undefined} className={tabClass(tab === "times")} href="?tab=times" scroll={false}>Times</Link>}
        <Link aria-current={tab === "insights" ? "page" : undefined} className={tabClass(tab === "insights")} href="?tab=insights" scroll={false}>Insights</Link>
        <Link aria-current={tab === "edit" ? "page" : undefined} className={tabClass(tab === "edit")} href="?tab=edit" scroll={false}>Edit</Link>
      </nav>
      {tab === "times" && times ? (
        <BookingTimes bookings={times.bookings} fresh={!times.saved} horizonCap={times.limits.booking_horizon_days ?? 14} initial={times.saved ?? defaultAvailability(id, "UTC")} live={action.status === "published"} names={Object.fromEntries(submissions.map((item) => [item.id, item.name || item.email || ""]))} path={`${actionsBase(slug)}/${id}`} plan={times.limits.plan} />
      ) : tab === "insights" ? <ActionInsightsView insights={insights} kind={action.kind} /> : tab === "edit" ? (
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
