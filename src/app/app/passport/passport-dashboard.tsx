"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";

import { PassportStamp, type PassportStampStatus, type PassportStampType } from "@/components/passport/passport-stamp";
import { createClient } from "@/lib/supabase/client";
import { MILESTONES, PASSPORT_REWARDS, type RewardCategory } from "@/lib/passport/rewards";
import { hasCapability } from "@/lib/billing/capabilities";
import type { PlanCode } from "@/lib/billing/catalog";

type MilestoneRecord = { threshold: number; unlockedAt: string; seenAt: string | null };
export type PassportStampRecord = {
  id: string;
  type: PassportStampType;
  key?: string;
  title: string;
  subtitle: string | null;
  countryCode: string | null;
  earnedAt: string;
};
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

type CoverId = "standard" | "paper_passport_cover" | "century_cover" | "thousand_cover";
type PassportView = "passport" | "journey" | "make-it-yours";
type StampFilter = "all" | PassportStampType;

const coverCatalog: { id: CoverId; title: string; threshold: number | null; description: string; paper: string; ink: string; accent: string }[] = [
  { id: "standard", title: "Standard", threshold: null, description: "The Setuvara Passport, always yours.", paper: "#0D0D0D", ink: "#F5F4EF", accent: "#FF5A4F" },
  { id: "paper_passport_cover", title: "Paper Passport", threshold: 5, description: "A warm paper cover, earned at First Circle.", paper: "#E8E2D4", ink: "#0D0D0D", accent: "#FF5A4F" },
  { id: "century_cover", title: "Century", threshold: 100, description: "A signal coral cover, earned at Century.", paper: "#FF5A4F", ink: "#0D0D0D", accent: "#F5F4EF" },
  { id: "thousand_cover", title: "Thousand", threshold: 1000, description: "An ink cover with a lime edge, earned at Thousand Met.", paper: "#0D0D0D", ink: "#F5F4EF", accent: "#C7FF4A" },
];

const categoryNames: Record<RewardCategory, string> = {
  profile_treatment: "Profile treatment",
  accent: "Profile accent",
  share_treatment: "Share treatment",
  qr_frame: "QR frame",
  passport_cover: "Passport cover",
  passport_stamp_style: "Stamp style",
  profile_mark: "Profile mark",
};

const views: { id: PassportView; label: string }[] = [
  { id: "passport", label: "The Passport" },
  { id: "journey", label: "The journey" },
  { id: "make-it-yours", label: "Make it yours" },
];

const stampFilters: { id: StampFilter; label: string }[] = [
  { id: "all", label: "All stamps" },
  { id: "milestone", label: "Milestones" },
  { id: "event", label: "Events" },
  { id: "city", label: "Cities" },
  { id: "country", label: "Countries" },
];

