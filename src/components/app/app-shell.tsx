"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { MeetMark } from "@/components/marketing/brand";
import type { PlanCode } from "@/lib/billing/catalog";
import { DEFAULT_FOCUS, focusPosition, type PhotoFocus } from "@/components/profile/photo-focus";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";
import { FeedbackSheet } from "./feedback-sheet";
import { HomeScreenRuntime, HomeScreenSheet, useStandalone } from "./home-screen";
import { StatusBadge } from "./status-badge";

const navigation = [
  { href: "/app", labelKey: "home", shortKey: "home", icon: "home" },
  { href: "/app/identity", labelKey: "identity", shortKey: "identity", icon: "identity" },
  { href: "/app/wallet", labelKey: "wallet", shortKey: "wallet", icon: "wallet" },
  { href: "/app/analytics", labelKey: "analytics", shortKey: "analytics", icon: "analytics" },
  { href: "/app/connections", labelKey: "connections", shortKey: "people", icon: "people" },
  { href: "/app/passport", labelKey: "passport", shortKey: "passport", icon: "passport" },
] as const;

type NavIconName = (typeof navigation)[number]["icon"];

// 24px line icons, 1.8 stroke, round joins. The active tab sits in the same ink pill as the editor tab bar.
const navIcons: Record<NavIconName, ReactNode> = {
  home: <path d="M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1h-4.25v-5.25h-5.5V20H5a1 1 0 0 1-1-1v-8.6Z" />,
  identity: <><rect height="14" rx="2.75" width="18" x="3" y="5" /><circle cx="9" cy="10.6" r="2.2" /><path d="M5.9 16.2c.6-1.5 1.75-2.3 3.1-2.3s2.5.8 3.1 2.3M14.6 10h4M14.6 13.4h2.8" /></>,
  wallet: <><path d="M4 7.6A2.6 2.6 0 0 1 6.6 5H17v3" /><path d="M4 7.6V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.6A2.6 2.6 0 0 1 4 7.6Z" /><circle cx="16.3" cy="13.5" fill="currentColor" r="1.1" stroke="none" /></>,
  analytics: <path d="M5 20v-5.5M10 20V9M15 20v-7.5M20 20V4.5" />,
  people: <><circle cx="9" cy="8.4" r="3.2" /><path d="M3.4 19.4c.7-3.1 2.9-4.9 5.6-4.9s4.9 1.8 5.6 4.9" /><path d="M15.4 5.4a3 3 0 0 1 0 5.9M17.2 14.6c1.8.5 3 2 3.4 4.4" /></>,
  passport: <><rect height="18" rx="2.5" width="14" x="5" y="3" /><circle cx="12" cy="10" r="3" /><path d="M9.5 16.6h5" /></>,
};

function NavIcon({ name }: { name: NavIconName }) {
  return <svg aria-hidden="true" className="size-[21px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{navIcons[name]}</svg>;
}

// The 60° tick that marks the current destination. Same angle as the Meet mark cut.
const tick = "polygon(2.3px 0,100% 0,calc(100% - 2.3px) 100%,0 100%)";

