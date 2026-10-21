"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { addLeadNote, assignLead, leadDetail, setLeadStage } from "@/app/app/identity/leads/actions";
import { createTestimonialLink } from "@/app/app/identity/testimonials/actions";
import { PlusTag, Sheet } from "@/app/app/identity/editor-ui";
import { FilterPill, inkButton, lineButton, Mono } from "@/components/creator/studio-ui";
import { ACTION_KIND_SHORT, BUDGET_LABEL, COLLAB_TYPE_LABEL, type ActionKind } from "@/lib/actions/model";
import { filterLeads, LEAD_PAGE, LEAD_STAGES, leadExportHref, OPEN_STAGES, STAGE_LABEL, type Lead, type LeadActivity, type LeadFilter, type LeadPerson, type LeadStage } from "@/lib/business/model";
import type { LeadInquiry } from "@/lib/business/studio-server";
import { FreshLink } from "./testimonials-client";
import { relativeTime } from "@/lib/creator/studio";

const TONE: Record<LeadStage, string> = {
  new: "bg-[#AFCBFF] text-[#0D0D0D]",
  contacted: "bg-[#FFE7B8] text-[#0D0D0D]",
  qualified: "bg-[#C7FF4A] text-[#0D0D0D]",
  won: "bg-[#0D0D0D] text-[#C7FF4A]",
  lost: "bg-black/[0.06] text-black/50",
};
const NOTE_MAX = 2000;
const ANSWER_LABEL: Record<string, string> = { message: "Message", company: "Company", preferredDates: "Preferred dates", collabType: "Type", budget: "Budget", timeline: "Timeline", website: "Website" };

/** An answer as people read it: collab types and budgets by their labels, everything else as written. */
function answerText(key: string, value: string) {
  if (key === "collabType") return COLLAB_TYPE_LABEL[value as keyof typeof COLLAB_TYPE_LABEL] ?? value;
  if (key === "budget") return BUDGET_LABEL[value as keyof typeof BUDGET_LABEL] ?? value;
  return value;
}

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.padEnd(16, "0");
}

function StageTag({ stage }: { stage: LeadStage }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.12em] ${TONE[stage]}`}>{STAGE_LABEL[stage]}</span>;
}

const initial = (name: string) => (name.trim() || "?").charAt(0).toUpperCase();

/** Who a lead is with, as a small initial with their name on hover and for screen readers. */
function Assignee({ person }: { person: LeadPerson }) {
  return (
    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${person.you ? "bg-[#C7FF4A] text-[#0D0D0D] shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]" : "bg-black/[0.07] text-black/65"}`} title={person.you ? "Yours" : `With ${person.name}`}>
      <span aria-hidden="true">{initial(person.name)}</span><span className="sr-only">{person.you ? "Assigned to you" : `Assigned to ${person.name}`}</span>
    </span>
  );
}

/**
 * Who owns this lead. The owner and managers pick anyone on the team; a member takes an unassigned
 * lead or lets go of their own. The database enforces the same.
 */
function AssignRow({ lead, people, pending, start, onDone, onError }: {
  lead: Lead; people: LeadPerson[]; pending: boolean; start: (task: () => Promise<void>) => void; onDone: () => void; onError: (message: string | null) => void;
}) {
  const me = people.find((person) => person.you);
  const holder = people.find((person) => person.user_id === lead.assigned_to) ?? null;
  const assign = (userId: string | null) => { onError(null); start(async () => { const result = await assignLead(lead.id, userId); if (!result.ok) { onError(result.error); return; } onDone(); }); };
  return (
    <div data-assign={holder ? (holder.you ? "mine" : "theirs") : "nobody"}>
      <Mono className="mb-2 text-black/50">Owner</Mono>
      {me && me.role !== "member" ? (
        <label className="relative block">
          <span className="sr-only">Assign to</span>
          <select className="min-h-11 w-full appearance-none rounded-full bg-white pl-4 pr-10 text-[15px] font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D] disabled:opacity-50" disabled={pending} onChange={(change) => assign(change.target.value || null)} value={lead.assigned_to ?? ""}>
            <option value="">Nobody yet</option>
            {people.map((person) => <option key={person.user_id} value={person.user_id}>{person.you ? `${person.name} (you)` : person.name}</option>)}
          </select>
          <svg aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-black/45" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
        </label>
      ) : (
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-full bg-white pl-4 pr-1.5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]">
          <span className="truncate text-[15px] font-semibold">{holder ? (holder.you ? "You" : holder.name) : "Nobody yet"}</span>
          {!holder && me && <button className={`${inkButton} min-h-9 px-4 text-[14px]`} disabled={pending} onClick={() => assign(me.user_id)} type="button">Take it</button>}
          {holder?.you && <button className="min-h-9 rounded-full px-4 text-[14px] font-semibold text-black/55 transition hover:bg-black/[0.05] hover:text-black" disabled={pending} onClick={() => assign(null)} type="button">Let go</button>}
        </div>
      )}
    </div>
  );
}

