import type { Metadata } from "next";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { Unsubscribe } from "@/components/audience/unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe · Setuvara", robots: { index: false, follow: false } };

/** Opened from a campaign email. Leaving takes one press; the link alone changes nothing. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; preview?: string }> }) {
  const { t, preview } = await searchParams;
  const token = typeof t === "string" && t.length <= 80 && /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{32}$/.test(t) ? t : null;
  return (
    <main className={`${marketingFontClasses} grid min-h-dvh place-items-center bg-[#F5F4EF] px-5 font-brand text-[#0D0D0D]`}>
      <div className="w-full max-w-[440px]">
        {token ? <Unsubscribe token={token} /> : (
          <>
            <h1 className="font-display text-[36px] font-bold leading-none tracking-[-0.05em]">{preview ? "This is a test email." : "This link doesn't work."}</h1>
            <p className="mt-3 text-[16px] text-black/65">{preview ? "In a real campaign, this is where readers leave your list with one press." : "Open the newest email you got, and use the unsubscribe link at the bottom."}</p>
          </>
        )}
      </div>
    </main>
  );
}
