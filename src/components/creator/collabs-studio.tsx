"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Sheet } from "@/app/app/identity/editor-ui";
import { formatMoney, INQUIRY_BUDGET_LABEL, INQUIRY_KIND_LABEL, INQUIRY_STATUS_LABEL, INQUIRY_STATUS_TONE, initials, relativeTime, type Inquiry, type InquiryBudget, type InquiryStatus, type KitRate } from "@/lib/creator/studio";
import { createClient } from "@/lib/supabase/client";
import { coralButton, EmptyState, FilterPill, lineButton, Mono } from "./studio-ui";

export type InquiryContact = { replyHref: string | null; pageHref: string | null };

const FILTERS: { label: string; match: (status: InquiryStatus) => boolean }[] = [
  { label: "All", match: () => true },
  { label: "New", match: (status) => status === "new" },
  { label: "In talks", match: (status) => status === "in_talks" },
  { label: "Booked", match: (status) => status === "booked" || status === "delivered" },
];
const STEPS: InquiryStatus[] = ["new", "in_talks", "booked", "delivered"];
const MODE_NAME = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" } as const;
const BUDGET_RANGE: Record<InquiryBudget, [number, number] | null> = { under_2k: [0, 2000_00], "2k_5k": [2000_00, 5000_00], "5k_10k": [5000_00, 10000_00], "10k_plus": [10000_00, Number.MAX_SAFE_INTEGER], unsure: null };
const TINTS = ["#AFCBFF", "#C7FF4A", "#FFE7B8", "#E6E4DC", "#E6DCFF"];

/** Compares the stated budget with the creator's own euro rates. Says nothing without rates. */
function fitLine(budget: InquiryBudget, rates: KitRate[]) {
  const euro = rates.filter((rate) => rate.currency === "EUR").map((rate) => rate.amount_minor);
  const range = BUDGET_RANGE[budget];
  if (!euro.length || !range) return null;
  const lowest = Math.min(...euro);
  if (range[1] <= lowest) return `Below your lowest rate (${formatMoney(lowest, "EUR")}). Worth countering.`;
  return range[0] >= lowest ? "Inside your rate card." : `Your lowest rate (${formatMoney(lowest, "EUR")}) sits inside this budget.`;
}

/**
 * The list is for triage and the detail is for deciding. Status is always visible. Replies continue
 * in Connect Chat once the two of you are connected, so there is no second inbox.
 */