export function PassportDashboard({
  initialData,
  username,
  displayName,
  publicOrigin,
  plan,
}: {
  initialData: PassportData;
  username: string;
  displayName: string;
  publicOrigin: string;
  plan: PlanCode;
}) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<PassportView>("passport");
  const [filter, setFilter] = useState<StampFilter>("all");
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const memberPlan = hasCapability(plan, "passport.premium_treatment");
  const memberFinishVisible = memberPlan && data.presentation.memberFinishEnabled !== false;
  const finishColor = plan === "pro" ? "#C7FF4A" : "#FF5A4F";
  const unlockedRewards = useMemo(() => new Set(data.rewards.map((reward) => reward.id)), [data.rewards]);
  const currentCover = coverCatalog.find((cover) => cover.id === data.presentation.coverId) ?? coverCatalog[0];
  const publicProfileUrl = `${publicOrigin}/${username}`;
  const selectedFeatured = data.presentation.featuredStamp;
  const lastStamp = data.stamps.at(-1);
  const filteredStamps = filter === "all" ? data.stamps : data.stamps.filter((stamp) => stamp.type === filter);

  const updatePresentation = useCallback(async (action: "cover" | "finish" | "featured", value: string | boolean | null) => {
    setPending(action);
    setNotice("");
    let result;
    try {
      const supabase = createClient();
      result = action === "cover"
        ? await supabase.rpc("set_passport_cover", { p_cover_id: String(value) })
        : action === "finish"
          ? await supabase.rpc("set_passport_member_finish", { p_enabled: Boolean(value) })
          : await supabase.rpc("set_passport_featured_stamp", { p_stamp_id: value as string | null });
    } catch {
      setNotice("That choice could not be saved. Your earned Passport stays safe.");
      setPending(null);
      return;
    }
    setPending(null);
    if (result.error) {
      setNotice("That choice could not be saved. Your earned Passport stays safe.");
      return;
    }

    if (action === "cover") {
      setData((current) => ({ ...current, presentation: { ...current.presentation, coverId: value as CoverId } }));
      setNotice("Passport cover saved.");
    } else if (action === "finish") {
      setData((current) => ({ ...current, presentation: { ...current.presentation, memberFinishEnabled: Boolean(value) } }));
      setNotice(Boolean(value) ? "Member finish saved." : "Member finish turned off.");
    } else {
      const stamp = value ? data.stamps.find((item) => item.id === value) ?? (selectedFeatured?.id === value ? selectedFeatured : null) : null;
      setData((current) => ({
        ...current,
        presentation: { ...current.presentation, featuredStampId: value as string | null, featuredStamp: stamp },
      }));
      setNotice(value ? "Your public highlight is saved." : "Public highlight cleared.");
    }
  }, [data.stamps, selectedFeatured]);

  async function loadMoreStamps() {
    if (!lastStamp || !data.hasMoreStamps || loadingMore) return;
    setLoadingMore(true);
    setNotice("");
    let result: unknown;
    let error: unknown;
    try {
      const response = await createClient().rpc("get_passport_stamp_page", {
        p_before_earned_at: lastStamp.earnedAt,
        p_before_id: lastStamp.id,
        p_limit: 50,
      });
      result = response.data;
      error = response.error;
    } catch (requestError) {
      error = requestError;
    }
    setLoadingMore(false);
    if (error || !result || typeof result !== "object") {
      setNotice("Older stamps could not load just now. Try again in a moment.");
      return;
    }

    const page = result as { items?: PassportStampRecord[]; hasMore?: boolean };
    const received = Array.isArray(page.items) ? page.items : [];
    setData((current) => ({
      ...current,
      stamps: appendUniqueStamps(current.stamps, received),
      hasMoreStamps: page.hasMore === true,
    }));
  }

  const dateLabel = data.stamps[0]?.earnedAt ? formatDate(data.stamps[0].earnedAt) : null;

  return (
    <main className="min-h-screen bg-[#F5F4EF] px-4 py-6 text-[#0D0D0D] sm:px-7 sm:py-9 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-black/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-label text-[10px] font-semibold tracking-[0.22em] text-black/50">SETUVARA · PRIVATE BY DEFAULT</p>
            <h1 className="mt-2 font-display text-[clamp(2.2rem,5vw,4.1rem)] font-bold leading-[.95] tracking-[-0.065em]">Your Passport</h1>
          </div>
          <nav aria-label="Passport sections" className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-black/10 bg-white p-1">
            {views.map((item) => (
              <button
                aria-current={view === item.id ? "page" : undefined}
                className={`min-h-11 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${view === item.id ? "bg-[#0D0D0D] text-[#F5F4EF]" : "text-black/65 hover:bg-black/5 hover:text-black"}`}
                key={item.id}
                onClick={() => { setView(item.id); setNotice(""); }}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        {view === "passport" && (
          <div className="space-y-12 pb-12 pt-7 sm:pt-9">
            <section aria-labelledby="passport-opening" className="grid items-center gap-8 rounded-[2rem] bg-[#E8E2D4] p-5 sm:p-8 lg:grid-cols-[minmax(260px,340px)_1fr] lg:gap-14 lg:p-12">
              <div className="mx-auto">
                <PassportCover
                  cover={currentCover}
                  displayName={displayName}
                  username={username}
                  connectionCount={data.connectionCount}
                  finishColor={memberFinishVisible ? finishColor : null}
                  finishTier={memberFinishVisible ? plan : null}
                  selectedStamp={selectedFeatured}
                />
              </div>
              <div className="min-w-0">
                <p className="font-label text-[10px] font-semibold tracking-[0.22em] text-black/50">A RECORD OF REAL CONNECTIONS</p>
                <h2 className="mt-3 max-w-[15ch] font-display text-4xl font-bold leading-[.96] tracking-[-0.055em] sm:text-5xl" id="passport-opening">Your people. Your places. Your story.</h2>
                <div className="mt-8 flex flex-wrap items-end gap-x-4 gap-y-1">
                  <strong className="font-display text-[clamp(4rem,11vw,7.5rem)] font-bold leading-[.72] tracking-[-0.085em] tabular-nums">{data.connectionCount.toLocaleString()}</strong>
                  <span className="pb-1 text-[15px] font-semibold">{data.connectionCount === 1 ? "person met" : "people met"}</span>
                </div>
                <MilestoneLine data={data} />
                <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-black/15 pt-5 font-label text-[10px] font-semibold tracking-[0.12em] text-black/60">
                  <span>{data.cities} {data.cities === 1 ? "CITY" : "CITIES"}</span>
                <span>{data.events} {data.events === 1 ? "EVENT" : "EVENTS"}</span>
                  <span>{data.countries} {data.countries === 1 ? "COUNTRY" : "COUNTRIES"}</span>
                  <span>{data.stampTotal.toLocaleString()} {data.stampTotal === 1 ? "STAMP" : "STAMPS"}</span>
                </div>
                <p className="mt-6 max-w-xl text-[15px] leading-6 text-black/60">Every number begins with a real Connection. Your milestones and stamps belong to you, and stay private unless you choose one mark to share.</p>
                <button className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#0D0D0D] px-5 text-sm font-semibold text-[#F5F4EF] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => setView("make-it-yours")} type="button">Make it yours <span aria-hidden="true">↗</span></button>
                {dateLabel && <p className="mt-4 font-label text-[9px] tracking-[0.14em] text-black/45">MOST RECENT MARK · {dateLabel.toUpperCase()}</p>}
              </div>
            </section>

            <section aria-labelledby="milestone-line-heading">
              <SectionEyebrow>THE LINE</SectionEyebrow>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <h2 className="font-display text-3xl font-bold tracking-[-0.045em]" id="milestone-line-heading">A long way, one person at a time.</h2>
                <span className="max-w-sm text-sm text-black/55">Milestones count unique Connections, never repeat encounters.</span>
              </div>
              <MilestoneLine data={data} expanded />
            </section>

            <section aria-labelledby="stamps-heading" className="border-t border-black/15 pt-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <SectionEyebrow>THE COLLECTION</SectionEyebrow>
                  <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.045em]" id="stamps-heading">Marks from your journey.</h2>
                </div>
                <div aria-label="Filter stamps" className="flex max-w-full gap-1 overflow-x-auto pb-1" role="group">
                  {stampFilters.map((item) => (
                    <button aria-pressed={filter === item.id} className={`min-h-10 shrink-0 rounded-full border px-3.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${filter === item.id ? "border-[#0D0D0D] bg-[#0D0D0D] text-[#F5F4EF]" : "border-black/15 bg-transparent text-black/65 hover:bg-white"}`} key={item.id} onClick={() => setFilter(item.id)} type="button">{item.label}</button>
                  ))}
                </div>
              </div>
              {filteredStamps.length ? (
                <ul className="mt-6 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredStamps.map((stamp) => (
                    <li key={stamp.id}>
                      <StampCard stamp={stamp} status={stampStatus(stamp, data.milestones)} featured={stamp.id === data.presentation.featuredStampId} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-black/20 bg-white/45 px-6 py-10">
                  <p className="font-display text-xl font-semibold tracking-tight">Your first stamp is waiting.</p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-black/55">A saved meeting can add an event, city, or country. We only make a mark from context you choose to share.</p>
                </div>
              )}
              {data.hasMoreStamps && <button className="mt-6 min-h-12 rounded-full border border-black/20 bg-white px-5 text-sm font-semibold hover:bg-[#E8E2D4] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60" disabled={loadingMore} onClick={() => void loadMoreStamps()} type="button">{loadingMore ? "Loading older stamps…" : `Load older stamps · ${Math.max(0, data.stampTotal - data.stamps.length)} left`}</button>}
            </section>
          </div>
        )}

        {view === "journey" && <JourneyView stamps={data.stamps} milestones={data.milestones} hasMore={data.hasMoreStamps} total={data.stampTotal} loadingMore={loadingMore} onLoadMore={() => void loadMoreStamps()} />}

        {view === "make-it-yours" && (
          <div className="space-y-12 pb-12 pt-7 sm:pt-9">
            <section className="max-w-3xl">
              <SectionEyebrow>YOUR COPY, YOUR CHARACTER</SectionEyebrow>
              <h2 className="mt-2 font-display text-4xl font-bold leading-[.95] tracking-[-0.06em] sm:text-5xl">A little more like you.</h2>
              <p className="mt-4 max-w-2xl text-[15px] leading-6 text-black/60">Your achievements belong to every plan. Choose how your private Passport looks, then share only a single stamp if you want it on your profile.</p>
            </section>

            <section aria-labelledby="cover-choices-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><SectionEyebrow>THE COVER</SectionEyebrow><h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]" id="cover-choices-heading">Earned by the people you meet.</h3></div>
                <p className="text-sm text-black/55">No cover is locked behind a paid plan.</p>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {coverCatalog.map((cover) => {
                  const earned = cover.id === "standard" || unlockedRewards.has(cover.id);
                  const selected = data.presentation.coverId === cover.id;
                  const status: PassportStampStatus = earned ? "earned" : "locked";
                  return (
                    <article className={`rounded-[1.5rem] border p-4 ${selected ? "border-[#FF5A4F] bg-white ring-1 ring-[#FF5A4F]/60" : "border-black/10 bg-white/65"}`} key={cover.id}>
                      <div className="mx-auto max-w-[190px]"><PassportCover cover={cover} displayName={displayName} username={username} connectionCount={data.connectionCount} finishColor={memberFinishVisible ? finishColor : null} finishTier={memberFinishVisible ? plan : null} selectedStamp={selectedFeatured} compact /></div>
                      <h4 className="mt-4 text-base font-semibold">{cover.title}</h4>
                      <p className="mt-1 min-h-10 text-xs leading-5 text-black/55">{earned ? cover.description : `Unlock at ${cover.threshold} unique Connections.`}</p>
                      {earned ? (
                        <button aria-pressed={selected} className={`mt-3 min-h-11 w-full rounded-full px-4 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${selected ? "bg-[#0D0D0D] text-[#F5F4EF]" : "border border-black/15 hover:bg-[#F5F4EF]"}`} disabled={pending !== null || selected} onClick={() => void updatePresentation("cover", cover.id)} type="button">{selected ? "On your Passport" : pending === "cover" ? "Saving…" : "Choose this cover"}</button>
                      ) : (
                        <p className="mt-3 flex min-h-11 items-center rounded-full border border-dashed border-black/20 px-4 text-xs font-semibold text-black/55"><span aria-hidden="true" className="mr-2">◌</span>{cover.threshold} Connections to unlock</p>
                      )}
                      <span className="sr-only">{status === "locked" ? "Locked cover" : selected ? "Selected cover" : "Earned cover"}</span>
                    </article>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="member-finish-heading" className="grid gap-6 rounded-[1.75rem] bg-[#0D0D0D] p-6 text-[#F5F4EF] sm:grid-cols-[minmax(220px,280px)_1fr] sm:items-center sm:p-8">
              <div className="mx-auto w-full max-w-[240px]"><PassportCover cover={currentCover} displayName={displayName} username={username} connectionCount={data.connectionCount} finishColor={finishColor} finishTier={memberPlan ? plan : null} compact /></div>
              <div>
                <SectionEyebrow dark>MEMBER FINISH</SectionEyebrow>
                <h3 className="mt-2 font-display text-3xl font-bold tracking-[-0.05em]" id="member-finish-heading">A quiet edge around your cover.</h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">Plus and Pro add a coral or lime edge to any cover. Your choice stays saved if your plan changes; the finish only appears while membership is active.</p>
                {memberPlan ? (
                  <button aria-checked={memberFinishVisible} className={`mt-5 inline-flex min-h-12 items-center gap-3 rounded-full border px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C7FF4A] ${memberFinishVisible ? "border-white bg-white text-[#0D0D0D]" : "border-white/30 text-white hover:bg-white/10"}`} disabled={pending === "finish"} onClick={() => void updatePresentation("finish", !memberFinishVisible)} role="switch" type="button"><span aria-hidden="true">{memberFinishVisible ? "●" : "○"}</span>{pending === "finish" ? "Saving…" : memberFinishVisible ? "Member finish on" : "Add Member finish"}</button>
                ) : (
                  <div className="mt-5">
                    <Link className="inline-flex min-h-12 items-center rounded-full bg-[#FF5A4F] px-5 text-sm font-semibold text-[#0D0D0D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" href="/pricing">See Plus and Pro</Link>
                    {data.presentation.memberFinishEnabled === true && <p className="mt-3 text-xs text-white/60">Your saved choice will return when your membership is active.</p>}
                  </div>
                )}
              </div>
            </section>

            <section aria-labelledby="featured-stamp-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><SectionEyebrow>ONE PUBLIC MARK</SectionEyebrow><h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]" id="featured-stamp-heading">Choose one stamp to share.</h3></div>
                <p className="max-w-lg text-sm leading-5 text-black/55">Your count, full collection, and history remain private. Only your deliberate choice appears on a published profile.</p>
              </div>
              <div className="mt-5 rounded-[1.5rem] border border-black/10 bg-white p-5 sm:p-6">
                {selectedFeatured ? <div className="flex items-center gap-4"><PassportStamp type={selectedFeatured.type} title={selectedFeatured.title} subtitle={selectedFeatured.subtitle} status="earned" rotationKey={selectedFeatured.key ?? selectedFeatured.id} /><div><p className="font-label text-[9px] font-semibold tracking-[0.18em] text-black/45">CURRENTLY SELECTED</p><p className="mt-1 text-lg font-semibold">{stampTitle(selectedFeatured)}</p><p className="mt-1 text-sm text-black/55">This is the only Passport stamp shared publicly.</p></div></div> : <p className="text-sm text-black/55">No stamp is shared. Your collection remains private.</p>}
                {memberPlan ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {selectedFeatured && <button className="min-h-11 rounded-full border border-black/15 px-4 text-xs font-semibold hover:bg-[#F5F4EF] focus-visible:outline-2" disabled={pending === "featured"} onClick={() => void updatePresentation("featured", null)} type="button">Remove public mark</button>}
                    {data.stamps.map((stamp) => <button aria-pressed={data.presentation.featuredStampId === stamp.id} className={`min-h-11 rounded-full border px-4 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${data.presentation.featuredStampId === stamp.id ? "border-[#FF5A4F] bg-[#FFF0EE]" : "border-black/15 hover:bg-[#F5F4EF]"}`} disabled={pending === "featured" || data.presentation.featuredStampId === stamp.id} key={stamp.id} onClick={() => void updatePresentation("featured", stamp.id)} type="button">{stampTitle(stamp)}</button>)}
                    {data.stamps.length === 0 && <p className="text-sm text-black/55">Your first stamp will appear here when a real meeting gives it a place.</p>}
                  </div>
                ) : (
                  <div className="mt-5 flex flex-wrap items-center gap-4"><p className="text-sm text-black/55">Featured Passport stamps are included with Plus and Pro.</p><Link className="inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-4 text-xs font-semibold text-white focus-visible:outline-2" href="/pricing">See plans</Link></div>
                )}
              </div>
            </section>

            <section aria-labelledby="earned-treatments-heading" className="border-t border-black/15 pt-8">
              <div className="flex flex-wrap items-end justify-between gap-4"><div><SectionEyebrow>IDENTITY TREATMENTS</SectionEyebrow><h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]" id="earned-treatments-heading">Your earned Setuvara marks.</h3></div><Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/app/identity?mode=personal&section=appearance">Open Appearance</Link></div>
              <ul className="mt-5 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {PASSPORT_REWARDS.filter((reward) => reward.category !== "passport_cover").map((reward) => {
                  const earned = unlockedRewards.has(reward.id);
                  const selected = data.preferences[reward.category] === reward.id;
                  return <li className="rounded-[1.25rem] border border-black/10 bg-white p-4" key={reward.id}><div className="flex items-start justify-between gap-3"><div><h4 className="text-sm font-semibold">{reward.name}</h4><p className="mt-1 text-xs text-black/50">{categoryNames[reward.category]}</p></div><span className={`font-label text-[9px] font-semibold tracking-[0.1em] ${earned ? "text-[#1C6E5B]" : "text-black/45"}`}>{earned ? selected ? "EQUIPPED" : "EARNED" : `AT ${reward.milestone}`}</span></div><p className="mt-3 text-xs leading-5 text-black/55">{reward.description}</p></li>;
                })}
              </ul>
            </section>

            <SharePassportCard profileUrl={publicProfileUrl} displayName={displayName} />
          </div>
        )}

        <p aria-live="polite" className="min-h-6 text-sm text-black/60" role="status">{notice}</p>
      </div>
    </main>
  );
}

