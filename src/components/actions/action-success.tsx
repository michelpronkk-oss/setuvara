import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import type { MotionLevel } from "@/components/profile/appearance";
import type { ActionKind, ActionReward } from "@/lib/actions/model";
import { RewardCard } from "./action-reward";

export type SuccessStage = "sent" | "confirmed";

/** Fixed, seeded confetti so the server and the browser draw the same burst. */
const BITS = Array.from({ length: 34 }, (_, index) => {
  const seed = Math.sin(index * 9301 + 49297) * 233280;
  const random = (n: number) => { const value = Math.sin(seed + n * 1.7) * 10000; return value - Math.floor(value); };
  const angle = (index / 34) * Math.PI * 2 + random(1) * 0.5;
  const reach = 90 + random(2) * 150;
  return {
    tx: Math.round(Math.cos(angle) * reach),
    ty: Math.round(Math.sin(angle) * reach * 0.82 - 30),
    rot: Math.round((random(3) - 0.5) * 720),
    fall: Math.round(40 + random(4) * 90),
    delay: (0.42 + random(5) * 0.22).toFixed(2),
    time: (1.3 + random(6) * 0.9).toFixed(2),
    size: Math.round(5 + random(7) * 7),
    shape: index % 3,
    tone: index % 4,
  };
});
const TONES = ["var(--av-accent)", "var(--av-fg)", "color-mix(in srgb, var(--av-accent) 55%, #FFFFFF)", "color-mix(in srgb, var(--av-accent) 70%, var(--av-fg))"];

function copyFor(kind: ActionKind, stage: SuccessStage, firstName: string, email: string | null): { eyebrow: string; headline: string; body: string } {
  const inbox = email ? `We sent a link to ${email}.` : "We sent you a link.";
  if (kind === "newsletter") {
    return stage === "confirmed"
      ? { eyebrow: "Subscribed", headline: "You're on the list.", body: `${firstName}'s next one lands in your inbox.` }
      : { eyebrow: "One tap left", headline: "Check your inbox.", body: `${inbox} Tap it to join ${firstName}'s list.` };
  }
  if (kind === "giveaway") {
    return stage === "confirmed"
      ? { eyebrow: "Entry confirmed", headline: "You're in.", body: "One entry per person. Good luck." }
      : { eyebrow: "Almost entered", headline: "Check your inbox.", body: `${inbox} Confirm within 48 hours or the entry doesn't count.` };
  }
  return { eyebrow: "Sent", headline: `Sent to ${firstName}.`, body: email ? `${firstName} replies by email when it's a fit.` : `${firstName} reads every one.` };
}

function Mark({ kind, stage }: { kind: ActionKind; stage: SuccessStage }) {
  const draw = (d: string, delay: string, width = 2.4) => <path d={d} data-av="draw" fill="none" pathLength={1} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={width} style={{ "--d": delay } as CSSProperties} />;
  if (stage === "sent" && (kind === "newsletter" || kind === "giveaway")) {
    // An envelope that closes, then a small check on its seal.
    return (
      <svg aria-hidden="true" className="size-[46px]" viewBox="0 0 48 48">
        {draw("M8 15.5h32v21a2.5 2.5 0 0 1-2.5 2.5h-27A2.5 2.5 0 0 1 8 36.5v-21Z", ".78s")}
        {draw("m8.5 16.5 15.5 11 15.5-11", "1.02s")}
        {draw("m19.5 11 3.2 3.2L29 8", "1.28s", 2.6)}
      </svg>
    );
  }
  if (kind === "giveaway") {
    return <svg aria-hidden="true" className="size-[46px]" viewBox="0 0 48 48">{draw("M24 6c1.4 9.6 5.6 14 16 18-10.4 4-14.6 8.4-16 18-1.4-9.6-5.6-14-16-18 10.4-4 14.6-8.4 16-18Z", ".8s", 2.2)}</svg>;
  }
  return <svg aria-hidden="true" className="size-[46px]" viewBox="0 0 48 48">{draw("m12 25 8 8 16-18", ".82s", 3)}</svg>;
}

/**
 * The moment after a visitor sends, enters or subscribes. The Mode's accent blooms out of the button,
 * rings and confetti leave the mark, and the words rise in the page's own name typeface. Motion
 * follows the Appearance (off, subtle, full) and the visitor's reduced-motion setting.
 */
