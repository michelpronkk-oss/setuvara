"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Field, PlusTag, Segmented, TextArea, TextInput, Toggle } from "@/app/app/identity/editor-ui";
import { coralButton, inkButton, lineButton, Mono } from "@/components/creator/studio-ui";
import { actionErrorMessage, ACTION_KIND_NAME, COLLAB_TYPE_LABEL, COLLAB_TYPES, type ActionConfig, type ActionKind, type ActionLimits, type ActionStatus, type CollabType, type ProfileAction, type PublicAction, type Question } from "@/lib/actions/model";
import { createClient } from "@/lib/supabase/client";
import { ActionCard } from "./action-card";
import { ActionForm } from "./action-form";

export type CoverOption = { id: string; imageUrl: string | null; title: string };
type Draft = Pick<ProfileAction, "title" | "intro" | "cta_label" | "cover_block_id" | "config" | "starts_at" | "ends_at">;

const chip = (on: boolean) => `inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-semibold transition-colors focus-visible:outline-2 ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] hover:bg-black/[0.03]"}`;

/** datetime-local works in the creator's own time zone; the database stores UTC. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

function problemsOf(kind: ActionKind, draft: Draft) {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push("Add a title.");
  for (const question of draft.config.questions ?? []) {
    if (!question.label.trim()) problems.push("Every question needs a label.");
    if (question.type === "choice" && ((question.options ?? []).filter((option) => option.trim()).length < 2)) problems.push(`"${question.label || "A choice question"}" needs at least two options.`);
  }
  if (draft.starts_at && draft.ends_at && new Date(draft.ends_at) <= new Date(draft.starts_at)) problems.push("The end has to come after the start.");
  if (kind === "giveaway" && !draft.ends_at) problems.push("A giveaway needs an end date.");
  if (kind === "collab" && draft.config.types && draft.config.types.length === 0) problems.push("Pick at least one kind of work.");
  return [...new Set(problems)];
}

/** Drops empty optional text so the stored config stays small and clean. */
function cleanConfig(config: ActionConfig): ActionConfig {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined || (typeof value === "string" && !value.trim())) continue;
    if (key === "questions") {
      const questions = (value as Question[]).map((question) => ({
        id: question.id,
        label: question.label.trim(),
        type: question.type,
        ...(question.type === "choice" ? { options: (question.options ?? []).map((option) => option.trim()).filter(Boolean).slice(0, 8) } : {}),
        ...(question.required ? { required: true } : {}),
      }));
      if (questions.length) out.questions = questions;
      continue;
    }
    out[key] = typeof value === "string" ? value.trim() : value;
  }
  return out as ActionConfig;
}

/**
 * Create and edit one Action, with the page card and the visitor's form side by side. Saving goes
 * through RLS as the owner; the database re-checks every field and the plan limits.
 */
