"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { LAUNCH_MODE_COOKIE, LAUNCH_MODES, LAUNCH_SESSION_KEY, LAUNCH_START_URL, parseLaunchMode, type LaunchMode } from "@/lib/pwa/launch";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Platform = "ios" | "prompt" | "other";

const NAMES: Record<LaunchMode, string> = { personal: "Personal", event: "Event", business: "Business" };
const DOT: Record<LaunchMode, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF" };

// Chrome fires beforeinstallprompt once per page load, often before any sheet is open, so it is kept here.
let deferredPrompt: InstallPrompt | null = null;
const promptListeners = new Set<() => void>();
const notifyPrompt = () => promptListeners.forEach((listener) => listener());
function subscribePrompt(listener: () => void) { promptListeners.add(listener); return () => { promptListeners.delete(listener); }; }
// Listen as soon as this module loads, before hydration: the event can arrive before any effect runs.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredPrompt = event as InstallPrompt; notifyPrompt(); });
  window.addEventListener("appinstalled", () => { deferredPrompt = null; notifyPrompt(); });
}

function subscribeStandalone(listener: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
/** True when Setuvara is running from the Home Screen. False on the server and in a browser tab. */
export function useStandalone() {
  return useSyncExternalStore(subscribeStandalone, isStandalone, () => false);
}

function platform(): Platform {
  if (deferredPrompt) return "prompt";
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "ios" : "other";
}

export function launchModeOnDevice(): LaunchMode {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LAUNCH_MODE_COOKIE}=([a-z]+)`));
  return parseLaunchMode(match?.[1]);
}
function saveLaunchMode(mode: LaunchMode) {
  document.cookie = `${LAUNCH_MODE_COOKIE}=${mode}; Path=/; Max-Age=34560000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

/** Claims the cold launch of the Home Screen app. Returns true only the first time per app session. */
export function claimLaunch() {
  try {
    if (!isStandalone() || window.sessionStorage.getItem(LAUNCH_SESSION_KEY)) return false;
    window.sessionStorage.setItem(LAUNCH_SESSION_KEY, "1");
    return true;
  } catch { return false; }
}

/**
 * Mounted once in the app shell. Sends a Home Screen launch that landed somewhere else (iPhone keeps the page
 * it was added from; sign-in returns to /app without the launch flag) to Share.
 */
export function HomeScreenRuntime() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    // Home handles its own launch; every other page hands a cold launch to it.
    if (pathname !== "/app" && claimLaunch()) router.replace(LAUNCH_START_URL);
    // Only the first page of a session counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Add to Home Screen, and the Mode the Home Screen app opens with on this device. */
export function HomeScreenSheet({ onClose }: { onClose: () => void }) {
  const standalone = useStandalone();
  const hasPrompt = useSyncExternalStore(subscribePrompt, () => Boolean(deferredPrompt), () => false);
  const device = useSyncExternalStore(subscribePrompt, platform, () => "other" as Platform);
  // Only ever rendered after a tap, so the cookie can be read on first render.
  const [mode, setMode] = useState<LaunchMode>(launchModeOnDevice);
  const [added, setAdded] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    close.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const items = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), a[href]') ?? [])];
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  function pick(next: LaunchMode) { setMode(next); saveLaunchMode(next); }
  async function install() {
    const prompt = deferredPrompt;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    deferredPrompt = null; notifyPrompt();
    if (outcome === "accepted") setAdded(true);
  }

  // Portalled: the app header's backdrop blur would otherwise trap a fixed sheet opened from the account menu.
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center md:items-center md:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-[#0d0d0d]/55 [animation:fade-in_160ms_ease-out]" onClick={onClose} />
      <section aria-labelledby={titleId} aria-modal="true" className="relative flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-[30px] bg-[#f5f4ef] px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2.5 [animation:sheet-up_220ms_cubic-bezier(.2,.8,.2,1)] md:max-w-[440px] md:rounded-[30px] md:p-7" ref={panel} role="dialog">
        <span aria-hidden="true" className="mx-auto h-[5px] w-10 rounded-full bg-black/20 md:hidden" />
        <div className="flex items-end justify-between gap-4">
          <div><p className="font-label text-[10px] tracking-[0.14em] text-black/65 md:text-xs">HOME SCREEN</p><h2 className="font-display text-[30px] font-bold leading-none tracking-[-0.04em]" id={titleId}>{standalone ? "Opens with" : "One tap away"}</h2></div>
          <button aria-label="Close" className="grid size-11 shrink-0 place-items-center rounded-full bg-black/[0.06] text-xl focus-visible:outline-2" onClick={onClose} ref={close} type="button">×</button>
        </div>
        <p className="text-[15px] leading-[1.45] text-black/80">{standalone ? "Setuvara opens straight to your QR. Choose the Mode it shows first." : "Add Setuvara to your Home Screen. Open it and your QR is ready to show."}</p>

        <div>
          {!standalone && <p className="mb-2 font-label text-[10px] tracking-[0.14em] text-black/65">OPENS WITH</p>}
          <div aria-label="Mode it opens with" className="grid grid-cols-3 gap-1 rounded-[18px] bg-black/[0.06] p-1" role="radiogroup">
            {LAUNCH_MODES.map((slug) => {
              const on = slug === mode;
              return <button aria-checked={on} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-[14px] text-sm font-semibold focus-visible:outline-2 ${on ? "bg-[#0d0d0d] text-[#f5f4ef]" : "text-[#0d0d0d]"}`} key={slug} onClick={() => pick(slug)} role="radio" type="button"><span aria-hidden="true" className="size-[7px] rounded-full" style={{ background: DOT[slug] }} />{NAMES[slug]}</button>;
            })}
          </div>
          <p aria-live="polite" className="mt-2 text-sm text-black/60">Saved on this device. You can change it any time.</p>
        </div>

        {!standalone && (added
          ? <p className="rounded-2xl bg-[#c7ff4a]/40 px-4 py-3 text-sm font-semibold" role="status">Added. Open Setuvara from your Home Screen.</p>
          : hasPrompt
            ? <button className="min-h-[52px] rounded-full bg-[#ff5a4f] px-4 text-sm font-semibold text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => void install()} type="button">Add to Home Screen</button>
            : device === "ios"
              ? (
                <ol className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 text-[15px] leading-[1.4] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]">
                  <Step n={1}>Tap <strong>Share</strong> <ShareIcon /> in Safari</Step>
                  <Step n={2}>Choose <strong>Add to Home Screen</strong></Step>
                  <Step n={3}>Tap <strong>Add</strong></Step>
                </ol>
              )
              : <p className="rounded-2xl bg-white p-4 text-[15px] leading-[1.45] shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]">Open your browser menu and choose <strong>Add to Home Screen</strong> or <strong>Install app</strong>.</p>)}
        <p className="text-sm leading-[1.45] text-black/60">Apple Wallet and Google Wallet passes keep working as they are.</p>
      </section>
    </div>,
    document.body,
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return <li className="flex items-center gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#0d0d0d] font-label text-[11px] text-[#f5f4ef]">{n}</span><span className="flex flex-wrap items-center gap-x-1">{children}</span></li>;
}

function ShareIcon() {
  return <svg aria-label="(the square with an arrow)" className="inline-block" fill="none" height="18" role="img" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 20 20" width="18"><path d="M10 2.5v10M6.5 6 10 2.5 13.5 6M6 9H5a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-1" /></svg>;
}
