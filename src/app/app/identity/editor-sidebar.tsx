"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/app/app-shell";
import { MeetMark } from "@/components/marketing/brand";
import { modeFocus } from "@/components/profile/photo-focus";
import type { ModeSlug, ProfileIdentity, ProfileMode } from "@/components/profile/types";
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

/** The editor's desktop sidebar: the same dark panel as the app, holding the Mode and the section. */
export function EditorSidebar({ profile, modes, slug, section, plan, publicUrl, onGo, signOut }: {
  profile: ProfileIdentity; modes: ProfileMode[]; slug: ModeSlug; section: Section; plan: PlanCode;
  publicUrl: (slug: ModeSlug) => string; onGo: (section: Section, mode?: ModeSlug) => void; signOut: () => Promise<void>;
}) {
  const personal = modes.find((item) => item.slug === "personal");
  const url = publicUrl(slug);
  return (
    <aside aria-label="Identity editor" className="fixed inset-y-3 left-3 z-40 hidden w-[256px] flex-col rounded-[26px] bg-[#0D0D0D] text-[#F5F4EF] shadow-[0_30px_60px_-34px_rgba(13,13,13,.8)] lg:flex">
      <div className="mx-3 mt-3 flex h-[60px] items-center justify-between gap-2 px-3.5">
        <Link aria-label="Setuvara Home" className="flex items-center gap-2.5 rounded-[12px] focus-visible:outline-2" href="/app">
          <MeetMark className="size-[26px] shrink-0" />
          <span className="font-display text-[22px] font-bold tracking-[-0.04em]">setuvara</span>
        </Link>
        <Link aria-label="Back to Home" className="grid size-9 place-items-center rounded-full text-[#F5F4EF]/55 transition-colors hover:bg-white/[0.06] hover:text-[#F5F4EF] focus-visible:outline-2" href="/app" title="Back to Home">
          <svg aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M15 5 8 12l7 7" /></svg>
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-4 pt-3 [scrollbar-width:none]">
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
                <button aria-selected={on} className={`flex min-h-11 items-center gap-3 rounded-[14px] px-3.5 text-left text-[14px] transition-colors focus-visible:outline-2 ${on ? "bg-white/[0.08] font-semibold text-[#F5F4EF]" : "font-medium text-[#F5F4EF]/65 hover:bg-white/[0.04] hover:text-[#F5F4EF]"}`} key={item} onClick={() => onGo(section, item)} role="tab" type="button">
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
              <button aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3.5 rounded-[16px] px-3.5 text-left text-[15px] transition-colors focus-visible:outline-2 ${active ? "bg-white/[0.08] font-semibold text-[#F5F4EF]" : "font-medium text-[#F5F4EF]/60 hover:bg-white/[0.04] hover:text-[#F5F4EF]"}`} key={item.id} onClick={() => onGo(item.id)} type="button">
                <span className={active ? "text-[#FF5A4F]" : ""}><SectionIcon name={item.id} /></span>
                {item.title}
              </button>
            );
          })}
        </nav>

        <a aria-label={`View live profile, ${url.replace(/^https?:\/\//, "")}`} className="mt-auto flex flex-col gap-1 rounded-[16px] bg-white/[0.05] px-3.5 py-3 transition-colors hover:bg-white/[0.08] focus-visible:outline-2" href={url} rel="noreferrer" target="_blank">
          <span className="flex items-center justify-between font-label text-[10px] uppercase tracking-[0.14em] text-[#F5F4EF]/45">{profile.is_published ? "Live at" : "Will live at"}<span aria-hidden="true" className="text-[#F5F4EF]/60">↗</span></span>
          <span className="truncate font-label text-[12px] text-[#F5F4EF]/85" title={url}>{url.replace(/^https?:\/\//, "") || "Link unavailable"}</span>
        </a>
      </div>

      <div className="px-3 pb-3">
        <div aria-hidden="true" className="mx-2 mb-2 h-px bg-white/[0.08]" />
        <AccountMenu avatarFocus={personal ? modeFocus(personal) : undefined} avatarUrl={personal?.image_url ?? null} displayName={profile.display_name || "Your identity"} placement="panel" plan={plan} publicProfileUrl={profile.username ? publicUrl("personal") : null} signOut={signOut} username={profile.username || null} />
      </div>
    </aside>
  );
}
