import Link from "next/link";
import { notFound } from "next/navigation";

import { Head } from "@/components/actions/actions-pages";
import { coralButton, EmptyState, Mono, StudioPage } from "@/components/creator/studio-ui";
import type { ModeSlug } from "@/components/profile/types";
import { actionsBase, newActionHref } from "@/lib/actions/studio-server";
import { audienceSendEnabled } from "@/lib/audience/dispatch";
import { CAMPAIGN_STATUS_LABEL, type AudienceSummary, type Campaign } from "@/lib/audience/model";
import { audienceBase, audienceHref, loadAudience } from "@/lib/audience/studio-server";
import { relativeTime } from "@/lib/creator/studio";
import { CampaignComposer, CampaignProgress, NewCampaignButton, PeopleList } from "./audience-client";

const MODE_NAME: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" };
export const MODE_DOT: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF", creator: "#E8A6FF" };
const eyebrow = (slug: ModeSlug) => <><span aria-hidden="true" className="size-2 rounded-full" style={{ background: MODE_DOT[slug] }} />{MODE_NAME[slug]} Mode</>;

/** Ninety days of confirmed signups (up) and people leaving (down), drawn as quiet bars. */
function Growth({ daily }: { daily: AudienceSummary["daily"] }) {
  const peak = Math.max(1, ...daily.map((day) => Math.max(day.joined, day.left)));
  const joined = daily.reduce((sum, day) => sum + day.joined, 0);
  const left = daily.reduce((sum, day) => sum + day.left, 0);
  const width = 3;
  const gap = 1.5;
  const total = daily.length * (width + gap);
  return (
    <figure className="rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)] md:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <Mono className="text-black/55">Growth · 90 days</Mono>
        <span className="text-[13px] text-black/60"><span className="font-semibold text-[#0D0D0D]">+{joined}</span> joined · {left} left</span>
      </figcaption>
      <svg aria-label={`${joined} confirmed signups and ${left} people leaving in the last 90 days`} className="mt-4 h-[120px] w-full" preserveAspectRatio="none" role="img" viewBox={`0 0 ${Math.max(total, 1)} 100`}>
        <line stroke="rgba(13,13,13,.12)" strokeWidth=".6" vectorEffect="non-scaling-stroke" x1="0" x2={total} y1="70" y2="70" />
        {daily.map((day, index) => (
          <g key={day.day}>
            {day.joined > 0 && <rect fill="#0D0D0D" height={(day.joined / peak) * 66} rx=".8" width={width} x={index * (width + gap)} y={70 - (day.joined / peak) * 66}><title>{`${day.day}: ${day.joined} joined`}</title></rect>}
            {day.left > 0 && <rect fill="#FF5A4F" height={(day.left / peak) * 28} rx=".8" width={width} x={index * (width + gap)} y={71}><title>{`${day.day}: ${day.left} left`}</title></rect>}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex justify-between font-label text-[10px] uppercase tracking-[0.12em] text-black/40"><span>{daily[0]?.day.slice(5) ?? ""}</span><span>Today</span></div>
    </figure>
  );
}

function CampaignTag({ status }: { status: Campaign["status"] }) {
  const tone = status === "sent" ? "bg-[#C7FF4A]" : status === "draft" ? "bg-[#FFE7B8]" : status === "failed" ? "bg-[#FF5A4F]" : "bg-black/[0.06]";
  return <span className={`rounded-full px-2 py-0.5 font-label text-[10px] uppercase tracking-[0.12em] text-[#0D0D0D] ${tone}`}>{CAMPAIGN_STATUS_LABEL[status]}</span>;
}

/** The member's Audience from one Mode: people, where they came from, growth and campaigns. */
export async function AudienceIndex({ slug }: { slug: ModeSlug }) {
  const data = await loadAudience(slug, audienceHref(slug));
  if (!data.mode) notFound();
  if (!data.ready) return <StudioPage><Head eyebrow={eyebrow(slug)} title="Audience" /><EmptyState body="The Audience needs a database update that hasn't reached this site yet." title="Not ready yet." /></StudioPage>;
  const { summary, campaigns, people, audienceLimits: limits } = data;
  const modeLists = summary.lists.filter((list) => list.mode === slug).map((list) => list.id);
  const listTitle = new Map(summary.lists.map((list) => [list.id, list]));

  if (!summary.lists.length) {
    return (
      <StudioPage>
        <Head eyebrow={eyebrow(slug)} title="Audience" />
        <EmptyState
          action={<Link className={coralButton} href={newActionHref(slug, "newsletter")}><span aria-hidden="true">+</span>Add a Newsletter</Link>}
          body="People join your audience by signing up to a Newsletter on one of your pages and confirming by email. No other Action ever adds anyone."
          title="Your audience starts with a Newsletter."
        />
      </StudioPage>
    );
  }

  const cards = [
    { label: "People", value: summary.people, note: "confirmed, one per address" },
    { label: "Joined", value: summary.joined_30d, note: "last 30 days" },
    { label: "Left", value: summary.left_30d, note: "last 30 days" },
    { label: "Unconfirmed", value: summary.pending, note: "waiting on their email" },
  ];
  return (
    <StudioPage>
      <Head
        action={<NewCampaignButton hrefPrefix={`${audienceBase(slug)}/campaigns/`} hrefSuffix={slug === "creator" ? "" : `?mode=${slug}`} listIds={modeLists.length ? modeLists : summary.lists.map((list) => list.id)} modeId={data.mode.id} profileId={data.userId} />}
        eyebrow={eyebrow(slug)}
        sub={`${summary.people} ${summary.people === 1 ? "person" : "people"} across ${summary.lists.length} ${summary.lists.length === 1 ? "list" : "lists"}`}
        title="Audience"
      />
      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <div className="rounded-[24px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)] md:p-5" key={card.label}>
            <dt><Mono className="text-black/55">{card.label}</Mono></dt>
            <dd className="mt-2 font-display text-[36px] font-bold leading-none tracking-[-0.05em] md:text-[44px]">{card.value}</dd>
            <dd className="mt-1 text-[13px] text-black/60">{card.note}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Growth daily={summary.daily} />
          <section aria-labelledby="sv-sources" className="rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)] md:p-6">
            <h2 className="font-display text-[22px] font-bold tracking-[-0.04em]" id="sv-sources">Sources</h2>
            <ul className="mt-3 divide-y divide-black/10">
              {summary.lists.map((list) => {
                const share = summary.people ? Math.round((list.subscribed / Math.max(summary.people, 1)) * 100) : 0;
                return (
                  <li key={list.id}>
                    <Link className="flex items-center gap-3 py-3 transition hover:opacity-80" href={`${actionsBase(list.mode)}/${list.id}${list.mode === "creator" ? "" : `?mode=${list.mode}`}`}>
                      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: MODE_DOT[list.mode] }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-semibold">{list.title}</span>
                        <span className="block text-[13px] text-black/55">{MODE_NAME[list.mode]} · {list.status === "published" ? "Live" : list.status === "draft" ? "Draft" : "Closed"}{list.pending ? ` · ${list.pending} unconfirmed` : ""}</span>
                      </span>
                      <span className="w-20 shrink-0 text-right"><span className="block font-display text-[22px] font-bold leading-none tracking-[-0.04em]">{list.subscribed}</span><span className="mt-1 block h-1 rounded-full bg-black/[0.06]"><span className="block h-1 rounded-full bg-[#0D0D0D]" style={{ width: `${share}%` }} /></span></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <section aria-labelledby="sv-campaigns" className="min-w-0 rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)] md:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[22px] font-bold tracking-[-0.04em]" id="sv-campaigns">Campaigns</h2>
            <span className="text-[13px] text-black/55">{limits.can_send ? `${limits.used_this_month.toLocaleString("en")} of ${limits.monthly_emails.toLocaleString("en")} emails this month` : `Sending comes with Plus`}</span>
          </div>
          {campaigns.length ? (
            <ul className="mt-3 divide-y divide-black/10">
              {campaigns.map((campaign) => (
                <li key={campaign.id}>
                  <Link className="flex items-center gap-3 py-3 transition hover:opacity-80" href={audienceHref(slug, `/campaigns/${campaign.id}`)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold">{campaign.subject || "Untitled draft"}</span>
                      <span className="block truncate text-[13px] text-black/55">{campaign.list_ids.map((id) => listTitle.get(id)?.title).filter(Boolean).join(", ") || "No list yet"} · {relativeTime(campaign.finished_at ?? campaign.queued_at ?? campaign.updated_at)}</span>
                    </span>
                    {campaign.status !== "draft" && <span className="shrink-0 text-[13px] font-semibold">{campaign.sent_count}<span className="font-normal text-black/50">/{campaign.recipient_count}</span></span>}
                    <CampaignTag status={campaign.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-[15px] leading-[1.5] text-black/60">Write to everyone who confirmed. Each email carries an unsubscribe link, and people who leave are never emailed again.</p>}
        </section>
      </div>

      <section aria-labelledby="sv-people" className="mt-8">
        <h2 className="mb-4 font-display text-[28px] font-bold tracking-[-0.045em]" id="sv-people">People</h2>
        <PeopleList canExport={data.limits.can_export} lists={summary.lists.map((list) => ({ id: list.id, title: list.title, mode: list.mode }))} people={people} />
      </section>
      <p className="mt-6 max-w-[70ch] text-[13px] leading-[1.5] text-black/60">Only people who signed up to a Newsletter and confirmed by email are in your audience. Forms, giveaways and other Actions never add anyone. Unconfirmed signups are deleted after 7 days.</p>
    </StudioPage>
  );
}

/** One campaign: the composer while it's a draft, then its delivery. */
export async function CampaignDetail({ slug, id }: { slug: ModeSlug; id: string }) {
  const data = await loadAudience(slug, audienceHref(slug, `/campaigns/${id}`));
  if (!data.mode || !data.ready) notFound();
  const campaign = data.campaigns.find((item) => item.id === id) ?? (await data.supabase.from("audience_campaigns").select("*").eq("id", id).maybeSingle()).data as Campaign | null;
  if (!campaign) notFound();
  const back = { href: audienceHref(slug), label: "Audience" };
  const lists = data.summary.lists.map((list) => ({ id: list.id, title: list.title, mode: list.mode, subscribed: list.subscribed }));
  const subscribed = data.people.filter((person) => person.status === "subscribed").map((person) => ({ action_id: person.action_id, email: person.email ?? "" }));
  return (
    <StudioPage>
      <Head back={back} eyebrow={<>{eyebrow(slug)}<span aria-hidden="true">·</span>Campaign<CampaignTag status={campaign.status} /></>} title={campaign.subject || (campaign.status === "draft" ? "New campaign" : "Untitled")} />
      {campaign.status === "draft"
        ? <CampaignComposer audienceHref={audienceHref(slug)} campaign={campaign} complete={data.people.length < 500} limits={data.audienceLimits} lists={lists} sendEnabled={audienceSendEnabled()} senderName={data.profile.display_name} subscribed={subscribed} />
        : <CampaignProgress campaign={campaign} lists={lists} senderName={data.profile.display_name} />}
    </StudioPage>
  );
}
