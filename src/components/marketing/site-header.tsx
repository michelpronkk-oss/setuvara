"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const navigation = [
  { href: "/#product", label: "Product" },
  { href: "/#modes", label: "Modes" },
  { href: "/events", label: "Events" },
  { href: "/teams", label: "Teams" },
  { href: "/pricing", label: "Pricing" },
];

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
    <header className="border-b border-[#0d0d0d]/10">
      <div className="mx-auto flex min-h-[76px] w-full max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          aria-label="Setuvara home"
          className="inline-flex min-h-11 items-center text-[15px] font-bold lowercase tracking-[0.18em]"
          href="/"
          onClick={closeMenu}
        >
          setuvara
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-7 md:flex">
          {navigation.map((item) => (
            <Link className="min-h-11 content-center text-sm font-medium text-[#0d0d0d]/70 transition-colors hover:text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff5a4f]" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 md:flex">
          <Link className="min-h-11 content-center text-sm font-semibold" href="/login">Log in</Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#ff5a4f] px-5 text-sm font-semibold text-[#0d0d0d] transition-colors hover:bg-[#f34c42] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0d0d0d]" href="/signup">
            Get Setuvara
          </Link>
        </div>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="inline-flex size-11 items-center justify-center rounded-full border border-[#0d0d0d]/15 md:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a4f]"
          onClick={() => setMenuOpen((open) => !open)}
          ref={menuButton}
          type="button"
        >
          <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
            {menuOpen ? <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /> : <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />}
          </svg>
        </button>
      </div>

      <nav aria-label="Mobile navigation" className="border-t border-[#0d0d0d]/10 px-5 py-3 md:hidden" hidden={!menuOpen} id="mobile-navigation">
        <ul className="mx-auto max-w-7xl">
          {navigation.map((item) => (
            <li key={item.href}>
              <Link className="flex min-h-12 items-center border-b border-[#0d0d0d]/10 text-base font-medium focus-visible:outline-2 focus-visible:outline-[#ff5a4f]" href={item.href} onClick={closeMenu}>
                {item.label}
              </Link>
            </li>
          ))}
          <li className="flex items-center gap-5 pt-3">
            <Link className="inline-flex min-h-11 items-center text-sm font-semibold" href="/login" onClick={closeMenu}>Log in</Link>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#ff5a4f] px-5 text-sm font-semibold text-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d0d0d]" href="/signup" onClick={closeMenu}>Get Setuvara</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
