"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { EditorSidebar, EventsIcon, LeadsIcon, SectionIcon, StudioIcon, TeamIcon, TestimonialsIcon } from "@/app/app/identity/editor-sidebar";
import { MeetMark } from "@/components/marketing/brand";
import type { PhotoFocus } from "@/components/profile/photo-focus";
import type { ModeSlug, ProfileIdentity } from "@/components/profile/types";
import type { PlanCode } from "@/lib/billing/catalog";

export type ActionsPage = "actions" | "audience" | "events" | "leads" | "testimonials" | "team" | "builder";
const MODE_NAME: Record<ModeSlug, string> = { personal: "Personal", event: "Event", business: "Business", creator: "Creator" };
const MODE_DOT: Record<ModeSlug, string> = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF", creator: "#E8A6FF" };

/**
 * Actions for Personal, Event and Business: the identity editor's dark sidebar with Actions open, a
 * breadcrumb bar on desktop, and on phones a compact header and the editor's dark tab bar.
 */
export function ActionsShell({ children, page = "actions", slug, profile, modes, plan, liveUrl, pageUrl, personalUrl, avatarUrl, avatarFocus, needsYou, signOut }: {
  children: ReactNode; /** Actions, or the Audience, Events, Leads, Testimonials or Team page that sits beside it. */ page?: ActionsPage; slug: ModeSlug; profile: ProfileIdentity; modes: { slug: ModeSlug; is_enabled: boolean }[]; plan: PlanCode;
  liveUrl: string; pageUrl: string | null; personalUrl: string | null; avatarUrl: string | null; avatarFocus?: PhotoFocus; needsYou: number; signOut: () => Promise<void>;
}) {
  const router = useRouter();
  const title = page === "audience" ? "Audience" : page === "events" ? "Events" : page === "leads" ? "Leads" : page === "testimonials" ? "Testimonials" : page === "team" ? "Team" : page === "builder" ? "Builder" : "Actions";
  const pageHref = page === "events" ? "/app/identity/events" : page === "leads" ? "/app/identity/leads" : page === "testimonials" ? "/app/identity/testimonials" : page === "team" ? "/app/identity/team" : page === "builder" ? `/app/identity/builder?mode=${slug}` : `/app/identity/${page}?mode=${slug}`;
  const editor = (section?: string) => `/app/identity?mode=${slug}${section && section !== "home" ? `&section=${section}` : ""}`;
  const display = pageUrl?.replace(/^https?:\/\//, "") ?? null;
  return (
    <div className="min-h-dvh bg-[#F5F4EF] font-brand text-[#0D0D0D] lg:pl-[268px]">
      <EditorSidebar
        actions={page === "actions"}
        audience={page === "audience"}
        events={page === "events"}
        leads={page === "leads"}
        testimonials={page === "testimonials"}
        team={page === "team"}
        builder={page === "builder"}
        avatarFocus={avatarFocus}
        avatarUrl={avatarUrl}
        liveUrl={liveUrl}
        modes={modes}
        needsYou={needsYou}
        onGo={(section, mode) => router.push(mode ? (mode === "creator" ? "/app/identity/creator/actions" : `/app/identity/actions?mode=${mode}`) : editor(section))}
        personalUrl={personalUrl}
        plan={plan}
        profile={profile}
        section={null}
        signOut={signOut}
        slug={slug}
      />

      <header className="sticky top-0 z-30 hidden h-[76px] items-center justify-between gap-5 border-b border-black/[0.08] bg-[#F5F4EF]/90 pl-8 pr-6 backdrop-blur-md lg:flex xl:pl-11">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2.5 text-[15px]">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: MODE_DOT[slug] }} />
          <Link className="shrink-0 font-semibold hover:underline hover:underline-offset-4" href={editor()}>{MODE_NAME[slug]} Mode</Link>
          <span aria-hidden="true" className="text-black/25">/</span>
          <Link aria-current="page" className="truncate font-semibold" href={pageHref}>{title}</Link>
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          {display
            ? <a className="hidden min-h-11 max-w-[280px] items-center gap-2 rounded-full bg-black/[0.05] px-4 text-sm font-semibold text-black/70 transition hover:bg-black/[0.08] xl:inline-flex" href={pageUrl ?? undefined} rel="noreferrer" target="_blank" title={display}><span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#2BB673]" /><span className="truncate">{display}</span><span aria-hidden="true">↗</span></a>
            : <span className="hidden min-h-11 items-center gap-2 rounded-full bg-black/[0.05] px-4 text-sm font-semibold text-black/55 xl:inline-flex"><span aria-hidden="true" className="size-2 rounded-full bg-black/25" />Not live</span>}
          <Link className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[#FF5A4F] px-[18px] text-sm font-semibold text-[#0D0D0D] transition hover:brightness-95" href={editor("share")}>Share page</Link>
        </div>
      </header>

      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#F5F4EF]/92 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center gap-2 px-3">
          <Link aria-label={`Back to ${MODE_NAME[slug]} Mode`} className="flex h-10 shrink-0 items-center gap-0.5 rounded-full pl-1 pr-2 transition hover:bg-black/[0.05]" href={editor()}><svg aria-hidden="true" className="size-4 text-black/45" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M15 5 8 12l7 7" /></svg><MeetMark className="size-6" /></Link>
          <div className="min-w-0 flex-1 leading-none">
            <p className="truncate font-display text-[1.25rem] font-bold tracking-[-0.04em]">{title}</p>
            <p className="mt-1 flex items-center gap-1.5 truncate text-[11.5px] font-medium text-black/50"><span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: MODE_DOT[slug] }} />{MODE_NAME[slug]} Mode</p>
          </div>
        </div>
      </header>

      <div className="pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-16">{children}</div>

      <nav aria-label={`${MODE_NAME[slug]} Mode`} className="fixed inset-x-0 bottom-0 z-40 rounded-t-[24px] bg-[#0D0D0D] pb-[env(safe-area-inset-bottom)] pt-1 text-[#F5F4EF] shadow-[0_-14px_34px_-20px_rgba(13,13,13,.6)] lg:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-4 px-1">
          {([["home", "Overview"], ["profile", "Profile"], ["links", "Content"]] as const).map(([section, title]) => (
            <Link className="flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold text-[#F5F4EF]/55" href={editor(section)} key={section}>
              <span className="grid h-8 w-11 place-items-center rounded-full text-[#F5F4EF]/65 [&_svg]:size-[20px]"><SectionIcon name={section} /></span>{title}
            </Link>
          ))}
          {slug === "event" && page === "events" ? (
            <Link aria-current="page" className="relative flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold text-[#F5F4EF]" href="/app/identity/events">
              <span className="grid h-8 w-11 place-items-center rounded-full bg-white/[0.1] text-[#C7FF4A] [&_svg]:size-[20px]"><EventsIcon /></span>Events
            </Link>
          ) : slug === "business" && page === "leads" ? (
            <Link aria-current="page" className="relative flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold text-[#F5F4EF]" href="/app/identity/leads">
              <span className="grid h-8 w-11 place-items-center rounded-full bg-white/[0.1] text-[#AFCBFF] [&_svg]:size-[20px]"><LeadsIcon /></span>Leads
            </Link>
          ) : slug === "business" && page === "testimonials" ? (
            <Link aria-current="page" className="relative flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold text-[#F5F4EF]" href="/app/identity/testimonials">
              <span className="grid h-8 w-11 place-items-center rounded-full bg-white/[0.1] text-[#FFE7B8] [&_svg]:size-[20px]"><TestimonialsIcon /></span>Testimonials
            </Link>
          ) : slug === "business" && page === "team" ? (
            <Link aria-current="page" className="relative flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold text-[#F5F4EF]" href="/app/identity/team">
              <span className="grid h-8 w-11 place-items-center rounded-full bg-white/[0.1] text-[#C7FF4A] [&_svg]:size-[20px]"><TeamIcon /></span>Team
            </Link>
          ) : (
            <Link aria-current="page" className="relative flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold text-[#F5F4EF]" href={`/app/identity/actions?mode=${slug}`}>
              <span className="grid h-8 w-11 place-items-center rounded-full bg-white/[0.1] text-[#FF5A4F] [&_svg]:size-[20px]"><StudioIcon name="actions" /></span>Actions
              {needsYou > 0 && <span className="absolute right-[calc(50%-24px)] top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#FF5A4F] px-1 text-[9px] font-bold text-[#0D0D0D]">{needsYou}</span>}
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
