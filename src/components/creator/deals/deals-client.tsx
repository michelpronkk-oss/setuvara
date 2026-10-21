"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { addDealNote, dealDetail, setDealAmount, setDealStage } from "@/app/app/identity/creator/collabs/actions";
import { PlusTag, Sheet } from "@/app/app/identity/editor-ui";
import { FilterPill, inkButton, lineButton, Mono } from "@/components/creator/studio-ui";
import { BUDGET_LABEL, COLLAB_TYPE_LABEL } from "@/lib/actions/model";
import { relativeTime } from "@/lib/creator/studio";
import { DEAL_STAGE_LABEL, DEAL_STAGES, filterDeals, formatMoney, parseAmount, type Deal, type DealFilter, type DealStage } from "@/lib/creator/deals";

const TONE: Record<DealStage, string> = {
  new: "bg-[#E8A6FF] text-[#0D0D0D]",
  talking: "bg-[#FFE7B8] text-[#0D0D0D]",
  booked: "bg-[#C7FF4A] text-[#0D0D0D]",
  completed: "bg-[#AFCBFF] text-[#0D0D0D]",
  paid: "bg-[#0D0D0D] text-[#E8A6FF]",
  declined: "bg-black/[0.06] text-black/50",
};
const ANSWER_LABEL: Record<string, string> = { message: "Message", company: "Company", collabType: "Type", budget: "Budget they gave", timeline: "Timeline", website: "Website" };
const typeLabel = (value: string | null) => (value ? COLLAB_TYPE_LABEL[value as keyof typeof COLLAB_TYPE_LABEL] ?? value : null);
const budgetLabel = (value: string | null) => (value ? BUDGET_LABEL[value as keyof typeof BUDGET_LABEL] ?? value : null);
const answerText = (key: string, value: string) => (key === "collabType" ? typeLabel(value) : key === "budget" ? budgetLabel(value) : value) ?? value;
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.padEnd(16, "0"));