export function ActionEditor({ kind, initial, starter, profileId, modeId, covers, limits, locked, nextSortOrder, firstName }: {
  kind: ActionKind;
  initial: ProfileAction | null;
  starter: Draft;
  profileId: string;
  modeId: string;
  covers: CoverOption[];
  limits: ActionLimits;
  /** A giveaway with entries: its terms can't change. */
  locked: boolean;
  nextSortOrder: number;
  firstName: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initial ? { title: initial.title, intro: initial.intro, cta_label: initial.cta_label, cover_block_id: initial.cover_block_id, config: initial.config, starts_at: initial.starts_at, ends_at: initial.ends_at } : starter);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const status: ActionStatus = initial?.status ?? "draft";
  const config = draft.config;
  const questions = config.questions ?? [];
  const problems = problemsOf(kind, draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial ? { title: initial.title, intro: initial.intro, cta_label: initial.cta_label, cover_block_id: initial.cover_block_id, config: initial.config, starts_at: initial.starts_at, ends_at: initial.ends_at } : starter);
  const giveawayBlocked = kind === "giveaway" && limits.open_giveaways === 0;

  const setConfig = (next: Partial<ActionConfig>) => { setSaved(false); setDraft((current) => ({ ...current, config: { ...current.config, ...next } })); };
  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => { setSaved(false); setDraft((current) => ({ ...current, [key]: value })); };
  const preview: PublicAction = useMemo(() => ({ id: initial?.id ?? "preview", kind, title: draft.title || "Untitled", intro: draft.intro, cta_label: draft.cta_label, cover_block_id: draft.cover_block_id, config: cleanConfig(draft.config), starts_at: draft.starts_at, ends_at: draft.ends_at }), [draft, initial?.id, kind]);
  const coverUrl = covers.find((item) => item.id === draft.cover_block_id)?.imageUrl ?? null;

  async function save(nextStatus: ActionStatus = status) {
    if (problems.length && nextStatus !== "archived") { setError(problems[0]); return; }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const row = { title: draft.title.trim(), intro: draft.intro.trim(), cta_label: draft.cta_label.trim(), cover_block_id: draft.cover_block_id, config: cleanConfig(draft.config), starts_at: draft.starts_at, ends_at: draft.ends_at, status: nextStatus };
    const result = initial
      ? await supabase.from("profile_actions").update(locked ? { status: nextStatus, intro: row.intro, cta_label: row.cta_label, cover_block_id: row.cover_block_id } : row).eq("id", initial.id).eq("profile_id", profileId).select("id").single()
      : await supabase.from("profile_actions").insert({ ...row, profile_id: profileId, mode_id: modeId, kind, sort_order: nextSortOrder }).select("id").single();
    setBusy(false);
    if (result.error || !result.data) { setError(actionErrorMessage(result.error?.message)); return; }
    setSaved(true);
    if (!initial) router.replace(`/app/identity/creator/actions/${result.data.id}?tab=edit`);
    else router.refresh();
  }

  async function remove() {
    if (!initial || !window.confirm("Delete this Action and every response to it? This can't be undone.")) return;
    setBusy(true);
    const { error: deleteError } = await createClient().from("profile_actions").delete().eq("id", initial.id).eq("profile_id", profileId);
    setBusy(false);
    if (deleteError) { setError("That didn't delete. Try again."); return; }
    router.replace("/app/identity/creator/actions");
    router.refresh();
  }

  function setQuestion(id: string, next: Partial<Question>) {
    setConfig({ questions: questions.map((question) => (question.id === id ? { ...question, ...next } : question)) });
  }
  function addQuestion() {
    const used = new Set(questions.map((question) => Number(question.id.slice(1))));
    let n = 1;
    while (used.has(n)) n += 1;
    setConfig({ questions: [...questions, { id: `q${n}`, label: "", type: "short" }] });
  }

  const lockNote = locked ? <p className="rounded-2xl bg-[#E8E2D4] px-4 py-3 text-[14px]">People have entered, so the title, prize, rules and dates are fixed. You can still change the intro, picture and button.</p> : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:gap-10">
      <div className="flex min-w-0 flex-col gap-7">
        {lockNote}
        {giveawayBlocked && <p className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#FFE7B8] px-4 py-3 text-[14px]"><PlusTag /> You can draft a giveaway on Free. Publishing one comes with Plus.</p>}

        <section className="grid gap-5">
          <Field hint={`${draft.title.length}/100`} htmlFor="action-title" label="Title"><TextInput disabled={locked} id="action-title" maxLength={100} onChange={(event) => setField("title", event.target.value)} value={draft.title} /></Field>
          <Field hint={`${draft.intro.length}/600`} htmlFor="action-intro" label="Intro"><TextArea id="action-intro" maxLength={600} onChange={(event) => setField("intro", event.target.value)} value={draft.intro} /></Field>
          <Field hint="Leave empty for the default" htmlFor="action-cta" label="Button"><TextInput id="action-cta" maxLength={40} onChange={(event) => setField("cta_label", event.target.value)} placeholder={preview.kind === "collab" ? "Send a proposal" : preview.kind === "giveaway" ? "Enter giveaway" : preview.kind === "booking" ? "Request" : "Send"} value={draft.cta_label} /></Field>
        </section>

        {kind !== "collab" && (
          <section>
            <div className="mb-2 flex items-baseline justify-between"><h2 className="text-sm font-semibold">Picture</h2><span className="text-[13px] text-black/50">From your Work</span></div>
            {covers.length ? (
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                <button aria-pressed={!draft.cover_block_id} className={`grid h-[72px] w-[96px] shrink-0 place-items-center rounded-[14px] text-[13px] font-semibold ${!draft.cover_block_id ? "shadow-[inset_0_0_0_2px_#0D0D0D]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)]"}`} onClick={() => setField("cover_block_id", null)} type="button">None</button>
                {covers.map((cover) => (
                  <button aria-label={`Use ${cover.title}`} aria-pressed={draft.cover_block_id === cover.id} className={`relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-[14px] bg-[#E6E4DC] ${draft.cover_block_id === cover.id ? "outline outline-2 outline-offset-2 outline-[#0D0D0D]" : ""}`} key={cover.id} onClick={() => setField("cover_block_id", cover.id)} type="button">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed owner media */}
                    {cover.imageUrl && <img alt="" className="size-full object-cover" src={cover.imageUrl} />}
                  </button>
                ))}
              </div>
            ) : <p className="text-[14px] text-black/60">Add a photo to Work to use it here.</p>}
          </section>
        )}

        <section className="grid gap-5 border-t border-black/10 pt-6">
          <Mono className="text-black/55">{ACTION_KIND_NAME[kind]}</Mono>
          {kind === "collab" && (
            <>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">What you take on</legend>
                <div className="flex flex-wrap gap-2">{COLLAB_TYPES.map((type) => {
                  const list = config.types ?? [...COLLAB_TYPES];
                  const on = list.includes(type);
                  return <button aria-pressed={on} className={chip(on)} key={type} onClick={() => setConfig({ types: (on ? list.filter((item) => item !== type) : [...list, type]) as CollabType[] })} type="button">{COLLAB_TYPE_LABEL[type]}</button>;
                })}</div>
              </fieldset>
              <Field hint="A few words" htmlFor="collab-availability" label="Availability"><TextInput id="collab-availability" maxLength={120} onChange={(event) => setConfig({ availability: event.target.value })} placeholder="Open for 2 partnerships · December" value={config.availability ?? ""} /></Field>
              <ToggleRow label="Ask for a budget" on={config.askBudget === true} onChange={(askBudget) => setConfig({ askBudget })} />
              <ToggleRow label="Ask for a timeline" on={config.askTimeline === true} onChange={(askTimeline) => setConfig({ askTimeline })} />
              <ToggleRow label="Ask for a website" on={config.askWebsite === true} onChange={(askWebsite) => setConfig({ askWebsite })} />
            </>
          )}
          {kind === "giveaway" && (
            <>
              <Field htmlFor="give-prize" label="Prize"><TextInput disabled={locked} id="give-prize" maxLength={200} onChange={(event) => setConfig({ prize: event.target.value })} placeholder="A signed print, shipped anywhere in the EU" value={config.prize ?? ""} /></Field>
              <Field htmlFor="give-sponsor" hint="Who runs it and sends the prize" label="Run by"><TextInput disabled={locked} id="give-sponsor" maxLength={120} onChange={(event) => setConfig({ sponsor: event.target.value })} value={config.sponsor ?? ""} /></Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field htmlFor="give-start" hint="Optional" label="Opens"><TextInput disabled={locked} id="give-start" onChange={(event) => setField("starts_at", fromLocalInput(event.target.value))} type="datetime-local" value={toLocalInput(draft.starts_at)} /></Field>
                <Field htmlFor="give-end" label="Ends"><TextInput disabled={locked} id="give-end" onChange={(event) => setField("ends_at", fromLocalInput(event.target.value))} type="datetime-local" value={toLocalInput(draft.ends_at)} /></Field>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Minimum age</p>
                <Segmented label="Minimum age" onChange={(value) => !locked && setConfig({ minAge: Number(value) as ActionConfig["minAge"] })} options={(["13", "16", "18", "21"] as const).map((value) => ({ value, label: `${value}+`, disabled: locked }))} value={String(config.minAge ?? 18) as "13" | "16" | "18" | "21"} />
              </div>
              <Field hint={`${(config.eligibility ?? "").length}/600`} htmlFor="give-eligibility" label="Who can enter"><TextArea disabled={locked} id="give-eligibility" maxLength={600} onChange={(event) => setConfig({ eligibility: event.target.value })} placeholder="Residents of the Netherlands and Belgium." value={config.eligibility ?? ""} /></Field>
              <Field hint={`${(config.rules ?? "").length}/6000`} htmlFor="give-rules" label="Official rules"><TextArea className="min-h-[180px]" disabled={locked} id="give-rules" maxLength={6000} onChange={(event) => setConfig({ rules: event.target.value })} placeholder="How the winner is chosen, when they're contacted, and what happens if they don't reply." value={config.rules ?? ""} /></Field>
              <p className="text-[13px] leading-[1.5] text-black/60">You run this giveaway and pick the winner. Check the rules that apply where your entrants live. Entries are confirmed by email, one per email address; Setuvara can&apos;t guarantee one per person.</p>
            </>
          )}
          {kind === "booking" && (
            <>
              <div><p className="mb-2 text-sm font-semibold">Type</p><Segmented label="Type" onChange={(offering) => setConfig({ offering })} options={[{ value: "booking", label: "Booking request" }, { value: "application", label: "Application" }]} value={config.offering ?? "booking"} /></div>
              <Field hint={`${(config.details ?? "").length}/1200`} htmlFor="book-details" label="What's included"><TextArea id="book-details" maxLength={1200} onChange={(event) => setConfig({ details: event.target.value })} value={config.details ?? ""} /></Field>
              <Field hint="Shown as text. No payment is taken." htmlFor="book-price" label="Price note"><TextInput id="book-price" maxLength={80} onChange={(event) => setConfig({ priceNote: event.target.value })} placeholder="From €450 · invoiced after" value={config.priceNote ?? ""} /></Field>
              <ToggleRow label="Ask for preferred dates" on={config.askDates === true} onChange={(askDates) => setConfig({ askDates })} />
              <Field htmlFor="book-until" hint="Optional" label="Open until"><TextInput id="book-until" onChange={(event) => setField("ends_at", fromLocalInput(event.target.value))} type="datetime-local" value={toLocalInput(draft.ends_at)} /></Field>
            </>
          )}
          {kind === "submission" && (
            <>
              <Field hint={`${(config.prompt ?? "").length}/200`} htmlFor="sub-prompt" label="Your question"><TextInput id="sub-prompt" maxLength={200} onChange={(event) => setConfig({ prompt: event.target.value })} value={config.prompt ?? ""} /></Field>
              <ToggleRow label="Allow sending without a name" on={config.allowAnonymous === true} onChange={(allowAnonymous) => setConfig({ allowAnonymous })} />
              <ToggleRow label="Require an email" on={config.emailRequired === true} onChange={(emailRequired) => setConfig({ emailRequired })} />
              <ToggleRow label="Ask permission to feature it" on={config.askFeatureConsent === true} onChange={(askFeatureConsent) => setConfig({ askFeatureConsent })} />
              <Field htmlFor="sub-until" hint="Optional" label="Open until"><TextInput id="sub-until" onChange={(event) => setField("ends_at", fromLocalInput(event.target.value))} type="datetime-local" value={toLocalInput(draft.ends_at)} /></Field>
            </>
          )}
        </section>

        <section className="border-t border-black/10 pt-6">
          <div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="text-[17px] font-semibold">Your questions</h2><span className="text-[13px] text-black/55">{questions.length} of {limits.custom_questions}</span></div>
          <ul className="flex flex-col gap-3">
            {questions.map((question) => (
              <li className="grid gap-3 rounded-[18px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]" key={question.id}>
                <div className="flex items-center gap-2">
                  <TextInput aria-label="Question" disabled={locked} maxLength={120} onChange={(event) => setQuestion(question.id, { label: event.target.value })} placeholder="Where are you based?" value={question.label} />
                  <button aria-label="Remove question" className="grid size-11 shrink-0 place-items-center rounded-full text-[18px] text-black/55 hover:bg-black/[0.05] disabled:opacity-30" disabled={locked} onClick={() => setConfig({ questions: questions.filter((item) => item.id !== question.id) })} type="button">×</button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Segmented label="Answer type" onChange={(type) => !locked && setQuestion(question.id, { type, options: type === "choice" ? question.options ?? ["", ""] : undefined })} options={[{ value: "short", label: "Short" }, { value: "long", label: "Long" }, { value: "choice", label: "Choice" }]} size="sm" value={question.type} />
                  <label className="ml-auto flex items-center gap-2 text-sm font-semibold">Required<Toggle disabled={locked} label="Required" on={question.required === true} onChange={(required) => setQuestion(question.id, { required })} /></label>
                </div>
                {question.type === "choice" && <TextInput aria-label="Options, separated by commas" disabled={locked} onChange={(event) => setQuestion(question.id, { options: event.target.value.split(",").slice(0, 8) })} placeholder="Options, separated by commas" value={(question.options ?? []).join(",")} />}
              </li>
            ))}
          </ul>
          <button className={`${lineButton} mt-3`} disabled={locked || questions.length >= limits.custom_questions} onClick={addQuestion} type="button">Add a question</button>
          {questions.length >= limits.custom_questions && limits.plan !== "pro" && <p className="mt-2 text-[13px] text-black/60">{limits.plan === "free" ? "Plus" : "Pro"} allows more questions.</p>}
        </section>

        <div className="sticky bottom-0 z-10 -mx-3.5 flex flex-wrap items-center gap-3 border-t border-black/10 bg-[#F5F4EF] px-3.5 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
          {status === "draft" && <><button className={coralButton} disabled={busy || giveawayBlocked} onClick={() => void save("published")} type="button">Publish</button><button className={lineButton} disabled={busy || (initial !== null && !dirty)} onClick={() => void save("draft")} type="button">Save draft</button></>}
          {status === "published" && <><button className={inkButton} disabled={busy || !dirty} onClick={() => void save()} type="button">Save changes</button><button className={lineButton} disabled={busy} onClick={() => void save("closed")} type="button">Close</button></>}
          {status === "closed" && <><button className={coralButton} disabled={busy} onClick={() => void save("published")} type="button">Reopen</button><button className={lineButton} disabled={busy} onClick={() => void save("archived")} type="button">Archive</button></>}
          {status === "archived" && <button className={lineButton} disabled={busy} onClick={() => void save("draft")} type="button">Restore as draft</button>}
          {initial && <button className="min-h-11 rounded-full px-3 text-[15px] font-semibold text-[#B42318] hover:bg-black/[0.04] disabled:opacity-50" disabled={busy} onClick={() => void remove()} type="button">Delete</button>}
          <span aria-live="polite" className="text-[14px] text-black/60">{busy ? "Saving…" : error ? "" : saved && !dirty ? "Saved" : ""}</span>
          {error && <p className="w-full text-sm font-medium text-[#B42318]" role="alert">{error}</p>}
        </div>
      </div>

      <aside aria-label="Preview" className="flex h-fit flex-col gap-4 lg:sticky lg:top-6">
        <Mono className="text-black/55">On your page</Mono>
        <div className="@container/profile rounded-[26px] bg-[#F5F4EF] p-4 text-[#0D0D0D] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]"><ActionCard accent="#FF5A4F" accentInk="#0D0D0D" action={preview} coverUrl={coverUrl} /></div>
        <Mono className="mt-2 text-black/55">The form</Mono>
        <div className="relative max-h-[560px] overflow-y-auto rounded-[26px] bg-[#F5F4EF] px-5 pb-2 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]"><ActionForm action={preview} firstName={firstName} preview /></div>
      </aside>
    </div>
  );
}

function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: (next: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-[15px] font-semibold">{label}</span><Toggle label={label} on={on} onChange={onChange} /></div>;
}
