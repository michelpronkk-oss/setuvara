"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";

import { COMPANY_TYPES, CONTACT_EMAIL, contactFieldErrors, INQUIRY_TYPES, inquiryLabel, MESSAGE_MAX, type ContactField, type InquiryType } from "@/lib/marketing/contact";

import { MeetMark } from "../brand";

type Values = { name: string; email: string; type: InquiryType | null; company: string; message: string; website: string };
type Errors = Partial<Record<ContactField, string>>;
type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; name: string } | { kind: "error"; message: string };

const EMPTY: Values = { name: "", email: "", type: null, company: "", message: "", website: "" };
const FIELD_ORDER: ContactField[] = ["type", "name", "email", "company", "message"];

const field = "w-full rounded-2xl bg-paper/60 px-4 text-[16px] text-ink shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] outline-none transition-shadow placeholder:text-ink/35 focus:bg-white focus:shadow-[inset_0_0_0_2px_#0d0d0d] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_#c2362c] aria-[invalid=true]:focus:shadow-[inset_0_0_0_2px_#c2362c]";
const labelText = "font-label text-[10px] uppercase tracking-[0.14em] text-ink/55";

/** Reads ?topic=support (or partnerships, teams) so other pages can link straight to the right kind of note. */
function topicFromUrl(): InquiryType | null {
  const topic = new URLSearchParams(window.location.search).get("topic");
  return INQUIRY_TYPES.some((type) => type.value === topic) ? (topic as InquiryType) : null;
}

const subscribeNever = () => () => {};

