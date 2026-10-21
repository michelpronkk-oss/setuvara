"use client";

import { useEffect, useRef, useState } from "react";

import { scanPass, type ScanOutcome } from "@/app/app/identity/events/actions";
import { passTokenFromScan, type ScanResult } from "@/lib/events/model";
import { createDecoder } from "@/lib/share/qr-decoder";

type Camera = "starting" | "scanning" | "denied" | "no_camera" | "failed";
type Shown = { tone: "go" | "warn" | "stop"; title: string; body: string | null; result: ScanResult | "not_a_pass" | "error" };

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const TONE = { go: "bg-[#C7FF4A] text-[#0D0D0D]", warn: "bg-[#FFD15C] text-[#0D0D0D]", stop: "bg-[#FF5A4F] text-[#0D0D0D]" } as const;
// How long a result stays up before the next guest, and how long the same QR is ignored after it.
const HOLD_MS = 2200;
const SAME_MS = 6000;

function describe(outcome: ScanOutcome): Shown {
  if (!outcome.ok) return { tone: "stop", title: "Try again", body: outcome.error, result: "error" };
  const guest = outcome.guest;
  switch (outcome.result) {
    case "checked_in": return { tone: "go", title: guest?.name ?? "Checked in", body: guest?.connected ? "Checked in. You're connected now." : "Checked in. Welcome them in.", result: outcome.result };
    case "already_checked_in": return { tone: "warn", title: "Already checked in", body: guest ? `${guest.name} came in at ${guest.checked_in_at ? clock(guest.checked_in_at) : "earlier"}. This pass was used.` : "This pass was used.", result: outcome.result };
    case "not_going": return { tone: "stop", title: "Not going", body: guest ? `${guest.name} is ${guest.status === "waitlisted" ? "on the waitlist" : "no longer on the list"}.` : null, result: outcome.result };
    case "other_event": return { tone: "warn", title: "Another event", body: outcome.otherEvent ? `This pass is for ${outcome.otherEvent}.` : "This pass is for another event.", result: outcome.result };
    case "not_open": return { tone: "warn", title: "Too early", body: "Check-in opens 12 hours before the start.", result: outcome.result };
    case "closed": return { tone: "warn", title: "Check-in closed", body: "Check-in has closed for this event.", result: outcome.result };
    default: return { tone: "stop", title: "Not a valid pass", body: "This pass isn't for your event, or it was replaced by a newer one.", result: "invalid" };
  }
}

/**
 * The organizer's door: the phone camera reads guests' door passes and checks them in one by one.
 * Each result stays up long enough to read, the same pass is ignored for a moment after, and the
 * database lets every pass in once, however many phones scan it.
 */
