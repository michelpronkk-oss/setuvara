"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Field, PlusTag, Segmented, TextArea, TextInput, Toggle } from "@/app/app/identity/editor-ui";
import { coralButton, inkButton, lineButton } from "@/components/creator/studio-ui";
import { actionErrorMessage, ACTION_KIND_NAME, COLLAB_TYPE_LABEL, COLLAB_TYPES, DEFAULT_CTA, type ActionConfig, type ActionKind, type ActionLimits, type ActionStatus, type ActionThanks, type ActionThanksRow, type CollabType, type ProfileAction, type PublicAction, type Question } from "@/lib/actions/model";
import { createClient } from "@/lib/supabase/client";
import { ActionPhone, type PhoneView, type PreviewSource } from "./action-phone";

export type CoverOption = { id: string; imageUrl: string | null; title: string };
type Draft = Pick<ProfileAction, "title" | "intro" | "cta_label" | "cover_block_id" | "config" | "starts_at" | "ends_at"> & Partial<Pick<ProfileAction, "show_before_start" | "show_after_end">>;
type Thanks = Omit<ActionThanksRow, "action_id">;
const NO_THANKS: Thanks = { heading: "", reward_kind: "none", reward_label: "", reward_url: null, reward_code: null };
const HTTPS = /^https:\/\/\S+$/;

const chip = (on: boolean) => `inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-semibold transition-colors focus-visible:outline-2 ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] hover:bg-black/[0.03]"}`;
const FREQUENCIES = ["Weekly", "Every two weeks", "Monthly", "Now and then"];

/** datetime-local works in the owner's own time zone; the database stores UTC. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

function problemsOf(kind: ActionKind, draft: Draft, thanks: Thanks) {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push("Add a title.");
  for (const question of draft.config.questions ?? []) {
    if (!question.label.trim()) problems.push("Every question needs a label.");
    if (question.type === "choice" && ((question.options ?? []).filter((option) => option.trim()).length < 2)) problems.push(`"${question.label || "A choice question"}" needs at least two options.`);
  }
  if (draft.starts_at && draft.ends_at && new Date(draft.ends_at) <= new Date(draft.starts_at)) problems.push("The end has to come after the start.");
  if (kind === "giveaway" && !draft.ends_at) problems.push("A giveaway needs an end date.");
  if (kind === "collab" && draft.config.types && draft.config.types.length === 0) problems.push("Pick at least one kind of work.");
  if (kind === "form" && !(draft.config.questions ?? []).length) problems.push("Add at least one question.");
  if (thanks.reward_kind === "link" && !HTTPS.test(thanks.reward_url?.trim() ?? "")) problems.push("The reward link has to start with https://.");
  if (thanks.reward_kind === "code" && !thanks.reward_code?.trim()) problems.push("Add the reward code.");
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

/** One numbered panel of the editor. */
function Panel({ step, title, note, children, aside }: { step: string; title: string; note?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_0_rgba(13,13,13,.04),inset_0_0_0_1px_rgba(13,13,13,.07)] md:p-7">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="font-label text-[11px] tracking-[0.14em] text-black/40">{step}</span>
          <div>
            <h2 className="font-display text-[22px] font-bold leading-tight tracking-[-0.035em]">{title}</h2>
            {note && <p className="mt-1 max-w-[52ch] text-[14px] leading-[1.45] text-black/55">{note}</p>}
          </div>
        </div>
        {aside}
      </header>
      <div className="grid gap-5">{children}</div>
    </section>
  );
}

function ToggleRow({ label, note, on, onChange, disabled = false }: { label: string; note?: string; on: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] bg-[#F5F4EF] py-1 pl-4 pr-1.5">
      <span className="min-w-0 py-2"><span className="block text-[15px] font-semibold">{label}</span>{note && <span className="block text-[13px] text-black/55">{note}</span>}</span>
      <Toggle disabled={disabled} label={label} on={on} onChange={onChange} />
    </div>
  );
}

