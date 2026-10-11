"use client";

import Link from "next/link";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { MemberBadge } from "@/components/app/status-badge";

/**
 * Bottom sheet on phones, centred card from 640px. Traps focus, closes on Escape or the backdrop,
 * locks page scroll and returns focus to the opener.
 */
export function PassportSheet({ label, onClose, children, tone = "paper", busy = false }: { label: string; onClose: () => void; children: ReactNode; tone?: "paper"; busy?: boolean }) {
  const panel = useRef<HTMLElement>(null);
  const busyRef = useRef(busy);
  const close = useRef(onClose);
  useEffect(() => { busyRef.current = busy; close.current = onClose; });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) { event.preventDefault(); close.current(); return; }
      trapTab(event, panel.current);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" data-passport-sheet={tone}>
      <div aria-hidden="true" className="absolute inset-0 bg-[#0D0D0D8C] [animation:fade-in_160ms_ease-out]" onMouseDown={() => { if (!busyRef.current) close.current(); }} />
      <section
        aria-label={label}
        aria-modal="true"
        className="relative flex max-h-[calc(100dvh-16px)] w-full flex-col overflow-y-auto overscroll-contain rounded-t-[28px] bg-[#F5F4EF] px-6 pb-[calc(34px+env(safe-area-inset-bottom))] pt-3 text-[#0D0D0D] outline-none [animation:sheet-up_220ms_ease-out] sm:max-h-[calc(100dvh-48px)] sm:max-w-[440px] sm:rounded-[28px] sm:pb-8 sm:pt-6"
        ref={panel}
        role="dialog"
        tabIndex={-1}
      >
        <span aria-hidden="true" className="h-[5px] w-10 shrink-0 self-center rounded-[9px] bg-[#0D0D0D33] sm:hidden" />
        <button aria-label="Close" className="absolute right-4 top-4 hidden size-11 place-items-center rounded-full text-[20px] leading-none hover:bg-[#0D0D0D0D] focus-visible:outline-2 focus-visible:outline-offset-2 sm:grid" onClick={() => close.current()} type="button"><span aria-hidden="true">×</span></button>
        {children}
      </section>
    </div>
  );
}

export function trapTab(event: KeyboardEvent, root: HTMLElement | null) {
  if (event.key !== "Tab" || !root) return;
  const items = [...root.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)")].filter((item) => item.offsetParent !== null);
  const first = items[0];
  const last = items.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

/** Contextual Plus sheet (16). Never blocks history: it only explains the presentation layer. */
export function PlusSheet({ onClose, now, withPlus }: { onClose: () => void; now: ReactNode; withPlus: ReactNode }) {
  const titleId = useId();
  return (
    <PassportSheet label="Setuvara Plus" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-end justify-center gap-[18px] pb-1 pt-3">
          <figure className="m-0 flex flex-col items-center gap-2">{now}<figcaption className="font-label text-[10px] tracking-[0.12em] text-[#0D0D0DB3]">YOURS NOW</figcaption></figure>
          <figure className="m-0 flex flex-col items-center gap-2">{withPlus}<figcaption className="font-label text-[10px] tracking-[0.12em] text-[#0D0D0DB3]">WITH PLUS</figcaption></figure>
        </div>
        <div className="flex items-center gap-2"><MemberBadge decorative size={22} tier="plus" /><span className="font-label text-[12px] tracking-[0.16em]">SETUVARA PLUS</span></div>
        <h2 className="font-display text-[36px] font-extrabold leading-[0.98] tracking-[-0.05em]" id={titleId}>Make your Passport feel like yours.</h2>
        <p className="text-[15px] leading-[1.5] text-[#0D0D0DB3]">Your stamps and milestones are already yours. Plus adds the Member finish to every cover you&apos;ve earned, and lets a stamp travel with your profile.</p>
        <div className="flex flex-col gap-2.5">
          <Link className="flex h-[52px] items-center justify-center rounded-full bg-[#FF5A4F] text-[16px] font-semibold text-[#0D0D0D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D]" href="/pricing">Unlock with Plus</Link>
          <button className="h-11 rounded-full text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2" onClick={onClose} type="button">Not now</button>
        </div>
        <p className="text-center font-label text-[10.5px] tracking-[0.1em] text-[#0D0D0DB3]">PROGRESS IS NEVER ON A PLAN</p>
      </div>
    </PassportSheet>
  );
}
