"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { MeetMark } from "@/components/marketing/brand";
import type { PlanCode } from "@/lib/billing/catalog";
import { DEFAULT_FOCUS, focusPosition, type PhotoFocus } from "@/components/profile/photo-focus";
import { StatusBadge } from "./status-badge";

const navigation = [
  { href: "/app", label: "Home", short: "Home" },
  { href: "/app/identity", label: "Identity", short: "Identity" },
  { href: "/app/analytics", label: "Analytics", short: "Analytics" },
  { href: "/app/connections", label: "Connections", short: "People" },
  { href: "/app/passport", label: "Passport", short: "Passport" },
] as const;

// The 60° tick that marks the current destination. Same angle as the Meet mark cut.
const tick = "polygon(2.3px 0,100% 0,calc(100% - 2.3px) 100%,0 100%)";

export function AppShell({ children, displayName, username, avatarUrl, avatarFocus, plan, canManageBilling, publicProfileUrl, signOut }: {
  children: ReactNode;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  avatarFocus?: PhotoFocus;
  plan: PlanCode;
  canManageBilling: boolean;
  publicProfileUrl: string | null;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  // The identity editor is a full-screen workspace with its own navigation.
  if (pathname === "/app/identity" || pathname.startsWith("/app/identity/")) return <>{children}</>;

  return (
    <div className="min-h-dvh bg-[#f5f4ef] font-brand text-[#0d0d0d]">
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-[#0d0d0d] focus:px-4 focus:py-2 focus:text-white" href="#app-main">Skip to content</a>
      <header className="sticky top-0 z-40 grid h-[60px] grid-cols-[1fr_auto] items-center bg-[#f5f4ef]/95 px-4 backdrop-blur-sm md:h-[76px] md:grid-cols-[1fr_auto_1fr] md:px-8">
        <Link aria-label="Setuvara Home" className="flex min-h-11 items-center gap-2.5 justify-self-start rounded-full focus-visible:outline-2" href="/app">
          <MeetMark className="size-[22px] md:size-[26px]" />
          <span className="font-display text-[19px] font-bold tracking-[-0.03em] md:text-[21px]">setuvara</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden gap-0 md:flex lg:gap-1.5">
          {navigation.map((item) => <NavLink item={item} key={item.href} pathname={pathname} variant="top" />)}
        </nav>
        <div className="flex items-center gap-3 justify-self-end">
          <AccountMenu avatarFocus={avatarFocus} avatarUrl={avatarUrl} canManageBilling={canManageBilling} displayName={displayName} plan={plan} publicProfileUrl={publicProfileUrl} signOut={signOut} username={username} />
        </div>
      </header>

      <div className="min-w-0 pb-[calc(78px+env(safe-area-inset-bottom))] md:pb-0" id="app-main" tabIndex={-1}>{children}</div>

      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 bg-[#f5f4ef]/95 px-1.5 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_rgba(13,13,13,.08)] backdrop-blur sm:px-2.5 md:hidden">
        {navigation.map((item) => <NavLink item={item} key={item.href} pathname={pathname} variant="bottom" />)}
      </nav>
    </div>
  );
}

function NavLink({ item, pathname, variant }: { item: (typeof navigation)[number]; pathname: string; variant: "top" | "bottom" }) {
  const active = isActive(pathname, item.href);
  const indicator = <span aria-hidden="true" className={`h-1 w-5 bg-[#ff5a4f] transition-opacity ${active ? "opacity-100" : "opacity-0"}`} style={{ clipPath: tick }} />;
  if (variant === "bottom") {
    return (
      <Link aria-current={active ? "page" : undefined} className={`flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[11px] focus-visible:outline-2 sm:gap-1.5 sm:text-[13px] ${active ? "font-semibold text-[#0d0d0d]" : "font-medium text-black/60"}`} href={item.href}>
        {indicator}{item.short}
      </Link>
    );
  }
  return (
    <Link aria-current={active ? "page" : undefined} className={`flex min-h-11 flex-col items-center justify-center gap-[5px] rounded-full px-2.5 text-[13px] transition-colors focus-visible:outline-2 lg:px-4 lg:text-[15px] ${active ? "font-semibold text-[#0d0d0d]" : "font-medium text-black/60 hover:text-black"}`} href={item.href}>
      <span>{item.label}</span>{indicator}
    </Link>
  );
}

function AccountMenu({ displayName, username, avatarUrl, avatarFocus, plan, canManageBilling, publicProfileUrl, signOut }: {
  displayName: string; username: string | null; avatarUrl: string | null; avatarFocus?: PhotoFocus; plan: PlanCode; canManageBilling: boolean; publicProfileUrl: string | null; signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const first = displayName.trim().split(/\s+/)[0] || displayName;
  const planName = plan === "pro" ? "Setuvara Pro" : plan === "plus" ? "Setuvara Plus" : "Free";

  useEffect(() => {
    if (!open) return;
    const items = () => [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    items()[0]?.focus();
    const onDown = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !root.current?.contains(document.activeElement)) return;
      event.preventDefault();
      const entries = items(); const index = entries.indexOf(document.activeElement as HTMLElement);
      const target = event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : (index + (event.key === "ArrowDown" ? 1 : entries.length - 1)) % entries.length;
      entries[target]?.focus();
    };
    const onFocus = (event: FocusEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); document.removeEventListener("focusin", onFocus); };
  }, [open]);

  async function manageBilling() {
    setBillingBusy(true); setBillingError(false);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const body = (await response.json()) as { portalUrl?: string };
      if (response.ok && body.portalUrl) { window.location.assign(body.portalUrl); return; }
      setBillingError(true);
    } catch { setBillingError(true); }
    setBillingBusy(false);
  }

  const item = "flex min-h-[46px] w-full items-center justify-between rounded-xl px-3.5 text-left text-[15px] font-medium hover:bg-[#f5f4ef] focus-visible:bg-[#f5f4ef] focus-visible:outline-none";
  return (
    <div className="relative" ref={root}>
      <button aria-controls={open ? menuId : undefined} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu" className={`flex min-h-11 items-center gap-2.5 rounded-full py-1 pl-1 pr-1 focus-visible:outline-2 md:pr-2.5 ${open ? "bg-black/[0.06]" : "hover:bg-black/[0.04]"}`} onClick={() => setOpen((value) => !value)} ref={trigger} type="button">
        <Avatar focus={avatarFocus} name={displayName} size="size-9" url={avatarUrl} />
        <span className="hidden max-w-40 truncate text-sm font-semibold md:block">{first}</span>
        <svg aria-hidden="true" className="hidden md:block" height="12" viewBox="0 0 12 12" width="12"><path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      {open && (
        <div aria-label="Account" className="absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[calc(100dvh-96px)] w-[min(316px,calc(100vw-32px))] flex-col overflow-y-auto rounded-[22px] bg-white p-2 shadow-[0_24px_60px_-20px_rgba(13,13,13,.35),0_0_0_1px_rgba(13,13,13,.08)] [animation:fade-in_120ms_ease-out]" id={menuId} role="menu">
          <div className="flex items-center gap-3 px-3 pb-4 pt-3.5">
            <Avatar focus={avatarFocus} name={displayName} size="size-12" url={avatarUrl} />
            <div className="min-w-0"><p className="truncate text-base font-semibold">{displayName}</p>{username && <p className="truncate font-label text-xs text-black/65">setuvara.com/{username}</p>}</div>
          </div>
          <div className="mx-1 mb-1.5 flex items-center justify-between gap-3 rounded-[14px] bg-[#f5f4ef] px-3.5 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold"><StatusBadge plan={plan} size={16} />{planName}</span>
            {canManageBilling
              ? <button className="min-h-11 text-[13px] font-semibold text-black/70 underline-offset-4 hover:underline disabled:opacity-60" disabled={billingBusy} onClick={() => void manageBilling()} role="menuitem" type="button">{billingBusy ? "Opening…" : "Manage"}</button>
              : <Link className="flex min-h-11 items-center text-[13px] font-semibold text-black/70 underline-offset-4 hover:underline" href="/pricing" role="menuitem">See plans</Link>}
          </div>
          {billingError && <p aria-live="polite" className="px-3.5 pb-1 text-xs text-[#a43d36]">Billing could not open. Try again in a moment.</p>}
          {publicProfileUrl && <a className={item} href={publicProfileUrl} rel="noreferrer" role="menuitem" target="_blank">View public profile<span aria-hidden="true" className="text-black/50">↗</span></a>}
          <Link className={item} href="/app/identity?mode=personal&section=settings" role="menuitem">Mode settings</Link>
          <Link className={item} href="/app/settings/notifications" role="menuitem">Email preferences</Link>
          <div className="mx-2.5 my-1.5 h-px bg-black/[0.08]" />
          <form action={signOut}><button className={`${item} text-black/70`} role="menuitem" type="submit">Sign out</button></form>
        </div>
      )}
    </div>
  );
}

export function Avatar({ url, name, size, focus }: { url: string | null; name: string; size: string; focus?: PhotoFocus }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial = name.trim().slice(0, 1).toUpperCase() || "S";
  return (
    <span aria-hidden="true" className={`relative grid ${size} shrink-0 place-items-center overflow-hidden rounded-full bg-[#0d0d0d] text-sm font-semibold text-[#f5f4ef]`}>
      {initial}
      {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, already resized */}
      {url && url !== failedUrl && <img alt="" className="absolute inset-0 size-full object-cover" decoding="async" onError={() => setFailedUrl(url)} src={url} style={{ objectPosition: focusPosition(focus ?? DEFAULT_FOCUS, 1) }} />}
    </span>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
