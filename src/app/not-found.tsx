import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Page not found | Setuvara" },
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#F5F4EF] px-6 py-16 text-[#0D0D0D]">
      <div className="max-w-md text-center">
        <p className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-black/50">Setuvara</p>
        <h1 className="mt-4 font-display text-5xl font-extrabold tracking-[-0.06em]">This page isn’t here.</h1>
        <p className="mt-4 text-base leading-7 text-black/60">The link may have changed, or the profile is not public right now.</p>
        <Link className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#0D0D0D] px-6 text-sm font-semibold text-[#F5F4EF]" href="/">Back to Setuvara</Link>
      </div>
    </main>
  );
}
