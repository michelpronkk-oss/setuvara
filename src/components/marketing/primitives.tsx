import Link from "next/link";
import type { ReactNode } from "react";

import { MeetMark } from "./brand";

export function MarketingContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-14 ${className}`}>{children}</div>;
}

export function MarketingEyebrow({ children }: { children: ReactNode }) {
  return <p className="font-label text-[11px] font-medium uppercase tracking-[0.16em] text-coral">{children}</p>;
}

export function MarketingAction({ children, href, secondary = false }: { children: ReactNode; href: string; secondary?: boolean }) {
  return (
    <Link
      className={secondary
        ? "inline-flex min-h-12 items-center justify-center rounded-full border border-ink/20 px-5 text-[15px] font-semibold transition-colors hover:border-ink/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
        : "inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 text-[15px] font-semibold text-paper transition-colors hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"}
      href={href}
    >
      {children}
    </Link>
  );
}

export function MarketingRoutePage({ eyebrow, title, description, note }: { eyebrow: string; title: string; description: string; note?: string }) {
  return (
    <section className="relative flex min-h-[min(78vh,780px)] items-center overflow-hidden py-20 sm:py-28">
      <MeetMark className="pointer-events-none absolute -right-[18%] top-1/2 hidden w-[min(52vw,640px)] -translate-y-1/2 text-ink/[0.045] md:block" />
      <MarketingContainer className="relative">
        <div className="max-w-5xl">
          <MarketingEyebrow>{eyebrow}</MarketingEyebrow>
          <h1 className="mt-6 max-w-5xl text-balance font-display text-[clamp(46px,6.2vw,96px)] font-extrabold leading-[0.88] tracking-[-0.055em]">{title}</h1>
          <p className="mt-8 max-w-2xl text-[18px] leading-[1.55] text-ink/70 sm:text-[21px]">{description}</p>
          {note ? <p className="mt-4 text-sm leading-6 text-ink/55">{note}</p> : null}
          <div className="mt-10 flex flex-wrap gap-3">
            <MarketingAction href="/signup">Create your Setuvara</MarketingAction>
            <MarketingAction href="/" secondary>Back to Setuvara</MarketingAction>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}
