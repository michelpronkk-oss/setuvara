import type { ReactNode } from "react";

import { ActionCard } from "@/components/actions/action-card";
import type { PublicAction } from "@/lib/actions/model";
import { formatMoney, OFFER_TYPE_LABEL, SECTION_NAMES, type CreatorSection, type CreatorSettings, type StoreOffer, type WorkItem } from "@/lib/creator/studio";

/**
 * The Creator sections of a page: Featured, Work, Store and Actions, in the creator's order.
 * They sit inside any Appearance, so colour comes from currentColor and the page's accent.
 */
export function CreatorSections({ settings, work, offers, actions = [], actionHref, accent, accentInk }: {
  settings: CreatorSettings;
  work: WorkItem[];
  offers: Pick<StoreOffer, "id" | "title" | "description" | "currency" | "unit_amount_minor" | "offer_type" | "external_url">[];
  /** Live Actions with their cover pictures. */
  actions?: { action: PublicAction; coverUrl: string | null }[];
  /** Where an Action's button goes. Absent in previews and for the owner. */
  actionHref?: (id: string) => string;
  accent: string;
  accentInk: string;
}) {
  const visible = work.filter((item) => item.visible);
  const featured = visible.find((item) => item.featured) ?? null;
  const rest = visible.filter((item) => item !== featured);
  const parts: Record<CreatorSection, ReactNode> = {
    featured: featured ? <FeaturedWork item={featured} key="featured" /> : null,
    work: rest.length ? <SelectedWork items={rest} key="work" /> : null,
    store: offers.length ? <Store accent={accent} accentInk={accentInk} key="store" offers={offers} /> : null,
    actions: actions.length ? (
      <div className="flex flex-col gap-4" data-creator-actions key="actions">
        {actions.map(({ action, coverUrl }) => <ActionCard accent={accent} accentInk={accentInk} action={action} coverUrl={coverUrl} href={actionHref?.(action.id)} key={action.id} />)}
      </div>
    ) : null,
  };
  const shown = settings.sections.map((section) => parts[section]).filter(Boolean);
  if (!shown.length) return null;
  return <div className="flex flex-col gap-9 text-left @min-[1100px]/profile:gap-12" data-creator-sections>{shown}</div>;
}

const label = "font-label text-[10.5px] uppercase tracking-[0.18em] opacity-60";
const line = "color-mix(in srgb, currentColor 14%, transparent)";

function FeaturedWork({ item }: { item: WorkItem }) {
  const href = item.url ?? item.videoUrl ?? item.imageUrl ?? undefined;
  const body = (
    <>
      {item.imageUrl && <>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase image or provider thumbnail */}
        <img alt="" className="absolute inset-0 -z-10 size-full object-cover" loading="lazy" src={item.imageUrl} />
      </>}
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_45%,rgba(13,13,13,.8))]" />
      <span className="flex items-center gap-4">
        {item.kind === "video" && <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-[#F5F4EF] text-[#0D0D0D]"><svg className="ml-1 size-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5L7 4.5Z" /></svg></span>}
        <span className="min-w-0"><span className="block text-xl font-semibold tracking-[-0.02em]">{item.title}</span>{item.credit && <span className="block text-sm text-white/80">{item.credit}</span>}</span>
      </span>
    </>
  );
  const frame = "relative isolate flex aspect-[16/10] w-full items-end overflow-hidden rounded-[22px] bg-[#0D0D0D] p-5 text-[#F5F4EF] focus-visible:outline-2 focus-visible:outline-offset-2";
  return (
    <section aria-label={SECTION_NAMES.featured} className="flex flex-col gap-3" data-creator-featured>
      <p className={label}>Featured{item.kind === "video" ? " · Film" : ""}</p>
      {href ? <a className={frame} href={href} rel="noreferrer" target="_blank">{body}</a> : <div className={frame}>{body}</div>}
    </section>
  );
}

