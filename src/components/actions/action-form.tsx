"use client";

import Link from "next/link";
import { useId, useState, type CSSProperties } from "react";

import type { MotionLevel } from "@/components/profile/appearance";
import { BUDGET_LABEL, BUDGETS, COLLAB_TYPE_LABEL, COLLAB_TYPES, ctaFor, type ActionThanks, type Budget, type CollabType, type PublicAction, type Question } from "@/lib/actions/model";
import { ActionBeacon } from "./action-beacon";
import { ActionSuccess } from "./action-success";

// Colours come from the page's Appearance (--av-*, see lib/actions/theme.ts).
const chip = (on: boolean) => `inline-flex min-h-11 items-center rounded-full px-[18px] text-[15px] font-semibold transition-colors focus-visible:outline-2 ${on ? "bg-[var(--av-fg)] text-[var(--av-bg)]" : "bg-[var(--av-field)] text-[var(--av-fg)] shadow-[inset_0_0_0_1px_var(--av-field-edge)] hover:shadow-[inset_0_0_0_1.5px_var(--av-fg)]"}`;
const input = "min-h-12 w-full rounded-[16px] bg-[var(--av-field)] px-4 text-[16px] text-[var(--av-fg)] shadow-[inset_0_0_0_1px_var(--av-field-edge)] outline-none transition-shadow placeholder:text-[var(--av-muted)] focus:shadow-[inset_0_0_0_2px_var(--av-fg)] aria-[invalid=true]:shadow-[inset_0_0_0_2px_var(--av-error)]";
const area = "min-h-[132px] w-full resize-y rounded-[20px] bg-[var(--av-field)] p-4 text-[16px] leading-[1.5] text-[var(--av-fg)] shadow-[inset_0_0_0_1px_var(--av-field-edge)] outline-none transition-shadow placeholder:text-[var(--av-muted)] focus:shadow-[inset_0_0_0_2px_var(--av-fg)] aria-[invalid=true]:shadow-[inset_0_0_0_2px_var(--av-error)]";
const optional = <span className="font-normal text-[var(--av-muted)]"> optional</span>;
const errorText = "text-[13px] font-medium text-[var(--av-error)]";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.padEnd(16, "0");
}

/**
 * A visitor's form for one Action, in the page's Appearance. It sends to Setuvara's own route, which
 * re-checks everything; nothing here opens a chat or a Connection. In previews it renders the same,
 * but never sends; `previewSent` shows the success moment instead.
 */
