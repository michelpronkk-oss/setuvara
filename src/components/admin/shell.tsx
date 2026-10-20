"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { focusRing } from "@/components/admin/ui";
import { MeetMark, Wordmark } from "@/components/marketing/brand";
import type { AdminArea, AdminRole } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/client";

const NAV: { area: AdminArea; href: string; label: string; icon: ReactNode }[] = [
  { area: "overview", href: "/", label: "Overview", icon: <path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" /> },
  { area: "members", href: "/members", label: "Members", icon: <><circle cx="9" cy="8.4" r="3.2" /><path d="M3.4 19.4c.7-3.1 2.9-4.9 5.6-4.9s4.9 1.8 5.6 4.9" /><path d="M15.4 5.4a3 3 0 0 1 0 5.9M17.2 14.6c1.8.5 3 2 3.4 4.4" /></> },
  { area: "billing", href: "/billing", label: "Billing", icon: <><rect height="14" rx="2.5" width="18" x="3" y="5" /><path d="M3 9.5h18M7 15h4" /></> },
  { area: "commerce", href: "/commerce", label: "Commerce", icon: <><path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8Z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></> },
  { area: "feedback", href: "/feedback", label: "Support", icon: <path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4.5 3.2V17H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /> },
  { area: "chatReports", href: "/chat-reports", label: "Chat reports", icon: <><path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6Z" /><path d="M12 8v4M12 15h.01" /></> },
  { area: "health", href: "/health", label: "Health", icon: <path d="M3 12h4l2.5-6 5 12 2.5-6h4" /> },
  { area: "audit", href: "/audit", label: "Audit log", icon: <><path d="M7 4h8l4 4v12H7z" /><path d="M15 4v4h4M10 12.5h6M10 16h6" /></> },
  { area: "access", href: "/access", label: "Access", icon: <><rect height="9" rx="2" width="14" x="5" y="11" /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></> },
];

function Icon({ children }: { children: ReactNode }) {
  return <svg aria-hidden="true" className="size-[19px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">{children}</svg>;
}

function isActive(pathname: string, href: string) {
  // Defensive: if the internal /admin prefix ever surfaces, ignore it.
  const path = pathname.replace(/^\/admin(?=\/|$)/, "") || "/";
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function AdminShell({ areas, email, role, environment, children }: {
  areas: AdminArea[]; email: string; role: AdminRole; environment: string; children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const items = NAV.filter((item) => areas.includes(item.area));

  async function signOut() {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
    } finally {
      router.replace("/sign-in");
      router.refresh();
    }
  }

  const live = environment === "Live data";
  const initial = email.trim().charAt(0).toUpperCase() || "?";
  const envPill = (short: boolean) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label text-[10px] font-medium uppercase tracking-[0.14em] ${live ? "bg-coral text-ink" : "bg-sky text-ink"}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full bg-ink ${live ? "animate-pulse" : ""}`} />{short ? (live ? "Live" : "Local") : environment}
    </span>
  );

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[264px_minmax(0,1fr)]">
      {/* Desktop sidebar: an ink rail, like the dark cards on the homepage */}
      <div className="hidden bg-ink text-paper lg:block">
        <aside className="sticky top-0 flex h-dvh flex-col px-4 pb-4 pt-6">
          <Link className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1 ${focusRing}`} href="/">
            <MeetMark className="size-[26px] text-paper" />
            <Wordmark className="text-[22px] leading-none" />
          </Link>
          <p className="mt-2 px-2.5 font-label text-[10px] font-medium uppercase tracking-[0.2em] text-coral">Control center</p>
          <nav aria-label="Admin" className="mt-8 flex flex-col gap-1">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`group flex h-11 items-center gap-3 rounded-full px-4 text-[14px] font-semibold transition-colors ${focusRing} ${active ? "bg-paper text-ink" : "text-paper/60 hover:bg-paper/[0.07] hover:text-paper"}`}
                  href={item.href}
                  key={item.href}
                >
                  <Icon>{item.icon}</Icon>
                  {item.label}
                  {active ? <span aria-hidden="true" className="ml-auto size-1.5 rounded-full bg-coral" /> : null}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3">
            <div className="px-1">{envPill(false)}</div>
            <div className="flex items-center gap-3 rounded-[20px] bg-paper/[0.07] p-3">
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-lime font-display text-[15px] font-extrabold text-ink">{initial}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold" title={email}>{email}</p>
                <p className="mt-0.5 font-label text-[9.5px] uppercase tracking-[0.16em] text-paper/45">{role}</p>
              </div>
              <button aria-label="Sign out" className={`grid size-9 shrink-0 place-items-center rounded-full text-paper/60 transition-colors hover:bg-paper/10 hover:text-paper disabled:opacity-50 ${focusRing}`} disabled={signingOut} onClick={() => void signOut()} title="Sign out" type="button">
                <Icon><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" /></Icon>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Phone and tablet: ink bar with the sections as a sliding pill row */}
      <header className="sticky top-0 z-30 bg-ink text-paper lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <Link className={`flex items-center gap-2 rounded-lg ${focusRing}`} href="/">
            <MeetMark className="size-[22px] text-paper" />
            <Wordmark className="text-[19px] leading-none" />
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            {envPill(true)}
            <button aria-label="Sign out" className={`grid size-10 place-items-center rounded-full text-paper/70 hover:bg-paper/10 hover:text-paper disabled:opacity-50 ${focusRing}`} disabled={signingOut} onClick={() => void signOut()} type="button">
              <Icon><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" /></Icon>
            </button>
          </div>
        </div>
        <nav aria-label="Admin" className="overflow-x-auto px-3 pb-3 [mask-image:linear-gradient(90deg,#000_88%,transparent)] [scrollbar-width:none] sm:px-5 sm:[mask-image:none]">
          <div className="flex min-w-max gap-1">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${focusRing} ${active ? "bg-paper text-ink" : "text-paper/65 hover:text-paper"}`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="min-w-0 px-4 pb-20 pt-8 sm:px-8 sm:pt-10 lg:px-12 lg:pt-14">
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>
    </div>
  );
}
