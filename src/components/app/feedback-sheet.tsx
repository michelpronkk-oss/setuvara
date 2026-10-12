"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { FEEDBACK_KINDS, FEEDBACK_MAX_MESSAGE, FEEDBACK_MAX_SCREENSHOT, feedbackMode, type FeedbackKind } from "@/lib/feedback";

const kindLabels: Record<FeedbackKind, string> = { bug: "Bug", confusing: "Confusing", idea: "Idea", other: "Other" };
const placeholders: Record<FeedbackKind, string> = {
  bug: "What happened, and what did you expect?",
  confusing: "What was unclear?",
  idea: "What would make Setuvara better for you?",
  other: "Tell us anything.",
};

/** A small private note to the Setuvara team. Not a support desk: no threads, no replies in-app. */
export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const messageId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, input:not([type="file"]), label[tabindex]') ?? [])];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function pickScreenshot(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setError("Screenshots must be PNG, JPEG or WebP."); return; }
    const ready = file.size <= FEEDBACK_MAX_SCREENSHOT ? file : await shrink(file);
    if (!ready) { setError("That picture is too large. Try a smaller screenshot."); return; }
    setScreenshot(ready);
    setPreview(URL.createObjectURL(ready));
  }

  function removeScreenshot() {
    setScreenshot(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!kind || !message.trim() || state === "sending") return;
    setState("sending"); setError(null);
    const body = new FormData();
    body.set("kind", kind);
    body.set("message", message.trim());
    body.set("route", window.location.pathname.slice(0, 300));
    const mode = feedbackMode(window.location.pathname, window.location.search);
    if (mode) body.set("mode", mode);
    body.set("viewport", `${window.innerWidth}x${window.innerHeight}@${Math.round(window.devicePixelRatio * 100) / 100}`);
    body.set("locale", navigator.language.slice(0, 35));
    if (screenshot) body.set("screenshot", screenshot);
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "x-setuvara-request": "same-origin" }, body });
      if (response.ok) { setState("sent"); return; }
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      setError(result.error ?? "Feedback couldn’t be sent. Try again in a moment.");
    } catch {
      setError("Feedback couldn’t be sent. Check your connection and try again.");
    }
    setState("idle");
  }

  const chip = (active: boolean) => `min-h-11 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${active ? "bg-[#0d0d0d] text-[#f5f4ef]" : "bg-white text-black/75 shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.12)] hover:text-black"}`;

  // Portalled: the app header's backdrop blur would otherwise trap a fixed overlay inside it.
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-[#0d0d0d]/55 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby={headingId} aria-modal="true" className="relative max-h-[calc(100dvh-24px)] w-full overflow-y-auto rounded-t-[28px] bg-[#f5f4ef] px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-6 shadow-[0_30px_90px_-35px_rgba(0,0,0,.65)] [animation:fade-in_140ms_ease-out] sm:max-w-md sm:rounded-[28px] sm:p-7" data-feedback-sheet ref={dialogRef} role="dialog">
        <button aria-label="Close" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-black/[0.06] text-xl focus-visible:outline-2" onClick={onClose} type="button">×</button>
        {state === "sent" ? (
          <div aria-live="polite" className="pr-12">
            <h2 className="font-display text-[28px] font-bold leading-[1.05] tracking-[-0.045em]" id={headingId}>Thank you.</h2>
            <p className="mt-3 text-sm leading-6 text-black/65">Your note went straight to the Setuvara team. We read every one.</p>
            <button className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[#0d0d0d] px-6 text-sm font-semibold text-[#f5f4ef] focus-visible:outline-2 focus-visible:outline-offset-2" data-autofocus onClick={onClose} type="button">Done</button>
          </div>
        ) : (
          <form onSubmit={(event) => void submit(event)}>
            <h2 className="pr-12 font-display text-[28px] font-bold leading-[1.05] tracking-[-0.045em]" id={headingId}>Send feedback</h2>
            <p className="mt-2 text-sm leading-6 text-black/60">Only the Setuvara team sees this.</p>
            <fieldset className="mt-5">
              <legend className="sr-only">What kind of feedback?</legend>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_KINDS.map((value, index) => (
                  <button aria-pressed={kind === value} className={chip(kind === value)} data-autofocus={index === 0 ? true : undefined} key={value} onClick={() => setKind(value)} type="button">{kindLabels[value]}</button>
                ))}
              </div>
            </fieldset>
            <label className="mt-5 block text-sm font-semibold" htmlFor={messageId}>Message</label>
            <textarea className="mt-2 block min-h-32 w-full resize-y rounded-[18px] bg-white px-4 py-3 text-[15px] leading-6 shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.12)] outline-none placeholder:text-black/40 focus:shadow-[inset_0_0_0_2px_#0d0d0d]" id={messageId} maxLength={FEEDBACK_MAX_MESSAGE} onChange={(event) => setMessage(event.target.value)} placeholder={kind ? placeholders[kind] : "Pick a type, then tell us what’s on your mind."} required value={message} />
            <div className="mt-4">
              {preview ? (
                <div className="flex items-center gap-3 rounded-[18px] bg-white p-2 pr-3 shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.08)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img alt="Screenshot preview" className="size-14 rounded-xl object-cover" src={preview} />
                  <span className="min-w-0 flex-1 truncate text-sm text-black/70">{screenshot?.name || "Screenshot"}</span>
                  <button className="min-h-11 px-2 text-sm font-semibold text-black/70 underline-offset-4 hover:underline" onClick={removeScreenshot} type="button">Remove</button>
                </div>
              ) : (
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-1 text-sm font-semibold text-black/70 underline-offset-4 hover:underline focus-visible:outline-2" onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileRef.current?.click(); } }} tabIndex={0}>
                  <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 20 20" width="18"><rect height="12" rx="2.5" width="16" x="2" y="4" /><circle cx="7.5" cy="8.5" r="1.5" /><path d="M3 14l4.5-4 3.5 3 2.5-2L17 14" /></svg>
                  Add a screenshot (optional)
                  <input accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void pickScreenshot(event.target.files?.[0])} ref={fileRef} tabIndex={-1} type="file" />
                </label>
              )}
            </div>
            <p className="mt-4 text-xs leading-5 text-black/50">We include the page, Mode, plan and browser you’re using so we can follow up on it.</p>
            {error && <p aria-live="polite" className="mt-3 text-sm text-[#a43d36]">{error}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#ff5a4f] px-6 text-sm font-semibold text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" disabled={!kind || !message.trim() || state === "sending"} type="submit">{state === "sending" ? "Sending…" : "Send"}</button>
              <button className="inline-flex min-h-12 items-center rounded-full px-5 text-sm font-semibold shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.2)] focus-visible:outline-2" onClick={onClose} type="button">Cancel</button>
            </div>
          </form>
        )}
      </section>
    </div>,
    document.body,
  );
}

/** Re-encodes an oversized screenshot as a JPEG no wider than 2400px. */
async function shrink(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob && blob.size <= FEEDBACK_MAX_SCREENSHOT ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : null;
  } catch {
    return null;
  }
}
