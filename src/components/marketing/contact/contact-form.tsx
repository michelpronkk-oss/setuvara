"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";

import { COMPANY_TYPES, CONTACT_EMAIL, contactFieldErrors, INQUIRY_TYPES, inquiryLabel, MESSAGE_MAX, type ContactField, type InquiryType } from "@/lib/marketing/contact";

import { MeetMark } from "../brand";

type Values = { name: string; email: string; type: InquiryType | null; company: string; message: string; website: string };
type Errors = Partial<Record<ContactField, string>>;
type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; name: string } | { kind: "error"; message: string };

const EMPTY: Values = { name: "", email: "", type: null, company: "", message: "", website: "" };
const FIELD_ORDER: ContactField[] = ["type", "name", "email", "company", "message"];

// Hairline fields on ink: the line brightens on focus and turns coral when something needs fixing.
const field = "h-12 w-full scroll-mt-32 rounded-none border-b border-paper/20 bg-transparent px-0 text-[18px] text-paper caret-coral outline-none transition-colors placeholder:text-paper/25 hover:border-paper/40 focus:border-paper aria-[invalid=true]:border-coral [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#0d0d0d] [&:-webkit-autofill]:[-webkit-text-fill-color:#f5f4ef]";
const labelText = "font-label text-[10px] uppercase tracking-[0.16em] text-paper/50";

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

  // The thanks panel is shorter than the form, so bring it into view before moving focus to it.
  useEffect(() => {
    if (state.kind !== "sent" || !done.current) return;
    done.current.scrollIntoView({ block: "center" });
    done.current.focus({ preventScroll: true });
  }, [state.kind]);

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
      <Panel>
        <div className="flex min-h-[340px] flex-col items-start justify-end gap-5 sm:min-h-[460px]" role="status">
          <span className="grid size-14 place-items-center rounded-2xl bg-coral"><MeetMark className="size-8 text-ink" /></span>
          <h2 className="font-display text-[clamp(40px,5.4vw,64px)] font-extrabold leading-[0.92] tracking-[-0.055em] scroll-mt-40 outline-none" ref={done} tabIndex={-1}>Thanks, {state.name}.</h2>
          <p className="max-w-[26rem] text-[16px] leading-[1.55] text-paper/65">Your note is with us. We’ll reply to your email from {CONTACT_EMAIL}.</p>
          <button className="mt-3 inline-flex min-h-12 items-center rounded-full px-6 text-[15px] font-semibold text-paper/85 shadow-[inset_0_0_0_1px_rgba(245,244,239,.22)] transition-colors hover:text-paper hover:shadow-[inset_0_0_0_1px_rgba(245,244,239,.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral" onClick={again} type="button">Send another note</button>
        </div>
      </Panel>
    );
  }

  const describe = (key: ContactField) => (errors[key] ? `${id}-${key}-error` : undefined);
  const remaining = MESSAGE_MAX - values.message.length;

  return (
    <Panel>
      <form aria-labelledby={`${id}-title`} className="flex flex-col gap-9" noValidate onSubmit={submit} ref={form}>
        <h2 className="sr-only" id={`${id}-title`}>Send us a note</h2>

        <fieldset aria-describedby={describe("type")} className="flex flex-col">
          <legend className={`${labelText} mb-3`}>What’s it about?</legend>
          <div className="border-t border-paper/12">
            {INQUIRY_TYPES.map((option, index) => {
              const checked = type === option.value;
              return (
                <label className="group relative block cursor-pointer border-b border-paper/12" key={option.value}>
                  <input aria-describedby={`${id}-${option.value}-hint`} checked={checked} className="peer sr-only" name="type" onChange={() => update("type", option.value)} type="radio" value={option.value} />
                  <span className="flex min-h-[64px] items-center gap-4 py-3 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-coral sm:min-h-[72px] sm:gap-5">
                    <span aria-hidden="true" className={`w-5 shrink-0 font-label text-[11px] tracking-[0.14em] transition-colors ${checked ? "text-coral" : "text-paper/30"}`}>0{index + 1}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={`font-display text-[22px] font-bold leading-[1.05] tracking-[-0.045em] transition-colors sm:text-[28px] ${checked ? "text-paper" : "text-paper/40 group-hover:text-paper/75"}`}>{option.label}</span>
                      <span className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${checked ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <span className="overflow-hidden"><span aria-hidden="true" className="block pt-1.5 text-[14px] leading-5 text-paper/55" id={`${id}-${option.value}-hint`}>{option.hint}</span></span>
                      </span>
                    </span>
                    <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full transition-all duration-300 ${checked ? "bg-coral" : "shadow-[inset_0_0_0_1.5px_rgba(245,244,239,.25)] group-hover:shadow-[inset_0_0_0_1.5px_rgba(245,244,239,.55)]"}`}>
                      <span className={`size-2 rounded-full bg-ink transition-transform duration-300 ${checked ? "scale-100" : "scale-0"}`} />
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <FieldError id={describe("type")}>{errors.type}</FieldError>
        </fieldset>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-7 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className={labelText}>Name</span>
              <input aria-describedby={describe("name")} aria-invalid={Boolean(errors.name)} autoComplete="name" className={field} maxLength={120} name="name" onChange={(event) => update("name", event.target.value)} placeholder="Your name" value={values.name} />
            </label>
            <FieldError id={describe("name")}>{errors.name}</FieldError>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className={labelText}>Email</span>
              <input aria-describedby={describe("email")} aria-invalid={Boolean(errors.email)} autoCapitalize="none" autoComplete="email" className={field} inputMode="email" maxLength={254} name="email" onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" spellCheck={false} type="email" value={values.email} />
            </label>
            <FieldError id={describe("email")}>{errors.email}</FieldError>
          </div>
        </div>

        {/* Company only matters for partnerships and teams; it folds away for everything else. */}
        <div className={`grid transition-[grid-template-rows,opacity,visibility,margin] duration-300 ease-out ${showCompany ? "visible grid-rows-[1fr] opacity-100" : "invisible -mt-9 grid-rows-[0fr] opacity-0"}`} inert={!showCompany}>
          <div className="overflow-hidden">
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className={labelText}>{type === "teams" ? "Company" : "Company, event or organisation"} <span className="normal-case tracking-normal text-paper/35">Optional</span></span>
                <input aria-describedby={describe("company")} aria-invalid={Boolean(errors.company)} autoComplete="organization" className={field} maxLength={120} name="company" onChange={(event) => update("company", event.target.value)} placeholder={type === "teams" ? "Where you work" : "Who you’re with"} value={values.company} />
              </label>
              <FieldError id={describe("company")}>{errors.company}</FieldError>
            </div>
          </div>
        </div>

        <div className="relative flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className={labelText}>Message</span>
            <textarea aria-describedby={describe("message")} aria-invalid={Boolean(errors.message)} className={`${field} field-sizing-content h-auto min-h-32 resize-none py-3 leading-[1.5]`} maxLength={MESSAGE_MAX} name="message" onChange={(event) => update("message", event.target.value)} placeholder={placeholder(type)} rows={4} value={values.message} />
          </label>
          {remaining < 400 ? <span aria-live="polite" className="absolute right-0 top-0 font-label text-[10px] tracking-[0.08em] text-paper/45">{remaining.toLocaleString("en")} left</span> : null}
          <FieldError id={describe("message")}>{errors.message}</FieldError>
        </div>

        {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
        <label aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">Website<input autoComplete="off" name="website" onChange={(event) => setValues((current) => ({ ...current, website: event.target.value }))} tabIndex={-1} value={values.website} /></label>

        {state.kind === "error" ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-coral/[0.1] p-4 shadow-[inset_0_0_0_1px_rgba(255,90,79,.3)] sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p className="text-[14px] font-medium leading-5 text-coral">{state.message}</p>
            <a className="shrink-0 text-[14px] font-semibold text-paper underline underline-offset-4 hover:text-coral" href={mailto(values, type)}>Email us instead →</a>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button className="group inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-coral px-8 text-[16px] font-semibold text-ink transition-colors hover:bg-[#ff7268] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper disabled:opacity-60 sm:order-2" disabled={state.kind === "sending"} type="submit">
            {state.kind === "sending" ? "Sending…" : <>Send note <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">→</span></>}
          </button>
          <p className="text-center text-[13px] leading-5 text-paper/45 sm:order-1 sm:text-left">A person reads every note.<br className="hidden sm:block" /> We only use your details to reply.</p>
        </div>
      </form>
    </Panel>
  );
}

/** The form sits on ink, like the phone menu and footer: the one dark object on a paper page. */
function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] bg-ink p-6 text-paper shadow-[0_60px_120px_-60px_rgba(13,13,13,.7)] sm:rounded-[2.25rem] sm:p-10">
      <span aria-hidden="true" className="absolute -right-32 -top-32 -z-10 size-[360px] rounded-full bg-coral/20 blur-[100px]" />
      {children}
    </div>
  );
}

function FieldError({ id, children }: { id?: string; children?: string }) {
  if (!children) return null;
  return <span className="text-[13px] font-medium leading-5 text-coral" id={id}>{children}</span>;
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
