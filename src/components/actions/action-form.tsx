"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { BUDGET_LABEL, BUDGETS, COLLAB_TYPE_LABEL, COLLAB_TYPES, ctaFor, type Budget, type CollabType, type PublicAction, type Question } from "@/lib/actions/model";

const chip = (on: boolean) => `inline-flex min-h-11 items-center rounded-full px-[18px] text-[15px] font-semibold transition-colors focus-visible:outline-2 ${on ? "bg-[#0D0D0D] text-[#F5F4EF]" : "bg-white text-[#0D0D0D] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] hover:bg-black/[0.03]"}`;
const input = "min-h-12 w-full rounded-[16px] bg-white px-4 text-[16px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D] aria-[invalid=true]:shadow-[inset_0_0_0_2px_#B42318]";
const area = "min-h-[132px] w-full resize-y rounded-[20px] bg-white p-4 text-[16px] leading-[1.5] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D] aria-[invalid=true]:shadow-[inset_0_0_0_2px_#B42318]";
const optional = <span className="font-normal text-black/50"> optional</span>;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.padEnd(16, "0");
}

/**
 * A visitor's form for one Action. It sends to Setuvara's own route, which re-checks everything;
 * nothing here opens a chat or a Connection. In previews it renders the same, but never sends.
 */