function StageTag({ stage }: { stage: DealStage }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.12em] ${TONE[stage]}`}>{DEAL_STAGE_LABEL[stage]}</span>;
}

/** Every deal, filtered by stage and searched by brand or contact. A row opens its sheet. */
export function DealsBoard({ deals, canNote }: { deals: Deal[]; canNote: boolean }) {
  const [filter, setFilter] = useState<DealFilter>("open");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = useMemo(() => filterDeals(deals, filter, query), [deals, filter, query]);
  const count = (value: DealFilter) => filterDeals(deals, value, "").length;
  const open = deals.find((deal) => deal.id === openId) ?? null;
  return (
    <section aria-label="Deals" className="flex flex-col gap-4">
      <div className="-mx-3.5 flex gap-2 overflow-x-auto px-3.5 pb-1 md:mx-0 md:px-0">
        <FilterPill count={count("open")} label="Open" on={filter === "open"} onClick={() => setFilter("open")} />
        {DEAL_STAGES.map((stage) => <FilterPill count={count(stage)} key={stage} label={DEAL_STAGE_LABEL[stage]} on={filter === stage} onClick={() => setFilter(stage)} />)}
      </div>
      <label className="relative block">
        <span className="sr-only">Search deals</span>
        <svg aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-black/40" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
        <input className="min-h-11 w-full rounded-full bg-white pl-11 pr-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" onChange={(change) => setQuery(change.target.value)} placeholder="Brand, name or email" type="search" value={query} />
      </label>
      {shown.length === 0 ? <p className="rounded-[22px] bg-white p-6 text-[15px] text-black/55 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">Nothing here{query ? " matches" : " yet"}.</p> : (
        <ul className="divide-y divide-black/[0.07] overflow-hidden rounded-[22px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
          {shown.map((deal) => (
            <li key={deal.id}>
              <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-black/[0.02] focus-visible:outline-2 focus-visible:-outline-offset-2 md:px-5" data-deal={deal.stage} onClick={() => setOpenId(deal.id)} type="button">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{deal.brand || deal.contact_name || "A brand"}</span>
                  <span className="block truncate text-[13px] text-black/55">{[typeLabel(deal.collab_type), deal.contact_name, relativeTime(deal.last_activity_at)].filter(Boolean).join(" · ")}</span>
                </span>
                {deal.agreed_amount_cents !== null && deal.currency && <span className="hidden shrink-0 font-display text-[17px] font-bold tracking-[-0.03em] sm:inline">{formatMoney(deal.agreed_amount_cents, deal.currency)}</span>}
                <StageTag stage={deal.stage} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <DealSheet canNote={canNote} deal={open} key={open.id} onClose={() => setOpenId(null)} />}
    </section>
  );
}

function DealSheet({ deal, canNote, onClose }: { deal: Deal; canNote: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof dealDetail>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState(deal.declined_reason ?? "");
  const [amount, setAmount] = useState(deal.agreed_amount_cents !== null ? String(deal.agreed_amount_cents / 100) : "");
  const [currency, setCurrency] = useState(deal.currency ?? "EUR");
  const [note, setNote] = useState("");
  const [noteKey, setNoteKey] = useState(newKey);
  useEffect(() => {
    let live = true;
    void dealDetail(deal.id).then((next) => { if (live) setDetail(next); });
    return () => { live = false; };
  }, [deal.id]);

  function run(task: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const result = await task();
      if (!result.ok) { setError(result.error ?? "That didn't go through."); return; }
      after?.();
      router.refresh();
      void dealDetail(deal.id).then(setDetail);
    });
  }
  function saveAmount() {
    if (!amount.trim()) { run(() => setDealAmount(deal.id, null, null)); return; }
    const cents = parseAmount(amount);
    if (cents === null || !/^[A-Za-z]{3}$/.test(currency.trim())) { setError("Enter an amount like 4500 and a currency like EUR."); return; }
    run(() => setDealAmount(deal.id, cents, currency.trim().toUpperCase()));
  }

  return (
    <Sheet onClose={onClose} title={deal.brand || deal.contact_name || "Deal"} wide>
      <div className="flex flex-col gap-6" data-deal-sheet={deal.stage}>
        <div>
          <p className="text-[15px]">{[deal.contact_name, typeLabel(deal.collab_type)].filter(Boolean).join(" · ")}</p>
          {deal.contact_email && <a className="text-[15px] font-semibold underline-offset-4 hover:underline" href={`mailto:${deal.contact_email}`}>{deal.contact_email}</a>}
          <p className="mt-1 text-[13px] text-black/55">Asked {relativeTime(deal.created_at)}{deal.stated_budget ? ` · their budget: ${budgetLabel(deal.stated_budget)}` : ""}</p>
        </div>

        <div>
          <Mono className="mb-2 text-black/50">Stage</Mono>
          <div aria-label="Stage" className="grid grid-cols-3 gap-1 rounded-[22px] bg-black/[0.05] p-1 sm:grid-cols-6 sm:rounded-full" role="radiogroup">
            {DEAL_STAGES.map((stage) => (
              <button aria-checked={deal.stage === stage} className={`min-h-10 rounded-full text-[13px] font-semibold transition disabled:opacity-50 ${deal.stage === stage ? `${TONE[stage]} shadow-[0_1px_2px_rgba(13,13,13,.15)]` : "text-black/55 hover:text-[#0D0D0D]"}`} disabled={pending} key={stage}
                onClick={() => (stage === "declined" ? setDeclining(true) : run(() => setDealStage(deal.id, stage)))} role="radio" type="button">{DEAL_STAGE_LABEL[stage]}</button>
            ))}
          </div>
          {declining && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input aria-label="Why (optional)" className="min-h-11 flex-1 rounded-full bg-white px-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" maxLength={200} onChange={(change) => setReason(change.target.value)} placeholder="Why (optional)" value={reason} />
              <button className={inkButton} disabled={pending} onClick={() => run(() => setDealStage(deal.id, "declined", reason), () => setDeclining(false))} type="button">Decline</button>
            </div>
          )}
          {deal.stage === "declined" && deal.declined_reason && !declining && <p className="mt-2 text-[13px] text-black/55">Declined: {deal.declined_reason}</p>}
        </div>

        <div>
          <Mono className="mb-2 text-black/50">Agreed fee</Mono>
          <div className="flex gap-2">
            <input aria-label="Agreed fee" className="min-h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" inputMode="decimal" onChange={(change) => setAmount(change.target.value)} placeholder="4500" value={amount} />
            <input aria-label="Currency" className="min-h-11 w-[84px] rounded-full bg-white px-4 text-center text-[15px] uppercase shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" maxLength={3} onChange={(change) => setCurrency(change.target.value)} value={currency} />
            <button className={lineButton} disabled={pending} onClick={saveAmount} type="button">Save</button>
          </div>
          <p className="mt-2 text-[12.5px] text-black/45">Only you see this. It counts toward Booked and Paid; mark Paid when the money arrives.</p>
        </div>

        {error && <p className="text-[14px] font-semibold text-[#B42318]" role="alert">{error}</p>}

        <div>
          <Mono className="mb-2 flex items-center gap-2 text-black/50">Note {!canNote && <PlusTag />}</Mono>
          {canNote ? (
            <div className="flex flex-col gap-2">
              <textarea aria-label="Note" className="min-h-[88px] w-full rounded-[18px] bg-white p-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" maxLength={2000} onChange={(change) => setNote(change.target.value)} placeholder="Deliverables, dates, usage rights." value={note} />
              <button className={`${inkButton} self-end`} disabled={pending || !note.trim()} onClick={() => run(() => addDealNote(deal.id, note, noteKey), () => { setNote(""); setNoteKey(newKey()); })} type="button">Add note</button>
            </div>
          ) : <p className="rounded-[18px] bg-white p-4 text-[14px] text-black/55 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">Private notes on each deal are part of Plus. Stages, fees and history are always yours.</p>}
        </div>

        <div>
          <Mono className="mb-3 text-black/50">History</Mono>
          {!detail ? <p className="text-[14px] text-black/45">Loading…</p> : (
            <ol className="relative flex flex-col gap-4 border-l border-black/10 pl-5">
              {detail.activity.map((item) => (
                <li className="relative" data-activity={item.kind} key={item.id}>
                  <span aria-hidden="true" className={`absolute -left-[25px] top-1.5 size-2.5 rounded-full ${item.kind === "note" ? "bg-[#0D0D0D]" : item.kind === "stage" ? "bg-[#E8A6FF]" : item.kind === "amount" ? "bg-[#C7FF4A]" : "bg-[#FF5A4F]"}`} />
                  <p className="text-[13px] text-black/50">{relativeTime(item.created_at)}</p>
                  {item.kind === "stage" && <p className="text-[15px]">Moved from <b>{DEAL_STAGE_LABEL[item.from_stage!]}</b> to <b>{DEAL_STAGE_LABEL[item.to_stage!]}</b></p>}
                  {item.kind === "note" && <p className="whitespace-pre-wrap text-[15px]">{item.body}</p>}
                  {item.kind === "amount" && <p className="text-[15px]">{item.amount_cents !== null && item.currency ? <>Fee set to <b>{formatMoney(item.amount_cents, item.currency)}</b></> : "Fee cleared"}</p>}
                  {item.kind === "created" && (
                    <div>
                      <p className="text-[15px] font-semibold">Request received</p>
                      {detail.answers && (
                        <dl className="mt-2 flex flex-col gap-1.5 rounded-[16px] bg-white p-3.5 text-[14px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)]">
                          {Object.entries(detail.answers).filter(([, value]) => value).map(([key, value]) => <div className="grid gap-0.5" key={key}><dt className="text-[12px] text-black/45">{ANSWER_LABEL[key] ?? key}</dt><dd className="whitespace-pre-wrap break-words">{answerText(key, String(value))}</dd></div>)}
                        </dl>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Sheet>
  );
}
