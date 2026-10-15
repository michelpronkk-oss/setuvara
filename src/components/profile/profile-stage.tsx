import type { CSSProperties, ReactNode } from "react";

/**
 * The public profile on a large screen: the same composition visitors see on their phone, set as
 * one wider card in the middle of the window, over a soft wash of the profile's own photo. Below
 * `lg` it adds nothing, so phones and tablets render exactly as before. The card itself stays
 * clean: the Appearance's blurred photo atmosphere lives only behind it, never inside.
 */
export function ProfileStage({ photo, base, accent, dark, children }: { photo: string | null; base: string; accent: string; dark: boolean; children: ReactNode }) {
  return (
    <div className="relative lg:px-6 lg:py-6" data-profile-stage>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 hidden overflow-hidden lg:block" data-profile-backdrop style={{ background: photo ? base : `radial-gradient(120% 90% at 50% 0%, ${accent}66, ${base} 70%)` }}>
        {/* The hero's own image (already cached), never a second face in focus: only its colour. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative wash of the page's own photo */}
        {photo && <img alt="" className="absolute -inset-[8%] size-[116%] max-w-none object-cover" decoding="async" src={photo} style={{ filter: `blur(64px) saturate(1.25) brightness(${dark ? 0.62 : 1.05})` }} />}
        <div className="absolute inset-0" style={{ background: dark ? "linear-gradient(180deg,#0D0D0D33,#0D0D0D80)" : "linear-gradient(180deg,#F5F4EF33,#F5F4EF99)" }} />
      </div>
      <div
        className="relative lg:mx-auto lg:w-[min(clamp(600px,34vw,760px),100%)] lg:[--profile-vh:calc(100svh-48px)] lg:[&>article]:min-h-[calc(100svh-48px)] lg:[&_[data-appearance-environment]]:hidden lg:[&>article]:rounded-[32px] lg:[&>article]:shadow-[var(--sv-stage-shadow)]"
        style={{ "--sv-stage-shadow": dark ? "0 0 0 1px #FFFFFF14, 0 40px 120px -30px #000000E6" : "0 0 0 1px #0D0D0D12, 0 40px 120px -40px #0D0D0D66" } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
