"use client";

import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

export type ConfirmOptions = {
  title: string;
  body?: string;
  /** The button that goes ahead, e.g. "Delete". */
  action: string;
  /** "danger" for anything that can't be undone. */
  tone?: "danger" | "default";
  cancel?: string;
};

/**
 * The app's own "are you sure?" in place of the browser's grey box: a sheet on phones, a card on
 * larger screens. Resolves true when the member goes ahead, false on cancel, Escape or tapping out.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const host = document.createElement("div");
    // Inside the app wrapper, so the dialog gets the app fonts.
    (document.querySelector("div[lang]") ?? document.body).appendChild(host);
    const root = createRoot(host);
    const done = (value: boolean) => {
      resolve(value);
      root.unmount();
      host.remove();
    };
    root.render(<ConfirmSheet {...options} onDone={done} />);
  });
}

function ConfirmSheet({ title, body, action, tone = "default", cancel = "Cancel", onDone }: ConfirmOptions & { onDone: (value: boolean) => void }) {
  const goRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    const returnTo = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    // Destructive choices start on Cancel, so Enter never deletes by accident.
    (tone === "danger" ? cancelRef : goRef).current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); doneRef.current(false); }
      if (event.key === "Tab") {
        const order = [cancelRef.current, goRef.current].filter(Boolean) as HTMLElement[];
        const at = order.indexOf(document.activeElement as HTMLElement);
        event.preventDefault();
        order[(at + (event.shiftKey ? order.length - 1 : 1)) % order.length]?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey, true); returnTo?.focus?.({ preventScroll: true }); };
  }, [tone]);

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center font-sans text-[#0D0D0D] sm:items-center sm:p-6" role="presentation">
      <button aria-label={cancel} className="absolute inset-0 cursor-default bg-[#0D0D0D]/45 backdrop-blur-[2px] [animation:fade-in_.18s_ease-out]" onClick={() => onDone(false)} tabIndex={-1} type="button" />
      <div aria-describedby={body ? "sv-confirm-body" : undefined} aria-labelledby="sv-confirm-title" aria-modal="true" className="relative w-full rounded-t-[28px] bg-[#F5F4EF] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_-20px_rgba(13,13,13,.5)] [animation:sheet-up_.26s_cubic-bezier(.2,.8,.2,1)] sm:max-w-[420px] sm:rounded-[28px] sm:p-7 sm:[animation:fade-in_.18s_ease-out]" role="alertdialog">
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/15 sm:hidden" />
        {tone === "danger" && <span aria-hidden="true" className="mb-4 grid size-11 place-items-center rounded-full bg-[#FF5A4F]/15 text-[#D92D20]"><svg className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg></span>}
        <h2 className="font-display text-[24px] font-bold leading-[1.1] tracking-[-0.04em]" id="sv-confirm-title">{title}</h2>
        {body && <p className="mt-2 text-[15px] leading-[1.5] text-black/60" id="sv-confirm-body">{body}</p>}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="min-h-12 rounded-full bg-black/[0.06] px-4 text-[15px] font-semibold transition hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => onDone(false)} ref={cancelRef} type="button">{cancel}</button>
          <button className={`min-h-12 rounded-full px-4 text-[15px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[.98] ${tone === "danger" ? "bg-[#D92D20] text-white hover:bg-[#B42318]" : "bg-[#0D0D0D] text-[#F5F4EF] hover:bg-black"}`} onClick={() => onDone(true)} ref={goRef} type="button">{action}</button>
        </div>
      </div>
    </div>
  );
}
