import type { Metadata } from "next";

import { ChecklistToggle } from "@/components/admin/actions";
import { Badge, Empty, Meter, Notice, PageHeader, Panel, SectionHead, Segmented, StackedBars, Stat, Table, Td, Th, type Tone } from "@/components/admin/ui";
import { requireAdminPage, roleCanOpen } from "@/lib/admin/auth";
import { ADMIN_RANGES, getGrowth, parseRange } from "@/lib/admin/data";
import { formatCount, formatDay, formatDelta, formatPercent, formatRelative } from "@/lib/admin/format";
import { BOT_LABELS, CRAWLER_KIND_LABELS, GROWTH_CHECKLIST, REFERRER_LABELS } from "@/lib/admin/growth";
import { SITE_PAGES } from "@/lib/analytics/site-pages";
import { BLOG_POSTS } from "@/lib/marketing/blog-content";
import { COMPARE_ORDER } from "@/lib/marketing/compare-content";
import { FEATURE_ORDER } from "@/lib/marketing/features-content";
import { MODE_ORDER } from "@/lib/marketing/modes-content";
import { TEMPLATE_SLUGS } from "@/lib/marketing/templates-content";
import { TOOLS } from "@/lib/marketing/tools";
import { USE_CASE_ORDER } from "@/lib/marketing/use-cases-content";

export const metadata: Metadata = { title: "Search & AI" };

const KIND_TONE: Record<string, Tone> = { search: "sky", ai: "coral", ai_answer: "coral", ai_training: "gold", social: "neutral", direct: "neutral", seo_tool: "neutral", other: "neutral" };
const KIND_LABEL: Record<string, string> = { search: "Search", ai: "AI", social: "Social", direct: "Direct", other: "Other" };

/** What the site offers search engines and AI tools, counted from the content itself. */
const INVENTORY = [
  { label: "Mode pages", count: MODE_ORDER.length },
  { label: "Feature pages", count: FEATURE_ORDER.length },
  { label: "Use cases", count: USE_CASE_ORDER.length },
  { label: "Comparisons", count: COMPARE_ORDER.length },
  { label: "Templates", count: TEMPLATE_SLUGS.length },
  { label: "Free tools", count: TOOLS.length },
  { label: "Blog posts", count: BLOG_POSTS.length },
];