export function ActionSuccess({ kind, stage, firstName, email = null, thanks, title, reward = null, preview = false, backHref, heading, motion, contained = false, action }: {
  kind: ActionKind;
  stage: SuccessStage;
  firstName: string;
  email?: string | null;
  /** The owner's own line, shown as a quote under the headline. */
  thanks?: string;
  /** The owner's own headline, in place of the standard one once the response counts. */
  title?: string;
  /** Revealed only after a real response (or confirmation, for kinds that confirm). */
  reward?: ActionReward | null;
  preview?: boolean;
  backHref?: string;
  heading: CSSProperties;
  motion: MotionLevel;
  /** Inside a preview phone instead of over the whole window. */
  contained?: boolean;
  action?: ReactNode;
}) {
  const standard = copyFor(kind, stage, firstName, email);
  // Kinds that confirm by email keep "Check your inbox" until they're confirmed.
  const counts = stage === "confirmed" || (kind !== "newsletter" && kind !== "giveaway");
  const copy = counts && title?.trim() ? { ...standard, headline: title.trim() } : standard;
  const words = copy.headline.split(" ");
  const center = { left: "50%", top: "38%" };
  return (
    <div
      aria-live="polite"
      className={`${contained ? "absolute" : "fixed"} inset-0 z-50 flex flex-col items-center overflow-hidden px-6 text-center`}
      data-av-success={stage}
      data-motion={motion}
      role="status"
      style={{ background: "var(--av-bg)", color: "var(--av-fg)" }}
    >
      {/* The accent fills the screen from where the button was, then clears to a soft glow. */}
      <span aria-hidden="true" className="pointer-events-none absolute size-[260vmax] rounded-full" data-av="bloom" style={{ left: "50%", top: "92%", background: "var(--av-accent)", opacity: 0 }} />
      <span aria-hidden="true" className="pointer-events-none absolute size-[150vmin] rounded-full" data-av="glow" style={{ ...center, transform: "translate(-50%,-50%)", background: "radial-gradient(closest-side, color-mix(in srgb, var(--av-accent) 34%, transparent), transparent)" }} />
      {[0, 0.18, 0.36].map((delay) => (
        <span aria-hidden="true" className="pointer-events-none absolute size-[120px] rounded-full" data-av="ring" key={delay} style={{ ...center, opacity: 0, boxShadow: "inset 0 0 0 1.5px var(--av-accent)", "--d": `${0.5 + delay}s` } as CSSProperties} />
      ))}
      {BITS.map((bit, index) => (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute"
          data-av="bit"
          key={index}
          style={{
            ...center,
            opacity: 0,
            width: bit.shape === 1 ? bit.size * 0.55 : bit.size,
            height: bit.shape === 1 ? bit.size * 1.6 : bit.size,
            borderRadius: bit.shape === 0 ? 999 : 2,
            background: TONES[bit.tone],
            clipPath: bit.shape === 2 ? "polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)" : undefined,
            "--tx": `${bit.tx}px`, "--ty": `${bit.ty}px`, "--rot": `${bit.rot}deg`, "--fall": `${bit.fall}px`, "--d": `${bit.delay}s`, "--t": `${bit.time}s`,
          } as CSSProperties}
        />
      ))}

      <div className="relative flex w-full max-w-[420px] flex-1 flex-col items-center justify-center pb-[12%]">
        <span className="relative grid size-[104px] place-items-center overflow-hidden rounded-full" data-av="emblem" style={{ background: "var(--av-accent)", color: "var(--av-on-accent)", boxShadow: "0 24px 60px -18px color-mix(in srgb, var(--av-accent) 70%, transparent), inset 0 0 0 1px color-mix(in srgb, #FFFFFF 22%, transparent)" }}>
          <Mark kind={kind} stage={stage} />
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/35 blur-md" data-av="shine" />
        </span>
        <p className="mt-9 font-label text-[11px] uppercase tracking-[0.2em]" data-av="rise" style={{ color: "var(--av-muted)", "--d": ".95s" } as CSSProperties}>{copy.eyebrow}</p>
        <h2 className="mt-3 text-balance text-[44px] leading-[0.95]" style={{ ...heading, lineHeight: 0.98 }}>
          {words.map((word, index) => <span className="inline-block" data-av="rise" key={index} style={{ "--d": `${1.02 + index * 0.07}s`, marginRight: index < words.length - 1 ? "0.24em" : undefined } as CSSProperties}>{word}</span>)}
        </h2>
        <p className="mt-4 max-w-[34ch] text-[16px] leading-[1.5]" data-av="rise" style={{ color: "var(--av-muted)", "--d": `${1.1 + words.length * 0.07}s` } as CSSProperties}>{copy.body}</p>
        {thanks && <p className="mt-5 max-w-[34ch] text-[17px] font-semibold leading-[1.4]" data-av="rise" style={{ "--d": `${1.2 + words.length * 0.07}s` } as CSSProperties}>“{thanks}”<span className="mt-1 block text-[13px] font-normal" style={{ color: "var(--av-muted)" }}>{firstName}</span></p>}
        {counts && reward && <div className="flex w-full justify-center" data-av="rise" style={{ "--d": `${1.3 + words.length * 0.07}s` } as CSSProperties}><RewardCard preview={preview} reward={reward} /></div>}
      </div>
      <div className="relative w-full max-w-[420px] pb-[calc(24px+env(safe-area-inset-bottom))]" data-av="rise" style={{ "--d": "1.55s" } as CSSProperties}>
        {action ?? (backHref && <Link className="inline-flex min-h-14 w-full items-center justify-center rounded-full text-[16px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2" href={backHref} style={{ background: "var(--av-btn-bg)", color: "var(--av-btn-fg)", boxShadow: "var(--av-btn-ring)" }}>Back to {firstName}</Link>)}
      </div>
    </div>
  );
}
