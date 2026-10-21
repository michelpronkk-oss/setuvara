"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

import { AccountMenu } from "@/components/app/app-shell";
import { MeetMark } from "@/components/marketing/brand";
import type { PhotoFocus } from "@/components/profile/photo-focus";
import type { ModeSlug, ProfileIdentity } from "@/components/profile/types";
import type { PlanCode } from "@/lib/billing/catalog";
import { MODE_SLUGS, SECTIONS, type Section } from "./editor-types";
import { modeMeta } from "./editor-ui";

// Same Mode colours as the app sidebar and Home picker.
const MODE_DOT: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF", creator: "#E8A6FF" };

// 24px line icons, 1.8 stroke, matching the app sidebar.
const ICONS: Record<Section, ReactNode> = {
  home: <><rect height="7" rx="1.8" width="7" x="3.5" y="3.5" /><rect height="7" rx="1.8" width="7" x="13.5" y="3.5" /><rect height="7" rx="1.8" width="7" x="3.5" y="13.5" /><rect height="7" rx="1.8" width="7" x="13.5" y="13.5" /></>,
  profile: <><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" /></>,
  links: <><rect height="6" rx="1.8" width="16" x="4" y="4" /><rect height="6" rx="1.8" width="16" x="4" y="14" /></>,
  appearance: <><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1 0 1.6-.7 1.6-1.6 0-.5-.2-.9-.5-1.2a1.6 1.6 0 0 1 1.2-2.7h1.9a4.3 4.3 0 0 0 4.3-4.3c0-4-3.8-7.2-8.5-7.2Z" /><circle cx="7.6" cy="11.6" fill="currentColor" r=".9" stroke="none" /><circle cx="10.4" cy="7.6" fill="currentColor" r=".9" stroke="none" /><circle cx="14.6" cy="7.6" fill="currentColor" r=".9" stroke="none" /></>,
  settings: <path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5" />,
  share: <><rect height="6" rx="1.2" width="6" x="4" y="4" /><rect height="6" rx="1.2" width="6" x="14" y="4" /><rect height="6" rx="1.2" width="6" x="4" y="14" /><path d="M14 14h2.5v2.5M20 14v.01M14 20h.01M17.5 17.5H20V20h-2.5" /></>,
};

export function SectionIcon({ name }: { name: Section }) {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{ICONS[name]}</svg>;
}

const NAV: { id: Section; title: string }[] = [{ id: "home", title: "Overview" }, ...SECTIONS];

/** The Creator studio pages, listed under the editor sections whenever Creator Mode is open. */
export const STUDIO_PAGES = [
  { id: "work", title: "Work", href: "/app/identity/creator/work" },
  { id: "commerce", title: "Commerce", href: "/app/identity/creator/commerce" },
  { id: "actions", title: "Actions", href: "/app/identity/creator/actions" },
  { id: "collabs", title: "Deals", href: "/app/identity/creator/collabs" },
  { id: "audience", title: "Audience", href: "/app/identity/creator/audience" },
  { id: "kit", title: "Media kit", href: "/app/identity/creator/kit" },
  { id: "insights", title: "Insights", href: "/app/identity/creator/insights" },
  { id: "settings", title: "Studio settings", href: "/app/identity/creator/settings" },
] as const;
export type StudioPageId = (typeof STUDIO_PAGES)[number]["id"];

const STUDIO_ICONS: Record<StudioPageId, ReactNode> = {
  work: <><rect height="15" rx="2.2" width="17" x="3.5" y="4.5" /><path d="m3.5 16 4.6-4.4a1.6 1.6 0 0 1 2.2 0L15 16M13.5 14.5l1.6-1.5a1.6 1.6 0 0 1 2.2 0l3.2 3" /><circle cx="15.5" cy="9" r="1.4" /></>,
  commerce: <><path d="M5 8h14l-1.1 10.4a1.8 1.8 0 0 1-1.8 1.6H7.9a1.8 1.8 0 0 1-1.8-1.6L5 8Z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></>,
  actions: <path d="M13.2 3.5 5.5 13.4h6l-.7 7.1 7.7-9.9h-6l.7-7.1Z" />,
  collabs: <><path d="M3.5 11.5 8 7l3 2 3-2.5 6.5 5" /><path d="m7 13.5 3.2 3.2a1.6 1.6 0 0 0 2.3 0l4-4M11 16l1.5 1.5" /></>,
  audience: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.6a5.5 5.5 0 0 1 3 4.9" /></>,
  kit: <><path d="M7 3.5h7l4 4v11.2a1.8 1.8 0 0 1-1.8 1.8H7a1.8 1.8 0 0 1-1.8-1.8V5.3A1.8 1.8 0 0 1 7 3.5Z" /><path d="M13.5 3.5v4.3h4.3M8.5 12.5h7M8.5 16h4.5" /></>,
  insights: <path d="M4.5 19.5h15M7 16v-4M11.5 16V7.5M16 16v-6.5" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" /></>,
};