export default async function GrowthPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const session = await requireAdminPage("growth");
  const days = parseRange((await searchParams).range);
  const { from, to, growth, checkedAt: now } = await getGrowth(days);
  const { totals } = growth;
  const canEdit = roleCanOpen(session.role, "members");

  const aiCrawls = growth.crawlers.filter((bot) => bot.kind === "ai_answer" || bot.kind === "ai_training").reduce((sum, bot) => sum + bot.hits, 0);
  const searchCrawls = growth.crawlers.filter((bot) => bot.kind === "search").reduce((sum, bot) => sum + bot.hits, 0);
  const llmsReads = growth.crawlers.reduce((sum, bot) => sum + bot.llms, 0);
  const referrerMax = Math.max(0, ...growth.referrers.map((item) => item.count));
  const sectionMax = Math.max(0, ...growth.crawler_sections.map((item) => item.hits));
  const checklistItems = GROWTH_CHECKLIST.flatMap((group) => group.items);
  const checklistDone = checklistItems.filter((item) => growth.checklist[item.key]?.done).length;
  const lastRun = growth.indexnow[0];

  return (
    <>
      <PageHeader
        actions={<Segmented current={String(days)} options={ADMIN_RANGES.map((range) => ({ label: `${range}d`, value: String(range), href: `/growth?range=${range}` }))} />}
        description={<>How people and machines find Setuvara: search and AI referrals, the crawlers that read the site, and the off-site work that earns citations. {formatDay(from)} to {formatDay(to)}, UTC.</>}
        eyebrow={`Last ${days} days`}
        title="Search & AI"
      />

      {!growth.recording_since ? (
        <div className="mb-4"><Notice>Referrer and crawler recording started with this release, so the first numbers appear as visits and crawls come in. Older page views stay on Overview.</Notice></div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat delta={formatDelta(totals.ai, totals.ai_previous)} label="AI referrals" note="Visitors sent by ChatGPT, Perplexity, Copilot, Gemini and others" tone="ink" value={formatCount(totals.ai)} />
        <Stat delta={formatDelta(totals.search, totals.search_previous)} label="Search visits" note={<>{formatPercent(totals.search, totals.visits)} of {formatCount(totals.visits)} site visits</>} value={formatCount(totals.search)} />
        <Stat label="AI crawler reads" note={<>{formatCount(llmsReads)} of llms.txt</>} value={formatCount(aiCrawls)} />
        <Stat label="Search crawler reads" note="Googlebot, Bingbot, Applebot and more" value={formatCount(searchCrawls)} />
      </div>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-2">
        <Panel description="Site visits that arrived from a search engine or an AI answer." title="Search and AI visits">
          <StackedBars label="Visits a day" points={growth.daily.map((day) => ({ date: day.date, values: [day.search, day.ai] }))} series={[{ label: "Search", className: "bg-sky" }, { label: "AI", className: "bg-coral" }]} />
        </Panel>
        <Panel description="Requests from known crawlers, counted per day." title="Crawler reads">
          <StackedBars label="Reads a day" points={growth.crawler_daily.map((day) => ({ date: day.date, values: [day.search, day.ai] }))} series={[{ label: "Search", className: "bg-sky" }, { label: "AI", className: "bg-coral" }]} />
        </Panel>
      </div>

      <SectionHead description="Only the source is kept, never the address someone came from." eyebrow="Visitors" id="visitors" title="Where people come from" />
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-2" title="Sources">
          {growth.referrers.length === 0 ? <Empty>No visits recorded in this range yet.</Empty> : (
            <ul className="space-y-4">
              {growth.referrers.map((item) => (
                <li key={item.referrer}>
                  <Meter detail={<>{formatCount(item.count)} · {formatPercent(item.count, totals.visits)}</>} label={<span className="flex items-center gap-2">{REFERRER_LABELS[item.referrer] ?? item.referrer}<Badge tone={KIND_TONE[item.kind]}>{KIND_LABEL[item.kind] ?? item.kind}</Badge></span>} max={referrerMax} value={item.count} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="lg:col-span-3" description="The first page of each visit, with how many came from search and AI." padded={false} title="Landing pages">
          {growth.landing.length === 0 ? <div className="px-5 pb-5 sm:px-7 sm:pb-7"><Empty>No visits recorded in this range yet.</Empty></div> : (
            <Table minWidth={520}>
              <thead><tr><Th>Page</Th><Th align="right">Visits</Th><Th align="right">Search</Th><Th align="right">AI</Th></tr></thead>
              <tbody>
                {growth.landing.map((row) => (
                  <tr className="border-t border-ink/[0.06] hover:bg-paper/60" key={row.path}>
                    <Td><a className="font-semibold hover:text-coral" href={`https://setuvara.com${row.path === "/" ? "" : row.path}`} rel="noreferrer" target="_blank">{row.path}</a><span className="mt-0.5 block text-[11.5px] text-ink/40">{SITE_PAGES[row.section as keyof typeof SITE_PAGES] ?? row.section}</span></Td>
                    <Td align="right">{formatCount(row.visits)}</Td>
                    <Td align="right">{formatCount(row.search)}</Td>
                    <Td align="right">{row.ai ? <b className="text-coral">{formatCount(row.ai)}</b> : "0"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>

      <SectionHead description="Search engines index the site; AI tools read it to answer questions. llms.txt is the summary written for them." eyebrow="Crawlers" id="crawlers" title="Who reads the site" />
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" padded={false} title="Crawlers">
          {growth.crawlers.length === 0 ? <div className="px-5 pb-5 sm:px-7 sm:pb-7"><Empty>No crawler visits recorded in this range yet.</Empty></div> : (
            <Table minWidth={640}>
              <thead><tr><Th>Crawler</Th><Th>Kind</Th><Th align="right">Pages</Th><Th align="right">llms.txt</Th><Th align="right">Sitemap</Th><Th align="right">Last seen</Th></tr></thead>
              <tbody>
                {growth.crawlers.map((bot) => (
                  <tr className="border-t border-ink/[0.06] hover:bg-paper/60" key={bot.bot}>
                    <Td><span className="font-semibold">{BOT_LABELS[bot.bot]?.name ?? bot.bot}</span><span className="mt-0.5 block text-[11.5px] text-ink/40">{BOT_LABELS[bot.bot]?.owner ?? ""}</span></Td>
                    <Td><Badge tone={KIND_TONE[bot.kind]}>{CRAWLER_KIND_LABELS[bot.kind] ?? bot.kind}</Badge></Td>
                    <Td align="right">{formatCount(bot.pages)}</Td>
                    <Td align="right">{bot.llms ? <b>{formatCount(bot.llms)}</b> : "0"}</Td>
                    <Td align="right">{formatCount(bot.sitemap)}</Td>
                    <Td align="right">{formatRelative(bot.last_seen_at, now)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
        <Panel description="Which parts of the site AI crawlers read most." title="What AI reads">
          {growth.crawler_sections.length === 0 ? <Empty>Nothing yet.</Empty> : (
            <ul className="space-y-4">
              {growth.crawler_sections.map((item) => <li key={item.section}><Meter label={item.section === "llms" ? "llms.txt" : item.section === "sitemap" ? "Sitemap" : item.section === "robots" ? "robots.txt" : SITE_PAGES[item.section as keyof typeof SITE_PAGES] ?? item.section} max={sectionMax} value={item.hits} /></li>)}
            </ul>
          )}
        </Panel>
      </div>

      <SectionHead description="What the site publishes for search engines and AI tools, and how fast they hear about changes." eyebrow="Content" id="content" title="On the site" />
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Pages built for search">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {INVENTORY.map((item) => (
              <li className="rounded-[18px] bg-paper px-4 py-4" key={item.label}>
                <p className="font-display text-[34px] font-extrabold leading-none tracking-[-0.06em] tabular-nums">{item.count}</p>
                <p className="mt-2 text-[12.5px] text-ink/55">{item.label}</p>
              </li>
            ))}
            <li className="rounded-[18px] bg-ink px-4 py-4 text-paper">
              <p className="font-display text-[34px] font-extrabold leading-none tracking-[-0.06em] tabular-nums">{INVENTORY.reduce((sum, item) => sum + item.count, 0)}</p>
              <p className="mt-2 text-[12.5px] text-paper/60">In total</p>
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-2 text-[12.5px]">
            {[["sitemap.xml", "https://setuvara.com/sitemap.xml"], ["llms.txt", "https://setuvara.com/llms.txt"], ["robots.txt", "https://setuvara.com/robots.txt"]].map(([label, href]) => (
              <a className="inline-flex min-h-9 items-center gap-2 rounded-full bg-paper px-4 font-semibold hover:bg-ink hover:text-paper" href={href} key={label} rel="noreferrer" target="_blank"><span aria-hidden="true" className="size-1.5 rounded-full bg-[#5fa83a]" />{label}</a>
            ))}
          </div>
        </Panel>
        <Panel description="Daily at 06:23 UTC: changed pages are sent to Bing and other IndexNow engines." title="IndexNow">
          {lastRun ? (
            <>
              <div className="flex items-center gap-3"><Badge dot tone={lastRun.status === 200 || lastRun.status === 202 || lastRun.status === 204 ? "good" : "bad"}>{lastRun.status === 204 ? "Nothing changed" : lastRun.status === 200 || lastRun.status === 202 ? "Accepted" : `Status ${lastRun.status}`}</Badge><span className="text-[12.5px] text-ink/50">{formatRelative(lastRun.ran_at, now)}</span></div>
              <ul className="mt-5 space-y-2 text-[12.5px]">
                {growth.indexnow.map((run) => (
                  <li className="flex justify-between gap-3 border-t border-ink/[0.06] pt-2" key={run.ran_at}><span>{formatDay(run.ran_at, true)}</span><span className="tabular-nums text-ink/55">{formatCount(run.submitted)} pages · {run.status || "no answer"}</span></li>
                ))}
              </ul>
            </>
          ) : <Empty>The first logged run appears after the next daily ping.</Empty>}
        </Panel>
      </div>

      <SectionHead description="AI tools cite what other sites say. Tick each item when it’s done; owners and admins can edit." eyebrow="Off-site" id="checklist" title={`Mentions and listings · ${checklistDone} of ${checklistItems.length}`} />
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        {GROWTH_CHECKLIST.map((group) => (
          <Panel key={group.group} title={group.group}>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const state = growth.checklist[item.key];
                return (
                  <li className="flex items-start gap-4 rounded-[16px] px-2 py-3 hover:bg-paper/60" key={item.key}>
                    <ChecklistToggle canEdit={canEdit} done={Boolean(state?.done)} itemKey={item.key} label={item.label} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[14px] font-semibold ${state?.done ? "text-ink/45 line-through decoration-ink/30" : ""}`}>{item.href ? <a className="hover:text-coral" href={item.href} rel="noreferrer" target="_blank">{item.label} ↗</a> : item.label}</p>
                      <p className="mt-0.5 text-[12.5px] text-ink/50">{item.note}{state?.done ? <> · done {formatDay(state.updated_at, true)}</> : null}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))}
      </div>

      <div className="mt-6">
        <Notice>Search impressions, rankings and click-through live in Google Search Console and Bing Webmaster Tools; they need those accounts and aren’t stored here. AI mentions on other sites can’t be counted automatically, so the monthly checks above track them by hand.</Notice>
      </div>
    </>
  );
}
