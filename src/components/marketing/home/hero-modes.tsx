"use client";

import { useEffect, useState, type ReactNode } from "react";

const labels = ["Personal", "Event", "Business"] as const;

/**
 * The hero's only interactive piece: three server-rendered Mode profiles fanned
 * around one identity. It cycles on its own until the visitor picks a Mode, and
 * never auto-advances for visitors who prefer reduced motion.
 */
export function HeroModes({ cards, name }: { cards: [ReactNode, ReactNode, ReactNode]; name: string }) {
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
      <div aria-label={`${name}’s Modes`} className="flex rounded-full bg-ink p-1 text-paper" role="group">
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

      <div className="relative h-[452px] w-full [--fan-x:56px] min-[420px]:[--fan-x:72px] sm:h-[480px] sm:[--fan-x:150px] lg:[--fan-x:118px] xl:[--fan-x:148px]">
        {cards.map((card, index) => {
          const relative = ((index - active + 4) % 3) - 1;
          const front = relative === 0;
          return (
            <div
              aria-hidden={!front}
              className="mode-panel absolute left-1/2 top-0 h-[440px] w-[min(272px,72vw)] sm:h-[468px] sm:w-[292px]"
              inert={!front}
              key={labels[index]}
              style={{
                transform: `translateX(calc(-50% + ${relative} * var(--fan-x))) translateY(${front ? 0 : 18}px) rotate(${relative * 5}deg) scale(${front ? 1 : 0.9})`,
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

      <p className="font-label text-[11px] uppercase tracking-[0.16em] text-ink/55">Same {name} · Different context</p>
    </div>
  );
}
