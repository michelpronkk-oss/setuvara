"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { MeetMark } from "@/components/marketing/brand";
import type { ModeSlug } from "@/components/profile/types";
import { NavIcon, type GlobalIconName } from "./nav-icons";
import { MODE_DOT, MODE_NAMES, MODE_ORDER, modeTools, type ModePage } from "./side-nav";

/**
 * Phone navigation, the same on every signed-in page: a floating bar for Setuvara itself at the bottom,
 * and inside a Mode a compact header with the Mode picker and one strip of its sections and tools.
 */

const TABS: { href: string; label: string; icon: GlobalIconName; match: (path: string) => boolean }[] = [
  { href: "/app", label: "Home", icon: "home", match: (path) => path === "/app" },
  { href: "/app/identity", label: "Modes", icon: "identity", match: (path) => path === "/app/identity" || path.startsWith("/app/identity/") },
  { href: "/app/connections", label: "People", icon: "people", match: (path) => path.startsWith("/app/connections") },
  { href: "/app/passport", label: "Passport", icon: "passport", match: (path) => path.startsWith("/app/passport") },
  { href: "/app/analytics", label: "Analytics", icon: "analytics", match: (path) => path.startsWith("/app/analytics") },
];

/** Room to leave under a page so its last line clears the floating bar. */
export const MOBILE_BAR_SPACE = "pb-[calc(96px+env(safe-area-inset-bottom))]";

