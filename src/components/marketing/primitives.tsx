import Link from "next/link";
import type { ReactNode } from "react";

export function MarketingContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function MarketingEyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0d0d0d]/55">{children}</p>;
}

export function MarketingAction({ children, href, secondary = false }: { children: ReactNode; href: string; secondary?: boolean }) {
  return (
    <Link
      className={secondary
        ? "inline-flex min-h-12 items-center justify-center rounded-full border border-[#0d0d0d]/20 px-5 text-sm font-semibold transition-colors hover:border-[#0d0d0d]/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff5a4f]"
        : "inline-flex min-h-12 items-center justify-center rounded-full bg-[#ff5a4f] px-5 text-sm font-semibold text-[#0d0d0d] transition-colors hover:bg-[#f34c42] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0d0d0d]"}
      href={href}
    >
      {children}
    </Link>
  );
}

export function MarketingRoutePage({ eyebrow, title, description, note }: { eyebrow: string; title: string; description: string; note?: string }) {
  return (
    <section className="flex min-h-[min(70vh,720px)] items-center py-20 sm:py-28">
      <MarketingContainer>
        <div className="max-w-3xl">
          <MarketingEyebrow>{eyebrow}</MarketingEyebrow>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-7xl">{title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#0d0d0d]/70 sm:text-xl sm:leading-9">{description}</p>
          {note ? <p className="mt-4 text-sm leading-6 text-[#0d0d0d]/55">{note}</p> : null}
          <div className="mt-9 flex flex-wrap gap-3">
            <MarketingAction href="/signup">Create your identity</MarketingAction>
            <MarketingAction href="/" secondary>Back to Setuvara</MarketingAction>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}