export function ActionForm({ action, firstName, backHref, preview = false, previewSent = false, previewThanks = null, signedInName = "", heading = {}, motion = "full", contained = false }: {
  action: PublicAction;
  firstName: string;
  backHref?: string;
  preview?: boolean;
  previewSent?: boolean;
  /** The editor's draft thank-you heading and reward, for the "After sending" preview. */
  previewThanks?: ActionThanks | null;
  signedInName?: string;
  heading?: CSSProperties;
  motion?: MotionLevel;
  /** The success moment fills its preview phone instead of the window. */
  contained?: boolean;
}) {
  const uid = useId();
  const { config, kind } = action;
  const types = (config.types?.length ? config.types : COLLAB_TYPES) as CollabType[];
  const questions: Question[] = config.questions ?? [];
  const nameOptional = (kind === "submission" && config.allowAnonymous === true) || kind === "newsletter" || (kind === "form" && config.askName === false);
  const showName = kind !== "newsletter" || config.askName !== false;
  const emailNeeded = !(kind === "submission" || kind === "form") || config.emailRequired === true;
  const hasMessage = kind === "collab" || kind === "booking" || kind === "submission";

  const [name, setName] = useState(signedInName);
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [accept, setAccept] = useState(false);
  const [hp, setHp] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [thanks, setThanks] = useState<ActionThanks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [meta] = useState(() => ({ key: newKey(), openedAt: Date.now() }));

  const set = (key: string, value: string) => setAnswers((current) => ({ ...current, [key]: value }));
  const value = (key: string) => answers[key] ?? "";

  const problems: Record<string, string> = {};
  if (!name.trim() && !nameOptional) problems.name = "Add your name.";
  if (emailNeeded && !email.trim()) problems.email = "Add your email.";
  else if (email.trim() && !EMAIL.test(email.trim())) problems.email = "Check your email address.";
  if (kind === "collab" && !value("collabType")) problems.collabType = "Pick what it's for.";
  if (kind === "collab" && value("website") && !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(value("website"))) problems.website = "Start with https://";
  if (hasMessage && !value("message").trim()) problems.message = "Add a few words.";
  for (const question of questions) if (question.required && !value(question.id).trim()) problems[question.id] = "Answer this one.";
  if (kind === "giveaway" && !accept) problems.accept = "Confirm to enter.";
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
    const result = await response?.json().catch(() => null) as { ok?: boolean; error?: string; thanks?: ActionThanks | null } | null;
    if (!response?.ok || !result?.ok) {
      setState("idle");
      setError(result?.error ?? "That didn't send. Check your connection and try again.");
      return;
    }
    setThanks(result.thanks ?? null);
    setState("sent");
  }

  if (state === "sent" || previewSent) {
    const confirms = kind === "giveaway" || kind === "newsletter";
    return (
      <ActionSuccess
        backHref={backHref}
        contained={contained}
        email={confirms ? (email.trim() || (previewSent ? "you@example.com" : null)) : email.trim() || null}
        firstName={firstName}
        heading={heading}
        kind={kind}
        motion={motion}
        preview={previewSent}
        reward={(previewSent ? previewThanks : thanks)?.reward ?? null}
        stage="sent"
        thanks={config.thanks}
        title={(previewSent ? previewThanks : thanks)?.heading}
      />
    );
  }

  const field = (key: string, label: React.ReactNode, control: React.ReactNode) => (
    <div className="flex flex-col gap-2.5">
      <label className="text-[16px] font-semibold" htmlFor={`${uid}-${key}`}>{label}</label>
      {control}
      {show(key) && <p className={errorText} id={`${uid}-${key}-error`}>{show(key)}</p>}
    </div>
  );
  const described = (key: string) => (show(key) ? `${uid}-${key}-error` : undefined);
  const text = (key: string, label: React.ReactNode, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => field(key, label,
    <input aria-describedby={described(key)} aria-invalid={invalid(key)} className={input} id={`${uid}-${key}`} maxLength={120} onChange={(event) => set(key, event.target.value)} value={value(key)} {...props} />);
  const nameInput = <input aria-describedby={described("name")} aria-invalid={invalid("name")} autoComplete="name" className={input} id={`${uid}-name`} maxLength={80} onChange={(event) => setName(event.target.value)} value={name} />;
  const emailInput = <input aria-describedby={described("email")} aria-invalid={invalid("email")} autoComplete="email" className={input} id={`${uid}-email`} inputMode="email" maxLength={254} onChange={(event) => setEmail(event.target.value)} placeholder={kind === "newsletter" ? "you@example.com" : undefined} type="email" value={email} />;

  return (
    <form className="mt-7 flex flex-1 flex-col gap-6" noValidate onSubmit={(event) => void send(event)}>
      {!preview && <ActionBeacon ids={[action.id]} kind="open" />}
      {kind === "collab" && (
        <fieldset aria-describedby={described("collabType")}>
          <legend className="mb-2.5 text-[16px] font-semibold">What&apos;s it for?</legend>
          <div className="flex flex-wrap gap-2">{types.map((item) => <button aria-pressed={value("collabType") === item} className={chip(value("collabType") === item)} key={item} onClick={() => set("collabType", item)} type="button">{COLLAB_TYPE_LABEL[item]}</button>)}</div>
          {show("collabType") && <p className={`mt-2 ${errorText}`} id={`${uid}-collabType-error`}>{show("collabType")}</p>}
        </fieldset>
      )}
      {kind === "collab" && config.askBudget && (
        <fieldset>
          <legend className="mb-2.5 text-[16px] font-semibold">Budget{optional}</legend>
          <div className="flex flex-wrap gap-2">{BUDGETS.map((item: Budget) => <button aria-pressed={value("budget") === item} className={chip(value("budget") === item)} key={item} onClick={() => set("budget", value("budget") === item ? "" : item)} type="button">{BUDGET_LABEL[item]}</button>)}</div>
        </fieldset>
      )}

      {kind === "newsletter" && (
        <>
          {field("email", "Your email", emailInput)}
          {showName && field("name", <>First name{optional}</>, nameInput)}
        </>
      )}

      {kind === "submission"
        ? field("message", config.prompt || "Your message", <textarea aria-describedby={described("message")} aria-invalid={invalid("message")} className={area} id={`${uid}-message`} maxLength={2000} onChange={(event) => set("message", event.target.value)} value={value("message")} />)
        : hasMessage && field("message", kind === "collab" ? `Tell ${firstName} about it` : kind === "booking" && config.offering === "application" ? "Why you're applying" : "What you have in mind",
          <textarea aria-describedby={described("message")} aria-invalid={invalid("message")} className={area} id={`${uid}-message`} maxLength={2000} onChange={(event) => set("message", event.target.value)} placeholder={kind === "collab" ? "What you're making, when, and where it runs." : undefined} value={value("message")} />)}

      {kind === "collab" && config.askTimeline && text("timeline", <>Timeline{optional}</>, { placeholder: "Shoot in March, live in April" })}
      {kind === "booking" && config.askDates && text("preferredDates", <>Preferred dates{optional}</>, { placeholder: "Weekdays in November" })}
      {(kind === "collab" || kind === "booking") && text("company", <>{kind === "collab" ? "Brand or company" : "Company or organisation"}{optional}</>, { autoComplete: "organization" })}
      {kind === "collab" && config.askWebsite && text("website", <>Website{optional}</>, { type: "url", inputMode: "url", placeholder: "https://", maxLength: 300 })}

      {questions.map((question) => question.type === "choice" ? (
        <fieldset aria-describedby={described(question.id)} key={question.id}>
          <legend className="mb-2.5 text-[16px] font-semibold">{question.label}{!question.required && optional}</legend>
          <div className="flex flex-wrap gap-2">{(question.options ?? []).map((option) => <button aria-pressed={value(question.id) === option} className={chip(value(question.id) === option)} key={option} onClick={() => set(question.id, value(question.id) === option ? "" : option)} type="button">{option}</button>)}</div>
          {show(question.id) && <p className={`mt-2 ${errorText}`} id={`${uid}-${question.id}-error`}>{show(question.id)}</p>}
        </fieldset>
      ) : question.type === "long"
        ? <div key={question.id}>{field(question.id, <>{question.label}{!question.required && optional}</>, <textarea aria-describedby={described(question.id)} aria-invalid={invalid(question.id)} className={area} id={`${uid}-${question.id}`} maxLength={2000} onChange={(event) => set(question.id, event.target.value)} value={value(question.id)} />)}</div>
        : <div key={question.id}>{text(question.id, <>{question.label}{!question.required && optional}</>, { maxLength: 200 })}</div>)}

      {kind !== "newsletter" && (
        <div className={`grid gap-6 ${showName ? "sm:grid-cols-2" : ""}`}>
          {showName && field("name", <>Your name{nameOptional && optional}</>, nameInput)}
          {field("email", <>Email{!emailNeeded && optional}</>, emailInput)}
        </div>
      )}

      {/* The spam trap: people never see it, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${uid}-hp`}>Leave this empty</label>
        <input autoComplete="off" id={`${uid}-hp`} onChange={(event) => setHp(event.target.value)} tabIndex={-1} value={hp} />
      </div>

      {kind === "submission" && config.askFeatureConsent && (
        <label className="flex items-start gap-3 text-[15px] leading-[1.45]">
          <input checked={consent} className="mt-0.5 size-5 shrink-0 accent-[var(--av-accent)]" onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
          <span>{firstName} may share or feature this, with my first name.</span>
        </label>
      )}
      {kind === "giveaway" && (
        <div>
          <label className="flex items-start gap-3 text-[15px] leading-[1.45]">
            <input aria-describedby={described("accept")} aria-invalid={invalid("accept")} checked={accept} className="mt-0.5 size-5 shrink-0 accent-[var(--av-accent)]" onChange={(event) => setAccept(event.target.checked)} type="checkbox" />
            <span>I&apos;m {config.minAge ?? 18} or older and I accept the rules above.</span>
          </label>
          {show("accept") && <p className={`mt-2 ${errorText}`} id={`${uid}-accept-error`}>{show("accept")}</p>}
        </div>
      )}

      <p className="text-[13px] leading-[1.5] text-[var(--av-muted)]">
        {kind === "newsletter"
          ? <>We&apos;ll email you once to confirm. {firstName} sees your email and can export the list; unsubscribe from any of their emails. </>
          : <>{firstName} sees what you send{kind === "giveaway" ? ", and uses your email to confirm your entry and contact a winner" : ""}. It doesn&apos;t start a chat or a connection. </>}
        <Link className="underline underline-offset-4" href="/privacy">Privacy</Link>
      </p>

      {error && <p className="text-[14px] font-semibold text-[var(--av-error)]" role="alert">{error}</p>}
      {tried && Object.keys(problems).length > 0 && !error && <p className="sr-only" role="alert">Some fields need attention.</p>}

      <div className="sticky bottom-0 -mx-5 mt-auto px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-6" style={{ background: "linear-gradient(to bottom, transparent, var(--av-bg) 24px)" }}>
        <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold transition active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" disabled={state === "sending"} style={{ background: "var(--av-btn-bg)", color: "var(--av-btn-fg)", boxShadow: "var(--av-btn-ring)" }} type="submit">
          {state === "sending" ? <><span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />Sending…</> : preview ? `${ctaFor(action)} (preview)` : ctaFor(action)}
        </button>
      </div>
    </form>
  );
}
