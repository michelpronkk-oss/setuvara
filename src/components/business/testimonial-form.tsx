"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { BODY_MAX, testimonialProblems } from "@/lib/business/testimonials";

const input = "min-h-12 w-full rounded-[16px] bg-white px-4 text-[16px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#0D0D0D] aria-[invalid=true]:shadow-[inset_0_0_0_2px_#B42318]";
const errorText = "text-[13px] font-medium text-[#B42318]";

/** A client's few words for a business, sent once through their private link. */
export function TestimonialForm({ token, owner, initialName }: { token: string; owner: string; initialName: string }) {
  const uid = useId();
  const [body, setBody] = useState("");
  const [name, setName] = useState(initialName);
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [tried, setTried] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const problems = testimonialProblems({ body, name, role, company, consent });
  const show = (key: string) => (tried ? problems[key] : undefined);
  const first = owner.split(/\s+/)[0] || owner;

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setTried(true);
    if (Object.keys(problems).length) return;
    setState("sending");
    setError(null);
    const response = await fetch("/api/testimonials/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" },
      body: JSON.stringify({ token, name: name.trim(), role: role.trim(), company: company.trim(), body: body.trim(), rating, consent }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (!response?.ok || !result?.ok) { setState("idle"); setError(result?.error ?? "That didn't send. Check your connection and try again."); return; }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="mt-4" role="status">
        <h1 className="font-display text-[48px] font-bold leading-[0.95] tracking-[-0.05em]">Thank you.</h1>
        <p className="mt-4 text-[17px] leading-[1.5] text-black/65">{first} will read it first and choose whether it shows on their page. You can close this page.</p>
      </div>
    );
  }

  return (
    <form className="mt-4 flex flex-col gap-6" noValidate onSubmit={(event) => void send(event)}>
      <div>
        <h1 className="font-display text-[44px] font-bold leading-[0.95] tracking-[-0.05em] md:text-[56px]">A few words for {first}?</h1>
        <p className="mt-4 text-[16px] leading-[1.5] text-black/60">{owner} asked you personally. Say what it was like to work together, in your own words.</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <label className="text-[16px] font-semibold" htmlFor={`${uid}-body`}>Your words</label>
        <textarea aria-describedby={`${uid}-body-hint`} aria-invalid={show("body") ? true : undefined} className={`${input} min-h-[160px] resize-y rounded-[20px] py-3.5 leading-[1.5]`} id={`${uid}-body`} maxLength={BODY_MAX} onChange={(event) => setBody(event.target.value)} value={body} />
        <p className={show("body") ? errorText : "text-[13px] text-black/45"} id={`${uid}-body-hint`}>{show("body") ?? `${body.trim().length}/${BODY_MAX}`}</p>
      </div>

      <fieldset>
        <legend className="mb-2.5 text-[16px] font-semibold">Rating <span className="font-normal text-black/45">optional</span></legend>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button aria-checked={rating === star} aria-label={`${star} out of 5`} className={`grid size-12 place-items-center rounded-full transition ${rating && star <= rating ? "bg-[#0D0D0D] text-[#FFB547]" : "bg-white text-black/25 shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]"}`} key={star} onClick={() => setRating(rating === star ? null : star)} role="radio" type="button">
              <svg aria-hidden="true" className="size-5" fill="currentColor" viewBox="0 0 20 20"><path d="m10 1.8 2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.7l-5.1 2.8L6 11.8l-4.3-4 5.8-.7L10 1.8Z" /></svg>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2.5 sm:col-span-2">
          <label className="text-[16px] font-semibold" htmlFor={`${uid}-name`}>Your name, as it should appear</label>
          <input aria-invalid={show("name") ? true : undefined} autoComplete="name" className={input} id={`${uid}-name`} maxLength={80} onChange={(event) => setName(event.target.value)} value={name} />
          {show("name") && <p className={errorText}>{show("name")}</p>}
        </div>
        <div className="flex flex-col gap-2.5">
          <label className="text-[16px] font-semibold" htmlFor={`${uid}-role`}>Role <span className="font-normal text-black/45">optional</span></label>
          <input autoComplete="organization-title" className={input} id={`${uid}-role`} maxLength={80} onChange={(event) => setRole(event.target.value)} placeholder="Founder" value={role} />
        </div>
        <div className="flex flex-col gap-2.5">
          <label className="text-[16px] font-semibold" htmlFor={`${uid}-company`}>Company <span className="font-normal text-black/45">optional</span></label>
          <input autoComplete="organization" className={input} id={`${uid}-company`} maxLength={100} onChange={(event) => setCompany(event.target.value)} value={company} />
        </div>
      </div>

      <div>
        <label className="flex items-start gap-3 text-[15px] leading-[1.45]">
          <input aria-invalid={show("consent") ? true : undefined} checked={consent} className="mt-0.5 size-5 shrink-0 accent-[#0D0D0D]" onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
          <span>{first} may show this on their Setuvara page with my name{role || company ? ", role and company" : ""}.</span>
        </label>
        {show("consent") && <p className={`mt-2 ${errorText}`}>{show("consent")}</p>}
      </div>

      {error && <p className="text-[14px] font-semibold text-[#B42318]" role="alert">{error}</p>}
      <button className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#0D0D0D] text-[16px] font-semibold text-[#F5F4EF] transition active:scale-[.98] disabled:opacity-50" disabled={state === "sending"} type="submit">{state === "sending" ? "Sending…" : "Send"}</button>
      <p className="text-[13px] leading-[1.5] text-black/50">This link works once. Only {first} sees it until they approve it. <Link className="underline underline-offset-4" href="/privacy">Privacy</Link></p>
    </form>
  );
}
