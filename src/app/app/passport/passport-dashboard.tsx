"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { MemberBadge } from "@/components/app/status-badge";
import { MilestoneLine } from "@/components/passport/milestone-line";
import { PassportCover } from "@/components/passport/passport-cover";
import { PassportAheadStamp, PassportRecordStamp, PassportStamp } from "@/components/passport/passport-stamp";
import { hasCapability } from "@/lib/billing/capabilities";
import type { PlanCode } from "@/lib/billing/catalog";
import { useI18n } from "@/lib/i18n/provider";
import { MILESTONES, PASSPORT_REWARDS, type RewardCategory } from "@/lib/passport/rewards";
import {
  COVERS, alsoUnlocked, collectionItems, coverFor, coverSerial, dayMark, earnedLong, filterCounts, isNewStamp,
  journeyMonths, milestoneName, monthMark, nextMilestone, ordinalOf, pageDate, placeContext, rewardKind,
  stampLabel, stampMeta, stampThreshold, summarySentence, unlocksSentence, unlocksShort, wearableRewards,
  type CollectionItem, type CoverId, type MilestoneRecord, type PassportStampRecord, type StampFilter,
} from "@/lib/passport/view";
import { createClient } from "@/lib/supabase/client";
import { passportDisplay } from "./fonts";
import { PassportSheet, PlusSheet, trapTab } from "./passport-sheets";

export type { PassportStampRecord } from "@/lib/passport/view";

type PassportPresentation = {
  coverId: CoverId;
  memberFinishEnabled: boolean | null;
  featuredStampId: string | null;
  featuredStamp: PassportStampRecord | null;
};
export type PassportData = {
  connectionCount: number;
  cities: number;
  events: number;
  countries: number;
  stampTotal: number;
  hasMoreStamps: boolean;
  milestones: MilestoneRecord[];
  rewards: { id: string; unlockedAt: string }[];
  stamps: PassportStampRecord[];
  preferences: Partial<Record<RewardCategory, string>>;
  presentation: PassportPresentation;
};

type View = "home" | "stamps" | "journey" | "finish" | "flair";
type Sheet = { kind: "stamp"; stamp: PassportStampRecord } | { kind: "ahead"; threshold: number; state: "progress" | "locked" } | { kind: "plus" } | null;

const FILTERS: { id: StampFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "milestone", label: "Milestones" },
  { id: "city", label: "Cities" },
  { id: "event", label: "Events" },
  { id: "country", label: "Countries" },
];

const display = "font-display font-extrabold";
const mono = "font-label";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D]";
const pillOutline = `inline-flex items-center justify-center rounded-full border-[1.5px] border-[#0D0D0D] font-semibold transition-colors hover:bg-[#0D0D0D0A] ${focus}`;
const pillInk = `inline-flex items-center justify-center rounded-full bg-[#0D0D0D] font-semibold text-[#F5F4EF] transition-colors hover:bg-[#0D0D0D]/85 ${focus}`;