function PassportCover({
  cover,
  displayName,
  username,
  connectionCount,
  finishColor,
  finishTier,
  selectedStamp,
  compact = false,
}: {
  cover: (typeof coverCatalog)[number];
  displayName: string;
  username: string;
  connectionCount: number;
  finishColor: string | null;
  finishTier: PlanCode | null;
  selectedStamp?: PassportStampRecord | null;
  compact?: boolean;
}) {
  const featured = selectedStamp;
  return (
    <div
      aria-label={`${cover.title} Setuvara Passport cover for ${displayName}`}
      className={`relative isolate flex aspect-[5/7] ${compact ? "w-full" : "w-[min(74vw,300px)]"} flex-col justify-between overflow-hidden p-6 shadow-[0_20px_48px_rgba(13,13,13,.18)] sm:p-7`}
      data-passport-cover={cover.id}
      data-member-finish={finishColor ? "active" : "off"}
      data-passport-finish={finishTier ?? "standard"}
      style={{
        backgroundColor: cover.paper,
        color: cover.ink,
        clipPath: "polygon(0 0,100% 0,100% calc(100% - 24px),calc(100% - 14px) 100%,0 100%)",
        boxShadow: finishColor ? `inset 0 0 0 3px ${finishColor}, 0 20px 48px rgba(13,13,13,.18)` : "0 20px 48px rgba(13,13,13,.18)",
      }}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-5 w-px opacity-25" style={{ backgroundColor: cover.accent }} />
      <header className="relative flex items-start justify-between gap-2 border-b pb-3" style={{ borderColor: `${cover.ink}30` }}>
        <span className="font-display text-lg font-extrabold tracking-[-0.06em]">setuvara</span>
        <span className="pt-1 font-label text-[8px] font-semibold tracking-[0.16em] opacity-60">PRIVATE RECORD</span>
      </header>
      <div className="relative flex flex-1 flex-col justify-center py-6 text-center">
        <p className="font-label text-[9px] font-semibold tracking-[0.24em] opacity-65">SETUVARA PASSPORT</p>
        <p className={`mt-3 break-words font-display font-bold leading-[.95] tracking-[-0.055em] ${compact ? "text-2xl" : "text-[2rem]"}`}>{displayName || `@${username}`}</p>
        <p className="mt-2 break-all font-label text-[9px] tracking-[0.1em] opacity-60">@{username}</p>
      </div>
      <footer className="relative flex items-end justify-between gap-3 border-t pt-3" style={{ borderColor: `${cover.ink}30` }}>
        <div className="min-w-0">
          <p className="font-label text-[8px] font-semibold tracking-[0.16em] opacity-60">ONE IDENTITY</p>
          <p className="mt-1 font-display text-lg font-bold leading-none tracking-tight">{connectionCount.toLocaleString()} <span className="font-sans text-[10px] font-medium">met</span></p>
        </div>
        {featured && <PassportStamp type={featured.type} title={featured.title} subtitle={featured.subtitle} size="small" rotationKey={featured.key ?? featured.id} />}
      </footer>
    </div>
  );
}

