"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { MeetMark, Wordmark } from "./brand";

const navigation = [
  { href: "/#product", label: "Product" },
  { href: "/#modes", label: "Modes" },
  { href: "/events", label: "For Events" },
  { href: "/teams", label: "For Teams" },
  { href: "/pricing", label: "Pricing" },
];

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/95 backdrop-blur-sm supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:min-h-[72px] lg:px-14">
        <Link aria-label="Setuvara home" className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-md ${focusRing}`} href="/" onClick={closeMenu}>
          <MeetMark className="size-7" />
          <Wordmark className="text-[23px] leading-none" />
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-5 md:flex lg:gap-8">
          {navigation.map((item) => (
            <Link className={`min-h-11 content-center rounded-sm text-[14px] font-medium text-ink/75 transition-colors hover:text-ink lg:text-[15px] ${focusRing}`} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-5">
          <Link className={`hidden min-h-11 content-center rounded-sm text-[15px] font-medium lg:block ${focusRing}`} href="/login">Log in</Link>
          <Link className={`inline-flex min-h-11 items-center justify-center rounded-full bg-coral px-4 text-[14px] font-semibold text-ink transition-colors hover:bg-[#f34c42] sm:px-5 sm:text-[15px] ${focusRing}`} href="/signup" onClick={closeMenu}>
            Get Setuvara
          </Link>
          <button
            aria-controls="mobile-navigation"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="inline-flex size-11 items-center justify-center rounded-full border border-ink/15 md:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
            onClick={() => setMenuOpen((open) => !open)}
            ref={menuButton}
            type="button"
          >
            <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
              {menuOpen ? <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /> : <path d="M4 8h16M4 16h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />}
            </svg>
          </button>
        </div>
      </div>

      <nav aria-label="Mobile navigation" className="absolute inset-x-0 top-full border-b border-ink/10 bg-paper px-5 pb-6 pt-2 shadow-[0_24px_40px_-24px_rgba(13,13,13,.35)] md:hidden" hidden={!menuOpen} id="mobile-navigation">
        <ul>
          {navigation.map((item) => (
            <li key={item.href}>
              <Link className="flex min-h-14 items-center justify-between border-b border-ink/10 font-display text-[28px] font-bold tracking-[-0.04em] focus-visible:outline-2 focus-visible:outline-coral" href={item.href} onClick={closeMenu}>
                {item.label}
                <span aria-hidden="true" className="font-brand text-base font-medium text-ink/40">→</span>
              </Link>
            </li>
          ))}
          <li className="flex items-center gap-5 pt-5">
            <Link className="inline-flex min-h-11 items-center text-[15px] font-semibold" href="/login" onClick={closeMenu}>Log in</Link>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-[15px] font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" href="/signup" onClick={closeMenu}>Create your Setuvara</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