function SelectedWork({ items }: { items: WorkItem[] }) {
  return (
    <section aria-labelledby="creator-work" className="flex flex-col gap-3.5" data-creator-work>
      <h2 className="font-display text-[26px] font-bold tracking-[-0.04em]" id="creator-work">Selected work</h2>
      <div className="grid grid-cols-2 gap-2.5 @min-[700px]/profile:grid-cols-3">
        {items.slice(0, 9).map((item) => {
          const href = item.url ?? item.videoUrl ?? item.imageUrl ?? undefined;
          const tile = (
            <>
              {item.imageUrl && <>
                {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase image or provider thumbnail */}
                <img alt={item.title} className="absolute inset-0 -z-10 size-full object-cover" loading="lazy" src={item.imageUrl} />
              </>}
              <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_55%,rgba(13,13,13,.7))]" />
              <span className="text-[13px] font-semibold text-white">{item.title}</span>
            </>
          );
          const cls = "relative isolate flex aspect-[4/5] items-end overflow-hidden rounded-[16px] p-3 focus-visible:outline-2";
          return href
            ? <a className={cls} href={href} key={item.id} rel="noreferrer" style={{ background: line }} target="_blank">{tile}</a>
            : <div className={cls} key={item.id} style={{ background: line }}>{tile}</div>;
        })}
      </div>
    </section>
  );
}

/** One offering reads as a story; several read as editorial rows. Every row says what it is. */
function Store({ offers, accent, accentInk }: { offers: Pick<StoreOffer, "id" | "title" | "description" | "currency" | "unit_amount_minor" | "offer_type" | "external_url">[]; accent: string; accentInk: string }) {
  return (
    <section aria-labelledby="creator-store" className="flex flex-col gap-3.5" data-creator-store>
      <h2 className="font-display text-[26px] font-bold tracking-[-0.04em]" id="creator-store">From the shop</h2>
      {offers.length === 1 ? <OneOffer accent={accent} accentInk={accentInk} offer={offers[0]} /> : (
        <ul className="flex flex-col">
          {offers.map((offer) => {
            const external = offer.offer_type === "external" && offer.external_url;
            const row = (
              <>
                <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{offer.title}</span><span className="block truncate text-[13px] opacity-65">{OFFER_TYPE_LABEL[offer.offer_type]}{offer.description ? ` · ${offer.description}` : ""}</span></span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatMoney(offer.unit_amount_minor, offer.currency)}</span>
              </>
            );
            return (
              <li className="border-b py-3 first:pt-0" key={offer.id} style={{ borderColor: line }}>
                {external ? <a className="flex items-center gap-4 rounded-lg focus-visible:outline-2" href={offer.external_url!} rel="noreferrer nofollow" target="_blank">{row}</a> : <div className="flex items-center gap-4">{row}</div>}
              </li>
            );
          })}
        </ul>
      )}
      {offers.some((offer) => offer.offer_type === "external") && <p className="text-[12px] opacity-60">↗ opens the creator’s own shop outside Setuvara.</p>}
    </section>
  );
}

function OneOffer({ offer, accent, accentInk }: { offer: Pick<StoreOffer, "title" | "description" | "currency" | "unit_amount_minor" | "offer_type" | "external_url">; accent: string; accentInk: string }) {
  const price = formatMoney(offer.unit_amount_minor, offer.currency);
  return (
    <div className="flex flex-col gap-3 rounded-[22px] p-5" style={{ boxShadow: `inset 0 0 0 1px ${line}` }}>
      <p className={label}>{OFFER_TYPE_LABEL[offer.offer_type]}</p>
      <p className="font-display text-[30px] font-bold leading-none tracking-[-0.04em]">{offer.title}</p>
      {offer.description && <p className="whitespace-pre-line text-[15px] leading-[1.5] opacity-80">{offer.description}</p>}
      {offer.offer_type === "external" && offer.external_url
        ? <a className="mt-1 inline-flex min-h-12 w-fit items-center rounded-full px-5 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2" href={offer.external_url} rel="noreferrer nofollow" style={{ background: accent, color: accentInk }} target="_blank">Buy · {price} ↗</a>
        : <p className="text-[15px] font-semibold">{price}</p>}
    </div>
  );
}
