"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from "react";

import { scanTarget } from "@/lib/share/scan-target";

export type MeetTab = "scan" | "tap";

type ScanState =
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "opening" }
  | { kind: "denied" }
  | { kind: "no_camera" }
  | { kind: "failed" };

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorConstructor = { new (options: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };
type Decode = (video: HTMLVideoElement) => Promise<string | null>;

const HISTORY_KEY = "svMeet";
const INVALID_MESSAGE = "That QR isn't a Setuvara identity. Try another one.";

/** Compact Scan QR / Tap entry for Home. Opens one sheet at the chosen tab. */
export function MeetActions({ variant }: { variant: "bar" | "stage" }) {
  const [tab, setTab] = useState<MeetTab | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const open = (event: MouseEvent<HTMLButtonElement>) => { opener.current = event.currentTarget; setTab(event.currentTarget.dataset.tab === "tap" ? "tap" : "scan"); };
  const close = useCallback(() => { setTab(null); opener.current?.focus(); }, []);

  return (
    <>
      {variant === "bar"
        ? (
          <div aria-label="Meet in person" className="grid grid-cols-2 gap-2" role="group">
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold shadow-[inset_0_0_0_1.5px_#0d0d0d] focus-visible:outline-2" data-tab="scan" onClick={open} type="button"><ScanIcon />Scan QR</button>
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold shadow-[inset_0_0_0_1.5px_#0d0d0d] focus-visible:outline-2" data-tab="tap" onClick={open} type="button"><TapIcon />Tap</button>
          </div>
        )
        : (
          <div aria-label="Meet in person" className="flex" role="group">
            <button className="inline-flex min-h-[54px] items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-[#f5f4ef]/85 underline-offset-4 hover:underline focus-visible:outline-2" data-tab="scan" onClick={open} type="button"><ScanIcon />Scan QR</button>
            <button className="inline-flex min-h-[54px] items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-[#f5f4ef]/85 underline-offset-4 hover:underline focus-visible:outline-2" data-tab="tap" onClick={open} type="button"><TapIcon />Tap</button>
          </div>
        )}
      {tab && <MeetSheet initialTab={tab} onClose={close} />}
    </>
  );
}

function MeetSheet({ initialTab, onClose }: { initialTab: MeetTab; onClose: () => void }) {
  const [tab, setTab] = useState<MeetTab>(initialTab);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const closing = useRef(false);

  // The phone's back gesture closes the sheet instead of leaving Home.
  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if ((window.history.state as Record<string, unknown> | null)?.[HISTORY_KEY]) window.history.back();
    onClose();
  }, [onClose]);

  useEffect(() => {
    closeButton.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.history.pushState({ ...(window.history.state ?? {}), [HISTORY_KEY]: true }, "");
    const onPop = () => { if (!closing.current) { closing.current = true; onClose(); } };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss(); }
      if (event.key !== "Tab") return;
      const items = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), a[href]') ?? [])];
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("popstate", onPop); window.removeEventListener("keydown", onKey); };
  }, [dismiss, onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-[#0d0d0d]/55 [animation:fade-in_160ms_ease-out]" onClick={dismiss} />
      <section aria-labelledby={titleId} aria-modal="true" className="relative flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-[30px] bg-[#f5f4ef] px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2.5 [animation:sheet-up_220ms_cubic-bezier(.2,.8,.2,1)] md:max-w-[440px] md:rounded-[30px] md:p-7" ref={panel} role="dialog">
        <span aria-hidden="true" className="mx-auto h-[5px] w-10 rounded-full bg-black/20 md:hidden" />
        <div className="flex items-end justify-between gap-4">
          <div><p className="font-label text-[10px] tracking-[0.14em] text-black/65 md:text-xs">MEET IN PERSON</p><h2 className="font-display text-[30px] font-bold leading-none tracking-[-0.04em]" id={titleId}>{tab === "scan" ? "Scan their QR" : "Tap their Setuvara"}</h2></div>
          <button aria-label="Close" className="grid size-11 shrink-0 place-items-center rounded-full bg-black/[0.06] text-xl focus-visible:outline-2" onClick={dismiss} ref={closeButton} type="button">×</button>
        </div>
        <div aria-label="How to meet" className="grid grid-cols-2 gap-1 rounded-[18px] bg-black/[0.06] p-1" role="radiogroup">
          {(["scan", "tap"] as const).map((value) => {
            const on = tab === value;
            return <button aria-checked={on} className={`min-h-12 rounded-[14px] px-2 text-sm font-semibold focus-visible:outline-2 ${on ? "bg-[#0d0d0d] text-[#f5f4ef]" : "text-[#0d0d0d]"}`} key={value} onClick={() => setTab(value)} role="radio" type="button">{value === "scan" ? "Scan QR" : "Tap"}</button>;
          })}
        </div>
        {tab === "scan" ? <ScanPanel /> : <TapPanel onScan={() => setTab("scan")} />}
      </section>
    </div>
  );
}

