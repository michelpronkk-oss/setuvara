import Link from "next/link";
import type { ReactNode } from "react";

import { MeetMark, Wordmark } from "@/components/marketing/brand";

/** Split auth screen: an ink identity panel (desktop) beside the form. */
export function AuthLayout({ aside, children, switchLead, switchHref, switchCta }: {
  aside: ReactNode;
  children: ReactNode;
  switchLead: string;
  switchHref: string;
  switchCta: string;
}) {
  return (
    <div className="grid min-h-dvh bg-paper font-brand text-ink lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]">
      <aside className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-ink px-[clamp(40px,4vw,64px)] py-10 text-paper lg:flex lg:min-h-dvh">
        <MeetMark className="pointer-events-none absolute -bottom-[22%] -right-[18%] w-[78%] max-w-[720px] text-paper/5" />
        <Link aria-label="Setuvara home" className="relative inline-flex min-h-11 items-center gap-2.5 self-start rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral" href="/">
          <MeetMark className="size-7 text-coral" />
          <Wordmark className="text-[23px] leading-none" />
        </Link>
        <div className="relative flex max-w-[520px] flex-col gap-10">{aside}</div>
        <p className="relative font-label text-[11px] uppercase tracking-[0.14em] text-paper/50">Your identity. Your connections.</p>
      </aside>

      <main className="flex min-w-0 flex-col gap-8 px-5 pb-7 pt-4 sm:px-8 lg:px-[clamp(32px,4vw,64px)] lg:py-8">
        <div className="flex items-center justify-between gap-4 lg:justify-end">
          <Link aria-label="Setuvara home" className="inline-flex min-h-11 items-center gap-2 rounded-md lg:hidden" href="/">
            <MeetMark className="size-6" />
            <Wordmark className="text-[21px] leading-none" />
          </Link>
          <div className="flex items-center gap-3 text-[14px]">
            <span className="hidden text-ink/65 sm:inline">{switchLead}</span>
            <Link className="inline-flex h-10 items-center rounded-full px-4 font-semibold shadow-[inset_0_0_0_1.5px_#0d0d0d] transition-colors hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" href={switchHref}>{switchCta}</Link>
          </div>
        </div>

        <div className="flex flex-1 items-start justify-center pt-4 sm:items-center sm:pt-0">
          <div className="flex w-full max-w-[420px] flex-col gap-8">{children}</div>
        </div>

        <p className="text-[13px] text-ink/50">© {new Date().getFullYear()} Setuvara</p>
      </main>
    </div>
  );
}

export function AuthHeading({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h1 className="font-display text-[clamp(38px,9vw,44px)] font-extrabold leading-[0.95] tracking-[-0.05em]">{title}</h1>
      {children ? <p className="text-[16px] leading-[1.5] text-ink/70">{children}</p> : null}
    </div>
  );
}

export const fieldClass = "h-14 w-full min-w-0 rounded-2xl bg-white px-[18px] text-[16px] text-ink shadow-[inset_0_0_0_1px_rgba(13,13,13,.15)] outline-none transition-shadow placeholder:text-ink/35 focus:shadow-[inset_0_0_0_1.5px_#0d0d0d]";

export function Spinner() {
  return <span aria-hidden="true" className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}
