"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * The owner opening their own link sees exactly what visitors see. The only extra is this bar,
 * above the page and never inside it, so nothing owner-only ever reads as part of the profile.
 */
export function OwnerBar({ editHref, shareHref }: { editHref: string; shareHref: string }) {
  const chip = "inline-flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4EF]";
  return (
    <div className="relative z-[60] flex min-h-[52px] items-center justify-between gap-3 bg-[#0D0D0D] py-1.5 pl-4 pr-2 text-[#F5F4EF] sm:pl-6 sm:pr-3" data-owner-bar>
      <p className="flex min-w-0 items-center gap-2 text-[13px] font-medium"><span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#2BB673]" /><span className="truncate"><span className="font-semibold">Your live page</span><span className="text-[#F5F4EF]/60 max-sm:hidden"> · exactly what visitors see</span></span></p>
      <div className="flex shrink-0 items-center gap-1">
        <Link className={`${chip} text-[#F5F4EF]/80 hover:text-[#F5F4EF]`} href={shareHref}>Share</Link>
        <Link className={`${chip} bg-[#F5F4EF] text-[#0D0D0D] hover:bg-white`} href={editHref}>Edit</Link>
      </div>
    </div>
  );
}

/** The visitor's Connect, as the owner sees it on their own page: it explains instead of connecting. */
export function OwnerConnect({ label }: { label: string }) {
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(false), 2200);
    return () => window.clearTimeout(timer);
  }, [hint]);
  return (
    <button aria-live="polite" className="inline-flex h-[var(--sv-connect-h,52px)] w-[var(--sv-connect-w,100%)] min-w-11 items-center justify-[var(--sv-connect-justify,center)] gap-2.5 rounded-[var(--sv-connect-radius,999px)] bg-[var(--sv-connect-fill)] px-[var(--sv-connect-px,20px)] text-[16px] font-semibold text-[var(--sv-connect-ink)] shadow-[var(--sv-connect-edge,none)] after:content-[var(--sv-connect-arrow,none)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sv-focus,#0d0d0d)]" data-connect-trigger onClick={() => setHint(true)} type="button">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[var(--sv-connect-dot,transparent)] [display:var(--sv-connect-dot-display,none)]" />
      <span className="truncate">{hint ? "Visitors connect here" : label}</span>
    </button>
  );
}
