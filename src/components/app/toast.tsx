"use client";

import { createRoot, type Root } from "react-dom/client";

/**
 * The app's one confirmation toast, the same pill the editor uses: ink, bottom centre, above the
 * phone tab bar, gone after a moment. One at a time; a new one replaces the last.
 */
let host: HTMLDivElement | null = null;
let root: Root | null = null;
let timer: number | null = null;

export function toast(text: string) {
  if (typeof document === "undefined") return;
  if (!host || !host.isConnected) {
    host = document.createElement("div");
    // Inside the app wrapper, so the toast gets the app fonts.
    (document.querySelector("div[lang]") ?? document.body).appendChild(host);
    root = createRoot(host);
  }
  if (timer) window.clearTimeout(timer);
  root?.render(
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex justify-center px-4 max-lg:bottom-[calc(96px+env(safe-area-inset-bottom))]" key={Date.now()} role="status">
      <div className="flex min-h-12 max-w-md items-center rounded-full bg-[#0D0D0D] px-5 py-2 text-sm font-semibold text-[#F5F4EF] shadow-[0_18px_50px_-18px_rgba(13,13,13,.7)] [animation:toast-in_.22s_ease-out]">{text}</div>
    </div>,
  );
  timer = window.setTimeout(() => root?.render(null), 2400);
}
