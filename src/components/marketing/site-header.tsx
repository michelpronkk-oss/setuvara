"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";

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

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const close = () => desktop.matches && setMenuOpen(false);
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className={`sticky top-0 z-50 transition-colors duration-300 ${menuOpen ? "text-paper" : "text-ink"}`}>
      {/* The blur lives on its own layer: backdrop-filter on the header would trap the fixed menu inside it. */}
      <div aria-hidden="true" className={`absolute inset-0 z-[1] border-b transition-colors duration-300 ${menuOpen ? "border-transparent bg-ink" : "border-ink/10 bg-paper/90 backdrop-blur-md supports-[backdrop-filter]:bg-paper/75"}`} />
      <div className="relative z-10 mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:min-h-[72px] lg:px-14">
        <Link aria-label="Setuvara home" className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-md ${focusRing}`} href="/" onClick={closeMenu}>
          <MeetMark className={`size-7 transition-colors duration-300 ${menuOpen ? "text-coral" : ""}`} />
          <Wordmark className="text-[23px] leading-none" />
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-5 md:flex lg:gap-8">
          {navigation.map((item) => (
            <Link className={`min-h-11 content-center rounded-sm text-[14px] font-medium text-ink/70 transition-colors hover:text-ink lg:text-[15px] ${focusRing}`} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-6 md:flex">
          <Link className={`hidden min-h-11 content-center rounded-sm text-[15px] font-medium text-ink/70 transition-colors hover:text-ink lg:block ${focusRing}`} href="/login">Log in</Link>
          <Link className={`group inline-flex min-h-11 items-center gap-2 rounded-full bg-ink pl-5 pr-4 text-[14px] font-semibold text-paper transition-colors hover:bg-[#262626] lg:text-[15px] ${focusRing}`} href="/signup">
            Get Setuvara
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
          </Link>
        </div>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          className={`relative inline-flex size-11 items-center justify-center rounded-full transition-colors duration-300 md:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${menuOpen ? "bg-paper/10" : "bg-ink/[0.06]"}`}
          onClick={() => setMenuOpen((open) => !open)}
          ref={menuButton}
          type="button"
        >
          <span aria-hidden="true" className={`absolute h-[1.75px] w-[18px] rounded-full bg-current transition-transform duration-500 ease-[cubic-bezier(.7,0,.2,1)] ${menuOpen ? "rotate-45" : "-translate-y-[4px]"}`} />
          <span aria-hidden="true" className={`absolute h-[1.75px] w-[18px] rounded-full bg-current transition-transform duration-500 ease-[cubic-bezier(.7,0,.2,1)] ${menuOpen ? "-rotate-45" : "translate-y-[4px]"}`} />
        </button>
      </div>

      <nav
        aria-hidden={!menuOpen}
        aria-label="Mobile navigation"
        className={`mobile-menu fixed inset-0 z-0 flex flex-col bg-ink px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-24 text-paper md:hidden ${menuOpen ? "is-open" : ""}`}
        id="mobile-navigation"
        inert={!menuOpen}
      >
        <ul className="flex flex-col">
          {navigation.map((item, index) => (
            <li className="mobile-menu-item border-b border-paper/10" key={item.href} style={{ "--i": index } as CSSProperties}>
              <Link className="group flex min-h-[68px] items-center justify-between focus-visible:outline-2 focus-visible:outline-coral" href={item.href} onClick={closeMenu}>
                <span className="flex items-baseline gap-4">
                  <span className="font-label text-[11px] tracking-[0.14em] text-coral">0{index + 1}</span>
                  <span className="font-display text-[34px] font-bold leading-none tracking-[-0.045em]">{item.label}</span>
                </span>
                <span aria-hidden="true" className="text-[18px] text-paper/35 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-coral">→</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mobile-menu-item mt-auto flex flex-col gap-3" style={{ "--i": navigation.length } as CSSProperties}>
          <Link className="flex h-14 items-center justify-center gap-2 rounded-full bg-coral text-[16px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper" href="/signup" onClick={closeMenu}>
            Create your Setuvara <span aria-hidden="true">→</span>
          </Link>
          <Link className="flex h-14 items-center justify-center rounded-full text-[15px] font-semibold text-paper/80 shadow-[inset_0_0_0_1px_rgba(245,244,239,.18)] focus-visible:outline-2 focus-visible:outline-coral" href="/login" onClick={closeMenu}>
            Log in
          </Link>
          <p className="mt-3 text-center font-label text-[10px] uppercase tracking-[0.18em] text-paper/35">One identity. Every version of you.</p>
        </div>
      </nav>
    </header>
  );
}
