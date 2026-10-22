"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { EditorSidebar } from "@/app/app/identity/editor-sidebar";
import { MOBILE_BAR_SPACE, MobileModeHeader, MobileTabBar } from "@/components/app/mobile-nav";
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

      <MobileModeHeader
        modes={modes.map((item) => ({ slug: item.slug, enabled: item.is_enabled }))}
        place={page}
        right={<Link className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-[#FF5A4F] px-3.5 text-[13px] font-semibold text-[#0D0D0D]" href={editor("share")}>Share</Link>}
        slug={slug}
      />

      <div className={`${MOBILE_BAR_SPACE} lg:pb-16`}>{children}</div>

      <MobileTabBar />
    </div>
  );
}
