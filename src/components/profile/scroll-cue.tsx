"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import type { ScrollCue as CueId } from "./appearance";

/**
 * The scroll cue: a small sign under the hero's Connect that the profile continues below. It
 * travels with the identity, so wherever Connect is visible, the cue is too. Each
 * Appearance wears its own (appearance.ts APPEARANCE_CUES); Plus can pick any of the ten.
 *
 * It is a real button (it scrolls to the content), it fades away once the visitor has scrolled,
 * and it never shows when nothing follows the hero. `animated` loops the cue's motion (Plus with
 * motion on); otherwise it only fades in once. Reduced motion stops every loop (globals.css).
 */
export function ScrollCue({ cue, animated, color, accent, label, text, up = true, bottom }: { cue: CueId; animated: boolean; color: string; accent: string; label: string; /** Touch screens swipe up; wide screens scroll down. */ up?: boolean; /** Visible word for cues that carry one (Swipe, Caption, Credits). */ text: string; /** Pinned this far above the hero's foot (wide screens). Without it the cue sits in flow, under Connect. */ bottom?: number }) {
  const host = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const button = host.current;
    const hero = button?.closest<HTMLElement>("[data-hero], [data-wide-hero]") ?? button?.parentElement;
    const article = button?.closest("article");
    const content = article?.querySelector("[data-appearance-content]");
    // Nothing below the hero: no promise of more.
    if (!hero || !content || content.childElementCount === 0) { setVisible(false); return; }
    // The hero's top stretch leaving the view means the visitor has started scrolling.
    const sentinel = document.createElement("span");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = "position:absolute;left:0;top:0;width:1px;height:72px;pointer-events:none";
    hero.appendChild(sentinel);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] });
    observer.observe(sentinel);
    return () => { observer.disconnect(); sentinel.remove(); };
  }, []);
  const go = () => {
    const page = host.current?.closest("article")?.querySelector<HTMLElement>("[data-appearance-page]");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    page?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  return (
    <button
      aria-hidden={!visible}
      aria-label={label}
      className={`${bottom === undefined ? "relative mx-auto mt-1 items-start" : "absolute left-1/2 -translate-x-1/2 items-end"} z-[4] flex min-h-8 min-w-16 justify-center px-3 transition-opacity duration-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      data-scroll-cue={cue}
      data-scroll-cue-motion={animated ? "loop" : "still"}
      onClick={go}
      ref={host}
      style={{ bottom: bottom === undefined ? undefined : `calc(${bottom}px + var(--sv-foot, 0px))`, color, outlineColor: color }}
      tabIndex={visible ? 0 : -1}
      type="button"
    >
      <span className="block [animation:sv-cue-in_.8s_.6s_both]" data-sv-cue>
        <CueGlyph accent={accent} animated={animated} cue={cue} text={text} up={up} />
      </span>
    </button>
  );
}

const loop = (animated: boolean, value: string): CSSProperties => (animated ? { animation: value } : {});

function Chevron({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" fill="none" height={size * 0.6} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} style={{ display: "block", ...style }} viewBox="0 0 20 12" width={size}>
      <path d="M2 2l8 8 8-8" />
    </svg>
  );
}

/** The ten cues. Pure drawing, also used by the editor's picker tiles. */
export function CueGlyph({ cue, animated, accent, text, up = true }: { cue: CueId; animated: boolean; accent: string; text: string; up?: boolean }) {
  switch (cue) {
    case "glide":
      // Immersive: one fine chevron sliding down and fading, like breath on glass.
      return <Chevron size={22} style={loop(animated, "sv-cue-glide 2.2s ease-in-out infinite")} />;
    case "rail":
      // Motion: a thin rail with a light running down it, the marquee turned vertical.
      return (
        <span className="relative block h-5 w-[2px] overflow-hidden rounded-full" style={{ background: "currentColor", opacity: 0.9 }}>
          <span className="absolute inset-x-0 top-0 block h-2.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}`, transform: animated ? undefined : "translateY(6px)", ...loop(animated, "sv-cue-rail 1.6s cubic-bezier(.6,0,.4,1) infinite") }} />
        </span>
      );
    case "orb":
      // Aura: a soft glow drifting down and breathing.
      return <span className="block size-3 rounded-full" style={{ background: accent, boxShadow: `0 0 14px 4px ${accent}99`, ...loop(animated, "sv-cue-orb 2.8s ease-in-out infinite") }} />;
    case "mouse":
      // Clean: the quiet classic, a mouse with its wheel turning.
      return (
        <span className="relative block h-[22px] w-[15px] rounded-full border-[1.5px] border-current opacity-80">
          <span className="absolute left-1/2 top-[4px] block h-[4px] w-[2px] -translate-x-1/2 rounded-full bg-current" style={loop(animated, "sv-cue-wheel 1.8s ease-in-out infinite")} />
        </span>
      );
    case "beam":
      // Glow: the chevron in the accent, its glow swelling.
      return <Chevron size={20} style={{ color: accent, filter: `drop-shadow(0 0 6px ${accent})`, ...loop(animated, "sv-cue-beam 2.4s ease-in-out infinite") }} />;
    case "cascade":
      // Scene: three chevrons lighting in sequence, a path leading down into the world.
      return (
        <span className="flex flex-col items-center -space-y-[3px]">
          {[0, 1, 2].map((step) => <Chevron key={step} size={14} style={{ opacity: animated ? 0.4 : 0.35 + step * 0.3, ...loop(animated, `sv-cue-cascade 1.8s ${step * 0.2}s ease-in-out infinite`) }} />)}
        </span>
      );
    case "caption":
      // Frame: a gallery label, the rule under it drawing out.
      return (
        <span className="flex flex-col items-center gap-1.5">
          <span className="font-label text-[9px] font-semibold uppercase tracking-[0.32em] opacity-85">{text}</span>
          <span className="block h-px w-6 origin-center bg-current" style={loop(animated, "sv-cue-caption 2.6s ease-in-out infinite")} />
        </span>
      );
    case "cards":
      // Stack: three edges of a deck, dealt downward one after another.
      return (
        <span className="flex flex-col items-center gap-[3px]">
          {[22, 16, 10].map((width, step) => <span className="block h-[3px] rounded-full bg-current" key={width} style={{ width, opacity: 0.9 - step * 0.25, ...loop(animated, `sv-cue-card 1.8s ${step * 0.18}s ease-in-out infinite`) }} />)}
        </span>
      );
    case "swipe":
      // Social: a story-style pill, its arrow nudging up.
      return (
        <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold tracking-[-0.01em] backdrop-blur-md" style={{ background: "color-mix(in srgb, currentColor 15%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, currentColor 22%, transparent)" }}>
          <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} style={{ rotate: up ? undefined : "180deg", ...loop(animated, "sv-cue-swipe 1.5s ease-in-out infinite") }} viewBox="0 0 12 12" width="12"><path d="M6 10.5V1.5M2 5l4-3.5L10 5" /></svg>
          {text}
        </span>
      );
    case "credits":
      // Film: a letterspaced title card that flickers like a projector.
      return (
        <span className="flex flex-col items-center gap-1">
          <span className="font-label text-[9px] uppercase tracking-[0.42em]" style={loop(animated, "sv-cue-flicker 3.2s steps(1, end) infinite")}>{text}</span>
          <svg aria-hidden="true" height="5" viewBox="0 0 8 5" width="8"><path d="M0 0h8L4 5z" fill="currentColor" /></svg>
        </span>
      );
  }
}
