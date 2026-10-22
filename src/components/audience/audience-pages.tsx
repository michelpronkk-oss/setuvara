import Link from "next/link";
import { notFound } from "next/navigation";

import { Head } from "@/components/actions/actions-pages";
import { coralButton, EmptyState, StudioPage } from "@/components/creator/studio-ui";
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

/**
 * The audience at a glance: today's count over a 90-day line of how it got there (running total
 * of joined minus left), with the month's movement beside it. A flat line still reads as a start.
 */
function Pulse({ people, daily, cards, tone }: { people: number; daily: AudienceSummary["daily"]; cards: { label: string; value: number; note: string }[]; tone: string }) {
  const net = daily.reduce((sum, day) => sum + day.joined - day.left, 0);
  const series = daily.reduce<number[]>((list, day) => [...list, Math.max(0, (list.at(-1) ?? Math.max(0, people - net)) + day.joined - day.left)], []);
  const max = Math.max(1, ...series);
  const W = 600;
  const H = 140;
  const pts = series.map((v, i) => [series.length > 1 ? (i / (series.length - 1)) * W : W, H - 8 - (v / max) * (H - 24)] as const);
  const line = pts.length ? `M0,${pts[0][1]} ${pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}` : `M0,${H - 8} L${W},${H - 8}`;
  return (
    <section aria-label="Audience at a glance" className="relative isolate mb-6 grid gap-6 overflow-hidden rounded-[28px] bg-[#0D0D0D] p-6 text-[#F5F4EF] shadow-[0_30px_60px_-40px_#0D0D0D] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:p-8">
      <span aria-hidden="true" className="pointer-events-none absolute -left-20 -top-24 -z-10 size-80 rounded-full opacity-50 blur-3xl" style={{ background: `radial-gradient(circle, ${tone}66, transparent 65%)` }} />
      <div className="min-w-0">
        <p className="font-label text-[10.5px] uppercase tracking-[0.16em] text-[#F5F4EF]/55">People · 90 days</p>
        <p className="mt-2 flex items-baseline gap-3"><span className="font-display text-[64px] font-bold leading-none tracking-[-0.06em] tabular-nums md:text-[80px]">{people}</span><span className="text-[14px] text-[#F5F4EF]/60">{people === 1 ? "person confirmed" : "people confirmed"}</span></p>
        <svg aria-label={`Audience over the last 90 days, ending at ${people}`} className="mt-4 h-[120px] w-full overflow-visible" preserveAspectRatio="none" role="img" viewBox={`0 0 ${W} ${H}`}>
          <defs><linearGradient id="pulse-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={tone} stopOpacity="0.35" /><stop offset="100%" stopColor={tone} stopOpacity="0" /></linearGradient></defs>
          <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#pulse-fill)" />
          <path className="pulse-draw" d={line} fill="none" stroke={tone} strokeLinejoin="round" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <dl className="grid content-end gap-2">
        {cards.slice(1).map((card) => (
          <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[#F5F4EF]/[0.06] px-4 py-3" key={card.label}>
            <dt><span className="block text-[14px] font-semibold">{card.label}</span><span className="block text-[12px] text-[#F5F4EF]/50">{card.note}</span></dt>
            <dd className="font-display text-[30px] font-bold leading-none tracking-[-0.05em] tabular-nums">{card.label === "Left" && card.value ? `−${card.value}` : card.label === "Joined" && card.value ? `+${card.value}` : card.value}</dd>
          </div>
        ))}
      </dl>
      <style>{`.pulse-draw{stroke-dasharray:3000;stroke-dashoffset:3000;animation:pulse-draw 1.6s cubic-bezier(.65,0,.35,1) .1s forwards}@keyframes pulse-draw{to{stroke-dashoffset:0}}@media (prefers-reduced-motion:reduce){.pulse-draw{animation:none;stroke-dashoffset:0}}`}</style>
    </section>
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
  if (!data.ready) return <StudioPage><Head tone={MODE_DOT[slug]} eyebrow={eyebrow(slug)} title="Audience" /><EmptyState body="The Audience needs a database update that hasn't reached this site yet." title="Not ready yet." /></StudioPage>;
  const { summary, campaigns, people, audienceLimits: limits } = data;
  const modeLists = summary.lists.filter((list) => list.mode === slug).map((list) => list.id);
  const listTitle = new Map(summary.lists.map((list) => [list.id, list]));

  if (!summary.lists.length) {
    return (
      <StudioPage>
        <Head tone={MODE_DOT[slug]} eyebrow={eyebrow(slug)} title="Audience" />
        <section className="grid gap-4 overflow-hidden rounded-[28px] bg-white p-6 shadow-[inset_0_0_0_1px_rgba(13,13,13,.07),0_30px_60px_-50px_#0D0D0D] md:grid-cols-[minmax(0,1fr)_340px] md:items-center md:p-9">
          <div>
            <h2 className="font-display text-[30px] font-bold leading-[1] tracking-[-0.045em] md:text-[38px]">Your audience starts with a Newsletter.</h2>
            <p className="mt-3 max-w-[48ch] text-[15px] leading-[1.5] text-black/60">Add a Newsletter to one of your pages. People sign up, confirm by email, and land here. No other Action ever adds anyone.</p>
            <Link className={`${coralButton} mt-5`} href={newActionHref(slug, "newsletter")}><span aria-hidden="true">+</span>Add a Newsletter</Link>
          </div>
          <div aria-hidden="true" className="relative rotate-[-2deg] rounded-[24px] bg-[#0D0D0D] p-5 text-[#F5F4EF] shadow-[0_30px_50px_-30px_#0D0D0D]">
            <p className="font-label text-[10px] uppercase tracking-[0.16em] text-[#F5F4EF]/50">Newsletter</p>
            <p className="mt-2 font-display text-[22px] font-bold leading-tight tracking-[-0.03em]">Stay in the loop</p>
            <p className="mt-1 text-[13px] text-[#F5F4EF]/60">One email a month. Leave any time.</p>
            <div className="mt-4 flex items-center gap-2 rounded-full bg-[#F5F4EF]/10 p-1 pl-4"><span className="flex-1 text-[13px] text-[#F5F4EF]/45">you@email.com</span><span className="rounded-full px-4 py-2 text-[13px] font-semibold text-[#0D0D0D]" style={{ background: MODE_DOT[slug] }}>Join</span></div>
            <span className="absolute -right-3 -top-3 rounded-full bg-[#C7FF4A] px-3 py-1.5 text-[12px] font-semibold text-[#0D0D0D] shadow-[0_10px_20px_-10px_#0D0D0D]">+1 confirmed</span>
          </div>
        </section>
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
        tone={MODE_DOT[slug]}
        action={<NewCampaignButton hrefPrefix={`${audienceBase(slug)}/campaigns/`} hrefSuffix={slug === "creator" ? "" : `?mode=${slug}`} listIds={modeLists.length ? modeLists : summary.lists.map((list) => list.id)} modeId={data.mode.id} profileId={data.userId} />}
        eyebrow={eyebrow(slug)}
        sub={`${summary.people} ${summary.people === 1 ? "person" : "people"} across ${summary.lists.length} ${summary.lists.length === 1 ? "list" : "lists"}`}
        title="Audience"
      />
      <Pulse cards={cards} daily={summary.daily} people={summary.people} tone={MODE_DOT[slug]} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
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
          ) : (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-[20px] bg-[#F5F4EF] p-5">
              <span aria-hidden="true" className="grid size-11 place-items-center rounded-[14px] bg-[#0D0D0D] text-[#F5F4EF]"><svg className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><rect height="14" rx="2.5" width="18" x="3" y="5" /><path d="m4 7 8 6 8-6" /></svg></span>
              <p className="text-[16px] font-semibold">Your first campaign</p>
              <p className="text-[14px] leading-[1.5] text-black/60">Write to everyone who confirmed. Each email carries an unsubscribe link, and people who leave are never emailed again.</p>
            </div>
          )}
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