export function ActionForm({ action, firstName, backHref, preview = false, signedInName = "" }: { action: PublicAction; firstName: string; backHref?: string; preview?: boolean; signedInName?: string }) {
  const uid = useId();
  const { config } = action;
  const types = (config.types?.length ? config.types : COLLAB_TYPES) as CollabType[];
  const questions: Question[] = config.questions ?? [];
  const anonymous = action.kind === "submission" && config.allowAnonymous === true;
  const emailNeeded = action.kind !== "submission" || config.emailRequired === true;

  const [name, setName] = useState(signedInName);
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [accept, setAccept] = useState(false);
  const [hp, setHp] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [meta] = useState(() => ({ key: newKey(), openedAt: Date.now() }));

  const set = (key: string, value: string) => setAnswers((current) => ({ ...current, [key]: value }));
  const value = (key: string) => answers[key] ?? "";

  const problems: Record<string, string> = {};
  if (!name.trim() && !anonymous) problems.name = "Add your name.";
  if (emailNeeded && !email.trim()) problems.email = "Add your email.";
  else if (email.trim() && !EMAIL.test(email.trim())) problems.email = "Check your email address.";
  if (action.kind === "collab" && !value("collabType")) problems.collabType = "Pick what it's for.";
  if (action.kind === "collab" && value("website") && !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(value("website"))) problems.website = "Start with https://";
  if (action.kind !== "giveaway" && !value("message").trim()) problems.message = "Add a few words.";
  for (const question of questions) if (question.required && !value(question.id).trim()) problems[question.id] = "Answer this one.";
  if (action.kind === "giveaway" && !accept) problems.accept = "Confirm to enter.";
  const show = (key: string) => (tried ? problems[key] : undefined);
  const invalid = (key: string) => (tried && problems[key] ? true : undefined);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setTried(true);
    if (preview || Object.keys(problems).length) return;
    setState("sending");
    setError(null);
    const response = await fetch(`/api/actions/${action.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), answers: Object.fromEntries(Object.entries(answers).filter(([, item]) => item.trim())), featureConsent: consent, acceptRules: accept, idempotencyKey: meta.key, openedAt: meta.openedAt, hp }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (!response?.ok || !result?.ok) {
      setState("idle");
      setError(result?.error ?? "That didn't send. Check your connection and try again.");
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    const giveaway = action.kind === "giveaway";
    return (
      <div className="mt-8 flex flex-col items-start gap-4" role="status">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-[#0D0D0D] text-[22px] text-[#F5F4EF]">{giveaway ? "@" : "✓"}</span>
        <p className="font-display text-[34px] font-bold leading-none tracking-[-0.05em]">{giveaway ? "Check your email." : `Sent to ${firstName}.`}</p>
        <p className="max-w-[44ch] text-[16px] leading-[1.5] text-black/70">
          {giveaway ? "We sent a link to confirm your entry. It works for 48 hours. Unconfirmed entries don't count." : email.trim() ? `${firstName} replies by email when it's a fit.` : `${firstName} reads every one.`}
        </p>
        {backHref && <Link className="inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-[18px] text-[15px] font-semibold text-[#F5F4EF]" href={backHref}>Back to the page</Link>}
      </div>
    );
  }

  const field = (key: string, label: React.ReactNode, control: React.ReactNode) => (
    <div className="flex flex-col gap-2.5">
      <label className="text-[16px] font-semibold" htmlFor={`${uid}-${key}`}>{label}</label>
      {control}
      {show(key) && <p className="text-[13px] font-medium text-[#B42318]" id={`${uid}-${key}-error`}>{show(key)}</p>}
    </div>
  );
  const described = (key: string) => (show(key) ? `${uid}-${key}-error` : undefined);
  const text = (key: string, label: React.ReactNode, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => field(key, label,
    <input aria-describedby={described(key)} aria-invalid={invalid(key)} className={input} id={`${uid}-${key}`} maxLength={120} onChange={(event) => set(key, event.target.value)} value={value(key)} {...props} />);

  return (
    <form className="mt-7 flex flex-1 flex-col gap-6" noValidate onSubmit={(event) => void send(event)}>
      {action.kind === "collab" && (
        <fieldset aria-describedby={described("collabType")}>
          <legend className="mb-2.5 text-[16px] font-semibold">What&apos;s it for?</legend>
          <div className="flex flex-wrap gap-2">{types.map((item) => <button aria-pressed={value("collabType") === item} className={chip(value("collabType") === item)} key={item} onClick={() => set("collabType", item)} type="button">{COLLAB_TYPE_LABEL[item]}</button>)}</div>
          {show("collabType") && <p className="mt-2 text-[13px] font-medium text-[#B42318]" id={`${uid}-collabType-error`}>{show("collabType")}</p>}
        </fieldset>
      )}
      {action.kind === "collab" && config.askBudget && (
        <fieldset>
          <legend className="mb-2.5 text-[16px] font-semibold">Budget{optional}</legend>
          <div className="flex flex-wrap gap-2">{BUDGETS.map((item: Budget) => <button aria-pressed={value("budget") === item} className={chip(value("budget") === item)} key={item} onClick={() => set("budget", value("budget") === item ? "" : item)} type="button">{BUDGET_LABEL[item]}</button>)}</div>
        </fieldset>
      )}

      {action.kind === "submission"
        ? field("message", config.prompt || "Your message", <textarea aria-describedby={described("message")} aria-invalid={invalid("message")} className={area} id={`${uid}-message`} maxLength={2000} onChange={(event) => set("message", event.target.value)} value={value("message")} />)
        : action.kind !== "giveaway" && field("message", action.kind === "collab" ? `Tell ${firstName} about it` : action.kind === "booking" && config.offering === "application" ? "Why you're applying" : "What you have in mind",
          <textarea aria-describedby={described("message")} aria-invalid={invalid("message")} className={area} id={`${uid}-message`} maxLength={2000} onChange={(event) => set("message", event.target.value)} placeholder={action.kind === "collab" ? "What you're making, when, and where it runs." : undefined} value={value("message")} />)}

      {action.kind === "collab" && config.askTimeline && text("timeline", <>Timeline{optional}</>, { placeholder: "Shoot in March, live in April" })}
      {action.kind === "booking" && config.askDates && text("preferredDates", <>Preferred dates{optional}</>, { placeholder: "Weekdays in November" })}
      {(action.kind === "collab" || action.kind === "booking") && text("company", <>{action.kind === "collab" ? "Brand or company" : "Company or organisation"}{optional}</>, { autoComplete: "organization" })}
      {action.kind === "collab" && config.askWebsite && text("website", <>Website{optional}</>, { type: "url", inputMode: "url", placeholder: "https://", maxLength: 300 })}

      {questions.map((question) => question.type === "choice" ? (
        <fieldset aria-describedby={described(question.id)} key={question.id}>
          <legend className="mb-2.5 text-[16px] font-semibold">{question.label}{!question.required && optional}</legend>
          <div className="flex flex-wrap gap-2">{(question.options ?? []).map((option) => <button aria-pressed={value(question.id) === option} className={chip(value(question.id) === option)} key={option} onClick={() => set(question.id, value(question.id) === option ? "" : option)} type="button">{option}</button>)}</div>
          {show(question.id) && <p className="mt-2 text-[13px] font-medium text-[#B42318]" id={`${uid}-${question.id}-error`}>{show(question.id)}</p>}
        </fieldset>
      ) : question.type === "long"
        ? <div key={question.id}>{field(question.id, <>{question.label}{!question.required && optional}</>, <textarea aria-describedby={described(question.id)} aria-invalid={invalid(question.id)} className={area} id={`${uid}-${question.id}`} maxLength={2000} onChange={(event) => set(question.id, event.target.value)} value={value(question.id)} />)}</div>
        : <div key={question.id}>{text(question.id, <>{question.label}{!question.required && optional}</>, { maxLength: 200 })}</div>)}

      <div className="grid gap-6 sm:grid-cols-2">
        {field("name", <>Your name{anonymous && optional}</>, <input aria-describedby={described("name")} aria-invalid={invalid("name")} autoComplete="name" className={input} id={`${uid}-name`} maxLength={80} onChange={(event) => setName(event.target.value)} value={name} />)}
        {field("email", <>Email{!emailNeeded && optional}</>, <input aria-describedby={described("email")} aria-invalid={invalid("email")} autoComplete="email" className={input} id={`${uid}-email`} inputMode="email" maxLength={254} onChange={(event) => setEmail(event.target.value)} type="email" value={email} />)}
      </div>

      {/* The spam trap: people never see it, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${uid}-hp`}>Leave this empty</label>
        <input autoComplete="off" id={`${uid}-hp`} onChange={(event) => setHp(event.target.value)} tabIndex={-1} value={hp} />
      </div>

      {action.kind === "submission" && config.askFeatureConsent && (
        <label className="flex items-start gap-3 text-[15px] leading-[1.45]">
          <input checked={consent} className="mt-0.5 size-5 shrink-0 accent-[#0D0D0D]" onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
          <span>{firstName} may share or feature this, with my first name.</span>
        </label>
      )}
      {action.kind === "giveaway" && (
        <div>
          <label className="flex items-start gap-3 text-[15px] leading-[1.45]">
            <input aria-describedby={described("accept")} aria-invalid={invalid("accept")} checked={accept} className="mt-0.5 size-5 shrink-0 accent-[#0D0D0D]" onChange={(event) => setAccept(event.target.checked)} type="checkbox" />
            <span>I&apos;m {config.minAge ?? 18} or older and I accept the rules above.</span>
          </label>
          {show("accept") && <p className="mt-2 text-[13px] font-medium text-[#B42318]" id={`${uid}-accept-error`}>{show("accept")}</p>}
        </div>
      )}

      <p className="text-[13px] leading-[1.5] text-black/55">
        {firstName} sees what you send{action.kind === "giveaway" ? ", and uses your email to confirm your entry and contact a winner" : ""}. It doesn&apos;t start a chat or a connection. <Link className="underline underline-offset-4" href="/privacy">Privacy</Link>
      </p>

      {error && <p className="text-[14px] font-semibold text-[#B42318]" role="alert">{error}</p>}
      {tried && Object.keys(problems).length > 0 && !error && <p className="sr-only" role="alert">Some fields need attention.</p>}

      <div className="sticky bottom-0 -mx-5 mt-auto bg-[linear-gradient(to_bottom,rgba(245,244,239,0),#F5F4EF_24px)] px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-6">
        <button className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#0D0D0D] text-[16px] font-semibold text-[#F5F4EF] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40" disabled={state === "sending"} type="submit">
          {state === "sending" ? "Sending…" : preview ? `${ctaFor(action)} (preview)` : ctaFor(action)}
        </button>
      </div>
    </form>
  );
}