function ScanPanel() {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScanState>({ kind: "starting" });
  const [invalid, setInvalid] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let lastInvalid = "";
    let invalidTimer: ReturnType<typeof setTimeout> | undefined;

    async function start() {
      setState({ kind: "starting" });
      setInvalid(false);
      if (!navigator.mediaDevices?.getUserMedia) { setState({ kind: "no_camera" }); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
      } catch (error) {
        if (stopped) return;
        const name = error instanceof DOMException ? error.name : "";
        setState({ kind: name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "no_camera" : "failed" });
        return;
      }
      if (stopped || !video.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      video.current.srcObject = stream;
      try { await video.current.play(); } catch { /* Autoplay is allowed for muted inline video; frames still arrive. */ }
      if (stopped) return;
      setState({ kind: "scanning" });
      const decode = await createDecoder();
      let last = 0;
      const tick = async (now: number) => {
        if (stopped) return;
        if (now - last > 140 && video.current && video.current.readyState >= 2) {
          last = now;
          const text = await decode(video.current).catch(() => null);
          if (stopped) return;
          if (text) {
            const target = scanTarget(text, window.location.origin);
            if (target) {
              stopped = true;
              stream?.getTracks().forEach((track) => track.stop());
              setState({ kind: "opening" });
              window.location.assign(target.path);
              return;
            }
            if (text !== lastInvalid) {
              lastInvalid = text;
              setInvalid(true);
              clearTimeout(invalidTimer);
              invalidTimer = setTimeout(() => { lastInvalid = ""; setInvalid(false); }, 3200);
            }
          }
        }
        frame = requestAnimationFrame((time) => void tick(time));
      };
      frame = requestAnimationFrame((time) => void tick(time));
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      clearTimeout(invalidTimer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [attempt]);

  const live = state.kind === "scanning" || state.kind === "starting" || state.kind === "opening";
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-[1.45] text-black/80">Scan someone&apos;s Setuvara QR to open their identity.</p>
      <div className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-[24px] bg-[#0d0d0d] text-[#f5f4ef]" data-scan-state={state.kind}>
        <video aria-label="Camera view" className={`absolute inset-0 size-full object-cover ${state.kind === "scanning" ? "opacity-100" : "opacity-0"}`} muted playsInline ref={video} />
        {live && <ScanFrame />}
        {state.kind === "starting" && <p className="absolute inset-x-0 bottom-5 text-center text-sm text-[#f5f4ef]/80" role="status">Starting camera…</p>}
        {state.kind === "opening" && <p className="absolute inset-x-0 bottom-5 text-center text-sm font-semibold" role="status">Opening their identity…</p>}
        {!live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
            <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-white/10"><CameraOffIcon /></span>
            <p className="text-base font-semibold">{state.kind === "denied" ? "Camera access is off" : state.kind === "no_camera" ? "No camera found" : "The camera didn't start"}</p>
            <p className="text-sm leading-[1.45] text-[#f5f4ef]/75">{state.kind === "denied" ? "Allow camera access for Setuvara in your browser settings, then try again." : state.kind === "no_camera" ? "This device has no camera Setuvara can use. Scan with your phone instead." : "Another app may be using it. Close it and try again."}</p>
            {state.kind !== "no_camera" && <button className="mt-1 min-h-11 rounded-full bg-[#f5f4ef] px-5 text-sm font-semibold text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f4ef]" onClick={() => setAttempt((value) => value + 1)} type="button">Try again</button>}
          </div>
        )}
      </div>
      <p aria-live="polite" className={`min-h-[44px] rounded-2xl px-4 py-3 text-sm font-semibold ${invalid ? "bg-[#ff5a4f]/[0.14]" : "text-black/60"}`}>{invalid ? INVALID_MESSAGE : state.kind === "scanning" ? "Point your camera at their QR." : state.kind === "denied" ? "Your phone's camera app can scan Setuvara QR codes too." : " "}</p>
    </div>
  );
}

function TapPanel({ onScan }: { onScan: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div aria-hidden="true" className="mx-auto grid h-[148px] w-full max-w-[340px] place-items-center rounded-[24px] bg-[#0d0d0d]"><TapIllustration /></div>
      <ol className="flex flex-col gap-2.5 text-[15px] leading-[1.4]">
        <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#0d0d0d] font-label text-[11px] text-[#f5f4ef]">1</span><span>Hold the top of your phone near their Setuvara Tap.</span></li>
        <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#0d0d0d] font-label text-[11px] text-[#f5f4ef]">2</span><span>Their identity opens instantly. No app needed.</span></li>
      </ol>
      <p className="rounded-2xl bg-black/[0.05] px-4 py-3 text-sm leading-[1.45] text-black/75">Tap works with a Setuvara card, ring, sticker or badge. Two phones can&apos;t tap each other, so if they don&apos;t have one, scan their QR.</p>
      <div className="grid gap-2">
        <button className="min-h-[52px] rounded-full bg-[#ff5a4f] px-4 text-sm font-semibold text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-offset-2" onClick={onScan} type="button">Scan their QR instead</button>
        <Link className="inline-flex min-h-11 items-center justify-center text-sm font-semibold underline underline-offset-4" href="/app/tap">Set up your own Tap →</Link>
      </div>
    </div>
  );
}

/** Native BarcodeDetector where the browser has it (Android Chrome), jsQR everywhere else (iPhone Safari). */
async function createDecoder(): Promise<Decode> {
  const Native = (globalThis as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
  if (Native) {
    try {
      const formats = await Native.getSupportedFormats?.();
      if (!formats || formats.includes("qr_code")) {
        const detector = new Native({ formats: ["qr_code"] });
        return async (source) => (await detector.detect(source))[0]?.rawValue ?? null;
      }
    } catch { /* Fall through to jsQR. */ }
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return async (source) => {
    if (!context || !source.videoWidth) return null;
    const scale = Math.min(1, 720 / Math.max(source.videoWidth, source.videoHeight));
    canvas.width = Math.round(source.videoWidth * scale);
    canvas.height = Math.round(source.videoHeight * scale);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

function ScanFrame() {
  const corner = "absolute size-9 border-[#f5f4ef]";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-[18%]">
      <span className={`${corner} left-0 top-0 rounded-tl-[14px] border-l-[3px] border-t-[3px]`} />
      <span className={`${corner} right-0 top-0 rounded-tr-[14px] border-r-[3px] border-t-[3px]`} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-[14px] border-b-[3px] border-l-[3px]`} />
      <span className={`${corner} bottom-0 right-0 rounded-br-[14px] border-b-[3px] border-r-[3px]`} />
    </div>
  );
}

function ScanIcon() {
  return <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" viewBox="0 0 20 20" width="18"><path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M13 3h2.5A1.5 1.5 0 0 1 17 4.5V7M17 13v2.5a1.5 1.5 0 0 1-1.5 1.5H13M7 17H4.5A1.5 1.5 0 0 1 3 15.5V13M6 10h8" /></svg>;
}

function TapIcon() {
  return <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" viewBox="0 0 20 20" width="18"><path d="M7.5 6.5a4.5 4.5 0 0 1 0 7M10.5 4a8 8 0 0 1 0 12M4.5 9a1.4 1.4 0 0 1 0 2" /></svg>;
}

function CameraOffIcon() {
  return <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="22"><path d="M3 3l18 18M9.5 5h5l1.5 2h2.5A1.5 1.5 0 0 1 20 8.5v8M17 19H4.5A1.5 1.5 0 0 1 3 17.5v-9A1.5 1.5 0 0 1 4.5 7H6M10 10.2a3 3 0 0 0 4 4" /></svg>;
}

function TapIllustration() {
  return (
    <svg fill="none" height="112" viewBox="0 0 220 112" width="220">
      <rect height="96" rx="14" stroke="#f5f4ef" strokeOpacity=".9" strokeWidth="2" width="54" x="34" y="8" />
      <rect fill="#f5f4ef" fillOpacity=".9" height="4" rx="2" width="16" x="53" y="16" />
      <path d="M104 44a16 16 0 0 1 0 24M114 36a28 28 0 0 1 0 40" stroke="#C7FF4A" strokeLinecap="round" strokeWidth="2.5" />
      <rect fill="#FF5A4F" height="52" rx="10" transform="rotate(-8 132 30)" width="80" x="132" y="30" />
      <circle cx="160" cy="50" fill="#0d0d0d" r="6" />
    </svg>
  );
}
