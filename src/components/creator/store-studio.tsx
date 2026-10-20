"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, Segmented, Sheet, TextArea, TextInput } from "@/app/app/identity/editor-ui";
import { formatMoney, OFFER_TYPE_LABEL, OFFER_TYPE_TINT, OFFER_TYPES, parseMoney, type OfferType, type StoreOffer } from "@/lib/creator/studio";
import { createClient } from "@/lib/supabase/client";
import { CreatorSections } from "./creator-sections";
import { EmptyState, inkButton, lineButton, Mono, StudioHead } from "./studio-ui";

type Draft = { id: string | null; offer_type: OfferType; title: string; description: string; price: string; currency: string; external_url: string; live: boolean };
const blank: Draft = { id: null, offer_type: "external", title: "", description: "", price: "", currency: "EUR", external_url: "", live: true };
const STATUS_LABEL: Record<StoreOffer["status"], string> = { draft: "Draft", active: "Live", paused: "Paused", archived: "Archived" };

export type StoreOrder = { id: string; offer_id: string; gross_amount_minor: number; currency: string; status: string; created_at: string };

/**
 * The Store. External offers link to the creator's own shop and work today. Paid offers that sell
 * on Setuvara are saved as drafts until monetization is approved; the database enforces the same.
 */
export function StoreStudio({ profileId, offers, canMonetize, orders, firstName }: { profileId: string; offers: StoreOffer[]; canMonetize: boolean; orders: StoreOrder[]; firstName: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = offers.filter((offer) => offer.status === "active");
  const paid = orders.filter((order) => order.status === "paid");
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const monthOrders = paid.filter((order) => new Date(order.created_at) >= month);
  const monthTotal = monthOrders.reduce((sum, order) => sum + order.gross_amount_minor, 0);
  const monthCurrency = monthOrders[0]?.currency ?? "EUR";

  function open(offer?: StoreOffer) {
    setError(null);
    setDraft(offer ? { id: offer.id, offer_type: offer.offer_type, title: offer.title, description: offer.description, price: (offer.unit_amount_minor / 100).toString(), currency: offer.currency, external_url: offer.external_url ?? "", live: offer.status === "active" } : { ...blank });
  }

  async function save() {
    if (!draft) return;
    const amount = parseMoney(draft.price);
    if (!draft.title.trim()) { setError("Give it a name."); return; }
    if (!amount) { setError("Add a price."); return; }
    const external = draft.offer_type === "external";
    if (external && !/^https:\/\/[^\s/]+/.test(draft.external_url.trim())) { setError("Paste the full https:// link to your shop."); return; }
    // Paid offers stay drafts until monetization is approved.
    const status = draft.live && (external || canMonetize) ? "active" : "draft";
    const row = { offer_type: draft.offer_type, kind: "one_time", title: draft.title.trim(), description: draft.description.trim(), unit_amount_minor: amount, currency: draft.currency, external_url: external ? draft.external_url.trim() : null, status };
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // Moving between external and paid while live would trip the approval check; go via draft.
    const result = draft.id
      ? await supabase.from("creator_offers").update(row).eq("id", draft.id).eq("creator_user_id", profileId)
      : await supabase.from("creator_offers").insert({ ...row, creator_user_id: profileId, sort_order: offers.length });
    setBusy(false);
    if (result.error) { setError(result.error.code === "42501" ? "Paid offers go live after monetization approval. Save it as a draft for now." : "That didn’t save. Try again."); return; }
    setDraft(null);
    router.refresh();
  }

  async function archive() {
    if (!draft?.id) return;
    setBusy(true);
    const { error: updateError } = await createClient().from("creator_offers").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", draft.id).eq("creator_user_id", profileId);
    setBusy(false);
    if (updateError) { setError("That didn’t remove. Try again."); return; }
    setDraft(null);
    router.refresh();
  }

  const add = <button className={inkButton} onClick={() => open()} type="button">+ Add offer</button>;
  const paidType = draft && draft.offer_type !== "external";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
      <div className="min-w-0">
        <StudioHead action={offers.length ? add : undefined} sub={live.length ? "How it looks on your page" : undefined} title="Store" />
        {offers.length === 0 ? (
          <EmptyState action={add} body="One offer is enough. Link to a shop you already have, or prepare products to sell here once payments open." title="Sell one thing well." />
        ) : (
          <div className="grid gap-6">
            {live.length > 0 && (
              <div className="rounded-[26px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] md:p-8" data-store-preview>
                <CreatorSections accent="#FF5A4F" accentInk="#0D0D0D" firstName={firstName} offers={live} settings={{ tagline: "", category: "", city: "", sections: ["store"], collabsOpen: false, collabsNote: "", collabsPitch: "" }} work={[]} />
              </div>
            )}
            <section aria-label="All offers">
              <Mono className="mb-2 text-black/60">All offers</Mono>
              <ul className="divide-y divide-black/10 border-y border-black/10">
                {offers.map((offer) => (
                  <li key={offer.id}>
                    <button className="flex w-full items-center gap-4 py-3.5 text-left hover:bg-black/[0.02] focus-visible:outline-2" onClick={() => open(offer)} type="button">
                      <span className="shrink-0 rounded-md px-2 py-1 font-label text-[10px] tracking-[0.12em]" style={{ background: OFFER_TYPE_TINT[offer.offer_type] }}>{OFFER_TYPE_LABEL[offer.offer_type].toUpperCase()}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{offer.title}</span>{offer.description && <span className="block truncate text-[13px] text-black/60">{offer.description}</span>}</span>
                      <span className={`shrink-0 font-label text-[11px] tracking-[0.12em] ${offer.status === "active" ? "text-[#1F7A4D]" : "text-black/50"}`}>{STATUS_LABEL[offer.status].toUpperCase()}</span>
                      <span className="w-20 shrink-0 text-right text-[15px] font-semibold tabular-nums">{formatMoney(offer.unit_amount_minor, offer.currency)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-6 lg:pt-3">
        <div>
          <Mono className="text-black/60">{month.toLocaleDateString("en-GB", { month: "long" })} so far</Mono>
          <p className="mt-1 font-display text-[48px] font-bold leading-none tracking-[-0.05em]">{formatMoney(monthTotal, monthCurrency, { compact: true })}</p>
          <p className="mt-2 text-[15px] text-black/65">{monthOrders.length} {monthOrders.length === 1 ? "order" : "orders"} on Setuvara</p>
        </div>
        <div className="border-t-[1.5px] border-[#0D0D0D] pt-4">
          <Mono className="mb-3 text-black/60">Payments</Mono>
          {canMonetize
            ? <p className="text-[15px] leading-[1.5] text-black/75">Monetization is approved. Checkout opens when the payment provider is connected.</p>
            : <p className="text-[15px] leading-[1.5] text-black/75">Selling on Setuvara opens after monetization approval. External offers work today and send visitors to your own shop.</p>}
        </div>
        <p className="mt-auto border-t border-black/10 pt-4 text-[13px] leading-[1.5] text-black/60">Links marked ↗ open your own shop elsewhere. Visitors always see that before they leave Setuvara.</p>
      </aside>

      {draft && (
        <Sheet
          footer={(
            <div className="flex flex-wrap items-center justify-between gap-2">
              {draft.id ? <button className="min-h-11 rounded-full px-3 text-sm font-semibold text-[#B42318] hover:bg-[#B42318]/[0.06] disabled:opacity-50" disabled={busy} onClick={() => void archive()} type="button">Remove</button> : <span />}
              <div className="flex gap-2"><button className={lineButton} onClick={() => setDraft(null)} type="button">Cancel</button><button className={inkButton} disabled={busy} onClick={() => void save()} type="button">{busy ? "Saving…" : "Save"}</button></div>
            </div>
          )}
          onClose={() => setDraft(null)}
          title={draft.id ? "Edit offer" : "Add offer"}
        >
          <div className="grid gap-5">
            <div>
              <p className="mb-2 text-sm font-semibold">Type</p>
              <div className="flex flex-wrap gap-2">
                {OFFER_TYPES.map((type) => <button aria-pressed={draft.offer_type === type} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${draft.offer_type === type ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]"}`} key={type} onClick={() => setDraft({ ...draft, offer_type: type })} type="button">{OFFER_TYPE_LABEL[type]}</button>)}
              </div>
            </div>
            {draft.offer_type === "external" && <Field hint="Visitors leave Setuvara for this link" htmlFor="offer-url" label="Shop link"><TextInput id="offer-url" inputMode="url" onChange={(event) => setDraft({ ...draft, external_url: event.target.value })} placeholder="https://yourshop.com/print" value={draft.external_url} /></Field>}
            <Field htmlFor="offer-title" label="Name"><TextInput id="offer-title" maxLength={120} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Lisbon Light presets" value={draft.title} /></Field>
            <Field htmlFor="offer-description" label="What they get"><TextArea id="offer-description" maxLength={2000} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="12 Lightroom presets and a video guide." value={draft.description} /></Field>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field htmlFor="offer-price" label="Price"><TextInput id="offer-price" inputMode="decimal" onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="24" value={draft.price} /></Field>
              <Field label="Currency"><Segmented label="Currency" onChange={(currency) => setDraft({ ...draft, currency })} options={[{ value: "EUR", label: "€" }, { value: "USD", label: "$" }, { value: "GBP", label: "£" }]} value={draft.currency} /></Field>
            </div>
            <Field label="On your page">
              <Segmented label="On your page" onChange={(value) => setDraft({ ...draft, live: value === "live" })} options={[{ value: "live", label: "Live", disabled: Boolean(paidType && !canMonetize) }, { value: "draft", label: "Draft" }]} value={draft.live && !(paidType && !canMonetize) ? "live" : "draft"} />
            </Field>
            {paidType && !canMonetize && <p className="rounded-2xl bg-[#FFE7B8] px-4 py-3 text-sm leading-[1.45]">Paid offers go live after monetization approval. It saves as a draft until then.</p>}
            {error && <p className="text-sm font-medium text-[#B42318]" role="alert">{error}</p>}
          </div>
        </Sheet>
      )}
    </div>
  );
}
