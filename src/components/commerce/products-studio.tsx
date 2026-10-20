"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Field, Segmented, Sheet, TextArea, TextInput } from "@/app/app/identity/editor-ui";
import { EmptyState, inkButton, lineButton, Mono, StudioHead } from "@/components/creator/studio-ui";
import { formatAmount, MIN_PRICE_MINOR, type CommerceCurrency } from "@/lib/commerce/model";
import type { CommerceProduct } from "@/lib/commerce/studio-server";
import { parseMoney } from "@/lib/creator/studio";
import { createClient } from "@/lib/supabase/client";
import { fileSize } from "./ui";

type Kind = "digital" | "service" | "booking" | "external";
const KINDS: { value: Kind; label: string; line: string }[] = [
  { value: "digital", label: "Digital product", line: "Presets, templates, guides. Buyers get a download link." },
  { value: "service", label: "Service", line: "A paid service. You follow up with the buyer by email." },
  { value: "booking", label: "Booking", line: "A paid session or slot. You arrange the time with the buyer." },
  { value: "external", label: "Shop link", line: "Something you sell elsewhere. Visitors leave Setuvara for it." },
];
const KIND_LABEL: Record<CommerceProduct["offer_type"], string> = { digital: "Digital", service: "Service", booking: "Booking", physical: "Physical", external: "Shop link ↗" };
const STATUS_LABEL: Record<CommerceProduct["status"], string> = { draft: "Draft", active: "Live", paused: "Paused", archived: "Archived" };
const BUCKET = "creator-commerce";
const MAX_FILE = 200 * 1024 ** 2;
const MAX_IMAGE = 8 * 1024 ** 2;

type PendingFile = { key: string; file: File };
type Draft = {
  id: string | null;
  kind: Kind;
  title: string;
  description: string;
  free: boolean;
  price: string;
  currency: CommerceCurrency;
  externalUrl: string;
  status: "draft" | "active" | "paused";
  deliveryNote: string;
  downloadDays: string;
  downloadLimit: string;
  quantity: string;
  coverPath: string | null;
  coverPreview: string | null;
  gallery: { path: string; url: string }[];
  files: CommerceProduct["files"];
  newCover: File | null;
  newGallery: File[];
  newFiles: PendingFile[];
  removeFiles: string[];
};

const ERRORS: Record<string, string> = {
  product_needs_file: "Add at least one file before putting a digital product live.",
  price_below_minimum: "The price is below the card minimum (0.50, or £0.30).",
  currency_not_supported: "Choose euro, dollar or pound.",
  physical_not_available: "Physical products can't sell on Setuvara yet. Use a shop link.",
  "monetization approval": "Paid products go live once payments are enabled. It's saved as a draft.",
  last_file_of_live_product: "A live product needs a file. Put it in draft first, or add another file.",
  free_shape: "Only digital products can be free.",
  memberships_not_available: "Memberships aren't available yet.",
};
const errorText = (message: string | undefined) => Object.entries(ERRORS).find(([key]) => message?.includes(key))?.[1] ?? "That didn't save. Try again.";

function fromProduct(product: CommerceProduct): Draft {
  return {
    id: product.id,
    kind: product.offer_type === "physical" ? "digital" : product.offer_type,
    title: product.title,
    description: product.description,
    free: product.unit_amount_minor === 0,
    price: product.unit_amount_minor ? String(product.unit_amount_minor / 100) : "",
    currency: (["EUR", "USD", "GBP"].includes(product.currency) ? product.currency : "EUR") as CommerceCurrency,
    externalUrl: product.external_url ?? "",
    status: product.status === "archived" ? "draft" : product.status,
    deliveryNote: product.delivery_note,
    downloadDays: product.download_days === null ? "forever" : String(product.download_days),
    downloadLimit: String(product.download_limit),
    quantity: product.quantity_limit ? String(product.quantity_limit) : "",
    coverPath: product.cover_path,
    coverPreview: product.coverUrl,
    gallery: product.gallery_paths.map((path, index) => ({ path, url: product.galleryUrls[index] ?? "" })),
    files: product.files,
    newCover: null,
    newGallery: [],
    newFiles: [],
    removeFiles: [],
  };
}
const blank = (currency: CommerceCurrency): Draft => ({ id: null, kind: "digital", title: "", description: "", free: false, price: "", currency, externalUrl: "", status: "draft", deliveryNote: "", downloadDays: "30", downloadLimit: "10", quantity: "", coverPath: null, coverPreview: null, gallery: [], files: [], newCover: null, newGallery: [], newFiles: [], removeFiles: [] });