export function MobileTabBar({ unread = 0, pendingPath = null }: { unread?: number; pendingPath?: string | null }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Setuvara" className="print:hidden fixed inset-x-3 bottom-[calc(10px+env(safe-area-inset-bottom))] z-40 mx-auto grid h-[62px] max-w-[440px] grid-cols-5 rounded-[24px] bg-[#0D0D0D]/[0.94] px-1 text-[#F5F4EF] shadow-[0_18px_44px_-14px_rgba(13,13,13,.55),inset_0_0_0_1px_rgba(245,244,239,.08)] backdrop-blur-xl backdrop-saturate-150 lg:hidden">
      {TABS.map((tab) => {
        const current = tab.match(pathname);
        const lit = tab.match(pendingPath ?? pathname);
        return (
          <Link aria-current={current ? "page" : undefined} className={`relative flex min-w-0 flex-col items-center justify-center gap-[3px] rounded-[18px] text-[10.5px] leading-none tracking-[-0.005em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#F5F4EF] ${lit ? "font-semibold text-[#F5F4EF]" : "font-medium text-[#F5F4EF]/50"}`} href={tab.href} key={tab.href}>
            <span className={`relative grid h-[30px] w-11 place-items-center rounded-full transition-[background-color,color,transform] duration-200 active:scale-90 ${lit ? "bg-white/[0.11] text-[#FF5A4F]" : ""}`}>
              <NavIcon className="size-[20px]" name={tab.icon} />
              {tab.label === "People" && unread > 0 && <span aria-hidden="true" className="absolute -right-0.5 -top-1 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-[#FF5A4F] px-1 text-[9.5px] font-bold text-white ring-2 ring-[#0D0D0D]">{unread > 99 ? "99+" : unread}</span>}
            </span>
            <span className="max-w-full truncate">{tab.label}{tab.label === "People" && unread > 0 && <span className="sr-only">, {unread} unread</span>}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** A Mode's own page sections, the first part of its strip. */
const SECTIONS: { id: ModePage | "home" | "profile" | "links" | "appearance" | "share" | "settings-page"; label: string; section: string }[] = [
  { id: "overview", label: "Overview", section: "home" },
  { id: "profile", label: "Profile", section: "profile" },
  { id: "links", label: "Content", section: "links" },
  { id: "appearance", label: "Appearance", section: "appearance" },
  { id: "share", label: "Share", section: "share" },
  { id: "settings-page", label: "Settings", section: "settings" },
];
export type MobileModePlace = ModePage | "profile" | "links" | "appearance" | "share" | "settings-page";
export const sectionPlace = (section: string): MobileModePlace => (SECTIONS.find((item) => item.section === section)?.id ?? "overview") as MobileModePlace;

/**
 * Inside a Mode on a phone: the Mode (tap to switch), what's open, and every section and tool of the Mode
 * in one swipeable strip. In the editor, sections and Modes switch in place through the callbacks.
 */
export function MobileModeHeader({ slug, modes, place, right, below, onSection, onMode }: {
  slug: ModeSlug;
  modes: { slug: ModeSlug; enabled: boolean }[];
  place: MobileModePlace;
  right?: ReactNode;
  below?: ReactNode;
  onSection?: (section: string) => void;
  onMode?: (slug: ModeSlug) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const strip = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const tools = modeTools(slug).flat();
  const items = [
    ...SECTIONS.map((item) => ({ id: item.id as string, label: item.label, href: `/app/identity?mode=${slug}${item.section === "home" ? "" : `&section=${item.section}`}`, section: item.section })),
    ...tools.map((tool) => ({ id: tool.id as string, label: tool.label, href: tool.href, section: null as string | null })),
  ];
  const current = items.find((item) => item.id === place);
  const enabled = modes.find((mode) => mode.slug === slug)?.enabled ?? true;

  // Keep the open item in view in the strip.
  useEffect(() => {
    const node = strip.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (node && strip.current) strip.current.scrollTo({ left: Math.max(0, node.offsetLeft - (strip.current.clientWidth - node.offsetWidth) / 2), behavior: "instant" as ScrollBehavior });
  }, [place, slug]);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
  }, [open]);

  const go = (item: (typeof items)[number]) => (event: MouseEvent) => {
    if (!onSection || !item.section || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    onSection(item.section);
  };

  return (
    <header className="print:hidden sticky top-0 z-40 bg-[#F5F4EF]/90 backdrop-blur-xl backdrop-saturate-150 lg:hidden">
      <div className="flex h-14 items-center gap-2 px-3" ref={root}>
        <Link aria-label="Setuvara Home" className="grid size-10 shrink-0 place-items-center rounded-full transition hover:bg-black/[0.05] focus-visible:outline-2" href="/app"><MeetMark className="size-[22px]" /></Link>
        <div className="relative min-w-0 flex-1">
          <button aria-controls={open ? menuId : undefined} aria-expanded={open} aria-haspopup="menu" className="flex min-h-11 max-w-full items-center gap-2 rounded-full pl-1 pr-2.5 text-left transition hover:bg-black/[0.04] focus-visible:outline-2" onClick={() => setOpen((value) => !value)} type="button">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: MODE_DOT[slug], opacity: enabled ? 1 : 0.4 }} />
            <span className="min-w-0 leading-none">
              <span className="block truncate font-display text-[18px] font-bold tracking-[-0.035em]">{MODE_NAMES[slug]}<span className="sr-only">{current ? `, ${current.label}` : ""}</span></span>
            </span>
            <svg aria-hidden="true" className={`size-3.5 shrink-0 text-black/45 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {open && (
            <div aria-label="Switch Mode" className="absolute left-0 top-[calc(100%+6px)] z-50 w-[min(280px,calc(100vw-24px))] rounded-[22px] bg-white p-1.5 shadow-[0_24px_60px_-20px_rgba(13,13,13,.4),0_0_0_1px_rgba(13,13,13,.08)] [animation:fade-in_120ms_ease-out]" id={menuId} role="menu">
              {MODE_ORDER.filter((item) => modes.some((mode) => mode.slug === item)).map((item) => {
                const on = item === slug;
                const itemEnabled = modes.find((mode) => mode.slug === item)?.enabled;
                return (
                  <Link aria-current={on ? "true" : undefined} className={`flex min-h-12 items-center gap-3 rounded-[16px] px-3.5 text-[15px] transition-colors ${on ? "bg-[#F5F4EF] font-semibold" : "font-medium hover:bg-black/[0.03]"}`} href={`/app/identity?mode=${item}`} key={item} onClick={(event) => { setOpen(false); if (onMode && !event.metaKey) { event.preventDefault(); onMode(item); } }} role="menuitem">
                    <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: MODE_DOT[item], opacity: itemEnabled ? 1 : 0.4 }} />
                    <span className="flex-1">{MODE_NAMES[item]}</span>
                    <span className="font-label text-[10px] uppercase tracking-[0.12em] text-black/40">{itemEnabled ? "On" : "Off"}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        {right}
      </div>
      <nav aria-label={`${MODE_NAMES[slug]} Mode`} className="relative">
        <div className="flex gap-1 overflow-x-auto px-3 pb-2.5 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" ref={strip}>
          {items.map((item, index) => {
            const on = item.id === place;
            return (
              <span className="flex shrink-0 items-center" key={item.id}>
                {index === SECTIONS.length && <span aria-hidden="true" className="mx-1.5 h-5 w-px bg-black/12" />}
                <Link aria-current={on ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-full px-3.5 text-[13.5px] transition-colors focus-visible:outline-2 ${on ? "bg-[#0D0D0D] font-semibold text-[#F5F4EF]" : "font-medium text-black/62 hover:bg-black/[0.05] hover:text-black"}`} href={item.href} onClick={go(item)}>{item.label}</Link>
              </span>
            );
          })}
        </div>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-[#F5F4EF] to-transparent" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#F5F4EF] to-transparent" />
      </nav>
      {below}
      <div aria-hidden="true" className="h-px bg-black/[0.07]" />
    </header>
  );
}
