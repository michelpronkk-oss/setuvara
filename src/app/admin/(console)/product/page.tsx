import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Badge, Empty, Meter, PageHeader, Panel, SectionHead, Segmented, Stat } from "@/components/admin/ui";
import { APPEARANCE_NAMES } from "@/components/profile/appearance";
import { requireAdminPage } from "@/lib/admin/auth";
import { ADMIN_RANGES, getProduct, parseRange } from "@/lib/admin/data";
import { formatCount, formatDateTime, formatDay, titleCase } from "@/lib/admin/format";
import { BLOCKS } from "@/lib/blocks/registry";

export const metadata: Metadata = { title: "Product" };

const ACTION_KINDS: Record<string, string> = { form: "Forms", newsletter: "Newsletters", booking: "Bookings", giveaway: "Giveaways", collab: "Collabs", submission: "Submissions" };
const NAME_FONTS: Record<string, string> = { setuvara: "Setuvara", modern: "Modern", editorial: "Editorial", condensed: "Condensed", impact: "Impact", soft: "Soft" };
const LEAD_STAGES = ["new", "contacted", "qualified", "won", "lost"];

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
}

/** A tool's block: its name, the numbers that say whether it's used, and a breakdown underneath. */
function Tool({ title, mode, figures, children }: { title: string; mode: string; figures: { label: string; value: ReactNode; strong?: boolean }[]; children?: ReactNode }) {
  return (
    <Panel actions={<Badge>{mode}</Badge>} title={title}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt className="font-label text-[10px] font-medium uppercase tracking-[0.14em] text-ink/45">{figure.label}</dt>
            <dd className={`mt-1.5 font-display font-extrabold leading-none tracking-[-0.055em] tabular-nums ${figure.strong ? "text-[34px]" : "text-[26px]"}`}>{figure.value}</dd>
          </div>
        ))}
      </dl>
      {children ? <div className="mt-6 border-t border-ink/[0.07] pt-5">{children}</div> : null}
    </Panel>
  );
}

