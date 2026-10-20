import type { Metadata } from "next";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { ConfirmEntry } from "@/components/actions/confirm-entry";
import { nameFontClasses } from "@/components/profile/name-fonts";
import { loadConfirmTarget } from "@/lib/actions/confirm";
import { actionThemeVars } from "@/lib/actions/theme";

export const metadata: Metadata = { title: "Confirm · Setuvara", robots: { index: false, follow: false } };

/**
 * Opened from the giveaway or newsletter email, in the Mode's own Appearance. Confirming takes a
 * press, so link scanners can't enter or subscribe people.
 */
export default async function ConfirmEntryPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && /^[0-9a-f]{64}$/.test(token);
  const target = valid ? await loadConfirmTarget(token) : null;
  const theme = target?.theme;
  return (
    <main className={`${marketingFontClasses} ${nameFontClasses} relative isolate grid min-h-dvh place-items-center overflow-hidden px-5 font-brand`} style={theme ? actionThemeVars(theme) : { background: "#F5F4EF", color: "#0D0D0D" }}>
      {target?.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- decorative wash of the Mode's own public photo
        <img alt="" aria-hidden="true" className="pointer-events-none absolute -inset-[15%] -z-10 size-[130%] max-w-none object-cover" src={target.photoUrl} style={{ filter: `blur(70px) saturate(1.3) brightness(${target.theme.light ? 1.1 : 0.5})`, opacity: target.theme.light ? 0.5 : 0.7 }} />
      )}
      <div className="w-full max-w-[440px]">
        {valid ? <ConfirmEntry target={target ? { kind: target.kind, title: target.title, name: target.name, backHref: target.backHref, heading: target.theme.heading, motion: target.theme.motion } : null} token={token} /> : (
          <>
            <h1 className="font-display text-[36px] font-bold leading-none tracking-[-0.05em]">This link doesn&apos;t work.</h1>
            <p className="mt-3 text-[16px] opacity-65">Open the newest email from Setuvara, or try again from the page.</p>
          </>
        )}
      </div>
    </main>
  );
}
