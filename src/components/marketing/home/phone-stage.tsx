import type { ReactNode } from "react";

import type { DemoMode } from "./demo";

/**
 * Backdrops for the cast's phones, sampled from each person's photo: Aanya's sky-blue wall and red
 * tee, Theo's lime studio, Lucas's warm grey with the coral of his Glow look. Soft colour fields
 * drift slowly behind the phone and stand still for visitors who prefer reduced motion.
 */
export const STAGE_PALETTES: Record<DemoMode["slug"], { base: string; a: string; b: string; c: string }> = {
  personal: { base: "#dce8fa", a: "#72a7e7", b: "#b9d4fb", c: "#ff7d70" },
  event: { base: "#efffc9", a: "#c5ff47", b: "#8fdc4e", c: "#fbffe8" },
  business: { base: "#f1ebe4", a: "#ff8a7a", b: "#ddd2c4", c: "#fff7ef" },
};

const NOISE = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}")`;

const DEFERRED_DRIFT_STYLE = { animationDelay: "1500ms", animationFillMode: "backwards" as const };

/** The drifting colour fields alone, for a caller that supplies its own frame (e.g. the hero aura). */
export function StageField({ slug, className = "", deferDrift = false }: { slug: DemoMode["slug"]; className?: string; deferDrift?: boolean }) {
  const palette = STAGE_PALETTES[slug];
  const driftStyle = deferDrift ? DEFERRED_DRIFT_STYLE : {};
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} style={{ background: palette.base }}>
      <span className="absolute -left-[20%] -top-[15%] size-[85%] rounded-full opacity-90 blur-[60px] [animation:sv-drift-a_19s_ease-in-out_infinite_alternate]" style={{ background: palette.a, ...driftStyle }} />
      <span className="absolute -bottom-[20%] -right-[25%] size-[90%] rounded-full opacity-80 blur-[70px] [animation:sv-drift-b_23s_ease-in-out_infinite_alternate]" style={{ background: palette.b, ...driftStyle }} />
      <span className="absolute left-[30%] top-[38%] size-[45%] rounded-full opacity-60 blur-[50px] [animation:sv-drift-c_17s_ease-in-out_infinite_alternate]" style={{ background: palette.c, ...driftStyle }} />
      {/* A fine grain keeps the gradients from banding and gives the stage a printed feel. */}
      <span className="absolute inset-0 opacity-[.22] mix-blend-soft-light" style={{ backgroundImage: NOISE }} />
    </span>
  );
}

/** A rounded stage in the phone's own colours, with the phone centred on it. */
export function PhoneStage({ slug, className = "", children }: { slug: DemoMode["slug"]; className?: string; children: ReactNode }) {
  return (
    <div className={`relative isolate grid place-items-center overflow-hidden ${className}`}>
      <StageField slug={slug} className="-z-10" />
      {children}
    </div>
  );
}
