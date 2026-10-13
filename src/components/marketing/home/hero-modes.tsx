"use client";

import { useEffect, useState, type ReactNode } from "react";

import { StageField } from "./phone-stage";

const labels = ["Personal", "Event", "Business"] as const;
const slugs = ["personal", "event", "business"] as const;

/**
 * The hero's only interactive piece: three server-rendered Mode profiles fanned
 * around one identity. It cycles on its own until the visitor picks a Mode, and
 * never auto-advances for visitors who prefer reduced motion.
 */
export function HeroModes({ cards, caption }: { cards: [ReactNode, ReactNode, ReactNode]; caption: string }) {
  const [active, setActive] = useState(1);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setActive((current) => (current + 1) % 3);
    }, 3600);
    return () => window.clearInterval(timer);
  }, [held]);

  function choose(index: number) {
    setHeld(true);
    setActive(index);
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div aria-label="Modes" className="flex rounded-full bg-ink p-1 text-paper" role="group">
        {labels.map((label, index) => (
          <button
            aria-pressed={active === index}
            className={`min-h-10 rounded-full px-4 text-[13px] font-semibold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral sm:px-5 ${active === index ? "bg-paper text-ink" : "text-paper/70 hover:text-paper"}`}
            key={label}
            onClick={() => choose(index)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative h-[452px] w-full [--fan-x:54px] [--s:.74] min-[420px]:[--fan-x:66px] sm:h-[530px] sm:[--fan-x:170px] sm:[--s:.86] lg:h-[610px] lg:[--fan-x:236px] lg:[--s:1]">
        {/* A soft aura in the front phone's own colours, fading over as the Mode changes. */}
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[-6%] h-[112%] w-[min(150%,1100px)] -translate-x-1/2 [mask-image:radial-gradient(closest-side,#000_35%,transparent)]">
          {slugs.map((slug, index) => <StageField className={`transition-opacity duration-1000 ${active === index ? "opacity-100" : "opacity-0"}`} deferDrift key={slug} slug={slug} />)}
        </div>
        {cards.map((card, index) => {
          const relative = ((index - active + 4) % 3) - 1;
          const front = relative === 0;
          return (
            <div
              aria-hidden={!front}
              className="mode-panel absolute left-1/2 top-0 origin-top"
              inert={!front}
              key={labels[index]}
              style={{
                transform: `translateX(calc(-50% + ${relative} * var(--fan-x))) translateY(${front ? 0 : 22}px) rotate(${relative * 6}deg) scale(calc(var(--s) * ${front ? 1 : 0.88}))`,
                zIndex: front ? 3 : 1,
                filter: front ? "none" : "saturate(.75)",
                opacity: front ? 1 : 0.92,
              }}
            >
              {card}
            </div>
          );
        })}
      </div>

      <p className="font-label text-[11px] uppercase tracking-[0.16em] text-ink/55">{caption}</p>
    </div>
  );
}