/**
 * The inbox: stage filters, search, a page of rows that each open their sheet, and export of what's
 * shown. With `business`, a teammate works another owner's leads: export names that business, and
 * testimonial links stay with the owner.
 */
export function LeadsInbox({ leads, canNote, canExport, owner, business, people = [] }: {
  leads: Lead[]; canNote: boolean; canExport: boolean; owner: string; business?: string;
  /** The owner and active teammates. With more than one person, leads can be assigned. */ people?: LeadPerson[];
}) {
  const team = people.length > 1;
  const me = people.find((person) => person.you) ?? null;
  const [mine, setMineState] = useState(false);
  const [filter, setFilterState] = useState<LeadFilter>("open");
  const [query, setQueryState] = useState("");
  const [limit, setLimit] = useState(LEAD_PAGE);
  const [openId, setOpenId] = useState<string | null>(null);
  const pool = useMemo(() => (mine && me ? leads.filter((lead) => lead.assigned_to === me.user_id) : leads), [leads, mine, me]);
  const shown = useMemo(() => filterLeads(pool, filter, query), [pool, filter, query]);
  const setFilter = (next: LeadFilter) => { setFilterState(next); setLimit(LEAD_PAGE); };
  const setQuery = (next: string) => { setQueryState(next); setLimit(LEAD_PAGE); };
  const setMine = (next: boolean) => { setMineState(next); setLimit(LEAD_PAGE); };
  const count = (stage: LeadFilter) => filterLeads(pool, stage, "").length;
  const names = new Map(people.map((person) => [person.user_id, person]));
  const open = leads.find((lead) => lead.id === openId) ?? null;

  return (
    <section aria-label="Lead inbox" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="-mx-3.5 flex gap-2 overflow-x-auto px-3.5 pb-1 md:mx-0 md:px-0">
          {team && me && <>
            <FilterPill count={filterLeads(leads.filter((lead) => lead.assigned_to === me.user_id), "open", "").length} label="Mine" on={mine} onClick={() => setMine(!mine)} />
            <span aria-hidden="true" className="my-2 w-px shrink-0 bg-black/10" />
          </>}
          <FilterPill count={count("open")} label="Open" on={filter === "open"} onClick={() => setFilter("open")} />
          {LEAD_STAGES.map((stage) => <FilterPill count={count(stage)} key={stage} label={STAGE_LABEL[stage]} on={filter === stage} onClick={() => setFilter(stage)} />)}
          <FilterPill count={leads.length} label="All" on={filter === "all"} onClick={() => setFilter("all")} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Search leads</span>
          <svg aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-black/40" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input className="min-h-11 w-full rounded-full bg-white pl-11 pr-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" onChange={(change) => setQuery(change.target.value)} placeholder="Name or email" type="search" value={query} />
        </label>
        {canExport
          ? <a className={`${lineButton} shrink-0`} data-export="leads" download href={leadExportHref(filter, query, business)}>Export {shown.length === leads.length ? "CSV" : `${shown.length} as CSV`}</a>
          : business ? null : <span className="flex shrink-0 items-center gap-2 text-[14px] text-black/60"><PlusTag /> Export comes with Plus</span>}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-[22px] bg-white p-6 text-[15px] text-black/55 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">Nobody here{query ? " matches" : " yet"}.</p>
      ) : (
        <ul className="divide-y divide-black/[0.07] overflow-hidden rounded-[22px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
          {shown.slice(0, limit).map((lead) => (
            <li key={lead.id}>
              <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-black/[0.02] focus-visible:outline-2 focus-visible:-outline-offset-2 md:px-5" data-lead={lead.stage} onClick={() => setOpenId(lead.id)} type="button">
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#0D0D0D] text-[15px] font-semibold text-[#F5F4EF]">{(lead.name.trim() || lead.email || "?").charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{lead.name || lead.email || "Anonymous"}{lead.inquiries > 1 && <span className="ml-2 font-label text-[10px] uppercase tracking-[0.12em] text-black/45">{lead.inquiries} inquiries</span>}</span>
                  <span className="block truncate text-[13px] text-black/55">{lead.email ?? "No email"} · {relativeTime(lead.last_activity_at)}</span>
                </span>
                {team && lead.assigned_to && names.get(lead.assigned_to) && <Assignee person={names.get(lead.assigned_to)!} />}
                <StageTag stage={lead.stage} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {shown.length > limit && (
        <button className={`${lineButton} self-center`} onClick={() => setLimit((current) => current + LEAD_PAGE)} type="button">
          Show more <span className="text-black/45">{Math.min(limit, shown.length)} of {shown.length}</span>
        </button>
      )}
      {open && <LeadSheet canAsk={!business} canNote={canNote} key={open.id} lead={open} onClose={() => setOpenId(null)} owner={owner} people={team ? people : []} />}
    </section>
  );
}

/** One lead: move its stage, read what they asked, write a note, see the history. */
function LeadSheet({ lead, canNote, canAsk, owner, people, onClose }: { lead: Lead; canNote: boolean; canAsk: boolean; owner: string; people: LeadPerson[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [detail, setDetail] = useState<{ activity: LeadActivity[]; inquiries: LeadInquiry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [losing, setLosing] = useState(false);
  const [reason, setReason] = useState(lead.lost_reason ?? "");
  const [note, setNote] = useState("");
  const [noteKey, setNoteKey] = useState(newKey);
  const [askUrl, setAskUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void leadDetail(lead.id).then((next) => { if (live) setDetail(next); });
    return () => { live = false; };
  }, [lead.id]);

  function refresh() {
    router.refresh();
    void leadDetail(lead.id).then(setDetail);
  }
  function move(stage: LeadStage, lostReason?: string) {
    setError(null);
    start(async () => {
      const result = await setLeadStage(lead.id, stage, lostReason);
      if (!result.ok) { setError(result.error); return; }
      setLosing(false);
      refresh();
    });
  }
  function saveNote() {
    setError(null);
    start(async () => {
      const result = await addLeadNote(lead.id, note, noteKey);
      if (!result.ok) { setError(result.error); return; }
      setNote("");
      setNoteKey(newKey());
      refresh();
    });
  }

  function ask() {
    setError(null);
    start(async () => {
      const result = await createTestimonialLink(lead.id, "");
      if (!result.ok) { setError(result.error); return; }
      setAskUrl(result.url);
    });
  }

  const inquiries = new Map((detail?.inquiries ?? []).map((item) => [item.id, item]));
  return (
    <Sheet onClose={onClose} title={lead.name || lead.email || "Lead"} wide>
      <div className="flex flex-col gap-6" data-lead-sheet={lead.stage}>
        <div>
          {lead.email && <a className="text-[15px] font-semibold underline-offset-4 hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a>}
          <p className="mt-1 text-[13px] text-black/55">First inquiry {relativeTime(lead.created_at)}{lead.inquiries > 1 ? ` · ${lead.inquiries} inquiries` : ""}</p>
        </div>

        {people.length > 1 && <AssignRow lead={lead} onDone={refresh} onError={setError} pending={pending} people={people} start={start} />}

        <div>
          <Mono className="mb-2 text-black/50">Stage</Mono>
          <div aria-label="Stage" className="grid grid-cols-5 gap-1 rounded-full bg-black/[0.05] p-1" role="radiogroup">
            {LEAD_STAGES.map((stage) => (
              <button aria-checked={lead.stage === stage} className={`min-h-10 rounded-full text-[13px] font-semibold transition disabled:opacity-50 ${lead.stage === stage ? `${TONE[stage]} shadow-[0_1px_2px_rgba(13,13,13,.15)]` : "text-black/55 hover:text-[#0D0D0D]"}`} disabled={pending} key={stage}
                onClick={() => (stage === "lost" ? setLosing(true) : move(stage))} role="radio" type="button">{STAGE_LABEL[stage]}</button>
            ))}
          </div>
          {losing && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input aria-label="Why it was lost (optional)" className="min-h-11 flex-1 rounded-full bg-white px-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" maxLength={200} onChange={(change) => setReason(change.target.value)} placeholder="Why it was lost (optional)" value={reason} />
              <button className={inkButton} disabled={pending} onClick={() => move("lost", reason)} type="button">Mark lost</button>
            </div>
          )}
          {lead.stage === "lost" && lead.lost_reason && !losing && <p className="mt-2 text-[13px] text-black/55">Lost: {lead.lost_reason}</p>}
          {OPEN_STAGES.includes(lead.stage) && <p className="mt-2 text-[12.5px] text-black/45">Mark Won or Lost when it&apos;s decided. Won counts in {canAsk ? "your" : "the"} funnel; nothing is added for you.</p>}
        </div>

        {error && <p className="text-[14px] font-semibold text-[#B42318]" role="alert">{error}</p>}

        {lead.stage === "won" && canAsk && (
          <div data-lead-testimonial>
            <Mono className="mb-2 text-black/50">Testimonial</Mono>
            {askUrl ? <FreshLink email={lead.email} name={lead.name} owner={owner} url={askUrl} /> : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
                <p className="text-[14px] text-black/60">Won. Ask {lead.name.split(" ")[0] || "them"} for a few words; it shows as a verified client.</p>
                <button className={inkButton} disabled={pending} onClick={ask} type="button">Ask for a testimonial</button>
              </div>
            )}
          </div>
        )}

        <div>
          <Mono className="mb-2 flex items-center gap-2 text-black/50">Note {!canNote && <PlusTag />}</Mono>
          {canNote ? (
            <div className="flex flex-col gap-2">
              <textarea aria-label="Note" className="min-h-[88px] w-full rounded-[18px] bg-white p-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" maxLength={NOTE_MAX} onChange={(change) => setNote(change.target.value)} placeholder="A call, a quote, what's next." value={note} />
              <button className={`${inkButton} self-end`} disabled={pending || !note.trim()} onClick={saveNote} type="button">{pending ? "Saving…" : "Add note"}</button>
            </div>
          ) : (
            <p className="rounded-[18px] bg-white p-4 text-[14px] text-black/55 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">{canAsk ? "Private notes on each lead are part of Plus. Stages and history are always yours." : "Notes come with the owner's Plus or Pro plan."}</p>
          )}
        </div>

        <div>
          <Mono className="mb-3 text-black/50">History</Mono>
          {!detail ? <p className="text-[14px] text-black/45">Loading…</p> : (
            <ol className="relative flex flex-col gap-4 border-l border-black/10 pl-5">
              {detail.activity.map((item) => {
                const inquiry = item.submission_id ? inquiries.get(item.submission_id) : null;
                return (
                  <li className="relative" data-activity={item.kind} key={item.id}>
                    <span aria-hidden="true" className={`absolute -left-[25px] top-1.5 size-2.5 rounded-full ${item.kind === "note" ? "bg-[#0D0D0D]" : item.kind === "stage" ? "bg-[#AFCBFF]" : "bg-[#FF5A4F]"}`} />
                    <p className="text-[13px] text-black/50">{relativeTime(item.created_at)}{item.actor && item.kind !== "created" && item.kind !== "inquiry" ? ` · ${item.actor}` : ""}</p>
                    {item.kind === "assigned" && <p className="text-[15px]">{item.assignee ? <>Assigned to <b>{item.assignee}</b></> : "Back to nobody"}</p>}
                    {item.kind === "stage" && <p className="text-[15px]">Moved from <b>{STAGE_LABEL[item.from_stage!]}</b> to <b>{STAGE_LABEL[item.to_stage!]}</b></p>}
                    {item.kind === "note" && <p className="whitespace-pre-wrap text-[15px]">{item.body}</p>}
                    {(item.kind === "created" || item.kind === "inquiry") && (
                      <div>
                        <p className="text-[15px] font-semibold">{item.kind === "created" ? "First inquiry" : "Another inquiry"}{inquiry ? ` · ${ACTION_KIND_SHORT[inquiry.kind as ActionKind] ?? inquiry.kind}` : ""}</p>
                        {inquiry && Object.entries(inquiry.answers).filter(([, value]) => value).length > 0 && (
                          <dl className="mt-2 flex flex-col gap-1.5 rounded-[16px] bg-white p-3.5 text-[14px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)]">
                            {Object.entries(inquiry.answers).filter(([, value]) => value).map(([key, value]) => (
                              <div className="grid gap-0.5" key={key}><dt className="text-[12px] text-black/45">{ANSWER_LABEL[key] ?? inquiry.labels[key] ?? "Answer"}</dt><dd className="whitespace-pre-wrap break-words">{answerText(key, String(value))}</dd></div>
                            ))}
                          </dl>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </Sheet>
  );
}