export function PassportDashboard({ initialData, username, displayName, plan, since }: {
  initialData: PassportData;
  username: string;
  displayName: string;
  plan: PlanCode;
  since: string | null;
}) {
  const { language } = useI18n();
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>("home");
  const [filter, setFilter] = useState<StampFilter>("all");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [press] = useState(() => initialData.milestones.filter((item) => !item.seenAt).at(-1) ?? null);
  const [pressOpen, setPressOpen] = useState(Boolean(press));

  const memberPlan = hasCapability(plan, "passport.premium_treatment");
  const finishOn = memberPlan && data.presentation.memberFinishEnabled !== false;
  const cover = coverFor(data.presentation.coverId);
  const featured = memberPlan ? data.presentation.featuredStamp : null;
  const count = data.connectionCount;
  const sinceMark = monthMark(since);
  const serial = coverSerial(username);
  const unlocked = useMemo(() => new Set(data.rewards.map((reward) => reward.id)), [data.rewards]);
  const counts = filterCounts(data.stamps, data.stampTotal);
  const earnedStamps = data.stamps;
  const isEmpty = count < 5 && data.milestones.length === 0 && earnedStamps.length === 0;
  const next = nextMilestone(count);
  const summary = summarySentence({ milestones: data.milestones.length, cities: data.cities, events: data.events, countries: data.countries, since });
  const summaryShort = summarySentence({ milestones: data.milestones.length, cities: data.cities, events: data.events, countries: data.countries, since }, false);
  const months = useMemo(() => journeyMonths(earnedStamps, since, language), [earnedStamps, since, language]);
  const isNew = useCallback((stamp: PassportStampRecord) => isNewStamp(stamp, data.milestones), [data.milestones]);
  const viewTop = useRef<HTMLHeadingElement>(null);

  const go = (target: View) => {
    setView(target);
    setNotice("");
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => viewTop.current?.focus());
  };

  const coverObject = (options: { width: string; look?: typeof cover.look; member?: boolean; featuredStamp?: PassportStampRecord | null; empty?: boolean; id: string; label?: string }) => (
    <PassportCover
      connections={count}
      empty={options.empty}
      featured={options.featuredStamp ? <PassportRecordStamp rotation={-9} stamp={options.featuredStamp} /> : undefined}
      featuredDisc={options.featuredStamp?.type === "milestone"}
      handle={username}
      idPrefix={options.id}
      label={options.label}
      look={options.look ?? cover.look}
      member={options.member ?? finishOn}
      name={displayName || `@${username}`}
      serial={serial}
      since={sinceMark}
      stamps={data.stampTotal}
      width={options.width}
    />
  );

  const save = useCallback(async (key: string, run: () => PromiseLike<{ error: unknown }>, onSuccess: () => void, message: string) => {
    setPending(key);
    setNotice("");
    try {
      const { error } = await run();
      if (error) throw error;
      onSuccess();
      setNotice(message);
    } catch {
      setNotice("That choice could not be saved. Your earned Passport stays safe.");
    } finally {
      setPending(null);
    }
  }, []);

  const wearCover = (id: CoverId) => save(`cover:${id}`, () => createClient().rpc("set_passport_cover", { p_cover_id: id }), () => setData((current) => ({ ...current, presentation: { ...current.presentation, coverId: id } })), "Passport cover saved.");
  const setFinish = (enabled: boolean) => save("finish", () => createClient().rpc("set_passport_member_finish", { p_enabled: enabled }), () => setData((current) => ({ ...current, presentation: { ...current.presentation, memberFinishEnabled: enabled } })), enabled ? "Member finish on." : "Member finish off.");
  const setFeatured = (stamp: PassportStampRecord | null) => save("featured", () => createClient().rpc("set_passport_featured_stamp", { p_stamp_id: stamp?.id ?? null }), () => setData((current) => ({ ...current, presentation: { ...current.presentation, featuredStampId: stamp?.id ?? null, featuredStamp: stamp } })), stamp ? `${stampLabel(stamp, language)} is on your cover.` : "Featured stamp removed.");
  const wearReward = (category: RewardCategory, id: string) => category === "passport_cover"
    ? wearCover(id as CoverId)
    : save(`reward:${id}`, () => createClient().rpc("set_passport_reward", { p_category: category, p_reward_id: id }), () => setData((current) => ({ ...current, preferences: { ...current.preferences, [category]: id } })), "Saved. It's yours to wear.");

  async function loadMore() {
    const last = data.stamps.at(-1);
    if (!last || !data.hasMoreStamps || loadingMore) return;
    setLoadingMore(true);
    setNotice("");
    try {
      const { data: result, error } = await createClient().rpc("get_passport_stamp_page", { p_before_earned_at: last.earnedAt, p_before_id: last.id, p_limit: 50 });
      if (error || !result || typeof result !== "object") throw error ?? new Error("empty");
      const page = result as { items?: PassportStampRecord[]; hasMore?: boolean };
      const received = Array.isArray(page.items) ? page.items : [];
      setData((current) => {
        const seen = new Set(current.stamps.map((stamp) => stamp.id));
        return { ...current, stamps: [...current.stamps, ...received.filter((stamp) => !seen.has(stamp.id))], hasMoreStamps: page.hasMore === true };
      });
    } catch {
      setNotice("Older stamps could not load just now. Try again in a moment.");
    } finally {
      setLoadingMore(false);
    }
  }

  const openItem = (item: CollectionItem) => setSheet(item.kind === "stamp" ? { kind: "stamp", stamp: item.stamp } : { kind: "ahead", threshold: item.threshold, state: item.state });
  const itemName = (item: CollectionItem) => item.kind === "stamp" ? stampLabel(item.stamp, language) : milestoneName(item.threshold);
  const itemMeta = (item: CollectionItem) => item.kind === "stamp" ? stampMeta(item.stamp) : item.state === "progress" ? `${count} / ${item.threshold}` : `AT ${item.threshold}`;
  const itemStamp = (item: CollectionItem, size?: number) => item.kind === "stamp"
    ? <PassportRecordStamp featured={item.stamp.id === featured?.id} isNew={isNew(item.stamp)} size={size} stamp={item.stamp} />
    : <PassportAheadStamp count={count} size={size} state={item.state} threshold={item.threshold} />;

  const tile = { name: itemName, meta: itemMeta, stamp: itemStamp, open: openItem, describe: (item: CollectionItem) => item.kind === "stamp" ? `${item.stamp.type} stamp${isNew(item.stamp) ? ", new" : ""}${item.stamp.id === featured?.id ? ", featured" : ""}` : item.state === "progress" ? `next milestone, ${count} of ${item.threshold}` : `locked, at ${item.threshold} Connections` };

  // ---- Sub-views -------------------------------------------------------------------------
  const subHeader = (right?: string) => (
    <div className="flex items-center justify-between px-5 pt-1.5 sm:px-10 lg:px-[72px] lg:pt-8">
      <button className={`-ml-1 flex h-10 items-center rounded-full px-1 text-[15px] font-semibold ${focus}`} onClick={() => go("home")} type="button"><span aria-hidden="true" className="mr-1">‹</span>Passport</button>
      {right && <span className={`${mono} text-[11px] tracking-[0.16em]`}>{right}</span>}
    </div>
  );

  let body: ReactNode;
  if (view === "stamps") {
    const items = collectionItems(earnedStamps, count, filter);
    body = (
      <section aria-labelledby="stamps-title">
        {subHeader()}
        <div className="flex flex-col gap-3.5 px-5 pt-3.5 sm:px-10 lg:px-[72px]">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className={`${display} text-[44px] leading-none tracking-[-0.05em] outline-none lg:text-[56px]`} id="stamps-title" ref={viewTop} tabIndex={-1}>Stamps</h1>
            <span className={`${mono} whitespace-nowrap text-[11px] tracking-[0.12em]`}>{(filter === "all" ? counts.all : counts[filter]).toLocaleString("en")} COLLECTED</span>
          </div>
          <FilterChips counts={counts} filter={filter} onChange={setFilter} withCounts />
        </div>
        {items.length ? (
          <ul className="grid list-none grid-cols-3 gap-y-6 px-3 pt-[26px] sm:grid-cols-5 sm:px-8 lg:grid-cols-6 lg:gap-y-8 lg:px-[60px] lg:pt-10">
            {items.map((item) => <StampTile tile={tile} item={item} key={item.kind === "stamp" ? item.stamp.id : `ahead-${item.threshold}`} sizeClass="size-[92px] sm:size-[96px] lg:size-[120px]" />)}
          </ul>
        ) : <p className="px-6 pt-8 text-[15px] text-[#0D0D0DB3] sm:px-10 lg:px-[72px]">Nothing here yet.</p>}
        <LoadMore data={data} loading={loadingMore} onLoad={() => void loadMore()} />
      </section>
    );
  } else if (view === "journey") {
    body = (
      <section aria-labelledby="journey-title">
        {subHeader()}
        <div className="mx-auto w-full max-w-[880px]">
          <div className="flex flex-col gap-1.5 px-6 pt-1.5 sm:px-10">
            <h1 className={`${display} text-[44px] leading-none tracking-[-0.05em] outline-none`} id="journey-title" ref={viewTop} tabIndex={-1}>Journey</h1>
            <p className="text-[15px] text-[#0D0D0DB3]">Where your Passport has been.</p>
          </div>
          <ol className="flex list-none flex-col px-6 pt-[22px] sm:px-10">
            {months.map((month, index) => (
              <li className="grid grid-cols-[20px_minmax(0,1fr)] gap-3.5" key={month.key}>
                <div aria-hidden="true" className="flex flex-col items-center"><span className="mt-[5px] size-[11px] flex-none rounded-full bg-[#0D0D0D]" />{index < months.length - 1 && <span className="w-px flex-1 bg-[#0D0D0D33]" />}</div>
                <div className="flex min-w-0 flex-col gap-2.5 pb-6">
                  <span className={`${mono} text-[11.5px] tracking-[0.14em]`}>{month.month}</span>
                  <h2 className="font-display text-[22px] font-bold leading-[1.1] tracking-[-0.02em] [overflow-wrap:anywhere]">{month.head}</h2>
                  {month.stamps.length > 0 && <ul aria-label={month.line} className="flex list-none flex-wrap gap-1.5">{month.stamps.map((stamp) => <li key={stamp.id}><button aria-label={stampLabel(stamp, language)} className={`block rounded-full ${focus}`} onClick={() => setSheet({ kind: "stamp", stamp })} type="button"><PassportRecordStamp size={56} stamp={stamp} /></button></li>)}</ul>}
                  {month.stamps.length === 0 && <p className="text-[13.5px] text-[#0D0D0DB3]">{month.line}</p>}
                </div>
              </li>
            ))}
          </ol>
          <LoadMore data={data} loading={loadingMore} onLoad={() => void loadMore()} />
        </div>
      </section>
    );
  } else if (view === "finish") {
    body = <FinishView coverObject={coverObject} currentCover={cover.id} count={count} memberPlan={memberPlan} finishOn={finishOn} pending={pending} onWear={wearCover} onFinish={setFinish} onPlus={() => setSheet({ kind: "plus" })} header={subHeader("PASSPORT FINISH")} titleRef={viewTop} unlocked={unlocked} />;
  } else if (view === "flair") {
    body = <FlairView data={data} displayName={displayName} username={username} memberPlan={memberPlan} featured={featured} pending={pending} unlocked={unlocked} language={language} onMark={(id) => { void wearReward("profile_mark", id).then(() => { if (featured) void setFeatured(null); }); }} onFeature={setFeatured} onPlus={() => setSheet({ kind: "plus" })} header={subHeader("PROFILE FLAIR")} titleRef={viewTop} />;
  } else if (isEmpty) {
    body = <EmptyPassport coverObject={coverObject} count={count} titleRef={viewTop} />;
  } else {
    const ruler = <MilestoneLine count={count} />;
    const homeItems: CollectionItem[] = [...earnedStamps.slice(0, 9).map((stamp) => ({ kind: "stamp" as const, stamp })), ...collectionItems([], count, "all").slice(0, 1)];
    const placeStamps = earnedStamps.filter((stamp) => stamp.type !== "milestone");
    const deskItems = filter === "all" ? null : collectionItems(earnedStamps, count, filter);
    const leftPage = collectionItems(earnedStamps.filter((stamp) => stamp.type === "milestone"), count, "milestone").filter((item) => item.kind === "stamp" || item.state === "progress");
    const coversEarned = COVERS.filter((item) => item.id !== "standard" && unlocked.has(item.id));
    const otherCovers = coversEarned.filter((item) => item.id !== cover.id);
    const marks = PASSPORT_REWARDS.filter((reward) => reward.category === "profile_mark");
    const wornMark = marks.find((reward) => reward.id === data.preferences.profile_mark);
    const earnedMark = [...marks].reverse().find((reward) => unlocked.has(reward.id));
    const rows = [
      { k: "Cover", v: otherCovers.length ? `${cover.short} · ${otherCovers.at(-1)!.name} earned` : `${cover.name} · earned through Connections`, tag: otherCovers.length ? `${otherCovers.length} EARNED` : "WEARING", tagClass: otherCovers.length ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-[#0D0D0D14]", to: "finish" as const },
      memberPlan
        ? { k: "Member finish", v: finishOn ? "On your cover" : "Off. Your saved choice stays", tag: finishOn ? "ON" : "OFF", tagClass: finishOn ? "bg-[#FF5A4F]" : "bg-[#0D0D0D14]", to: "finish" as const }
        : { k: "Member finish", v: "Preview it on your cover", tag: "PLUS", tagClass: "bg-[#FF5A4F]", to: "finish" as const },
      { k: "Profile flair", v: featured ? `${stampLabel(featured, language)} beside your name` : wornMark ? `${wornMark.name} mark on your profile` : earnedMark ? `${earnedMark.name} mark earned` : "Just your identity", tag: featured || wornMark ? "SHOWN" : earnedMark ? "EARNED" : "", tagClass: "bg-[#0D0D0D14]", to: "flair" as const },
    ];
    const makeRows = (
      <ul className="flex list-none flex-col">
        {rows.map((row) => (
          <li key={row.k}>
            <button className={`flex min-h-[60px] w-full items-center justify-between gap-3 border-b border-[#0D0D0D1F] py-2 text-left ${focus}`} onClick={() => go(row.to)} type="button">
              <span className="flex min-w-0 flex-col gap-0.5"><span className="text-[15px] font-semibold">{row.k}</span><span className="text-[13px] text-[#0D0D0DB3]">{row.v}</span></span>
              {row.tag && <span className={`${mono} whitespace-nowrap rounded-full px-[9px] py-[5px] text-[10.5px] leading-none tracking-[0.12em] ${row.tagClass}`}>{row.tag}</span>}
            </button>
          </li>
        ))}
      </ul>
    );

    body = (
      <>
        <div className="flex items-center justify-between px-5 pt-1.5 sm:px-10 sm:pt-7 lg:hidden">
          <PassportLabel />
          <button className={`${pillOutline} h-10 px-4 text-[14px] sm:h-11 sm:px-[18px]`} onClick={() => go("finish")} type="button">Customize</button>
        </div>

        <section aria-labelledby="passport-count" className="sm:grid sm:grid-cols-[270px_minmax(0,1fr)] sm:items-end sm:gap-10 sm:px-10 sm:pt-[30px] lg:grid-cols-[440px_minmax(0,1fr)] lg:items-start lg:gap-[72px] lg:px-[72px] lg:pt-14">
          <div className="flex flex-col items-center gap-5 pt-7 sm:items-start sm:pt-0 lg:sticky lg:top-[100px]">
            <div className="[--cw:min(300px,calc(100vw-40px))] sm:[--cw:270px] lg:[--cw:390px]">{coverObject({ width: "var(--cw)", featuredStamp: featured, id: "pc-home", label: `${cover.name} Passport cover for ${displayName || username}${finishOn ? ", Member edition" : ""}` })}</div>
            <div className="mt-2.5 hidden gap-2.5 lg:flex">
              <button className={`${pillOutline} h-11 px-[18px] text-[14px]`} onClick={() => go("finish")} type="button">Customize</button>
              <Link className={`${pillInk} h-11 px-[18px] text-[14px]`} href="/app/tap">Show Quick QR</Link>
            </div>
          </div>
          <div className="flex min-w-0 flex-col sm:gap-[22px] lg:gap-11 lg:pt-2">
            <p className={`${mono} hidden text-[12px] tracking-[0.16em] lg:block`}>YOUR PASSPORT · {(displayName || `@${username}`).toLocaleUpperCase("en")}</p>
            <div className="flex flex-col gap-1.5 px-6 pt-10 sm:gap-1 sm:p-0 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-7 lg:gap-y-4">
              <h1 className="outline-none" id="passport-count" ref={viewTop} tabIndex={-1}>
                <span className={`${display} block text-[120px] leading-[0.82] tracking-[-0.065em] tabular-nums sm:text-[150px] sm:leading-[0.8] lg:text-[240px] lg:leading-[0.76] lg:tracking-[-0.07em] ${count >= 1000 ? "max-[389px]:text-[96px] lg:text-[200px]" : ""}`}>{count.toLocaleString("en")}</span>
                <span className="sr-only"> Connections</span>
              </h1>
              <div className="flex flex-col gap-1.5 sm:gap-1 lg:gap-2 lg:pb-1.5">
                <span aria-hidden="true" className="font-display text-[28px] font-bold tracking-[-0.03em] sm:text-[30px] lg:text-[40px] lg:leading-none lg:tracking-[-0.035em]">{count === 1 ? "Connection" : "Connections"}</span>
                <p className="mt-2 text-[16px] leading-[1.5] text-[#0D0D0DB3] [text-wrap:pretty] sm:mt-1.5 lg:mt-0 lg:max-w-[360px] lg:text-[17px]"><span className="sm:hidden">{summary}</span><span className="hidden sm:inline">{summaryShort}</span></p>
              </div>
            </div>
            <div className="mx-5 mt-8 flex flex-col gap-[18px] border-t-[1.5px] border-[#0D0D0D] px-5 pb-[18px] pt-[22px] sm:mx-0 sm:mt-0 sm:gap-3.5 sm:px-0 sm:pb-0 sm:pt-4 lg:gap-5 lg:pt-5">
              <div className="flex items-end justify-between gap-3 sm:items-baseline">
                {next ? <>
                  <div className="flex flex-col gap-1 sm:hidden"><span className={`${mono} text-[11px] tracking-[0.14em] text-[#0D0D0DB3]`}>NEXT · {ordinalOf(next.threshold)}</span><span className={`${display} text-[32px] leading-none tracking-[-0.04em]`}>{next.name}</span></div>
                  <span className={`${display} hidden text-[26px] tracking-[-0.04em] sm:inline lg:text-[34px]`}>Next · {next.name}</span>
                  <span className="text-right text-[14px] font-semibold lg:text-[16px]">{(next.threshold - count).toLocaleString("en")} to go<span className="hidden lg:inline">{unlocksShort(next.threshold) ? ` · ${unlocksShort(next.threshold)}` : ""}</span></span>
                </> : <span className={`${display} text-[32px] leading-none tracking-[-0.04em] sm:text-[26px] lg:text-[34px]`}>Thousand Met</span>}
              </div>
              {ruler}
              <span className="text-[14px] leading-[1.45] text-[#0D0D0DB3] sm:hidden">{next ? unlocksSentence(next.threshold) : "Your record keeps growing."}</span>
              {!next && <span className="hidden text-[14px] text-[#0D0D0DB3] sm:block">Your record keeps growing.</span>}
            </div>
          </div>
        </section>

        {/* Stamps · phone and tablet */}
        <section aria-labelledby="stamps-home" className="mx-3 mt-5 flex flex-col gap-5 rounded-3xl border-t-[1.5px] border-dashed border-[#0D0D0D40] bg-[#0D0D0D08] px-3 pb-[26px] pt-6 sm:mx-10 sm:mt-[30px] sm:gap-[18px] sm:p-6 lg:hidden">
          <div className="flex items-baseline justify-between px-2 sm:px-0">
            <h2 className={`${display} text-[30px] tracking-[-0.04em]`} id="stamps-home">Stamps</h2>
            <span className={`${mono} text-[11px] tracking-[0.12em]`}>{data.stampTotal.toLocaleString("en")} COLLECTED</span>
          </div>
          <ul className="grid list-none grid-cols-3 gap-y-[22px] sm:grid-cols-5">
            {homeItems.map((item, index) => {
              const ahead = item.kind === "ahead";
              const hiddenOnPhone = !ahead && index >= 5;
              return <StampTile className={hiddenOnPhone ? "hidden sm:flex" : ""} item={item} key={item.kind === "stamp" ? item.stamp.id : `ahead-${item.threshold}`} labelClass="text-[13px]" metaClass="sm:hidden" sizeClass="size-[92px] sm:size-[96px]" tile={tile} />;
            })}
          </ul>
          <button className={`${pillOutline} h-11 self-center px-5 text-[14px]`} onClick={() => go("stamps")} type="button">All {data.stampTotal.toLocaleString("en")} {data.stampTotal === 1 ? "stamp" : "stamps"}</button>
        </section>

        {/* Stamps · desktop spread */}
        <section aria-labelledby="stamps-desk" className="hidden flex-col gap-[22px] px-[72px] pt-[72px] lg:flex">
          <div className="flex items-baseline justify-between gap-6">
            <h2 className={`${display} text-[44px] tracking-[-0.045em]`} id="stamps-desk">Stamps</h2>
            <FilterChips counts={counts} filter={filter} onChange={setFilter} />
          </div>
          {deskItems ? (
            <div className="rounded-[10px] bg-[#0D0D0D08] px-10 py-[34px]">
              <PageHead left={FILTERS.find((item) => item.id === filter)!.label.toUpperCase()} right="PAGE 01" />
              <ul className="mt-[22px] grid list-none grid-cols-6 gap-y-[26px]">{deskItems.map((item) => <StampTile tile={tile} item={item} key={item.kind === "stamp" ? item.stamp.id : `ahead-${item.threshold}`} labelClass="text-[14px]" sizeClass="size-[120px]" />)}</ul>
            </div>
          ) : (
            <div className={`relative grid rounded-[10px] bg-[#0D0D0D08] ${placeStamps.length ? "grid-cols-2" : "grid-cols-1"}`}>
              {placeStamps.length > 0 && <><span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-[#0D0D0D26]" /><span aria-hidden="true" className="absolute inset-y-0 left-[calc(50%-22px)] w-11 bg-[linear-gradient(90deg,#0D0D0D00,#0D0D0D0D,#0D0D0D00)]" /></>}
              <div className="flex flex-col gap-[22px] px-10 py-[34px]">
                <PageHead left="MILESTONES" right="PAGE 01" />
                <ul className={`grid list-none gap-y-[26px] ${placeStamps.length ? "grid-cols-3" : "grid-cols-6"}`}>{leftPage.map((item) => <StampTile tile={tile} item={item} key={item.kind === "stamp" ? item.stamp.id : `ahead-${item.threshold}`} labelClass="text-[14px]" sizeClass="size-[120px]" />)}</ul>
              </div>
              {placeStamps.length > 0 && <div className="flex flex-col gap-[22px] px-10 py-[34px]">
                <PageHead left="PLACES & EVENTS" right="PAGE 02" />
                <ul className="grid list-none grid-cols-4 gap-y-[26px]">{placeStamps.map((stamp) => <StampTile tile={tile} item={{ kind: "stamp", stamp }} key={stamp.id} labelClass="text-[14px]" sizeClass="size-[112px]" />)}</ul>
              </div>}
            </div>
          )}
          {data.hasMoreStamps && <button className={`${pillOutline} h-11 self-start px-5 text-[14px]`} onClick={() => go("stamps")} type="button">All {data.stampTotal.toLocaleString("en")} stamps</button>}
        </section>

        {/* Journey */}
        <section aria-labelledby="journey-home" className="flex flex-col gap-1.5 px-6 pt-9 sm:px-10 lg:grid lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-[72px] lg:px-[72px] lg:pt-[72px]">
          <div className="flex items-baseline justify-between gap-3 lg:flex-col lg:items-start lg:justify-start lg:gap-2.5">
            <h2 className={`${display} text-[30px] tracking-[-0.04em] lg:text-[44px] lg:leading-none lg:tracking-[-0.045em]`} id="journey-home">Journey</h2>
            <p className="hidden text-[16px] text-[#0D0D0DB3] lg:block">Where your Passport has been, by month.</p>
            <button className={`${mono} min-h-11 text-[11px] tracking-[0.12em] underline underline-offset-4 lg:min-h-0 lg:pt-2 ${focus}`} onClick={() => go("journey")} type="button">FULL JOURNEY</button>
          </div>
          <ol className="flex list-none flex-col">
            {months.map((month, index) => (
              <li className={`grid grid-cols-[78px_minmax(0,1fr)] gap-3 border-t border-[#0D0D0D1F] py-4 lg:grid-cols-[120px_minmax(0,1fr)_auto] lg:items-center lg:gap-6 lg:py-[18px] ${index >= 3 ? "hidden lg:grid" : ""} ${index >= 6 ? "lg:hidden" : ""}`} key={month.key}>
                <span className={`${mono} pt-[3px] text-[11px] tracking-[0.12em] lg:pt-0 lg:text-[12px] lg:tracking-[0.14em]`}>{month.month}</span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-[16px] font-semibold [overflow-wrap:anywhere] lg:font-display lg:text-[24px] lg:font-bold lg:tracking-[-0.02em]">{month.head}</span>
                  <span className="text-[13.5px] leading-[1.45] text-[#0D0D0DB3] lg:hidden">{month.line}</span>
                </span>
                <span aria-hidden="true" className="hidden gap-1.5 lg:flex">{month.stamps.slice(0, 6).map((stamp) => <PassportRecordStamp key={stamp.id} size={52} stamp={stamp} />)}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Make it yours */}
        <section aria-labelledby="make-yours" className="mx-5 mt-7 flex flex-col border-t-[1.5px] border-[#0D0D0D] sm:mx-10 lg:mx-0 lg:mt-0 lg:grid lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-[72px] lg:border-t-0 lg:px-[72px] lg:pt-[72px]">
          <h2 className={`${mono} pb-1 pt-[18px] text-[11px] tracking-[0.14em] lg:p-0 lg:font-display lg:text-[44px] lg:font-extrabold lg:leading-none lg:tracking-[-0.045em]`} id="make-yours"><span className="lg:hidden">MAKE IT YOURS</span><span className="hidden lg:inline">Make it yours</span></h2>
          <div className="lg:border-t-[1.5px] lg:border-[#0D0D0D]">{makeRows}</div>
        </section>
      </>
    );
  }

  const sheetStamp = sheet?.kind === "stamp" ? sheet.stamp : null;
  return (
    <main className={`${passportDisplay.variable} mx-auto w-full max-w-[1440px] pb-10 text-[#0D0D0D] lg:pb-20`} data-passport-view={view}>
      {body}
      <p aria-live="polite" className="min-h-6 px-6 pt-4 text-[14px] text-[#0D0D0DB3] sm:px-10 lg:px-[72px]" role="status">{notice}</p>

      {sheetStamp && (
        <StampDetail
          featured={featured?.id === sheetStamp.id}
          language={language}
          memberPlan={memberPlan}
          milestones={data.milestones}
          onClose={() => setSheet(null)}
          onFeature={(value) => void setFeatured(value ? sheetStamp : null)}
          onPlus={() => setSheet({ kind: "plus" })}
          onWear={(category, id) => void wearReward(category, id)}
          pending={pending}
          preferences={data.preferences}
          coverId={cover.id}
          stamp={sheetStamp}
          unlocked={unlocked}
        />
      )}
      {sheet?.kind === "ahead" && <AheadDetail count={count} onClose={() => setSheet(null)} state={sheet.state} threshold={sheet.threshold} />}
      {sheet?.kind === "plus" && (
        <PlusSheet
          now={coverObject({ width: "126px", member: false, id: "pc-now" })}
          onClose={() => setSheet(null)}
          withPlus={coverObject({ width: "126px", member: true, featuredStamp: featured ?? earnedStamps[0] ?? null, id: "pc-plus" })}
        />
      )}
      {press && pressOpen && <PressDialog milestone={press} onDone={() => setPressOpen(false)} />}
    </main>
  );
}

type TileApi = {
  name: (item: CollectionItem) => string;
  meta: (item: CollectionItem) => string;
  stamp: (item: CollectionItem) => ReactNode;
  open: (item: CollectionItem) => void;
  describe: (item: CollectionItem) => string;
};

/** One collectible in a grid: the stamp is the object, the label sits quietly underneath. */
function StampTile({ tile, item, sizeClass, meta = true, labelClass = "text-[13px]", className = "", metaClass = "" }: { tile: TileApi; item: CollectionItem; sizeClass: string; meta?: boolean; labelClass?: string; className?: string; metaClass?: string }) {
  return (
    <li className={`flex min-w-0 justify-center ${className}`}>
      <button
        aria-label={`${tile.name(item)}, ${tile.describe(item)}`}
        className={`group flex min-w-0 max-w-full flex-col items-center gap-2 rounded-2xl px-1 pb-1 text-center ${focus}`}
        data-collection-item={item.kind === "stamp" ? item.stamp.type : `milestone-${item.state}`}
        onClick={() => tile.open(item)}
        type="button"
      >
        <span className={`block transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none ${sizeClass}`}>{tile.stamp(item)}</span>
        <span className="flex min-w-0 max-w-full flex-col gap-0.5">
          <span className={`break-words font-semibold leading-tight [overflow-wrap:anywhere] ${labelClass}`}>{tile.name(item)}</span>
          {meta && <span className={`font-label text-[10px] tracking-[0.06em] text-[#0D0D0DB3] lg:text-[10.5px] lg:tracking-normal ${metaClass}`}>{tile.meta(item)}</span>}
        </span>
      </button>
    </li>
  );
}

function PassportLabel() {
  return (
    <span className="flex items-center gap-2">
      <svg aria-hidden="true" className="size-[18px] sm:size-5" viewBox="0 0 100 100"><path d="M66.94 31.48A17 17 0 1 0 41.04 44.45L58.96 55.55A17 17 0 1 1 33.06 68.52" fill="none" stroke="currentColor" strokeWidth="22" /></svg>
      <span className="font-label text-[11px] tracking-[0.16em] sm:text-[12px]">YOUR PASSPORT</span>
    </span>
  );
}

function PageHead({ left, right }: { left: string; right: string }) {
  return <div className="flex justify-between font-label text-[10.5px] tracking-[0.14em] text-[#0D0D0DB3]"><span>{left}</span><span>{right}</span></div>;
}

function FilterChips({ filter, onChange, counts, withCounts = false }: { filter: StampFilter; onChange: (value: StampFilter) => void; counts: Record<StampFilter, number>; withCounts?: boolean }) {
  const visible = FILTERS.filter((item) => item.id === "all" || counts[item.id] > 0);
  return (
    <div aria-label="Filter stamps" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" role="group">
      {visible.map((item) => (
        <button
          aria-pressed={filter === item.id}
          className={`flex h-9 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-[#0D0D0D] px-[13px] text-[13px] font-semibold transition-colors lg:px-3.5 ${focus} ${filter === item.id ? "bg-[#0D0D0D] text-[#F5F4EF]" : "hover:bg-[#0D0D0D0A]"}`}
          key={item.id}
          onClick={() => onChange(item.id)}
          type="button"
        >
          {item.label}{withCounts && <span className="font-label text-[10.5px] opacity-75">{counts[item.id].toLocaleString("en")}</span>}
        </button>
      ))}
    </div>
  );
}

function LoadMore({ data, loading, onLoad }: { data: PassportData; loading: boolean; onLoad: () => void }) {
  if (!data.hasMoreStamps) return null;
  return (
    <div className="flex justify-center px-6 pt-8">
      <button className={`${pillOutline} h-11 px-5 text-[14px] disabled:opacity-60`} disabled={loading} onClick={onLoad} type="button">{loading ? "Opening older pages…" : `Older stamps · ${Math.max(0, data.stampTotal - data.stamps.length).toLocaleString("en")} more`}</button>
    </div>
  );
}

/** The printed line: ordinal spacing (i / 7), interpolated fill, coral ring on the next milestone. */
type CoverFactory = (options: { width: string; look?: "standard" | "paper" | "century" | "thousand"; member?: boolean; featuredStamp?: PassportStampRecord | null; empty?: boolean; id: string; label?: string }) => ReactNode;

function EmptyPassport({ coverObject, count, titleRef }: { coverObject: CoverFactory; count: number; titleRef: React.Ref<HTMLHeadingElement> }) {
  return (
    <section aria-labelledby="empty-title" className="flex min-h-[calc(100dvh-138px-env(safe-area-inset-bottom))] flex-col sm:min-h-0 lg:grid lg:grid-cols-[440px_minmax(0,1fr)] lg:items-center lg:gap-[72px] lg:px-[72px] lg:pt-14">
      <div className="flex h-10 items-center px-5 pt-1.5 sm:px-10 sm:pt-7 lg:hidden"><PassportLabel /></div>
      <div className="flex justify-center pt-[18px] lg:pt-0">
        <div className="[--cw:min(234px,calc(100vw-40px))] sm:[--cw:270px] lg:[--cw:390px]">{coverObject({ width: "var(--cw)", empty: true, member: false, id: "pc-empty", label: "Your new Setuvara Passport cover" })}</div>
      </div>
      <div className="flex flex-1 flex-col sm:mx-auto sm:w-full sm:max-w-[520px] lg:mx-0 lg:max-w-[560px]">
        <div className="flex flex-col gap-2.5 px-6 pt-7 lg:px-0 lg:pt-0">
          <p className="hidden font-label text-[12px] tracking-[0.16em] lg:block">YOUR PASSPORT</p>
          <h1 className="font-display text-[36px] font-extrabold leading-[0.98] tracking-[-0.05em] outline-none lg:text-[56px]" id="empty-title" ref={titleRef} tabIndex={-1}>Your Passport starts with the first person you meet.</h1>
          <p className="text-[15px] leading-[1.5] text-[#0D0D0DB3] lg:text-[17px]">Five real Connections press your first stamp.</p>
        </div>
        <div className="mx-6 mt-[18px] flex items-center gap-4 border-t border-[#0D0D0D1F] pt-4 lg:mx-0">
          <PassportAheadStamp count={count} size={84} state="progress" threshold={5} />
          <div className="flex flex-col gap-[3px]">
            <span className="font-label text-[10.5px] tracking-[0.14em] text-[#0D0D0DB3]">FIRST STAMP</span>
            <span className="text-[17px] font-bold">First Circle</span>
            <span className="text-[13.5px] text-[#0D0D0DB3]">{count} of 5 · then Ten Met, In Motion…</span>
          </div>
        </div>
        <div className="mx-6 mb-[34px] mt-auto flex flex-col gap-2.5 pt-8 lg:mx-0 lg:mb-0 lg:max-w-[360px]">
          <Link className={`${pillInk} h-[52px] text-[16px]`} href="/app/tap">Show Quick QR</Link>
          <span className="text-center text-[13px] text-[#0D0D0DB3] lg:text-left">Meet at an event and it can add the city too.</span>
        </div>
      </div>
    </section>
  );
}

function FinishView({ coverObject, currentCover, count, memberPlan, finishOn, pending, onWear, onFinish, onPlus, header, titleRef, unlocked }: {
  coverObject: CoverFactory;
  currentCover: CoverId;
  count: number;
  memberPlan: boolean;
  finishOn: boolean;
  pending: string | null;
  onWear: (id: CoverId) => void;
  onFinish: (enabled: boolean) => void;
  onPlus: () => void;
  header: ReactNode;
  titleRef: React.Ref<HTMLHeadingElement>;
  unlocked: Set<string>;
}) {
  const [selected, setSelected] = useState<CoverId>(currentCover);
  const [preview, setPreview] = useState(false);
  const selCover = coverFor(selected);
  const earned = (id: CoverId) => id === "standard" || unlocked.has(id);
  const selLocked = !earned(selected);
  const member = memberPlan ? finishOn : preview;
  const cta = !memberPlan && preview ? "Unlock with Plus" : selLocked ? `Earned at ${selCover.at.toLocaleString("en")} Connections` : selected === currentCover ? "Wearing" : pending === `cover:${selected}` ? "Saving…" : "Wear this cover";
  const ctaClass = !memberPlan && preview ? "bg-[#FF5A4F] text-[#0D0D0D]" : selLocked || selected === currentCover ? "bg-[#0D0D0D14] text-[#0D0D0DB3]" : "bg-[#0D0D0D] text-[#F5F4EF]";
  const ctaDisabled = memberPlan || !preview ? (selLocked || selected === currentCover || pending !== null) : false;

  return (
    <section aria-labelledby="finish-title">
      {header}
      <h1 className="sr-only outline-none" id="finish-title" ref={titleRef} tabIndex={-1}>Passport finish</h1>
      <div className="mx-auto w-full max-w-[560px] lg:pt-4">
        <div className="mt-3 flex h-[300px] items-center justify-center bg-[#0D0D0D08] sm:rounded-3xl lg:h-[420px]">
          <div className="[--cw:186px] lg:[--cw:260px]">{coverObject({ width: "var(--cw)", look: selCover.look, member, id: "pc-finish", label: `${selCover.name} preview${member ? " with Member finish" : ""}` })}</div>
        </div>
        <div className="flex flex-col gap-3 px-5 pt-[18px] sm:px-0">
          <div className="flex items-baseline justify-between"><span className="font-label text-[11px] tracking-[0.14em]">COVER</span><span className="text-[13px] text-[#0D0D0DB3]">Earned through Connections</span></div>
          <div aria-label="Covers" className="grid grid-cols-4 gap-2.5" role="radiogroup">
            {COVERS.map((item) => {
              const status = item.id === currentCover ? "WEARING" : earned(item.id) ? "EARNED" : `AT ${item.at.toLocaleString("en")}`;
              return (
                <button aria-checked={selected === item.id} aria-label={`${item.name}, ${status.toLowerCase()}`} className={`flex min-w-0 flex-col gap-[7px] rounded-xl text-left ${focus}`} key={item.id} onClick={() => setSelected(item.id)} role="radio" type="button">
                  <span className={`flex h-[104px] items-center justify-center rounded-xl border-2 ${selected === item.id ? "border-[#0D0D0D]" : "border-transparent"}`}>{coverObject({ width: "66px", look: item.look, member: false, id: `pc-tile-${item.id}` })}</span>
                  <span className="text-[12px] font-semibold leading-[1.2]">{item.short}</span>
                  <span className="font-label text-[9.5px] tracking-[0.06em] text-[#0D0D0DB3]">{status}</span>
                </button>
              );
            })}
          </div>
          <button
            aria-checked={member}
            className={`mt-1.5 flex min-h-[60px] items-center justify-between gap-3 border-y border-[#0D0D0D1F] text-left ${focus}`}
            disabled={pending === "finish"}
            onClick={() => (memberPlan ? onFinish(!finishOn) : setPreview((value) => !value))}
            role="switch"
            type="button"
          >
            <span className="flex items-center gap-2.5">
              <MemberBadge decorative size={22} tier="plus" />
              <span className="flex flex-col gap-px"><span className="text-[15px] font-semibold">Member finish</span><span className="text-[12.5px] text-[#0D0D0DB3]">{memberPlan ? "On every cover you've earned" : "Preview free · wear with Plus"}</span></span>
            </span>
            <span aria-hidden="true" className={`relative h-7 w-12 flex-none rounded-full transition-colors ${member ? "bg-[#FF5A4F]" : "bg-[#0D0D0D33]"}`}><span className={`absolute top-[3px] size-[22px] rounded-full bg-[#F5F4EF] shadow-[0_1px_3px_#0D0D0D55] transition-[left] motion-reduce:transition-none ${member ? "left-[23px]" : "left-[3px]"}`} /></span>
          </button>
          <button
            aria-disabled={ctaDisabled}
            className={`mt-1 flex h-[52px] items-center justify-center rounded-full text-[15px] font-semibold ${focus} ${ctaClass} ${ctaDisabled ? "cursor-default" : ""}`}
            onClick={() => { if (!memberPlan && preview) onPlus(); else if (!ctaDisabled) onWear(selected); }}
            type="button"
          >{cta}</button>
          {!memberPlan && <p className="pt-1 text-center text-[12.5px] text-[#0D0D0DB3]">Every cover is earned at {count < 5 ? "5, 100 and 1000" : "milestones"}, on every plan.</p>}
        </div>
      </div>
    </section>
  );
}

function FlairView({ data, displayName, username, memberPlan, featured, pending, unlocked, language, onMark, onFeature, onPlus, header, titleRef }: {
  data: PassportData;
  displayName: string;
  username: string;
  memberPlan: boolean;
  featured: PassportStampRecord | null;
  pending: string | null;
  unlocked: Set<string>;
  language: string;
  onMark: (id: string) => void;
  onFeature: (stamp: PassportStampRecord | null) => void;
  onPlus: () => void;
  header: ReactNode;
  titleRef: React.Ref<HTMLHeadingElement>;
}) {
  const [choosing, setChoosing] = useState(false);
  const marks = PASSPORT_REWARDS.filter((reward) => reward.category === "profile_mark");
  const worn = marks.find((reward) => reward.id === data.preferences.profile_mark && unlocked.has(reward.id));
  const selectedId = featured ? "stamp" : worn ? worn.id : "none";
  const unlockedAt = (id: string) => data.rewards.find((reward) => reward.id === id)?.unlockedAt;
  const name = displayName || `@${username}`;
  const options = [
    { id: "none", k: "Nothing", v: worn ? "A worn mark can be swapped, not removed yet" : "Just your identity", tag: "", ok: !worn, run: () => { if (featured) onFeature(null); } },
    ...marks.map((reward) => ({
      id: reward.id,
      k: `${reward.name} mark`,
      v: unlocked.has(reward.id) ? `Earned ${dayMark(unlockedAt(reward.id))}` : `Earned at ${reward.milestone.toLocaleString("en")} Connections`,
      tag: unlocked.has(reward.id) ? "EARNED" : `AT ${reward.milestone.toLocaleString("en")}`,
      ok: unlocked.has(reward.id),
      run: () => onMark(reward.id),
    })),
    { id: "stamp", k: "Featured stamp", v: featured ? `${stampLabel(featured, language)} beside your name` : "Any earned stamp beside your name", tag: "PLUS", ok: true, run: () => (memberPlan ? setChoosing((value) => !value) : onPlus()) },
  ];

  return (
    <section aria-labelledby="flair-title">
      {header}
      <h1 className="sr-only outline-none" id="flair-title" ref={titleRef} tabIndex={-1}>Profile flair</h1>
      <div className="mx-auto w-full max-w-[560px]">
        <div className="mx-5 mt-3.5 flex flex-col gap-3.5 rounded-3xl bg-[#0D0D0D] p-[22px] text-[#F5F4EF] sm:mx-0">
          <span className="font-label text-[10px] tracking-[0.16em] text-[#F5F4EFB3]">PUBLIC PROFILE · PREVIEW</span>
          <div className="flex items-center gap-3.5">
            <span aria-hidden="true" className="grid size-16 flex-none place-items-center rounded-full bg-[#AFCBFF] font-display text-[26px] font-extrabold text-[#0D0D0D]">{name.replace(/^@/, "").slice(0, 1).toUpperCase()}</span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-display text-[26px] font-extrabold leading-none tracking-[-0.04em]">{name}</span>
                {featured && <span className="flex flex-none rounded-full bg-[#F5F4EF] p-0.5"><PassportRecordStamp size={30} stamp={featured} /></span>}
              </div>
              <span className="truncate font-label text-[12px] text-[#F5F4EFB3]">@{username}</span>
            </div>
          </div>
          {worn && (
            <span className="flex h-7 items-center gap-[7px] self-start rounded-full border border-[#F5F4EF66] pl-1.5 pr-[11px] font-label text-[10.5px] tracking-[0.14em]">
              <span className="flex size-4 items-center justify-center rounded-full border-[1.5px] border-[#F5F4EF] text-[7px]">{worn.milestone === 1000 ? "1K" : worn.milestone}</span>{worn.name.toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex flex-col px-5 pt-5 sm:px-0">
          <span className="pb-1.5 font-label text-[11px] tracking-[0.14em]">SHOW ON YOUR PROFILE</span>
          <div aria-label="Show on your profile" role="radiogroup">
            {options.map((option) => (
              <div key={option.id}>
                <button
                  aria-checked={selectedId === option.id}
                  aria-disabled={!option.ok}
                  className={`flex min-h-[62px] w-full items-center justify-between gap-3 border-t border-[#0D0D0D1F] text-left ${focus} ${option.ok ? "" : "cursor-default opacity-55"}`}
                  disabled={pending !== null && option.ok}
                  onClick={() => { if (option.ok) option.run(); }}
                  role="radio"
                  type="button"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-5 flex-none items-center justify-center rounded-full border-2 border-[#0D0D0D]"><span className={`size-2.5 rounded-full ${selectedId === option.id ? "bg-[#0D0D0D]" : ""}`} /></span>
                    <span className="flex flex-col gap-0.5"><span className="text-[15px] font-semibold">{option.k}</span><span className="text-[12.5px] text-[#0D0D0DB3]">{option.v}</span></span>
                  </span>
                  {option.tag && <span className={`whitespace-nowrap rounded-full px-[9px] py-[5px] font-label text-[10px] leading-none tracking-[0.12em] ${option.tag === "PLUS" ? "bg-[#FF5A4F]" : option.tag === "EARNED" ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-[#0D0D0D14]"}`}>{option.tag}</span>}
                </button>
                {option.id === "stamp" && memberPlan && choosing && (
                  <ul aria-label="Choose a stamp" className="-mx-5 flex list-none gap-2 overflow-x-auto px-5 pb-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
                    {data.stamps.map((stamp) => (
                      <li className="flex-none" key={stamp.id}>
                        <button aria-label={stampLabel(stamp, language)} aria-pressed={featured?.id === stamp.id} className={`flex size-[72px] items-center justify-center rounded-2xl border-2 ${featured?.id === stamp.id ? "border-[#0D0D0D]" : "border-transparent"} ${focus}`} onClick={() => { onFeature(stamp); setChoosing(false); }} type="button"><PassportRecordStamp size={56} stamp={stamp} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <p className="border-t border-[#0D0D0D1F] pt-4 text-[13px] leading-[1.5] text-[#0D0D0DB3]">Your count, collection and history stay private. Only what you choose here appears on a published profile.</p>
        </div>
      </div>
    </section>
  );
}

function DetailHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="font-label text-[11px] tracking-[0.16em] text-[#0D0D0DB3]">{eyebrow}</span>
      <h2 className="font-display text-[40px] font-extrabold leading-none tracking-[-0.05em] [overflow-wrap:anywhere]">{title}</h2>
    </div>
  );
}

function StampDetail({ stamp, featured, language, memberPlan, milestones, onClose, onFeature, onPlus, onWear, pending, preferences, coverId, unlocked }: {
  stamp: PassportStampRecord;
  featured: boolean;
  language: string;
  memberPlan: boolean;
  milestones: MilestoneRecord[];
  onClose: () => void;
  onFeature: (value: boolean) => void;
  onPlus: () => void;
  onWear: (category: RewardCategory, id: string) => void;
  pending: string | null;
  preferences: Partial<Record<RewardCategory, string>>;
  coverId: CoverId;
  unlocked: Set<string>;
}) {
  const threshold = stampThreshold(stamp);
  const label = stampLabel(stamp, language);
  const isMilestone = stamp.type === "milestone" && threshold != null;
  const eyebrow = isMilestone ? `MILESTONE · ${ordinalOf(threshold)}` : stamp.type === "city" ? `CITY${stamp.countryCode ? ` · ${stamp.countryCode}` : ""}` : stamp.type === "event" ? "EVENT" : `COUNTRY · ${(stamp.countryCode ?? stamp.title).toUpperCase()}`;
  const line = isMilestone ? `${threshold.toLocaleString("en")} people connected with you through Setuvara.` : placeContext(stamp, language);
  const rewards = isMilestone ? wearableRewards(threshold) : [];
  const worn = (category: RewardCategory, id: string) => category === "passport_cover" ? coverId === id : preferences[category] === id;
  return (
    <PassportSheet label={`${label} stamp`} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex justify-center pt-2.5"><PassportRecordStamp isNew={isNewStamp(stamp, milestones)} featured={featured} size={178} stamp={stamp} /></div>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <DetailHead eyebrow={eyebrow} title={label} />
          {line && <p className="text-[15px] text-[#0D0D0DB3]">{line}</p>}
        </div>
        <dl className="grid grid-cols-2 border-y border-[#0D0D0D1F]">
          <div className="flex flex-col gap-[3px] py-3"><dt className="font-label text-[10px] tracking-[0.14em] text-[#0D0D0DB3]">EARNED</dt><dd className="text-[15px] font-semibold">{dayMark(stamp.earnedAt) || "Recorded"}</dd></div>
          <div className="flex flex-col gap-[3px] border-l border-[#0D0D0D1F] py-3 pl-3.5"><dt className="font-label text-[10px] tracking-[0.14em] text-[#0D0D0DB3]">KEPT</dt><dd className="text-[15px] font-semibold">Forever</dd></div>
        </dl>
        {rewards.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="pb-1 font-label text-[10.5px] tracking-[0.14em] text-[#0D0D0DB3]">UNLOCKED WITH IT</span>
            <ul className="flex list-none flex-col">
              {rewards.map((reward, index) => {
                const has = unlocked.has(reward.id);
                const wearing = worn(reward.category, reward.id);
                return (
                  <li className={`flex min-h-[52px] items-center justify-between gap-3 ${index < rewards.length - 1 ? "border-b border-[#0D0D0D1F]" : ""}`} key={reward.id}>
                    <span className="text-[15px] font-semibold">{reward.name} · {rewardKind(reward)}</span>
                    {has ? (
                      <button aria-pressed={wearing} className={`h-9 flex-none rounded-full px-3.5 text-[13px] font-semibold ${focus} ${wearing ? "border-[1.5px] border-[#0D0D0D]" : "bg-[#0D0D0D] text-[#F5F4EF]"}`} disabled={wearing || pending !== null} onClick={() => onWear(reward.category, reward.id)} type="button">{wearing ? "Wearing" : pending === `reward:${reward.id}` || pending === `cover:${reward.id}` ? "Saving…" : "Wear"}</button>
                    ) : <span className="font-label text-[10.5px] tracking-[0.12em] text-[#0D0D0DB3]">SYNCING</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <button
          aria-pressed={memberPlan ? featured : undefined}
          className={`${pillOutline} h-[52px] gap-2 text-[15px] disabled:opacity-60`}
          disabled={pending === "featured"}
          onClick={() => (memberPlan ? onFeature(!featured) : onPlus())}
          type="button"
        >
          <MemberBadge decorative size={18} tier="plus" />{featured ? "Shown on your Passport cover" : "Show on Passport cover"}
        </button>
      </div>
    </PassportSheet>
  );
}

function AheadDetail({ threshold, state, count, onClose }: { threshold: number; state: "progress" | "locked"; count: number; onClose: () => void }) {
  const name = milestoneName(threshold);
  const left = Math.max(0, threshold - count);
  const rewards = wearableRewards(threshold);
  return (
    <PassportSheet label={`${name}, not yet earned`} onClose={onClose}>
      <div className="flex flex-col gap-[22px]">
        <div className="flex justify-center pt-2.5"><PassportAheadStamp count={count} size={178} state={state} threshold={threshold} /></div>
        <DetailHead eyebrow={`MILESTONE · ${ordinalOf(threshold)}`} title={name} />
        {state === "progress" ? (
          <p className="flex items-baseline justify-center gap-2"><span className="font-display text-[64px] font-extrabold leading-[0.9] tracking-[-0.06em]">{count.toLocaleString("en")}</span><span className="font-display text-[28px] font-bold text-[#0D0D0D80]">/ {threshold.toLocaleString("en")}</span></p>
        ) : <p className="text-center font-label text-[12px] tracking-[0.14em] text-[#0D0D0DB3]">AT {threshold.toLocaleString("en")} CONNECTIONS</p>}
        <p className="text-center text-[15px] leading-[1.5] text-[#0D0D0DB3]">{left.toLocaleString("en")} more {left === 1 ? "person" : "people"}. Every real Connection moves this forward.</p>
        {rewards.length > 0 && (
          <div className="flex flex-col border-t border-[#0D0D0D1F]">
            <span className="pb-1 pt-3 font-label text-[10.5px] tracking-[0.14em] text-[#0D0D0DB3]">WAITING INSIDE</span>
            <ul className="flex list-none flex-col">
              {rewards.map((reward, index) => (
                <li className={`flex min-h-11 items-center justify-between ${index < rewards.length - 1 ? "border-b border-[#0D0D0D1F]" : ""}`} key={reward.id}><span className="text-[15px] font-semibold">{reward.name}</span><span className="font-label text-[10.5px] tracking-[0.12em] text-[#0D0D0DB3]">AT {threshold.toLocaleString("en")}</span></li>
              ))}
            </ul>
          </div>
        )}
        <Link className={`${pillInk} h-[52px] text-[15px]`} href="/app/tap">Show Quick QR</Link>
      </div>
    </PassportSheet>
  );
}

/** Newly earned (10): the page slides up, the stamp is pressed, the ink settles. No confetti, no sound. */
function PressDialog({ milestone, onDone, onView }: { milestone: MilestoneRecord; onDone: () => void; onView?: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const name = milestoneName(milestone.threshold);
  const index = MILESTONES.findIndex((item) => item.threshold === milestone.threshold);

  const acknowledge = useCallback(async (view = false) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const { error } = await createClient().rpc("ack_passport_milestone", { p_threshold: milestone.threshold });
      if (!error) { onDone(); if (view) onView?.(); }
    } catch {
      // Stay open so the owner can retry without losing the moment.
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [milestone.threshold, onDone, onView]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); void acknowledge(); return; }
      trapTab(event, panel.current);
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [acknowledge]);

  return (
    <div className="fixed inset-0 z-[95] flex items-stretch justify-center sm:items-center sm:p-6" data-passport-press={milestone.threshold}>
      <div aria-hidden="true" className="absolute inset-0 hidden bg-[#0D0D0D8C] [animation:fade-in_200ms_ease-out] sm:block" />
      <section
        aria-labelledby="press-title"
        aria-modal="true"
        className="relative flex w-full flex-col gap-[26px] overflow-y-auto bg-[#0D0D0D] px-7 pb-[calc(34px+env(safe-area-inset-bottom))] pt-[calc(28px+env(safe-area-inset-top))] text-[#F5F4EF] outline-none [animation:passport-page-up_320ms_cubic-bezier(.2,.8,.2,1)_both] sm:max-h-[calc(100dvh-48px)] sm:max-w-[420px] sm:rounded-[36px] sm:pt-8"
        ref={panel}
        role="dialog"
        tabIndex={-1}
      >
        <span className="font-label text-[12px] tracking-[0.2em] text-[#FF5A4F]">NEW STAMP · {String(index + 1).padStart(2, "0")} OF {String(MILESTONES.length).padStart(2, "0")}</span>
        <div className="relative flex h-[310px] flex-none items-center justify-center overflow-hidden rounded-[6px_18px_18px_6px] bg-[#F5F4EF]">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[18px] border-r border-[#0D0D0D1F]" />
          <span aria-hidden="true" className="absolute left-[34px] right-4 top-[18px] flex justify-between font-label text-[9.5px] tracking-[0.14em] text-[#0D0D0D99]"><span>PAGE {String(index + 1).padStart(2, "0")}</span><span>{pageDate(milestone.unlockedAt)}</span></span>
          <span className="block [animation:passport-press_260ms_cubic-bezier(.2,.9,.3,1)_both,passport-ink_400ms_260ms_ease-out_both] motion-reduce:[animation:none]">
            <PassportStamp rotation={0} size={210} sub={dayMark(milestone.unlockedAt).toUpperCase()} threshold={milestone.threshold} title={name} type="milestone" />
          </span>
        </div>
        <div className="flex flex-col gap-2 [animation:passport-rise_320ms_180ms_ease-out_both] motion-reduce:[animation:none]">
          <h2 className="font-display text-[52px] font-extrabold leading-[0.95] tracking-[-0.055em]" id="press-title">{name}</h2>
          <span className="text-[17px] font-semibold">{milestone.threshold.toLocaleString("en")} people. All real.</span>
          {earnedLong(milestone.unlockedAt) && <span className="font-label text-[12px] tracking-[0.1em] text-[#F5F4EFB3]">EARNED {earnedLong(milestone.unlockedAt)}</span>}
        </div>
        {alsoUnlocked(milestone.threshold) && <p className="text-[14.5px] leading-[1.5] text-[#F5F4EFCC] [animation:passport-rise_320ms_220ms_ease-out_both] motion-reduce:[animation:none]">{alsoUnlocked(milestone.threshold)}</p>}
        <div className="mt-auto flex flex-col gap-2.5">
          <button className="flex h-[52px] items-center justify-center rounded-full bg-[#FF5A4F] text-[16px] font-semibold text-[#0D0D0D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4EF] disabled:opacity-70" disabled={saving} onClick={() => void acknowledge(true)} type="button">{saving ? "Saving…" : "View Passport"}</button>
          <button className="flex h-12 items-center justify-center rounded-full border-[1.5px] border-[#F5F4EF55] text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4EF] disabled:opacity-70" disabled={saving} onClick={() => void acknowledge()} type="button">Keep going</button>
        </div>
      </section>
    </div>
  );
}

/** The same press moment for surfaces outside Passport (the Identity editor). */
export function CelebrationClient({ threshold }: { threshold: number | null; name?: string | null }) {
  const [open, setOpen] = useState(Boolean(threshold));
  const router = useRouter();
  if (!open || !threshold) return null;
  return <PressDialog milestone={{ threshold, unlockedAt: "", seenAt: null }} onDone={() => setOpen(false)} onView={() => router.push("/app/passport")} />;
}