// Unread messages across the account inbox. Conversation changes wake a recount;
// the count itself always comes from the database.
function useChatUnread(enabled: boolean, pathname: string) {
  const [count, setCount] = useState(0);
  const supabase = useMemo(() => (enabled ? createClient() : null), [enabled]);
  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("chat_unread_total");
    if (!error && typeof data === "number") setCount(data);
  }, [supabase]);
  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh, pathname]);
  useEffect(() => {
    if (!supabase) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const wake = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void refresh(), 400); };
    const onVisible = () => { if (document.visibilityState === "visible") wake(); };
    void supabase.auth.getClaims().then(({ data }) => {
      const id = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
      if (!id) return;
      channel = supabase.channel(`chat-unread:${id}:${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations", filter: `user_low_id=eq.${id}` }, wake)
        .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations", filter: `user_high_id=eq.${id}` }, wake)
        .subscribe();
    });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh, supabase]);
  return count;
}

export function AppShell({ children, displayName, username, avatarUrl, avatarFocus, plan, publicProfileUrl, signOut, walletPubliclyLaunched, chatEnabled = false }: {
  children: ReactNode;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  avatarFocus?: PhotoFocus;
  plan: PlanCode;
  publicProfileUrl: string | null;
  signOut: () => Promise<void>;
  walletPubliclyLaunched: boolean;
  chatEnabled?: boolean;
}) {
  const pathname = usePathname();
  const unread = useChatUnread(chatEnabled, pathname);
  // Any in-app link: the destination tab lights up at once and a thin line runs under the header until
  // the next page commits, so a slow server response never reads as a frozen app.
  const [pending, setPending] = useState<{ path: string; from: string } | null>(null);
  const pendingPath = pending && pending.from === pathname ? pending.path : null;
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/app") || url.pathname === window.location.pathname) return;
      setPending({ path: url.pathname, from: window.location.pathname });
    };
    // Capture phase: next/link prevents the default, and a closing menu may unmount the link.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  useEffect(() => {
    if (!pendingPath) return;
    const timeout = window.setTimeout(() => setPending(null), 10000);
    return () => window.clearTimeout(timeout);
  }, [pendingPath]);
  const visibleNavigation = walletPubliclyLaunched ? navigation : navigation.filter((item) => item.href !== "/app/wallet");
  const messagesSurface = pathname.startsWith("/app/connections/messages");
  // The identity editor is a full-screen workspace with its own navigation. The Creator studio
  // lives inside Identity but keeps the app chrome, like the rest of /app.
  if (pathname === "/app/identity" || (pathname.startsWith("/app/identity/") && !pathname.startsWith("/app/identity/creator"))) return <div lang="en"><HomeScreenRuntime />{children}</div>;

  return (
    <div className="min-h-dvh bg-[#f5f4ef] font-brand text-[#0d0d0d]" lang="en">
      <HomeScreenRuntime />
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-[#0d0d0d] focus:px-4 focus:py-2 focus:text-white" href="#app-main">Skip to content</a>
      <header className="sticky top-0 z-40 grid h-[60px] grid-cols-[1fr_auto] items-center bg-[#f5f4ef]/95 px-4 backdrop-blur-sm md:h-[76px] md:grid-cols-[1fr_auto_1fr] md:px-8">
        <Link aria-label="Setuvara Home" className="flex min-h-11 items-center gap-2.5 justify-self-start rounded-full focus-visible:outline-2" href="/app">
          <MeetMark className="size-[22px] md:size-[26px]" />
          <span className="font-display text-[19px] font-bold tracking-[-0.03em] md:text-[21px]">setuvara</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden gap-0 md:flex lg:gap-1.5">
          {visibleNavigation.map((item) => <NavLink item={item} key={item.href} pathname={pathname} pendingPath={pendingPath} unread={item.href === "/app/connections" ? unread : 0} variant="top" />)}
        </nav>
        <div className="flex items-center gap-3 justify-self-end">
          <AccountMenu avatarFocus={avatarFocus} avatarUrl={avatarUrl} displayName={displayName} plan={plan} publicProfileUrl={publicProfileUrl} signOut={signOut} username={username} />
        </div>
        {pendingPath && <span aria-hidden="true" className="sv-nav-progress pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[#ff5a4f]" key={pendingPath} />}
      </header>

      <div className={`min-w-0 md:pb-0 ${messagesSurface ? "" : "pb-[calc(78px+env(safe-area-inset-bottom))]"}`} id="app-main" tabIndex={-1}>{children}</div>

      {!messagesSurface && <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 grid bg-[#f5f4ef]/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_rgba(13,13,13,.08)] backdrop-blur sm:px-2 md:hidden" style={{ gridTemplateColumns: `repeat(${visibleNavigation.length}, minmax(0, 1fr))` }}>
        {visibleNavigation.map((item) => <NavLink item={item} key={item.href} pathname={pathname} pendingPath={pendingPath} unread={item.href === "/app/connections" ? unread : 0} variant="bottom" />)}
      </nav>}
    </div>
  );
}

function UnreadDot({ count, className }: { count: number; className: string }) {
  if (!count) return null;
  return <span aria-hidden="true" className={`pointer-events-none absolute grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#ff5a4f] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#f5f4ef] ${className}`}>{count > 99 ? "99+" : count}</span>;
}

function NavLink({ item, pathname, pendingPath, variant, unread = 0 }: { item: (typeof navigation)[number]; pathname: string; pendingPath: string | null; variant: "top" | "bottom"; unread?: number }) {
  const { messages } = useI18n();
  const unreadLabel = unread ? `, ${unread} unread ${unread === 1 ? "message" : "messages"}` : "";
  // While a tab is loading it already reads as the current one.
  const active = isActive(pendingPath ?? pathname, item.href);
  if (variant === "bottom") {
    return (
      <Link aria-current={isActive(pathname, item.href) ? "page" : undefined} className={`flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10.5px] leading-none tracking-[-0.005em] focus-visible:outline-2 sm:text-[12px] ${active ? "font-semibold text-[#0d0d0d]" : "font-medium text-black/50"}`} href={item.href}>
        <span className={`relative grid h-8 w-12 place-items-center rounded-full transition-[background-color,color,transform] duration-200 ease-out active:scale-90 ${active ? "bg-[#0d0d0d] text-[#f5f4ef]" : "text-black/60"}`}><NavIcon name={item.icon} /><UnreadDot className="-right-0.5 -top-1" count={unread} /></span>
        <span className="max-w-full truncate">{messages.common[item.shortKey]}{unreadLabel && <span className="sr-only">{unreadLabel}</span>}</span>
      </Link>
    );
  }
  return (
    <Link aria-current={isActive(pathname, item.href) ? "page" : undefined} className={`flex min-h-11 flex-col items-center justify-center gap-[5px] rounded-full px-2.5 text-[13px] transition-colors focus-visible:outline-2 lg:px-4 lg:text-[15px] ${active ? "font-semibold text-[#0d0d0d]" : "font-medium text-black/60 hover:text-black"}`} href={item.href}>
      <span className="relative">{messages.common[item.labelKey]}{unreadLabel && <span className="sr-only">{unreadLabel}</span>}<UnreadDot className="-right-4 -top-2.5" count={unread} /></span><span aria-hidden="true" className={`h-1 w-5 bg-[#ff5a4f] transition-opacity ${active ? "opacity-100" : "opacity-0"}`} style={{ clipPath: tick }} />
    </Link>
  );
}

function AccountMenu({ displayName, username, avatarUrl, avatarFocus, plan, publicProfileUrl, signOut }: {
  displayName: string; username: string | null; avatarUrl: string | null; avatarFocus?: PhotoFocus; plan: PlanCode; publicProfileUrl: string | null; signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [homeScreenOpen, setHomeScreenOpen] = useState(false);
  const standalone = useStandalone();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const first = displayName.trim().split(/\s+/)[0] || displayName;
  const planName = plan === "pro" ? "Setuvara Pro" : plan === "plus" ? "Setuvara Plus" : "Free";
  const { messages } = useI18n();

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

  const closeFeedback = useCallback(() => { setFeedbackOpen(false); trigger.current?.focus(); }, []);
  const closeHomeScreen = useCallback(() => { setHomeScreenOpen(false); trigger.current?.focus(); }, []);

  const item = "flex min-h-[46px] w-full items-center justify-between rounded-xl px-3.5 text-left text-[15px] font-medium hover:bg-[#f5f4ef] focus-visible:bg-[#f5f4ef] focus-visible:outline-none";
  return (
    <div className="relative" ref={root}>
      <button aria-controls={open ? menuId : undefined} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu" className={`flex min-h-11 items-center gap-2.5 rounded-full py-1 pl-1 pr-1 focus-visible:outline-2 md:pr-2.5 ${open ? "bg-black/[0.06]" : "hover:bg-black/[0.04]"}`} onClick={() => setOpen((value) => !value)} ref={trigger} type="button">
        <Avatar focus={avatarFocus} name={displayName} size="size-9" url={avatarUrl} />
        <span className="hidden max-w-40 truncate text-sm font-semibold md:block">{first}</span>
        <svg aria-hidden="true" className="hidden md:block" height="12" viewBox="0 0 12 12" width="12"><path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      {open && (
        <div aria-label="Account" className="absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[calc(100dvh-96px)] w-[min(316px,calc(100vw-32px))] flex-col overflow-y-auto rounded-[22px] bg-white p-2 shadow-[0_24px_60px_-20px_rgba(13,13,13,.35),0_0_0_1px_rgba(13,13,13,.08)] [animation:fade-in_120ms_ease-out]" id={menuId} onClick={(event) => { if ((event.target as Element).closest("a")) setOpen(false); }} role="menu">
          <div className="flex items-center gap-3 px-3 pb-4 pt-3.5">
            <Avatar focus={avatarFocus} name={displayName} size="size-12" url={avatarUrl} />
            <div className="min-w-0"><p className="truncate text-base font-semibold">{displayName}</p>{username && <p className="truncate font-label text-xs text-black/65">setuvara.com/{username}</p>}</div>
          </div>
          {/* Billing: current plan at a glance; the page holds upgrade, plan changes and the payment portal. */}
          <Link className="mx-1 mb-1.5 flex min-h-[58px] items-center justify-between gap-3 rounded-[14px] bg-[#f5f4ef] px-3.5 py-2.5 hover:bg-[#ecebe4] focus-visible:bg-[#ecebe4] focus-visible:outline-none" href="/app/settings/billing" role="menuitem">
            <span className="flex min-w-0 flex-col">
              <span className="font-label text-[10px] uppercase tracking-[0.14em] text-black/55">{messages.common.billing}</span>
              <span className="mt-0.5 flex items-center gap-2 text-sm font-semibold"><StatusBadge plan={plan} size={16} />{planName}</span>
            </span>
            <span className="shrink-0 text-[13px] font-semibold text-black/70">{plan === "free" ? messages.common.upgrade : messages.common.manageBilling}<span aria-hidden="true"> →</span></span>
          </Link>
          <Link className={item} href="/app/context" role="menuitem">{messages.common.liveContext}</Link>
          {publicProfileUrl && <a className={item} href={publicProfileUrl} rel="noreferrer" role="menuitem" target="_blank">{messages.common.viewProfile}<span aria-hidden="true" className="text-black/50">↗</span></a>}
          <Link className={item} href="/app/identity?mode=personal&section=settings" role="menuitem">{messages.common.modeSettings}</Link>
          <Link className={item} href="/app/settings/notifications" role="menuitem">{messages.common.emailPreferences}</Link>
          <button className={item} onClick={() => { setOpen(false); setHomeScreenOpen(true); }} role="menuitem" type="button">{standalone ? "Home Screen app" : "Add to Home Screen"}</button>
          <button className={item} onClick={() => { setOpen(false); setFeedbackOpen(true); }} role="menuitem" type="button">Send feedback</button>
          <div className="mx-2.5 my-1.5 h-px bg-black/[0.08]" />
          <form action={signOut}><button className={`${item} text-black/70`} role="menuitem" type="submit">{messages.common.signOut}</button></form>
        </div>
      )}
      {feedbackOpen && <FeedbackSheet onClose={closeFeedback} />}
      {homeScreenOpen && <HomeScreenSheet onClose={closeHomeScreen} />}
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
