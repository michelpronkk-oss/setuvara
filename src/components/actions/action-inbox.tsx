"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PlusTag, Sheet } from "@/app/app/identity/editor-ui";
import { coralButton, EmptyState, FilterPill, lineButton, Mono } from "@/components/creator/studio-ui";
import { actionWindow, BUDGET_FLOOR, BUDGET_LABEL, COLLAB_TYPE_LABEL, STATUS_FLOW, SUBMISSION_STATUS_LABEL, SUBMISSION_STATUS_TONE, type Budget, type CollabType, type ProfileAction, type Submission, type SubmissionStatus } from "@/lib/actions/model";
import { formatMoney, initials, relativeTime, type KitRate } from "@/lib/creator/studio";
import { createClient } from "@/lib/supabase/client";

const TINTS = ["#AFCBFF", "#C7FF4A", "#FFE7B8", "#E6E4DC", "#E6DCFF"];
const BUILT_IN: Record<string, string> = { company: "Company", collabType: "For", budget: "Budget", timeline: "Timeline", website: "Website", preferredDates: "Dates" };

/** Compares a stated budget with the creator's own euro rates. Says nothing without rates. */
export function fitLine(budget: Budget | undefined, rates: KitRate[]) {
  const euro = rates.filter((rate) => rate.currency === "EUR").map((rate) => rate.amount_minor);
  const floor = budget ? BUDGET_FLOOR[budget] : null;
  if (!euro.length || floor === null || !budget) return null;
  const lowest = Math.min(...euro);
  const ceiling: Record<Budget, number> = { under_1k: 100_000, "1k_5k": 500_000, "5k_10k": 1_000_000, "10k_25k": 2_500_000, "25k_plus": Number.MAX_SAFE_INTEGER, unsure: 0 };
  if (ceiling[budget] <= lowest) return `Below your lowest rate (${formatMoney(lowest, "EUR")}). Worth countering.`;
  return floor >= lowest ? "Inside your rate card." : `Your lowest rate (${formatMoney(lowest, "EUR")}) sits inside this budget.`;
}

const tone = (status: SubmissionStatus) => SUBMISSION_STATUS_TONE[status] ?? { bg: "#E6E4DC", fg: "#0D0D0D" };
function StatusTag({ status }: { status: SubmissionStatus }) {
  const colors = tone(status);
  return <span className="rounded-[5px] px-2 py-[3px] font-label text-[10px] tracking-[0.12em]" style={{ background: colors.bg, color: colors.fg, boxShadow: colors.bg === "transparent" ? "inset 0 0 0 1px rgba(13,13,13,.2)" : undefined }}>{SUBMISSION_STATUS_LABEL[status].toUpperCase()}</span>;
}

async function setStatus(id: string, status: SubmissionStatus) {
  const { data, error } = await createClient().rpc("set_action_submission_status", { p_submission_id: id, p_status: status });
  return !error && data === true;
}
async function removeSubmission(id: string) {
  const { data, error } = await createClient().rpc("delete_action_submission", { p_submission_id: id });
  return !error && data === true;
}

/**
 * Responses to one Action. The list is for triage and the detail is for deciding. Replies go by
 * email, or by Connect Chat only when the two of you are already connected.
 */