export function CollabsStudio({ inquiries, contacts, rates, collabsOpen, initialId = null }: { inquiries: Inquiry[]; contacts: Record<string, InquiryContact>; rates: KitRate[]; collabsOpen: boolean; initialId?: string | null }) {
  const router = useRouter();
  const [filter, setFilter] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(inquiries.some((item) => item.id === initialId) ? initialId : inquiries[0]?.id ?? null);
  // Opened from a Home action: on phones the inquiry opens straight away.
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialId && inquiries.some((item) => item.id === initialId)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = useMemo(() => inquiries.filter((item) => FILTERS[filter].match(item.status)), [inquiries, filter]);
  const selected = inquiries.find((item) => item.id === selectedId) ?? shown[0] ?? null;

  async function setStatus(item: Inquiry, status: InquiryStatus) {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await createClient().rpc("creator_set_inquiry_status", { p_inquiry_id: item.id, p_status: status });
    setBusy(false);
    if (rpcError || data !== true) { setError("That didn’t save. Try again."); return; }
    router.refresh();
  }

  if (!inquiries.length) {
    return <EmptyState body={collabsOpen ? "Your page shows Work with me. Inquiries from brands and members land here, with budget and dates up front." : "Turn on collabs in Settings to add a Work with me button to your page. Inquiries land here."} title={collabsOpen ? "No inquiries yet." : "Collabs are closed."} action={collabsOpen ? undefined : <Link className={coralButton} href="/app/identity/creator/settings">Open for collabs</Link>} />;
  }

  const detail = selected && <InquiryDetail busy={busy} contact={contacts[selected.id]} error={error} fit={fitLine(selected.budget, rates)} item={selected} onStatus={(status) => void setStatus(selected, status)} />;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(300px,390px)_minmax(0,1fr)] md:gap-0">
      <div className="md:border-r md:border-black/10 md:pr-7">
        <div className="-mx-3.5 mb-4 flex gap-2 overflow-x-auto px-3.5 [scrollbar-width:none] md:mx-0 md:px-0">
          {FILTERS.map((item, index) => <FilterPill count={inquiries.filter((entry) => item.match(entry.status)).length} key={item.label} label={item.label} on={filter === index} onClick={() => setFilter(index)} />)}
        </div>
        <ul className="flex flex-col gap-1">
          {shown.map((item, index) => {
            const on = selected?.id === item.id;
            const name = item.brand || item.sender_display_name;
            const tone = INQUIRY_STATUS_TONE[item.status];
            return (
              <li key={item.id}>
                <button aria-current={on ? "true" : undefined} className={`flex w-full items-center gap-3.5 rounded-[18px] p-3.5 text-left transition focus-visible:outline-2 ${on ? "md:bg-white md:shadow-[0_1px_0_rgba(13,13,13,.04)]" : "hover:bg-black/[0.03]"}`} onClick={() => { setSelectedId(item.id); setSheetOpen(true); }} type="button">
                  <span className="grid size-12 shrink-0 place-items-center rounded-[14px] text-[17px] font-bold" style={{ background: TINTS[index % TINTS.length] }}>{initials(name)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{name}</span><span className="block truncate text-[14px] text-black/65">{INQUIRY_KIND_LABEL[item.kind]} · {INQUIRY_BUDGET_LABEL[item.budget]}</span></span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5"><span className="rounded-[5px] px-2 py-[3px] font-label text-[10px] tracking-[0.12em]" style={{ background: tone.bg, color: tone.fg }}>{INQUIRY_STATUS_LABEL[item.status].toUpperCase()}</span><span className="text-[12px] text-black/55">{relativeTime(item.created_at)}</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="hidden min-w-0 md:block md:pl-10">{detail}</div>
      {sheetOpen && selected && <div className="md:hidden"><Sheet onClose={() => setSheetOpen(false)} title={selected.brand || selected.sender_display_name}>{detail}</Sheet></div>}
    </div>
  );
}

function InquiryDetail({ item, contact, fit, busy, error, onStatus }: { item: Inquiry; contact?: InquiryContact; fit: string | null; busy: boolean; error: string | null; onStatus: (status: InquiryStatus) => void }) {
  const step = STEPS.indexOf(item.status);
  const facts = [["Budget", INQUIRY_BUDGET_LABEL[item.budget]], ["For", INQUIRY_KIND_LABEL[item.kind]], ["Sent as", `${MODE_NAME[item.sender_mode_slug]} Mode`], ["Received", new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })]];
  const next: InquiryStatus | null = item.status === "new" ? "in_talks" : item.status === "in_talks" ? "booked" : item.status === "booked" ? "delivered" : null;
  return (
    <article className="flex min-h-full flex-col gap-6" data-inquiry-detail>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Mono className="text-black/60">{INQUIRY_KIND_LABEL[item.kind]} · received {relativeTime(item.created_at)}</Mono>
          <h2 className="mt-2 font-display text-[34px] font-bold leading-[1] tracking-[-0.05em] md:text-[44px]">{item.brand ? `${item.brand}` : `${INQUIRY_KIND_LABEL[item.kind]} inquiry`}</h2>
          <p className="mt-2 text-[16px] text-black/70">From {item.sender_display_name}{item.brand ? ` at ${item.brand}` : ""}</p>
        </div>
        {item.status === "declined"
          ? <span className="rounded-full bg-[#E6E4DC] px-3 py-1.5 text-sm font-semibold">Declined</span>
          : <ol aria-label="Progress" className="flex items-center gap-2">{STEPS.map((status, index) => <li className={`flex items-center gap-2 text-[13px] ${index <= step ? "font-semibold" : "text-black/45"}`} key={status}><span aria-hidden="true" className="h-[3px] w-5 rounded-full" style={{ background: index <= step ? "#FF5A4F" : "rgba(13,13,13,.15)" }} />{INQUIRY_STATUS_LABEL[status]}</li>)}</ol>}
      </header>
      <dl className="grid grid-cols-2 gap-5 border-y-[1.5px] border-[#0D0D0D] py-5 sm:grid-cols-4">
        {facts.map(([key, value]) => <div key={key}><dt className="font-label text-[11px] uppercase tracking-[0.16em] text-black/60">{key}</dt><dd className="mt-1.5 text-[20px] font-semibold tracking-[-0.02em]">{value}</dd></div>)}
      </dl>
      <section><Mono className="mb-2 text-black/60">The brief</Mono><p className="max-w-[62ch] whitespace-pre-line text-[17px] leading-[1.6]">{item.message}</p></section>
      {fit && <p className="flex items-center gap-3 rounded-[16px] bg-[#E8E2D4] px-4 py-3 text-[15px]"><span className="rounded-md bg-[#0D0D0D] px-2 py-1 font-label text-[10px] tracking-[0.14em] text-[#F5F4EF]">FIT</span>{fit}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
        {contact?.replyHref
          ? <a className={coralButton} href={contact.replyHref}>Reply in Connect Chat</a>
          : contact?.pageHref ? <a className={coralButton} href={contact.pageHref} rel="noreferrer" target="_blank">Open their page to connect</a> : null}
        {next && <button className={lineButton} disabled={busy} onClick={() => onStatus(next)} type="button">Mark {INQUIRY_STATUS_LABEL[next].toLowerCase()}</button>}
        {item.status !== "declined" && item.status !== "delivered" && <button className="min-h-11 rounded-full px-4 text-[15px] font-semibold text-black/70 hover:bg-black/[0.04] disabled:opacity-50" disabled={busy} onClick={() => onStatus("declined")} type="button">Decline</button>}
        {item.status === "declined" && <button className={lineButton} disabled={busy} onClick={() => onStatus("new")} type="button">Reopen</button>}
        <p className="w-full text-[13px] text-black/55 md:ml-auto md:w-auto">{contact?.replyHref ? "Replies continue in Connect Chat." : "Connect first and replies continue in Connect Chat."}</p>
      </div>
      {error && <p className="text-sm font-medium text-[#B42318]" role="alert">{error}</p>}
    </article>
  );
}