function MilestoneLine({ data, expanded = false }: { data: PassportData; expanded?: boolean }) {
  const next = MILESTONES.find((item) => item.threshold > data.connectionCount);
  const prior = [...MILESTONES].reverse().find((item) => item.threshold <= data.connectionCount)?.threshold ?? 0;
  const progress = next ? Math.max(0, Math.min(100, ((data.connectionCount - prior) / (next.threshold - prior)) * 100)) : 100;
  const remaining = next ? Math.max(0, next.threshold - data.connectionCount) : 0;
  const statusFor = (threshold: number) => threshold <= data.connectionCount ? "earned" : threshold === next?.threshold ? "progress" : "locked";
  const milestones = (
    <ol className={`relative grid list-none grid-cols-4 gap-x-2 gap-y-4 p-0 sm:grid-cols-8 ${expanded ? "mt-7" : "mt-6"}`}>
      <span aria-hidden="true" className="absolute left-3 right-3 top-[13px] hidden h-px bg-black/20 sm:block" />
      {MILESTONES.map((milestone) => {
        const state = statusFor(milestone.threshold);
        return <li className="relative flex min-w-0 flex-col items-center text-center" data-milestone-state={state} key={milestone.threshold}>
          <span aria-hidden="true" className={`z-10 grid size-[27px] place-items-center rounded-full border text-[10px] font-bold ${state === "earned" ? "border-[#0D0D0D] bg-[#0D0D0D] text-[#C7FF4A]" : state === "progress" ? "border-[#FF5A4F] bg-[#FF5A4F] text-[#0D0D0D]" : "border-black/25 bg-[#F5F4EF] text-black/35"}`}>{state === "earned" ? "✓" : state === "progress" ? "·" : ""}</span>
          <span className={`mt-2 font-label text-[9px] font-bold tracking-[0.08em] ${state === "locked" ? "text-black/35" : "text-black/70"}`}>{milestone.threshold.toLocaleString()}</span>
          <span className="mt-0.5 max-w-full text-[10px] leading-4 text-black/50">{milestone.label}</span>
        </li>;
      })}
    </ol>
  );

  return (
    <div className={expanded ? "mt-7 rounded-[1.5rem] bg-white/65 p-5 sm:p-6" : "mt-7"}>
      {expanded && <p className="font-label text-[9px] font-semibold tracking-[0.18em] text-black/45">UNIQUE CONNECTIONS · NEVER A LEADERBOARD</p>}
      {milestones}
      {next ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">{remaining} {remaining === 1 ? "person" : "people"} to {next.name}.</p>
          <div aria-label={`${data.connectionCount} of ${next.threshold} Connections to ${next.name}`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(progress)} className="h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-black/10" role="progressbar"><div className="h-full rounded-full bg-[#FF5A4F] transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div>
        </div>
      ) : <p className="mt-4 text-sm font-semibold">Thousand Met. Your record keeps growing.</p>}
    </div>
  );
}