const extension = (name: string) => (name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? "bin").toLowerCase();
const safeName = (name: string) => name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").trim().slice(0, 120) || "file";

/**
 * Products: digital downloads, services, bookings and shop links. Files and covers
 * upload straight to private storage under the creator's own folder; the database
 * decides what can go live (a file for downloads, payments for paid products).
 */
export function ProductsStudio({ userId, products, canSell, open, sales, views, startNew, defaultCurrency }: {
  userId: string;
  products: CommerceProduct[];
  canSell: boolean;
  /** Commerce is switched on for visitors. */
  open: boolean;
  sales: Record<string, number>;
  views: Record<string, number>;
  startNew: boolean;
  defaultCurrency: CommerceCurrency;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(startNew ? blank(defaultCurrency) : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const preview = (file: File) => { const url = URL.createObjectURL(file); previews.current.push(url); return url; };
  const update = (patch: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...patch } : current));

  async function upload(path: string, file: File) {
    const { error: uploadError } = await createClient().storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) throw new Error("upload_failed");
  }

  async function save() {
    if (!draft) return;
    const supabase = createClient();
    const external = draft.kind === "external";
    const amount = draft.free && draft.kind === "digital" ? 0 : parseMoney(draft.price);
    if (!draft.title.trim()) { setError("Give it a name."); return; }
    if (amount === null) { setError("Add a price."); return; }
    if (amount > 0 && amount < MIN_PRICE_MINOR[draft.currency]) { setError(`The lowest price is ${formatAmount(MIN_PRICE_MINOR[draft.currency], draft.currency)}.`); return; }
    if (external && !/^https:\/\/[^\s/]+/.test(draft.externalUrl.trim())) { setError("Paste the full https:// link to your shop."); return; }
    const quantity = draft.quantity.trim() ? Number(draft.quantity) : null;
    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000)) { setError("Quantity is a whole number from 1."); return; }
    setBusy("save"); setError(null); setNote(null);

    try {
      let coverPath = draft.coverPath;
      if (draft.newCover) { coverPath = `${userId}/cover/${crypto.randomUUID()}.${extension(draft.newCover.name)}`; await upload(coverPath, draft.newCover); }
      const gallery = draft.gallery.map((item) => item.path);
      for (const image of draft.newGallery) { const path = `${userId}/cover/${crypto.randomUUID()}.${extension(image.name)}`; await upload(path, image); gallery.push(path); }

      // Saved as a draft first, so files can attach before the database checks a live product.
      const row = {
        offer_type: draft.kind, kind: "one_time", title: draft.title.trim(), description: draft.description.trim(), unit_amount_minor: amount,
        currency: draft.currency, external_url: external ? draft.externalUrl.trim() : null, cover_path: external ? null : coverPath, gallery_paths: external ? [] : gallery.slice(0, 6),
        delivery_note: draft.kind === "external" ? "" : draft.deliveryNote.trim(), download_days: draft.downloadDays === "forever" ? null : Number(draft.downloadDays),
        download_limit: Number(draft.downloadLimit), quantity_limit: external ? null : quantity,
      };
      let id = draft.id;
      if (id) {
        const { error: updateError } = await supabase.from("creator_offers").update(draft.status === "active" ? row : { ...row, status: draft.status }).eq("id", id).eq("creator_user_id", userId);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { data, error: insertError } = await supabase.from("creator_offers").insert({ ...row, creator_user_id: userId, status: "draft", sort_order: products.length }).select("id").single();
        if (insertError || !data) throw new Error(insertError?.message ?? "insert_failed");
        id = data.id as string;
      }

      if (draft.kind === "digital") {
        for (const [index, pending] of draft.newFiles.entries()) {
          const path = `${userId}/file/${crypto.randomUUID()}/${safeName(pending.file.name)}`;
          await upload(path, pending.file);
          const { error: fileError } = await supabase.from("creator_offer_files").insert({ offer_id: id, creator_user_id: userId, storage_path: path, file_name: safeName(pending.file.name), content_type: pending.file.type || "application/octet-stream", size_bytes: pending.file.size, sort_order: draft.files.length + index });
          if (fileError) throw new Error(fileError.message);
        }
      }

      const stored = !draft.id ? "draft" : draft.status === "active" ? products.find((product) => product.id === draft.id)?.status : draft.status;
      if (stored !== draft.status) {
        const { error: statusError } = await supabase.from("creator_offers").update({ status: draft.status }).eq("id", id).eq("creator_user_id", userId);
        if (statusError) {
          setDraft({ ...draft, id, newCover: null, newGallery: [], newFiles: [], coverPath });
          setBusy(null);
          setError(errorText(statusError.message));
          router.refresh();
          return;
        }
      }
      // Removed files go last, after the product's state is settled.
      for (const fileId of draft.removeFiles) {
        const file = draft.files.find((item) => item.id === fileId);
        const { error: removeError } = await supabase.from("creator_offer_files").delete().eq("id", fileId).eq("creator_user_id", userId);
        if (removeError) { setNote(errorText(removeError.message)); continue; }
        if (file) await supabase.storage.from(BUCKET).remove([file.storage_path]);
      }
      if (draft.newCover && draft.coverPath) await supabase.storage.from(BUCKET).remove([draft.coverPath]);
      setDraft(null);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error && failure.message === "upload_failed" ? "A file didn't upload. Check its size and try again." : errorText(failure instanceof Error ? failure.message : undefined));
    } finally {
      setBusy(null);
    }
  }

  async function archive() {
    if (!draft?.id) return;
    setBusy("archive");
    const { error: archiveError } = await createClient().from("creator_offers").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", draft.id).eq("creator_user_id", userId);
    setBusy(null);
    if (archiveError) { setError("That didn't remove. Try again."); return; }
    setDraft(null);
    router.refresh();
  }

  async function move(product: CommerceProduct, direction: -1 | 1) {
    const index = products.findIndex((item) => item.id === product.id);
    const other = products[index + direction];
    if (!other) return;
    setBusy(`move-${product.id}`);
    const supabase = createClient();
    await Promise.all([
      supabase.from("creator_offers").update({ sort_order: index + direction }).eq("id", product.id).eq("creator_user_id", userId),
      supabase.from("creator_offers").update({ sort_order: index }).eq("id", other.id).eq("creator_user_id", userId),
    ]);
    setBusy(null);
    router.refresh();
  }

  const add = <button className={inkButton} onClick={() => { setError(null); setDraft(blank(defaultCurrency)); }} type="button">+ New product</button>;
  const paid = draft && draft.kind !== "external" && !(draft.kind === "digital" && draft.free);
  const fileCount = draft ? draft.files.filter((file) => !draft.removeFiles.includes(file.id)).length + draft.newFiles.length : 0;

  return (
    <div>
      <StudioHead action={products.length ? add : undefined} sub={products.length ? `${products.filter((product) => product.status === "active").length} live` : undefined} title="Products" />
      {!open && <p className="mb-4 rounded-2xl bg-[#FFE7B8] px-4 py-3 text-[15px]">Only shop links show on your page until payments open on Setuvara. Everything else saves and waits.</p>}
      {products.length === 0 ? (
        <EmptyState action={add} body="Start with one thing: a preset pack, a guide, a session. Free downloads work without payments; paid ones need Stripe." title="Sell one thing well." />
      ) : (
        <ul className="divide-y divide-black/10 border-y border-black/10" data-products>
          {products.map((product, index) => (
            <li className="flex items-center gap-3 py-3" key={product.id}>
              <div className="hidden flex-col sm:flex">
                <button aria-label={`Move ${product.title} up`} className="grid size-7 place-items-center rounded-full text-black/45 hover:bg-black/5 disabled:opacity-25" disabled={index === 0 || busy !== null} onClick={() => void move(product, -1)} type="button">↑</button>
                <button aria-label={`Move ${product.title} down`} className="grid size-7 place-items-center rounded-full text-black/45 hover:bg-black/5 disabled:opacity-25" disabled={index === products.length - 1 || busy !== null} onClick={() => void move(product, 1)} type="button">↓</button>
              </div>
              <button className="flex min-w-0 flex-1 items-center gap-4 rounded-xl text-left hover:bg-black/[0.02] focus-visible:outline-2" onClick={() => { setError(null); setNote(null); setDraft(fromProduct(product)); }} type="button">
                {product.coverUrl
                  // eslint-disable-next-line @next/next/no-img-element -- signed private cover
                  ? <img alt="" className="size-14 shrink-0 rounded-[12px] object-cover" src={product.coverUrl} />
                  : <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-[12px] bg-[#E8E2D4] font-label text-[10px] tracking-[0.12em]">{KIND_LABEL[product.offer_type].slice(0, 4).toUpperCase()}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{product.title}</span>
                  <span className="block truncate text-[13px] text-black/60">{KIND_LABEL[product.offer_type]}{product.offer_type === "digital" ? ` · ${product.files.length} file${product.files.length === 1 ? "" : "s"}` : ""}{product.offer_type !== "external" ? ` · ${views[product.id] ?? 0} views · ${sales[product.id] ?? 0} sold` : ""}</span>
                </span>
                <span className={`hidden shrink-0 font-label text-[11px] tracking-[0.12em] sm:block ${product.status === "active" ? "text-[#1F7A4D]" : "text-black/50"}`}>{STATUS_LABEL[product.status].toUpperCase()}</span>
                <span className="w-20 shrink-0 text-right text-[15px] font-semibold tabular-nums">{product.unit_amount_minor === 0 ? "Free" : formatAmount(product.unit_amount_minor, product.currency)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <Sheet
          footer={(
            <div className="flex flex-wrap items-center justify-between gap-2">
              {draft.id ? <button className="min-h-11 rounded-full px-3 text-sm font-semibold text-[#B42318] hover:bg-[#B42318]/[0.06] disabled:opacity-50" disabled={busy !== null} onClick={() => void archive()} type="button">Remove</button> : <span />}
              <div className="flex gap-2"><button className={lineButton} onClick={() => setDraft(null)} type="button">Cancel</button><button className={inkButton} disabled={busy !== null} onClick={() => void save()} type="button">{busy === "save" ? "Saving…" : "Save"}</button></div>
            </div>
          )}
          onClose={() => setDraft(null)}
          title={draft.id ? "Edit product" : "New product"}
          wide
        >
          <div className="grid gap-5" data-product-editor>
            {!draft.id && (
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="What are you selling?">
                {KINDS.map((kind) => (
                  <button aria-checked={draft.kind === kind.value} className={`rounded-[18px] p-4 text-left transition ${draft.kind === kind.value ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] hover:bg-black/[0.02]"}`} key={kind.value} onClick={() => update({ kind: kind.value, free: kind.value === "digital" ? draft.free : false })} role="radio" type="button">
                    <span className="block text-[15px] font-semibold">{kind.label}</span>
                    <span className={`mt-1 block text-[13px] leading-snug ${draft.kind === kind.value ? "text-white/70" : "text-black/60"}`}>{kind.line}</span>
                  </button>
                ))}
              </div>
            )}

            {draft.kind === "external" && <Field hint="Visitors leave Setuvara for this link" htmlFor="product-url" label="Shop link"><TextInput id="product-url" inputMode="url" onChange={(event) => update({ externalUrl: event.target.value })} placeholder="https://yourshop.com/print" value={draft.externalUrl} /></Field>}
            <Field htmlFor="product-title" label="Name"><TextInput id="product-title" maxLength={120} onChange={(event) => update({ title: event.target.value })} placeholder="Lisbon Light presets" value={draft.title} /></Field>
            <Field htmlFor="product-description" label="What they get"><TextArea id="product-description" maxLength={2000} onChange={(event) => update({ description: event.target.value })} placeholder="12 Lightroom presets, a 20-minute video guide, and before/after RAW files." rows={4} value={draft.description} /></Field>

            <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
              {draft.kind === "digital" && <Field label="Price"><Segmented label="Free or paid" onChange={(value) => update({ free: value === "free" })} options={[{ value: "paid", label: "Paid" }, { value: "free", label: "Free" }]} value={draft.free ? "free" : "paid"} /></Field>}
              {!(draft.kind === "digital" && draft.free) && <Field htmlFor="product-price" label={draft.kind === "digital" ? "Amount" : "Price"}><TextInput id="product-price" inputMode="decimal" onChange={(event) => update({ price: event.target.value })} placeholder="24" value={draft.price} /></Field>}
              {!(draft.kind === "digital" && draft.free) && <Field label="Currency"><Segmented label="Currency" onChange={(currency) => update({ currency: currency as CommerceCurrency })} options={[{ value: "EUR", label: "€" }, { value: "USD", label: "$" }, { value: "GBP", label: "£" }]} value={draft.currency} /></Field>}
            </div>

            {draft.kind !== "external" && (
              <div>
                <p className="mb-2 text-sm font-semibold">Pictures</p>
                <div className="flex flex-wrap gap-2">
                  <button className="relative grid size-24 place-items-center overflow-hidden rounded-[16px] bg-white text-[13px] font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]" onClick={() => coverInput.current?.click()} type="button">
                    {draft.coverPreview
                      // eslint-disable-next-line @next/next/no-img-element -- local or signed preview
                      ? <img alt="Cover" className="absolute inset-0 size-full object-cover" src={draft.coverPreview} />
                      : <span>+ Cover</span>}
                  </button>
                  {draft.gallery.map((item) => (
                    <span className="relative size-24 overflow-hidden rounded-[16px] bg-[#E8E2D4]" key={item.path}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed preview */}
                      {item.url && <img alt="" className="size-full object-cover" src={item.url} />}
                      <button aria-label="Remove picture" className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/60 text-white" onClick={() => update({ gallery: draft.gallery.filter((entry) => entry.path !== item.path) })} type="button">×</button>
                    </span>
                  ))}
                  {draft.newGallery.map((file, index) => <span className="grid size-24 place-items-center rounded-[16px] bg-[#E8E2D4] p-2 text-center text-[11px]" key={`${file.name}-${index}`}>{file.name}</span>)}
                  {draft.gallery.length + draft.newGallery.length < 6 && <button className="grid size-24 place-items-center rounded-[16px] bg-white text-[13px] font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]" onClick={() => galleryInput.current?.click()} type="button">+ More</button>}
                </div>
                <input accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (file.size > MAX_IMAGE) { setError("Pictures can be up to 8 MB."); return; } update({ newCover: file, coverPreview: preview(file) }); }} ref={coverInput} type="file" />
                <input accept="image/jpeg,image/png,image/webp" className="hidden" multiple onChange={(event) => { const files = [...(event.target.files ?? [])].filter((file) => file.size <= MAX_IMAGE); event.target.value = ""; update({ newGallery: [...draft.newGallery, ...files].slice(0, 6 - draft.gallery.length) }); }} ref={galleryInput} type="file" />
              </div>
            )}

            {draft.kind === "digital" && (
              <div data-product-files>
                <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Files buyers get</p><span className="text-[12px] text-black/50">Private. Up to 200 MB each.</span></div>
                <ul className="divide-y divide-black/10 rounded-[16px] bg-white px-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
                  {draft.files.filter((file) => !draft.removeFiles.includes(file.id)).map((file) => (
                    <li className="flex items-center gap-3 py-3 text-[14px]" key={file.id}><span className="min-w-0 flex-1 truncate font-semibold">{file.file_name}</span><span className="text-black/50">{fileSize(file.size_bytes)}</span><button className="text-[13px] font-semibold text-[#B42318]" onClick={() => update({ removeFiles: [...draft.removeFiles, file.id] })} type="button">Remove</button></li>
                  ))}
                  {draft.newFiles.map((pending) => (
                    <li className="flex items-center gap-3 py-3 text-[14px]" key={pending.key}><span className="min-w-0 flex-1 truncate font-semibold">{pending.file.name}</span><span className="text-black/50">{fileSize(pending.file.size)} · new</span><button className="text-[13px] font-semibold text-[#B42318]" onClick={() => update({ newFiles: draft.newFiles.filter((item) => item.key !== pending.key) })} type="button">Remove</button></li>
                  ))}
                  <li className="py-2"><button className="min-h-10 text-[14px] font-semibold underline underline-offset-4" onClick={() => fileInput.current?.click()} type="button">+ Add files</button></li>
                </ul>
                <input className="hidden" multiple onChange={(event) => { const files = [...(event.target.files ?? [])]; event.target.value = ""; const big = files.find((file) => file.size > MAX_FILE); if (big) setError(`${big.name} is over 200 MB.`); update({ newFiles: [...draft.newFiles, ...files.filter((file) => file.size <= MAX_FILE).map((file) => ({ key: crypto.randomUUID(), file }))].slice(0, 20) }); }} ref={fileInput} type="file" />
                {fileCount === 0 && <p className="mt-2 text-[13px] text-black/55">Add a file to put this live.</p>}
              </div>
            )}

            {draft.kind !== "external" && (
              <details className="rounded-[18px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
                <summary className="cursor-pointer text-[15px] font-semibold">Delivery and limits</summary>
                <div className="mt-4 grid gap-4">
                  <Field hint="Sent with the download link or the order confirmation" htmlFor="product-note" label={draft.kind === "digital" ? "Note for buyers" : "What happens next"}><TextArea id="product-note" maxLength={1000} onChange={(event) => update({ deliveryNote: event.target.value })} placeholder={draft.kind === "digital" ? "Import the .xmp files in Lightroom: Develop → Presets → Import." : "I'll email you within two days to set a time."} rows={3} value={draft.deliveryNote} /></Field>
                  {draft.kind === "digital" && <Field label="Download link works for"><Segmented label="Link lifetime" onChange={(value) => update({ downloadDays: value })} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "365", label: "1 year" }, { value: "forever", label: "Always" }]} value={draft.downloadDays} /></Field>}
                  {draft.kind === "digital" && <Field label="Downloads per link"><Segmented label="Downloads per link" onChange={(value) => update({ downloadLimit: value })} options={[{ value: "5", label: "5" }, { value: "10", label: "10" }, { value: "25", label: "25" }]} value={draft.downloadLimit} /></Field>}
                  <Field hint="Leave empty for no limit" htmlFor="product-quantity" label="How many you sell"><TextInput id="product-quantity" inputMode="numeric" onChange={(event) => update({ quantity: event.target.value.replace(/\D/g, "") })} placeholder="No limit" value={draft.quantity} /></Field>
                </div>
              </details>
            )}

            <Field label="On your page">
              <Segmented label="On your page" onChange={(value) => update({ status: value as Draft["status"] })} options={[{ value: "active", label: "Live" }, { value: "paused", label: "Paused" }, { value: "draft", label: "Draft" }]} value={draft.status} />
            </Field>
            {paid && !canSell && draft.status === "active" && <p className="rounded-2xl bg-[#FFE7B8] px-4 py-3 text-sm leading-[1.45]">Paid products go live once payments are enabled. <Link className="font-semibold underline underline-offset-4" href="/app/identity/creator/commerce/payments">Set up payments</Link></p>}
            {note && <p className="text-sm text-black/70" role="status">{note}</p>}
            {error && <p className="text-sm font-medium text-[#B42318]" role="alert">{error}</p>}
            <Mono className="text-black/45">{draft.kind === "external" ? "Shop links never take payment on Setuvara" : "You are the seller. Buyers see your name at checkout."}</Mono>
          </div>
        </Sheet>
      )}
    </div>
  );
}