export function DoorScanner({ eventId, checkedIn: initialIn, going: initialGoing }: { eventId: string; checkedIn: number; going: number }) {
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<Camera>("starting");
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState({ in: initialIn, going: initialGoing });

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let holdUntil = 0;
    let lastText = "";
    let lastAt = 0;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;

    function show(next: Shown) {
      setShown(next);
      try { navigator.vibrate?.(next.tone === "go" ? 60 : [80, 60, 80]); } catch { /* Not every phone vibrates. */ }
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => { if (!stopped) setShown(null); }, HOLD_MS + 2600);
    }

    async function handle(text: string) {
      if (!passTokenFromScan(text)) { show({ tone: "stop", title: "Not a door pass", body: "Ask the guest for the pass on their event page.", result: "not_a_pass" }); return; }
      setBusy(true);
      const outcome = await scanPass(eventId, text).catch((): ScanOutcome => ({ ok: false, error: "No connection. Try again." }));
      if (stopped) return;
      setBusy(false);
      if (outcome.ok && outcome.checkedIn >= 0) setCount({ in: outcome.checkedIn, going: outcome.going });
      show(describe(outcome));
    }

    async function start() {
      setCamera("starting");
      if (!navigator.mediaDevices?.getUserMedia) { setCamera("no_camera"); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
      } catch (error) {
        if (stopped) return;
        const name = error instanceof DOMException ? error.name : "";
        setCamera(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "no_camera" : "failed");
        return;
      }
      if (stopped || !video.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      video.current.srcObject = stream;
      try { await video.current.play(); } catch { /* Muted inline video still delivers frames. */ }
      if (stopped) return;
      setCamera("scanning");
      const decode = await createDecoder();
      let last = 0;
      const tick = async (now: number) => {
        if (stopped) return;
        if (now > holdUntil && now - last > 140 && video.current && video.current.readyState >= 2) {
          last = now;
          const text = await decode(video.current).catch(() => null);
          if (stopped) return;
          if (text && !(text === lastText && now - lastAt < SAME_MS)) {
            lastText = text;
            lastAt = now;
            holdUntil = Number.POSITIVE_INFINITY;
            await handle(text);
            holdUntil = performance.now() + HOLD_MS;
            lastAt = performance.now();
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
      clearTimeout(clearTimer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [attempt, eventId]);

  const live = camera === "scanning" || camera === "starting";
  return (
    <div className="flex flex-col gap-3" data-scanner={camera}>
      <div className="flex items-baseline justify-between gap-3 px-1">
        <p className="font-display text-[34px] font-bold leading-none tracking-[-0.05em]" data-checked-in={count.in}>{count.in}<span className="text-black/35"> / {count.going}</span></p>
        <p className="text-[14px] font-semibold text-black/55">checked in</p>
      </div>
      <div className="relative aspect-square w-full overflow-hidden rounded-[28px] bg-[#0D0D0D] text-[#F5F4EF]">
        <video aria-label="Camera view" className={`absolute inset-0 size-full object-cover ${camera === "scanning" ? "opacity-100" : "opacity-0"}`} muted playsInline ref={video} />
        {live && <Frame />}
        {camera === "starting" && <p className="absolute inset-x-0 bottom-6 text-center text-sm text-[#F5F4EF]/80" role="status">Starting camera…</p>}
        {camera === "scanning" && !shown && <p className="absolute inset-x-0 bottom-6 text-center text-[15px] font-semibold" role="status">{busy ? "Checking…" : "Point at a guest's door pass"}</p>}
        {!live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center" role="alert">
            <p className="text-base font-semibold">{camera === "denied" ? "Camera access is off" : camera === "no_camera" ? "No camera found" : "The camera didn't start"}</p>
            <p className="text-sm leading-[1.45] text-[#F5F4EF]/75">{camera === "denied" ? "Allow camera access for Setuvara in your browser settings, then try again. You can also check guests in from the list." : camera === "no_camera" ? "Open this page on your phone, or check guests in from the list." : "Another app may be using it. Close it and try again."}</p>
            {camera !== "no_camera" && <button className="mt-1 min-h-11 rounded-full bg-[#F5F4EF] px-5 text-sm font-semibold text-[#0D0D0D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4EF]" onClick={() => setAttempt((value) => value + 1)} type="button">Try again</button>}
          </div>
        )}
        {shown && (
          <div aria-live="assertive" className={`absolute inset-x-3 bottom-3 rounded-[22px] p-5 shadow-[0_20px_50px_rgba(0,0,0,.35)] ${TONE[shown.tone]}`} data-scan-result={shown.result} role="status">
            <p className="font-label text-[11px] uppercase tracking-[0.16em] opacity-70">{shown.tone === "go" ? "Valid" : shown.tone === "warn" ? "Check" : "Stop"}</p>
            <p className="mt-1.5 break-words font-display text-[30px] font-bold leading-[0.98] tracking-[-0.045em]">{shown.title}</p>
            {shown.body && <p className="mt-2 text-[15px] font-semibold leading-snug opacity-80">{shown.body}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Frame() {
  const corner = "absolute size-10 border-[#F5F4EF]";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-[16%]">
      <span className={`${corner} left-0 top-0 rounded-tl-[16px] border-l-[3px] border-t-[3px]`} />
      <span className={`${corner} right-0 top-0 rounded-tr-[16px] border-r-[3px] border-t-[3px]`} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-[16px] border-b-[3px] border-l-[3px]`} />
      <span className={`${corner} bottom-0 right-0 rounded-br-[16px] border-b-[3px] border-r-[3px]`} />
    </div>
  );
}