/** Creator studio's own mark: a four-point spark. */
function StudioMark() {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 3.5c.6 4.4 2.7 6.6 7.5 8.5-4.8 1.9-6.9 4.1-7.5 8.5-.6-4.4-2.7-6.6-7.5-8.5 4.8-1.9 6.9-4.1 7.5-8.5Z" /></svg>;
}

/** Event Mode's own page: its events. */
export function EventsIcon() {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><rect height="15.5" rx="2.4" width="17" x="3.5" y="5" /><path d="M3.5 10h17M8 3.5v3M16 3.5v3M8 14h3" /></svg>;
}

/** Business Mode's own page: its leads. */
export function LeadsIcon() {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M4 5.5h16l-6 7.2v5.8l-4 1.9v-7.7L4 5.5Z" /></svg>;
}

/** Business Mode's testimonials: a quote. */
export function TestimonialsIcon() {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M5 18.5V12c0-3.6 1.8-5.9 5-6.5M14 18.5V12c0-3.6 1.8-5.9 5-6.5" /><path d="M5 12.5h4.5v6H5zM14 12.5h4.5v6H14z" /></svg>;
}

export function StudioIcon({ name }: { name: StudioPageId }) {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{STUDIO_ICONS[name]}</svg>;
}

/**
 * The editor's desktop sidebar: the same dark panel as the app, holding the Mode and the section.
 * The Creator studio pages share it; there `section` is null and `studio` names the open page.
 */