function StampCard({ stamp, status, featured = false }: { stamp: PassportStampRecord; status: PassportStampStatus; featured?: boolean }) {
  return (
    <article className={`flex min-h-[150px] items-center gap-4 rounded-[1.5rem] border p-4 sm:p-5 ${featured ? "border-[#FF5A4F] bg-white" : "border-black/10 bg-white/65"}`} data-passport-stamp-card={stamp.type}>
      <PassportStamp type={stamp.type} title={stampTitle(stamp)} subtitle={stamp.subtitle} status={status} rotationKey={stamp.key ?? stamp.id} />
      <div className="min-w-0 flex-1">
        <p className="font-label text-[9px] font-semibold tracking-[0.17em] text-black/45">{stamp.type.toUpperCase()} STAMP{featured ? " · PUBLIC HIGHLIGHT" : ""}</p>
        <h3 className="mt-1 break-words text-base font-semibold leading-5">{stampTitle(stamp)}</h3>
        {stamp.subtitle && <p className="mt-1 break-words text-xs leading-5 text-black/55">{humanizeSubtitle(stamp)}</p>}
        <p className="mt-3 font-label text-[9px] tracking-[0.12em] text-black/40">{formatDate(stamp.earnedAt).toUpperCase()}</p>
      </div>
    </article>
  );
}

