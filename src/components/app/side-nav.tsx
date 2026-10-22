"use client";

import Link from "next/link";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

import { MeetMark } from "@/components/marketing/brand";
import type { ModeSlug } from "@/components/profile/types";
import { EventsIcon, LeadsIcon, NavIcon, StudioIcon, TeamIcon, TestimonialsIcon, type GlobalIconName, type StudioPageId } from "./nav-icons";

/**
 * The one sidebar for the signed-in app, on every desktop page. Three layers, always in the same place:
 * Setuvara (what spans every Mode), the four Modes with the open Mode's tools, and the account at the foot.
 */

export const MODE_ORDER: ModeSlug[] = ["personal", "event", "business", "creator"];
export const MODE_NAMES: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" };
export const MODE_DOT: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF", creator: "#E8A6FF" };

export type GlobalPage = "home" | "connections" | "passport" | "analytics" | "wallet" | "settings" | "other";
export type ModePage = "overview" | "events" | "leads" | "testimonials" | "builder" | "team" | "actions" | "audience" | StudioPageId;
/** Where the member is: a Setuvara-wide page, or a page inside one Mode. */
export type NavPlace = { global: GlobalPage } | { mode: ModeSlug; page: ModePage };

type Tool = { id: ModePage; label: string; href: string; icon: ReactNode; badge?: boolean };
const studio = (id: StudioPageId, label: string, href: string, badge = false): Tool => ({ id, label, href, icon: <StudioIcon name={id} />, badge });

/** Each Mode's tools, grouped by what they're for. Every entry is an existing route. */
export function modeTools(slug: ModeSlug): Tool[][] {
  const actions = (badge: boolean) => studio("actions", "Actions", slug === "creator" ? "/app/identity/creator/actions" : `/app/identity/actions?mode=${slug}`, badge);
  const audience = studio("audience", "Audience", slug === "creator" ? "/app/identity/creator/audience" : `/app/identity/audience?mode=${slug}`);
  if (slug === "business") return [
    [{ id: "leads", label: "Leads", href: "/app/identity/leads", icon: <LeadsIcon /> }, { id: "testimonials", label: "Testimonials", href: "/app/identity/testimonials", icon: <TestimonialsIcon /> }, studio("builder", "Builder", "/app/identity/builder?mode=business"), { id: "team", label: "Team", href: "/app/identity/team", icon: <TeamIcon /> }],
    [actions(true), audience],
  ];
  if (slug === "creator") return [
    [studio("work", "Work", "/app/identity/creator/work"), studio("commerce", "Commerce", "/app/identity/creator/commerce"), studio("collabs", "Deals", "/app/identity/creator/collabs"), studio("builder", "Builder", "/app/identity/creator/builder"), studio("kit", "Media kit", "/app/identity/creator/kit")],
    [actions(true), audience, studio("insights", "Insights", "/app/identity/creator/insights")],
    [studio("settings", "Studio settings", "/app/identity/creator/settings")],
  ];
  if (slug === "event") return [[{ id: "events", label: "Events", href: "/app/identity/events", icon: <EventsIcon /> }, actions(true), audience]];
  return [[actions(true), audience]];
}

const GLOBAL: { id: GlobalPage; label: string; href: string; icon: GlobalIconName }[] = [
  { id: "home", label: "Home", href: "/app", icon: "home" },
  { id: "connections", label: "Connections", href: "/app/connections", icon: "people" },
  { id: "passport", label: "Passport", href: "/app/passport", icon: "passport" },
  { id: "analytics", label: "Analytics", href: "/app/analytics", icon: "analytics" },
];
const WALLET = { id: "wallet" as const, label: "Wallet", href: "/app/wallet", icon: "wallet" as const };

const row = "group relative flex min-h-10 items-center gap-3 rounded-[13px] px-3 text-[14.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/70";
const on = "bg-white/[0.09] font-semibold text-[#F5F4EF]";
const off = "font-medium text-[#F5F4EF]/62 hover:bg-white/[0.045] hover:text-[#F5F4EF]";
const heading = "px-3 font-label text-[10px] uppercase tracking-[0.16em] text-[#F5F4EF]/38";