export function ActionInbox({ action, submissions, chatLinks, rates, initialId = null }: { action: ProfileAction; submissions: Submission[]; chatLinks: Record<string, string>; rates: KitRate[]; initialId?: string | null }) {
  const router = useRouter();
  const flow = STATUS_FLOW[action.kind];
  const filters: { label: string; match: (status: SubmissionStatus) => boolean }[] = [
    { label: "Open", match: (status) => !["declined", "completed", "answered", "archived", "spam"].includes(status) },
    { label: "New", match: (status) => status === "new" },
    { label: "Done", match: (status) => ["completed", "answered", "archived", "declined"].includes(status) },
    { label: "Spam", match: (status) => status === "spam" },
  ];
  const [filter, setFilter] = useState(0);
  const shown = submissions.filter((item) => filters[filter].match(item.status));
  const [selectedId, setSelectedId] = useState<string | null>(submissions.some((item) => item.id === initialId) ? initialId : null);
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialId && submissions.some((item) => item.id === initialId)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = submissions.find((item) => item.id === selectedId) ?? shown[0] ?? null;

  async function run(task: () => Promise<boolean>) {
    setBusy(true);
    setError(null);
    const ok = await task();
    setBusy(false);
    if (!ok) { setError("That didn't save. Try again."); return; }
    router.refresh();
  }

  if (!submissions.length) {
    return <EmptyState body={action.status === "published" ? "When someone sends this form, it lands here with everything they wrote." : "Publish this Action and responses land here."} title="No responses yet." />;
  }

  const labelOf = (key: string) => BUILT_IN[key] ?? action.config.questions?.find((question) => question.id === key)?.label ?? key;
  const detail = selected && (
    <article className="flex min-h-full flex-col gap-6" data-response-detail>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Mono className="text-black/60">Received {relativeTime(selected.created_at)}</Mono>
          <h2 className="mt-2 font-display text-[34px] font-bold leading-[1] tracking-[-0.05em] md:text-[44px]">{selected.answers.company || selected.name || "Anonymous"}</h2>
          <p className="mt-2 text-[16px] text-black/70">{[selected.answers.company ? `From ${selected.name}` : null, selected.email].filter(Boolean).join(" · ") || "No contact details"}</p>
        </div>
        <ol aria-label="Status" className="flex flex-wrap items-center gap-2">
          {flow.filter((status) => !["declined", "spam", "archived"].includes(status)).map((status, index, list) => {
            const reached = list.indexOf(selected.status) >= index;
            return <li className={`flex items-center gap-2 text-[13px] ${reached ? "font-semibold" : "text-black/45"}`} key={status}><span aria-hidden="true" className="h-[3px] w-5 rounded-full" style={{ background: reached ? "#FF5A4F" : "rgba(13,13,13,.15)" }} />{SUBMISSION_STATUS_LABEL[status]}</li>;
          })}
          {["declined", "spam", "archived"].includes(selected.status) && <li><StatusTag status={selected.status} /></li>}
        </ol>
      </header>
      {Object.keys(selected.answers).some((key) => key in BUILT_IN) && (
        <dl className="grid grid-cols-2 gap-5 border-y-[1.5px] border-[#0D0D0D] py-5 sm:grid-cols-4">
          {Object.entries(selected.answers).filter(([key]) => key in BUILT_IN && key !== "company").map(([key, value]) => (
            <div className="min-w-0" key={key}><dt className="font-label text-[11px] uppercase tracking-[0.16em] text-black/60">{BUILT_IN[key]}</dt><dd className="mt-1.5 break-words text-[18px] font-semibold tracking-[-0.02em]">{key === "budget" ? BUDGET_LABEL[value as Budget] ?? value : key === "collabType" ? COLLAB_TYPE_LABEL[value as CollabType] ?? value : key === "website" ? <a className="underline underline-offset-4" href={value} rel="noreferrer nofollow" target="_blank">{value.replace(/^https?:\/\//, "")}</a> : value}</dd></div>
          ))}
        </dl>
      )}
      {selected.answers.message && <section><Mono className="mb-2 text-black/60">{action.kind === "submission" ? action.config.prompt || "Message" : "Message"}</Mono><p className="max-w-[62ch] whitespace-pre-line text-[17px] leading-[1.6]">{selected.answers.message}</p></section>}
      {Object.entries(selected.answers).filter(([key]) => /^q\d+$/.test(key)).map(([key, value]) => <section key={key}><Mono className="mb-1.5 text-black/60">{labelOf(key)}</Mono><p className="whitespace-pre-line text-[16px] leading-[1.55]">{value}</p></section>)}
      {action.kind === "submission" && action.config.askFeatureConsent && <p className="text-[14px] text-black/65">{selected.feature_consent ? "✓ Agreed you may feature this, with their first name." : "Didn't agree to be featured."}</p>}
      {action.kind === "collab" && (() => { const fit = fitLine(selected.answers.budget as Budget | undefined, rates); return fit && <p className="flex items-center gap-3 rounded-[16px] bg-[#E8E2D4] px-4 py-3 text-[15px]"><span className="rounded-md bg-[#0D0D0D] px-2 py-1 font-label text-[10px] tracking-[0.14em] text-[#F5F4EF]">FIT</span>{fit}</p>; })()}
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
        {chatLinks[selected.id]
          ? <a className={coralButton} href={chatLinks[selected.id]}>Reply in Connect Chat</a>
          : selected.email ? <a className={coralButton} href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${action.title}`)}`}>Reply by email</a> : null}
        {(() => {
          const main = flow.filter((status) => !["declined", "spam", "archived"].includes(status));
          const next = main[main.indexOf(selected.status) + 1];
          return next ? <button className={lineButton} disabled={busy} onClick={() => void run(() => setStatus(selected.id, next))} type="button">Mark {SUBMISSION_STATUS_LABEL[next].toLowerCase()}</button> : null;
        })()}
        {flow.includes("declined") && !["declined", "completed"].includes(selected.status) && <button className="min-h-11 rounded-full px-4 text-[15px] font-semibold text-black/70 hover:bg-black/[0.04] disabled:opacity-50" disabled={busy} onClick={() => void run(() => setStatus(selected.id, "declined"))} type="button">Decline</button>}
        {selected.status !== "spam" ? <button className="min-h-11 rounded-full px-4 text-[15px] font-semibold text-black/70 hover:bg-black/[0.04] disabled:opacity-50" disabled={busy} onClick={() => void run(() => setStatus(selected.id, "spam"))} type="button">Spam</button>
          : <button className={lineButton} disabled={busy} onClick={() => void run(() => setStatus(selected.id, "new"))} type="button">Not spam</button>}
        {["declined", "archived"].includes(selected.status) && <button className={lineButton} disabled={busy} onClick={() => void run(() => setStatus(selected.id, "new"))} type="button">Reopen</button>}
        <button className="min-h-11 rounded-full px-4 text-[15px] font-semibold text-[#B42318] hover:bg-black/[0.04] disabled:opacity-50" disabled={busy} onClick={() => { if (window.confirm("Delete this response? This can't be undone.")) void run(() => removeSubmission(selected.id)); }} type="button">Delete</button>
        <p className="w-full text-[13px] text-black/55">{chatLinks[selected.id] ? "You're connected, so replies can continue in Connect Chat." : "Sending this form didn't open a chat. Reply by email, or connect first."}</p>
      </div>
      {error && <p className="text-sm font-medium text-[#B42318]" role="alert">{error}</p>}
    </article>
  );

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(300px,390px)_minmax(0,1fr)] md:gap-0">
      <div className="md:border-r md:border-black/10 md:pr-7">
        <div className="-mx-3.5 mb-4 flex gap-2 overflow-x-auto px-3.5 [scrollbar-width:none] md:mx-0 md:px-0">
          {filters.map((item, index) => <FilterPill count={submissions.filter((entry) => item.match(entry.status)).length} key={item.label} label={item.label} on={filter === index} onClick={() => setFilter(index)} />)}
        </div>
        {shown.length ? (
          <ul className="flex flex-col gap-1">
            {shown.map((item, index) => {
              const on = selected?.id === item.id;
              const name = item.answers.company || item.name || "Anonymous";
              const sub = item.answers.collabType ? [COLLAB_TYPE_LABEL[item.answers.collabType as CollabType], item.answers.budget ? BUDGET_LABEL[item.answers.budget as Budget] : null].filter(Boolean).join(" · ") : (item.answers.message ?? "").slice(0, 80);
              return (
                <li key={item.id}>
                  <button aria-current={on ? "true" : undefined} className={`flex w-full items-center gap-3.5 rounded-[18px] p-3.5 text-left transition focus-visible:outline-2 ${on ? "md:bg-white md:shadow-[0_1px_0_rgba(13,13,13,.04)]" : "hover:bg-black/[0.03]"}`} onClick={() => { setSelectedId(item.id); setSheetOpen(true); }} type="button">
                    <span className="grid size-12 shrink-0 place-items-center rounded-[14px] text-[17px] font-bold" style={{ background: TINTS[index % TINTS.length] }}>{initials(name)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{name}</span><span className="block truncate text-[14px] text-black/65">{sub}</span></span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5"><StatusTag status={item.status} /><span className="text-[12px] text-black/55">{relativeTime(item.created_at)}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <p className="px-1 py-4 text-[15px] text-black/60">Nothing here.</p>}
      </div>
      <div className="hidden min-w-0 md:block md:pl-10">{detail}</div>
      {sheetOpen && selected && <div className="md:hidden"><Sheet onClose={() => setSheetOpen(false)} title={selected.answers.company || selected.name || "Response"}>{detail}</Sheet></div>}
    </div>
  );
}

/**
 * Giveaway entries: confirmed, unconfirmed and disqualified, with a CSV for the draw. Setuvara
 * doesn't pick winners yet, so nothing here pretends to.
 */
export function GiveawayEntries({ action, submissions, canExport }: { action: ProfileAction; submissions: Submission[]; canExport: boolean }) {
  const router = useRouter();
  const groups: { label: string; status: SubmissionStatus }[] = [{ label: "Confirmed", status: "entered" }, { label: "Unconfirmed", status: "pending_verification" }, { label: "Disqualified", status: "disqualified" }];
  const [filter, setFilter] = useState<SubmissionStatus>("entered");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needle = query.trim().toLowerCase();
  const shown = submissions.filter((item) => item.status === filter && (!needle || item.name.toLowerCase().includes(needle) || (item.email ?? "").includes(needle)));
  const ended = actionWindow(action) === "ended";

  async function change(item: Submission, status: SubmissionStatus) {
    setBusy(item.id);
    setError(null);
    const ok = await setStatus(item.id, status);
    setBusy(null);
    if (!ok) setError(status === "entered" ? "Only confirmed entries can be reinstated." : "That didn't save. Try again.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-3 gap-3">
        {groups.map((group) => (
          <div className="rounded-[22px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.06)] md:p-5" key={group.status}>
            <dt><Mono className="text-black/55">{group.label}</Mono></dt>
            <dd className="mt-2 font-display text-[36px] font-bold leading-none tracking-[-0.05em] md:text-[44px]">{submissions.filter((item) => item.status === group.status).length}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">{groups.map((group) => <FilterPill count={submissions.filter((item) => item.status === group.status).length} key={group.status} label={group.label} on={filter === group.status} onClick={() => setFilter(group.status)} />)}</div>
        <input aria-label="Search entries" className="min-h-10 min-w-0 flex-1 rounded-full bg-white px-4 text-[15px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D] sm:max-w-[260px]" onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" value={query} />
        {canExport
          ? <a className={`${lineButton} sm:ml-auto`} download href={`/api/actions/${action.id}/export`}>Export CSV</a>
          : <span className="flex items-center gap-2 text-[14px] text-black/60 sm:ml-auto"><PlusTag /> Export comes with Plus</span>}
      </div>
      {shown.length ? (
        <ul className="divide-y divide-black/10 border-y border-black/10">
          {shown.map((item) => (
            <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3" key={item.id}>
              <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{item.name || "No name"}</span><span className="block truncate text-[14px] text-black/60">{item.email ?? "Contact details removed"}</span></span>
              <span className="text-[13px] text-black/55">{item.verified_at ? `confirmed ${relativeTime(item.verified_at)}` : `entered ${relativeTime(item.created_at)}`}</span>
              {item.status === "entered" && <button className="min-h-10 rounded-full px-3 text-[14px] font-semibold text-black/70 hover:bg-black/[0.04] disabled:opacity-50" disabled={busy !== null} onClick={() => void change(item, "disqualified")} type="button">Disqualify</button>}
              {item.status === "disqualified" && item.verified_at && <button className="min-h-10 rounded-full px-3 text-[14px] font-semibold text-black/70 hover:bg-black/[0.04] disabled:opacity-50" disabled={busy !== null} onClick={() => void change(item, "entered")} type="button">Reinstate</button>}
            </li>
          ))}
        </ul>
      ) : <p className="py-4 text-[15px] text-black/60">{submissions.length ? "No entries match." : "No entries yet."}</p>}
      {error && <p className="text-sm font-medium text-[#B42318]" role="alert">{error}</p>}
      <p className="max-w-[70ch] text-[13px] leading-[1.5] text-black/60">
        {ended ? "This giveaway has ended. " : ""}Only confirmed entries count. Setuvara doesn&apos;t draw winners yet: export the confirmed entries, pick fairly and keep a note of how. Unconfirmed entries are deleted after 7 days, and entrant details 180 days after the end.
      </p>
    </div>
  );
}
