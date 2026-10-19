"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { MeetMark } from "@/components/marketing/brand";
import type { AdminArea, AdminRole } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/client";

const NAV: { area: AdminArea; href: string; label: string; icon: ReactNode }[] = [
  { area: "overview", href: "/", label: "Overview", icon: <path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" /> },
  { area: "members", href: "/members", label: "Members", icon: <><circle cx="9" cy="8.4" r="3.2" /><path d="M3.4 19.4c.7-3.1 2.9-4.9 5.6-4.9s4.9 1.8 5.6 4.9" /><path d="M15.4 5.4a3 3 0 0 1 0 5.9M17.2 14.6c1.8.5 3 2 3.4 4.4" /></> },
  { area: "billing", href: "/billing", label: "Billing", icon: <><rect height="14" rx="2.5" width="18" x="3" y="5" /><path d="M3 9.5h18M7 15h4" /></> },
  { area: "feedback", href: "/feedback", label: "Support", icon: <path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4.5 3.2V17H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /> },
  { area: "health", href: "/health", label: "Health", icon: <path d="M3 12h4l2.5-6 5 12 2.5-6h4" /> },
  { area: "audit", href: "/audit", label: "Audit log", icon: <><path d="M7 4h8l4 4v12H7z" /><path d="M15 4v4h4M10 12.5h6M10 16h6" /></> },
  { area: "access", href: "/access", label: "Access", icon: <><rect height="9" rx="2" width="14" x="5" y="11" /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></> },
];

function Icon({ children }: { children: ReactNode }) {
  return <svg aria-hidden="true" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">{children}</svg>;
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

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[236px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <div className="hidden border-r border-ink/[0.08] bg-[#ecebe6] lg:block">
        <aside className="sticky top-0 flex h-dvh flex-col px-3 py-4">
          <Link className="flex items-center gap-2.5 rounded-lg px-2 py-1.5" href="/">
            <MeetMark className="size-6 text-ink" />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Setuvara</span>
            <span className="rounded-md bg-ink px-1.5 py-0.5 font-label text-[9.5px] font-medium uppercase tracking-[0.14em] text-paper">Admin</span>
          </Link>
          <nav aria-label="Admin" className="mt-6 flex flex-col gap-0.5">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink ${active ? "bg-white text-ink shadow-[0_0_0_1px_rgba(13,13,13,.07)]" : "text-ink/60 hover:bg-ink/[0.04] hover:text-ink"}`}
                  href={item.href}
                  key={item.href}
                >
                  <Icon>{item.icon}</Icon>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3 px-1">
            <p className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ${live ? "bg-coral/15 text-[#a72f26]" : "bg-sky/50 text-[#21406f]"}`}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{environment}
            </p>
            <div className="rounded-xl bg-white/70 px-3 py-2.5 shadow-[0_0_0_1px_rgba(13,13,13,.06)]">
              <p className="truncate text-[12.5px] font-semibold" title={email}>{email}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-label text-[10px] uppercase tracking-[0.14em] text-ink/50">{role}</span>
                <button className="text-[12px] font-semibold text-ink/60 hover:text-ink disabled:opacity-50" disabled={signingOut} onClick={() => void signOut()} type="button">
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Phone and tablet header */}
      <header className="sticky top-0 z-30 border-b border-ink/[0.08] bg-[#f3f2ee]/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link className="flex items-center gap-2" href="/">
            <MeetMark className="size-[22px] text-ink" />
            <span className="rounded-md bg-ink px-1.5 py-0.5 font-label text-[9.5px] font-medium uppercase tracking-[0.14em] text-paper">Admin</span>
          </Link>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${live ? "bg-coral/15 text-[#a72f26]" : "bg-sky/50 text-[#21406f]"}`}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{live ? "Live" : "Local"}
            </span>
            <button className="h-8 rounded-full px-3 text-[12px] font-semibold shadow-[0_0_0_1px_rgba(13,13,13,.12)] disabled:opacity-50" disabled={signingOut} onClick={() => void signOut()} type="button">
              Sign out
            </button>
          </div>
        </div>
        <nav aria-label="Admin" className="overflow-x-auto px-2 pb-2 [scrollbar-width:none]">
          <div className="flex min-w-max gap-1">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold ${active ? "bg-ink text-paper" : "text-ink/60"}`}
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

      <main className="min-w-0 px-4 pb-16 pt-5 sm:px-6 lg:px-9 lg:pt-8">
        <div className="mx-auto max-w-[1240px]">{children}</div>
      </main>
    </div>
  );
}
