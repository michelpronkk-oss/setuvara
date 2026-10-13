"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { TEAM_SIZES } from "@/lib/marketing/team-inquiry";

import { MeetMark } from "../brand";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; name: string } | { kind: "error"; message: string };

const field = "h-12 w-full rounded-2xl bg-white px-4 text-[15px] text-ink shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] outline-none transition-shadow placeholder:text-ink/35 focus:shadow-[inset_0_0_0_2px_#0d0d0d]";
const label = "font-label text-[10px] uppercase tracking-[0.14em] text-ink/55";

/** "Tell us about your team": opens a form in a modal that emails hello@setuvara.com. */
export function TeamInquiry({ className, children = "Tell us about your team" }: { className: string; children?: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const openedAt = useRef(0);
  const [state, setState] = useState<State>({ kind: "idle" });
  const id = useId();

  function open() {
    openedAt.current = Date.now();
    if (state.kind !== "sending") setState({ kind: "idle" });
    dialog.current?.showModal();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "");
    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/team-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" },
        body: JSON.stringify({ name: value("name"), email: value("email"), company: value("company"), size: value("size"), message: value("message"), website: value("website"), openedAt: openedAt.current }),
      });
      if (response.ok) return setState({ kind: "sent", name: value("name").trim().split(/\s+/)[0] });
      const body = await response.json().catch(() => ({}));
      setState({ kind: "error", message: body.error ?? "That didn’t send. Try again, or email hello@setuvara.com." });
    } catch {
      setState({ kind: "error", message: "You seem to be offline. Try again, or email hello@setuvara.com." });
    }
  }

  return (
    <>
      <button aria-haspopup="dialog" className={className} onClick={open} type="button">{children}</button>
      <dialog
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(560px,calc(100vw-24px))] max-w-none overflow-visible bg-transparent p-0 text-ink backdrop:bg-ink/55 backdrop:backdrop-blur-[6px] open:[animation:sv-modal-in_.38s_cubic-bezier(.2,.8,.2,1)] open:backdrop:[animation:fade-in_.3s_ease-out]"
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}
        ref={dialog}
      >
        <div className="relative max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[2rem] bg-paper p-6 shadow-[0_60px_120px_-40px_rgba(0,0,0,.6)] sm:p-9">
          <button aria-label="Close" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full text-ink/60 transition-colors hover:bg-ink/[0.06] hover:text-ink focus-visible:outline-2 focus-visible:outline-ink" onClick={() => dialog.current?.close()} type="button">
            <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>

          {state.kind === "sent" ? (
            <div className="flex flex-col items-start gap-5 py-6" role="status">
              <span className="grid size-14 place-items-center rounded-2xl bg-coral"><MeetMark className="size-8 text-ink" /></span>
              <h2 className="font-display text-[clamp(30px,5vw,44px)] font-extrabold leading-[0.95] tracking-[-0.05em]" id={`${id}-title`}>Thanks, {state.name}.</h2>
              <p className="max-w-[24rem] text-[16px] leading-[1.5] text-ink/70">Your note is with us. We’ll reply from hello@setuvara.com.</p>
              <button className="mt-2 inline-flex min-h-12 items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-paper hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" onClick={() => dialog.current?.close()} type="button">Done</button>
            </div>
          ) : (
            <form className="flex flex-col gap-5" onSubmit={submit}>
              <div className="flex flex-col gap-3 pr-10">
                <p className="font-label text-[11px] uppercase tracking-[0.16em] text-coral">Setuvara for Teams</p>
                <h2 className="font-display text-[clamp(30px,5vw,44px)] font-extrabold leading-[0.95] tracking-[-0.05em]" id={`${id}-title`}>Tell us about your team.</h2>
                <p className="text-[15px] leading-[1.5] text-ink/65">Teams is in development. We read every note and reply personally.</p>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5"><span className={label}>Name</span><input autoComplete="name" className={field} maxLength={120} name="name" required /></label>
                <label className="flex flex-col gap-1.5"><span className={label}>Work email</span><input autoComplete="email" className={field} inputMode="email" maxLength={254} name="email" required type="email" /></label>
                <label className="flex flex-col gap-1.5"><span className={label}>Company</span><input autoComplete="organization" className={field} maxLength={120} name="company" required /></label>
                <label className="flex flex-col gap-1.5"><span className={label}>Team size</span>
                  <span className="relative block">
                    <select className={`${field} appearance-none pr-10`} defaultValue="" name="size" required>
                      <option disabled value="">Choose</option>
                      {TEAM_SIZES.map((size) => <option key={size} value={size}>{size} people</option>)}
                    </select>
                    <svg aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-2 w-3 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 12 8"><path d="M1 1l5 5 5-5" /></svg>
                  </span>
                </label>
              </div>
              <label className="flex flex-col gap-1.5"><span className={label}>What do you need? <span className="normal-case tracking-normal text-ink/40">Optional</span></span>
                <textarea className={`${field} h-28 resize-none py-3`} maxLength={2000} name="message" placeholder="Events you go to, how your people share today…" />
              </label>
              {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
              <label aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">Website<input autoComplete="off" name="website" tabIndex={-1} /></label>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <p aria-live="polite" className={`text-[13px] leading-5 ${state.kind === "error" ? "font-medium text-[#a43d36]" : "text-ink/50"}`}>{state.kind === "error" ? state.message : "Goes straight to hello@setuvara.com."}</p>
                <button className="inline-flex min-h-13 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[15px] font-semibold text-paper transition-colors hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-60" disabled={state.kind === "sending"} type="submit">
                  {state.kind === "sending" ? "Sending…" : <>Send <span aria-hidden="true">→</span></>}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