export function EditorSidebar({ profile, modes, slug, section, studio = null, actions = false, audience = false, events = false, leads = false, testimonials = false, needsYou = 0, plan, liveUrl, personalUrl, avatarUrl, avatarFocus, onGo, signOut }: {
  profile: ProfileIdentity; modes: { slug: ModeSlug; is_enabled: boolean }[]; slug: ModeSlug; section: Section | null;
  studio?: StudioPageId | null; /** The Mode's Actions page is open (Personal, Event, Business). */ actions?: boolean; /** The Audience page is open (Personal, Event, Business). */ audience?: boolean; /** Event Mode's Events page is open. */ events?: boolean; /** Business Mode's Leads page is open. */ leads?: boolean; /** Business Mode's Testimonials page is open. */ testimonials?: boolean; needsYou?: number; plan: PlanCode; liveUrl: string; personalUrl: string | null;
  avatarUrl: string | null; avatarFocus?: PhotoFocus; onGo: (section: Section, mode?: ModeSlug) => void; signOut: () => Promise<void>;
}) {
  const url = liveUrl;
  const scroller = useRef<HTMLDivElement>(null);
  // A tall sidebar scrolls; keep the open page in view.
  useEffect(() => { scroller.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" }); }, [section, studio, actions, audience, events, leads, testimonials]);
  return (
    <aside aria-label="Identity editor" className="print:hidden fixed inset-y-3 left-3 z-40 hidden w-[256px] flex-col rounded-[26px] bg-[#0D0D0D] text-[#F5F4EF] shadow-[0_30px_60px_-34px_rgba(13,13,13,.8)] lg:flex">
      <div className="mx-3 mt-3 flex h-[60px] items-center justify-between gap-2 px-3.5">
        <Link aria-label="Setuvara Home" className="flex items-center gap-2.5 rounded-[12px] focus-visible:outline-2" href="/app">
          <MeetMark className="size-[26px] shrink-0" />
          <span className="font-display text-[22px] font-bold tracking-[-0.04em]">setuvara</span>
        </Link>
        <Link aria-label="Back to Home" className="grid size-9 place-items-center rounded-full text-[#F5F4EF]/55 transition-colors hover:bg-white/[0.06] hover:text-[#F5F4EF] focus-visible:outline-2" href="/app" title="Back to Home">
          <svg aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M15 5 8 12l7 7" /></svg>
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-4 pt-3 [scrollbar-width:none]" ref={scroller}>
        <section aria-labelledby="sv-editor-modes">
          <div className="mb-2 flex items-center justify-between px-3.5">
            <h2 className="font-label text-[10px] uppercase tracking-[0.16em] text-[#F5F4EF]/40" id="sv-editor-modes">Editing</h2>
            {!profile.is_published && <span className="font-label text-[10px] uppercase tracking-[0.12em] text-[#FF5A4F]">Draft</span>}
          </div>
          <div aria-label="Mode" className="flex flex-col gap-0.5" role="tablist">
            {MODE_SLUGS.map((item) => {
              const entry = modes.find((mode) => mode.slug === item);
              if (!entry) return null;
              const on = item === slug;
              const live = profile.is_published && entry.is_enabled;
              return (
                <button aria-selected={on} className={`flex min-h-11 items-center gap-3 rounded-[14px] px-3.5 text-left text-[14px] transition-colors focus-visible:outline-2 ${on ? "bg-white/[0.08] font-semibold text-[#F5F4EF]" : "font-medium text-[#F5F4EF]/65 hover:bg-white/[0.04] hover:text-[#F5F4EF]"}`} key={item} onClick={() => onGo(section ?? "home", item)} role="tab" type="button">
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: MODE_DOT[item], opacity: entry.is_enabled ? 1 : 0.35 }} />
                  <span className="min-w-0 flex-1 truncate">{modeMeta[item].name}</span>
                  <span className={`font-label text-[10px] uppercase tracking-[0.12em] ${live ? "text-[#C7FF4A]" : "text-[#F5F4EF]/35"}`}>{live ? "Live" : entry.is_enabled ? "Private" : "Off"}</span>
                </button>
              );
            })}
          </div>
        </section>

        <nav aria-label="Editor sections" className="mt-6 flex flex-col gap-1">
          <h2 className="mb-1 px-3.5 font-label text-[10px] uppercase tracking-[0.16em] text-[#F5F4EF]/40">{modeMeta[slug].name} Mode</h2>
          {NAV.map((item) => {
            const active = section === item.id;
            return (
              <button aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3.5 rounded-[16px] px-3.5 text-left text-[15px] transition-colors focus-visible:outline-2 ${active ? "bg-white/[0.08] font-semibold text-[#F5F4EF]" : "font-medium text-[#F5F4EF]/60 hover:bg-white/[0.04] hover:text-[#F5F4EF]"}`} key={item.id} onClick={() => onGo(item.id)} type="button">
                <span className={active ? "text-[#FF5A4F]" : ""}><SectionIcon name={item.id} /></span>
                {item.title}
              </button>
            );
          })}
          {slug === "event" && (
            <Link aria-current={events ? "page" : undefined} className={`flex min-h-11 items-center gap-3.5 rounded-[16px] px-3.5 text-[15px] transition-colors focus-visible:outline-2 ${events ? "bg-white/[0.08] font-semibold text-[#F5F4EF]" : "font-medium text-[#F5F4EF]/60 hover:bg-white/[0.04] hover:text-[#F5F4EF]"}`} href="/app/identity/events">
              <span className={events ? "text-[#C7FF4A]" : ""}><EventsIcon /></span>
              <span className="min-w-0 flex-1 truncate">Events</span>
            </Link>
          )}
          {slug === "business" && (
            <Link aria-current={leads ? "page" : undefined} className={`flex min-h-11 items-center gap-3.5 rounded-[16px] px-3.5 text-[15px] transition-colors focus-visible:outline-2 ${leads ? "bg-white/[0.08] font-semibold text-[#F5F4EF]" : "font-medium text-[#F5F4EF]/60 hover:bg-white/[0.04] hover:text-[#F5F4EF]"}`} href="/app/identity/leads">
              <span className={leads ? "text-[#AFCBFF]" : ""}><LeadsIcon /></span>
              <span className="min-w-0 flex-1 truncate">Leads</span>
            </Link>
          )}
          {slug === "business" && (
            <Link aria-current={testimonials ? "page" : undefined} className={`flex min-h-11 items-center gap-3.5 rounded-[16px] px-3.5 text-[15px] transition-colors focus-visible:outline-2 ${testimonials ? "bg-white/[0.08] font-semibold text-[#F5F4EF]" : "font-medium text-[#F5F4EF]/60 hover:bg-white/[0.04] hover:text-[#F5F4EF]"}`} href="/app/identity/testimonials">
              <span className={testimonials ? "text-[#FFE7B8]" : ""}><TestimonialsIcon /></span>
              <span className="min-w-0 flex-1 truncate">Testimonials</span>
            </Link>
          )}
          {slug !== "creator" && (
            <Link aria-current={actions ? "page" : undefined} className={`flex min-h-11 items-center gap-3.5 rounded-[16px] px-3.5 text-[15px] transition-colors focus-visible:outline-2 ${actions ? "bg-white/[0.08] font-semibold text-[#F5F4EF]" : "font-medium text-[#F5F4EF]/60 hover:bg-white/[0.04] hover:text-[#F5F4EF]"}`} href={`/app/identity/actions?mode=${slug}`}>
              <span className={actions ? "text-[#FF5A4F]" : ""}><StudioIcon name="actions" /></span>
              <span className="min-w-0 flex-1 truncate">Actions</span>
              {needsYou > 0 && <span aria-label={`${needsYou} new`} className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#FF5A4F] px-1 text-[10px] font-bold text-[#0D0D0D]">{needsYou}</span>}
            </Link>
          )}
          {slug !== "creator" && (
            <Link aria-current={audience ? "page" : undefined} className={`flex min-h-11 items-center gap-3.5 rounded-[16px] px-3.5 text-[15px] transition-colors focus-visible:outline-2 ${audience ? "bg-white/[0.08] font-semibold text-[#F5F4EF]" : "font-medium text-[#F5F4EF]/60 hover:bg-white/[0.04] hover:text-[#F5F4EF]"}`} href={`/app/identity/audience?mode=${slug}`}>
              <span className={audience ? "text-[#FF5A4F]" : ""}><StudioIcon name="audience" /></span>
              <span className="min-w-0 flex-1 truncate">Audience</span>
            </Link>
          )}
          {slug === "creator" && <>
            <Link aria-current={studio ? "true" : undefined} className={`mt-1 flex min-h-11 items-center gap-3.5 rounded-[16px] px-3.5 text-[15px] transition-colors focus-visible:outline-2 ${studio ? "font-semibold text-[#F5F4EF]" : "font-medium text-[#F5F4EF]/60 hover:bg-white/[0.04] hover:text-[#F5F4EF]"}`} href={studio ? STUDIO_PAGES.find((item) => item.id === studio)!.href : STUDIO_PAGES[0].href}>
              <span className="text-[#E8A6FF]"><StudioMark /></span>
              <span className="min-w-0 flex-1 truncate">Creator studio</span>
              {needsYou > 0 && <span aria-label={`${needsYou} new`} className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#FF5A4F] px-1 text-[10px] font-bold text-[#0D0D0D]">{needsYou}</span>}
              {!studio && <span aria-hidden="true" className="text-[#F5F4EF]/35">›</span>}
            </Link>
            {studio && (
              <div aria-label="Creator studio" className="ml-[25px] flex flex-col gap-0.5 border-l border-white/[0.1] pl-2.5" role="group">
                {STUDIO_PAGES.map((item) => {
                  const active = studio === item.id;
                  return (
                    <Link aria-current={active ? "page" : undefined} className={`flex min-h-10 items-center gap-3 rounded-[13px] px-3 text-[14px] transition-colors focus-visible:outline-2 ${active ? "bg-white/[0.08] font-semibold text-[#F5F4EF]" : "font-medium text-[#F5F4EF]/55 hover:bg-white/[0.04] hover:text-[#F5F4EF]"}`} href={item.href} key={item.id}>
                      <span className={`[&_svg]:size-[18px] ${active ? "text-[#E8A6FF]" : ""}`}><StudioIcon name={item.id} /></span>
                      <span className="min-w-0 flex-1 truncate">{item.id === "settings" ? "Settings" : item.title}</span>
                      {item.id === "actions" && needsYou > 0 && <span aria-hidden="true" className="size-1.5 rounded-full bg-[#FF5A4F]" />}
                    </Link>
                  );
                })}
              </div>
            )}
          </>}
        </nav>

        <div aria-hidden="true" className="flex-1" />
        <a aria-label={`View live profile, ${url.replace(/^https?:\/\//, "")}`} className="mt-6 flex shrink-0 flex-col gap-1 rounded-[16px] bg-white/[0.05] px-3.5 py-3 transition-colors hover:bg-white/[0.08] focus-visible:outline-2" href={url} rel="noreferrer" target="_blank">
          <span className="flex items-center justify-between font-label text-[10px] uppercase tracking-[0.14em] text-[#F5F4EF]/45">{profile.is_published ? "Live at" : "Will live at"}<span aria-hidden="true" className="text-[#F5F4EF]/60">↗</span></span>
          <span className="truncate font-label text-[12px] text-[#F5F4EF]/85" title={url}>{url.replace(/^https?:\/\//, "") || "Link unavailable"}</span>
        </a>
      </div>

      <div className="px-3 pb-3">
        <div aria-hidden="true" className="mx-2 mb-2 h-px bg-white/[0.08]" />
        <AccountMenu avatarFocus={avatarFocus} avatarUrl={avatarUrl} displayName={profile.display_name || "Your identity"} placement="panel" plan={plan} publicProfileUrl={personalUrl} signOut={signOut} username={profile.username || null} />
      </div>
    </aside>
  );
}
