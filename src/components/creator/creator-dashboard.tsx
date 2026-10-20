import Link from "next/link";

import { analyticsCapabilities } from "@/lib/analytics/capabilities";
import { resolveAnalyticsQuery } from "@/lib/analytics/range";
import { getProfileAnalyticsReport, type ProfileAnalyticsReport } from "@/lib/analytics/server";
import type { PlanCode } from "@/lib/billing/catalog";
import { formatMoney, INQUIRY_BUDGET_LABEL, INQUIRY_KIND_LABEL, platformAccounts, PLATFORM_NAME, relativeTime, type CreatorPlatform, type WorkItem } from "@/lib/creator/studio";
import type { CreatorStudio } from "@/lib/creator/studio-server";
import { CreatorGreeting } from "./creator-greeting";
import { coralButton, inkButton, lineButton, Mono, PlatformTile } from "./studio-ui";

const MODES = [
  { slug: "personal", name: "Personal", dot: "#FF5A4F" },
  { slug: "event", name: "Event", dot: "#C7FF4A" },
  { slug: "business", name: "Business", dot: "#AFCBFF" },
  { slug: "creator", name: "Creator", dot: "#E8A6FF" },
] as const;
const SOURCE_SAY: Record<string, string> = { direct: "direct visits and search", link: "your shared link", share: "shares", native_share: "shares", qr: "QR scans", quick_qr: "Quick QR", tap: "Tap", profile: "Setuvara" };

export type Action = { title: string; sub: string; href: string; cta: string; urgent?: boolean };
export type Step = { title: string; sub: string; done: boolean; href: string; optional: boolean };

