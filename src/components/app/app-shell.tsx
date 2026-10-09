"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/app", label: "Home", short: "Home", mark: "⌂" },
  { href: "/app/identity", label: "Identity", short: "Identity", mark: "◉" },
  { href: "/app/connections", label: "Connections", short: "People", mark: "↗" },
  { href: "/app/passport", label: "Passport", short: "Passport", mark: "✳" },
] as const;

export function AppShell({ children, displayName, publicProfileUrl, signOut }: {
  children: ReactNode;
  displayName: string;
  publicProfileUrl: string | null;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const initials = displayName.trim().slice(0, 1).toUpperCase() || "S";

  return (
    <div className="min-h-screen bg-[#f5f4ef] text-[#0d0d0d] md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden border-r border-black/10 bg-[#fbfaf7] px-4 py-6 md:flex md:flex-col">
        <Link className="px-3 text-[13px] font-bold lowercase tracking-[0.24em]" href="/app">setuvara</Link>
        <p className="mt-10 px-3 text-[9px] font-bold tracking-[0.2em] text-black/40">YOUR SETUVARA</p>
        <nav aria-label="Main navigation" className="mt-3 grid gap-1">
          {navigation.map((item) => <NavigationLink active={isActive(pathname, item.href)} href={item.href} key={item.href} label={item.label} mark={item.mark} />)}
        </nav>
        <div className="mt-auto rounded-2xl bg-[#f1efe9] p-4">
          <p className="text-[9px] font-bold tracking-[0.18em] text-black/40">ONE IDENTITY</p>
          <p className="mt-2 text-sm font-semibold leading-5">Different sides of you, ready for the moment.</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b border-black/10 bg-[#f5f4ef]/95 px-4 backdrop-blur-sm sm:px-6 lg:px-9">
          <Link className="text-[13px] font-bold lowercase tracking-[0.24em] md:hidden" href="/app">setuvara</Link>
          <p className="hidden text-xs font-medium text-black/45 md:block">Your identity, in context.</p>
          <details className="group relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-2 py-1 hover:bg-black/5 focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-[#0d0d0d] text-xs font-semibold text-white">{initials}</span>
              <span className="hidden max-w-40 truncate text-xs font-semibold sm:block">{displayName}</span>
              <span aria-hidden="true" className="text-xs text-black/45">⌄</span>
            </summary>
            <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
              {publicProfileUrl && <a className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium hover:bg-[#f5f4ef]" href={publicProfileUrl} target="_blank" rel="noreferrer">View public profile ↗</a>}
              <Link className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium hover:bg-[#f5f4ef]" href="/app/identity?mode=personal&section=settings">Mode settings</Link>
              <Link className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium hover:bg-[#f5f4ef]" href="/app/settings/notifications">Email preferences</Link>
              <form action={signOut}>
                <button className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium text-black/60 hover:bg-[#f5f4ef]" type="submit">Sign out</button>
              </form>
            </div>
          </details>
        </header>

        <div className="min-w-0 pb-24 md:pb-8">{children}</div>
      </div>

      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-black/10 bg-[#fbfaf7]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden">
        {navigation.map((item) => <Link aria-current={isActive(pathname, item.href) ? "page" : undefined} aria-label={item.label} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold focus-visible:outline-2 ${isActive(pathname, item.href) ? "text-[#0d0d0d]" : "text-black/45"}`} href={item.href} key={item.href}>
          <span aria-hidden="true" className="text-lg leading-5">{item.mark}</span>{item.short}
        </Link>)}
      </nav>
    </div>
  );
}

function NavigationLink({ active, href, label, mark }: { active: boolean; href: string; label: string; mark: string }) {
  return <Link aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-2 ${active ? "bg-[#0d0d0d] text-white" : "text-black/60 hover:bg-black/5 hover:text-black"}`} href={href}>
    <span aria-hidden="true" className="grid size-6 place-items-center text-base">{mark}</span>{label}
  </Link>;
}

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