export function SideNav({ place, modes, published, unread = 0, needsYou = 0, wallet = false, liveUrl, onModeGo, footer }: {
  place: NavPlace;
  /** The account's Modes and whether each is switched on. */
  modes: { slug: ModeSlug; enabled: boolean }[];
  published: boolean;
  unread?: number;
  /** Actions waiting on the member in the open Mode. */
  needsYou?: number;
  wallet?: boolean;
  /** The open Mode's public link, shown at the foot of its tools. */
  liveUrl?: string | null;
  /** Inside the Mode editor, switching Mode or opening its Overview happens in place. */
  onModeGo?: (slug: ModeSlug) => void;
  /** Settings and the account menu. */
  footer: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const openMode = "mode" in place ? place.mode : null;
  const pageKey = "page" in place ? place.page : place.global;
  // A tall sidebar scrolls; keep the open page in view.
  useEffect(() => { scroller.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" }); }, [openMode, pageKey]);
  const items = wallet ? [...GLOBAL, WALLET] : GLOBAL;
  const inPlace = (slug: ModeSlug) => (event: MouseEvent) => {
    if (!onModeGo || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    onModeGo(slug);
  };

  return (
    <aside aria-label="Setuvara" className="print:hidden fixed inset-y-3 left-3 z-40 hidden w-[256px] flex-col rounded-[26px] bg-[#0D0D0D] text-[#F5F4EF] shadow-[0_30px_60px_-34px_rgba(13,13,13,.8)] lg:flex">
      <Link aria-label="Setuvara Home" className="mx-3 mt-3 flex h-[60px] shrink-0 items-center gap-2.5 rounded-[16px] px-3 focus-visible:outline-2" href="/app">
        <MeetMark className="size-[26px] shrink-0" />
        <span className="font-display text-[22px] font-bold tracking-[-0.04em]">setuvara</span>
      </Link>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-4 pt-2 [scrollbar-width:none]" ref={scroller}>
        <nav aria-label="Setuvara" className="flex flex-col gap-0.5">
          {items.map((item) => {
            const current = "global" in place && place.global === item.id;
            return (
              <Link aria-current={current ? "page" : undefined} className={`${row} ${current ? on : off}`} href={item.href} key={item.id}>
                <span className={`relative ${current ? "text-[#FF5A4F]" : ""}`}><NavIcon className="size-[19px]" name={item.icon} /></span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.id === "connections" && unread > 0 && <span aria-label={`${unread} unread`} className="grid h-5 min-w-5 place-items-center rounded-full bg-[#FF5A4F] px-1.5 text-[11px] font-bold leading-none text-white">{unread > 99 ? "99+" : unread}</span>}
              </Link>
            );
          })}
        </nav>

        <nav aria-labelledby="sv-nav-modes" className="mt-6">
          <div className="mb-1.5 flex items-center justify-between pr-3">
            <h2 className={heading} id="sv-nav-modes">Your Modes</h2>
            {!published && <Link className="font-label text-[10px] uppercase tracking-[0.12em] text-[#FF5A4F] hover:underline" href="/app/identity?mode=personal&section=share" title="Your profile isn't published yet">Draft</Link>}
          </div>
          <ul className="flex flex-col gap-0.5">
            {MODE_ORDER.map((slug) => {
              const entry = modes.find((mode) => mode.slug === slug);
              if (!entry) return null;
              const open = openMode === slug;
              const live = published && entry.enabled;
              const overview = open && "page" in place && place.page === "overview";
              return (
                <li key={slug}>
                  <Link aria-current={overview ? "page" : undefined} aria-expanded={open} className={`${row} ${open ? "font-semibold text-[#F5F4EF]" : off} ${overview ? "bg-white/[0.09]" : ""}`} href={`/app/identity?mode=${slug}`} onClick={inPlace(slug)}>
                    <span aria-hidden="true" className="grid size-[19px] place-items-center"><span className="size-2 rounded-full" style={{ background: MODE_DOT[slug], opacity: entry.enabled ? 1 : 0.35 }} /></span>
                    <span className="min-w-0 flex-1 truncate">{MODE_NAMES[slug]}</span>
                    <span className={`font-label text-[9.5px] uppercase tracking-[0.12em] ${live ? "text-[#C7FF4A]" : "text-[#F5F4EF]/32"}`}>{live ? "Live" : entry.enabled ? "Private" : "Off"}</span>
                  </Link>
                  {open && (
                    <div aria-label={`${MODE_NAMES[slug]} tools`} className="mb-2 ml-[21px] mt-0.5 flex flex-col border-l border-white/[0.09] pl-2" role="group">
                      {modeTools(slug).map((group, index) => (
                        <div className={`flex flex-col gap-0.5 ${index ? "mt-1.5 border-t border-white/[0.06] pt-1.5" : ""}`} key={index}>
                          {group.map((tool) => {
                            const current = "page" in place && place.page === tool.id;
                            return (
                              <Link aria-current={current ? "page" : undefined} className={`${row} min-h-9 text-[13.5px] ${current ? on : off} [&_svg]:size-[17px]`} href={tool.href} key={tool.id}>
                                <span style={current ? { color: MODE_DOT[slug] } : undefined}>{tool.icon}</span>
                                <span className="min-w-0 flex-1 truncate">{tool.label}</span>
                                {tool.badge && needsYou > 0 && <span aria-label={`${needsYou} need you`} className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#FF5A4F] px-1 text-[10px] font-bold text-[#0D0D0D]">{needsYou}</span>}
                              </Link>
                            );
                          })}
                        </div>
                      ))}
                      {liveUrl && (
                        <a className={`${row} mt-1.5 min-h-9 text-[12.5px] text-[#F5F4EF]/45 hover:bg-white/[0.045] hover:text-[#F5F4EF]`} href={liveUrl} rel="noreferrer" target="_blank" title={liveUrl}>
                          <span className="min-w-0 flex-1 truncate font-label">{liveUrl.replace(/^https?:\/\//, "")}</span>
                          <span aria-hidden="true">↗</span>
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="flex shrink-0 flex-col gap-1 px-3 pb-3">
        <div aria-hidden="true" className="mx-2 mb-1 h-px bg-white/[0.08]" />
        {footer}
      </div>
    </aside>
  );
}

/** The Settings row at the foot of the sidebar. */
export function SettingsLink({ current }: { current: boolean }) {
  return (
    <Link aria-current={current ? "page" : undefined} className={`${row} ${current ? on : off}`} href="/app/settings">
      <span className={current ? "text-[#FF5A4F]" : ""}><NavIcon className="size-[19px]" name="settings" /></span>
      <span className="min-w-0 flex-1 truncate">Settings</span>
    </Link>
  );
}