/** Home on Creator Mode: what happened, and what is worth doing next. */
export async function CreatorDashboard({ studio, plan }: { studio: CreatorStudio; plan: PlanCode }) {
  const { profile, settings, work, offers, inquiries, links } = studio;
  const firstName = profile.display_name.split(/\s+/)[0] || profile.display_name;
  const live = studio.mode.is_enabled && profile.is_published;

  const capabilities = analyticsCapabilities(plan);
  const resolved = capabilities.modeBreakdown ? resolveAnalyticsQuery(new URLSearchParams({ range: "7d", mode: "creator" }), capabilities) : null;
  let report: ProfileAnalyticsReport | null = null;
  if (resolved?.ok) {
    try { report = await getProfileAnalyticsReport({ profileId: studio.userId, plan, query: resolved.data }); } catch { report = null; }
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data: orderRows } = await studio.supabase.from("creator_orders").select("gross_amount_minor, currency, created_at").eq("creator_user_id", studio.userId).eq("status", "paid").gte("created_at", monthStart.toISOString()).order("created_at", { ascending: false });
  const orders = orderRows ?? [];
  const revenueCurrency = orders[0]?.currency ?? "EUR";
  const revenue = orders.filter((row) => row.currency === revenueCurrency).reduce((sum, row) => sum + Number(row.gross_amount_minor), 0);
  const days = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
  const perDay = Array.from({ length: Math.min(days, new Date().getUTCDate()) }, (_, day) => orders.filter((row) => new Date(row.created_at).getUTCDate() === day + 1).length);

  const accounts = platformAccounts(links).filter((item) => item.link);
  const liveOffers = offers.filter((offer) => offer.status === "active");
  const fresh = inquiries.filter((item) => item.status === "new");
  const pipeline = { new: fresh.length, in_talks: inquiries.filter((item) => item.status === "in_talks").length, booked: inquiries.filter((item) => item.status === "booked").length };
  const open = pipeline.new + pipeline.in_talks + pipeline.booked;
  const featured = work.find((item) => item.featured) ?? work[0] ?? null;

  const steps: Step[] = [
    { title: "Add a platform", sub: accounts.length ? accounts.map((item) => PLATFORM_NAME[item.platform]).join(", ") : "Instagram, TikTok, YouTube, Twitch or X", done: accounts.length > 0, href: "/app/identity?mode=creator&section=links", optional: false },
    { title: "Add 3 pieces of work", sub: work.length ? `${work.length} of 3 added` : "Films, photos or a link", done: work.length >= 3, href: "/app/identity/creator/work", optional: true },
    { title: "Add an offer", sub: "A product, booking or link", done: offers.length > 0, href: "/app/identity/creator/store", optional: true },
    { title: "Open for collabs", sub: "Adds a Work with me button", done: settings.collabsOpen, href: "/app/identity/creator/settings", optional: true },
  ];
  const stepsDone = steps.filter((step) => step.done).length;
  const firstRun = stepsDone < 2 && inquiries.length === 0;

  const actions: Action[] = [];
  if (!live) actions.push({ title: studio.mode.is_enabled ? "Publish your profile" : "Turn Creator on", sub: "Your page stays private until then", href: studio.mode.is_enabled ? "/app/settings" : "/app/identity/creator/settings?tab=visibility", cta: "Open", urgent: true });
  for (const item of fresh.slice(0, 2)) {
    actions.push({ title: `Reply to ${item.brand || item.sender_display_name}`, sub: [INQUIRY_KIND_LABEL[item.kind], INQUIRY_BUDGET_LABEL[item.budget], relativeTime(item.created_at)].join(" · "), href: `/app/identity/creator/collabs?inquiry=${item.id}`, cta: "Open", urgent: true });
  }
  for (const step of steps) if (!step.done) actions.push({ title: step.title, sub: step.sub, href: step.href, cta: step.title.startsWith("Open") ? "Open" : "Add" });
  if (work.length && !work.some((item) => item.featured)) actions.push({ title: "Feature one piece", sub: "It leads your page and your kit", href: "/app/identity/creator/work", cta: "Pick" });
  if (!studio.kit.updated_at) actions.push({ title: "Finish your media kit", sub: "Partners, rates and languages", href: "/app/identity/creator/kit", cta: "Open" });
  const today = actions.slice(0, 3);

  const opens = report?.summary.profileViews ?? null;
  const delta = report?.comparison.profileViewsDelta ?? null;
  const topSource = report?.sources.filter((row) => row.count > 0).sort((a, b) => b.count - a.count)[0]?.source;
  const story = opens !== null
    ? opens > 0
      ? `Your page was opened ${opens.toLocaleString("en")} times this week${delta !== null && Math.round(delta) !== 0 ? `, ${Math.abs(Math.round(delta))}% ${delta > 0 ? "more" : "less"} than last` : ""}.${topSource ? ` Most visits came from ${SOURCE_SAY[topSource as string] ?? topSource}.` : ""}`
      : "No one opened your page this week yet. Share it where your audience already is."
    : fresh.length
      ? `${fresh.length === 1 ? "A new collab inquiry is" : `${fresh.length} new collab inquiries are`} waiting for you.`
      : live ? "Your Creator page is live. Share it where your audience already is." : "Your Creator page is ready when you are.";

  const stats = [
    { label: "Page opens", value: opens === null ? "—" : opens.toLocaleString("en"), note: opens === null ? "Plus" : "7 days" },
    { label: "Work", value: String(work.length), note: "pieces" },
    { label: "Offers", value: String(liveOffers.length), note: "live" },
    { label: "Collabs", value: String(open), note: "open", hot: pipeline.new > 0 },
  ];

  return (
    <CreatorDashboardView
      data={{
        firstName,
        imageUrl: studio.imageUrl,
        focus: { x: studio.mode.image_focus_x ?? 50, y: studio.mode.image_focus_y ?? 35 },
        shareUrl: studio.shareUrl,
        enabled: studio.mode.is_enabled,
        story,
        stats,
        firstRun,
        steps,
        stepsDone,
        today,
        actionCount: Math.min(actions.length, 3),
        monthLabel: monthStart.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" }).toUpperCase(),
        revenue: formatMoney(revenue, revenueCurrency, { compact: true }),
        perDay,
        storeLine: orders.length ? `${orders.length} order${orders.length === 1 ? "" : "s"} · last ${relativeTime(orders[0].created_at)}` : liveOffers.length ? `${liveOffers.length} offer${liveOffers.length === 1 ? "" : "s"} live` : "No offers live yet",
        open,
        pipeline,
        collabsOpen: settings.collabsOpen,
        featured,
        accounts: accounts.map((item) => ({ platform: item.platform, handle: item.handle })),
      }}
    />
  );
}