/** The /contact form: one note, any topic, emailed to the Setuvara inbox through /api/contact. */
export function ContactForm() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const openedAt = useRef(0);
  const form = useRef<HTMLFormElement>(null);
  const done = useRef<HTMLHeadingElement>(null);
  const id = useId();

  // Until someone picks a topic, the link they came from decides it, else General.
  const urlTopic = useSyncExternalStore(subscribeNever, topicFromUrl, () => null);
  const type: InquiryType = values.type ?? urlTopic ?? "general";

  useEffect(() => { openedAt.current = Date.now(); }, []);

  useEffect(() => { if (state.kind === "sent") done.current?.focus(); }, [state.kind]);

  const showCompany = COMPANY_TYPES.includes(type);
  const payload = (next: Values) => {
    const nextType = next.type ?? type;
    return { ...next, type: nextType, company: COMPANY_TYPES.includes(nextType) ? next.company : "", openedAt: openedAt.current || 1 };
  };

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    // Once someone has tried to send, errors follow what they type instead of waiting for the next submit.
    if (attempted) setErrors(contactFieldErrors(payload(next)));
    if (state.kind === "error") setState({ kind: "idle" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === "sending") return;
    setAttempted(true);
    const found = contactFieldErrors(payload(values));
    setErrors(found);
    const first = FIELD_ORDER.find((key) => found[key]);
    if (first) {
      form.current?.querySelector<HTMLElement>(first === "type" ? `[name="type"]:checked` : `[name="${first}"]`)?.focus();
      return;
    }

    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" },
        body: JSON.stringify(payload(values)),
      });
      if (response.ok) {
        setState({ kind: "sent", name: values.name.trim().split(/\s+/)[0] });
        setValues({ ...EMPTY, type });
        setErrors({});
        setAttempted(false);
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (body.fields && Object.keys(body.fields).length) setErrors(body.fields);
      setState({ kind: "error", message: body.error ?? `That didn’t send. Try again, or email ${CONTACT_EMAIL}.` });
    } catch {
      setState({ kind: "error", message: `You seem to be offline. Try again, or email ${CONTACT_EMAIL}.` });
    }
  }

  function again() {
    openedAt.current = Date.now();
    setState({ kind: "idle" });
  }

  if (state.kind === "sent") {
    return (
      <Card>
        <div className="flex min-h-[420px] flex-col items-start justify-center gap-5" role="status">
          <span className="grid size-14 place-items-center rounded-2xl bg-coral"><MeetMark className="size-8 text-ink" /></span>
          <h2 className="font-display text-[clamp(34px,5vw,52px)] font-extrabold leading-[0.95] tracking-[-0.05em] outline-none" ref={done} tabIndex={-1}>Thanks, {state.name}.</h2>
          <p className="max-w-[26rem] text-[16px] leading-[1.5] text-ink/70">Your note is with us. We’ll reply to your email from {CONTACT_EMAIL}.</p>
          <button className="mt-2 inline-flex min-h-12 items-center rounded-full border border-ink/20 px-6 text-[15px] font-semibold transition-colors hover:border-ink/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral" onClick={again} type="button">Send another note</button>
        </div>
      </Card>
    );
  }

  const describe = (key: ContactField) => (errors[key] ? `${id}-${key}-error` : undefined);
  const selected = INQUIRY_TYPES.find((item) => item.value === type)!;
  const remaining = MESSAGE_MAX - values.message.length;

  return (
    <Card>
      <form aria-labelledby={`${id}-title`} className="flex flex-col gap-6" noValidate onSubmit={submit} ref={form}>
        <h2 className="sr-only" id={`${id}-title`}>Send us a note</h2>

        <fieldset aria-describedby={describe("type") ?? `${id}-type-hint`} className="flex flex-col gap-2.5">
          <legend className={`${labelText} mb-2.5`}>What’s it about?</legend>
          <div className="grid grid-cols-2 gap-1.5 rounded-[1.25rem] bg-ink/[0.05] p-1.5 sm:grid-cols-4">
            {INQUIRY_TYPES.map((option) => (
              <label className="relative" key={option.value}>
                <input checked={type === option.value} className="peer sr-only" name="type" onChange={() => update("type", option.value)} type="radio" value={option.value} />
                <span className="flex min-h-12 cursor-pointer items-center justify-center rounded-[0.9rem] px-2 text-center text-[14px] font-semibold leading-[1.15] text-ink/65 transition-colors hover:text-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-coral">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
          <p className="text-[13px] leading-5 text-ink/55" id={`${id}-type-hint`}>{selected.hint}</p>
          <FieldError id={describe("type")}>{errors.type}</FieldError>
        </fieldset>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5">
              <span className={labelText}>Name</span>
              <input aria-describedby={describe("name")} aria-invalid={Boolean(errors.name)} autoComplete="name" className={`${field} h-12`} maxLength={120} name="name" onChange={(event) => update("name", event.target.value)} value={values.name} />
            </label>
            <FieldError id={describe("name")}>{errors.name}</FieldError>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5">
              <span className={labelText}>Email</span>
              <input aria-describedby={describe("email")} aria-invalid={Boolean(errors.email)} autoCapitalize="none" autoComplete="email" className={`${field} h-12`} inputMode="email" maxLength={254} name="email" onChange={(event) => update("email", event.target.value)} spellCheck={false} type="email" value={values.email} />
            </label>
            <FieldError id={describe("email")}>{errors.email}</FieldError>
          </div>
        </div>

        {/* Company only matters for partnerships and teams; it folds away for everything else. */}
        <div className={`grid transition-[grid-template-rows,opacity,visibility,margin] duration-300 ease-out ${showCompany ? "visible grid-rows-[1fr] opacity-100" : "invisible -mt-6 grid-rows-[0fr] opacity-0"}`} inert={!showCompany}>
          <div className="overflow-hidden">
            <div className="flex flex-col gap-1.5 p-0.5">
              <label className="flex flex-col gap-1.5">
                <span className={labelText}>{type === "teams" ? "Company" : "Company, event or organisation"} <span className="normal-case tracking-normal text-ink/40">Optional</span></span>
                <input aria-describedby={describe("company")} aria-invalid={Boolean(errors.company)} autoComplete="organization" className={`${field} h-12`} maxLength={120} name="company" onChange={(event) => update("company", event.target.value)} value={values.company} />
              </label>
              <FieldError id={describe("company")}>{errors.company}</FieldError>
            </div>
          </div>
        </div>

        <div className="relative flex flex-col gap-1.5">
          <label className="flex flex-col gap-1.5">
            <span className={labelText}>Message</span>
            <textarea aria-describedby={describe("message")} aria-invalid={Boolean(errors.message)} className={`${field} min-h-40 resize-y py-3 leading-[1.5]`} maxLength={MESSAGE_MAX} name="message" onChange={(event) => update("message", event.target.value)} placeholder={placeholder(type)} value={values.message} />
          </label>
          {remaining < 400 ? <span aria-live="polite" className="absolute right-0 top-0 font-label text-[10px] tracking-[0.08em] text-ink/45">{remaining.toLocaleString("en")} left</span> : null}
          <FieldError id={describe("message")}>{errors.message}</FieldError>
        </div>

        {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
        <label aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">Website<input autoComplete="off" name="website" onChange={(event) => setValues((current) => ({ ...current, website: event.target.value }))} tabIndex={-1} value={values.website} /></label>

        {state.kind === "error" ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-[#c2362c]/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p className="text-[14px] font-medium leading-5 text-[#a43d36]">{state.message}</p>
            <a className="shrink-0 text-[14px] font-semibold text-ink underline underline-offset-4 hover:text-coral" href={mailto(values, type)}>Email us instead →</a>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-4 border-t border-ink/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-5 text-ink/50">A person reads every note. We only use your details to reply.</p>
          <button className="inline-flex min-h-13 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[15px] font-semibold text-paper transition-colors hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral disabled:opacity-60" disabled={state.kind === "sending"} type="submit">
            {state.kind === "sending" ? "Sending…" : <>Send note <span aria-hidden="true">→</span></>}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="relative rounded-[2rem] bg-white p-5 shadow-[0_0_0_1px_rgba(13,13,13,.06),0_50px_100px_-60px_rgba(13,13,13,.45)] sm:p-9">{children}</div>;
}

function FieldError({ id, children }: { id?: string; children?: string }) {
  if (!children) return null;
  return <span className="text-[13px] font-medium leading-5 text-[#a43d36]" id={id}>{children}</span>;
}

function placeholder(type: InquiryType) {
  switch (type) {
    case "support": return "What happened, and the username on your account if you have one.";
    case "partnerships": return "The event or community, when it happens, and what you have in mind.";
    case "teams": return "How many people, and how they meet others today.";
    default: return "What’s on your mind?";
  }
}

/** Fallback when the form can't send: the same note, prefilled in the visitor's own mail app. */
function mailto(values: Values, type: InquiryType) {
  const subject = `${inquiryLabel(type)}${values.name.trim() ? `: ${values.name.trim()}` : ""}`;
  const body = [values.message.trim().slice(0, 1500), COMPANY_TYPES.includes(type) && values.company.trim() ? `\nCompany: ${values.company.trim()}` : ""].join("");
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
