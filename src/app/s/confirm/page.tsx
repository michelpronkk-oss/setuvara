import type { Metadata } from "next";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { ConfirmEntry } from "@/components/actions/confirm-entry";

export const metadata: Metadata = { title: "Confirm your entry · Setuvara", robots: { index: false, follow: false } };

/** Opened from the giveaway email. Confirming takes a press, so link scanners can't enter people. */
export default async function ConfirmEntryPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && /^[0-9a-f]{64}$/.test(token);
  return (
    <main className={`${marketingFontClasses} grid min-h-dvh place-items-center bg-[#F5F4EF] px-5 font-brand text-[#0D0D0D]`}>
      <div className="w-full max-w-[440px]">
        {valid ? <ConfirmEntry token={token} /> : (
          <>
            <h1 className="font-display text-[36px] font-bold leading-none tracking-[-0.05em]">This link doesn&apos;t work.</h1>
            <p className="mt-3 text-[16px] text-black/65">Open the newest email from Setuvara, or enter again.</p>
          </>
        )}
      </div>
    </main>
  );
}