function JourneyView({ stamps, milestones, hasMore, total, loadingMore, onLoadMore }: { stamps: PassportStampRecord[]; milestones: MilestoneRecord[]; hasMore: boolean; total: number; loadingMore: boolean; onLoadMore: () => void }) {
  const yearGroups = useMemo(() => {
    const grouped = new Map<string, PassportStampRecord[]>();
    for (const stamp of stamps) {
      const year = Number.isFinite(Date.parse(stamp.earnedAt)) ? String(new Date(stamp.earnedAt).getFullYear()) : "Recorded";
      grouped.set(year, [...(grouped.get(year) ?? []), stamp]);
    }
    return [...grouped.entries()].sort(([yearA], [yearB]) => yearB.localeCompare(yearA, undefined, { numeric: true }));
  }, [stamps]);

  return (
    <section aria-labelledby="journey-heading" className="mx-auto max-w-5xl pb-12 pt-8 sm:pt-12">
      <SectionEyebrow>THE JOURNEY · {total.toLocaleString()} STAMPS</SectionEyebrow>
      <h2 className="mt-2 max-w-[14ch] font-display text-4xl font-bold leading-[.94] tracking-[-0.06em] sm:text-6xl" id="journey-heading">Every mark has a place in time.</h2>
      <p className="mt-4 max-w-2xl text-[15px] leading-6 text-black/60">This is a private timeline of your Passport stamps. It records only durable Connections and the context you chose to save.</p>
      {!stamps.length ? (
        <div className="mt-8 rounded-[1.5rem] border border-dashed border-black/20 bg-white/55 p-7"><p className="font-display text-xl font-semibold">Your journey starts with a real Connection.</p><p className="mt-2 text-sm text-black/55">When one is saved, its milestone and shared context can leave a permanent mark.</p></div>
      ) : (
        <div className="mt-9 space-y-10">
          {yearGroups.map(([year, records]) => <section aria-label={`Passport stamps from ${year}`} key={year}>
            <div className="flex items-baseline gap-4 border-b border-black/15 pb-3"><h3 className="font-display text-2xl font-bold tracking-[-0.04em]">{year}</h3><span className="font-label text-[9px] tracking-[0.13em] text-black/45">{records.length} {records.length === 1 ? "MARK" : "MARKS"}</span></div>
            <ol className="mt-5 grid list-none gap-3 p-0 sm:grid-cols-2">
              {records.map((stamp) => <li key={stamp.id}><StampCard stamp={stamp} status={stampStatus(stamp, milestones)} /></li>)}
            </ol>
          </section>)}
        </div>
      )}
      {hasMore && <button className="mt-7 min-h-12 rounded-full border border-black/20 bg-white px-5 text-sm font-semibold hover:bg-[#E8E2D4] focus-visible:outline-2 disabled:opacity-60" disabled={loadingMore} onClick={onLoadMore} type="button">{loadingMore ? "Loading older stamps…" : `Load older stamps · ${Math.max(0, total - stamps.length)} left`}</button>}
    </section>
  );
}

