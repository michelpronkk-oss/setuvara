"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { MeetMark } from "@/components/marketing/brand";
import type { PlanCode } from "@/lib/billing/catalog";
import { DEFAULT_FOCUS, focusPosition, type PhotoFocus } from "@/components/profile/photo-focus";
import type { ModeSlug } from "@/components/profile/types";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";
import { FeedbackSheet } from "./feedback-sheet";
import { HomeScreenRuntime, HomeScreenSheet, useStandalone } from "./home-screen";
import { MOBILE_BAR_SPACE, MobileTabBar } from "./mobile-nav";
import { SettingsLink, SideNav, type GlobalPage } from "./side-nav";
import { StatusBadge } from "./status-badge";

export type ShellMode = { slug: ModeSlug; enabled: boolean };


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

export function AppShell({ children, displayName, username, avatarUrl, avatarFocus, plan, publicProfileUrl, signOut, walletPubliclyLaunched, chatEnabled = false, modes = [], isPublished = false }: {
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
  /** Every Mode on the account, in profile order, for the sidebar's Mode switcher. */
  modes?: ShellMode[];
  isPublished?: boolean;
}) {
  const pathname = usePathname();
  const unread = useChatUnread(chatEnabled, pathname);
  // Any in-app link: the destination tab lights up at once and a thin line runs along the top until
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
  const messagesSurface = pathname.startsWith("/app/connections/messages");
  // The identity editor is a full-screen workspace with its own navigation. The Creator studio
  // lives inside it and shares the editor's sidebar.
  if (pathname === "/app/identity" || pathname.startsWith("/app/identity/")) return <div lang="en"><HomeScreenRuntime />{children}</div>;

  const account = { avatarFocus, avatarUrl, displayName, plan, publicProfileUrl, signOut, username };
  return (
    <div className="min-h-dvh bg-[#f5f4ef] font-brand text-[#0d0d0d]" lang="en">
      <HomeScreenRuntime />
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-[#0d0d0d] focus:px-4 focus:py-2 focus:text-white" href="#app-main">Skip to content</a>

      {/* Desktop: the one Setuvara sidebar, shared with every Mode page. */}
      <SideNav
        footer={<><SettingsLink current={globalPage(pathname) === "settings"} /><AccountMenu {...account} placement="panel" /></>}
        modes={modes}
        place={{ global: globalPage(pathname) }}
        published={isPublished}
        unread={unread}
        wallet={walletPubliclyLaunched}
      />

      {/* Phone: slim top bar with the mark and account; the destinations live in the tab bar below. */}
      <header className="sticky top-0 z-40 flex h-[60px] items-center justify-between bg-[#f5f4ef]/95 px-4 backdrop-blur-sm lg:hidden">
        <Link aria-label="Setuvara Home" className="flex min-h-11 items-center gap-2.5 rounded-full focus-visible:outline-2" href="/app">
          <MeetMark className="size-[22px]" />
          <span className="font-display text-[19px] font-bold tracking-[-0.03em]">setuvara</span>
        </Link>
        <AccountMenu {...account} placement="header" />
      </header>
      {pendingPath && <span aria-hidden="true" className="sv-nav-progress pointer-events-none fixed inset-x-0 top-[58px] z-50 h-[2px] bg-[#ff5a4f] lg:left-[268px] lg:top-0" key={pendingPath} />}

      <div className={`min-w-0 lg:pb-0 lg:pl-[268px] ${messagesSurface ? "" : MOBILE_BAR_SPACE}`} id="app-main" tabIndex={-1}>{children}</div>

      {!messagesSurface && <MobileTabBar pendingPath={pendingPath} unread={unread} />}
    </div>
  );
}




/** Which Setuvara-wide page the path belongs to, for the sidebar. */
function globalPage(pathname: string): GlobalPage {
  if (pathname === "/app") return "home";
  for (const page of ["connections", "passport", "analytics", "wallet"] as const) if (pathname === `/app/${page}` || pathname.startsWith(`/app/${page}/`)) return page;
  if (pathname.startsWith("/app/settings") || pathname === "/app/context" || pathname === "/app/tap") return "settings";
  return "other";
}

export function AccountMenu({ displayName, username, avatarUrl, avatarFocus, plan, publicProfileUrl, signOut, placement }: {
  displayName: string; username: string | null; avatarUrl: string | null; avatarFocus?: PhotoFocus; plan: PlanCode; publicProfileUrl: string | null; signOut: () => Promise<void>;
  /** header: phone top bar, opens down. sidebar: foot of the sidebar, opens up (beside the rail on tablets).
   * panel: foot of a sidebar that is always full width (the identity editor), opens up. */
  placement: "header" | "sidebar" | "panel";
}) {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [homeScreenOpen, setHomeScreenOpen] = useState(false);
  const standalone = useStandalone();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
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
      {placement !== "header" ? (
        <button aria-controls={open ? menuId : undefined} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu" className={`flex min-h-[58px] w-full items-center gap-3 rounded-[16px] text-left text-[#f5f4ef] transition-colors focus-visible:outline-2 ${placement === "panel" ? "justify-start p-2" : "justify-center p-1.5 xl:justify-start xl:p-2"} ${open ? "bg-white/[0.1]" : "hover:bg-white/[0.05]"}`} onClick={() => setOpen((value) => !value)} ref={trigger} type="button">
          <Avatar focus={avatarFocus} name={displayName} ring size="size-10" url={avatarUrl} />
          <span className={`min-w-0 flex-1 flex-col ${placement === "panel" ? "flex" : "hidden xl:flex"}`}>
            <span className="truncate text-sm font-semibold">{displayName}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[#f5f4ef]/55">{plan !== "free" && <StatusBadge plan={plan} size={13} />}{planName}</span>
          </span>
          <svg aria-hidden="true" className={`shrink-0 text-[#f5f4ef]/50 ${placement === "panel" ? "block" : "hidden xl:block"}`} fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" viewBox="0 0 14 14" width="14"><path d="M4 5.5 7 2.5l3 3M4 8.5l3 3 3-3" /></svg>
        </button>
      ) : (
        <button aria-controls={open ? menuId : undefined} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu" className={`flex min-h-11 items-center rounded-full p-1 focus-visible:outline-2 ${open ? "bg-black/[0.06]" : "hover:bg-black/[0.04]"}`} onClick={() => setOpen((value) => !value)} ref={trigger} type="button">
          <Avatar focus={avatarFocus} name={displayName} size="size-9" url={avatarUrl} />
        </button>
      )}
      {open && (
        <div aria-label="Account" className={`absolute z-50 flex ${placement === "panel" ? "bottom-[calc(100%+8px)] left-0 max-h-[calc(100dvh-48px)]" : placement === "sidebar" ? "bottom-0 left-[calc(100%+14px)] max-h-[calc(100dvh-48px)] xl:bottom-[calc(100%+8px)] xl:left-0" : "right-0 top-[calc(100%+8px)] max-h-[calc(100dvh-96px)]"} w-[min(316px,calc(100vw-32px))] flex-col overflow-y-auto rounded-[22px] bg-white p-2 text-[#0d0d0d] shadow-[0_24px_60px_-20px_rgba(13,13,13,.35),0_0_0_1px_rgba(13,13,13,.08)] [animation:fade-in_120ms_ease-out]`} id={menuId} onClick={(event) => { if ((event.target as Element).closest("a")) setOpen(false); }} role="menu">
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
          <Link className={item} href="/app/settings" role="menuitem">{messages.common.settings}</Link>
          <Link className={item} href="/app/context" role="menuitem">{messages.common.liveContext}</Link>
          {publicProfileUrl && <a className={item} href={publicProfileUrl} rel="noreferrer" role="menuitem" target="_blank">{messages.common.viewProfile}<span aria-hidden="true" className="text-black/50">↗</span></a>}
          <Link className={item} href="/app/identity?mode=personal&section=settings" role="menuitem">{messages.common.modeSettings}</Link>
          <Link className={item} href="/app/settings/notifications" role="menuitem">{messages.common.emailPreferences}</Link>
          <Link className={item} href="/app/settings/privacy" role="menuitem">Privacy &amp; data</Link>
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

export function Avatar({ url, name, size, focus, ring = false }: { url: string | null; name: string; size: string; focus?: PhotoFocus; ring?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial = name.trim().slice(0, 1).toUpperCase() || "S";
  return (
    <span aria-hidden="true" className={`relative grid ${size} shrink-0 place-items-center overflow-hidden rounded-full ${ring ? "bg-[#26262a] ring-1 ring-white/15" : "bg-[#0d0d0d]"} text-sm font-semibold text-[#f5f4ef]`}>
      {initial}
      {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, already resized */}
      {url && url !== failedUrl && <img alt="" className="absolute inset-0 size-full object-cover" decoding="async" onError={() => setFailedUrl(url)} src={url} style={{ objectPosition: focusPosition(focus ?? DEFAULT_FOCUS, 1) }} />}
    </span>
  );
}