export type CreatorDashboardData = {
  firstName: string;
  imageUrl: string | null;
  focus: { x: number; y: number };
  shareUrl: string | null;
  enabled: boolean;
  story: string;
  stats: { label: string; value: string; note: string; hot?: boolean }[];
  firstRun: boolean;
  steps: Step[];
  stepsDone: number;
  today: Action[];
  actionCount: number;
  monthLabel: string;
  revenue: string;
  perDay: number[];
  storeLine: string;
  open: number;
  pipeline: { new: number; in_talks: number; booked: number };
  collabsOpen: boolean;
  featured: WorkItem | null;
  accounts: { platform: CreatorPlatform; handle: string }[];
};

/** The dashboard itself, from plain data, so it renders the same in previews. */
export function CreatorDashboardView({ data }: { data: CreatorDashboardData }) {
  const { firstName, imageUrl, focus, shareUrl, enabled, story, stats, firstRun, steps, stepsDone, today, actionCount, monthLabel, revenue, perDay, storeLine, open, pipeline, collabsOpen, featured, accounts } = data;
  return (
    <main className="px-3.5 pb-6 pt-0.5 md:px-8 md:pb-8 lg:grid lg:min-h-[calc(100dvh-76px)] lg:grid-cols-[minmax(0,1.25fr)_minmax(400px,1fr)] lg:gap-6 lg:pt-1 min-[1800px]:gap-8">
      <h1 className="sr-only">Your Setuvara · Creator</h1>
      <section aria-label="Creator" className="relative isolate flex min-h-[340px] flex-col overflow-hidden rounded-[28px] bg-[#0D0D0D] text-[#F5F4EF] [clip-path:polygon(0_0,100%_0,100%_calc(100%-64px),calc(100%-36px)_100%,0_100%)] lg:min-h-0">
        {imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed owner photo, short lived */}
            <img alt="" className="absolute inset-0 -z-20 size-full object-cover" src={imageUrl} style={{ objectPosition: `${focus.x}% ${focus.y}%` }} />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(13,13,13,.45)_0%,rgba(13,13,13,0)_30%,rgba(13,13,13,.25)_55%,rgba(13,13,13,.92)_100%)]" />
          </>
        )}
        <div className="flex items-center justify-between gap-3 p-5 md:p-7">
          <ModeSwitch />
          {shareUrl
            ? <a className="hidden min-h-10 items-center gap-1.5 text-[15px] font-semibold hover:text-[#FF5A4F] md:inline-flex" href={shareUrl} rel="noreferrer" target="_blank">{shareUrl.replace(/^https?:\/\//, "")}<span aria-hidden="true">↗</span></a>
            : <Mono className="text-white/70">{enabled ? "UNPUBLISHED" : "OFF"}</Mono>}
        </div>
        <div className="mt-auto p-5 pt-16 md:p-9 md:pt-24">
          <p className="font-display text-[48px] font-bold leading-[0.92] tracking-[-0.06em] md:text-[72px] min-[1800px]:text-[88px]"><CreatorGreeting firstName={firstName} /></p>
          <p className="mt-4 max-w-[46ch] text-[16px] leading-[1.5] text-white/85 md:text-[19px]">{story}</p>
          <dl className="mt-6 grid grid-cols-4 gap-3 border-t border-white/20 pt-5 md:gap-6">
            {stats.map((item) => (
              <div className="min-w-0" key={item.label}>
                <dt className="font-label text-[10px] uppercase tracking-[0.14em] text-white/65 md:text-[11px]">{item.label}</dt>
                <dd className={`mt-1.5 font-display text-[28px] font-bold leading-none tracking-[-0.05em] md:text-[40px] ${item.hot ? "text-[#FF5A4F]" : ""}`}>{item.value}</dd>
                <dd className="mt-1 text-[12px] text-white/60">{item.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mt-6 flex min-h-0 flex-col gap-6 lg:mt-0">
        {firstRun ? <FirstRun steps={steps} done={stepsDone} /> : (
          <section aria-labelledby="worth-doing">
            <div className="flex items-baseline justify-between border-b-[1.5px] border-[#0D0D0D] pb-3">
              <h2 className="font-display text-[30px] font-bold leading-none tracking-[-0.05em] md:text-[36px]" id="worth-doing">Worth doing today</h2>
              {today.length > 0 && <Mono className="text-black/55">{today.length} OF {actionCount}</Mono>}
            </div>
            {today.length ? (
              <ol className="divide-y divide-black/10">
                {today.map((item, index) => (
                  <li key={item.title}>
                    <Link className="group flex min-h-[76px] items-center gap-4 py-3 focus-visible:outline-2" href={item.href}>
                      <span className={`w-6 shrink-0 font-display text-[28px] font-bold leading-none tracking-[-0.04em] ${item.urgent ? "text-[#FF5A4F]" : ""}`}>{index + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold">{item.title}</span><span className="block truncate text-[14px] text-black/65">{item.sub}</span></span>
                      <span className={`${index === 0 && item.urgent ? inkButton : lineButton} !min-h-10 max-md:!hidden`}>{item.cta}</span>
                      <span aria-hidden="true" className="text-[20px] text-black/40 md:hidden">›</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : <p className="py-5 text-[15px] text-black/60">Nothing waiting. Your page is in good shape.</p>}
          </section>
        )}

        <div className="grid grid-cols-2 gap-6 border-t border-black/10 pt-5 md:gap-8">
          <Link className="group min-w-0 focus-visible:outline-2" href="/app/identity/creator/store">
            <Mono className="text-black/55">STORE · {monthLabel}</Mono>
            <p className="mt-2 font-display text-[34px] font-bold leading-none tracking-[-0.05em] md:text-[44px]">{revenue}</p>
            <div aria-hidden="true" className="mt-3 flex h-10 items-end gap-[3px]">
              {perDay.map((count, index) => <span className="w-full max-w-[12px] rounded-[2px]" key={index} style={{ height: `${Math.max(8, (count / Math.max(...perDay, 1)) * 100)}%`, background: index === perDay.length - 1 ? "#FF5A4F" : count ? "#0D0D0D" : "rgba(13,13,13,.12)" }} />)}
            </div>
            <p className="mt-2 text-[13px] text-black/60">{storeLine}</p>
          </Link>
          <Link className="min-w-0 border-l border-black/10 pl-6 focus-visible:outline-2 md:pl-8" href="/app/identity/creator/collabs">
            <Mono className="text-black/55">COLLABS</Mono>
            <p className="mt-2 font-display text-[34px] font-bold leading-none tracking-[-0.05em] md:text-[44px]">{open}<span className="ml-2 font-sans text-[16px] font-semibold tracking-normal">open</span></p>
            <ul className="mt-3 grid gap-1.5 text-[14px]">
              {([["New", pipeline.new, "#FF5A4F"], ["In talks", pipeline.in_talks, "#B79CFF"], ["Booked", pipeline.booked, "#0D0D0D"]] as const).map(([label, count, dot]) => (
                <li className="flex items-center gap-2" key={label}><span aria-hidden="true" className="size-[7px] rounded-full" style={{ background: dot }} /><span className="flex-1">{label}</span><span className="tabular-nums">{count}</span></li>
              ))}
            </ul>
            {!collabsOpen && <p className="mt-2 text-[13px] text-black/60">Collabs are closed</p>}
          </Link>
        </div>

        {featured && (
          <Link className="mt-auto flex items-center gap-4 rounded-[22px] bg-[#E6E4DC] p-3 pr-5 focus-visible:outline-2" href="/app/identity/creator/work">
            <span className="relative block aspect-[4/3] w-[104px] shrink-0 overflow-hidden rounded-[14px] bg-[#0D0D0D] md:w-[120px]">
              {featured.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- signed owner media, short lived
                <img alt="" className="size-full object-cover" src={featured.imageUrl} />
              )}
              {featured.kind === "video" && <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-1.5 font-label text-[10px] text-white">▶</span>}
            </span>
            <span className="min-w-0 flex-1">
              <Mono className="text-black/55">{featured.featured ? "FEATURED WORK" : "LATEST WORK"}</Mono>
              <span className="mt-1 block truncate text-[16px] font-semibold">{featured.title || "Untitled"}</span>
              <span className="block truncate text-[14px] text-black/60">{[featured.credit, featured.collection].filter(Boolean).join(" · ") || "Open Work to edit"}</span>
            </span>
            <span aria-hidden="true" className="text-[20px]">→</span>
          </Link>
        )}

        {accounts.length > 0 && !firstRun && (
          <ul aria-label="Your platforms" className="flex flex-wrap gap-2">
            {accounts.map((item) => <li className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-[14px] font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" key={item.platform}><PlatformTile size={26} type={item.platform} />{item.handle}</li>)}
          </ul>
        )}
      </div>
    </main>
  );
}

function ModeSwitch() {
  return (
    <nav aria-label="Mode" className="flex gap-1 rounded-full bg-black/45 p-1 backdrop-blur-md">
      {MODES.map((mode) => {
        const on = mode.slug === "creator";
        return (
          <Link aria-current={on ? "page" : undefined} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold md:text-[14px] ${on ? "bg-[#F5F4EF] text-[#0D0D0D]" : "text-[#F5F4EF] hover:bg-white/10"} ${on ? "" : "max-md:px-2.5"}`} href={`/app?mode=${mode.slug}`} key={mode.slug}>
            <span aria-hidden="true" className="size-[7px] rounded-full" style={{ background: mode.dot }} />
            <span className={on ? "" : "max-md:sr-only"}>{mode.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function FirstRun({ steps, done }: { steps: Step[]; done: number }) {
  const next = steps.find((step) => !step.done);
  return (
    <section aria-labelledby="first-run">
      <Mono className="flex items-center gap-2 text-black/60"><span aria-hidden="true" className="size-[7px] rounded-full bg-[#B79CFF]" />CREATOR MODE IS ON</Mono>
      <h2 className="mt-3 font-display text-[40px] font-bold leading-[0.95] tracking-[-0.06em] md:text-[48px]" id="first-run">Your page starts with one link.</h2>
      <p className="mt-3 max-w-[44ch] text-[16px] leading-[1.5] text-black/70">Four steps. Only the first one is required, and you can publish at any point.</p>
      <div className="mt-5 flex items-center gap-3">
        <div aria-hidden="true" className="h-1.5 flex-1 rounded-full bg-black/10"><div className="h-1.5 rounded-full bg-[#FF5A4F]" style={{ width: `${Math.max(4, (done / steps.length) * 100)}%` }} /></div>
        <Mono className="text-black/70">{done} / {steps.length}</Mono>
      </div>
      <ol className="mt-3 divide-y divide-black/10">
        {steps.map((step, index) => {
          const isNext = step === next;
          return (
            <li key={step.title}>
              <Link className="flex min-h-[72px] items-center gap-4 py-3 focus-visible:outline-2" href={step.href}>
                <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full text-[15px] font-semibold ${step.done ? "bg-[#0D0D0D] text-[#F5F4EF]" : isNext ? "bg-[#FF5A4F] text-[#0D0D0D]" : "shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.25)]"}`}>{step.done ? "✓" : index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold">{step.title}</span><span className="block truncate text-[14px] text-black/60">{step.sub}</span></span>
                <span className="text-[14px] font-semibold text-black/60">{step.done ? "Done" : isNext ? "Next" : step.optional ? "Optional" : "Required"}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      {next && <Link className={`${coralButton} mt-5 w-full md:w-auto`} href={next.href}>{next.title}</Link>}
    </section>
  );
}