const VIEWS: { value: PhoneView; label: string }[] = [{ value: "page", label: "On your page" }, { value: "form", label: "Form" }, { value: "done", label: "After sending" }];

/**
 * Create and edit one Action, beside a phone that shows the real page: the Mode's profile with the
 * draft card in place, the Action's own page, and the moment after sending. Saving goes through RLS
 * as the owner; the database re-checks every field and the plan limits.
 */
export function ActionEditor({ kind, initial, thanks: thanks0 = null, starter, profileId, modeId, covers, limits, locked, nextSortOrder, firstName, preview, base, listHref, coverHint }: {
  kind: ActionKind;
  initial: ProfileAction | null;
  /** The saved thank-you heading and reward, if any. */
  thanks?: ActionThanksRow | null;
  starter: Draft;
  profileId: string;
  modeId: string;
  covers: CoverOption[];
  limits: ActionLimits;
  /** A giveaway with entries: its terms can't change. */
  locked: boolean;
  nextSortOrder: number;
  firstName: string;
  preview: PreviewSource;
  /** Where this Mode's Actions live; an Action opens at base/<id>. */
  base: string;
  listHref: string;
  /** Where pictures for a cover come from in this Mode. */
  coverHint: string;
}) {
  const router = useRouter();
  const saved0 = initial ? { title: initial.title, intro: initial.intro, cta_label: initial.cta_label, cover_block_id: initial.cover_block_id, config: initial.config, starts_at: initial.starts_at, ends_at: initial.ends_at, show_before_start: initial.show_before_start, show_after_end: initial.show_after_end } : starter;
  const savedThanks: Thanks = thanks0 ? { heading: thanks0.heading, reward_kind: thanks0.reward_kind, reward_label: thanks0.reward_label, reward_url: thanks0.reward_url, reward_code: thanks0.reward_code } : NO_THANKS;
  const [draft, setDraft] = useState<Draft>(saved0);
  const [thanks, setThanksDraft] = useState<Thanks>(savedThanks);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [view, setView] = useState<PhoneView>("page");
  const [replay, setReplay] = useState(0);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const status: ActionStatus = initial?.status ?? "draft";
  const config = draft.config;
  const questions = config.questions ?? [];
  const problems = problemsOf(kind, draft, thanks);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved0) || JSON.stringify(thanks) !== JSON.stringify(savedThanks);
  // A reward the plan doesn't include can be kept but not changed, so Free shows it as a Plus feature.
  const rewardLocked = !limits.can_reward;
  const giveawayBlocked = kind === "giveaway" && limits.open_giveaways === 0;
  const asksQuestions = kind !== "newsletter";

  const setConfig = (next: Partial<ActionConfig>) => { setSaved(false); setDraft((current) => ({ ...current, config: { ...current.config, ...next } })); };
  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => { setSaved(false); setDraft((current) => ({ ...current, [key]: value })); };
  const action: PublicAction = useMemo(() => ({ id: initial?.id ?? "draft-preview", kind, title: draft.title || "Untitled", intro: draft.intro, cta_label: draft.cta_label, cover_block_id: draft.cover_block_id, config: cleanConfig(draft.config), starts_at: draft.starts_at, ends_at: draft.ends_at }), [draft, initial?.id, kind]);
  const setThanks = (next: Partial<Thanks>) => { setSaved(false); setThanksDraft((current) => ({ ...current, ...next })); if (view !== "done") showView("done"); };
  const previewThanks: ActionThanks = useMemo(() => ({
    heading: thanks.heading,
    reward: thanks.reward_kind === "none" || rewardLocked ? null : { kind: thanks.reward_kind, label: thanks.reward_label, url: thanks.reward_url, code: thanks.reward_code || "YOURCODE" },
  }), [thanks, rewardLocked]);
  const coverUrl = covers.find((item) => item.id === draft.cover_block_id)?.imageUrl ?? null;

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!phoneOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [phoneOpen]);

  async function save(nextStatus: ActionStatus = status) {
    if (problems.length && nextStatus !== "archived") { setError(problems[0]); return; }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const row = { title: draft.title.trim(), intro: draft.intro.trim(), cta_label: draft.cta_label.trim(), cover_block_id: draft.cover_block_id, config: cleanConfig(draft.config), starts_at: draft.starts_at, ends_at: draft.ends_at, show_before_start: draft.show_before_start ?? true, show_after_end: draft.show_after_end ?? true, status: nextStatus };
    const result = initial
      ? await supabase.from("profile_actions").update(locked ? { status: nextStatus, intro: row.intro, cta_label: row.cta_label, cover_block_id: row.cover_block_id } : row).eq("id", initial.id).eq("profile_id", profileId).select("id").single()
      : await supabase.from("profile_actions").insert({ ...row, profile_id: profileId, mode_id: modeId, kind, sort_order: nextSortOrder }).select("id").single();
    if (result.error || !result.data) { setBusy(false); setError(actionErrorMessage(result.error?.message)); return; }
    // The thank-you heading and reward live beside the Action, so they never reach its public config.
    if (JSON.stringify(thanks) !== JSON.stringify(savedThanks) || !initial) {
      const empty = !thanks.heading.trim() && thanks.reward_kind === "none";
      const kept = thanks.reward_kind;
      const thanksRow = { action_id: result.data.id, profile_id: profileId, heading: thanks.heading.trim(), reward_kind: kept, reward_label: kept === "none" ? "" : thanks.reward_label.trim(),
        reward_url: kept === "link" ? thanks.reward_url?.trim() || null : null, reward_code: kept === "code" ? thanks.reward_code?.trim() || null : null };
      const thanksResult = empty
        ? await supabase.from("action_thanks").delete().eq("action_id", result.data.id)
        : await supabase.from("action_thanks").upsert(thanksRow, { onConflict: "action_id" });
      if (thanksResult.error) {
        setBusy(false);
        setError(actionErrorMessage(thanksResult.error.message));
        if (!initial) router.replace(`${base}/${result.data.id}?tab=edit`);
        return;
      }
    }
    setBusy(false);
    setSaved(true);
    if (nextStatus === "published" && status !== "published") { setView("page"); }
    if (!initial) router.replace(`${base}/${result.data.id}?tab=edit`);
    else router.refresh();
  }

  async function remove() {
    if (!initial || !window.confirm("Delete this Action and every response to it? This can't be undone.")) return;
    setBusy(true);
    const { error: deleteError } = await createClient().from("profile_actions").delete().eq("id", initial.id).eq("profile_id", profileId);
    setBusy(false);
    if (deleteError) { setError("That didn't delete. Try again."); return; }
    router.replace(listHref);
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
  function moveQuestion(id: string, by: -1 | 1) {
    const list = [...questions];
    const at = list.findIndex((question) => question.id === id);
    const to = at + by;
    if (to < 0 || to >= list.length) return;
    [list[at], list[to]] = [list[to], list[at]];
    setConfig({ questions: list });
  }

  const showView = (next: PhoneView) => { setView(next); if (next === "done") setReplay((value) => value + 1); };
  const phoneControls = (dark: boolean) => (
    <div className={`flex items-center gap-1 rounded-full p-1 ${dark ? "bg-white/10" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]"}`} role="radiogroup" aria-label="Preview">
      {VIEWS.map((item) => {
        const on = view === item.value;
        return <button aria-checked={on} className={`min-h-9 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition ${on ? (dark ? "bg-[#F5F4EF] text-[#0D0D0D]" : "bg-[#0D0D0D] text-[#F5F4EF]") : dark ? "text-[#F5F4EF]/70 hover:text-[#F5F4EF]" : "text-black/60 hover:text-black"}`} key={item.value} onClick={() => showView(item.value)} role="radio" type="button">{item.label}</button>;
      })}
    </div>
  );
  const phone = (width?: number) => <ActionPhone action={action} coverUrl={coverUrl} firstName={firstName} replay={replay} source={preview} thanks={previewThanks} view={view} width={width} />;
  const caption = view === "page" ? (status === "published" ? "Your page, with this Action where visitors find it." : "Your page once this is live. Only you see the draft.")
    : view === "form" ? "The Action's own page, in your Appearance." : kind === "newsletter" || kind === "giveaway" ? "What people see after they send. Then they confirm by email." : "What people see after they send.";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_440px] xl:gap-14">
      <div className="flex min-w-0 flex-col gap-4 pb-6">
        {locked && <p className="rounded-[20px] bg-[#E8E2D4] px-5 py-4 text-[14px]">People have entered, so the title, prize, rules and dates are fixed. You can still change the intro, picture and button.</p>}
        {giveawayBlocked && <p className="flex flex-wrap items-center gap-2 rounded-[20px] bg-[#FFE7B8] px-5 py-4 text-[14px]"><PlusTag /> You can draft a giveaway on Free. Publishing one comes with Plus.</p>}

        <Panel note="What visitors see on your page." step="01" title="The card">
          <Field hint={`${draft.title.length}/100`} htmlFor="action-title" label="Title"><TextInput big disabled={locked} id="action-title" maxLength={100} onChange={(event) => setField("title", event.target.value)} value={draft.title} /></Field>
          <Field hint={`${draft.intro.length}/600`} htmlFor="action-intro" label="Intro"><TextArea id="action-intro" maxLength={600} onChange={(event) => setField("intro", event.target.value)} value={draft.intro} /></Field>
          <Field hint="Leave empty for the default" htmlFor="action-cta" label="Button"><TextInput id="action-cta" maxLength={40} onChange={(event) => setField("cta_label", event.target.value)} placeholder={kind === "booking" && config.offering === "application" ? "Apply" : DEFAULT_CTA[kind]} value={draft.cta_label} /></Field>
          {kind !== "collab" && (
            <div>
              <div className="mb-2.5 flex items-baseline justify-between"><p className="text-sm font-semibold">Picture</p><span className="text-[13px] text-black/50">{coverHint}</span></div>
              {covers.length ? (
                <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                  <button aria-pressed={!draft.cover_block_id} className={`grid h-[78px] w-[104px] shrink-0 place-items-center rounded-[16px] bg-[#F5F4EF] text-[13px] font-semibold transition ${!draft.cover_block_id ? "shadow-[inset_0_0_0_2px_#0D0D0D]" : "text-black/55"}`} onClick={() => setField("cover_block_id", null)} type="button">None</button>
                  {covers.map((cover) => (
                    <button aria-label={`Use ${cover.title}`} aria-pressed={draft.cover_block_id === cover.id} className={`relative h-[78px] w-[104px] shrink-0 overflow-hidden rounded-[16px] bg-[#E6E4DC] transition ${draft.cover_block_id === cover.id ? "outline outline-2 outline-offset-2 outline-[#0D0D0D]" : "opacity-90 hover:opacity-100"}`} key={cover.id} onClick={() => setField("cover_block_id", cover.id)} type="button">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed owner media */}
                      {cover.imageUrl && <img alt="" className="size-full object-cover" src={cover.imageUrl} />}
                    </button>
                  ))}
                </div>
              ) : <p className="rounded-[16px] bg-[#F5F4EF] px-4 py-3 text-[14px] text-black/60">No pictures yet. {coverHint === "From your Work" ? "Add a photo to Work" : "Add a picture to this Mode's Content"} to use one here.</p>}
            </div>
          )}
        </Panel>

        <Panel note={kind === "newsletter" ? "Tell people what they're signing up for." : kind === "form" ? "Who you want to hear from, and how." : undefined} step="02" title={ACTION_KIND_NAME[kind]}>
          {kind === "newsletter" && (
            <>
              <Field hint={`${(config.promise ?? "").length}/200`} htmlFor="news-promise" label="What they get"><TextInput id="news-promise" maxLength={200} onChange={(event) => setConfig({ promise: event.target.value })} placeholder="One photo and one paragraph" value={config.promise ?? ""} /></Field>
              <div>
                <p className="mb-2.5 text-sm font-semibold">How often</p>
                <div className="flex flex-wrap gap-2">
                  {FREQUENCIES.map((item) => <button aria-pressed={config.frequency === item} className={chip(config.frequency === item)} key={item} onClick={() => setConfig({ frequency: config.frequency === item ? "" : item })} type="button">{item}</button>)}
                </div>
                <TextInput aria-label="Or in your words" className="mt-2.5" maxLength={60} onChange={(event) => setConfig({ frequency: event.target.value })} placeholder="Or in your words" value={FREQUENCIES.includes(config.frequency ?? "") ? "" : config.frequency ?? ""} />
              </div>
              <Field hint="Optional" htmlFor="news-sender" label="Sent by"><TextInput id="news-sender" maxLength={120} onChange={(event) => setConfig({ sender: event.target.value })} placeholder={firstName} value={config.sender ?? ""} /></Field>
              <ToggleRow label="Ask for a first name" note="Email is always asked. Signups confirm by email." on={config.askName !== false} onChange={(askName) => setConfig({ askName })} />
            </>
          )}
          {kind === "form" && (
            <>
              <ToggleRow label="Ask for a name" on={config.askName !== false} onChange={(askName) => setConfig({ askName })} />
              <ToggleRow label="Require an email" note="So you can reply." on={config.emailRequired === true} onChange={(emailRequired) => setConfig({ emailRequired })} />
            </>
          )}
          {kind === "collab" && (
            <>
              <fieldset>
                <legend className="mb-2.5 text-sm font-semibold">What you take on</legend>
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
              <div>
                <p className="mb-2 text-sm font-semibold">Minimum age</p>
                <Segmented label="Minimum age" onChange={(value) => !locked && setConfig({ minAge: Number(value) as ActionConfig["minAge"] })} options={(["13", "16", "18", "21"] as const).map((value) => ({ value, label: `${value}+`, disabled: locked }))} value={String(config.minAge ?? 18) as "13" | "16" | "18" | "21"} />
              </div>
              <Field hint={`${(config.eligibility ?? "").length}/600`} htmlFor="give-eligibility" label="Who can enter"><TextArea disabled={locked} id="give-eligibility" maxLength={600} onChange={(event) => setConfig({ eligibility: event.target.value })} placeholder="Residents of the Netherlands and Belgium." value={config.eligibility ?? ""} /></Field>
              <Field hint={`${(config.rules ?? "").length}/6000`} htmlFor="give-rules" label="Official rules"><TextArea className="min-h-[180px]" disabled={locked} id="give-rules" maxLength={6000} onChange={(event) => setConfig({ rules: event.target.value })} placeholder="How the winner is chosen, when they're contacted, and what happens if they don't reply." value={config.rules ?? ""} /></Field>
              <p className="text-[13px] leading-[1.5] text-black/55">You run this giveaway and pick the winner. Check the rules that apply where your entrants live. Entries are confirmed by email, one per email address; Setuvara can&apos;t guarantee one per person.</p>
            </>
          )}
          {kind === "booking" && (
            <>
              <div><p className="mb-2 text-sm font-semibold">Type</p><Segmented label="Type" onChange={(offering) => setConfig({ offering })} options={[{ value: "booking", label: "Booking request" }, { value: "application", label: "Application" }]} value={config.offering ?? "booking"} /></div>
              <Field hint={`${(config.details ?? "").length}/1200`} htmlFor="book-details" label="What's included"><TextArea id="book-details" maxLength={1200} onChange={(event) => setConfig({ details: event.target.value })} value={config.details ?? ""} /></Field>
              <Field hint="Shown as text. No payment is taken." htmlFor="book-price" label="Price note"><TextInput id="book-price" maxLength={80} onChange={(event) => setConfig({ priceNote: event.target.value })} placeholder="From €450 · invoiced after" value={config.priceNote ?? ""} /></Field>
              <ToggleRow label="Ask for preferred dates" on={config.askDates === true} onChange={(askDates) => setConfig({ askDates })} />
            </>
          )}
          {kind === "submission" && (
            <>
              <Field hint={`${(config.prompt ?? "").length}/200`} htmlFor="sub-prompt" label="Your question"><TextInput id="sub-prompt" maxLength={200} onChange={(event) => setConfig({ prompt: event.target.value })} value={config.prompt ?? ""} /></Field>
              <ToggleRow label="Allow sending without a name" on={config.allowAnonymous === true} onChange={(allowAnonymous) => setConfig({ allowAnonymous })} />
              <ToggleRow label="Require an email" on={config.emailRequired === true} onChange={(emailRequired) => setConfig({ emailRequired })} />
              <ToggleRow label="Ask permission to feature it" on={config.askFeatureConsent === true} onChange={(askFeatureConsent) => setConfig({ askFeatureConsent })} />
            </>
          )}
        </Panel>

        {asksQuestions && (
          <Panel aside={<span className="rounded-full bg-[#F5F4EF] px-3 py-1 font-label text-[11px] tracking-[0.08em] text-black/60">{questions.length} / {limits.custom_questions}</span>} note={kind === "form" ? "The heart of a form. Short, long or a choice." : "Anything else you want to know."} step="03" title="Questions">
            {questions.length > 0 && (
              <ol className="flex flex-col gap-3">
                {questions.map((question, index) => (
                  <li className="grid gap-3 rounded-[20px] bg-[#F5F4EF] p-3.5 md:p-4" key={question.id}>
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white font-label text-[11px] text-black/55">{index + 1}</span>
                      <TextInput aria-label={`Question ${index + 1}`} disabled={locked} maxLength={120} onChange={(event) => setQuestion(question.id, { label: event.target.value })} placeholder="Where are you based?" value={question.label} />
                      <div className="flex shrink-0">
                        <button aria-label="Move up" className="grid size-9 place-items-center rounded-full text-black/45 hover:bg-white hover:text-black disabled:opacity-25" disabled={locked || index === 0} onClick={() => moveQuestion(question.id, -1)} type="button">↑</button>
                        <button aria-label="Move down" className="grid size-9 place-items-center rounded-full text-black/45 hover:bg-white hover:text-black disabled:opacity-25" disabled={locked || index === questions.length - 1} onClick={() => moveQuestion(question.id, 1)} type="button">↓</button>
                        <button aria-label="Remove question" className="grid size-9 place-items-center rounded-full text-[18px] text-black/45 hover:bg-white hover:text-[#B42318] disabled:opacity-25" disabled={locked} onClick={() => setConfig({ questions: questions.filter((item) => item.id !== question.id) })} type="button">×</button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pl-10">
                      <Segmented label="Answer type" onChange={(type) => !locked && setQuestion(question.id, { type, options: type === "choice" ? question.options ?? ["", ""] : undefined })} options={[{ value: "short", label: "Short" }, { value: "long", label: "Long" }, { value: "choice", label: "Choice" }]} size="sm" value={question.type} />
                      <label className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-black/70">Required<Toggle disabled={locked} label="Required" on={question.required === true} onChange={(required) => setQuestion(question.id, { required })} /></label>
                    </div>
                    {question.type === "choice" && <div className="pl-10"><TextInput aria-label="Options, separated by commas" disabled={locked} onChange={(event) => setQuestion(question.id, { options: event.target.value.split(",").slice(0, 8) })} placeholder="Options, separated by commas" value={(question.options ?? []).join(",")} /></div>}
                  </li>
                ))}
              </ol>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button className={lineButton} disabled={locked || questions.length >= limits.custom_questions} onClick={addQuestion} type="button"><span aria-hidden="true">+</span>Add a question</button>
              {questions.length >= limits.custom_questions && limits.plan !== "pro" && <span className="flex items-center gap-2 text-[13px] text-black/60"><PlusTag label={limits.plan === "free" ? "Plus" : "Pro"} />allows more questions.</span>}
            </div>
          </Panel>
        )}

        <Panel note="When it takes responses, and what people see after." step={asksQuestions ? "04" : "03"} title="Timing and thanks">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field htmlFor="action-start" hint="Optional" label="Opens"><TextInput disabled={locked} id="action-start" onChange={(event) => setField("starts_at", fromLocalInput(event.target.value))} type="datetime-local" value={toLocalInput(draft.starts_at)} /></Field>
            <Field htmlFor="action-end" hint={kind === "giveaway" ? undefined : "Optional"} label={kind === "giveaway" ? "Ends" : "Closes"}><TextInput disabled={locked} id="action-end" onChange={(event) => setField("ends_at", fromLocalInput(event.target.value))} type="datetime-local" value={toLocalInput(draft.ends_at)} /></Field>
          </div>
          {(draft.starts_at || draft.ends_at) && (
            <div className="-mt-1 grid gap-2">
              {draft.starts_at && <ToggleRow label="Show before it opens" note="With a countdown. Off keeps it hidden until then." on={draft.show_before_start !== false} onChange={(next) => setField("show_before_start", next)} />}
              {draft.ends_at && <ToggleRow label="Show after it closes" note="Marked closed. Off takes it off your page." on={draft.show_after_end !== false} onChange={(next) => setField("show_after_end", next)} />}
            </div>
          )}
          <Field hint={`${thanks.heading.length}/60`} htmlFor="action-heading" label="Thank-you heading"><TextInput id="action-heading" maxLength={60} onChange={(event) => setThanks({ heading: event.target.value })} placeholder={kind === "newsletter" ? "You're on the list." : "Sent."} value={thanks.heading} /></Field>
          <Field hint={`${(config.thanks ?? "").length}/200`} htmlFor="action-thanks" label="Thank-you line">
            <TextInput disabled={locked && kind === "giveaway"} id="action-thanks" maxLength={200} onChange={(event) => { setConfig({ thanks: event.target.value }); if (view !== "done") showView("done"); }} placeholder={kind === "newsletter" ? "See you in your inbox." : "Thank you, I read every one."} value={config.thanks ?? ""} />
          </Field>
          <div>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Reward</p>
              {rewardLocked && <span className="flex items-center gap-2 text-[13px] text-black/60"><PlusTag />Give a link or code</span>}
            </div>
            <Segmented label="Reward" onChange={(reward_kind) => !rewardLocked && setThanks({ reward_kind })} options={[{ value: "none", label: "None" }, { value: "link", label: "Link", disabled: rewardLocked }, { value: "code", label: "Code", disabled: rewardLocked }]} value={thanks.reward_kind} />
            {thanks.reward_kind !== "none" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field hint="Optional" htmlFor="reward-label" label="Label"><TextInput disabled={rewardLocked} id="reward-label" maxLength={60} onChange={(event) => setThanks({ reward_label: event.target.value })} placeholder={thanks.reward_kind === "code" ? "10% off your first order" : "Download the preset pack"} value={thanks.reward_label} /></Field>
                {thanks.reward_kind === "link"
                  ? <Field htmlFor="reward-url" label="Link"><TextInput disabled={rewardLocked} id="reward-url" inputMode="url" maxLength={2048} onChange={(event) => setThanks({ reward_url: event.target.value })} placeholder="https://" value={thanks.reward_url ?? ""} /></Field>
                  : <Field htmlFor="reward-code" label="Code"><TextInput disabled={rewardLocked} id="reward-code" maxLength={80} onChange={(event) => setThanks({ reward_code: event.target.value })} placeholder="WELCOME10" value={thanks.reward_code ?? ""} /></Field>}
              </div>
            )}
          </div>
          <p className="-mt-2 text-[13px] leading-[1.5] text-black/50">{kind === "newsletter" || kind === "giveaway" ? "The reward shows once they confirm by email." : "The reward shows only after someone sends."} It never appears on your page itself.</p>
        </Panel>

        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 mt-2 flex flex-wrap items-center gap-1.5 rounded-[24px] bg-[#0D0D0D]/[0.92] p-2 pl-4 sm:gap-2.5 sm:p-2.5 text-[#F5F4EF] shadow-[0_24px_50px_-24px_rgba(13,13,13,.7)] backdrop-blur-md lg:bottom-5">
          <span aria-live="polite" className="mr-auto flex min-w-0 items-center gap-2 text-[14px]">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: status === "published" ? "#C7FF4A" : status === "draft" ? "#FFE7B8" : "#F5F4EF66" }} />
            <span className="truncate max-sm:sr-only">{busy ? "Saving…" : error ? "Not saved" : dirty ? "Unsaved changes" : saved ? "Saved" : status === "published" ? "Live on your page" : status === "draft" ? "Draft" : status === "closed" ? "Closed" : "Archived"}</span>
          </span>
          <button className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[15px] font-semibold lg:hidden" onClick={() => setPhoneOpen(true)} type="button">Preview</button>
          {initial && <button className="min-h-11 rounded-full px-3 text-[15px] font-semibold text-[#FF8A80] hover:bg-white/10 disabled:opacity-50 max-sm:hidden" disabled={busy} onClick={() => void remove()} type="button">Delete</button>}
          {status === "draft" && <><button className="inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold hover:bg-white/10 disabled:opacity-40" disabled={busy || (initial !== null && !dirty)} onClick={() => void save("draft")} type="button">Save draft</button><button className={coralButton} disabled={busy || giveawayBlocked} onClick={() => void save("published")} type="button">Publish</button></>}
          {status === "published" && <><button className="inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold hover:bg-white/10 disabled:opacity-40" disabled={busy} onClick={() => void save("closed")} type="button">Close</button><button className={`${inkButton} !bg-[#F5F4EF] !text-[#0D0D0D]`} disabled={busy || !dirty} onClick={() => void save()} type="button">Save changes</button></>}
          {status === "closed" && <><button className="inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold hover:bg-white/10" disabled={busy} onClick={() => void save("archived")} type="button">Archive</button><button className={coralButton} disabled={busy} onClick={() => void save("published")} type="button">Reopen</button></>}
          {status === "archived" && <button className={`${lineButton} !bg-[#F5F4EF]`} disabled={busy} onClick={() => void save("draft")} type="button">Restore as draft</button>}
          {error && <p className="w-full px-1 pb-1 text-sm font-medium text-[#FF8A80]" role="alert">{error}</p>}
        </div>
        {initial && <button className="self-start rounded-full px-3 py-2 text-[14px] font-semibold text-[#B42318] hover:bg-black/[0.04] sm:hidden" disabled={busy} onClick={() => void remove()} type="button">Delete this Action</button>}
      </div>

      <aside aria-label="Preview" className="hidden lg:block">
        <div className="sticky top-[96px] flex flex-col items-center gap-4">
          {phoneControls(false)}
          {phone(view === "page" ? 360 : 360)}
          <p className="max-w-[320px] text-center text-[13px] leading-5 text-black/55">{caption}</p>
          {view === "done" && <button className="text-[13px] font-semibold underline underline-offset-4" onClick={() => setReplay((value) => value + 1)} type="button">Play again</button>}
        </div>
      </aside>

      {phoneOpen && (
        <div aria-label="Preview" aria-modal="true" className="fixed inset-0 z-[90] flex flex-col items-center gap-4 overflow-y-auto bg-[#0D0D0D] px-4 pb-8 pt-[calc(14px+env(safe-area-inset-top))] lg:hidden" role="dialog">
          <div className="flex w-full max-w-[400px] items-center justify-between gap-2">
            {phoneControls(true)}
            <button aria-label="Close preview" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-lg text-[#F5F4EF]" onClick={() => setPhoneOpen(false)} type="button">×</button>
          </div>
          {phone(Math.min(340, typeof window === "undefined" ? 340 : window.innerWidth - 40))}
          <p className="max-w-[320px] text-center text-[13px] leading-5 text-[#F5F4EF]/60">{caption}</p>
        </div>
      )}
    </div>
  );
}