function Breakdown({ items, labels }: { items: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(items).sort((a, b) => b[1] - a[1]);
  const max = Math.max(0, ...entries.map(([, value]) => value));
  if (!entries.length) return <Empty>None yet.</Empty>;
  return <ul className="space-y-3.5">{entries.map(([key, value]) => <li key={key}><Meter label={labels?.[key] ?? titleCase(key)} max={max} value={value} /></li>)}</ul>;
}

export default async function ProductPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdminPage("product");
  const days = parseRange((await searchParams).range);
  const { from, to, product } = await getProduct(days);
  const { actions, business, builder, creator, events, sharing, pages } = product;
  const inRange = `${days}d`;

  const looks: Record<string, number> = {};
  for (const [theme, count] of Object.entries(pages.looks)) {
    const key = theme in APPEARANCE_NAMES ? APPEARANCE_NAMES[theme as keyof typeof APPEARANCE_NAMES] : "Saved before the ten Looks";
    looks[key] = (looks[key] ?? 0) + count;
  }
  const blockLabels = Object.fromEntries(Object.entries(BLOCKS).map(([kind, meta]) => [kind, meta.name]));
  const gross = Object.entries(creator.gross);

  return (
    <>
      <PageHeader
        actions={<Segmented current={String(days)} options={ADMIN_RANGES.map((range) => ({ label: `${range}d`, value: String(range), href: `/product?range=${range}` }))} />}
        description={<>What members do with each Mode’s tools. Activity is for {formatDay(from)} to {formatDay(to)}; totals are all time.</>}
        eyebrow={`Last ${days} days`}
        title="Product"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Live Actions" note={<>{formatCount(actions.members)} members have made one · {formatCount(actions.submissions)} responses in {inRange}</>} tone="ink" value={formatCount(actions.live)} />
        <Stat label="New leads" note={<>{formatCount(business.leads_total)} in total · {formatCount(business.bookings)} bookings in {inRange}</>} value={formatCount(business.leads)} />
        <Stat label="Store orders" note={<>Live orders, paid in {inRange}{creator.test_orders ? <> · {formatCount(creator.test_orders)} test</> : null}</>} value={formatCount(creator.orders)} />
        <Stat label="Builder projects" note={<>{formatCount(builder.builders)} builders · {formatCount(builder.revenue_connections)} verified revenue</>} value={formatCount(builder.projects)} />
      </div>

      <SectionHead description="Usage per tool, with the counts that show whether it’s working." eyebrow="Tools" id="tools" title="Mode tools" />
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <Tool figures={[{ label: "Live", value: formatCount(actions.live), strong: true }, { label: `Responses, ${inRange}`, value: formatCount(actions.submissions) }, { label: "Subscribers", value: formatCount(actions.subscribers) }]} mode="Every Mode" title="Actions">
          <Breakdown items={actions.by_kind} labels={ACTION_KINDS} />
        </Tool>
        <Tool figures={[{ label: `Leads, ${inRange}`, value: formatCount(business.leads), strong: true }, { label: `Bookings, ${inRange}`, value: formatCount(business.bookings) }, { label: "Testimonials shown", value: formatCount(business.testimonials) }, { label: "Testimonial invites", value: formatCount(business.testimonial_requests) }, { label: "Team seats used", value: formatCount(business.team_members) }, { label: "Bookings, total", value: formatCount(business.bookings_total) }]} mode="Business" title="Leads and bookings">
          <Breakdown items={Object.fromEntries(LEAD_STAGES.map((stage) => [stage, business.by_stage[stage] ?? 0]).filter(([, value]) => Number(value) > 0))} />
        </Tool>
        <Tool figures={[{ label: "Projects", value: formatCount(builder.projects), strong: true }, { label: "Roadmap items", value: formatCount(builder.roadmap_items) }, { label: "Shipped", value: formatCount(builder.shipped) }, { label: `Votes, ${inRange}`, value: formatCount(builder.votes_in_range) }, { label: "Suggestions", value: formatCount(builder.suggestions) }, { label: "Revenue failing", value: builder.revenue_failing ? <span className="text-coral">{formatCount(builder.revenue_failing)}</span> : "0" }]} mode="Business · Creator" title="Builder and verified revenue">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">{Object.keys(builder.revenue_by_provider).length ? Object.entries(builder.revenue_by_provider).map(([provider, count]) => <Badge key={provider} tone="sky">{titleCase(provider)} · {count}</Badge>) : <span className="text-[13px] text-ink/50">No providers connected.</span>}</div>
            <span className="text-[12.5px] text-ink/50">Last sync {formatDateTime(builder.last_sync_at)}</span>
          </div>
        </Tool>
        <Tool figures={[{ label: "Products for sale", value: formatCount(creator.offers), strong: true }, { label: "Sellers", value: formatCount(creator.sellers) }, { label: `Orders, ${inRange}`, value: formatCount(creator.orders) }, { label: "Media kits", value: formatCount(creator.media_kits) }, { label: `Deals, ${inRange}`, value: formatCount(creator.deals) }, { label: `Emails sent, ${inRange}`, value: formatCount(creator.emails_sent) }]} mode="Creator" title="Store, deals and Audience">
          <p className="text-[13px] text-ink/55">{gross.length ? <>Live sales, net of refunds: {gross.map(([currency, minor]) => <b className="text-ink" key={currency}>{money(minor, currency)} </b>)}</> : "No live sales in this range."}{creator.test_orders ? <> · {formatCount(creator.test_orders)} test-mode orders not counted.</> : null}</p>
        </Tool>
        <Tool figures={[{ label: "Events published", value: formatCount(events.events), strong: true }, { label: "Upcoming", value: formatCount(events.upcoming) }, { label: `RSVPs, ${inRange}`, value: formatCount(events.registrations) }, { label: `Check-ins, ${inRange}`, value: formatCount(events.check_ins) }, { label: "Live contexts", value: formatCount(events.live_contexts) }]} mode="Event" title="Events" />
        <Tool figures={[{ label: "Tap devices", value: formatCount(sharing.tap_devices), strong: true }, { label: `Taps, ${inRange}`, value: formatCount(sharing.taps) }, { label: "Mode handles", value: formatCount(sharing.mode_handles) }, { label: "Gallery listings", value: formatCount(sharing.gallery_listings) }, { label: `Messages, ${inRange}`, value: formatCount(sharing.messages) }, { label: `Passport stamps, ${inRange}`, value: formatCount(sharing.stamps) }]} mode="Every Mode" title="Sharing and staying in touch" />
      </div>

      <SectionHead description="How members shape their pages: the Looks, name styles and blocks they choose." eyebrow="Pages" id="pages" title="Appearance and content" />
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <Panel description="Across every Mode that’s switched on." title="Looks">
          <Breakdown items={looks} />
        </Panel>
        <Panel description="The name style on each page." title="Name styles">
          <Breakdown items={pages.name_fonts} labels={NAME_FONTS} />
        </Panel>
        <Panel description={<>{formatCount(pages.links)} visible links · {formatCount(pages.soundtracks)} soundtracks</>} title="Blocks">
          <Breakdown items={pages.blocks} labels={blockLabels} />
        </Panel>
      </div>
    </>
  );
}