function SharePassportCard({ profileUrl, displayName }: { profileUrl: string; displayName: string }) {
  const [copied, setCopied] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  async function copyProfile() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setCopyMessage("Profile link copied.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyMessage("Copy is unavailable here. Select the profile link above to copy it.");
    }
  }

  return (
    <section className="grid gap-5 rounded-[1.75rem] bg-[#FF5A4F] p-6 text-[#0D0D0D] sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
      <div><SectionEyebrow>ONE IDENTITY · EVERY MOMENT</SectionEyebrow><h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.045em]">{displayName}’s Passport stays theirs.</h3><p className="mt-2 max-w-xl text-sm leading-6 text-black/65">Share your public identity when you are ready. The Passport remains private.</p><code className="mt-3 block break-all rounded-xl border border-black/15 bg-white/45 px-3 py-2 font-label text-[11px]">{profileUrl}</code><div className="mt-4 flex flex-wrap gap-3"><Link className="inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-4 text-sm font-semibold text-[#F5F4EF] focus-visible:outline-2 focus-visible:outline-offset-2" href={profileUrl}>Open my profile</Link><button className="inline-flex min-h-11 items-center rounded-full border border-black/30 px-4 text-sm font-semibold hover:bg-white/20 focus-visible:outline-2" onClick={() => void copyProfile()} type="button">{copied ? "Copied" : "Copy profile link"}</button></div><p aria-live="polite" className="mt-2 min-h-5 text-xs">{copyMessage}</p></div>
      <div aria-label="Your public Setuvara profile QR code" className="mx-auto rounded-2xl bg-white p-3 sm:mx-0"><QRCodeSVG value={profileUrl} size={132} level="Q" marginSize={2} /></div>
    </section>
  );
}

function SectionEyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <p className={`font-label text-[9px] font-semibold tracking-[0.2em] ${dark ? "text-white/50" : "text-black/45"}`}>{children}</p>;
}

function stampStatus(stamp: PassportStampRecord, milestones: MilestoneRecord[]): PassportStampStatus {
  if (stamp.type === "milestone") {
    const threshold = Number(stamp.key ?? stamp.subtitle?.match(/\d+/)?.[0]);
    const milestone = milestones.find((item) => item.threshold === threshold);
    if (milestone && !milestone.seenAt) return "new";
  }
  const earned = Date.parse(stamp.earnedAt);
  return Number.isFinite(earned) && Date.now() - earned < 14 * 24 * 60 * 60 * 1000 ? "new" : "earned";
}

function appendUniqueStamps(existing: PassportStampRecord[], incoming: PassportStampRecord[]) {
  const seen = new Set(existing.map((stamp) => stamp.id));
  return [...existing, ...incoming.filter((stamp) => !seen.has(stamp.id))];
}

function stampTitle(stamp: PassportStampRecord) {
  if (stamp.type === "country") return countryName(stamp.countryCode ?? stamp.title);
  return stamp.title;
}

function humanizeSubtitle(stamp: PassportStampRecord) {
  if (stamp.type === "city" && stamp.countryCode) {
    const pieces = (stamp.subtitle ?? "").split(" · ");
    const year = pieces.find((part) => /^\d{4}$/.test(part));
    return [countryName(stamp.countryCode), year].filter(Boolean).join(" · ");
  }
  if (stamp.type === "event" && stamp.countryCode) {
    return (stamp.subtitle ?? "").replace(stamp.countryCode, countryName(stamp.countryCode));
  }
  return stamp.subtitle ?? "";
}

function countryName(code: string) {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase(); }
  catch { return code.toUpperCase(); }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Recorded";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function CelebrationClient({ threshold, name }: { threshold: number | null; name: string | null }) {
  const [open, setOpen] = useState(Boolean(threshold));
  const [acknowledging, setAcknowledging] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  async function acknowledge() {
    if (!threshold || acknowledging) return;
    setAcknowledging(true);
    try {
      const { error } = await createClient().rpc("ack_passport_milestone", { p_threshold: threshold });
      if (!error) setOpen(false);
    } catch {
      // Keep the celebration open so the owner can retry without losing the milestone.
    } finally {
      setAcknowledging(false);
    }
  }

  if (!open || !threshold || !name) return null;
  return (
    <dialog aria-labelledby="milestone-heading" className="fixed m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-[2rem] border-0 bg-[#F5F4EF] p-6 text-[#0D0D0D] shadow-2xl backdrop:bg-[#0D0D0D]/60 sm:p-8" onCancel={(event) => { event.preventDefault(); void acknowledge(); }} onMouseDown={(event) => { if (event.target === event.currentTarget) void acknowledge(); }} ref={dialogRef}>
      <section className="grid gap-6 sm:grid-cols-[150px_1fr] sm:items-center">
        <div className="mx-auto"><PassportStamp type="milestone" title={name} subtitle={`${threshold} Connections`} status="new" size="large" rotationKey={String(threshold)} /></div>
        <div><SectionEyebrow>A REAL MILESTONE</SectionEyebrow><h2 className="mt-2 font-display text-4xl font-bold leading-[.95] tracking-[-0.06em]" id="milestone-heading">{threshold} people met.</h2><p className="mt-2 font-label text-[10px] font-bold tracking-[0.17em]">{name.toUpperCase()}</p><p className="mt-4 text-sm leading-6 text-black/60">This milestone is part of your Passport. Your count is private, and it never resets.</p><div className="mt-5 flex flex-wrap gap-3"><Link className="inline-flex min-h-11 items-center rounded-full bg-[#FF5A4F] px-4 text-sm font-semibold focus-visible:outline-2" href="/app/passport" onClick={() => void acknowledge()}>Open Passport</Link><button className="min-h-11 rounded-full border border-black/15 px-4 text-sm font-semibold focus-visible:outline-2" disabled={acknowledging} onClick={() => void acknowledge()} type="button">{acknowledging ? "Saving…" : "Keep going"}</button></div></div>
      </section>
    </dialog>
  );
}
