"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { MOBILE_BAR_SPACE, MobileModeHeader, MobileTabBar } from "@/components/app/mobile-nav";
import type { PhotoFocus } from "@/components/profile/photo-focus";
import type { ModeSlug, ProfileIdentity } from "@/components/profile/types";
import type { PlanCode } from "@/lib/billing/catalog";
import { EditorSidebar, STUDIO_PAGES } from "@/app/app/identity/editor-sidebar";

export function studioPageFor(pathname: string): (typeof STUDIO_PAGES)[number] {
  return STUDIO_PAGES.find((page) => pathname === page.href || pathname.startsWith(`${page.href}/`)) ?? STUDIO_PAGES[0];
}

/**
 * The Creator studio's chrome: the identity editor's dark sidebar (Creator Mode, studio page open),
 * a breadcrumb bar on desktop and a compact header with the studio pages on phones.
 */
export function StudioShell({ children, profile, modes, plan, liveUrl, shareUrl, personalUrl, avatarUrl, avatarFocus, needsYou, enabled, signOut }: {
  children: ReactNode; profile: ProfileIdentity; modes: { slug: ModeSlug; is_enabled: boolean }[]; plan: PlanCode;
  liveUrl: string; shareUrl: string | null; personalUrl: string | null; avatarUrl: string | null; avatarFocus?: PhotoFocus;
  needsYou: number; enabled: boolean; signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const page = studioPageFor(pathname);
  const display = shareUrl?.replace(/^https?:\/\//, "") ?? null;
  const share = (
    <Link className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[#FF5A4F] px-[18px] text-sm font-semibold text-[#0D0D0D] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2" href="/app/identity?mode=creator&section=share">
      <StudioShareIcon />Share page
    </Link>
  );

  return (
    <div className="min-h-dvh bg-[#F5F4EF] font-brand text-[#0D0D0D] lg:pl-[268px] print:bg-white print:pl-0">
      <EditorSidebar
        avatarFocus={avatarFocus}
        avatarUrl={avatarUrl}
        liveUrl={liveUrl}
        modes={modes}
        needsYou={needsYou}
        onGo={(section, mode = "creator") => router.push(`/app/identity?mode=${mode}${section === "home" ? "" : `&section=${section}`}`)}
        personalUrl={personalUrl}
        plan={plan}
        profile={profile}
        section={null}
        signOut={signOut}
        slug="creator"
        studio={page.id}
      />

      {/* Desktop: where you are inside Creator Mode, the live link and Share. */}
      <header className="sticky top-0 z-30 hidden h-[76px] items-center justify-between gap-5 border-b border-black/[0.08] bg-[#F5F4EF]/90 pl-8 pr-6 backdrop-blur-md lg:flex xl:pl-11 print:hidden">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2.5 text-[15px]">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#E8A6FF]" style={{ opacity: enabled ? 1 : 0.4 }} />
          <Link className="shrink-0 font-semibold hover:underline hover:underline-offset-4" href="/app/identity?mode=creator">Creator Mode</Link>
          {!enabled && <span className="shrink-0 rounded-full bg-black/[0.06] px-2 py-0.5 font-label text-[10px] uppercase tracking-[0.12em] text-black/55">Off</span>}
          <span aria-hidden="true" className="text-black/25">/</span>
          <span aria-current="page" className="truncate font-semibold">{page.title}</span>
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          {display
            ? <a className="hidden min-h-11 max-w-[280px] items-center gap-2 rounded-full bg-black/[0.05] px-4 text-sm font-semibold text-black/70 transition hover:bg-black/[0.08] xl:inline-flex" href={shareUrl ?? undefined} rel="noreferrer" target="_blank" title={display}><span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#2BB673]" /><span className="truncate">{display}</span><span aria-hidden="true">↗</span></a>
            : <span className="hidden min-h-11 items-center gap-2 rounded-full bg-black/[0.05] px-4 text-sm font-semibold text-black/55 xl:inline-flex"><span aria-hidden="true" className="size-2 rounded-full bg-black/25" />Not live</span>}
          {share}
        </div>
      </header>

      {/* Phone: Creator Mode, every section and studio page in one strip, and Share. */}
      <MobileModeHeader
        modes={modes.map((item) => ({ slug: item.slug, enabled: item.is_enabled }))}
        place={page.id}
        right={<Link aria-label="Share page" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#FF5A4F] px-3.5 text-[13px] font-semibold text-[#0D0D0D]" href="/app/identity?mode=creator&section=share"><StudioShareIcon />Share</Link>}
        slug="creator"
      />

      <div className={`${MOBILE_BAR_SPACE} lg:pb-16 print:p-0`}>{children}</div>

      <MobileTabBar />
    </div>
  );
}



function StudioShareIcon() {
  return <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" /></svg>;
}
