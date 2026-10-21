import type { ReactNode } from "react";

import { ActionViewBeacon } from "@/components/actions/action-beacon";
import { ActionCard } from "@/components/actions/action-card";
import type { PublicAction } from "@/lib/actions/model";
import { formatMoney, OFFER_TYPE_LABEL, SECTION_NAMES, type CreatorSection, type CreatorSettings, type StoreOffer, type WorkItem } from "@/lib/creator/studio";

/**
 * The Creator sections of a page: Featured, Work, Store and Actions, in the creator's order.
 * They sit inside any Appearance, so colour comes from currentColor and the page's accent.
 */
/** A Work piece this visitor can't open yet: an exclusive or an early-access drop. Never the piece itself. */
export type LockedPiece = { id: string; title: string; hint: string };

export function CreatorSections({ settings, work, offers, productHref, actions = [], actionHref, accent, accentInk, locked = [] }: {
  settings: CreatorSettings;
  work: WorkItem[];
  offers: ShopOffer[];
  /** Where a product sold on Setuvara opens. Absent in previews and for the owner. */
  productHref?: (id: string) => string;
  /** Live Actions with their cover pictures. */
  actions?: { action: PublicAction; coverUrl: string | null }[];
  /** Where an Action's button goes. Absent in previews and for the owner. */
  actionHref?: (id: string) => string;
  accent: string;
  accentInk: string;
  /** Pieces for fans only, shown as locked cards beside the work. */
  locked?: LockedPiece[];
}) {
  const visible = work.filter((item) => item.visible);
  const featured = visible.find((item) => item.featured) ?? null;
  const rest = visible.filter((item) => item !== featured);
  const parts: Record<CreatorSection, ReactNode> = {
    featured: featured ? <FeaturedWork item={featured} key="featured" /> : null,
    work: rest.length || locked.length ? <SelectedWork items={rest} key="work" locked={locked} /> : null,
    store: offers.length ? <Store accent={accent} accentInk={accentInk} key="store" offers={offers} productHref={productHref} /> : null,
    actions: actions.length ? (
      <ActionViewBeacon className="flex flex-col gap-4" data-creator-actions ids={actionHref ? actions.map(({ action }) => action.id) : []} key="actions">
        {actions.map(({ action, coverUrl }) => <ActionCard accent={accent} accentInk={accentInk} action={action} coverUrl={coverUrl} href={actionHref?.(action.id)} key={action.id} />)}
      </ActionViewBeacon>
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

function SelectedWork({ items, locked = [] }: { items: WorkItem[]; locked?: LockedPiece[] }) {
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
        {locked.slice(0, 6).map((piece) => (
          <div className="relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-[16px] p-3" data-locked-piece key={piece.id} style={{ boxShadow: `inset 0 0 0 1px ${line}`, background: "color-mix(in srgb, currentColor 5%, transparent)" }}>
            <svg aria-hidden="true" className="size-5 opacity-70" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><rect height="10" rx="2.2" width="14" x="5" y="10.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
            <span className="flex flex-col gap-1"><span className="text-[13px] font-semibold leading-tight">{piece.title}</span><span className="text-[11.5px] leading-snug opacity-65">{piece.hint}</span></span>
          </div>
        ))}
      </div>
    </section>
  );
}

type ShopOffer = Pick<StoreOffer, "id" | "title" | "description" | "currency" | "unit_amount_minor" | "offer_type" | "external_url"> & { coverUrl?: string | null; sellsHere?: boolean; soldOut?: boolean };

const priceLabel = (offer: ShopOffer) => (offer.unit_amount_minor === 0 ? "Free" : formatMoney(offer.unit_amount_minor, offer.currency));
/** Where an offer goes: the product page for things sold here, the creator's own shop for links out, nowhere in previews. */
function target(offer: ShopOffer, productHref?: (id: string) => string) {
  if (offer.offer_type === "external" && offer.external_url) return { href: offer.external_url, external: true };
  if (offer.sellsHere && productHref) return { href: productHref(offer.id), external: false };
  return null;
}

/** One offering reads as a story; several read as editorial rows. Every row says what it is. */
function Store({ offers, accent, accentInk, productHref }: { offers: ShopOffer[]; accent: string; accentInk: string; productHref?: (id: string) => string }) {
  return (
    <section aria-labelledby="creator-store" className="flex flex-col gap-3.5" data-creator-store>
      <h2 className="font-display text-[26px] font-bold tracking-[-0.04em]" id="creator-store">From the shop</h2>
      {offers.length === 1 ? <OneOffer accent={accent} accentInk={accentInk} offer={offers[0]} productHref={productHref} /> : (
        <ul className="flex flex-col">
          {offers.map((offer) => {
            const link = target(offer, productHref);
            const row = (
              <>
                {offer.coverUrl && <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed product cover */}
                  <img alt="" className="size-14 shrink-0 rounded-[12px] object-cover" loading="lazy" src={offer.coverUrl} />
                </>}
                <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{offer.title}</span><span className="block truncate text-[13px] opacity-65">{OFFER_TYPE_LABEL[offer.offer_type]}{offer.description ? ` · ${offer.description}` : ""}</span></span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums">{offer.soldOut ? "Sold out" : priceLabel(offer)}</span>
              </>
            );
            return (
              <li className="border-b py-3 first:pt-0" data-offer={offer.id} key={offer.id} style={{ borderColor: line }}>
                {link ? <a className="flex items-center gap-4 rounded-lg focus-visible:outline-2" href={link.href} {...(link.external ? { rel: "noreferrer nofollow", target: "_blank" } : {})}>{row}</a> : <div className="flex items-center gap-4">{row}</div>}
              </li>
            );
          })}
        </ul>
      )}
      {offers.some((offer) => offer.offer_type === "external") && <p className="text-[12px] opacity-60">↗ opens the creator’s own shop outside Setuvara.</p>}
    </section>
  );
}

function OneOffer({ offer, accent, accentInk, productHref }: { offer: ShopOffer; accent: string; accentInk: string; productHref?: (id: string) => string }) {
  const link = target(offer, productHref);
  const price = priceLabel(offer);
  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-[22px] p-5" data-offer={offer.id} style={{ boxShadow: `inset 0 0 0 1px ${line}` }}>
      {offer.coverUrl && <>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed product cover */}
        <img alt="" className="-mx-5 -mt-5 mb-1 aspect-[16/10] w-[calc(100%+2.5rem)] max-w-none object-cover" loading="lazy" src={offer.coverUrl} />
      </>}
      <p className={label}>{OFFER_TYPE_LABEL[offer.offer_type]}</p>
      <p className="font-display text-[30px] font-bold leading-none tracking-[-0.04em]">{offer.title}</p>
      {offer.description && <p className="line-clamp-4 whitespace-pre-line text-[15px] leading-[1.5] opacity-80">{offer.description}</p>}
      {link && !offer.soldOut
        ? <a className="mt-1 inline-flex min-h-12 w-fit items-center rounded-full px-5 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2" href={link.href} style={{ background: accent, color: accentInk }} {...(link.external ? { rel: "noreferrer nofollow", target: "_blank" } : {})}>{offer.unit_amount_minor === 0 ? "Get it free" : `Buy · ${price}`}{link.external ? " ↗" : ""}</a>
        : <p className="text-[15px] font-semibold">{offer.soldOut ? "Sold out" : price}</p>}
    </div>
  );
}
